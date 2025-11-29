/**
 * @ldesign/tracker - 用户行为追踪系统
 *
 * 提供完整的用户行为收集、分析和上报功能
 *
 * @module @ldesign/tracker
 * @example
 * ```ts
 * // 使用追踪器
 * import { Tracker } from '@ldesign/tracker'
 *
 * const tracker = new Tracker({
 *   endpoint: '/api/track',
 *   collectors: ['click', 'scroll', 'input'],
 * })
 *
 * tracker.track('custom_event', { key: 'value' })
 * ```
 *
 * @example
 * ```vue
 * // Vue 组件中使用
 * <template>
 *   <button v-track="'button_click'">点击</button>
 * </template>
 *
 * <script setup>
 * import { useTracker } from '@ldesign/tracker'
 *
 * const { track, setUserId } = useTracker()
 * setUserId('user-123')
 * </script>
 * ```
 */

// 导出核心功能
export * from '@ldesign/tracker-core'

// 导出 Vue 功能
export * from '@ldesign/tracker-vue'

