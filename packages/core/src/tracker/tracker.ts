/**
 * 追踪管理器
 * @description 统一管理所有收集器和事件上报
 */

import type { TrackEvent, TrackerOptions, DeviceInfo, Collector } from '../types'
import { TrackEventType } from '../types'
import { ClickCollector } from '../collectors/click-collector'
import { ScrollCollector } from '../collectors/scroll-collector'
import { InputCollector } from '../collectors/input-collector'
import { NavigationCollector } from '../collectors/navigation-collector'

/**
 * 追踪管理器
 */
export class Tracker {
  private options: Required<TrackerOptions>
  private collectors: Collector[] = []
  private eventQueue: TrackEvent[] = []
  private sessionId: string
  private flushTimer: ReturnType<typeof setInterval> | null = null
  private deviceInfo: DeviceInfo | null = null

  constructor(options: TrackerOptions = {}) {
    this.options = {
      enabled: options.enabled ?? true,
      appName: options.appName ?? 'LDesignApp',
      userId: options.userId ?? '',
      sampleRate: options.sampleRate ?? 1,
      maxEvents: options.maxEvents ?? 100,
      batchInterval: options.batchInterval ?? 5000,
      batchSize: options.batchSize ?? 10,
      endpoint: options.endpoint ?? '',
      autoPageView: options.autoPageView ?? true,
      autoClick: options.autoClick ?? true,
      autoScroll: options.autoScroll ?? true,
      autoInput: options.autoInput ?? false,
      sensitiveFields: options.sensitiveFields ?? [],
      ignoreSelectors: options.ignoreSelectors ?? [],
      beforeTrack: options.beforeTrack ?? (e => e),
      onTrack: options.onTrack ?? (() => { }),
    }

    this.sessionId = this.generateSessionId()
  }

  /**
   * 初始化追踪器
   */
  install(): void {
    if (!this.options.enabled)
      return

    // 获取设备信息
    this.deviceInfo = this.getDeviceInfo()

    // 初始化收集器
    this.initCollectors()

    // 启动批量发送定时器
    this.startFlushTimer()

    // 监听页面卸载
    window.addEventListener('beforeunload', () => this.flush())
  }

  /**
   * 卸载追踪器
   */
  uninstall(): void {
    // 卸载所有收集器
    this.collectors.forEach(collector => collector.uninstall())
    this.collectors = []

    // 停止定时器
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }

    // 发送剩余事件
    this.flush()
  }

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
      clickCollector.setEventCallback(eventCallback)
      clickCollector.install()
      this.collectors.push(clickCollector)
    }

    // 滚动收集器
    if (this.options.autoScroll) {
      const scrollCollector = new ScrollCollector()
      scrollCollector.setEventCallback(eventCallback)
      scrollCollector.install()
      this.collectors.push(scrollCollector)
    }

    // 输入收集器
    if (this.options.autoInput) {
      const inputCollector = new InputCollector({
        sensitiveFields: this.options.sensitiveFields,
      })
      inputCollector.setEventCallback(eventCallback)
      inputCollector.install()
      this.collectors.push(inputCollector)
    }

    // 导航收集器
    if (this.options.autoPageView) {
      const navigationCollector = new NavigationCollector()
      navigationCollector.setEventCallback(eventCallback)
      navigationCollector.install()
      this.collectors.push(navigationCollector)

      // 触发初始页面浏览
      navigationCollector.trackPageView()
    }
  }

  /**
   * 处理事件
   * @param partialEvent - 部分事件数据
   */
  private handleEvent(partialEvent: Partial<TrackEvent>): void {
    // 采样检查
    if (Math.random() > this.options.sampleRate) {
      return
    }

    // 构建完整事件
    const event: TrackEvent = {
      id: this.generateEventId(),
      type: partialEvent.type ?? TrackEventType.CUSTOM,
      name: partialEvent.name ?? 'unknown',
      timestamp: Date.now(),
      url: partialEvent.url ?? window.location.href,
      pageTitle: partialEvent.pageTitle ?? document.title,
      data: partialEvent.data,
      target: partialEvent.target,
      userId: this.options.userId,
      sessionId: this.sessionId,
      device: this.deviceInfo ?? undefined,
    }

    // 前置处理
    const processedEvent = this.options.beforeTrack(event)
    if (!processedEvent)
      return

    // 添加到队列
    this.eventQueue.push(processedEvent)

    // 回调
    this.options.onTrack(processedEvent)

    // 检查是否需要立即发送
    if (this.eventQueue.length >= this.options.batchSize) {
      this.flush()
    }

    // 限制队列大小
    if (this.eventQueue.length > this.options.maxEvents) {
      this.eventQueue = this.eventQueue.slice(-this.options.maxEvents)
    }
  }

  /**
   * 手动追踪事件
   * @param name - 事件名称
   * @param data - 事件数据
   */
  track(name: string, data?: Record<string, unknown>): void {
    this.handleEvent({
      type: TrackEventType.CUSTOM,
      name,
      data,
    })
  }

  /**
   * 设置用户 ID
   * @param userId - 用户 ID
   */
  setUserId(userId: string): void {
    this.options.userId = userId
  }

  /**
   * 启动批量发送定时器
   */
  private startFlushTimer(): void {
    if (this.flushTimer)
      return

    this.flushTimer = setInterval(() => {
      this.flush()
    }, this.options.batchInterval)
  }

  /**
   * 发送事件队列
   */
  async flush(): Promise<void> {
    if (this.eventQueue.length === 0)
      return

    const events = [...this.eventQueue]
    this.eventQueue = []

    // 如果没有配置 endpoint，只触发回调
    if (!this.options.endpoint) {
      return
    }

    try {
      // 使用 sendBeacon 或 fetch 发送
      const payload = JSON.stringify({
        appName: this.options.appName,
        sessionId: this.sessionId,
        events,
      })

      if (navigator.sendBeacon) {
        navigator.sendBeacon(this.options.endpoint, payload)
      }
      else {
        await fetch(this.options.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        })
      }
    }
    catch (error) {
      // 发送失败，将事件放回队列
      this.eventQueue = [...events, ...this.eventQueue]
      console.error('[Tracker] 发送事件失败:', error)
    }
  }

  /**
   * 生成会话 ID
   * @returns 会话 ID
   */
  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
  }

  /**
   * 生成事件 ID
   * @returns 事件 ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  }

  /**
   * 获取设备信息
   * @returns 设备信息
   */
  private getDeviceInfo(): DeviceInfo {
    return {
      userAgent: navigator.userAgent,
      screenWidth: screen.width,
      screenHeight: screen.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      language: navigator.language,
      platform: navigator.platform,
      isTouchDevice: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    }
  }

  /**
   * 获取事件队列
   * @returns 事件队列
   */
  getEvents(): TrackEvent[] {
    return [...this.eventQueue]
  }

  /**
   * 获取会话 ID
   * @returns 会话 ID
   */
  getSessionId(): string {
    return this.sessionId
  }
}
