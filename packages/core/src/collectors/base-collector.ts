/**
 * 收集器基类
 * @description 提供收集器的基础功能
 */

import type { Collector, TrackEvent, ElementInfo, LinkInfo, FormElementInfo } from '../types'
import {
  getVueComponentInfo,
  getRegionInfo,
  getElementDepth,
  getInteractionType,
  getCSSPath,
  getCurrentRouteInfo,
  getComponentContext,
  getPageContext,
  getPageComponent,
} from '../utils'

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
    // 自动添加路由、组件上下文和页面上下文信息
    const enhancedEvent = { ...event }

    // 添加路由信息
    if (!enhancedEvent.route) {
      enhancedEvent.route = getCurrentRouteInfo()
    }

    // 添加页面上下文 (包含当前页面的 Vue 文件路径)
    if (!enhancedEvent.page) {
      enhancedEvent.page = getPageContext()
    }

    // 如果有目标元素，添加组件上下文
    if (enhancedEvent.target && !enhancedEvent.componentContext) {
      // 获取页面组件信息
      const pageComponent = getPageComponent()

      // 从 target 获取元素信息来构建组件上下文
      if (enhancedEvent.target.component) {
        enhancedEvent.componentContext = {
          name: enhancedEvent.target.component.name,
          file: enhancedEvent.target.component.file,
          chain: enhancedEvent.target.component.chain,
          parent: enhancedEvent.target.component.parentName,
          pageComponent: pageComponent?.name,
          pageComponentFile: pageComponent?.file,
        }
      } else if (pageComponent) {
        // 即使没有组件信息，也添加页面组件信息
        enhancedEvent.componentContext = {
          pageComponent: pageComponent.name,
          pageComponentFile: pageComponent.file,
        }
      }
    }

    this.onEvent?.(enhancedEvent)
  }

  /**
   * 获取元素信息 (增强版)
   * @param element - DOM 元素
   * @returns 元素信息
   */
  protected getElementInfo(element: Element): ElementInfo {
    const rect = element.getBoundingClientRect()
    const tagName = element.tagName.toLowerCase()

    // 基础信息
    const info: ElementInfo = {
      tagName,
      id: element.id || undefined,
      className: this.getClassName(element),
      text: this.getElementText(element),
      xpath: this.getXPath(element),
      cssPath: getCSSPath(element),
      position: {
        x: Math.round(rect.left + rect.width / 2),
        y: Math.round(rect.top + rect.height / 2),
      },
      rect: {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        top: Math.round(rect.top),
        left: Math.round(rect.left),
      },
      attributes: this.getTrackAttributes(element),
      trackData: this.getTrackData(element),
      depth: getElementDepth(element),
      role: this.getElementRole(element),
      ariaLabel: element.getAttribute('aria-label') || undefined,
    }

    // 父元素信息
    if (element.parentElement) {
      info.parent = {
        tagName: element.parentElement.tagName.toLowerCase(),
        id: element.parentElement.id || undefined,
        className: this.getClassName(element.parentElement),
      }
    }

    // Vue 组件信息
    const componentInfo = getVueComponentInfo(element)
    if (componentInfo) {
      info.component = componentInfo
    }

    // 链接信息
    if (tagName === 'a') {
      info.link = this.getLinkInfo(element as HTMLAnchorElement)
    }

    // 表单元素信息
    if (this.isFormElement(element)) {
      info.form = this.getFormElementInfo(element)
    }

    // 区域信息
    const region = getRegionInfo(element)
    if (region) {
      info.region = region
    }

    return info
  }

  /**
   * 安全获取元素 className
   * @param element - DOM 元素
   * @returns className 字符串
   */
  protected getClassName(element: Element): string | undefined {
    if (!element.className) return undefined

    // SVG 元素的 className 是 SVGAnimatedString 对象
    if (typeof element.className === 'string') {
      return element.className || undefined
    } else if ((element.className as SVGAnimatedString)?.baseVal) {
      return (element.className as SVGAnimatedString).baseVal || undefined
    }

    return undefined
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

    // 对于输入元素，获取 placeholder 或 value 类型
    if (element.tagName === 'INPUT') {
      const input = element as HTMLInputElement
      if (input.type === 'submit' || input.type === 'button') {
        return input.value || undefined
      }
      return input.placeholder || undefined
    }

    if (element.tagName === 'BUTTON') {
      const text = element.textContent?.trim()
      return text && text.length <= 50 ? text : undefined
    }

    // 对于链接，获取文本或 title
    if (element.tagName === 'A') {
      const text = element.textContent?.trim()
      if (text && text.length <= 100) return text
      return (element as HTMLAnchorElement).title || undefined
    }

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
    // 如果有 ID，直接使用
    if (element.id) {
      return `//*[@id="${element.id}"]`
    }

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
   * 获取追踪属性 (data-track-* 属性，排除 text)
   * @param element - DOM 元素
   * @returns 追踪属性
   */
  protected getTrackAttributes(element: Element): Record<string, string> | undefined {
    const attrs: Record<string, string> = {}
    const attributes = element.attributes

    for (let i = 0; i < attributes.length; i++) {
      const attr = attributes[i]
      if (attr.name.startsWith('data-track-') && attr.name !== 'data-track-text') {
        const key = attr.name.replace('data-track-', '')
        attrs[key] = attr.value
      }
    }

    return Object.keys(attrs).length > 0 ? attrs : undefined
  }

  /**
   * 获取 data-* 追踪数据
   * @param element - DOM 元素
   * @returns 追踪数据
   */
  protected getTrackData(element: Element): Record<string, string> | undefined {
    const data: Record<string, string> = {}

    // 获取所有 data-* 属性 (排除 data-track-* 和 data-v-*)
    const attributes = element.attributes
    for (let i = 0; i < attributes.length; i++) {
      const attr = attributes[i]
      if (
        attr.name.startsWith('data-') &&
        !attr.name.startsWith('data-track-') &&
        !attr.name.startsWith('data-v-')
      ) {
        const key = attr.name.replace('data-', '')
        data[key] = attr.value
      }
    }

    return Object.keys(data).length > 0 ? data : undefined
  }

  /**
   * 获取元素角色
   * @param element - DOM 元素
   * @returns 角色
   */
  protected getElementRole(element: Element): string | undefined {
    // 优先使用 role 属性
    const role = element.getAttribute('role')
    if (role) return role

    // 根据标签推断
    const tagName = element.tagName.toLowerCase()
    const roleMap: Record<string, string> = {
      a: 'link',
      button: 'button',
      input: 'input',
      select: 'listbox',
      textarea: 'textbox',
      img: 'img',
      nav: 'navigation',
      main: 'main',
      header: 'banner',
      footer: 'contentinfo',
      aside: 'complementary',
      form: 'form',
      table: 'table',
      dialog: 'dialog',
    }

    return roleMap[tagName]
  }

  /**
   * 获取链接信息
   * @param element - 链接元素
   * @returns 链接信息
   */
  protected getLinkInfo(element: HTMLAnchorElement): LinkInfo {
    const href = element.href
    const target = element.target || undefined

    // 判断链接类型
    let type: string = 'anchor'
    if (href) {
      if (href.startsWith('mailto:')) type = 'mailto'
      else if (href.startsWith('tel:')) type = 'tel'
      else if (element.hasAttribute('download')) type = 'download'
      else if (href.startsWith('#')) type = 'hash'
    }

    // 判断是否外部链接
    let isExternal = false
    if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
      try {
        const url = new URL(href, window.location.origin)
        isExternal = url.origin !== window.location.origin
      } catch {
        // 忽略无效 URL
      }
    }

    return {
      href: href || undefined,
      target,
      isExternal,
      type,
    }
  }

  /**
   * 检查是否为表单元素
   * @param element - DOM 元素
   * @returns 是否为表单元素
   */
  protected isFormElement(element: Element): boolean {
    const formTags = ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON']
    return formTags.includes(element.tagName)
  }

  /**
   * 获取表单元素信息
   * @param element - 表单元素
   * @returns 表单元素信息
   */
  protected getFormElementInfo(element: Element): FormElementInfo {
    const form = (element as HTMLInputElement).form
    const info: FormElementInfo = {}

    // 表单信息
    if (form) {
      info.formName = form.name || undefined
      info.formId = form.id || undefined
      info.formAction = form.action || undefined
    }

    // 字段信息
    if (element.tagName === 'INPUT') {
      const input = element as HTMLInputElement
      info.fieldName = input.name || undefined
      info.fieldType = input.type || undefined
      info.placeholder = input.placeholder || undefined
      info.required = input.required || undefined
      info.disabled = input.disabled || undefined
    } else if (element.tagName === 'SELECT') {
      const select = element as HTMLSelectElement
      info.fieldName = select.name || undefined
      info.fieldType = 'select'
      info.required = select.required || undefined
      info.disabled = select.disabled || undefined
    } else if (element.tagName === 'TEXTAREA') {
      const textarea = element as HTMLTextAreaElement
      info.fieldName = textarea.name || undefined
      info.fieldType = 'textarea'
      info.placeholder = textarea.placeholder || undefined
      info.required = textarea.required || undefined
      info.disabled = textarea.disabled || undefined
    } else if (element.tagName === 'BUTTON') {
      const button = element as HTMLButtonElement
      info.fieldName = button.name || undefined
      info.fieldType = button.type || 'button'
      info.disabled = button.disabled || undefined
    }

    return info
  }
}

