/**
 * Tracker Engine Plugin
 *
 * 将用户行为追踪功能集成到 LDesign Engine
 *
 * @example
 * ```ts
 * import { createVueEngine } from '@ldesign/engine-vue3'
 * import { createTrackerEnginePlugin } from '@ldesign/tracker-vue/plugins'
 *
 * const engine = createVueEngine({
 *   plugins: [
 *     createTrackerEnginePlugin({
 *       enabled: true,
 *       autoPageView: true,
 *       autoClick: true,
 *     })
 *   ]
 * })
 * ```
 */
import type { App } from 'vue'
import type { Tracker } from '@ldesign/tracker-core'
import type { TrackerPluginOptions } from '../plugin/tracker-plugin'
import { createTrackerPlugin } from '../plugin/tracker-plugin'

/** 引擎类型接口 */
interface EngineLike {
  getApp?: () => App | null
  events?: {
    on: (event: string, handler: (...args: unknown[]) => void) => void
    emit: (event: string, payload?: unknown) => void
    once: (event: string, handler: (...args: unknown[]) => void) => void
  }
  api?: {
    register: (api: unknown) => void
    get: (name: string) => unknown
  }
}

/** 插件上下文 */
interface PluginContext {
  engine?: EngineLike
}

/** 插件接口 */
interface Plugin {
  name: string
  version: string
  dependencies?: string[]
  install: (context: PluginContext | EngineLike) => void | Promise<void>
  uninstall?: (context: PluginContext | EngineLike) => void | Promise<void>
}

/**
 * Tracker Engine 插件选项
 */
export interface TrackerEnginePluginOptions extends TrackerPluginOptions {
  /** 插件名称（引擎插件标识）@default 'tracker' */
  pluginName?: string
  /** 插件版本 @default '1.0.0' */
  pluginVersion?: string
  /** 是否启用调试模式 @default false */
  debug?: boolean
}

/** 追踪器实例缓存 */
let trackerInstance: Tracker | null = null

/**
 * 创建 Tracker Engine 插件
 *
 * @param options - 插件配置选项
 * @returns Engine 插件实例
 */
export function createTrackerEnginePlugin(
  options: TrackerEnginePluginOptions = {},
): Plugin {
  const {
    pluginName = 'tracker',
    pluginVersion = '1.0.0',
    debug = false,
    ...trackerOptions
  } = options

  // Vue 插件安装标志
  let vueInstalled = false

  if (debug) {
    console.log('[Tracker Plugin] createTrackerEnginePlugin called with options:', options)
  }

  // 创建 Vue 插件
  const vuePlugin = createTrackerPlugin(trackerOptions)

  return {
    name: pluginName,
    version: pluginVersion,
    dependencies: [],

    async install(context: PluginContext | EngineLike) {
      const engine = (context as PluginContext).engine || (context as EngineLike)

      if (debug) {
        console.log('[Tracker Plugin] install called, engine:', !!engine)
      }

      // 注册 Tracker API 到 API 注册表
      if (engine?.api?.register) {
        const trackerAPI = {
          name: 'tracker',
          version: pluginVersion,
          getTracker: () => trackerInstance,
        }
        engine.api.register(trackerAPI)
      }

      // 安装 Vue 插件
      const installVuePlugin = (app: App): void => {
        if (vueInstalled) return
        vueInstalled = true

        // 使用 Vue 插件的 install 方法
        vuePlugin.install(app)

        if (debug) {
          console.log('[Tracker Plugin] Vue 插件已安装')
        }
      }

      // 尝试立即安装到 Vue
      const vueApp = engine?.getApp?.()
      if (vueApp) {
        installVuePlugin(vueApp)
      }
      else {
        // 等待 Vue 应用创建
        engine?.events?.once?.('app:created', (payload: unknown) => {
          const app = (payload as { app?: App })?.app
          if (app) installVuePlugin(app)
        })
      }
    },

    async uninstall(_context: PluginContext | EngineLike) {
      vueInstalled = false
      trackerInstance = null

      if (debug) {
        console.log('[Tracker Plugin] uninstall called')
      }
    },
  }
}

/**
 * 获取当前追踪器实例
 */
export function getTrackerInstance(): Tracker | null {
  return trackerInstance
}

