/**
 * 导航事件收集器
 * @description 收集页面导航和路由变化，包含 Vue Router 信息
 */

import { TrackEventType } from '../types'
import type { PageViewData, RouteInfo } from '../types'
import { BaseCollector } from './base-collector'
import { getCurrentRouteInfo, getVueRouter } from '../utils'

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
  /** 是否尝试集成 Vue Router */
  vueRouter?: boolean
  /** 是否记录页面加载时间 */
  trackLoadTime?: boolean
}

/**
 * 增强的页面浏览数据
 */
export interface EnhancedPageViewData extends PageViewData {
  /** 触发方式 */
  trigger: string
  /** 路由名称 (Vue Router) */
  routeName?: string
  /** 路由参数 (Vue Router) */
  routeParams?: Record<string, string>
  /** 路由元信息 (Vue Router) */
  routeMeta?: Record<string, unknown>
  /** 匹配的路由组件 */
  matchedComponents?: string[]
  /** 页面组件文件 */
  componentFile?: string
  /** 导航类型 */
  navigationType?: 'navigate' | 'reload' | 'back_forward' | 'prerender'
  /** 前一页面路由名称 */
  fromRouteName?: string
  /** 前一页面路径 */
  fromPath?: string
  /** 页面加载时间 (ms) */
  loadTime?: number
  /** 是否首次访问 */
  isFirstVisit?: boolean
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
  private lastRouteInfo: RouteInfo | null = null
  private pageLoadTime = Date.now()
  private isFirstPageView = true
  private vueRouterUnwatch: (() => void) | null = null

  constructor(options: NavigationCollectorOptions = {}) {
    super()
    this.options = {
      hashChange: options.hashChange ?? true,
      popState: options.popState ?? true,
      historyChange: options.historyChange ?? true,
      vueRouter: options.vueRouter ?? true,
      trackLoadTime: options.trackLoadTime ?? true,
    }
  }

  /**
   * 安装收集器
   */
  install(): void {
    if (this.installed)
      return

    this.lastUrl = window.location.href
    this.pageLoadTime = Date.now()

    // 尝试集成 Vue Router
    if (this.options.vueRouter) {
      this.setupVueRouterIntegration()
    }

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

    // 移除 Vue Router 监听
    if (this.vueRouterUnwatch) {
      this.vueRouterUnwatch()
      this.vueRouterUnwatch = null
    }

    this.installed = false
  }

  /**
   * 设置 Vue Router 集成
   */
  private setupVueRouterIntegration(): void {
    // 延迟执行，等待 Vue 应用初始化
    setTimeout(() => {
      const router = getVueRouter()
      if (router && (router as any).afterEach) {
        // 使用 Vue Router 的 afterEach 钩子
        this.vueRouterUnwatch = (router as any).afterEach(
          (to: any, from: any) => {
            this.handleVueRouterNavigation(to, from)
          }
        )
      }
    }, 100)
  }

  /**
   * 处理 Vue Router 导航
   */
  private handleVueRouterNavigation(to: any, from: any): void {
    const currentUrl = window.location.href

    // 避免重复触发
    if (currentUrl === this.lastUrl) {
      return
    }

    const routeInfo = getCurrentRouteInfo()

    const pageViewData: EnhancedPageViewData = {
      referrer: from?.fullPath || this.lastUrl,
      path: to.path,
      query: to.query,
      hash: to.hash,
      trigger: 'vue-router',

      // Vue Router 特有信息
      routeName: to.name || undefined,
      routeParams: to.params,
      routeMeta: to.meta,
      matchedComponents: to.matched?.map((m: any) => m.name || m.path).filter(Boolean),
      componentFile: routeInfo?.componentFile,

      // 前一页面信息
      fromRouteName: from?.name || undefined,
      fromPath: from?.path,

      // 页面加载信息
      isFirstVisit: this.isFirstPageView,
    }

    // 记录页面加载时间
    if (this.options.trackLoadTime && this.isFirstPageView) {
      pageViewData.loadTime = Date.now() - this.pageLoadTime
    }

    this.emit({
      type: TrackEventType.PAGE_VIEW,
      name: this.getPageViewName(to),
      url: currentUrl,
      pageTitle: document.title,
      data: pageViewData as unknown as Record<string, unknown>,
      route: routeInfo || undefined,
    })

    this.lastUrl = currentUrl
    this.lastRouteInfo = routeInfo || null
    this.isFirstPageView = false
  }

  /**
   * 拦截 History API 方法
   */
  private interceptHistoryMethods(): void {
    this.originalPushState = history.pushState.bind(history)
    this.originalReplaceState = history.replaceState.bind(history)

    history.pushState = (...args) => {
      this.originalPushState!(...args)
      // 延迟触发，等待 URL 更新
      setTimeout(() => this.handleNavigation('pushState'), 0)
    }

    history.replaceState = (...args) => {
      this.originalReplaceState!(...args)
      setTimeout(() => this.handleNavigation('replaceState'), 0)
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

    // 获取 Vue Router 信息
    const routeInfo = getCurrentRouteInfo()

    const pageViewData: EnhancedPageViewData = {
      referrer: this.lastUrl,
      path: window.location.pathname,
      query: this.parseQueryString(window.location.search),
      hash: window.location.hash || undefined,
      trigger,

      // 尝试获取 Vue Router 信息
      routeName: routeInfo?.name,
      routeParams: routeInfo?.params,
      routeMeta: routeInfo?.meta,
      matchedComponents: routeInfo?.matched,
      componentFile: routeInfo?.componentFile,

      // 前一页面信息
      fromRouteName: this.lastRouteInfo?.name,
      fromPath: this.lastRouteInfo?.path,

      // 导航类型
      navigationType: this.getNavigationType(),

      // 页面加载信息
      isFirstVisit: this.isFirstPageView,
    }

    // 记录页面加载时间
    if (this.options.trackLoadTime && this.isFirstPageView) {
      pageViewData.loadTime = Date.now() - this.pageLoadTime
    }

    this.emit({
      type: TrackEventType.PAGE_VIEW,
      name: this.getPageViewName(routeInfo),
      url: currentUrl,
      pageTitle: document.title,
      data: pageViewData as unknown as Record<string, unknown>,
      route: routeInfo || undefined,
    })

    this.lastUrl = currentUrl
    this.lastRouteInfo = routeInfo || null
    this.isFirstPageView = false
  }

  /**
   * 获取导航类型
   */
  private getNavigationType(): 'navigate' | 'reload' | 'back_forward' | 'prerender' {
    if (typeof performance !== 'undefined' && performance.getEntriesByType) {
      const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
      if (navEntries.length > 0) {
        return navEntries[0].type as any
      }
    }

    // 回退到 navigation.type
    if (typeof performance !== 'undefined' && (performance as any).navigation) {
      const type = (performance as any).navigation.type
      switch (type) {
        case 0:
          return 'navigate'
        case 1:
          return 'reload'
        case 2:
          return 'back_forward'
      }
    }

    return 'navigate'
  }

  /**
   * 获取页面浏览事件名称
   */
  private getPageViewName(routeInfo: RouteInfo | any | null): string {
    // 优先使用路由名称
    if (routeInfo?.name) {
      return `page_view_${routeInfo.name}`
    }

    // 使用路径
    const path = routeInfo?.path || window.location.pathname
    const pathName = path.replace(/\//g, '_').replace(/^_/, '') || 'home'
    return `page_view_${pathName}`
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

    return Object.keys(params).length > 0 ? params : {}
  }

  /**
   * 手动触发页面浏览事件
   */
  trackPageView(): void {
    // 强制触发，不检查 URL 变化
    const previousLastUrl = this.lastUrl
    this.lastUrl = '' // 重置以确保触发
    this.handleNavigation('manual')
    if (this.lastUrl === '') {
      this.lastUrl = previousLastUrl
    }
  }

  /**
   * 获取当前路由信息
   */
  getCurrentRoute(): RouteInfo | null {
    return getCurrentRouteInfo() || null
  }
}

