/**
 * 导航事件收集器
 * @description 收集页面导航和路由变化
 */

import { TrackEventType } from '../types'
import type { PageViewData } from '../types'
import { BaseCollector } from './base-collector'

/**
 * 导航收集器配置
 */
export interface NavigationCollectorOptions {
  /** 是否监听 hash 变化 */
  hashChange?: boolean
  /** 是否监听 popstate */
  popState?: boolean
  /** 是否监听 pushState/replaceState */
  historyChange?: boolean
}

/**
 * 导航事件收集器
 */
export class NavigationCollector extends BaseCollector {
  name = 'navigation'
  private options: Required<NavigationCollectorOptions>
  private hashChangeHandler: (() => void) | null = null
  private popStateHandler: (() => void) | null = null
  private originalPushState: typeof history.pushState | null = null
  private originalReplaceState: typeof history.replaceState | null = null
  private lastUrl = ''

  constructor(options: NavigationCollectorOptions = {}) {
    super()
    this.options = {
      hashChange: options.hashChange ?? true,
      popState: options.popState ?? true,
      historyChange: options.historyChange ?? true,
    }
  }

  /**
   * 安装收集器
   */
  install(): void {
    if (this.installed)
      return

    this.lastUrl = window.location.href

    // 监听 hashchange
    if (this.options.hashChange) {
      this.hashChangeHandler = () => this.handleNavigation('hashchange')
      window.addEventListener('hashchange', this.hashChangeHandler)
    }

    // 监听 popstate
    if (this.options.popState) {
      this.popStateHandler = () => this.handleNavigation('popstate')
      window.addEventListener('popstate', this.popStateHandler)
    }

    // 拦截 pushState 和 replaceState
    if (this.options.historyChange) {
      this.interceptHistoryMethods()
    }

    this.installed = true
  }

  /**
   * 卸载收集器
   */
  uninstall(): void {
    if (!this.installed)
      return

    if (this.hashChangeHandler) {
      window.removeEventListener('hashchange', this.hashChangeHandler)
      this.hashChangeHandler = null
    }

    if (this.popStateHandler) {
      window.removeEventListener('popstate', this.popStateHandler)
      this.popStateHandler = null
    }

    // 恢复原始方法
    if (this.originalPushState) {
      history.pushState = this.originalPushState
      this.originalPushState = null
    }

    if (this.originalReplaceState) {
      history.replaceState = this.originalReplaceState
      this.originalReplaceState = null
    }

    this.installed = false
  }

  /**
   * 拦截 History API 方法
   */
  private interceptHistoryMethods(): void {
    this.originalPushState = history.pushState.bind(history)
    this.originalReplaceState = history.replaceState.bind(history)

    history.pushState = (...args) => {
      this.originalPushState!(...args)
      this.handleNavigation('pushState')
    }

    history.replaceState = (...args) => {
      this.originalReplaceState!(...args)
      this.handleNavigation('replaceState')
    }
  }

  /**
   * 处理导航事件
   * @param trigger - 触发方式
   */
  private handleNavigation(trigger: string): void {
    const currentUrl = window.location.href

    // 避免重复触发
    if (currentUrl === this.lastUrl) {
      return
    }

    const pageViewData: PageViewData = {
      referrer: this.lastUrl,
      path: window.location.pathname,
      query: this.parseQueryString(window.location.search),
    }

    this.emit({
      type: TrackEventType.PAGE_VIEW,
      name: 'page_view',
      url: currentUrl,
      pageTitle: document.title,
      data: {
        ...pageViewData,
        trigger,
      },
    })

    this.lastUrl = currentUrl
  }

  /**
   * 解析查询字符串
   * @param search - 查询字符串
   * @returns 解析后的对象
   */
  private parseQueryString(search: string): Record<string, string> {
    const params: Record<string, string> = {}
    const searchParams = new URLSearchParams(search)

    searchParams.forEach((value, key) => {
      params[key] = value
    })

    return params
  }

  /**
   * 手动触发页面浏览事件
   */
  trackPageView(): void {
    this.handleNavigation('manual')
  }
}

