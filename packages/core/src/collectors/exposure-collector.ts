/**
 * 曝光收集器
 * @description 使用 IntersectionObserver 追踪元素曝光
 * @packageDocumentation
 */

import {
  CollectorStatus,
  TrackEventType,
  type ExposureCollectorOptions,
  type ExposureData,
  type ElementInfo,
  type TrackEvent,
} from '../types'
import {
  isBrowser,
  supportsIntersectionObserver,
  generateUUID,
  createLogger,
  truncate,
  getXPath,
} from '../utils'

/** 默认配置 */
const DEFAULT_OPTIONS: Required<ExposureCollectorOptions> = {
  autoStart: true,
  debug: false,
  threshold: 0.5,
  minDuration: 1000,
  triggerOnce: true,
  selectors: ['[data-track-exposure]'],
  dataAttribute: 'data-track-exposure',
}

/** 曝光元素状态 */
interface ExposureState {
  /** 元素 */
  element: Element
  /** 开始曝光时间 */
  startTime: number | null
  /** 是否已曝光 */
  exposed: boolean
  /** 曝光 ID */
  exposureId: string
  /** 累计曝光时长 */
  totalDuration: number
}

/**
 * 曝光收集器类
 * @description 自动收集元素曝光事件
 */
export class ExposureCollector {
  /** 收集器名称 */
  readonly name = 'exposure'

  /** 收集器状态 */
  private _status: CollectorStatus = CollectorStatus.IDLE

  /** 配置选项 */
  private options: Required<ExposureCollectorOptions>

  /** 事件回调 */
  private onEvent: (event: TrackEvent<ExposureData>) => void

  /** 日志器 */
  private logger

  /** IntersectionObserver 实例 */
  private observer: IntersectionObserver | null = null

  /** MutationObserver 实例（用于监听 DOM 变化） */
  private mutationObserver: MutationObserver | null = null

  /** 元素曝光状态映射 */
  private exposureStates = new Map<Element, ExposureState>()

  /** 已上报的曝光 ID 集合 */
  private reportedExposures = new Set<string>()

  /** 定时器（用于检查曝光时长） */
  private checkTimer: ReturnType<typeof setInterval> | null = null

  constructor(
    onEvent: (event: TrackEvent<ExposureData>) => void,
    options: ExposureCollectorOptions = {}
  ) {
    this.onEvent = onEvent
    this.options = { ...DEFAULT_OPTIONS, ...options }
    this.logger = createLogger('[ExposureCollector]', this.options.debug ? 'debug' : 'warn')

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

    if (!supportsIntersectionObserver()) {
      this.logger.warn('IntersectionObserver not supported')
      return
    }

    if (this._status === CollectorStatus.RUNNING) {
      this.logger.warn('Collector is already running')
      return
    }

    this.logger.debug('Installing exposure collector')
    this._status = CollectorStatus.RUNNING

    // 创建 IntersectionObserver
    this.createObserver()

    // 开始观察现有元素
    this.observeExistingElements()

    // 监听 DOM 变化以观察新元素
    this.observeDOMChanges()

    // 定期检查曝光时长
    this.startDurationCheck()

    // 监听页面可见性变化
    document.addEventListener('visibilitychange', this.handleVisibilityChange)

    this.logger.debug('Exposure collector installed')
  }

  /**
   * 卸载收集器
   */
  uninstall(): void {
    if (this._status === CollectorStatus.STOPPED) {
      return
    }

    this.logger.debug('Uninstalling exposure collector')

    // 断开 IntersectionObserver
    if (this.observer) {
      this.observer.disconnect()
      this.observer = null
    }

    // 断开 MutationObserver
    if (this.mutationObserver) {
      this.mutationObserver.disconnect()
      this.mutationObserver = null
    }

    // 停止定时检查
    if (this.checkTimer) {
      clearInterval(this.checkTimer)
      this.checkTimer = null
    }

    // 移除事件监听
    document.removeEventListener('visibilitychange', this.handleVisibilityChange)

    // 清空状态
    this.exposureStates.clear()
    this.reportedExposures.clear()

    this._status = CollectorStatus.STOPPED
    this.logger.debug('Exposure collector uninstalled')
  }

  /**
   * 暂停收集
   */
  pause(): void {
    if (this._status === CollectorStatus.RUNNING) {
      this._status = CollectorStatus.PAUSED
      // 暂停所有正在曝光的元素计时
      this.exposureStates.forEach((state) => {
        if (state.startTime !== null) {
          state.totalDuration += Date.now() - state.startTime
          state.startTime = null
        }
      })
      this.logger.debug('Exposure collector paused')
    }
  }

  /**
   * 恢复收集
   */
  resume(): void {
    if (this._status === CollectorStatus.PAUSED) {
      this._status = CollectorStatus.RUNNING
      this.logger.debug('Exposure collector resumed')
    }
  }

  /**
   * 创建 IntersectionObserver
   */
  private createObserver(): void {
    const threshold = Array.isArray(this.options.threshold)
      ? this.options.threshold
      : [this.options.threshold]

    this.observer = new IntersectionObserver(
      this.handleIntersection.bind(this),
      {
        root: null,
        rootMargin: '0px',
        threshold,
      }
    )
  }

  /**
   * 处理交叉变化
   */
  private handleIntersection(entries: IntersectionObserverEntry[]): void {
    if (this._status !== CollectorStatus.RUNNING) return

    const now = Date.now()
    const threshold = Array.isArray(this.options.threshold)
      ? Math.min(...this.options.threshold)
      : this.options.threshold

    for (const entry of entries) {
      const element = entry.target
      let state = this.exposureStates.get(element)

      if (!state) {
        state = {
          element,
          startTime: null,
          exposed: false,
          exposureId: this.getExposureId(element),
          totalDuration: 0,
        }
        this.exposureStates.set(element, state)
      }

      if (entry.isIntersecting && entry.intersectionRatio >= threshold) {
        // 元素进入视口
        if (state.startTime === null) {
          state.startTime = now
          this.logger.debug('Element entered viewport:', state.exposureId)
        }
      } else {
        // 元素离开视口
        if (state.startTime !== null) {
          state.totalDuration += now - state.startTime
          state.startTime = null
          this.logger.debug('Element left viewport:', state.exposureId, 'duration:', state.totalDuration)

          // 检查是否达到最小曝光时长
          this.checkAndReport(state, entry.intersectionRatio)
        }
      }
    }
  }

  /**
   * 检查并上报曝光
   */
  private checkAndReport(state: ExposureState, intersectionRatio: number): void {
    // 已经上报过且配置为只触发一次
    if (state.exposed && this.options.triggerOnce) {
      return
    }

    // 已经上报过的曝光 ID
    if (this.reportedExposures.has(state.exposureId) && this.options.triggerOnce) {
      return
    }

    // 检查是否达到最小曝光时长
    if (state.totalDuration < this.options.minDuration) {
      return
    }

    // 标记为已曝光
    state.exposed = true
    this.reportedExposures.add(state.exposureId)

    // 上报曝光事件
    this.reportExposure(state, intersectionRatio)
  }

  /**
   * 上报曝光事件
   */
  private reportExposure(state: ExposureState, intersectionRatio: number): void {
    const elementInfo = this.getElementInfo(state.element)

    const event: TrackEvent<ExposureData> = {
      id: generateUUID(),
      type: TrackEventType.EXPOSURE,
      name: 'exposure',
      timestamp: Date.now(),
      url: window.location.href,
      pageTitle: document.title,
      sessionId: '',
      data: {
        element: elementInfo,
        intersectionRatio,
        duration: state.totalDuration,
        isFirstExposure: !this.reportedExposures.has(state.exposureId),
        exposureId: state.exposureId,
      },
    }

    this.logger.debug('Reporting exposure:', state.exposureId, 'duration:', state.totalDuration)
    this.onEvent(event)
  }

  /**
   * 获取曝光 ID
   */
  private getExposureId(element: Element): string {
    // 优先使用 data 属性指定的 ID
    const dataId = element.getAttribute(this.options.dataAttribute)
    if (dataId) {
      return dataId
    }

    // 使用元素 ID
    if (element.id) {
      return `#${element.id}`
    }

    // 使用 XPath 生成
    return getXPath(element)
  }

  /**
   * 获取元素信息
   */
  private getElementInfo(element: Element): ElementInfo {
    const rect = element.getBoundingClientRect()
    
    // 获取所有 data-track-* 属性
    const trackData: Record<string, string> = {}
    Array.from(element.attributes).forEach((attr) => {
      if (attr.name.startsWith('data-track-')) {
        const key = attr.name.replace('data-track-', '')
        trackData[key] = attr.value
      }
    })

    return {
      tagName: element.tagName.toLowerCase(),
      id: element.id || undefined,
      className: element.className || undefined,
      text: truncate(element.textContent?.trim() || '', 100),
      xpath: getXPath(element),
      rect: {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        top: Math.round(rect.top),
        left: Math.round(rect.left),
      },
      trackData: Object.keys(trackData).length > 0 ? trackData : undefined,
    }
  }

  /**
   * 观察现有元素
   */
  private observeExistingElements(): void {
    if (!this.observer) return

    for (const selector of this.options.selectors) {
      const elements = document.querySelectorAll(selector)
      elements.forEach((element) => {
        this.observer!.observe(element)
        this.logger.debug('Observing element:', this.getExposureId(element))
      })
    }
  }

  /**
   * 监听 DOM 变化
   */
  private observeDOMChanges(): void {
    this.mutationObserver = new MutationObserver((mutations) => {
      if (this._status !== CollectorStatus.RUNNING || !this.observer) return

      for (const mutation of mutations) {
        // 检查新增的节点
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return

          const element = node as Element

          // 检查节点本身是否匹配
          for (const selector of this.options.selectors) {
            if (element.matches?.(selector)) {
              this.observer!.observe(element)
              this.logger.debug('Observing new element:', this.getExposureId(element))
            }
          }

          // 检查子节点
          for (const selector of this.options.selectors) {
            const children = element.querySelectorAll?.(selector)
            children?.forEach((child) => {
              this.observer!.observe(child)
              this.logger.debug('Observing new child element:', this.getExposureId(child))
            })
          }
        })

        // 检查移除的节点
        mutation.removedNodes.forEach((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return

          const element = node as Element
          this.exposureStates.delete(element)
          this.observer?.unobserve(element)
        })
      }
    })

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    })
  }

  /**
   * 开始定期检查曝光时长
   */
  private startDurationCheck(): void {
    // 每 500ms 检查一次
    this.checkTimer = setInterval(() => {
      if (this._status !== CollectorStatus.RUNNING) return

      const now = Date.now()
      this.exposureStates.forEach((state) => {
        // 只检查正在曝光的元素
        if (state.startTime !== null && !state.exposed) {
          const currentDuration = state.totalDuration + (now - state.startTime)
          if (currentDuration >= this.options.minDuration) {
            // 达到最小曝光时长，上报
            state.totalDuration = currentDuration
            this.checkAndReport(state, 1)
          }
        }
      })
    }, 500)
  }

  /**
   * 处理页面可见性变化
   */
  private handleVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      // 页面隐藏时，暂停所有曝光计时
      const now = Date.now()
      this.exposureStates.forEach((state) => {
        if (state.startTime !== null) {
          state.totalDuration += now - state.startTime
          state.startTime = null
          this.checkAndReport(state, 0)
        }
      })
    }
  }

  /**
   * 手动观察元素
   * @param element 要观察的元素
   * @param exposureId 可选的曝光 ID
   */
  observe(element: Element, exposureId?: string): void {
    if (!this.observer || this._status !== CollectorStatus.RUNNING) {
      this.logger.warn('Cannot observe: collector not running')
      return
    }

    // 如果提供了 exposureId，添加 data 属性
    if (exposureId) {
      element.setAttribute(this.options.dataAttribute, exposureId)
    }

    this.observer.observe(element)
    this.logger.debug('Manually observing element:', exposureId || this.getExposureId(element))
  }

  /**
   * 停止观察元素
   * @param element 要停止观察的元素
   */
  unobserve(element: Element): void {
    if (!this.observer) return

    this.observer.unobserve(element)
    this.exposureStates.delete(element)
    this.logger.debug('Stopped observing element')
  }

  /**
   * 手动触发曝光
   * @param elementOrId 元素或曝光 ID
   * @param data 附加数据
   */
  trackExposure(
    elementOrId: Element | string,
    data?: Partial<ExposureData>
  ): void {
    let elementInfo: ElementInfo
    let exposureId: string

    if (typeof elementOrId === 'string') {
      exposureId = elementOrId
      elementInfo = {
        tagName: 'manual',
        text: elementOrId,
      }
    } else {
      exposureId = this.getExposureId(elementOrId)
      elementInfo = this.getElementInfo(elementOrId)
    }

    const event: TrackEvent<ExposureData> = {
      id: generateUUID(),
      type: TrackEventType.EXPOSURE,
      name: 'exposure',
      timestamp: Date.now(),
      url: window.location.href,
      pageTitle: document.title,
      sessionId: '',
      data: {
        element: elementInfo,
        intersectionRatio: 1,
        isFirstExposure: true,
        exposureId,
        ...data,
      },
    }

    this.onEvent(event)
  }

  /**
   * 获取当前观察的元素数量
   */
  getObservedCount(): number {
    return this.exposureStates.size
  }

  /**
   * 清除已上报的曝光记录
   */
  clearReportedExposures(): void {
    this.reportedExposures.clear()
    this.exposureStates.forEach((state) => {
      state.exposed = false
      state.totalDuration = 0
    })
  }
}

/**
 * 创建曝光收集器实例
 */
export function createExposureCollector(
  onEvent: (event: TrackEvent<ExposureData>) => void,
  options?: ExposureCollectorOptions
): ExposureCollector {
  return new ExposureCollector(onEvent, options)
}
