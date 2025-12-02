/**
 * 增量构建管理器
 * 
 * 提供智能的增量构建功能，只重新构建变更的文件
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import { createHash } from 'crypto'
import path from 'path'
import fs from 'fs-extra'
import { Logger } from '../logger'

/**
 * 文件变更信息
 */
export interface FileChangeInfo {
  path: string
  hash: string
  timestamp: number
  size: number
  dependencies?: string[] // 依赖的文件列表
  dependents?: string[] // 依赖此文件的文件列表
}

/**
 * 依赖图节点
 */
export interface DependencyNode {
  path: string
  dependencies: Set<string>
  dependents: Set<string>
  circular: boolean
  depth: number
}

/**
 * 增量构建状态
 */
export interface IncrementalBuildState {
  files: Map<string, FileChangeInfo>
  dependencyGraph: Map<string, DependencyNode>
  lastBuildTime: number
  buildCount: number
}

/**
 * 增量构建选项
 */
export interface IncrementalBuildOptions {
  /** 状态文件路径 */
  stateFile?: string
  /** 是否启用 */
  enabled?: boolean
  /** 忽略的文件模式 */
  ignorePatterns?: string[]
  /** 自定义哈希算法 */
  hashAlgorithm?: 'md5' | 'sha1' | 'sha256'
}

/**
 * 增量构建管理器
 */
export class IncrementalBuildManager {
  private state: IncrementalBuildState
  private stateFile: string
  private enabled: boolean
  private ignorePatterns: RegExp[]
  private hashAlgorithm: string
  private logger: Logger
  private circularDependencies: string[][] = []

  constructor(options: IncrementalBuildOptions = {}) {
    this.stateFile = options.stateFile || path.join(
      process.cwd(),
      'node_modules',
      '.cache',
      '@ldesign',
      'builder',
      'incremental-state.json'
    )
    this.enabled = options.enabled !== false
    this.ignorePatterns = (options.ignorePatterns || []).map(p => new RegExp(p))
    this.hashAlgorithm = options.hashAlgorithm || 'md5'
    this.logger = new Logger({ prefix: 'IncrementalBuild' })

    this.state = {
      files: new Map(),
      dependencyGraph: new Map(),
      lastBuildTime: 0,
      buildCount: 0
    }
  }

  /**
   * 加载构建状态
   */
  async loadState(): Promise<void> {
    if (!this.enabled) return

    try {
      const content = await fs.readFile(this.stateFile, 'utf-8')
      const data = JSON.parse(content)

      this.state = {
        files: new Map(Object.entries(data.files || {})),
        dependencyGraph: new Map(
          (data.dependencyGraph || []).map((node: any) => [
            node.path,
            {
              path: node.path,
              dependencies: new Set(node.dependencies || []),
              dependents: new Set(node.dependents || []),
              circular: node.circular || false,
              depth: node.depth || 0
            }
          ])
        ),
        lastBuildTime: data.lastBuildTime || 0,
        buildCount: data.buildCount || 0
      }

      this.logger.debug(`已加载增量构建状态: ${this.state.files.size} 个文件, ${this.state.dependencyGraph.size} 个依赖节点`)
    } catch (error) {
      // 状态文件不存在或损坏，使用默认状态
      this.logger.debug('未找到增量构建状态，将进行完整构建')
    }
  }

  /**
   * 保存构建状态
   */
  async saveState(): Promise<void> {
    if (!this.enabled) return

    try {
      await fs.mkdir(path.dirname(this.stateFile), { recursive: true })

      const data = {
        files: Object.fromEntries(this.state.files),
        dependencyGraph: Array.from(this.state.dependencyGraph.values()).map(node => ({
          path: node.path,
          dependencies: Array.from(node.dependencies),
          dependents: Array.from(node.dependents),
          circular: node.circular,
          depth: node.depth
        })),
        lastBuildTime: Date.now(),
        buildCount: this.state.buildCount + 1
      }

      await fs.writeFile(this.stateFile, JSON.stringify(data, null, 2))
      this.logger.debug('已保存增量构建状态（包含依赖图）')
    } catch (error) {
      this.logger.warn('保存增量构建状态失败:', error)
    }
  }

  /**
   * 计算文件哈希
   */
  private async calculateFileHash(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath)
    // 使用 Uint8Array 转换以兼容 TypeScript 类型
    return createHash(this.hashAlgorithm).update(new Uint8Array(content)).digest('hex')
  }

  /**
   * 检查文件是否应该被忽略
   */
  private shouldIgnore(filePath: string): boolean {
    return this.ignorePatterns.some(pattern => pattern.test(filePath))
  }

  /**
   * 检查文件是否变更
   */
  async hasFileChanged(filePath: string): Promise<boolean> {
    if (!this.enabled || this.shouldIgnore(filePath)) {
      return true // 禁用时或忽略的文件总是认为已变更
    }

    try {
      const stats = await fs.stat(filePath)
      const currentHash = await this.calculateFileHash(filePath)
      const previousInfo = this.state.files.get(filePath)

      if (!previousInfo) {
        // 新文件
        return true
      }

      // 检查哈希和大小
      return previousInfo.hash !== currentHash || previousInfo.size !== stats.size
    } catch (error) {
      // 文件不存在或无法访问
      return true
    }
  }

  /**
   * 批量检查文件变更（增强版）
   * 考虑依赖关系，如果依赖的文件变更，则此文件也需要重新构建
   */
  async getChangedFiles(filePaths: string[]): Promise<{
    changed: string[]
    unchanged: string[]
    added: string[]
    removed: string[]
    affectedByDependencies: string[]
  }> {
    const changed: string[] = []
    const unchanged: string[] = []
    const added: string[] = []
    const affectedByDependencies: string[] = []

    // 首先检查直接变更的文件
    for (const filePath of filePaths) {
      const isChanged = await this.hasFileChanged(filePath)
      const isNew = !this.state.files.has(filePath)

      if (isNew) {
        added.push(filePath)
      } else if (isChanged) {
        changed.push(filePath)
      } else {
        unchanged.push(filePath)
      }
    }

    // 分析依赖影响：找出受变更文件影响的文件
    const directlyChanged = new Set([...changed, ...added])
    const affected = await this.findAffectedFiles(directlyChanged)

    for (const file of affected) {
      if (!directlyChanged.has(file) && filePaths.includes(file)) {
        affectedByDependencies.push(file)
        // 从 unchanged 移除
        const index = unchanged.indexOf(file)
        if (index > -1) {
          unchanged.splice(index, 1)
        }
      }
    }

    // 检查已删除的文件
    const currentFiles = new Set(filePaths)
    const removed = Array.from(this.state.files.keys()).filter(
      f => !currentFiles.has(f)
    )

    return { changed, unchanged, added, removed, affectedByDependencies }
  }

  /**
   * 查找受影响的文件（通过依赖关系）
   */
  private async findAffectedFiles(changedFiles: Set<string>): Promise<Set<string>> {
    const affected = new Set<string>()
    const queue = Array.from(changedFiles)

    while (queue.length > 0) {
      const file = queue.shift()!
      const node = this.state.dependencyGraph.get(file)

      if (node) {
        for (const dependent of node.dependents) {
          if (!affected.has(dependent)) {
            affected.add(dependent)
            queue.push(dependent)
          }
        }
      }
    }

    return affected
  }

  /**
   * 更新文件信息
   */
  async updateFile(filePath: string): Promise<void> {
    if (!this.enabled || this.shouldIgnore(filePath)) {
      return
    }

    try {
      const stats = await fs.stat(filePath)
      const hash = await this.calculateFileHash(filePath)

      this.state.files.set(filePath, {
        path: filePath,
        hash,
        timestamp: stats.mtimeMs,
        size: stats.size
      })
    } catch (error) {
      this.logger.warn(`更新文件信息失败: ${filePath}`, error)
    }
  }

  /**
   * 批量更新文件信息
   */
  async updateFiles(filePaths: string[]): Promise<void> {
    await Promise.all(filePaths.map(f => this.updateFile(f)))
  }

  /**
   * 移除文件信息
   */
  removeFile(filePath: string): void {
    this.state.files.delete(filePath)
  }

  /**
   * 清除所有状态
   */
  async clear(): Promise<void> {
    this.state = {
      files: new Map(),
      dependencyGraph: new Map(),
      lastBuildTime: 0,
      buildCount: 0
    }

    try {
      await fs.unlink(this.stateFile)
      this.logger.info('已清除增量构建状态')
    } catch {
      // 文件可能不存在
    }
  }

  /**
   * 获取构建统计信息
   */
  getStats(): {
    totalFiles: number
    lastBuildTime: number
    buildCount: number
    cacheHitRate?: number
  } {
    return {
      totalFiles: this.state.files.size,
      lastBuildTime: this.state.lastBuildTime,
      buildCount: this.state.buildCount
    }
  }

  /**
   * 是否需要完整构建
   */
  needsFullBuild(): boolean {
    return !this.enabled || this.state.files.size === 0
  }

  /**
   * 构建依赖图
   * 分析文件之间的依赖关系
   */
  async buildDependencyGraph(entryFiles: string[]): Promise<void> {
    this.logger.debug('开始构建依赖图...')

    const visited = new Set<string>()
    const processing = new Set<string>()
    this.circularDependencies = []

    for (const entry of entryFiles) {
      await this.analyzeDependencies(entry, visited, processing, [])
    }

    // 计算节点深度
    this.calculateDepths()

    this.logger.debug(`依赖图构建完成: ${this.state.dependencyGraph.size} 个节点`)

    if (this.circularDependencies.length > 0) {
      this.logger.warn(`发现 ${this.circularDependencies.length} 个循环依赖`)
    }
  }

  /**
   * 分析文件依赖
   */
  private async analyzeDependencies(
    filePath: string,
    visited: Set<string>,
    processing: Set<string>,
    path: string[]
  ): Promise<void> {
    // 跳过已访问的文件
    if (visited.has(filePath)) {
      return
    }

    // 检测循环依赖
    if (processing.has(filePath)) {
      const cycleStart = path.indexOf(filePath)
      if (cycleStart !== -1) {
        const cycle = path.slice(cycleStart).concat(filePath)
        this.circularDependencies.push(cycle)

        // 标记循环中的所有节点
        for (const file of cycle) {
          const node = this.state.dependencyGraph.get(file)
          if (node) {
            node.circular = true
          }
        }
      }
      return
    }

    visited.add(filePath)
    processing.add(filePath)

    // 获取或创建节点
    let node = this.state.dependencyGraph.get(filePath)
    if (!node) {
      node = {
        path: filePath,
        dependencies: new Set(),
        dependents: new Set(),
        circular: false,
        depth: 0
      }
      this.state.dependencyGraph.set(filePath, node)
    }

    // 提取文件的导入语句
    const imports = await this.extractImports(filePath)

    for (const importPath of imports) {
      const resolvedPath = await this.resolveImportPath(filePath, importPath)

      if (resolvedPath) {
        // 添加依赖关系
        node.dependencies.add(resolvedPath)

        // 添加反向依赖
        let depNode = this.state.dependencyGraph.get(resolvedPath)
        if (!depNode) {
          depNode = {
            path: resolvedPath,
            dependencies: new Set(),
            dependents: new Set(),
            circular: false,
            depth: 0
          }
          this.state.dependencyGraph.set(resolvedPath, depNode)
        }
        depNode.dependents.add(filePath)

        // 递归分析依赖
        await this.analyzeDependencies(resolvedPath, visited, processing, [...path, filePath])
      }
    }

    processing.delete(filePath)
  }

  /**
   * 提取文件中的导入语句
   */
  private async extractImports(filePath: string): Promise<string[]> {
    const imports: string[] = []

    try {
      const content = await fs.readFile(filePath, 'utf-8')

      // 匹配 ES6 import
      const importRegex = /import\s+(?:[\w\s{},*]+\s+from\s+)?['"]([^'"]+)['"]/g
      let match
      while ((match = importRegex.exec(content)) !== null) {
        if (this.isLocalImport(match[1])) {
          imports.push(match[1])
        }
      }

      // 匹配 CommonJS require
      const requireRegex = /require\s*\(['"]([^'"]+)['"]\)/g
      while ((match = requireRegex.exec(content)) !== null) {
        if (this.isLocalImport(match[1])) {
          imports.push(match[1])
        }
      }

      // 匹配动态 import
      const dynamicImportRegex = /import\s*\(['"]([^'"]+)['"]\)/g
      while ((match = dynamicImportRegex.exec(content)) !== null) {
        if (this.isLocalImport(match[1])) {
          imports.push(match[1])
        }
      }
    } catch (error) {
      this.logger.debug(`提取导入失败: ${filePath}`)
    }

    return [...new Set(imports)]
  }

  /**
   * 判断是否为本地导入
   */
  private isLocalImport(importPath: string): boolean {
    return importPath.startsWith('./') || importPath.startsWith('../')
  }

  /**
   * 解析导入路径为绝对路径
   */
  private async resolveImportPath(fromFile: string, importPath: string): Promise<string | null> {
    const baseDir = path.dirname(fromFile)
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.json']

    // 解析相对路径
    let resolved = path.resolve(baseDir, importPath)

    // 尝试直接路径
    if (await fs.pathExists(resolved)) {
      return resolved
    }

    // 尝试添加扩展名
    for (const ext of extensions) {
      const withExt = resolved + ext
      if (await fs.pathExists(withExt)) {
        return withExt
      }
    }

    // 尝试 index 文件
    for (const ext of extensions) {
      const indexPath = path.join(resolved, `index${ext}`)
      if (await fs.pathExists(indexPath)) {
        return indexPath
      }
    }

    return null
  }

  /**
   * 计算依赖深度
   */
  private calculateDepths(): void {
    const visited = new Set<string>()

    const calculateDepth = (filePath: string, currentDepth: number = 0): number => {
      const node = this.state.dependencyGraph.get(filePath)
      if (!node || visited.has(filePath)) {
        return currentDepth
      }

      visited.add(filePath)

      let maxDepth = currentDepth
      for (const dep of node.dependencies) {
        const depDepth = calculateDepth(dep, currentDepth + 1)
        maxDepth = Math.max(maxDepth, depDepth)
      }

      node.depth = maxDepth
      return maxDepth
    }

    // 从所有根节点开始计算
    for (const [filePath, node] of this.state.dependencyGraph.entries()) {
      if (node.dependents.size === 0) {
        visited.clear()
        calculateDepth(filePath, 0)
      }
    }
  }

  /**
   * 获取循环依赖列表
   */
  getCircularDependencies(): string[][] {
    return this.circularDependencies
  }

  /**
   * 获取依赖图统计信息
   */
  getDependencyStats(): {
    totalNodes: number
    totalEdges: number
    circularCount: number
    maxDepth: number
    avgDependencies: number
  } {
    let totalEdges = 0
    let maxDepth = 0

    for (const node of this.state.dependencyGraph.values()) {
      totalEdges += node.dependencies.size
      maxDepth = Math.max(maxDepth, node.depth)
    }

    const avgDependencies = this.state.dependencyGraph.size > 0
      ? totalEdges / this.state.dependencyGraph.size
      : 0

    return {
      totalNodes: this.state.dependencyGraph.size,
      totalEdges,
      circularCount: this.circularDependencies.length,
      maxDepth,
      avgDependencies
    }
  }

  /**
   * 优化建议：检测循环依赖并提供修复建议
   */
  getCircularDependencyAdvice(): Array<{
    cycle: string[]
    severity: 'low' | 'medium' | 'high'
    suggestion: string
  }> {
    return this.circularDependencies.map(cycle => {
      const severity = cycle.length > 5 ? 'high' : cycle.length > 3 ? 'medium' : 'low'

      let suggestion = '考虑以下重构方案：\n'
      if (cycle.length === 2) {
        suggestion += '- 将共享逻辑提取到第三个独立模块\n'
        suggestion += '- 使用依赖注入模式打破循环'
      } else {
        suggestion += '- 识别并提取循环中的核心功能\n'
        suggestion += '- 重新设计模块层次结构\n'
        suggestion += '- 考虑使用事件总线模式'
      }

      return { cycle, severity, suggestion }
    })
  }

  /**
   * 获取构建优先级队列（基于依赖深度）
   */
  getBuildOrder(): string[] {
    const sorted: string[] = []
    const visited = new Set<string>()

    // 拓扑排序
    const visit = (filePath: string) => {
      if (visited.has(filePath)) {
        return
      }

      visited.add(filePath)
      const node = this.state.dependencyGraph.get(filePath)

      if (node) {
        // 先访问依赖
        for (const dep of node.dependencies) {
          visit(dep)
        }
      }

      sorted.push(filePath)
    }

    // 从根节点开始
    for (const [filePath, node] of this.state.dependencyGraph.entries()) {
      if (node.dependents.size === 0) {
        visit(filePath)
      }
    }

    // 处理剩余节点（可能在循环中）
    for (const filePath of this.state.dependencyGraph.keys()) {
      if (!visited.has(filePath)) {
        visit(filePath)
      }
    }

    return sorted
  }

  /**
   * 获取关键路径（影响构建时间最大的依赖链）
   */
  getCriticalPath(): string[] {
    const buildTimes = new Map<string, number>()

    // 假设每个文件的构建时间与其大小成正比
    for (const [filePath, info] of this.state.files.entries()) {
      buildTimes.set(filePath, info.size / 1000) // 简化：1KB = 1ms
    }

    // 找到最长路径
    const longestPath: string[] = []
    let maxTime = 0

    const calculatePath = (filePath: string, currentPath: string[], currentTime: number) => {
      const node = this.state.dependencyGraph.get(filePath)
      if (!node) {
        return
      }

      const fileTime = buildTimes.get(filePath) || 0
      const totalTime = currentTime + fileTime

      if (totalTime > maxTime) {
        maxTime = totalTime
        longestPath.length = 0
        longestPath.push(...currentPath, filePath)
      }

      for (const dep of node.dependencies) {
        if (!currentPath.includes(dep)) {
          calculatePath(dep, [...currentPath, filePath], totalTime)
        }
      }
    }

    // 从根节点开始
    for (const [filePath, node] of this.state.dependencyGraph.entries()) {
      if (node.dependents.size === 0) {
        calculatePath(filePath, [], 0)
      }
    }

    return longestPath
  }

  /**
   * 预测构建时间
   */
  estimateBuildTime(files: string[]): {
    estimated: number
    breakdown: Array<{ file: string; time: number }>
  } {
    const breakdown: Array<{ file: string; time: number }> = []
    let total = 0

    for (const file of files) {
      const info = this.state.files.get(file)
      if (info) {
        // 基于文件大小的简单估算
        const time = info.size / 10000 // 10KB = 1ms
        breakdown.push({ file, time })
        total += time
      }
    }

    return { estimated: total, breakdown }
  }
}

/**
 * 创建增量构建管理器实例
 */
export function createIncrementalBuildManager(
  options?: IncrementalBuildOptions
): IncrementalBuildManager {
  return new IncrementalBuildManager(options)
}

