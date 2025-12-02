/**
 * Monorepo 构建器
 * 支持批量构建多个包，分析包之间的依赖关系
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import { EventEmitter } from 'events'
import path from 'path'
import fs from 'fs-extra'
import { LibraryBuilder } from './LibraryBuilder'
import type { BuilderConfig } from '../types/config'
import type { BuildResult } from '../types/builder'
import { Logger } from '../utils/logger'
import { createParallelProcessor, type ParallelProcessor } from '../utils/parallel/ParallelProcessor'

/**
 * 包信息
 */
export interface PackageInfo {
  name: string
  path: string
  packageJson: any
  dependencies: string[]
  devDependencies: string[]
  peerDependencies: string[]
  localDependencies: string[] // Monorepo 内部依赖
}

/**
 * Monorepo 配置
 */
export interface MonorepoConfig {
  /** 工作区根目录 */
  root?: string
  /** 包目录模式 */
  packages?: string[]
  /** 并发构建数 */
  concurrency?: number
  /** 是否启用拓扑排序 */
  topologicalSort?: boolean
  /** 是否启用增量构建 */
  incremental?: boolean
  /** 构建过滤器 */
  filter?: (pkg: PackageInfo) => boolean
}

/**
 * Monorepo 构建器
 */
export class MonorepoBuilder extends EventEmitter {
  private root: string
  private packages: PackageInfo[] = []
  private logger: Logger
  private parallelProcessor: ParallelProcessor
  private buildResults = new Map<string, BuildResult>()
  private dependencyGraph = new Map<string, Set<string>>()

  constructor(config: MonorepoConfig = {}) {
    super()

    this.root = config.root || process.cwd()
    this.logger = new Logger({ prefix: 'Monorepo' })
    this.parallelProcessor = createParallelProcessor({
      maxConcurrency: config.concurrency || 4,
      enablePriority: true,
      autoAdjustConcurrency: true
    })
  }

  /**
   * 发现所有包
   */
  async discoverPackages(patterns?: string[]): Promise<PackageInfo[]> {
    this.logger.info('开始发现包...')

    const defaultPatterns = patterns || [
      'packages/*',
      'libraries/*',
      'apps/*'
    ]

    const { glob } = await import('fast-glob')
    const packagePaths: string[] = []

    for (const pattern of defaultPatterns) {
      const paths = await glob(path.join(pattern, 'package.json'), {
        cwd: this.root,
        absolute: true
      })
      packagePaths.push(...paths)
    }

    this.packages = []

    for (const pkgPath of packagePaths) {
      try {
        const packageJson = await fs.readJson(pkgPath)
        const packageDir = path.dirname(pkgPath)

        const info: PackageInfo = {
          name: packageJson.name || path.basename(packageDir),
          path: packageDir,
          packageJson,
          dependencies: Object.keys(packageJson.dependencies || {}),
          devDependencies: Object.keys(packageJson.devDependencies || {}),
          peerDependencies: Object.keys(packageJson.peerDependencies || {}),
          localDependencies: []
        }

        this.packages.push(info)
      } catch (error) {
        this.logger.warn(`读取包信息失败: ${pkgPath}`)
      }
    }

    // 分析本地依赖
    this.analyzeLocalDependencies()

    this.logger.info(`发现 ${this.packages.length} 个包`)

    return this.packages
  }

  /**
   * 分析本地依赖
   */
  private analyzeLocalDependencies(): void {
    const packageNames = new Set(this.packages.map(p => p.name))

    for (const pkg of this.packages) {
      const allDeps = [
        ...pkg.dependencies,
        ...pkg.devDependencies,
        ...pkg.peerDependencies
      ]

      pkg.localDependencies = allDeps.filter(dep => packageNames.has(dep))

      // 构建依赖图
      if (!this.dependencyGraph.has(pkg.name)) {
        this.dependencyGraph.set(pkg.name, new Set())
      }

      for (const localDep of pkg.localDependencies) {
        this.dependencyGraph.get(pkg.name)!.add(localDep)
      }
    }
  }

  /**
   * 检测循环依赖
   * 返回所有循环依赖路径
   */
  detectCircularDependencies(): string[][] {
    const cycles: string[][] = []
    const visited = new Set<string>()
    const stack = new Set<string>()

    const dfs = (pkg: string, path: string[]) => {
      if (stack.has(pkg)) {
        // 找到循环
        const cycleStart = path.indexOf(pkg)
        if (cycleStart !== -1) {
          const cycle = path.slice(cycleStart).concat(pkg)
          cycles.push(cycle)
        }
        return
      }

      if (visited.has(pkg)) return

      visited.add(pkg)
      stack.add(pkg)
      path.push(pkg)

      const deps = this.dependencyGraph.get(pkg) || new Set()
      for (const dep of deps) {
        dfs(dep, [...path])
      }

      stack.delete(pkg)
    }

    for (const pkg of this.packages) {
      dfs(pkg.name, [])
    }

    return cycles
  }

  /**
   * 拓扑排序
   * 确保依赖的包先构建
   */
  topologicalSort(): PackageInfo[] {
    // 首先检测循环依赖
    const cycles = this.detectCircularDependencies()
    if (cycles.length > 0) {
      this.logger.warn(`检测到 ${cycles.length} 个循环依赖:`)
      cycles.forEach((cycle, index) => {
        this.logger.warn(`  循环 ${index + 1}: ${cycle.join(' -> ')}`)
      })
    }

    const sorted: PackageInfo[] = []
    const visited = new Set<string>()
    const visiting = new Set<string>()

    const visit = (pkgName: string): void => {
      if (visited.has(pkgName)) return
      if (visiting.has(pkgName)) {
        // 跳过循环依赖节点，避免无限递归
        return
      }

      visiting.add(pkgName)

      const deps = this.dependencyGraph.get(pkgName) || new Set()
      for (const dep of deps) {
        visit(dep)
      }

      visiting.delete(pkgName)
      visited.add(pkgName)

      const pkg = this.packages.find(p => p.name === pkgName)
      if (pkg) {
        sorted.push(pkg)
      }
    }

    for (const pkg of this.packages) {
      visit(pkg.name)
    }

    return sorted
  }

  /**
   * 批量构建所有包
   */
  async buildAll(config?: {
    filter?: (pkg: PackageInfo) => boolean
    topological?: boolean
    parallel?: boolean
  }): Promise<Map<string, BuildResult>> {
    const {
      filter,
      topological = true,
      parallel = true
    } = config || {}

    // 过滤包
    let packages = this.packages
    if (filter) {
      packages = packages.filter(filter)
    }

    // 拓扑排序
    if (topological) {
      packages = this.topologicalSort().filter(p => packages.includes(p))
    }

    this.logger.info(`开始构建 ${packages.length} 个包...`)

    if (parallel && !topological) {
      // 并行构建（忽略依赖顺序）
      await this.buildParallel(packages)
    } else {
      // 串行或分层并行构建（考虑依赖顺序）
      await this.buildSequential(packages)
    }

    this.logger.info(`所有包构建完成`)

    return this.buildResults
  }

  /**
   * 并行构建
   */
  private async buildParallel(packages: PackageInfo[]): Promise<void> {
    for (const pkg of packages) {
      this.parallelProcessor.addTask({
        id: pkg.name,
        fn: async () => await this.buildPackage(pkg),
        data: pkg,
        priority: this.calculateBuildPriority(pkg)
      })
    }

    await this.parallelProcessor.waitAll()
  }

  /**
   * 串行构建
   */
  private async buildSequential(packages: PackageInfo[]): Promise<void> {
    for (const pkg of packages) {
      await this.buildPackage(pkg)
    }
  }

  /**
   * 构建单个包
   */
  private async buildPackage(pkg: PackageInfo): Promise<BuildResult> {
    this.logger.info(`构建 ${pkg.name}...`)
    this.emit('package:build:start', pkg)

    try {
      const builder = new LibraryBuilder({
        logger: this.logger.child(pkg.name)
      })

      // 切换到包目录
      const originalCwd = process.cwd()
      process.chdir(pkg.path)

      // 加载包的配置
      await builder.initialize()
      const result = await builder.build()

      // 恢复工作目录
      process.chdir(originalCwd)

      // 保存构建结果
      this.buildResults.set(pkg.name, result)

      this.emit('package:build:success', { pkg, result })
      this.logger.success(`✓ ${pkg.name} 构建成功`)

      // 清理资源
      await builder.dispose()

      return result
    } catch (error) {
      this.emit('package:build:error', { pkg, error })
      this.logger.error(`✗ ${pkg.name} 构建失败:`, error)
      throw error
    }
  }

  /**
   * 计算构建优先级
   * 被依赖越多，优先级越高
   */
  private calculateBuildPriority(pkg: PackageInfo): number {
    let dependentCount = 0

    for (const other of this.packages) {
      if (other.localDependencies.includes(pkg.name)) {
        dependentCount++
      }
    }

    return dependentCount
  }

  /**
   * 获取构建摘要
   */
  getSummary(): {
    total: number
    success: number
    failed: number
    duration: number
    packages: Array<{
      name: string
      status: 'success' | 'failed'
      duration: number
      size: number
    }>
  } {
    const packages = Array.from(this.buildResults.entries()).map(([name, result]) => ({
      name,
      status: result.success ? 'success' as const : 'failed' as const,
      duration: result.duration,
      size: result.stats?.totalSize?.raw || 0
    }))

    return {
      total: packages.length,
      success: packages.filter(p => p.status === 'success').length,
      failed: packages.filter(p => p.status === 'failed').length,
      duration: packages.reduce((sum, p) => sum + p.duration, 0),
      packages
    }
  }

  /**
   * 获取依赖图
   */
  getDependencyGraph(): Map<string, Set<string>> {
    return this.dependencyGraph
  }

  /**
   * 可视化依赖图（简单的文本格式）
   */
  visualizeDependencyGraph(): string {
    let output = '依赖关系图:\n'

    for (const [pkg, deps] of this.dependencyGraph.entries()) {
      if (deps.size > 0) {
        output += `  ${pkg}\n`
        for (const dep of deps) {
          output += `    └─ ${dep}\n`
        }
      }
    }

    return output
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.parallelProcessor.dispose()
    this.buildResults.clear()
    this.dependencyGraph.clear()
    this.removeAllListeners()
  }
}

/**
 * 创建 Monorepo 构建器
 */
export function createMonorepoBuilder(config?: MonorepoConfig): MonorepoBuilder {
  return new MonorepoBuilder(config)
}

