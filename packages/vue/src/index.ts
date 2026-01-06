/**
 * @ldesign/tracker-vue
 * @description Vue 用户行为追踪组件和插件
 * @packageDocumentation
 * @module @ldesign/tracker-vue
 */

// Composables
export {
  useTracker,
  provideTracker,
  TRACKER_KEY,
  type UseTrackerReturn,
  type TrackOptions,
} from './composables/useTracker'

export {
  useExposure,
  useExposureList,
  type UseExposureOptions,
  type UseExposureReturn,
} from './composables/useExposure'

// 指令
export * from './directives'

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
  ErrorData,
  PerformanceData,
  ExposureData,
  EventPriority,
} from '@ldesign/tracker-core'

export {
  Tracker,
  createTracker,
  ClickCollector,
  ScrollCollector,
  InputCollector,
  NavigationCollector,
  PerformanceCollector,
  ErrorCollector,
  ExposureCollector,
} from '@ldesign/tracker-core'

