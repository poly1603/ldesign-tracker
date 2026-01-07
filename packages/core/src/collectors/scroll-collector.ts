/**
 * 滚动事件收集器
 * @description 收集用户滚动行为
 */

import { TrackEventType } from '../types'
import type { ScrollData } from '../types'
import { BaseCollector } from './base-collector'

/**
 * 滚动收集器配置
 */
export interface ScrollCollectorOptions {
  /** 节流延迟（毫秒） */
  throttleDelay?: number
  /** 滚动深度阈值（百分比数组） */
  depthThresholds?: number[]
}

/**
 * 滚动事件收集器
 */
export class ScrollCollector extends BaseCollector {
  name = 'scroll'
  private options: Required<ScrollCollectorOptions>
  private scrollHandler: (() => void) | null = null
  private lastScrollY = 0
  private lastScrollX = 0
  private lastEmitTime = 0
  private reachedDepths = new Set<number>()

  constructor(options: ScrollCollectorOptions = {}) {
    super()
    this.options = {
      throttleDelay: options.throttleDelay ?? 500,
      depthThresholds: options.depthThresholds ?? [25, 50, 75, 100],
    }
  }

  /**
   * 安装收集器
   */
  install(): void {
    if (this.installed)
      return

    this.scrollHandler = this.handleScroll.bind(this)
    window.addEventListener('scroll', this.scrollHandler, { passive: true })

    this.installed = true
  }

  /**
   * 卸载收集器
   */
  uninstall(): void {
    if (!this.installed || !this.scrollHandler)
      return

    window.removeEventListener('scroll', this.scrollHandler)
    this.scrollHandler = null
    this.reachedDepths.clear()
    this.installed = false
  }

  /**
   * 处理滚动事件
   */
  private handleScroll(): void {
    const now = Date.now()

    // 节流处理
    if (now - this.lastEmitTime < this.options.throttleDelay) {
      return
    }

    const scrollY = window.scrollY
    const scrollX = window.scrollX
    const scrollDepth = this.calculateScrollDepth()
    const direction = this.getScrollDirection(scrollY, scrollX)

    // 检查是否达到新的深度阈值
    const newDepthReached = this.checkDepthThreshold(scrollDepth)

    // 只在达到新深度阈值时发送事件
    if (newDepthReached) {
      const scrollData: ScrollData = {
        scrollX,
        scrollY,
        direction,
        scrollDepth,
      }

      this.emit({
        type: TrackEventType.SCROLL,
        name: `scroll_depth_${Math.floor(scrollDepth)}`,
        data: scrollData as unknown as Record<string, unknown>,
      })

      this.lastEmitTime = now
    }

    this.lastScrollY = scrollY
    this.lastScrollX = scrollX
  }

  /**
   * 计算滚动深度
   * @returns 滚动深度百分比
   */
  private calculateScrollDepth(): number {
    const scrollHeight = document.documentElement.scrollHeight
    const clientHeight = document.documentElement.clientHeight
    const scrollTop = window.scrollY

    if (scrollHeight <= clientHeight) {
      return 100
    }

    return Math.min(100, Math.round((scrollTop / (scrollHeight - clientHeight)) * 100))
  }

  /**
   * 获取滚动方向
   * @param currentY - 当前 Y 位置
   * @param currentX - 当前 X 位置
   * @returns 滚动方向
   */
  private getScrollDirection(currentY: number, currentX: number): ScrollData['direction'] {
    const deltaY = currentY - this.lastScrollY
    const deltaX = currentX - this.lastScrollX

    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      return deltaY > 0 ? 'down' : 'up'
    }
    return deltaX > 0 ? 'right' : 'left'
  }

  /**
   * 检查是否达到新的深度阈值
   * @param depth - 当前深度
   * @returns 是否达到新阈值
   */
  private checkDepthThreshold(depth: number): boolean {
    for (const threshold of this.options.depthThresholds) {
      if (depth >= threshold && !this.reachedDepths.has(threshold)) {
        this.reachedDepths.add(threshold)
        return true
      }
    }
    return false
  }

  /**
   * 重置深度记录（页面切换时调用）
   */
  resetDepths(): void {
    this.reachedDepths.clear()
  }
}

