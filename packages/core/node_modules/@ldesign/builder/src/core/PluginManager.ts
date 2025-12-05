/**
 * 插件管理器
 * 
 * 负责插件的加载、管理和执行
 * 支持完整的生命周期钩子管理
 * 
 * @author LDesign Team
 * @version 1.1.0
 */

import { EventEmitter } from 'events'
import type {
  UnifiedPlugin,
  PluginManagerOptions,
  PluginLoadResult,
  PluginPerformanceStats,
  PluginContext
} from '../types/plugin'
import type { BuilderConfig } from '../types/config'
import type { BuildResult } from '../types/builder'
import { Logger } from '../utils/logger'
import { BuilderError } from '../utils/error-handler'
import { ErrorCode } from '../constants/errors'

/**
 * 构建生命周期阶段
 */
export type BuildPhase = 'beforeBuild' | 'afterBuild' | 'onError' | 'onWarning' | 'beforeWatch' | 'afterWatch'

/**
 * 生命周期钩子函数类型
 */
export type LifecycleHook = (
  context: PluginContext,
  data?: any
) => void | Promise<void>

/**
 * 插件管理器类
 * 
 * 功能：
 * - 插件加载、卸载和管理
 * - 生命周期钩子管理
 * - 插件性能监控
 * - 插件依赖解析
 */
export class PluginManager extends EventEmitter {
  private logger: Logger
  private options: PluginManagerOptions
  private plugins: Map<string, UnifiedPlugin> = new Map()
  private performanceStats: Map<string, PluginPerformanceStats> = new Map()
  private lifecycleHooks: Map<BuildPhase, LifecycleHook[]> = new Map()

  constructor(options: PluginManagerOptions = {}) {
    super()

    this.options = {
      cache: true,
      hotReload: false,
      timeout: 30000,
      maxPlugins: 100,
      whitelist: [],
      blacklist: [],
      ...options
    }

    this.logger = (options as any).logger || new Logger()
    
    // 初始化生命周期钩子 Map
    this.initializeLifecycleHooks()
  }

  /**
   * 初始化生命周期钩子
   */
  private initializeLifecycleHooks(): void {
    const phases: BuildPhase[] = ['beforeBuild', 'afterBuild', 'onError', 'onWarning', 'beforeWatch', 'afterWatch']
    for (const phase of phases) {
      this.lifecycleHooks.set(phase, [])
    }
  }

  /**
   * 注册生命周期钩子
   */
  registerHook(phase: BuildPhase, hook: LifecycleHook): () => void {
    const hooks = this.lifecycleHooks.get(phase)
    if (!hooks) {
      throw new BuilderError(
        ErrorCode.PLUGIN_LOAD_ERROR,
        `无效的生命周期阶段: ${phase}`
      )
    }
    
    hooks.push(hook)
    this.logger.debug(`注册生命周期钩子: ${phase}`)
    
    // 返回取消注册函数
    return () => {
      const index = hooks.indexOf(hook)
      if (index > -1) {
        hooks.splice(index, 1)
        this.logger.debug(`移除生命周期钩子: ${phase}`)
      }
    }
  }

  /**
   * 执行生命周期钩子
   */
  async executeHooks(phase: BuildPhase, context: PluginContext, data?: any): Promise<void> {
    const hooks = this.lifecycleHooks.get(phase) || []
    const startTime = Date.now()
    
    this.logger.debug(`执行生命周期钩子: ${phase} (${hooks.length} 个钩子)`)
    
    for (const hook of hooks) {
      try {
        await hook(context, data)
      } catch (error) {
        this.logger.error(`生命周期钩子 ${phase} 执行失败:`, error)
        // 对于 onError 阶段，不继续抛出错误，避免无限递归
        if (phase !== 'onError') {
          throw error
        }
      }
    }
    
    this.logger.debug(`生命周期钩子 ${phase} 执行完成 (${Date.now() - startTime}ms)`)
  }

  /**
   * 构建前钩子
   */
  async beforeBuild(config: BuilderConfig, context: PluginContext): Promise<void> {
    await this.executeHooks('beforeBuild', context, { config })
    
    // 同时调用所有插件的 buildStart 钩子
    for (const plugin of this.plugins.values()) {
      if (plugin.buildStart) {
        try {
          await plugin.buildStart(config)
        } catch (error) {
          this.logger.error(`插件 ${plugin.name} buildStart 失败:`, error)
        }
      }
    }
  }

  /**
   * 构建后钩子
   */
  async afterBuild(result: BuildResult, context: PluginContext): Promise<void> {
    await this.executeHooks('afterBuild', context, { result })
  }

  /**
   * 错误处理钩子
   */
  async handleError(error: Error, context: PluginContext): Promise<void> {
    await this.executeHooks('onError', context, { error })
    
    // 同时调用所有插件的 onError 钩子
    for (const plugin of this.plugins.values()) {
      if (plugin.onError) {
        try {
          await plugin.onError(error, context)
        } catch (e) {
          this.logger.error(`插件 ${plugin.name} onError 失败:`, e)
        }
      }
    }
  }

  /**
   * 警告处理钩子
   */
  async handleWarning(warning: string, context: PluginContext): Promise<void> {
    await this.executeHooks('onWarning', context, { warning })
  }

  /**
   * 加载插件
   */
  async loadPlugin(plugin: UnifiedPlugin): Promise<PluginLoadResult> {
    const startTime = Date.now()

    try {
      // 检查插件是否已加载
      if (this.plugins.has(plugin.name)) {
        this.logger.warn(`插件 ${plugin.name} 已存在，将被覆盖`)
      }

      // 检查黑名单
      if (this.options.blacklist?.includes(plugin.name)) {
        throw new BuilderError(
          ErrorCode.PLUGIN_LOAD_ERROR,
          `插件 ${plugin.name} 在黑名单中`
        )
      }

      // 检查白名单
      if (this.options.whitelist?.length && !this.options.whitelist.includes(plugin.name)) {
        throw new BuilderError(
          ErrorCode.PLUGIN_LOAD_ERROR,
          `插件 ${plugin.name} 不在白名单中`
        )
      }

      // 检查插件数量限制
      if (this.plugins.size >= (this.options.maxPlugins || 100)) {
        throw new BuilderError(
          ErrorCode.PLUGIN_LOAD_ERROR,
          `插件数量超过限制 (${this.options.maxPlugins})`
        )
      }

      // 验证插件
      this.validatePlugin(plugin)

      // 初始化插件
      if (plugin.onInit) {
        await plugin.onInit({
          buildId: 'init',
          pluginName: plugin.name,
          cwd: process.cwd(),
          mode: 'production',
          platform: 'browser',
          env: process.env as any,
          config: {},
          cacheDir: '',
          tempDir: '',
          logger: this.logger,
          performanceMonitor: null as any
        })
      }

      // 注册插件
      this.plugins.set(plugin.name, plugin)

      const loadTime = Date.now() - startTime

      // 初始化性能统计
      this.performanceStats.set(plugin.name, {
        name: plugin.name,
        totalTime: 0,
        callCount: 0,
        averageTime: 0,
        maxTime: 0,
        hookPerformance: {}
      })

      this.logger.success(`插件 ${plugin.name} 加载成功 (${loadTime}ms)`)

      return {
        plugin,
        loadTime,
        success: true
      }

    } catch (error) {
      const loadTime = Date.now() - startTime

      this.logger.error(`插件 ${plugin.name} 加载失败:`, error)

      return {
        plugin,
        loadTime,
        success: false,
        error: error as Error
      }
    }
  }

  /**
   * 批量加载插件
   */
  async loadPlugins(plugins: UnifiedPlugin[]): Promise<PluginLoadResult[]> {
    const results: PluginLoadResult[] = []

    for (const plugin of plugins) {
      const result = await this.loadPlugin(plugin)
      results.push(result)

      // 如果加载失败且不是可选插件，抛出错误
      if (!result.success && !plugin.enabled) {
        throw new BuilderError(
          ErrorCode.PLUGIN_LOAD_ERROR,
          `必需插件 ${plugin.name} 加载失败`,
          { cause: result.error }
        )
      }
    }

    return results
  }

  /**
   * 获取插件
   */
  getPlugin(name: string): UnifiedPlugin | undefined {
    return this.plugins.get(name)
  }

  /**
   * 获取所有插件
   */
  getAllPlugins(): UnifiedPlugin[] {
    return Array.from(this.plugins.values())
  }

  /**
   * 移除插件
   */
  async removePlugin(name: string): Promise<boolean> {
    const plugin = this.plugins.get(name)

    if (!plugin) {
      return false
    }

    try {
      // 调用插件销毁钩子
      if (plugin.onDestroy) {
        await plugin.onDestroy({
          buildId: 'destroy',
          pluginName: plugin.name,
          cwd: process.cwd(),
          mode: 'production',
          platform: 'browser',
          env: process.env as any,
          config: {},
          cacheDir: '',
          tempDir: '',
          logger: this.logger,
          performanceMonitor: null as any
        })
      }

      this.plugins.delete(name)
      this.performanceStats.delete(name)

      this.logger.info(`插件 ${name} 已移除`)
      return true

    } catch (error) {
      this.logger.error(`移除插件 ${name} 失败:`, error)
      return false
    }
  }

  /**
   * 清空所有插件
   */
  async clear(): Promise<void> {
    const pluginNames = Array.from(this.plugins.keys())

    for (const name of pluginNames) {
      await this.removePlugin(name)
    }
  }

  /**
   * 获取插件性能统计
   */
  getPerformanceStats(name?: string): PluginPerformanceStats | PluginPerformanceStats[] {
    if (name) {
      const stats = this.performanceStats.get(name)
      if (!stats) {
        throw new BuilderError(
          ErrorCode.PLUGIN_NOT_FOUND,
          `插件 ${name} 不存在`
        )
      }
      return stats
    }

    return Array.from(this.performanceStats.values())
  }

  /**
   * 验证插件
   */
  private validatePlugin(plugin: UnifiedPlugin): void {
    if (!plugin.name) {
      throw new BuilderError(
        ErrorCode.PLUGIN_LOAD_ERROR,
        '插件必须有名称'
      )
    }

    if (typeof plugin.name !== 'string') {
      throw new BuilderError(
        ErrorCode.PLUGIN_LOAD_ERROR,
        '插件名称必须是字符串'
      )
    }

    // 检查插件依赖
    if (plugin.dependencies) {
      for (const dep of plugin.dependencies) {
        if (!this.plugins.has(dep)) {
          throw new BuilderError(
            ErrorCode.PLUGIN_DEPENDENCY_ERROR,
            `插件 ${plugin.name} 依赖的插件 ${dep} 未找到`
          )
        }
      }
    }
  }

  /**
   * 销毁资源
   */
  async dispose(): Promise<void> {
    await this.clear()
    this.removeAllListeners()
  }
}
