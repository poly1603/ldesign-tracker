/**
 * 追踪器 Composable
 * @description 提供追踪相关的组合式函数
 * @packageDocumentation
 */

import { ref, shallowRef, computed, onMounted, onUnmounted, inject, provide, watch, type Ref, type InjectionKey } from 'vue'
import type { TrackEvent, TrackerOptions, EventPriority, TrackEventType } from '@ldesign/tracker-core'
import { Tracker, createTracker } from '@ldesign/tracker-core'

/** 追踪器注入 Key */
export const TRACKER_KEY: InjectionKey<Tracker> = Symbol('tracker')

/** useTracker 返回类型 */
export interface UseTrackerReturn {
  /** 事件列表 */
  events: Ref<TrackEvent[]>
  /** Tracker 实例 */
  tracker: Tracker
  /** 是否已初始化 */
  isReady: Ref<boolean>
  /** 会话 ID */
  sessionId: Ref<string>
  /** 页面 ID */
  pageId: Ref<string>
  /** 追踪事件 */
  track: (name: string, data?: Record<string, unknown>, options?: TrackOptions) => void
  /** 追踪页面浏览 */
  trackPageView: (data?: Record<string, unknown>) => void
  /** 设置用户 ID */
  setUserId: (userId: string) => void
  /** 设置全局属性 */
  setGlobalProperties: (properties: Record<string, unknown>) => void
  /** 立即发送事件 */
  flush: () => Promise<void>
  /** 获取会话 ID */
  getSessionId: () => string
  /** 清空本地事件列表 */
  clearEvents: () => void
}

/** 追踪选项 */
export interface TrackOptions {
  priority?: EventPriority
  type?: TrackEventType
}

/**
 * 使用追踪器
 * @param options - 配置选项（仅在未注入全局实例时使用）
 * @returns 追踪工具
 * @example
 * ```vue
 * <script setup>
 * import { useTracker } from '@ldesign/tracker-vue'
 * 
 * const { track, events, isReady } = useTracker()
 * 
 * function handleClick() {
 *   track('button_click', { buttonId: 'submit' })
 * }
 * </script>
 * ```
 */
export function useTracker(options?: TrackerOptions): UseTrackerReturn {
  /** 事件列表 */
  const events = ref<TrackEvent[]>([])
  
  /** 是否已初始化 */
  const isReady = ref(false)
  
  /** 会话 ID */
  const sessionId = ref('')
  
  /** 页面 ID */
  const pageId = ref('')

  // 尝试注入全局实例
  const injected = inject<Tracker | null>(TRACKER_KEY, null)
  
  // 是否由本 composable 创建
  const isOwnTracker = !injected

  // 创建或使用已有实例
  const tracker = injected ?? createTracker({
    ...options,
    onTrack: (event) => {
      events.value = [...events.value.slice(-49), event]
      options?.onTrack?.(event)
    },
  })

  // 生命周期
  onMounted(() => {
    if (isOwnTracker) {
      tracker.install()
    }
    
    // 更新状态
    isReady.value = tracker.isInitialized()
    sessionId.value = tracker.getSessionId()
    pageId.value = tracker.getPageId()
  })

  onUnmounted(() => {
    if (isOwnTracker) {
      tracker.uninstall()
    }
  })

  /**
   * 追踪自定义事件
   */
  function track(name: string, data?: Record<string, unknown>, trackOptions?: TrackOptions): void {
    tracker.track(name, data, trackOptions)
  }

  /**
   * 追踪页面浏览
   */
  function trackPageView(data?: Record<string, unknown>): void {
    tracker.trackPageView(data)
    pageId.value = tracker.getPageId()
  }

  /**
   * 设置用户 ID
   */
  function setUserId(userId: string): void {
    tracker.setUserId(userId)
  }

  /**
   * 设置全局属性
   */
  function setGlobalProperties(properties: Record<string, unknown>): void {
    tracker.setGlobalProperties(properties)
  }

  /**
   * 立即发送事件
   */
  async function flush(): Promise<void> {
    await tracker.flush()
  }

  /**
   * 获取会话 ID
   */
  function getSessionId(): string {
    return tracker.getSessionId()
  }

  /**
   * 清空本地事件列表
   */
  function clearEvents(): void {
    events.value = []
  }

  return {
    events,
    tracker,
    isReady,
    sessionId,
    pageId,
    track,
    trackPageView,
    setUserId,
    setGlobalProperties,
    flush,
    getSessionId,
    clearEvents,
  }
}

/**
 * 提供 Tracker 实例
 * @description 在父组件中调用，子组件可通过 useTracker 获取
 * @example
 * ```vue
 * <script setup>
 * import { provideTracker } from '@ldesign/tracker-vue'
 * 
 * provideTracker({
 *   appName: 'MyApp',
 *   endpoint: '/api/track'
 * })
 * </script>
 * ```
 */
export function provideTracker(options?: TrackerOptions): Tracker {
  const tracker = createTracker(options)
  provide(TRACKER_KEY, tracker)
  
  onMounted(() => {
    tracker.install()
  })
  
  onUnmounted(() => {
    tracker.uninstall()
  })
  
  return tracker
}

