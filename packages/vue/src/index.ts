/**
 * @ldesign/tracker-vue
 * @description Vue 用户行为追踪组件和插件
 * @packageDocumentation
 */

// 指令
export * from './directives'

// Composables
export * from './composables'

// 插件
export * from './plugin'

// 重新导出核心类型
export type {
  TrackEvent,
  TrackEventType,
  TrackerOptions,
  ElementInfo,
  DeviceInfo,
  Collector,
  PageViewData,
  ClickData,
  ScrollData,
  InputData,
} from '@ldesign/tracker-core'

export {
  Tracker,
  ClickCollector,
  ScrollCollector,
  InputCollector,
  NavigationCollector,
} from '@ldesign/tracker-core'

