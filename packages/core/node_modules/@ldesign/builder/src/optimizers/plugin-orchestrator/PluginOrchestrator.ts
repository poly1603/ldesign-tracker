/**
 * 插件编排器
 * 
 * 智能管理和编排不同框架的构建插件，避免冲突
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import type { Plugin } from 'rollup'
import { Logger } from '../../utils/logger'
import type { FrameworkInfo } from '../../detectors/FrameworkDetector'

/**
 * 插件元信息
 */
export interface PluginMeta {
  /** 插件名称 */
  name: string
  /** 适用框架 */
  frameworks?: Array<'vue' | 'react' | 'universal'>
  /** 优先级（越大越先执行） */
  priority?: number
  /** 互斥插件（不能同时使用的插件） */
  conflicts?: string[]
  /** 依赖插件（必须在此插件之前执行） */
  dependencies?: string[]
  /** 插件阶段 */
  phase?: 'pre' | 'transform' | 'post'
  /** 是否可以禁用 */
  optional?: boolean
}

/**
 * 增强插件（带元信息）
 */
export interface EnhancedPlugin extends Plugin {
  __meta?: PluginMeta
}

/**
 * 编排配置
 */
export interface OrchestrationConfig {
  /** 严格模式（发现冲突时抛出错误） */
  strict?: boolean
  /** 自动解决冲突 */
  autoResolveConflicts?: boolean
  /** 插件黑名单 */
  blacklist?: string[]
  /** 插件白名单 */
  whitelist?: string[]
  /** 框架优先级 */
  frameworkPriority?: Record<string, number>
}

/**
 * 插件编排器
 */
export class PluginOrchestrator {
  private logger: Logger
  private config: OrchestrationConfig
  private pluginRegistry: Map<string, EnhancedPlugin> = new Map()
  private frameworkPlugins: Map<string, Set<string>> = new Map()

  constructor(config: OrchestrationConfig = {}) {
    this.config = {
      autoResolveConflicts: true,
      frameworkPriority: {
        universal: 0,
        vue: 1,
        react: 1
      },
      ...config
    }
    this.logger = new Logger({ prefix: '[PluginOrchestrator]' })
    this.initializeFrameworkPlugins()
  }

  /**
   * 初始化框架插件映射
   */
  private initializeFrameworkPlugins(): void {
    this.frameworkPlugins.set('vue', new Set([
      '@vitejs/plugin-vue',
      '@vitejs/plugin-vue-jsx',
      'vite-plugin-vue2',
      'unplugin-vue-components',
      'unplugin-auto-import'
    ]))

    this.frameworkPlugins.set('react', new Set([
      '@vitejs/plugin-react',
      '@vitejs/plugin-react-swc',
      'vite-plugin-react-pages',
      '@react/refresh'
    ]))

    this.frameworkPlugins.set('universal', new Set([
      'vite-plugin-compression',
      'rollup-plugin-visualizer',
      'vite-plugin-pwa',
      'unplugin-icons'
    ]))
  }

  /**
   * 注册插件
   */
  registerPlugin(plugin: EnhancedPlugin, meta?: PluginMeta): void {
    if (!plugin.name) {
      this.logger.warn('插件缺少名称，跳过注册')
      return
    }

    // 合并元信息
    if (meta) {
      plugin.__meta = { ...plugin.__meta, ...meta }
    }

    this.pluginRegistry.set(plugin.name, plugin)
    this.logger.debug(`注册插件: ${plugin.name}`)
  }

  /**
   * 编排插件
   */
  orchestrate(
    plugins: Plugin[],
    filePath: string,
    framework: FrameworkInfo
  ): Plugin[] {
    this.logger.debug(`编排插件 - 文件: ${filePath}, 框架: ${framework.type}`)

    // 1. 增强插件（添加元信息）
    const enhancedPlugins = this.enhancePlugins(plugins, framework)

    // 2. 过滤插件（根据框架和配置）
    const filteredPlugins = this.filterPlugins(enhancedPlugins, framework)

    // 3. 解决冲突
    const conflictFreePlugins = this.resolveConflicts(filteredPlugins, framework)

    // 4. 排序插件
    const sortedPlugins = this.sortPlugins(conflictFreePlugins)

    // 5. 创建条件插件
    const conditionalPlugins = this.createConditionalPlugins(sortedPlugins, filePath, framework)

    this.logger.debug(`编排完成，最终插件数: ${conditionalPlugins.length}`)

    return conditionalPlugins
  }

  /**
   * 增强插件
   */
  private enhancePlugins(plugins: Plugin[], framework: FrameworkInfo): EnhancedPlugin[] {
    return plugins.map(plugin => {
      const enhanced = plugin as EnhancedPlugin

      // 如果已经有元信息，保留
      if (enhanced.__meta) {
        return enhanced
      }

      // 根据插件名称推断元信息
      const meta: PluginMeta = {
        name: plugin.name || 'unknown',
        frameworks: this.inferFrameworks(plugin.name || ''),
        priority: this.inferPriority(plugin.name || ''),
        phase: this.inferPhase(plugin)
      }

      enhanced.__meta = meta
      return enhanced
    })
  }

  /**
   * 推断适用框架
   */
  private inferFrameworks(pluginName: string): Array<'vue' | 'react' | 'universal'> {
    const name = pluginName.toLowerCase()

    if (this.frameworkPlugins.get('vue')?.has(pluginName)) {
      return ['vue']
    }
    if (this.frameworkPlugins.get('react')?.has(pluginName)) {
      return ['react']
    }

    // 基于名称推断
    if (name.includes('vue')) return ['vue']
    if (name.includes('react')) return ['react']

    // 默认为通用插件
    return ['universal']
  }

  /**
   * 推断优先级
   */
  private inferPriority(pluginName: string): number {
    // 基础插件优先级最高
    if (pluginName.includes('typescript')) return 100
    if (pluginName.includes('babel')) return 90
    if (pluginName.includes('esbuild')) return 90

    // 框架插件
    if (pluginName.includes('vue') || pluginName.includes('react')) return 80

    // 转换插件
    if (pluginName.includes('transform')) return 70

    // 优化插件
    if (pluginName.includes('optimize')) return 50
    if (pluginName.includes('compress')) return 40

    // 分析插件
    if (pluginName.includes('analyze') || pluginName.includes('visualize')) return 20

    // 默认
    return 50
  }

  /**
   * 推断插件阶段
   */
  private inferPhase(plugin: Plugin): 'pre' | 'transform' | 'post' {
    // 根据enforce字段
    if ('enforce' in plugin) {
      if (plugin.enforce === 'pre') return 'pre'
      if (plugin.enforce === 'post') return 'post'
    }

    // 根据钩子函数
    if (plugin.transform) return 'transform'
    if (plugin.generateBundle || plugin.writeBundle) return 'post'

    return 'transform'
  }

  /**
   * 过滤插件
   */
  private filterPlugins(
    plugins: EnhancedPlugin[],
    framework: FrameworkInfo
  ): EnhancedPlugin[] {
    return plugins.filter(plugin => {
      const meta = plugin.__meta!

      // 检查黑白名单
      if (this.config.blacklist?.includes(meta.name)) {
        this.logger.debug(`插件 ${meta.name} 在黑名单中，已过滤`)
        return false
      }

      if (this.config.whitelist && !this.config.whitelist.includes(meta.name)) {
        this.logger.debug(`插件 ${meta.name} 不在白名单中，已过滤`)
        return false
      }

      // 检查框架兼容性
      if (meta.frameworks && !meta.frameworks.includes('universal')) {
        const compatible = meta.frameworks.includes(framework.type as any)
        if (!compatible) {
          this.logger.debug(`插件 ${meta.name} 不兼容 ${framework.type}，已过滤`)
          return false
        }
      }

      return true
    })
  }

  /**
   * 解决插件冲突
   */
  resolveConflicts(
    plugins: EnhancedPlugin[],
    framework: FrameworkInfo
  ): EnhancedPlugin[] {
    const resolved: EnhancedPlugin[] = []
    const used = new Set<string>()

    for (const plugin of plugins) {
      const meta = plugin.__meta!

      // 检查冲突
      const hasConflict = meta.conflicts?.some(conflict => used.has(conflict))

      if (hasConflict) {
        if (this.config.strict) {
          throw new Error(`插件冲突: ${meta.name} 与已有插件冲突`)
        }

        if (this.config.autoResolveConflicts) {
          // 根据优先级决定保留哪个
          const conflictingPlugin = resolved.find(p =>
            meta.conflicts?.includes(p.__meta!.name)
          )

          if (conflictingPlugin &&
            (conflictingPlugin.__meta!.priority || 0) < (meta.priority || 0)) {
            // 替换优先级较低的插件
            const index = resolved.indexOf(conflictingPlugin)
            resolved[index] = plugin
            used.delete(conflictingPlugin.__meta!.name)
            used.add(meta.name)
            this.logger.debug(`解决冲突: 使用 ${meta.name} 替换 ${conflictingPlugin.__meta!.name}`)
            continue
          }
        }

        this.logger.debug(`跳过冲突插件: ${meta.name}`)
        continue
      }

      // 检查依赖
      const missingDeps = meta.dependencies?.filter(dep => !used.has(dep))
      if (missingDeps?.length) {
        this.logger.warn(`插件 ${meta.name} 缺少依赖: ${missingDeps.join(', ')}`)
        if (this.config.strict) {
          throw new Error(`插件依赖缺失: ${meta.name}`)
        }
        continue
      }

      resolved.push(plugin)
      used.add(meta.name)
    }

    return resolved
  }

  /**
   * 排序插件
   */
  private sortPlugins(plugins: EnhancedPlugin[]): EnhancedPlugin[] {
    return plugins.sort((a, b) => {
      const metaA = a.__meta!
      const metaB = b.__meta!

      // 1. 按阶段排序
      const phaseOrder = { pre: 0, transform: 1, post: 2 }
      const phaseDiff = phaseOrder[metaA.phase || 'transform'] - phaseOrder[metaB.phase || 'transform']
      if (phaseDiff !== 0) return phaseDiff

      // 2. 按优先级排序（降序）
      const priorityDiff = (metaB.priority || 0) - (metaA.priority || 0)
      if (priorityDiff !== 0) return priorityDiff

      // 3. 按框架优先级排序
      const frameworkPriorityA = this.getFrameworkPriority(metaA.frameworks?.[0])
      const frameworkPriorityB = this.getFrameworkPriority(metaB.frameworks?.[0])
      const frameworkDiff = frameworkPriorityB - frameworkPriorityA
      if (frameworkDiff !== 0) return frameworkDiff

      // 4. 按名称排序（确保稳定性）
      return metaA.name.localeCompare(metaB.name)
    })
  }

  /**
   * 获取框架优先级
   */
  private getFrameworkPriority(framework?: string): number {
    if (!framework) return 0
    return this.config.frameworkPriority?.[framework] || 0
  }

  /**
   * 创建条件插件
   */
  private createConditionalPlugins(
    plugins: EnhancedPlugin[],
    filePath: string,
    framework: FrameworkInfo
  ): Plugin[] {
    return plugins.map(plugin => {
      const meta = plugin.__meta!

      // 如果是通用插件，直接返回
      if (meta.frameworks?.includes('universal')) {
        return plugin
      }

      // 创建条件包装
      return this.createConditionalPlugin(
        plugin,
        (id: string) => {
          // 这里可以添加更复杂的条件逻辑
          return this.shouldApplyPlugin(id, framework, meta)
        }
      )
    })
  }

  /**
   * 创建条件插件
   */
  createConditionalPlugin(
    plugin: Plugin,
    condition: (id: string) => boolean
  ): Plugin {
    const hooks = ['buildStart', 'resolveId', 'load', 'transform', 'buildEnd', 'generateBundle', 'writeBundle']
    const conditionalPlugin: Plugin = {
      name: `conditional-${plugin.name}`
    }

    // 保留 enforce 属性（如果有）
    if ((plugin as any).enforce) {
      (conditionalPlugin as any).enforce = (plugin as any).enforce
    }

    // 包装所有钩子函数
    for (const hook of hooks) {
      const originalHook = (plugin as any)[hook]
      if (typeof originalHook === 'function') {
        (conditionalPlugin as any)[hook] = function (this: any, ...args: any[]) {
          // 获取文件ID（不同钩子参数位置不同）
          let id: string | undefined
          if (hook === 'transform' || hook === 'load') {
            id = args[0]
          } else if (hook === 'resolveId') {
            id = args[0]
          }

          // 如果有ID且不满足条件，跳过
          if (id && !condition(id)) {
            return null
          }

          // 调用原始钩子
          return originalHook.apply(this, args)
        }
      }
    }

    return conditionalPlugin
  }

  /**
   * 判断是否应用插件
   */
  private shouldApplyPlugin(
    filePath: string,
    framework: FrameworkInfo,
    meta: PluginMeta
  ): boolean {
    // 检查框架匹配
    if (meta.frameworks && !meta.frameworks.includes(framework.type as any)) {
      return false
    }

    // 可以添加更多条件，如文件类型、路径模式等
    return true
  }

  /**
   * 获取框架特定插件
   */
  getFrameworkPlugins(framework: 'vue' | 'react'): string[] {
    return Array.from(this.frameworkPlugins.get(framework) || [])
  }

  /**
   * 清理
   */
  cleanup(): void {
    this.pluginRegistry.clear()
  }
}

/**
 * 创建插件编排器
 */
export function createPluginOrchestrator(config?: OrchestrationConfig): PluginOrchestrator {
  return new PluginOrchestrator(config)
}
