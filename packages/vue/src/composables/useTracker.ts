/**
 * 追踪器 Composable
 * @description 提供追踪相关的组合式函数
 */

import { ref, onMounted, onUnmounted, inject } from 'vue'
import type { TrackEvent, TrackerOptions } from '@ldesign/tracker-core'
import { Tracker } from '@ldesign/tracker-core'

/** 追踪器注入 Key */
export const TRACKER_KEY = Symbol('tracker')

/**
 * 使用追踪器
 * @param options - 配置选项（仅在未注入全局实例时使用）
 * @returns 追踪工具
 */
export function useTracker(options?: TrackerOptions) {
  /** 事件列表 */
  const events = ref<TrackEvent[]>([])

  // 尝试注入全局实例
  const injected = inject<Tracker | null>(TRACKER_KEY, null)

  // 创建或使用已有实例
  const tracker = injected ?? new Tracker({
    ...options,
    onTrack: (event) => {
      events.value.push(event)
      // 限制本地事件列表大小
      if (events.value.length > 50) {
        events.value = events.value.slice(-50)
      }
      options?.onTrack?.(event)
    },
  })

  // 生命周期
  onMounted(() => {
    if (!injected) {
      tracker.install()
    }
  })

  onUnmounted(() => {
    if (!injected) {
      tracker.uninstall()
    }
  })

  /**
   * 追踪自定义事件
   * @param name - 事件名称
   * @param data - 事件数据
   */
  function track(name: string, data?: Record<string, unknown>): void {
    tracker.track(name, data)
  }

  /**
   * 设置用户 ID
   * @param userId - 用户 ID
   */
  function setUserId(userId: string): void {
    tracker.setUserId(userId)
  }

  /**
   * 立即发送事件
   */
  async function flush(): Promise<void> {
    await tracker.flush()
  }

  /**
   * 获取会话 ID
   * @returns 会话 ID
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
    track,
    setUserId,
    flush,
    getSessionId,
    clearEvents,
  }
}

