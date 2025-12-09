/**
 * 库构建器主控制器类
 * 
 * 这是 @ldesign/builder 的核心类，负责协调各个组件完成库的构建工作
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import { EventEmitter } from 'events'
import {
  ILibraryBuilder,
  BuilderOptions,
  BuilderStatus,
  BuildResult,
  BuildWatcher
} from '../types/builder'
import type { BuilderConfig } from '../types/config'
import type { ValidationResult } from '../types/common'
import type { LibraryType } from '../types/library'
import type { BundlerType } from '../types/bundler'
import type {
  ValidationResult as PostBuildValidationResult,
  ValidationContext
} from '../types/validation'
import type { BuildStats } from '../types/output'
import type { PerformanceMetrics } from '../types/performance'
import { ConfigManager } from './ConfigManager'
import { StrategyManager } from './StrategyManager'
import { PluginManager } from './PluginManager'
import { LibraryDetector } from './LibraryDetector'
import { PerformanceMonitor } from './PerformanceMonitor'
import { PostBuildValidator } from './PostBuildValidator'
import { BundlerAdapterFactory } from '../adapters/base/AdapterFactory'
import type { IBundlerAdapter } from '../types/adapter'
import { Logger, createLogger } from '../utils/logger'
import { ErrorHandler, createErrorHandler } from '../utils/error-handler'
import { ErrorCode } from '../constants/errors'
import { DEFAULT_BUILDER_CONFIG } from '../constants/defaults'
import { getOutputDirs } from '../utils/file-system/glob'
import path from 'path'
import fs from 'fs-extra'
import { getGlobalMemoryManager } from '../utils/memory/MemoryManager'
import { PackageUpdater } from '../utils/misc/PackageUpdater'
import { StyleProcessor, getOutputDirsFromConfig } from './StyleProcessor'

/**
 * 带清理方法的适配器接口
 */
interface IBundlerAdapterWithCleanup extends IBundlerAdapter {
  cleanup?(): void | Promise<void>
}

/**
 * 库构建器主控制器类
 *
 * 采用依赖注入模式，统一管理各种服务组件
 * 继承 EventEmitter，支持事件驱动的构建流程
 */
export class LibraryBuilder extends EventEmitter implements ILibraryBuilder {
  /** 当前状态 */
  protected status: BuilderStatus = BuilderStatus.IDLE

  /** 当前配置 */
  protected config: BuilderConfig

  /** 打包核心适配器 */
  protected bundlerAdapter!: IBundlerAdapter

  /** 策略管理器 */
  protected strategyManager!: StrategyManager

  /** 配置管理器 */
  protected configManager!: ConfigManager

  /** 插件管理器 */
  protected pluginManager!: PluginManager

  /** 日志记录器 */
  protected logger!: Logger

  /** 错误处理器 */
  protected errorHandler!: ErrorHandler

  /** 性能监控器 */
  protected performanceMonitor!: PerformanceMonitor

  /** 库类型检测器 */
  protected libraryDetector!: LibraryDetector

  /** 打包后验证器 */
  protected postBuildValidator!: PostBuildValidator

  /** 当前构建统计 */
  protected currentStats: BuildStats | null = null

  /** 当前性能指标 */
  protected currentMetrics: PerformanceMetrics | null = null

  /** 内存管理器 */
  protected memoryManager = getGlobalMemoryManager()

  /** 文件监听器 */
  protected fileWatchers: Set<BuildWatcher> = new Set()

  /** 清理函数列表 */
  protected cleanupFunctions: Array<() => void | Promise<void>> = []

  constructor(options: BuilderOptions = {}) {
    super()

    // 初始化各种服务
    this.initializeServices(options)

    // 设置事件监听器
    this.setupEventListeners()

    // 设置错误处理
    this.setupErrorHandling()

    // 初始化配置
    this.config = { ...DEFAULT_BUILDER_CONFIG, ...options.config }

    // 注册清理函数
    this.registerCleanup()
  }

  /**
   * 执行库构建
   * 
   * @param config 可选的配置覆盖
   * @returns 构建结果
   */
  async build(config?: BuilderConfig): Promise<BuildResult> {
    const buildId = this.generateBuildId()
    const startTime = Date.now()

    try {
      // 设置构建状态
      this.setStatus(BuilderStatus.BUILDING)

      // 合并配置
      const mergedConfig = config ? this.mergeConfig(this.config, config) : this.config

      // 打印美化的构建开始信息
      this.printBuildStart(mergedConfig)

      // 清理输出目录（如果启用）
      if (mergedConfig.clean) {
        this.logger.debug('🧹 清理输出目录...')
        await this.cleanOutputDirs(mergedConfig)
      }

      // 根据配置切换打包核心（确保与 CLI/配置一致）
      if (mergedConfig.bundler && mergedConfig.bundler !== this.bundlerAdapter.name) {
        this.logger.debug(`🔄 切换打包器: ${mergedConfig.bundler}`)
        this.setBundler(mergedConfig.bundler)
      }

      // 发出构建开始事件
      this.emit('build:start', {
        config: mergedConfig,
        timestamp: Date.now(),
        buildId
      })

      // 开始性能监控
      this.performanceMonitor.startBuild(buildId)

      // 获取库类型（优先使用配置中指定的类型；否则基于项目根目录自动检测）
      const projectRoot = mergedConfig.cwd || process.cwd()
      this.logger.debug('🔍 检测库类型...')
      let libraryType = mergedConfig.libraryType || await this.detectLibraryType(projectRoot)

      // 确保 libraryType 是正确的枚举值
      if (typeof libraryType === 'string') {
        libraryType = libraryType as LibraryType
      }
      this.logger.debug(`📦 库类型: ${libraryType}`)

      // 获取构建策略
      this.logger.debug('⚙️  应用构建策略...')
      const strategy = this.strategyManager.getStrategy(libraryType)

      // 应用策略配置
      const strategyConfig = await strategy.applyStrategy(mergedConfig)

      // 执行构建
      this.logger.debug('🔨 执行打包...')
      const result = await this.bundlerAdapter.build(strategyConfig)

      // 处理组件库样式 (TDesign 风格)
      await this.processComponentStyles(mergedConfig, projectRoot)

      // 执行打包后验证（如果启用）
      let validationResult: PostBuildValidationResult | undefined
      if (mergedConfig.postBuildValidation?.enabled) {
        validationResult = await this.runPostBuildValidation(mergedConfig, result, buildId)
      }

      // 结束性能监控
      const metrics = this.performanceMonitor.endBuild(buildId)

      // 构建成功
      const buildResult: BuildResult = {
        success: true,
        outputs: result.outputs,
        duration: metrics.buildTime,
        stats: result.stats,
        performance: metrics,
        warnings: result.warnings || [],
        errors: [],
        buildId,
        timestamp: Date.now(),
        bundler: this.bundlerAdapter.name,
        mode: mergedConfig.mode || 'production',
        libraryType,
        validation: validationResult
      }

      // 保存统计信息
      this.currentStats = buildResult.stats
      this.currentMetrics = buildResult.performance

      // 自动更新 package.json（如果启用）
      await this.updatePackageJsonIfEnabled(mergedConfig, projectRoot)

      // 打印美化的构建完成信息
      this.printBuildSuccess(buildResult, startTime)

      // 发出构建结束事件
      this.emit('build:end', {
        result: buildResult,
        duration: buildResult.duration,
        timestamp: Date.now()
      })

      // 重置状态
      this.setStatus(BuilderStatus.IDLE)

      return buildResult

    } catch (error) {
      // 处理构建错误
      const buildError = this.handleBuildError(error as Error, buildId)

      // 发出错误事件
      this.emit('build:error', {
        error: buildError,
        phase: 'build',
        timestamp: Date.now()
      })

      // 重置状态
      this.setStatus(BuilderStatus.ERROR)

      throw buildError
    }
  }

  /**
   * 启动监听构建模式
   * 
   * @param config 可选的配置覆盖
   * @returns 构建监听器
   */
  async buildWatch(config?: BuilderConfig): Promise<BuildWatcher> {
    try {
      // 设置监听状态
      this.setStatus(BuilderStatus.WATCHING)

      // 合并配置
      const mergedConfig = config ? this.mergeConfig(this.config, config) : this.config

      // 根据配置切换打包核心（确保与 CLI/配置一致）
      if (mergedConfig.bundler && mergedConfig.bundler !== this.bundlerAdapter.name) {
        this.setBundler(mergedConfig.bundler)
      }

      // 获取库类型（优先使用配置中指定的类型；否则基于项目根目录自动检测）
      const projectRoot = mergedConfig.cwd || process.cwd()
      let libraryType = mergedConfig.libraryType || await this.detectLibraryType(projectRoot)

      // 确保 libraryType 是正确的枚举值
      if (typeof libraryType === 'string') {
        libraryType = libraryType as LibraryType
      }

      // 获取构建策略
      const strategy = this.strategyManager.getStrategy(libraryType)

      // 应用策略配置
      const strategyConfig = await strategy.applyStrategy(mergedConfig)

      // 启动监听
      const watcher = await this.bundlerAdapter.watch(strategyConfig)

      // 发出监听开始事件
      this.emit('watch:start', {
        patterns: watcher.patterns,
        timestamp: Date.now()
      })

      return watcher

    } catch (error) {
      this.setStatus(BuilderStatus.ERROR)
      throw this.errorHandler.createError(
        ErrorCode.BUILD_FAILED,
        '启动监听模式失败',
        { cause: error as Error }
      )
    }
  }

  /**
   * 合并配置
   */
  mergeConfig(base: BuilderConfig, override: BuilderConfig): BuilderConfig {
    return this.configManager.mergeConfigs(base, override)
  }

  /**
   * 验证配置
   */
  validateConfig(config: BuilderConfig): ValidationResult {
    return this.configManager.validateConfig(config)
  }

  /**
   * 加载配置文件
   */
  async loadConfig(configPath?: string): Promise<BuilderConfig> {
    const config = await this.configManager.loadConfig(configPath ? { configFile: configPath } : {})
    this.config = config
    return config
  }

  /**
   * 注册清理函数
   */
  private registerCleanup(): void {
    const resourceManager = this.memoryManager.getResourceManager()

    // 注册自身的清理函数
    resourceManager.register('LibraryBuilder', {
      cleanup: async () => await this.cleanup(),
      isCleanedUp: false
    })
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    try {
      // 清理文件监听器
      for (const watcher of this.fileWatchers) {
        if (watcher && typeof watcher.close === 'function') {
          await watcher.close()
        }
      }
      this.fileWatchers.clear()

      // 执行所有清理函数
      for (const cleanupFn of this.cleanupFunctions) {
        try {
          await cleanupFn()
        } catch (error) {
          this.logger.error('清理函数执行失败:', error)
        }
      }
      this.cleanupFunctions = []

      // 移除所有事件监听器
      this.removeAllListeners()

      // 清理适配器
      const adapter = this.bundlerAdapter as IBundlerAdapterWithCleanup
      if (adapter && typeof adapter.cleanup === 'function') {
        await adapter.cleanup()
      }

      // 重置状态
      this.status = BuilderStatus.IDLE
      this.currentStats = null
      this.currentMetrics = null
    } catch (error) {
      this.logger.error('资源清理失败:', error)
    }
  }

  /**
   * 切换打包核心
   */
  setBundler(bundler: BundlerType): void {
    try {
      // 清理旧的适配器
      const adapter = this.bundlerAdapter as IBundlerAdapterWithCleanup
      if (adapter && typeof adapter.cleanup === 'function') {
        adapter.cleanup()
      }

      this.bundlerAdapter = BundlerAdapterFactory.create(bundler, {
        logger: this.logger,
        performanceMonitor: this.performanceMonitor
      })

      this.logger.info(`已切换到 ${bundler} 打包核心`)
    } catch (error) {
      throw this.errorHandler.createError(
        ErrorCode.ADAPTER_NOT_AVAILABLE,
        `切换到 ${bundler} 失败`,
        { cause: error as Error }
      )
    }
  }

  /**
   * 获取当前打包核心
   */
  getBundler(): BundlerType {
    return this.bundlerAdapter.name
  }

  /**
   * 设置库类型
   */
  setLibraryType(type: LibraryType): void {
    if (this.config) {
      this.config.libraryType = type
    }
    this.logger.info(`已设置库类型为: ${type}`)
  }

  /**
   * 检测库类型
   * - 传入路径可能为文件路径或子目录，这里做归一化：
   *   1) 若为文件，取其所在目录
   *   2) 自下而上查找最近的 package.json 作为项目根
   *   3) 若未找到，回退到当前工作目录
   */
  async detectLibraryType(projectPath: string): Promise<LibraryType> {
    try {
      const projectRoot = await this.resolveProjectRoot(projectPath)
      console.log(`[LibraryBuilder] 正在检测库类型，根目录: ${projectRoot}`)
      const result = await this.libraryDetector.detect(projectRoot)
      console.log(`[LibraryBuilder] 检测结果: ${result.type}, 置信度: ${result.confidence}`)
      return result.type
    } catch (error) {
      console.warn('[LibraryBuilder] 库类型检测失败:', error)
      const fallbackRoot = this.getFallbackRoot()
      const result = await this.libraryDetector.detect(fallbackRoot)
      return result.type
    }
  }

  /**
   * 解析项目根目录
   * 从给定路径向上查找包含 package.json 的目录
   *
   * @param projectPath - 项目路径（可能是文件或目录）
   * @returns 项目根目录路径
   */
  private async resolveProjectRoot(projectPath: string): Promise<string> {
    // 如果是文件，取其所在目录
    const base = await this.normalizeToDirectory(projectPath)

    // 向上查找 package.json
    const resolvedRoot = await this.findPackageJsonDir(base)

    return resolvedRoot || this.getFallbackRoot()
  }

  /**
   * 将路径规范化为目录
   * 如果是文件路径，返回其所在目录；否则返回原路径
   *
   * @param projectPath - 项目路径
   * @returns 目录路径
   */
  private async normalizeToDirectory(projectPath: string): Promise<string> {
    const stat = await fs.stat(projectPath).catch(() => null)
    return (stat && stat.isFile()) ? path.dirname(projectPath) : projectPath
  }

  /**
   * 向上查找包含 package.json 的目录
   *
   * @param startDir - 起始目录
   * @returns package.json 所在目录，如果未找到则返回空字符串
   */
  private async findPackageJsonDir(startDir: string): Promise<string> {
    let current = startDir

    // 最多向上查找 10 层
    for (let i = 0; i < 10; i++) {
      const pkgPath = path.join(current, 'package.json')
      const exists = await fs.access(pkgPath).then(() => true).catch(() => false)

      if (exists) {
        return current
      }

      const parent = path.dirname(current)
      if (parent === current) {
        break // 已到达文件系统根目录
      }
      current = parent
    }

    return ''
  }

  /**
   * 获取回退根目录
   * 优先使用配置中的 cwd，否则使用当前工作目录
   *
   * @returns 回退根目录路径
   */
  private getFallbackRoot(): string {
    return this.config?.cwd || process.cwd()
  }

  /**
   * 获取当前状态
   */
  getStatus(): BuilderStatus {
    return this.status
  }

  /**
   * 是否正在构建
   */
  isBuilding(): boolean {
    return this.status === 'building'
  }

  /**
   * 是否正在监听
   */
  isWatching(): boolean {
    return this.status === 'watching'
  }

  /**
   * 初始化
   */
  async initialize(): Promise<void> {
    this.setStatus(BuilderStatus.INITIALIZING)

    try {
      // 加载配置
      await this.loadConfig()

      // 初始化适配器
      this.setBundler(this.config?.bundler || 'rollup')

      this.setStatus(BuilderStatus.IDLE)
      this.logger.debug('LibraryBuilder 初始化完成') // 改为 debug 级别
    } catch (error) {
      this.setStatus(BuilderStatus.ERROR)
      throw this.errorHandler.createError(
        ErrorCode.BUILD_FAILED,
        '初始化失败',
        { cause: error as Error }
      )
    }
  }

  /**
   * 销毁资源
   */
  async dispose(): Promise<void> {
    this.setStatus(BuilderStatus.DISPOSED)

    // 清理适配器
    if (this.bundlerAdapter) {
      await this.bundlerAdapter.dispose()
    }

    // 清理插件管理器
    if (this.pluginManager) {
      await this.pluginManager.dispose()
    }

    // 清理验证器
    if (this.postBuildValidator) {
      await this.postBuildValidator.dispose()
    }

    // 移除所有事件监听器
    this.removeAllListeners()

    this.logger.info('LibraryBuilder 已销毁')
  }

  /**
   * 获取构建统计信息
   */
  getStats(): BuildStats | null {
    return this.currentStats
  }

  /**
   * 获取性能指标
   */
  getPerformanceMetrics(): PerformanceMetrics | null {
    return this.currentMetrics
  }

  /**
   * 初始化各种服务
   */
  private initializeServices(options: BuilderOptions): void {
    // 初始化日志记录器
    this.logger = options.logger || createLogger({
      level: 'info',
      prefix: '@ldesign/builder'
    })

    // 初始化错误处理器
    this.errorHandler = createErrorHandler({
      logger: this.logger,
      showSuggestions: true
    })

    // 初始化性能监控器
    this.performanceMonitor = new PerformanceMonitor({
      logger: this.logger
    })

    // 初始化配置管理器
    this.configManager = new ConfigManager({
      logger: this.logger
    })

    // 初始化策略管理器
    this.strategyManager = new StrategyManager({
      autoDetection: true,
      cache: true,
      logger: this.logger
    })

    // 初始化插件管理器
    this.pluginManager = new PluginManager({
      cache: true,
      hotReload: false,
      logger: this.logger
    })

    // 初始化库类型检测器
    this.libraryDetector = new LibraryDetector({
      logger: this.logger
    })

    // 初始化打包后验证器
    this.postBuildValidator = new PostBuildValidator({}, {
      logger: this.logger,
      errorHandler: this.errorHandler
    })

    // 初始化默认适配器
    this.bundlerAdapter = BundlerAdapterFactory.create('rollup', {
      logger: this.logger,
      performanceMonitor: this.performanceMonitor
    })
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 监听配置变化
    this.configManager.on('config:change', (config: BuilderConfig) => {
      this.config = config
      this.emit('config:change', {
        config,
        oldConfig: this.config,
        timestamp: Date.now()
      })
    })
  }

  /**
   * 设置错误处理
   */
  private setupErrorHandling(): void {
    // 处理未捕获的错误
    this.on('error', (error) => {
      this.errorHandler.handle(error, 'LibraryBuilder')
    })
  }

  /**
   * 设置状态
   */
  protected setStatus(status: BuilderStatus): void {
    const oldStatus = this.status
    this.status = status

    this.emit('status:change', {
      status,
      oldStatus,
      timestamp: Date.now()
    })
  }

  /**
   * 生成构建 ID
   */
  protected generateBuildId(): string {
    return `build-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
  }

  /**
   * 清理输出目录
   * 
   * @param config - 构建配置
   */
  protected async cleanOutputDirs(config: BuilderConfig): Promise<void> {
    const dirs = getOutputDirs(config)
    const rootDir = config.cwd || process.cwd()

    for (const dir of dirs) {
      const fullPath = path.isAbsolute(dir) ? dir : path.resolve(rootDir, dir)

      try {
        // 检查目录是否存在
        const exists = await fs.access(fullPath).then(() => true).catch(() => false)

        if (exists) {
          this.logger.info(`清理输出目录: ${fullPath}`)
          await fs.rm(fullPath, { recursive: true, force: true })
        }
      } catch (error) {
        this.logger.warn(`清理目录失败: ${fullPath}`, error)
      }
    }
  }

  /**
   * 处理构建错误
   */
  protected handleBuildError(error: Error, buildId: string): Error {
    this.performanceMonitor.recordError(buildId, error)

    if (error instanceof Error) {
      return this.errorHandler.createError(
        ErrorCode.BUILD_FAILED,
        `构建失败: ${error.message}`,
        { cause: error }
      )
    }

    return this.errorHandler.createError(
      ErrorCode.BUILD_FAILED,
      '构建失败: 未知错误'
    )
  }

  /**
   * 运行打包后验证
   */
  protected async runPostBuildValidation(
    config: BuilderConfig,
    buildResult: any,
    buildId: string
  ): Promise<PostBuildValidationResult> {
    this.logger.info('开始打包后验证...')

    try {
      // 创建验证上下文
      const validationContext: ValidationContext = {
        buildContext: {
          buildId,
          startTime: Date.now(),
          config,
          cwd: process.cwd(),
          cacheDir: '.cache',
          tempDir: '.temp',
          watch: false,
          env: process.env as Record<string, string>,
          logger: this.logger,
          performanceMonitor: this.performanceMonitor
        },
        buildResult: {
          success: true,
          outputs: buildResult.outputs,
          duration: 0,
          stats: buildResult.stats,
          performance: this.currentMetrics || {
            buildTime: 0,
            memoryUsage: { heapUsed: 0, heapTotal: 0, external: 0, rss: 0, peak: 0, trend: [] },
            cacheStats: { hits: 0, misses: 0, hitRate: 0, size: 0, entries: 0, timeSaved: 0 },
            fileStats: { totalFiles: 0, filesByType: {}, averageProcessingTime: 0, slowestFiles: [], processingRate: 0 },
            pluginPerformance: [],
            systemResources: { cpuUsage: 0, availableMemory: 0, diskUsage: { total: 0, used: 0, available: 0, usagePercent: 0 } },
            bundleSize: 0
          },
          warnings: buildResult.warnings || [],
          errors: [],
          buildId,
          timestamp: Date.now(),
          bundler: this.bundlerAdapter.name,
          mode: config.mode || 'production',
          libraryType: config.libraryType
        },
        config: config.postBuildValidation || {},
        tempDir: '',
        startTime: Date.now(),
        validationId: `validation-${buildId}`,
        projectRoot: process.cwd(),
        outputDir: config.output?.dir || 'dist'
      }

      // 更新验证器配置
      if (config.postBuildValidation) {
        this.postBuildValidator.setConfig(config.postBuildValidation)
      }

      // 执行验证
      const validationResult = await this.postBuildValidator.validate(validationContext)

      // 如果验证失败且配置为失败时停止构建
      if (!validationResult.success && config.postBuildValidation?.failOnError) {
        throw this.errorHandler.createError(
          ErrorCode.BUILD_FAILED,
          '打包后验证失败',
          {
            cause: new Error(`验证失败: ${validationResult.errors.length} 个错误`)
          }
        )
      }

      this.logger.success('打包后验证完成')
      return validationResult

    } catch (error) {
      this.logger.error('打包后验证失败:', error)
      throw error
    }
  }

  /**
   * 自动更新 package.json（如果启用）
   */
  private async updatePackageJsonIfEnabled(config: BuilderConfig, projectRoot: string): Promise<void> {
    try {
      // 检查是否启用了 package.json 自动更新
      const packageUpdateConfig = config.packageUpdate
      if (!packageUpdateConfig || packageUpdateConfig.enabled === false) {
        return
      }

      // 静默更新

      // 获取输出目录配置
      const outputDirs = this.getOutputDirsFromConfig(config)

      // 创建 PackageUpdater 实例
      const packageUpdater = new PackageUpdater({
        projectRoot,
        srcDir: packageUpdateConfig.srcDir || 'src',
        outputDirs,
        autoExports: packageUpdateConfig.autoExports !== false,
        updateEntryPoints: packageUpdateConfig.updateEntryPoints !== false,
        updateFiles: packageUpdateConfig.updateFiles !== false,
        customExports: packageUpdateConfig.customExports || {},
        logger: this.logger
      })

      // 执行更新
      await packageUpdater.update()

    } catch (error) {
      this.logger.warn('package.json 自动更新失败:', error)
      // 不抛出错误，避免影响构建流程
    }
  }

  /**
   * 从配置中获取输出目录配置
   */
  private getOutputDirsFromConfig(config: BuilderConfig): Record<string, string> {
    const output = config.output || {}
    const outputDirs: Record<string, string> = {}

    // 处理不同的输出配置格式
    if (Array.isArray(output)) {
      // 数组格式：[{ format: 'esm', dir: 'es' }, { format: 'cjs', dir: 'lib' }]
      for (const item of output) {
        if (item.format === 'esm' || item.format === 'es') {
          outputDirs.esm = item.dir || 'es'
          outputDirs.types = item.dir || 'es' // 默认类型声明与 ESM 同目录
        } else if (item.format === 'cjs' || item.format === 'commonjs') {
          outputDirs.cjs = item.dir || 'lib'
        } else if (item.format === 'umd' || item.format === 'iife') {
          outputDirs.umd = item.dir || 'dist'
        }
      }
    } else if (typeof output === 'object') {
      // 对象格式：{ esm: { dir: 'es' }, cjs: { dir: 'lib' } }
      if (output.esm && typeof output.esm === 'object') {
        outputDirs.esm = output.esm.dir || 'es'
        outputDirs.types = output.esm.dir || 'es'
      }
      if (output.cjs && typeof output.cjs === 'object') {
        outputDirs.cjs = output.cjs.dir || 'lib'
      }
      if (output.umd && typeof output.umd === 'object') {
        outputDirs.umd = output.umd.dir || 'dist'
      }
      // 注意：不再使用通用的 output.dir，因为它会覆盖格式特定的目录配置
      // 多格式构建应该使用各自的专用目录，而不是单一目录
    }

    // 设置默认值 - 使用标准的多格式目录结构
    return {
      esm: outputDirs.esm || 'es',
      cjs: outputDirs.cjs || 'lib',
      umd: outputDirs.umd || 'dist',
      types: outputDirs.types || outputDirs.esm || 'es'
    }
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

  /**
   * 处理组件库样式 (TDesign 风格)
   * 
   * 在构建完成后，将样式文件复制/编译到各输出目录
   */
  private async processComponentStyles(config: BuilderConfig, projectRoot: string): Promise<void> {
    try {
      // 获取输出目录配置
      const outputDirConfigs = getOutputDirsFromConfig(config)

      if (outputDirConfigs.length === 0) {
        return
      }

      // 创建样式处理器 - 传入完整的 OutputDirConfig
      const styleProcessor = new StyleProcessor({
        srcDir: path.resolve(projectRoot, 'src'),
        outputDirs: outputDirConfigs.map(config => ({
          dir: path.resolve(projectRoot, config.dir),
          preserveLessSource: config.preserveLessSource
        })),
        compileLess: config.style?.preprocessor === 'less' || true,
        logger: this.logger
      })

      // 执行样式处理
      await styleProcessor.process()
    } catch (error) {
      // 样式处理失败不阻断构建，只记录警告
      this.logger.warn('样式处理失败:', (error as Error).message)
    }
  }
}
