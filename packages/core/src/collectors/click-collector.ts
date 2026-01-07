/**
 * 点击事件收集器
 * @description 收集用户点击行为，包含详细的元素、组件和上下文信息
 */

import { TrackEventType } from '../types'
import type { ClickData } from '../types'
import { BaseCollector } from './base-collector'
import { getInteractionType } from '../utils'

/**
 * 点击收集器配置
 */
export interface ClickCollectorOptions {
  /** 忽略的选择器 */
  ignoreSelectors?: string[]
  /** 是否收集右键点击 */
  captureRightClick?: boolean
  /** 是否收集双击 */
  captureDoubleClick?: boolean
  /** 防抖延迟（毫秒） */
  debounceDelay?: number
  /** 是否向上查找可点击元素 */
  bubbleToClickable?: boolean
}

/**
 * 点击事件收集器
 */
export class ClickCollector extends BaseCollector {
  name = 'click'
  private options: Required<ClickCollectorOptions>
  private clickHandler: ((e: MouseEvent) => void) | null = null
  private dblClickHandler: ((e: MouseEvent) => void) | null = null
  private lastClickTime = 0
  private lastClickTarget: Element | null = null
  private isProcessing = false

  constructor(options: ClickCollectorOptions = {}) {
    super()
    this.options = {
      ignoreSelectors: options.ignoreSelectors ?? [],
      captureRightClick: options.captureRightClick ?? false,
      captureDoubleClick: options.captureDoubleClick ?? true,
      debounceDelay: options.debounceDelay ?? 100,
      bubbleToClickable: options.bubbleToClickable ?? true,
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

    if (this.options.captureDoubleClick) {
      this.dblClickHandler = this.handleDoubleClick.bind(this)
      document.addEventListener('dblclick', this.dblClickHandler, true)
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

    if (this.dblClickHandler) {
      document.removeEventListener('dblclick', this.dblClickHandler, true)
      this.dblClickHandler = null
    }

    this.clickHandler = null
    this.installed = false
  }

  /**
   * 处理点击事件
   * @param event - 鼠标事件
   */
  private handleClick(event: MouseEvent): void {
    this.processClickEvent(event, event.type === 'contextmenu' ? 'context' : 'single')
  }

  /**
   * 处理双击事件
   * @param event - 鼠标事件
   */
  private handleDoubleClick(event: MouseEvent): void {
    this.processClickEvent(event, 'double')
  }

  /**
   * 处理点击事件通用方法
   * @param event - 鼠标事件
   * @param clickType - 点击类型
   */
  private processClickEvent(event: MouseEvent, clickType: 'single' | 'double' | 'context'): void {
    // 防止重入（避免无限循环）
    if (this.isProcessing) {
      return
    }

    // 防抖处理 (仅对单击生效)
    const now = Date.now()
    if (clickType === 'single' && now - this.lastClickTime < this.options.debounceDelay) {
      return
    }

    let target = event.target as Element
    if (!target)
      return

    // 向上查找可点击元素 (可选)
    if (this.options.bubbleToClickable) {
      target = this.findClickableElement(target) || target
    }

    // 检查是否应该忽略
    if (this.shouldIgnore(target))
      return

    // 计算距离上次点击的时间
    const timeSinceLastClick = this.lastClickTime > 0 ? now - this.lastClickTime : undefined

    const elementInfo = this.getElementInfo(target)
    const interactionType = getInteractionType(target)

    // 构建详细的点击数据
    const clickData: ClickData = {
      // 坐标信息
      x: event.clientX,
      y: event.clientY,
      pageX: event.pageX,
      pageY: event.pageY,
      offsetX: event.offsetX,
      offsetY: event.offsetY,

      // 按钮信息
      button: event.button,
      buttonName: this.getButtonName(event.button),

      // 视口/页面尺寸
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      pageWidth: document.documentElement.scrollWidth,
      pageHeight: document.documentElement.scrollHeight,

      // 点击类型
      clickType,
      interactionType,

      // 操作文本 (按钮文本、链接文本等)
      actionText: this.getActionText(target),

      // 修饰键
      modifiers: {
        ctrl: event.ctrlKey,
        alt: event.altKey,
        shift: event.shiftKey,
        meta: event.metaKey,
      },

      // 时间间隔
      timeSinceLastClick,
    }

    // 更新上次点击信息
    this.lastClickTime = now
    this.lastClickTarget = target

    // 标记正在处理，防止重入
    this.isProcessing = true
    try {
      this.emit({
        type: TrackEventType.CLICK,
        name: this.getEventName(target, interactionType),
        target: elementInfo,
        data: clickData as unknown as Record<string, unknown>,
      })
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * 获取按钮名称
   * @param button - 按钮编号
   * @returns 按钮名称
   */
  private getButtonName(button: number): 'left' | 'middle' | 'right' {
    switch (button) {
      case 0:
        return 'left'
      case 1:
        return 'middle'
      case 2:
        return 'right'
      default:
        return 'left'
    }
  }

  /**
   * 获取操作文本 (按钮文本、链接文本等)
   * @param element - DOM 元素
   * @returns 操作文本
   */
  private getActionText(element: Element): string | undefined {
    // 优先使用 data-track-text
    const trackText = element.getAttribute('data-track-text')
    if (trackText) return trackText

    const tagName = element.tagName.toLowerCase()

    // 按钮
    if (tagName === 'button') {
      const text = element.textContent?.trim()
      return text && text.length <= 50 ? text : undefined
    }

    // 输入按钮
    if (tagName === 'input') {
      const input = element as HTMLInputElement
      if (input.type === 'submit' || input.type === 'button') {
        return input.value || undefined
      }
    }

    // 链接
    if (tagName === 'a') {
      const text = element.textContent?.trim()
      if (text && text.length <= 100) return text
      return (element as HTMLAnchorElement).title || undefined
    }

    // 其他元素 - 获取短文本
    const text = element.textContent?.trim()
    if (text && text.length <= 30) {
      return text
    }

    return undefined
  }

  /**
   * 向上查找可点击元素
   * @param element - 起始元素
   * @returns 可点击元素或 null
   */
  private findClickableElement(element: Element): Element | null {
    const clickableTags = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA']
    const clickableRoles = ['button', 'link', 'menuitem', 'tab', 'checkbox', 'radio']

    let current: Element | null = element
    let depth = 0
    const maxDepth = 5 // 最多向上查找 5 层

    while (current && depth < maxDepth) {
      // 检查标签
      if (clickableTags.includes(current.tagName)) {
        return current
      }

      // 检查 role
      const role = current.getAttribute('role')
      if (role && clickableRoles.includes(role)) {
        return current
      }

      // 检查是否有点击事件绑定
      if (
        current.hasAttribute('onclick') ||
        current.hasAttribute('@click') ||
        current.hasAttribute('v-on:click')
      ) {
        return current
      }

      current = current.parentElement
      depth++
    }

    return null
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

    // 检查父元素是否有 data-track-ignore
    let current: Element | null = element.parentElement
    let depth = 0
    while (current && depth < 5) {
      if (current.hasAttribute('data-track-ignore')) {
        return true
      }
      current = current.parentElement
      depth++
    }

    // 检查忽略选择器
    for (const selector of this.options.ignoreSelectors) {
      try {
        if (element.matches(selector)) {
          return true
        }
      } catch {
        // 忽略无效选择器
      }
    }

    return false
  }

  /**
   * 获取事件名称
   * @param element - DOM 元素
   * @param interactionType - 交互类型
   * @returns 事件名称
   */
  private getEventName(element: Element, interactionType: string): string {
    // 优先使用 data-track-name 属性
    const trackName = element.getAttribute('data-track-name')
    if (trackName)
      return trackName

    // 使用元素 ID
    if (element.id)
      return `click_${interactionType}_${element.id}`

    // 使用标签名和类名
    const tagName = element.tagName.toLowerCase()

    // 安全获取 className
    let className: string | undefined
    if (element.className) {
      if (typeof element.className === 'string') {
        className = element.className.split(' ')[0]
      } else if ((element.className as SVGAnimatedString)?.baseVal) {
        className = (element.className as SVGAnimatedString).baseVal.split(' ')[0]
      }
    }

    // 构建事件名称
    const parts = ['click', interactionType, tagName]
    if (className) {
      parts.push(className)
    }

    return parts.join('_')
  }
}

