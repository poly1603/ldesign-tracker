/**
 * 点击事件收集器
 * @description 收集用户点击行为
 */

import { TrackEventType } from '../types'
import type { ClickData } from '../types'
import { BaseCollector } from './base-collector'

/**
 * 点击收集器配置
 */
export interface ClickCollectorOptions {
  /** 忽略的选择器 */
  ignoreSelectors?: string[]
  /** 是否收集右键点击 */
  captureRightClick?: boolean
  /** 防抖延迟（毫秒） */
  debounceDelay?: number
}

/**
 * 点击事件收集器
 */
export class ClickCollector extends BaseCollector {
  name = 'click'
  private options: Required<ClickCollectorOptions>
  private clickHandler: ((e: MouseEvent) => void) | null = null
  private lastClickTime = 0

  constructor(options: ClickCollectorOptions = {}) {
    super()
    this.options = {
      ignoreSelectors: options.ignoreSelectors ?? [],
      captureRightClick: options.captureRightClick ?? false,
      debounceDelay: options.debounceDelay ?? 100,
    }
  }

  /**
   * 安装收集器
   */
  install(): void {
    if (this.installed)
      return

    this.clickHandler = this.handleClick.bind(this)
    document.addEventListener('click', this.clickHandler, true)

    if (this.options.captureRightClick) {
      document.addEventListener('contextmenu', this.clickHandler, true)
    }

    this.installed = true
  }

  /**
   * 卸载收集器
   */
  uninstall(): void {
    if (!this.installed || !this.clickHandler)
      return

    document.removeEventListener('click', this.clickHandler, true)
    document.removeEventListener('contextmenu', this.clickHandler, true)

    this.clickHandler = null
    this.installed = false
  }

  /**
   * 处理点击事件
   * @param event - 鼠标事件
   */
  private handleClick(event: MouseEvent): void {
    // 防抖处理
    const now = Date.now()
    if (now - this.lastClickTime < this.options.debounceDelay) {
      return
    }
    this.lastClickTime = now

    const target = event.target as Element
    if (!target)
      return

    // 检查是否应该忽略
    if (this.shouldIgnore(target))
      return

    const elementInfo = this.getElementInfo(target)
    const clickData: ClickData = {
      x: event.clientX,
      y: event.clientY,
      button: event.button,
    }

    this.emit({
      type: TrackEventType.CLICK,
      name: this.getEventName(target),
      target: elementInfo,
      data: clickData,
    })
  }

  /**
   * 检查是否应该忽略该元素
   * @param element - DOM 元素
   * @returns 是否忽略
   */
  private shouldIgnore(element: Element): boolean {
    // 检查 data-track-ignore 属性
    if (element.hasAttribute('data-track-ignore')) {
      return true
    }

    // 检查忽略选择器
    for (const selector of this.options.ignoreSelectors) {
      if (element.matches(selector)) {
        return true
      }
    }

    return false
  }

  /**
   * 获取事件名称
   * @param element - DOM 元素
   * @returns 事件名称
   */
  private getEventName(element: Element): string {
    // 优先使用 data-track-name 属性
    const trackName = element.getAttribute('data-track-name')
    if (trackName)
      return trackName

    // 使用元素标识
    if (element.id)
      return `click_${element.id}`

    // 使用标签名和类名
    const tagName = element.tagName.toLowerCase()
    const className = element.className?.split(' ')[0]

    return className ? `click_${tagName}_${className}` : `click_${tagName}`
  }
}

