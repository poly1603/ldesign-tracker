/**
 * 收集器基类
 * @description 提供收集器的基础功能
 */

import type { Collector, TrackEvent, ElementInfo } from '../types'

/**
 * 收集器基类
 */
export abstract class BaseCollector implements Collector {
  /** 收集器名称 */
  abstract name: string
  /** 是否已安装 */
  protected installed = false
  /** 事件回调 */
  protected onEvent?: (event: Partial<TrackEvent>) => void

  /**
   * 设置事件回调
   * @param callback - 事件回调函数
   */
  setEventCallback(callback: (event: Partial<TrackEvent>) => void): void {
    this.onEvent = callback
  }

  /**
   * 安装收集器
   */
  abstract install(): void

  /**
   * 卸载收集器
   */
  abstract uninstall(): void

  /**
   * 触发事件
   * @param event - 事件数据
   */
  protected emit(event: Partial<TrackEvent>): void {
    this.onEvent?.(event)
  }

  /**
   * 获取元素信息
   * @param element - DOM 元素
   * @returns 元素信息
   */
  protected getElementInfo(element: Element): ElementInfo {
    const rect = element.getBoundingClientRect()

    return {
      tagName: element.tagName.toLowerCase(),
      id: element.id || undefined,
      className: element.className || undefined,
      text: this.getElementText(element),
      xpath: this.getXPath(element),
      position: {
        x: Math.round(rect.left + rect.width / 2),
        y: Math.round(rect.top + rect.height / 2),
      },
      attributes: this.getTrackAttributes(element),
    }
  }

  /**
   * 获取元素文本
   * @param element - DOM 元素
   * @returns 文本内容
   */
  protected getElementText(element: Element): string | undefined {
    // 优先获取 data-track-text 属性
    const trackText = element.getAttribute('data-track-text')
    if (trackText)
      return trackText

    // 获取直接文本内容
    const text = element.textContent?.trim()
    if (text && text.length <= 100) {
      return text
    }

    // 截断过长文本
    if (text && text.length > 100) {
      return `${text.slice(0, 100)}...`
    }

    return undefined
  }

  /**
   * 获取元素 XPath
   * @param element - DOM 元素
   * @returns XPath 字符串
   */
  protected getXPath(element: Element): string {
    const parts: string[] = []
    let current: Element | null = element

    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let index = 0
      let sibling: Element | null = current.previousElementSibling

      while (sibling) {
        if (sibling.tagName === current.tagName) {
          index++
        }
        sibling = sibling.previousElementSibling
      }

      const tagName = current.tagName.toLowerCase()
      const part = index > 0 ? `${tagName}[${index + 1}]` : tagName
      parts.unshift(part)

      current = current.parentElement
    }

    return `/${parts.join('/')}`
  }

  /**
   * 获取追踪属性
   * @param element - DOM 元素
   * @returns 追踪属性
   */
  protected getTrackAttributes(element: Element): Record<string, string> {
    const attrs: Record<string, string> = {}
    const attributes = element.attributes

    for (let i = 0; i < attributes.length; i++) {
      const attr = attributes[i]
      if (attr.name.startsWith('data-track-')) {
        const key = attr.name.replace('data-track-', '')
        attrs[key] = attr.value
      }
    }

    return Object.keys(attrs).length > 0 ? attrs : {}
  }
}

