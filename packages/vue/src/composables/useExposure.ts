/**
 * 曝光追踪 Composable
 * @description 提供元素曝光追踪的组合式函数
 * @packageDocumentation
 */

import {
  ref,
  onMounted,
  onUnmounted,
  watch,
  type Ref,
  type ComponentPublicInstance,
} from 'vue'
import type { ExposureCollectorOptions, ExposureData } from '@ldesign/tracker-core'
import { useTracker } from './useTracker'

/** useExposure 配置 */
export interface UseExposureOptions {
  /** 曝光阈值(0-1) */
  threshold?: number
  /** 最小曝光时间(ms) */
  minDuration?: number
  /** 是否只触发一次 */
  once?: boolean
  /** 曝光回调 */
  onExposure?: (data: ExposureData) => void
  /** 是否立即开始观察 */
  immediate?: boolean
}

/** useExposure 返回类型 */
export interface UseExposureReturn {
  /** 是否已曝光 */
  isExposed: Ref<boolean>
  /** 曝光次数 */
  exposureCount: Ref<number>
  /** 曝光时长 */
  exposureDuration: Ref<number>
  /** 开始观察 */
  observe: () => void
  /** 停止观察 */
  unobserve: () => void
  /** 手动触发曝光 */
  trackExposure: (data?: Record<string, unknown>) => void
}

/**
 * 使用曝光追踪
 * @param elementRef - 元素引用
 * @param exposureId - 曝光标识
 * @param options - 配置选项
 * @returns 曝光追踪工具
 * @example
 * ```vue
 * <template>
 *   <div ref="cardRef" class="card">
 *     Product Card
 *   </div>
 * </template>
 * 
 * <script setup>
 * import { ref } from 'vue'
 * import { useExposure } from '@ldesign/tracker-vue'
 * 
 * const cardRef = ref(null)
 * const { isExposed, exposureCount } = useExposure(cardRef, 'product-card', {
 *   threshold: 0.5,
 *   minDuration: 1000,
 *   onExposure: (data) => console.log('Card exposed:', data)
 * })
 * </script>
 * ```
 */
export function useExposure(
  elementRef: Ref<HTMLElement | ComponentPublicInstance | null>,
  exposureId: string,
  options: UseExposureOptions = {}
): UseExposureReturn {
  const {
    threshold = 0.5,
    minDuration = 1000,
    once = true,
    onExposure,
    immediate = true,
  } = options

  /** 是否已曝光 */
  const isExposed = ref(false)

  /** 曝光次数 */
  const exposureCount = ref(0)

  /** 曝光时长 */
  const exposureDuration = ref(0)

  /** Observer 实例 */
  let observer: IntersectionObserver | null = null

  /** 开始曝光时间 */
  let exposureStartTime: number | null = null

  /** 定时器 */
  let timer: ReturnType<typeof setTimeout> | null = null

  /** 是否正在观察 */
  let isObserving = false

  /** 获取 tracker */
  const { tracker } = useTracker()

  /**
   * 获取实际元素
   */
  function getElement(): HTMLElement | null {
    const el = elementRef.value
    if (!el) return null
    
    // 如果是组件实例，获取其根元素
    if ('$el' in el) {
      return el.$el as HTMLElement
    }
    
    return el as HTMLElement
  }

  /**
   * 处理曝光
   */
  function handleExposure(): void {
    if (once && isExposed.value) return

    isExposed.value = true
    exposureCount.value++
    exposureDuration.value += Date.now() - (exposureStartTime || Date.now())

    // 上报曝光事件
    const element = getElement()
    const data: ExposureData = {
      element: {
        tagName: element?.tagName.toLowerCase() || 'unknown',
        id: element?.id,
        className: element?.className,
      },
      intersectionRatio: threshold,
      duration: exposureDuration.value,
      isFirstExposure: exposureCount.value === 1,
      exposureId,
    }

    tracker.track('exposure', {
      exposureId,
      ...data,
    })

    onExposure?.(data)

    // 如果只触发一次，停止观察
    if (once) {
      unobserve()
    }
  }

  /**
   * 处理交叉变化
   */
  function handleIntersection(entries: IntersectionObserverEntry[]): void {
    const entry = entries[0]
    
    if (entry.isIntersecting && entry.intersectionRatio >= threshold) {
      // 元素进入视口
      if (exposureStartTime === null) {
        exposureStartTime = Date.now()
        
        // 设置定时器检查曝光时长
        timer = setTimeout(() => {
          if (exposureStartTime !== null) {
            handleExposure()
          }
        }, minDuration)
      }
    } else {
      // 元素离开视口
      if (exposureStartTime !== null) {
        const duration = Date.now() - exposureStartTime
        
        // 如果已经达到最小曝光时长，触发曝光
        if (duration >= minDuration && !isExposed.value) {
          handleExposure()
        }
        
        exposureStartTime = null
        
        // 清除定时器
        if (timer) {
          clearTimeout(timer)
          timer = null
        }
      }
    }
  }

  /**
   * 开始观察
   */
  function observe(): void {
    if (isObserving) return

    const element = getElement()
    if (!element) return

    // 创建 Observer
    observer = new IntersectionObserver(handleIntersection, {
      root: null,
      rootMargin: '0px',
      threshold: [threshold],
    })

    observer.observe(element)
    isObserving = true
  }

  /**
   * 停止观察
   */
  function unobserve(): void {
    if (!isObserving) return

    if (observer) {
      observer.disconnect()
      observer = null
    }

    if (timer) {
      clearTimeout(timer)
      timer = null
    }

    isObserving = false
  }

  /**
   * 手动触发曝光
   */
  function trackExposure(data?: Record<string, unknown>): void {
    if (once && isExposed.value) return

    isExposed.value = true
    exposureCount.value++

    const element = getElement()
    tracker.track('exposure', {
      exposureId,
      element: {
        tagName: element?.tagName.toLowerCase() || 'unknown',
        id: element?.id,
        className: element?.className,
      },
      isFirstExposure: exposureCount.value === 1,
      ...data,
    })
  }

  // 监听元素变化
  watch(elementRef, (newEl, oldEl) => {
    if (oldEl && isObserving) {
      unobserve()
    }
    if (newEl && immediate) {
      // 等待 DOM 更新
      setTimeout(observe, 0)
    }
  })

  // 生命周期
  onMounted(() => {
    if (immediate && elementRef.value) {
      observe()
    }
  })

  onUnmounted(() => {
    unobserve()
  })

  return {
    isExposed,
    exposureCount,
    exposureDuration,
    observe,
    unobserve,
    trackExposure,
  }
}

/**
 * 批量曝光追踪
 * @param exposureIds - 曝光标识数组
 * @param options - 配置选项
 * @returns 曝光追踪 Map
 */
export function useExposureList(
  exposureIds: string[],
  options: UseExposureOptions = {}
): Map<string, { isExposed: Ref<boolean>; trackExposure: () => void }> {
  const { tracker } = useTracker()
  const result = new Map<string, { isExposed: Ref<boolean>; trackExposure: () => void }>()

  for (const id of exposureIds) {
    const isExposed = ref(false)

    const trackExposure = () => {
      if (options.once && isExposed.value) return
      
      isExposed.value = true
      tracker.track('exposure', {
        exposureId: id,
        isFirstExposure: true,
      })
      
      options.onExposure?.({
        element: { tagName: 'manual' },
        intersectionRatio: 1,
        isFirstExposure: true,
        exposureId: id,
      })
    }

    result.set(id, { isExposed, trackExposure })
  }

  return result
}
