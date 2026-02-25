/**
 * @ldesign/tracker Engine 插件
 */
import type { TrackerEnginePluginOptions } from './types'
import { createPerformanceCollector } from '../collectors/performance-collector'

export const trackerStateKeys = {
  COLLECTOR: 'tracker:collector' as const,
} as const

export const trackerEventKeys = {
  INSTALLED: 'tracker:installed' as const,
  UNINSTALLED: 'tracker:uninstalled' as const,
  TRACK: 'tracker:track' as const,
} as const

export function createTrackerEnginePlugin(options: TrackerEnginePluginOptions = {}) {
  let collector: any = null
  return {
    name: 'tracker',
    version: '1.0.0',
    dependencies: options.dependencies ?? [],

    async install(context: any) {
      const engine = context.engine || context
      collector = createPerformanceCollector(options as any)
      engine.state?.set(trackerStateKeys.COLLECTOR, collector)
      engine.events?.emit(trackerEventKeys.INSTALLED, { name: 'tracker' })
      engine.logger?.info('[Tracker Plugin] installed')
    },

    async uninstall(context: any) {
      const engine = context.engine || context
      collector?.destroy?.(); collector = null
      engine.state?.delete(trackerStateKeys.COLLECTOR)
      engine.events?.emit(trackerEventKeys.UNINSTALLED, {})
      engine.logger?.info('[Tracker Plugin] uninstalled')
    },
  }
}
