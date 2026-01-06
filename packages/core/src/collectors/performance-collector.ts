/**
 * 性能收集器
 * @description 收集 Web Vitals 和页面性能指标（FCP, LCP, FID, CLS, TTFB, INP）
 * @packageDocumentation
 */

import {
  CollectorStatus,
  TrackEventType,
  type PerformanceCollectorOptions,
  type PerformanceData,
  type ResourceTiming,
  type TrackEvent,
} from '../types'
import {
  isBrowser,
  supportsPerformanceObserver,
  generateUUID,
  createLogger,
} from '../utils'

/** 默认配置 */
const DEFAULT_OPTIONS: Required<PerformanceCollectorOptions> = {
  autoStart: true,
  debug: false,
  collectWebVitals: true,
  collectResourceTiming: true,
  maxResourceEntries: 50,
  collectLongTasks: true,
  longTaskThreshold: 50,
}

/**
 * 性能收集器类
 * @description 自动收集页面性能指标，包括 Web Vitals
 */
export class PerformanceCollector {
  /** 收集器名称 */
  readonly name = 'performance'

  /** 收集器状态 */
  private _status: CollectorStatus = CollectorStatus.IDLE

  /** 配置选项 */
  private options: Required<PerformanceCollectorOptions>

  /** 事件回调 */
  private onEvent: (event: TrackEvent<PerformanceData>) => void

  /** 日志器 */
  private logger

  /** PerformanceObserver 实例数组 */
  private observers: PerformanceObserver[] = []

  /** 性能数据缓存 */
  private metricsCache: Partial<PerformanceData> = {}

  /** 是否已上报 */
  private reported = false

  /** 上报定时器 */
  private reportTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    onEvent: (event: TrackEvent<PerformanceData>) => void,
    options: PerformanceCollectorOptions = {}
  ) {
    this.onEvent = onEvent
    this.options = { ...DEFAULT_OPTIONS, ...options }
    this.logger = createLogger('[PerformanceCollector]', this.options.debug ? 'debug' : 'warn')

    if (this.options.autoStart) {
      this.install()
    }
  }

  /** 获取收集器状态 */
  get status(): CollectorStatus {
    return this._status
  }

  /**
   * 安装收集器
   */
  install(): void {
    if (!isBrowser()) {
      this.logger.warn('Not in browser environment, skipping installation')
      return
    }

    if (this._status === CollectorStatus.RUNNING) {
      this.logger.warn('Collector is already running')
      return
    }

    this.logger.debug('Installing performance collector')
    this._status = CollectorStatus.RUNNING

    // 收集导航性能数据
    this.collectNavigationTiming()

    // 收集 Web Vitals
    if (this.options.collectWebVitals && supportsPerformanceObserver()) {
      this.observeWebVitals()
    }

    // 收集长任务
    if (this.options.collectLongTasks && supportsPerformanceObserver()) {
      this.observeLongTasks()
    }

    // 收集资源性能
    if (this.options.collectResourceTiming && supportsPerformanceObserver()) {
      this.observeResourceTiming()
    }

    // 页面加载完成后延迟上报
    if (document.readyState === 'complete') {
      this.scheduleReport()
    } else {
      window.addEventListener('load', () => this.scheduleReport())
    }

    this.logger.debug('Performance collector installed')
  }

  /**
   * 卸载收集器
   */
  uninstall(): void {
    if (this._status === CollectorStatus.STOPPED) {
      return
    }

    this.logger.debug('Uninstalling performance collector')

    // 断开所有 Observer
    this.observers.forEach((observer) => {
      try {
        observer.disconnect()
      } catch (e) {
        this.logger.error('Error disconnecting observer:', e)
      }
    })
    this.observers = []

    // 清除定时器
    if (this.reportTimer) {
      clearTimeout(this.reportTimer)
      this.reportTimer = null
    }

    this._status = CollectorStatus.STOPPED
    this.logger.debug('Performance collector uninstalled')
  }

  /**
   * 暂停收集
   */
  pause(): void {
    if (this._status === CollectorStatus.RUNNING) {
      this._status = CollectorStatus.PAUSED
      this.logger.debug('Performance collector paused')
    }
  }

  /**
   * 恢复收集
   */
  resume(): void {
    if (this._status === CollectorStatus.PAUSED) {
      this._status = CollectorStatus.RUNNING
      this.logger.debug('Performance collector resumed')
    }
  }

  /**
   * 收集导航性能数据
   */
  private collectNavigationTiming(): void {
    try {
      const entries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
      if (entries.length > 0) {
        const nav = entries[0]
        
        this.metricsCache.ttfb = Math.round(nav.responseStart - nav.requestStart)
        this.metricsCache.dnsTime = Math.round(nav.domainLookupEnd - nav.domainLookupStart)
        this.metricsCache.tcpTime = Math.round(nav.connectEnd - nav.connectStart)
        this.metricsCache.domLoad = Math.round(nav.domContentLoadedEventEnd - nav.fetchStart)
        this.metricsCache.pageLoad = Math.round(nav.loadEventEnd - nav.fetchStart)

        this.logger.debug('Navigation timing collected:', this.metricsCache)
      }
    } catch (e) {
      this.logger.error('Error collecting navigation timing:', e)
    }
  }

  /**
   * 观察 Web Vitals
   */
  private observeWebVitals(): void {
    // FCP - First Contentful Paint
    this.createObserver('paint', (entries) => {
      for (const entry of entries) {
        if (entry.name === 'first-contentful-paint') {
          this.metricsCache.fcp = Math.round(entry.startTime)
          this.logger.debug('FCP:', this.metricsCache.fcp)
        }
      }
    })

    // LCP - Largest Contentful Paint
    this.createObserver('largest-contentful-paint', (entries) => {
      const lastEntry = entries[entries.length - 1] as PerformanceEntry & { startTime: number }
      if (lastEntry) {
        this.metricsCache.lcp = Math.round(lastEntry.startTime)
        this.logger.debug('LCP:', this.metricsCache.lcp)
      }
    })

    // FID - First Input Delay
    this.createObserver('first-input', (entries) => {
      const firstEntry = entries[0] as PerformanceEventTiming
      if (firstEntry) {
        this.metricsCache.fid = Math.round(firstEntry.processingStart - firstEntry.startTime)
        this.logger.debug('FID:', this.metricsCache.fid)
      }
    })

    // CLS - Cumulative Layout Shift
    let clsValue = 0
    let clsEntries: PerformanceEntry[] = []

    this.createObserver('layout-shift', (entries) => {
      for (const entry of entries as (PerformanceEntry & { hadRecentInput: boolean; value: number })[]) {
        // 只计算非用户输入导致的布局偏移
        if (!entry.hadRecentInput) {
          clsEntries.push(entry)
          clsValue += entry.value
        }
      }
      this.metricsCache.cls = Math.round(clsValue * 1000) / 1000
      this.logger.debug('CLS:', this.metricsCache.cls)
    })

    // INP - Interaction to Next Paint (新指标)
    let maxINP = 0
    this.createObserver('event', (entries) => {
      for (const entry of entries as PerformanceEventTiming[]) {
        // 只关注特定交互类型
        if (['pointerdown', 'pointerup', 'keydown', 'keyup', 'click'].includes(entry.name)) {
          const duration = entry.duration
          if (duration > maxINP) {
            maxINP = duration
            this.metricsCache.inp = Math.round(duration)
            this.logger.debug('INP:', this.metricsCache.inp)
          }
        }
      }
    }, { durationThreshold: 16 })
  }

  /**
   * 观察长任务
   */
  private observeLongTasks(): void {
    this.createObserver('longtask', (entries) => {
      for (const entry of entries) {
        if (entry.duration >= this.options.longTaskThreshold) {
          this.logger.debug('Long task detected:', entry.duration, 'ms')
          // 可以单独上报长任务事件
        }
      }
    })
  }

  /**
   * 观察资源加载性能
   */
  private observeResourceTiming(): void {
    this.createObserver('resource', (entries) => {
      const resources: ResourceTiming[] = []

      for (const entry of entries as PerformanceResourceTiming[]) {
        if (resources.length >= this.options.maxResourceEntries) {
          break
        }

        // 过滤掉 tracker 自身的请求
        if (entry.name.includes('tracker') || entry.name.includes('beacon')) {
          continue
        }

        resources.push({
          name: this.truncateUrl(entry.name),
          type: entry.initiatorType,
          duration: Math.round(entry.duration),
          transferSize: entry.transferSize,
          startTime: Math.round(entry.startTime),
        })
      }

      if (resources.length > 0) {
        this.metricsCache.resources = [
          ...(this.metricsCache.resources || []),
          ...resources,
        ].slice(0, this.options.maxResourceEntries)
      }
    })
  }

  /**
   * 创建 PerformanceObserver
   */
  private createObserver(
    type: string,
    callback: (entries: PerformanceEntry[]) => void,
    options?: { durationThreshold?: number }
  ): void {
    try {
      // 检查是否支持该类型
      if (!PerformanceObserver.supportedEntryTypes?.includes(type)) {
        this.logger.debug(`Entry type "${type}" not supported`)
        return
      }

      const observer = new PerformanceObserver((list) => {
        if (this._status !== CollectorStatus.RUNNING) return
        callback(list.getEntries())
      })

      const observeOptions: PerformanceObserverInit = {
        type,
        buffered: true,
      }

      if (options?.durationThreshold !== undefined) {
        (observeOptions as any).durationThreshold = options.durationThreshold
      }

      observer.observe(observeOptions)
      this.observers.push(observer)
      this.logger.debug(`Observer created for "${type}"`)
    } catch (e) {
      this.logger.debug(`Failed to create observer for "${type}":`, e)
    }
  }

  /**
   * 安排上报
   */
  private scheduleReport(): void {
    // 延迟 3 秒上报，确保收集到足够的数据
    this.reportTimer = setTimeout(() => {
      this.report()
    }, 3000)

    // 页面隐藏时立即上报
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && !this.reported) {
        this.report()
      }
    })

    // 页面卸载前上报
    window.addEventListener('beforeunload', () => {
      if (!this.reported) {
        this.report()
      }
    })
  }

  /**
   * 上报性能数据
   */
  private report(): void {
    if (this.reported || this._status !== CollectorStatus.RUNNING) {
      return
    }

    // 再次收集导航性能（确保数据完整）
    this.collectNavigationTiming()

    // 检查是否有有效数据
    const hasData = Object.keys(this.metricsCache).some(
      (key) => this.metricsCache[key as keyof PerformanceData] !== undefined
    )

    if (!hasData) {
      this.logger.debug('No performance data to report')
      return
    }

    this.reported = true

    const event: TrackEvent<PerformanceData> = {
      id: generateUUID(),
      type: TrackEventType.PERFORMANCE,
      name: 'performance',
      timestamp: Date.now(),
      url: window.location.href,
      pageTitle: document.title,
      sessionId: '',
      data: { ...this.metricsCache },
    }

    this.logger.debug('Reporting performance data:', event.data)
    this.onEvent(event)
  }

  /**
   * 截断 URL（移除查询参数等敏感信息）
   */
  private truncateUrl(url: string): string {
    try {
      const urlObj = new URL(url)
      return `${urlObj.origin}${urlObj.pathname}`
    } catch {
      return url.split('?')[0]
    }
  }

  /**
   * 手动触发性能数据上报
   */
  forceReport(): void {
    this.reported = false
    this.report()
  }

  /**
   * 获取当前收集的性能数据
   */
  getMetrics(): Partial<PerformanceData> {
    return { ...this.metricsCache }
  }
}

/**
 * 创建性能收集器实例
 */
export function createPerformanceCollector(
  onEvent: (event: TrackEvent<PerformanceData>) => void,
  options?: PerformanceCollectorOptions
): PerformanceCollector {
  return new PerformanceCollector(onEvent, options)
}
