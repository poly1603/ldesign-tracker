/**
 * @ldesign/tracker-core
 * @description 用户行为追踪核心库
 * @packageDocumentation
 * @module @ldesign/tracker-core
 */

// 类型
export * from './types'

// 工具函数
export * from './utils'

// 收集器
export * from './collectors'
export { PerformanceCollector, createPerformanceCollector } from './collectors/performance-collector'
export { ErrorCollector, createErrorCollector, wrapWithErrorHandler } from './collectors/error-collector'
export { ExposureCollector, createExposureCollector } from './collectors/exposure-collector'

// 追踪管理器
export * from './tracker'
export { Tracker, createTracker } from './tracker/tracker'

// Engine 插件
export * from './engine'
