/**
 * 构建编排器
 * 
 * 负责协调整个构建流程,包括:
 * - 构建流程编排
 * - 策略应用
 * - 打包器调用
 * - 构建后验证
 * - 错误处理
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import type { BuilderConfig } from '../types/config'
import type { BuildResult, BuildWatcher } from '../types/builder'
import type { BundlerType } from '../types/bundler'
import type { ValidationResult as PostBuildValidationResult } from '../types/validation'
import { BuildContext } from './BuildContext'
import { ConfigResolver } from './ConfigResolver'
import { StrategyManager } from './StrategyManager'
import { PerformanceMonitor } from './PerformanceMonitor'
import { PostBuildValidator } from './PostBuildValidator'
import { IncrementalBuilder } from './IncrementalBuilder'
import { BuildOptimizer } from './BuildOptimizer'
import { BundlerAdapterFactory } from '../adapters/base/AdapterFactory'
import type { IBundlerAdapter } from '../types/adapter'
import { Logger } from '../utils/logger'
import { ErrorHandler } from '../utils/error-handler'
import { ErrorCode } from '../constants/errors'
import { PackageUpdater } from '../utils/misc/PackageUpdater'
import { getOutputDirs } from '../utils/file-system/glob'
import fs from 'fs-extra'

/**
 * 构建编排器选项
 */
export interface BuildOrchestratorOptions {
  /** 日志记录器 */
  logger?: Logger

  /** 错误处理器 */
  errorHandler?: ErrorHandler

  /** 默认打包器 */
  defaultBundler?: BundlerType

  /** 配置解析器 */
  configResolver?: ConfigResolver

  /** 策略管理器 */
  strategyManager?: StrategyManager

  /** 性能监控器 */
  performanceMonitor?: PerformanceMonitor

  /** 构建后验证器 */
  postBuildValidator?: PostBuildValidator

  /** 增量构建器 */
  incrementalBuilder?: IncrementalBuilder

  /** 构建优化器 */
  buildOptimizer?: BuildOptimizer
}

/**
 * 构建编排器
 */
export class BuildOrchestrator {
  private logger: Logger
  private errorHandler: ErrorHandler
  private configResolver: ConfigResolver
  private strategyManager: StrategyManager
  private performanceMonitor: PerformanceMonitor
  private postBuildValidator: PostBuildValidator
  private incrementalBuilder: IncrementalBuilder
  private buildOptimizer: BuildOptimizer
  private bundlerAdapter: IBundlerAdapter
  private currentContext?: BuildContext

  constructor(options: BuildOrchestratorOptions = {}) {
    this.logger = options.logger || new Logger()
    this.errorHandler = options.errorHandler || new ErrorHandler()
    this.configResolver = options.configResolver || new ConfigResolver({ logger: this.logger })
    this.strategyManager = options.strategyManager || new StrategyManager()
    this.performanceMonitor = options.performanceMonitor || new PerformanceMonitor()
    this.postBuildValidator = options.postBuildValidator || new PostBuildValidator()
    this.incrementalBuilder = options.incrementalBuilder || new IncrementalBuilder({ logger: this.logger })
    this.buildOptimizer = options.buildOptimizer || new BuildOptimizer({ logger: this.logger })

    // 初始化打包器适配器
    const defaultBundler = options.defaultBundler || 'rollup'
    this.bundlerAdapter = BundlerAdapterFactory.create(defaultBundler, {
      logger: this.logger,
      performanceMonitor: this.performanceMonitor
    })
  }

  /**
   * 执行构建
   */
  async build(config: BuilderConfig): Promise<BuildResult> {
    // 创建构建上下文
    const context = new BuildContext(config, this.bundlerAdapter.name, this.logger)
    this.currentContext = context
    const startTime = Date.now()

    try {
      // 开始构建
      context.startBuild()

      // 1. 解析配置
      let resolvedConfig = await this.resolveConfig(config)
      
      // 打印美化的构建开始信息
      this.printBuildStart(resolvedConfig)

      // 2. 应用构建优化 (可选)
      // if (resolvedConfig.performance?.optimization !== false) {
      //   this.logger.debug('应用构建优化...')
      //   resolvedConfig = this.buildOptimizer.optimizeConfig(resolvedConfig)
      // }

      // 3. 切换打包器 (如果需要)
      if (resolvedConfig.bundler && resolvedConfig.bundler !== this.bundlerAdapter.name) {
        this.switchBundler(resolvedConfig.bundler)
      }

      // 4. 清理输出目录 (如果启用)
      if (resolvedConfig.clean) {
        await this.cleanOutputDirs(resolvedConfig)
      }

      // 5. 设置库类型
      if (resolvedConfig.libraryType) {
        context.setLibraryType(resolvedConfig.libraryType)
      }

      // 6. 应用构建策略
      const strategyConfig = await this.applyStrategy(resolvedConfig)

      // 7. 执行打包
      const buildResult = await this.executeBuild(strategyConfig, context)

      // 8. 执行构建后验证 (如果启用)
      if (resolvedConfig.postBuildValidation?.enabled) {
        const validationResult = await this.runPostBuildValidation(
          resolvedConfig,
          buildResult,
          context.getBuildId()
        )
        buildResult.validation = validationResult
      }

      // 9. 更新 package.json (如果启用)
      await this.updatePackageJsonIfEnabled(resolvedConfig)

      // 打印美化的构建成功信息
      this.printBuildSuccess(buildResult, startTime)

      // 结束构建
      context.endBuild(true)

      return buildResult

    } catch (error) {
      // 处理构建错误
      context.addError(error as Error)
      context.endBuild(false)

      throw this.handleBuildError(error as Error, context.getBuildId())
    }
  }

  /**
   * 启动监听模式
   */
  async watch(config: BuilderConfig): Promise<BuildWatcher> {
    try {
      // 1. 解析配置
      const resolvedConfig = await this.resolveConfig(config)

      // 2. 切换打包器 (如果需要)
      if (resolvedConfig.bundler && resolvedConfig.bundler !== this.bundlerAdapter.name) {
        this.switchBundler(resolvedConfig.bundler)
      }

      // 3. 应用构建策略
      const strategyConfig = await this.applyStrategy(resolvedConfig)

      // 4. 启动监听
      const watcher = await this.bundlerAdapter.watch(strategyConfig)

      this.logger.info('监听模式已启动')
      return watcher

    } catch (error) {
      throw this.errorHandler.createError(
        ErrorCode.BUILD_FAILED,
        '启动监听模式失败',
        { cause: error as Error }
      )
    }
  }

  /**
   * 解析配置
   */
  private async resolveConfig(config: BuilderConfig): Promise<BuilderConfig> {
    return await this.configResolver.resolveConfig(config)
  }

  /**
   * 应用构建策略
   */
  private async applyStrategy(config: BuilderConfig): Promise<any> {
    if (!config.libraryType) {
      throw this.errorHandler.createError(
        ErrorCode.CONFIG_VALIDATION_ERROR,
        '无法确定库类型,请在配置中指定 libraryType'
      )
    }

    const strategy = this.strategyManager.getStrategy(config.libraryType)
    return await strategy.applyStrategy(config)
  }

  /**
   * 执行构建
   */
  private async executeBuild(
    strategyConfig: any,
    context: BuildContext
  ): Promise<BuildResult> {
    // 开始性能监控
    this.performanceMonitor.startBuild(context.getBuildId())

    // 执行打包
    const result = await this.bundlerAdapter.build(strategyConfig)

    // 结束性能监控
    const metrics = this.performanceMonitor.endBuild(context.getBuildId())

    // 保存性能指标和统计信息
    context.setMetrics(metrics)
    context.setStats(result.stats)

    // 添加警告
    if (result.warnings) {
      result.warnings.forEach(warning => {
        const warningMsg = typeof warning === 'string' ? warning : warning.message || String(warning)
        context.addWarning(warningMsg)
      })
    }

    // 创建构建结果
    const outputPaths = result.outputs.map(o => typeof o === 'string' ? o : o.fileName)
    return context.createBuildResult(outputPaths)
  }

  /**
   * 清理输出目录
   */
  private async cleanOutputDirs(config: BuilderConfig): Promise<void> {
    try {
      const dirs = getOutputDirs(config)
      this.logger.info(`清理输出目录: ${dirs.join(', ')}`)

      for (const dir of dirs) {
        if (await fs.pathExists(dir)) {
          await fs.remove(dir)
          this.logger.debug(`已删除: ${dir}`)
        }
      }
    } catch (error) {
      this.logger.warn(`清理输出目录失败: ${error}`)
    }
  }

  /**
   * 执行构建后验证
   */
  private async runPostBuildValidation(
    config: BuilderConfig,
    result: BuildResult,
    buildId: string
  ): Promise<PostBuildValidationResult> {
    this.logger.info('执行构建后验证...')

    const cwd = (config as any).cwd || process.cwd()
    const cacheDir = (config as any).cacheDir || 'node_modules/.cache/@ldesign/builder'
    const tempDir = '.validation-temp'

    // 创建验证上下文，使用类型断言以兼容 ValidationContext 类型
    const validationContext = {
      buildContext: {
        buildId,
        startTime: Date.now(),
        config,
        cwd,
        cacheDir,
        tempDir,
        watch: false,
        env: process.env as Record<string, string>,
        logger: this.logger,
        performanceMonitor: null
      },
      buildResult: result,
      config: config.postBuildValidation || {},
      tempDir,
      startTime: Date.now(),
      validationId: buildId,
      projectRoot: cwd,
      outputDir: config.output?.dir || 'dist'
    } as any

    const validationResult = await this.postBuildValidator.validate(validationContext)

    if (!validationResult.success) {
      this.logger.warn('构建后验证发现问题:')
      if (validationResult.errors) {
        validationResult.errors.forEach(error => this.logger.error(`  - ${error}`))
      }
      if (validationResult.warnings) {
        validationResult.warnings.forEach(warning => this.logger.warn(`  - ${warning}`))
      }
    }

    return validationResult
  }

  /**
   * 更新 package.json (如果启用)
   */
  private async updatePackageJsonIfEnabled(config: BuilderConfig): Promise<void> {
    if (config.packageUpdate?.enabled) {
      try {
        const projectRoot = (config as any).cwd || (config as any).root || process.cwd()
        const updater = new PackageUpdater({
          projectRoot,
          ...config.packageUpdate,
          logger: this.logger
        })
        await updater.update()
        this.logger.info('package.json 已更新')
      } catch (error) {
        this.logger.warn(`更新 package.json 失败: ${error}`)
      }
    }
  }

  /**
   * 切换打包器
   */
  switchBundler(bundler: BundlerType): void {
    try {
      this.bundlerAdapter = BundlerAdapterFactory.create(bundler, {
        logger: this.logger,
        performanceMonitor: this.performanceMonitor
      })
      this.logger.info(`已切换到 ${bundler} 打包器`)
    } catch (error) {
      throw this.errorHandler.createError(
        ErrorCode.ADAPTER_NOT_AVAILABLE,
        `切换到 ${bundler} 失败`,
        { cause: error as Error }
      )
    }
  }

  /**
   * 处理构建错误
   */
  private handleBuildError(error: Error, buildId: string): Error {
    this.logger.error(`构建失败 [${buildId}]:`, error)

    return this.errorHandler.createError(
      ErrorCode.BUILD_FAILED,
      `构建失败 [${buildId}]`,
      { cause: error, details: { buildId } }
    )
  }

  /**
   * 获取当前上下文
   */
  getCurrentContext(): BuildContext | undefined {
    return this.currentContext
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.logger.debug('开始清理 BuildOrchestrator 资源...')
    
    // 清理构建上下文
    if (this.currentContext) {
      try {
        this.currentContext.cleanup()
        this.logger.debug('✓ 构建上下文已清理')
      } catch (error) {
        this.logger.warn('清理构建上下文失败:', error)
      }
    }
    
    // 清理配置解析器
    try {
      this.configResolver.cleanup()
      this.logger.debug('✓ 配置解析器已清理')
    } catch (error) {
      this.logger.warn('清理配置解析器失败:', error)
    }
    
    // 清理打包器适配器（如果有cleanup方法）
    if (this.bundlerAdapter && typeof (this.bundlerAdapter as any).cleanup === 'function') {
      try {
        (this.bundlerAdapter as any).cleanup()
        this.logger.debug('✓ 打包器适配器已清理')
      } catch (error) {
        this.logger.warn('清理打包器适配器失败:', error)
      }
    }
    
    // 清理性能监控器（如果有cleanup方法）
    if (this.performanceMonitor && typeof (this.performanceMonitor as any).cleanup === 'function') {
      try {
        (this.performanceMonitor as any).cleanup()
        this.logger.debug('✓ 性能监控器已清理')
      } catch (error) {
        this.logger.warn('清理性能监控器失败:', error)
      }
    }
    
    // 清理增量构建器（如果有cleanup方法）
    if (this.incrementalBuilder && typeof (this.incrementalBuilder as any).cleanup === 'function') {
      try {
        (this.incrementalBuilder as any).cleanup()
        this.logger.debug('✓ 增量构建器已清理')
      } catch (error) {
        this.logger.warn('清理增量构建器失败:', error)
      }
    }
    
    // 清理构建优化器（如果有cleanup方法）
    if (this.buildOptimizer && typeof (this.buildOptimizer as any).cleanup === 'function') {
      try {
        (this.buildOptimizer as any).cleanup()
        this.logger.debug('✓ 构建优化器已清理')
      } catch (error) {
        this.logger.warn('清理构建优化器失败:', error)
      }
    }
    
    // 清理构建后验证器（如果有cleanup方法）
    if (this.postBuildValidator && typeof (this.postBuildValidator as any).cleanup === 'function') {
      try {
        (this.postBuildValidator as any).cleanup()
        this.logger.debug('✓ 构建后验证器已清理')
      } catch (error) {
        this.logger.warn('清理构建后验证器失败:', error)
      }
    }
    
    this.logger.debug('BuildOrchestrator 资源清理完成')
  }

  /**
   * 打印美化的构建开始信息
   */
  private printBuildStart(config: BuilderConfig): void {
    const bundler = config.bundler || 'rollup'
    const mode = config.mode || 'production'
    const libraryType = config.libraryType || 'unknown'
    
    const modeColor = mode === 'production' ? '\x1b[33m' : '\x1b[36m'
    const reset = '\x1b[0m'
    const blue = '\x1b[34m'
    const cyan = '\x1b[36m'
    const dim = '\x1b[2m'
    const bold = '\x1b[1m'
    
    console.log('')
    console.log(`${cyan}${'─'.repeat(50)}${reset}`)
    console.log(`${blue}${bold}🚀 @ldesign/builder${reset}`)
    console.log(`${cyan}${'─'.repeat(50)}${reset}`)
    console.log(`  ${dim}打包器:${reset} ${cyan}${bundler}${reset}`)
    console.log(`  ${dim}模式:${reset}   ${modeColor}${mode}${reset}`)
    console.log(`  ${dim}类型:${reset}   ${cyan}${libraryType}${reset}`)
    console.log(`${cyan}${'─'.repeat(50)}${reset}`)
    console.log('')
  }

  /**
   * 打印美化的构建成功信息
   */
  private printBuildSuccess(result: BuildResult, startTime: number): void {
    const duration = Date.now() - startTime
    const green = '\x1b[32m'
    const yellow = '\x1b[33m'
    const cyan = '\x1b[36m'
    const dim = '\x1b[2m'
    const reset = '\x1b[0m'
    const bold = '\x1b[1m'
    
    // 计算文件数量和总大小
    const fileCount = result.outputs?.length || 0
    const totalSize = result.stats?.totalSize
    const formatSize = (bytes: number): string => {
      if (bytes < 1024) return `${bytes} B`
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
    }
    
    const formatDuration = (ms: number): string => {
      if (ms < 1000) return `${ms}ms`
      return `${(ms / 1000).toFixed(2)}s`
    }
    
    // 辅助函数：填充空格到指定长度
    const pad = (text: string, length: number): string => {
      const spaces = length - text.length
      return spaces > 0 ? ' '.repeat(spaces) : ''
    }
    
    // 获取总大小的数值
    const totalSizeBytes = typeof totalSize === 'number' ? totalSize : (totalSize as any)?.raw || 0
    
    const durationText = formatDuration(duration)
    const bundlerText = result.bundler
    const fileCountText = fileCount + ' 个'
    const totalSizeText = totalSizeBytes > 0 ? formatSize(totalSizeBytes) : ''
    const warningText = result.warnings ? result.warnings.length + ' 个' : ''
    
    console.log('')
    console.log(`${green}╭${'─'.repeat(48)}╮${reset}`)
    console.log(`${green}│${reset} ${green}${bold}✓ 构建成功${reset}${' '.repeat(37)}${green}│${reset}`)
    console.log(`${green}├${'─'.repeat(48)}┤${reset}`)
    console.log(`${green}│${reset}  ${dim}⏱  耗时:${reset}    ${yellow}${durationText}${reset}${pad(durationText, 28)} ${green}│${reset}`)
    console.log(`${green}│${reset}  ${dim}📦 打包器:${reset}  ${cyan}${bundlerText}${reset}${pad(bundlerText, 28)} ${green}│${reset}`)
    console.log(`${green}│${reset}  ${dim}📄 文件数:${reset}  ${cyan}${fileCountText}${reset}${pad(fileCountText, 28)} ${green}│${reset}`)
    if (totalSizeBytes > 0) {
      console.log(`${green}│${reset}  ${dim}💾 总大小:${reset}  ${cyan}${totalSizeText}${reset}${pad(totalSizeText, 28)} ${green}│${reset}`)
    }
    if (result.warnings && result.warnings.length > 0) {
      console.log(`${green}│${reset}  ${dim}⚠  警告:${reset}    ${yellow}${warningText}${reset}${pad(warningText, 28)} ${green}│${reset}`)
    }
    console.log(`${green}╰${'─'.repeat(48)}╯${reset}`)
    console.log('')
  }
}

