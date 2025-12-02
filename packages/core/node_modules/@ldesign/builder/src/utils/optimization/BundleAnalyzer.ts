/**
 * 打包分析器
 * 提供完整的打包结果分析功能
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import type { Logger } from '../logger'

/**
 * 依赖树节点
 */
export interface DependencyTreeNode {
  id: string
  name: string
  size: number
  children: DependencyTreeNode[]
  depth: number
  circular: boolean
}

/**
 * 大小分析结果
 */
export interface SizeAnalysis {
  total: number
  byType: Record<string, number>
  byModule: Array<{
    module: string
    size: number
    percentage: number
  }>
  largest: Array<{
    file: string
    size: number
  }>
}

/**
 * 重复依赖
 */
export interface Duplicate {
  name: string
  versions: string[]
  locations: string[]
  totalSize: number
}

/**
 * 优化建议
 */
export interface OptimizationSuggestion {
  type: 'size' | 'performance' | 'structure'
  severity: 'low' | 'medium' | 'high'
  title: string
  description: string
  impact: string
  solution: string
}

/**
 * 打包分析器
 */
export class BundleAnalyzer {
  private logger: Logger

  constructor(logger?: Logger) {
    this.logger = logger || new (require('../logger').Logger)()
  }

  /**
   * 分析依赖树
   */
  analyzeDependencyTree(outputs: any[]): DependencyTreeNode {
    this.logger.info('分析模块依赖关系...')

    const root: DependencyTreeNode = {
      id: 'root',
      name: 'Bundle',
      size: outputs.reduce((sum, o) => sum + (o.size || 0), 0),
      children: [],
      depth: 0,
      circular: false
    }

    // 按模块分组
    const moduleMap = new Map<string, any[]>()

    for (const output of outputs) {
      if (!output.fileName) continue

      const parts = output.fileName.split('/')
      const moduleName = parts.length > 1 ? parts[0] : 'root'

      if (!moduleMap.has(moduleName)) {
        moduleMap.set(moduleName, [])
      }
      moduleMap.get(moduleName)!.push(output)
    }

    // 构建树结构
    for (const [moduleName, files] of moduleMap.entries()) {
      const moduleSize = files.reduce((sum, f) => sum + (f.size || 0), 0)

      root.children.push({
        id: moduleName,
        name: moduleName,
        size: moduleSize,
        children: files.map(f => ({
          id: f.fileName,
          name: f.fileName,
          size: f.size || 0,
          children: [],
          depth: 2,
          circular: false
        })),
        depth: 1,
        circular: false
      })
    }

    return root
  }

  /**
   * 分析打包体积
   */
  analyzeBundleSize(outputs: any[]): SizeAnalysis {
    this.logger.info('分析打包体积...')

    const totalSize = outputs.reduce((sum, o) => sum + (o.size || 0), 0)
    const byType: Record<string, number> = {}
    const byModule: Array<{ module: string; size: number; percentage: number }> = []

    // 按类型统计
    for (const output of outputs) {
      const ext = output.fileName?.split('.').pop() || 'unknown'
      byType[ext] = (byType[ext] || 0) + (output.size || 0)
    }

    // 按模块统计
    const moduleMap = new Map<string, number>()
    for (const output of outputs) {
      const moduleName = output.fileName?.split('/')[0] || 'root'
      moduleMap.set(moduleName, (moduleMap.get(moduleName) || 0) + (output.size || 0))
    }

    for (const [module, size] of moduleMap.entries()) {
      byModule.push({
        module,
        size,
        percentage: (size / totalSize) * 100
      })
    }

    byModule.sort((a, b) => b.size - a.size)

    // 找出最大的文件
    const largest = outputs
      .map(o => ({ file: o.fileName, size: o.size || 0 }))
      .sort((a, b) => b.size - a.size)
      .slice(0, 10)

    return {
      total: totalSize,
      byType,
      byModule,
      largest
    }
  }

  /**
   * 检测重复依赖
   */
  detectDuplicates(outputs: any[]): Duplicate[] {
    this.logger.info('检测重复依赖...')

    const duplicates: Duplicate[] = []
    const moduleVersions = new Map<string, Set<string>>()

    // 简单的重复检测逻辑（可以扩展为更复杂的分析）
    for (const output of outputs) {
      if (!output.fileName) continue

      // 检测相同模块的不同版本
      const match = output.fileName.match(/node_modules\/([^/]+)/)
      if (match) {
        const moduleName = match[1]
        if (!moduleVersions.has(moduleName)) {
          moduleVersions.set(moduleName, new Set())
        }
        moduleVersions.get(moduleName)!.add(output.fileName)
      }
    }

    // 找出有多个版本的模块
    for (const [name, versions] of moduleVersions.entries()) {
      if (versions.size > 1) {
        duplicates.push({
          name,
          versions: Array.from(versions),
          locations: Array.from(versions),
          totalSize: 0 // 需要进一步计算
        })
      }
    }

    return duplicates
  }

  /**
   * 生成优化建议
   */
  generateOptimizationSuggestions(analysis: SizeAnalysis, duplicates: Duplicate[]): OptimizationSuggestion[] {
    this.logger.info('生成优化建议...')

    const suggestions: OptimizationSuggestion[] = []

    // 体积优化建议
    if (analysis.total > 1024 * 1024) { // > 1MB
      suggestions.push({
        type: 'size',
        severity: 'high',
        title: '打包体积较大',
        description: `当前总大小 ${(analysis.total / 1024 / 1024).toFixed(2)} MB`,
        impact: '影响加载速度和用户体验',
        solution: '考虑使用代码分割、Tree Shaking 或移除未使用的依赖'
      })
    }

    // 重复依赖建议
    if (duplicates.length > 0) {
      suggestions.push({
        type: 'structure',
        severity: 'medium',
        title: '检测到重复依赖',
        description: `发现 ${duplicates.length} 个重复的依赖模块`,
        impact: '增加打包体积，可能导致运行时冲突',
        solution: '统一依赖版本，使用 peerDependencies 或 external 配置'
      })
    }

    // 大文件建议
    const largeFiles = analysis.largest.filter(f => f.size > 100 * 1024) // > 100KB
    if (largeFiles.length > 0) {
      suggestions.push({
        type: 'size',
        severity: 'medium',
        title: '存在大文件',
        description: `${largeFiles.length} 个文件超过 100KB`,
        impact: '影响首屏加载时间',
        solution: '考虑懒加载、代码分割或压缩优化'
      })
    }

    // 类型文件占比建议
    const dtsSize = analysis.byType['d.ts'] || 0
    const totalCodeSize = analysis.total - dtsSize
    if (dtsSize / analysis.total > 0.3) {
      suggestions.push({
        type: 'structure',
        severity: 'low',
        title: '类型声明文件占比较高',
        description: `类型声明占总大小的 ${((dtsSize / analysis.total) * 100).toFixed(1)}%`,
        impact: '不影响运行时，但影响发布包大小',
        solution: '考虑将类型声明发布为单独的 @types 包'
      })
    }

    return suggestions
  }

  /**
   * 生成完整分析报告
   */
  async generateReport(outputs: any[]): Promise<{
    dependencyTree: DependencyTreeNode
    sizeAnalysis: SizeAnalysis
    duplicates: Duplicate[]
    suggestions: OptimizationSuggestion[]
  }> {
    this.logger.info('生成完整分析报告...')

    const dependencyTree = this.analyzeDependencyTree(outputs)
    const sizeAnalysis = this.analyzeBundleSize(outputs)
    const duplicates = this.detectDuplicates(outputs)
    const suggestions = this.generateOptimizationSuggestions(sizeAnalysis, duplicates)

    return {
      dependencyTree,
      sizeAnalysis,
      duplicates,
      suggestions
    }
  }
}

/**
 * 创建打包分析器
 */
export function createBundleAnalyzer(logger?: Logger): BundleAnalyzer {
  return new BundleAnalyzer(logger)
}

