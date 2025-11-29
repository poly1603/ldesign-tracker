/**
 * Vue 追踪插件
 * @description 全局追踪功能
 */

import type { App, Plugin } from 'vue'
import type { TrackerOptions } from '@ldesign/tracker-core'
import { Tracker } from '@ldesign/tracker-core'
import { TRACKER_KEY } from '../composables/useTracker'
import { vTrack, setTrackerInstance } from '../directives/v-track'

/** 插件配置 */
export interface TrackerPluginOptions extends TrackerOptions {
  /** 是否注册 v-track 指令 */
  registerDirective?: boolean
}

/**
 * 创建追踪插件
 * @param options - 插件配置
 * @returns Vue 插件
 */
export function createTrackerPlugin(options: TrackerPluginOptions = {}): Plugin {
  const {
    registerDirective = true,
    ...trackerOptions
  } = options

  return {
    install(app: App) {
      // 创建追踪器实例
      const tracker = new Tracker(trackerOptions)

      // 安装追踪器
      tracker.install()

      // 提供全局实例
      app.provide(TRACKER_KEY, tracker)

      // 设置指令使用的实例
      setTrackerInstance(tracker)

      // 注册指令
      if (registerDirective) {
        app.directive('track', vTrack)
      }

      // 全局属性
      app.config.globalProperties.$tracker = tracker
    },
  }
}

/** 声明全局属性类型 */
declare module 'vue' {
  interface ComponentCustomProperties {
    $tracker: Tracker
  }
}

