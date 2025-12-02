/**
 * 构建优化器
 *
 * 提供构建性能优化功能,包括:
 * - 并行构建
 * - 代码分割优化
 * - Tree-shaking 优化
 * - 压缩优化
 *
 * @author LDesign Team
 * @version 1.0.0
 */

import { cpus } from 'os'
import type { BuilderConfig } from '../types/config'
import { Logger } from '../utils/logger'

/**
 * 优化建议
 */
export interface OptimizationSuggestion {
  /** 建议类型 */
  type: 'performance' | 'size' | 'quality'
  /** 优先级 */
  priority: 'high' | 'medium' | 'low'
  /** 标题 */
  title: string
  /** 描述 */
  description: string
  /** 预期收益 */
  impact: string
  /** 实施方法 */
  action: string
}

/**
 * 优化配置
 */
export interface OptimizationConfig {
  /** 是否启用并行构建 */
  parallel?: boolean
  /** 并行任务数 */
  parallelTasks?: number
  /** 是否启用代码分割 */
  codeSplitting?: boolean
  /** 是否启用 Tree-shaking */
  treeShaking?: boolean
  /** 是否启用压缩 */
  minify?: boolean
  /** 压缩选项 */
  minifyOptions?: {
    /** 是否压缩 JavaScript */
    js?: boolean
    /** 是否压缩 CSS */
    css?: boolean
    /** 是否压缩 HTML */
    html?: boolean
  }
}

/**
 * 构建优化器选项
 */
export interface BuildOptimizerOptions {
  /** 日志记录器 */
  logger?: Logger
  /** 优化配置 */
  optimization?: OptimizationConfig
}

/**
 * 构建优化器
 */
export class BuildOptimizer {
  private logger: Logger
  private config: OptimizationConfig

  constructor(options: BuildOptimizerOptions = {}) {
    this.logger = options.logger || new Logger()
    this.config = {
      parallel: true,
      parallelTasks: cpus().length,
      codeSplitting: true,
      treeShaking: true,
      minify: true,
      minifyOptions: {
        js: true,
        css: true,
        html: false
      },
      ...options.optimization
    }
  }

  /**
   * 优化构建配置
   */
  optimizeConfig(config: BuilderConfig): BuilderConfig {
    const optimized = { ...config }

    // 启用 Tree-shaking
    if (this.config.treeShaking && config.performance?.treeshaking !== false) {
      optimized.performance = {
        ...optimized.performance,
        treeshaking: true
      }
      this.logger.debug('已启用 Tree-shaking 优化')
    }

    // 启用压缩
    if (this.config.minify && config.mode === 'production') {
      optimized.minify = true
      optimized.performance = {
        ...optimized.performance,
        minify: true
      }
      this.logger.debug('已启用代码压缩')
    }

    // 优化 sourcemap
    if (config.mode === 'production' && config.sourcemap === true) {
      optimized.sourcemap = 'hidden'
      this.logger.debug('生产模式使用 hidden sourcemap')
    }

    return optimized
  }

  /**
   * 分析构建配置并生成优化建议
   */
  analyzeBuildConfig(config: BuilderConfig): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = []

    // 检查是否启用 Tree-shaking
    if (config.performance?.treeshaking === false) {
      suggestions.push({
        type: 'size',
        priority: 'high',
        title: '启用 Tree-shaking',
        description: 'Tree-shaking 可以移除未使用的代码,显著减小包体积',
        impact: '包体积可减少 20-40%',
        action: '在配置中设置 performance.treeshaking = true'
      })
    }

    // 检查是否启用压缩
    if (config.mode === 'production' && !config.minify) {
      suggestions.push({
        type: 'size',
        priority: 'high',
        title: '启用代码压缩',
        description: '生产模式应该启用代码压缩以减小包体积',
        impact: '包体积可减少 30-50%',
        action: '在配置中设置 minify = true'
      })
    }

    // 检查 sourcemap 配置
    if (config.mode === 'production' && config.sourcemap === true) {
      suggestions.push({
        type: 'performance',
        priority: 'medium',
        title: '优化 sourcemap 配置',
        description: '生产模式建议使用 hidden sourcemap 以提高加载性能',
        impact: '构建速度提升 10-20%',
        action: '在配置中设置 sourcemap = "hidden"'
      })
    }

    // 检查外部依赖配置
    if (!config.external || (Array.isArray(config.external) && config.external.length === 0)) {
      suggestions.push({
        type: 'size',
        priority: 'medium',
        title: '配置外部依赖',
        description: '将框架库(如 React, Vue)设置为外部依赖可以减小包体积',
        impact: '包体积可减少 50-70%',
        action: '在配置中设置 external 数组,包含框架依赖'
      })
    }

    // 检查输出格式
    const formats = config.output?.format || []
    if (formats.length > 3) {
      suggestions.push({
        type: 'performance',
        priority: 'low',
        title: '减少输出格式',
        description: '输出过多格式会增加构建时间',
        impact: '构建时间可减少 20-30%',
        action: '只输出必要的格式 (通常 ESM + CJS 即可)'
      })
    }

    // 检查是否启用缓存
    if (!config.cache?.enabled) {
      suggestions.push({
        type: 'performance',
        priority: 'high',
        title: '启用构建缓存',
        description: '启用缓存可以显著提升重复构建速度',
        impact: '重复构建速度提升 50-80%',
        action: '在配置中设置 cache.enabled = true'
      })
    }

    return suggestions
  }

  /**
   * 估算构建时间
   *
   * @param config - 构建配置
   * @returns 估算结果，包含总时间和各因素影响
   */
  estimateBuildTime(config: BuilderConfig): {
    total: number
    breakdown: Record<string, number>
  } {
    let baseTime = 1000 // 基础时间 1 秒
    const breakdown: Record<string, number> = {}

    // 输出格式影响
    const formats = config.output?.format || ['esm']
    const formatImpact = formats.length * 500
    baseTime += formatImpact
    breakdown['输出格式'] = formatImpact

    // TypeScript 影响
    if (config.typescript?.declaration) {
      const tsImpact = 2000
      baseTime += tsImpact
      breakdown['TypeScript 类型声明'] = tsImpact
    }

    // 压缩影响
    if (config.minify) {
      const minifyImpact = 1500
      baseTime += minifyImpact
      breakdown['代码压缩'] = minifyImpact
    }

    // Sourcemap 影响
    if (config.sourcemap) {
      const sourcemapImpact = 800
      baseTime += sourcemapImpact
      breakdown['Sourcemap'] = sourcemapImpact
    }

    // 缓存优化
    if (config.cache?.enabled) {
      const cacheBonus = -baseTime * 0.5
      baseTime += cacheBonus
      breakdown['构建缓存'] = cacheBonus
    }

    return {
      total: Math.max(baseTime, 500),
      breakdown
    }
  }

  /**
   * 生成优化报告
   */
  generateOptimizationReport(config: BuilderConfig): {
    suggestions: OptimizationSuggestion[]
    estimatedTime: { total: number; breakdown: Record<string, number> }
    score: number
  } {
    const suggestions = this.analyzeBuildConfig(config)
    const estimatedTime = this.estimateBuildTime(config)

    // 计算优化分数 (0-100)
    let score = 100
    for (const suggestion of suggestions) {
      if (suggestion.priority === 'high') score -= 15
      else if (suggestion.priority === 'medium') score -= 10
      else score -= 5
    }
    score = Math.max(0, score)

    return {
      suggestions,
      estimatedTime,
      score
    }
  }
}

