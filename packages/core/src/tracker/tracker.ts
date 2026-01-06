/**
 * 追踪管理器
 * @description 统一管理所有收集器和事件上报
 * @packageDocumentation
 */

import type {
  TrackEvent,
  TrackerOptions,
  DeviceInfo,
  Collector,
  ReportResult,
  Logger,
} from '../types'
import {
  TrackEventType,
  EventPriority,
  ReportMethod,
  StorageType,
} from '../types'
import { ClickCollector } from '../collectors/click-collector'
import { ScrollCollector } from '../collectors/scroll-collector'
import { InputCollector } from '../collectors/input-collector'
import { NavigationCollector } from '../collectors/navigation-collector'
import { PerformanceCollector } from '../collectors/performance-collector'
import { ErrorCollector } from '../collectors/error-collector'
import { ExposureCollector } from '../collectors/exposure-collector'
import {
  generateUUID,
  generateSessionId,
  generatePageId,
  createLogger,
  createEventQueue,
  retry,
  isBrowser,
  isOnline,
  getConnectionType,
  shouldSample,
  consistentSample,
  safeStringify,
  safeParse,
  deepMerge,
} from '../utils'

/** 存储键名 */
const STORAGE_KEY = 'ldesign_tracker_events'
const SESSION_KEY = 'ldesign_tracker_session'

/** 默认配置 */
const DEFAULT_OPTIONS: Required<TrackerOptions> = {
  enabled: true,
  appName: 'LDesignApp',
  appVersion: '1.0.0',
  userId: '',
  sessionId: '',
  sampleRate: 1,
  sampling: {
    enabled: false,
    rate: 1,
    rateByType: {},
  },
  maxEvents: 100,
  batchInterval: 5000,
  batchSize: 10,
  endpoint: '',
  reportMethod: ReportMethod.BEACON,
  headers: {},
  autoPageView: true,
  autoClick: true,
  autoScroll: true,
  autoInput: false,
  autoError: true,
  autoPerformance: true,
  sensitiveFields: ['password', 'token', 'secret', 'credit', 'card'],
  ignoreSelectors: ['.no-track', '[data-no-track]'],
  retry: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    useExponentialBackoff: true,
  },
  offline: {
    enabled: true,
    storage: StorageType.LOCAL_STORAGE,
    maxEvents: 500,
    expireTime: 24 * 60 * 60 * 1000, // 24 小时
  },
  globalProperties: {},
  debug: false,
  beforeTrack: (e) => e,
  transformEvent: (e) => e,
  onTrack: () => {},
  onSuccess: () => {},
  onError: () => {},
}

/**
 * 追踪管理器
 * @description 核心追踪器类，管理所有收集器和事件上报
 */
export class Tracker {
  /** 配置选项 */
  private options: Required<TrackerOptions>

  /** 收集器列表 */
  private collectors: Map<string, Collector> = new Map()

  /** 事件队列 */
  private eventQueue = createEventQueue<TrackEvent>(1000)

  /** 会话 ID */
  private sessionId: string

  /** 页面 ID */
  private pageId: string

  /** 定时器 */
  private flushTimer: ReturnType<typeof setInterval> | null = null

  /** 设备信息 */
  private deviceInfo: DeviceInfo | null = null

  /** 日志器 */
  private logger: Logger

  /** 是否已初始化 */
  private initialized = false

  /** 是否正在上报 */
  private isFlushing = false

  /** 已上报的事件 ID 集合（用于去重） */
  private reportedEventIds = new Set<string>()

  /** 页面进入时间 */
  private pageEnterTime: number = Date.now()

  /** 点击计数 */
  private clickCount = 0

  /** 最大滚动深度 */
  private maxScrollDepth = 0

  constructor(options: TrackerOptions = {}) {
    this.options = deepMerge(DEFAULT_OPTIONS, options)
    this.logger = createLogger('[Tracker]', this.options.debug ? 'debug' : 'warn')
    this.sessionId = this.options.sessionId || this.getOrCreateSessionId()
    this.pageId = generatePageId()
  }

  // ===========================================================================
  // 生命周期方法
  // ===========================================================================

  /**
   * 初始化追踪器
   */
  install(): void {
    if (!isBrowser()) {
      this.logger.warn('Not in browser environment, skipping installation')
      return
    }

    if (!this.options.enabled) {
      this.logger.info('Tracker is disabled')
      return
    }

    if (this.initialized) {
      this.logger.warn('Tracker is already initialized')
      return
    }

    this.logger.debug('Installing tracker')

    // 获取设备信息
    this.deviceInfo = this.getDeviceInfo()

    // 加载离线事件
    if (this.options.offline?.enabled) {
      this.loadOfflineEvents()
    }

    // 初始化收集器
    this.initCollectors()

    // 启动批量发送定时器
    this.startFlushTimer()

    // 绑定全局事件
    this.bindGlobalEvents()

    this.initialized = true
    this.logger.info('Tracker installed successfully')
  }

  /**
   * 卸载追踪器
   */
  uninstall(): void {
    if (!this.initialized) {
      return
    }

    this.logger.debug('Uninstalling tracker')

    // 卸载所有收集器
    this.collectors.forEach((collector) => {
      try {
        collector.uninstall()
      } catch (e) {
        this.logger.error('Error uninstalling collector:', collector.name, e)
      }
    })
    this.collectors.clear()

    // 停止定时器
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }

    // 发送剩余事件
    this.flush()

    // 移除全局事件监听
    this.unbindGlobalEvents()

    this.initialized = false
    this.logger.info('Tracker uninstalled')
  }

  // ===========================================================================
  // 收集器管理
  // ===========================================================================

  /**
   * 初始化收集器
   */
  private initCollectors(): void {
    const eventCallback = (event: Partial<TrackEvent>) => this.handleEvent(event)

    // 点击收集器
    if (this.options.autoClick) {
      const clickCollector = new ClickCollector({
        ignoreSelectors: this.options.ignoreSelectors,
      })
      clickCollector.setEventCallback((e) => {
        this.clickCount++
        eventCallback(e)
      })
      clickCollector.install()
      this.collectors.set('click', clickCollector)
    }

    // 滚动收集器
    if (this.options.autoScroll) {
      const scrollCollector = new ScrollCollector()
      scrollCollector.setEventCallback((e) => {
        if (e.data && typeof (e.data as any).scrollDepth === 'number') {
          this.maxScrollDepth = Math.max(this.maxScrollDepth, (e.data as any).scrollDepth)
        }
        eventCallback(e)
      })
      scrollCollector.install()
      this.collectors.set('scroll', scrollCollector)
    }

    // 输入收集器
    if (this.options.autoInput) {
      const inputCollector = new InputCollector({
        sensitiveFields: this.options.sensitiveFields,
      })
      inputCollector.setEventCallback(eventCallback)
      inputCollector.install()
      this.collectors.set('input', inputCollector)
    }

    // 导航收集器
    if (this.options.autoPageView) {
      const navigationCollector = new NavigationCollector()
      navigationCollector.setEventCallback(eventCallback)
      navigationCollector.install()
      this.collectors.set('navigation', navigationCollector)
      navigationCollector.trackPageView()
    }

    // 错误收集器
    if (this.options.autoError) {
      const errorCollector = new ErrorCollector(
        (event) => this.handleEvent(event),
        { debug: this.options.debug }
      )
      this.collectors.set('error', errorCollector as unknown as Collector)
    }

    // 性能收集器
    if (this.options.autoPerformance) {
      const performanceCollector = new PerformanceCollector(
        (event) => this.handleEvent(event),
        { debug: this.options.debug }
      )
      this.collectors.set('performance', performanceCollector as unknown as Collector)
    }

    this.logger.debug('Collectors initialized:', Array.from(this.collectors.keys()))
  }

  /**
   * 获取收集器
   */
  getCollector<T extends Collector>(name: string): T | undefined {
    return this.collectors.get(name) as T | undefined
  }

  /**
   * 注册自定义收集器
   */
  registerCollector(collector: Collector): void {
    if (this.collectors.has(collector.name)) {
      this.logger.warn(`Collector "${collector.name}" already exists, replacing...`)
    }
    this.collectors.set(collector.name, collector)
    if (this.initialized) {
      collector.install()
    }
    this.logger.debug('Collector registered:', collector.name)
  }

  /**
   * 移除收集器
   */
  removeCollector(name: string): void {
    const collector = this.collectors.get(name)
    if (collector) {
      collector.uninstall()
      this.collectors.delete(name)
      this.logger.debug('Collector removed:', name)
    }
  }

  // ===========================================================================
  // 事件处理
  // ===========================================================================

  /**
   * 处理事件
   */
  private handleEvent(partialEvent: Partial<TrackEvent>): void {
    // 采样检查
    if (!this.shouldTrack(partialEvent)) {
      this.logger.debug('Event skipped due to sampling:', partialEvent.name)
      return
    }

    // 构建完整事件
    const event: TrackEvent = {
      id: partialEvent.id || generateUUID(),
      type: partialEvent.type ?? TrackEventType.CUSTOM,
      name: partialEvent.name ?? 'unknown',
      timestamp: partialEvent.timestamp ?? Date.now(),
      url: partialEvent.url ?? window.location.href,
      pageTitle: partialEvent.pageTitle ?? document.title,
      data: partialEvent.data,
      target: partialEvent.target,
      userId: this.options.userId,
      sessionId: this.sessionId,
      pageId: this.pageId,
      device: this.deviceInfo ?? undefined,
      priority: partialEvent.priority ?? EventPriority.NORMAL,
      properties: { ...this.options.globalProperties },
    }

    // 前置处理
    const filteredEvent = this.options.beforeTrack(event)
    if (!filteredEvent) {
      this.logger.debug('Event filtered by beforeTrack:', event.name)
      return
    }

    // 转换处理
    const transformedEvent = this.options.transformEvent(filteredEvent)

    // 去重检查
    if (this.reportedEventIds.has(transformedEvent.id)) {
      this.logger.debug('Duplicate event skipped:', transformedEvent.id)
      return
    }

    // 添加到队列
    if (!this.eventQueue.enqueue(transformedEvent)) {
      this.logger.warn('Event queue is full, dropping oldest events')
      this.eventQueue.dequeue()
      this.eventQueue.enqueue(transformedEvent)
    }

    // 回调
    this.options.onTrack(transformedEvent)

    // 检查是否需要立即发送
    if (
      transformedEvent.priority === EventPriority.IMMEDIATE ||
      this.eventQueue.size >= this.options.batchSize
    ) {
      this.flush()
    }

    this.logger.debug('Event tracked:', transformedEvent.name)
  }

  /**
   * 采样检查
   */
  private shouldTrack(event: Partial<TrackEvent>): boolean {
    const { sampling, sampleRate, userId } = this.options

    // 使用高级采样配置
    if (sampling?.enabled) {
      // 按事件类型采样
      const typeRate = sampling.rateByType?.[event.type as TrackEventType]
      if (typeRate !== undefined) {
        return shouldSample(typeRate)
      }
      // 使用全局采样率
      if (userId) {
        return consistentSample(userId, sampling.rate ?? 1)
      }
      return shouldSample(sampling.rate ?? 1)
    }

    // 使用简化采样率
    return shouldSample(sampleRate)
  }

  /**
   * 手动追踪事件
   */
  track(
    name: string,
    data?: Record<string, unknown>,
    options?: { priority?: EventPriority; type?: TrackEventType }
  ): void {
    this.handleEvent({
      type: options?.type ?? TrackEventType.CUSTOM,
      name,
      data,
      priority: options?.priority,
    })
  }

  /**
   * 追踪页面浏览
   */
  trackPageView(data?: Record<string, unknown>): void {
    this.pageId = generatePageId()
    this.pageEnterTime = Date.now()
    this.clickCount = 0
    this.maxScrollDepth = 0

    this.handleEvent({
      type: TrackEventType.PAGE_VIEW,
      name: 'page_view',
      data: {
        path: window.location.pathname,
        query: Object.fromEntries(new URLSearchParams(window.location.search)),
        hash: window.location.hash,
        referrer: document.referrer,
        ...data,
      },
    })
  }

  /**
   * 追踪页面离开
   */
  trackPageLeave(): void {
    const duration = Date.now() - this.pageEnterTime

    this.handleEvent({
      type: TrackEventType.PAGE_LEAVE,
      name: 'page_leave',
      data: {
        url: window.location.href,
        duration,
        maxScrollDepth: this.maxScrollDepth,
        clickCount: this.clickCount,
      },
      priority: EventPriority.IMMEDIATE,
    })
  }

  // ===========================================================================
  // 数据上报
  // ===========================================================================

  /**
   * 发送事件队列
   */
  async flush(): Promise<ReportResult> {
    if (this.eventQueue.isEmpty || this.isFlushing) {
      return { success: true }
    }

    this.isFlushing = true
    const events = this.eventQueue.dequeueAll()

    // 如果没有配置 endpoint，只触发回调
    if (!this.options.endpoint) {
      this.isFlushing = false
      return { success: true }
    }

    // 离线状态，保存到本地
    if (!isOnline()) {
      this.logger.debug('Offline, saving events locally')
      this.saveOfflineEvents(events)
      this.isFlushing = false
      return { success: false, error: 'Offline' }
    }

    try {
      const result = await this.sendEvents(events)

      if (result.success) {
        // 记录已上报的事件 ID
        events.forEach((e) => {
          this.reportedEventIds.add(e.id)
          // 限制集合大小
          if (this.reportedEventIds.size > 1000) {
            const first = this.reportedEventIds.values().next().value
            if (first) this.reportedEventIds.delete(first)
          }
        })

        this.options.onSuccess(events)
        this.logger.debug('Events sent successfully:', events.length)
      }

      this.isFlushing = false
      return result
    } catch (error) {
      // 发送失败，保存到本地
      this.logger.error('Failed to send events:', error)
      this.saveOfflineEvents(events)
      this.options.onError(error as Error, events)
      this.isFlushing = false
      return { success: false, error: String(error) }
    }
  }

  /**
   * 发送事件
   */
  private async sendEvents(events: TrackEvent[]): Promise<ReportResult> {
    const payload = safeStringify({
      appName: this.options.appName,
      appVersion: this.options.appVersion,
      sessionId: this.sessionId,
      events,
    })

    const sendFn = async (): Promise<void> => {
      switch (this.options.reportMethod) {
        case ReportMethod.BEACON:
          if (!navigator.sendBeacon(this.options.endpoint, payload)) {
            throw new Error('sendBeacon failed')
          }
          break

        case ReportMethod.FETCH:
          const response = await fetch(this.options.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...this.options.headers,
            },
            body: payload,
            keepalive: true,
          })
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`)
          }
          break

        case ReportMethod.XHR:
          await this.sendWithXHR(payload)
          break

        case ReportMethod.IMAGE:
          await this.sendWithImage(payload)
          break
      }
    }

    // 使用重试机制
    await retry(sendFn, {
      maxRetries: this.options.retry?.maxRetries ?? 3,
      baseDelay: this.options.retry?.baseDelay ?? 1000,
      maxDelay: this.options.retry?.maxDelay ?? 30000,
      useExponentialBackoff: this.options.retry?.useExponentialBackoff ?? true,
      onRetry: (error, attempt) => {
        this.logger.warn(`Retry attempt ${attempt}:`, error.message)
      },
    })

    return { success: true, sentAt: Date.now() }
  }

  /**
   * 使用 XHR 发送
   */
  private sendWithXHR(payload: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', this.options.endpoint, true)
      xhr.setRequestHeader('Content-Type', 'application/json')
      Object.entries(this.options.headers).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value)
      })
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve()
        } else {
          reject(new Error(`HTTP ${xhr.status}`))
        }
      }
      xhr.onerror = () => reject(new Error('XHR failed'))
      xhr.send(payload)
    })
  }

  /**
   * 使用 Image 发送
   */
  private sendWithImage(payload: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const encodedPayload = encodeURIComponent(payload)
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Image failed'))
      img.src = `${this.options.endpoint}?data=${encodedPayload}&t=${Date.now()}`
    })
  }

  // ===========================================================================
  // 离线存储
  // ===========================================================================

  /**
   * 保存离线事件
   */
  private saveOfflineEvents(events: TrackEvent[]): void {
    if (!this.options.offline?.enabled) return

    try {
      const existing = this.loadStoredEvents()
      const combined = [...existing, ...events].slice(-this.options.offline.maxEvents!)
      localStorage.setItem(STORAGE_KEY, safeStringify(combined))
      this.logger.debug('Saved', events.length, 'events offline')
    } catch (e) {
      this.logger.error('Failed to save offline events:', e)
    }
  }

  /**
   * 加载离线事件
   */
  private loadOfflineEvents(): void {
    if (!this.options.offline?.enabled) return

    try {
      const events = this.loadStoredEvents()
      if (events.length > 0) {
        // 过滤过期事件
        const now = Date.now()
        const validEvents = events.filter(
          (e) => now - e.timestamp < this.options.offline!.expireTime!
        )

        if (validEvents.length > 0) {
          this.eventQueue.enqueueAll(validEvents)
          this.logger.info('Loaded', validEvents.length, 'offline events')
        }

        // 清除存储
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch (e) {
      this.logger.error('Failed to load offline events:', e)
    }
  }

  /**
   * 加载存储的事件
   */
  private loadStoredEvents(): TrackEvent[] {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? safeParse<TrackEvent[]>(data, []) : []
  }

  // ===========================================================================
  // 辅助方法
  // ===========================================================================

  /**
   * 获取或创建会话 ID
   */
  private getOrCreateSessionId(): string {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY)
      if (stored) {
        return stored
      }
      const newSessionId = generateSessionId()
      sessionStorage.setItem(SESSION_KEY, newSessionId)
      return newSessionId
    } catch {
      return generateSessionId()
    }
  }

  /**
   * 获取设备信息
   */
  private getDeviceInfo(): DeviceInfo {
    return {
      userAgent: navigator.userAgent,
      screenWidth: screen.width,
      screenHeight: screen.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      platform: navigator.platform,
      isTouchDevice: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      isMobile: /Mobile|Android|iPhone/i.test(navigator.userAgent),
      connectionType: getConnectionType(),
    }
  }

  /**
   * 启动批量发送定时器
   */
  private startFlushTimer(): void {
    if (this.flushTimer) return

    this.flushTimer = setInterval(() => {
      this.flush()
    }, this.options.batchInterval)
  }

  /**
   * 绑定全局事件
   */
  private bindGlobalEvents(): void {
    window.addEventListener('beforeunload', this.handleBeforeUnload)
    window.addEventListener('pagehide', this.handlePageHide)
    document.addEventListener('visibilitychange', this.handleVisibilityChange)
    window.addEventListener('online', this.handleOnline)
  }

  /**
   * 解绑全局事件
   */
  private unbindGlobalEvents(): void {
    window.removeEventListener('beforeunload', this.handleBeforeUnload)
    window.removeEventListener('pagehide', this.handlePageHide)
    document.removeEventListener('visibilitychange', this.handleVisibilityChange)
    window.removeEventListener('online', this.handleOnline)
  }

  /** 页面即将卸载 */
  private handleBeforeUnload = (): void => {
    this.trackPageLeave()
    this.flush()
  }

  /** 页面隐藏 */
  private handlePageHide = (): void => {
    this.flush()
  }

  /** 页面可见性变化 */
  private handleVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      this.flush()
    }
  }

  /** 网络恢复 */
  private handleOnline = (): void => {
    this.logger.info('Network restored, flushing events')
    this.flush()
  }

  // ===========================================================================
  // 公开 API
  // ===========================================================================

  /**
   * 设置用户 ID
   */
  setUserId(userId: string): void {
    this.options.userId = userId
    this.logger.debug('User ID set:', userId)
  }

  /**
   * 设置全局属性
   */
  setGlobalProperties(properties: Record<string, unknown>): void {
    this.options.globalProperties = {
      ...this.options.globalProperties,
      ...properties,
    }
    this.logger.debug('Global properties updated')
  }

  /**
   * 获取事件队列
   */
  getEvents(): TrackEvent[] {
    return this.eventQueue.toArray()
  }

  /**
   * 获取会话 ID
   */
  getSessionId(): string {
    return this.sessionId
  }

  /**
   * 获取页面 ID
   */
  getPageId(): string {
    return this.pageId
  }

  /**
   * 获取设备信息
   */
  getDeviceInfoCached(): DeviceInfo | null {
    return this.deviceInfo
  }

  /**
   * 是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized
  }

  /**
   * 更新配置
   */
  updateOptions(options: Partial<TrackerOptions>): void {
    this.options = deepMerge(this.options, options)
    this.logger.debug('Options updated')
  }
}

/**
 * 创建 Tracker 实例
 */
export function createTracker(options?: TrackerOptions): Tracker {
  return new Tracker(options)
}
