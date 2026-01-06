/**
 * 错误收集器
 * @description 收集 JavaScript 错误、Promise 拒绝和资源加载错误
 * @packageDocumentation
 */

import {
  CollectorStatus,
  TrackEventType,
  type ErrorCollectorOptions,
  type ErrorData,
  type TrackEvent,
} from '../types'
import {
  isBrowser,
  generateUUID,
  createLogger,
  truncate,
  shouldSample,
} from '../utils'

/** 默认配置 */
const DEFAULT_OPTIONS: Required<ErrorCollectorOptions> = {
  autoStart: true,
  debug: false,
  captureJsErrors: true,
  capturePromiseRejections: true,
  captureResourceErrors: true,
  sampleRate: 1,
  ignorePatterns: [
    // 常见的可忽略错误
    'Script error',
    'ResizeObserver loop',
    'Loading chunk',
    'Network request failed',
  ],
}

/** 错误堆栈最大长度 */
const MAX_STACK_LENGTH = 2000

/** 错误消息最大长度 */
const MAX_MESSAGE_LENGTH = 500

/**
 * 错误收集器类
 * @description 自动捕获和上报各类错误
 */
export class ErrorCollector {
  /** 收集器名称 */
  readonly name = 'error'

  /** 收集器状态 */
  private _status: CollectorStatus = CollectorStatus.IDLE

  /** 配置选项 */
  private options: Required<ErrorCollectorOptions>

  /** 事件回调 */
  private onEvent: (event: TrackEvent<ErrorData>) => void

  /** 日志器 */
  private logger

  /** 已上报的错误哈希集合（用于去重） */
  private reportedErrors = new Set<string>()

  /** 事件处理器引用（用于移除监听） */
  private handlers = {
    error: null as ((event: ErrorEvent) => void) | null,
    unhandledrejection: null as ((event: PromiseRejectionEvent) => void) | null,
    resourceError: null as ((event: Event) => void) | null,
  }

  constructor(
    onEvent: (event: TrackEvent<ErrorData>) => void,
    options: ErrorCollectorOptions = {}
  ) {
    this.onEvent = onEvent
    this.options = { ...DEFAULT_OPTIONS, ...options }
    this.logger = createLogger('[ErrorCollector]', this.options.debug ? 'debug' : 'warn')

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

    this.logger.debug('Installing error collector')
    this._status = CollectorStatus.RUNNING

    // 捕获 JavaScript 错误
    if (this.options.captureJsErrors) {
      this.handlers.error = this.handleError.bind(this)
      window.addEventListener('error', this.handlers.error)
    }

    // 捕获未处理的 Promise 拒绝
    if (this.options.capturePromiseRejections) {
      this.handlers.unhandledrejection = this.handlePromiseRejection.bind(this)
      window.addEventListener('unhandledrejection', this.handlers.unhandledrejection)
    }

    // 捕获资源加载错误
    if (this.options.captureResourceErrors) {
      this.handlers.resourceError = this.handleResourceError.bind(this)
      window.addEventListener('error', this.handlers.resourceError, true)
    }

    this.logger.debug('Error collector installed')
  }

  /**
   * 卸载收集器
   */
  uninstall(): void {
    if (this._status === CollectorStatus.STOPPED) {
      return
    }

    this.logger.debug('Uninstalling error collector')

    // 移除事件监听
    if (this.handlers.error) {
      window.removeEventListener('error', this.handlers.error)
      this.handlers.error = null
    }

    if (this.handlers.unhandledrejection) {
      window.removeEventListener('unhandledrejection', this.handlers.unhandledrejection)
      this.handlers.unhandledrejection = null
    }

    if (this.handlers.resourceError) {
      window.removeEventListener('error', this.handlers.resourceError, true)
      this.handlers.resourceError = null
    }

    // 清空已上报错误集合
    this.reportedErrors.clear()

    this._status = CollectorStatus.STOPPED
    this.logger.debug('Error collector uninstalled')
  }

  /**
   * 暂停收集
   */
  pause(): void {
    if (this._status === CollectorStatus.RUNNING) {
      this._status = CollectorStatus.PAUSED
      this.logger.debug('Error collector paused')
    }
  }

  /**
   * 恢复收集
   */
  resume(): void {
    if (this._status === CollectorStatus.PAUSED) {
      this._status = CollectorStatus.RUNNING
      this.logger.debug('Error collector resumed')
    }
  }

  /**
   * 处理 JavaScript 错误
   */
  private handleError(event: ErrorEvent): void {
    if (this._status !== CollectorStatus.RUNNING) return

    // 如果是资源错误，由 handleResourceError 处理
    if (event.target && (event.target as Element).tagName) {
      return
    }

    const { message, filename, lineno, colno, error } = event

    this.captureError({
      errorType: 'js',
      message: message || 'Unknown error',
      stack: error?.stack,
      filename,
      lineno,
      colno,
      level: 'error',
      source: 'window.onerror',
    })
  }

  /**
   * 处理未处理的 Promise 拒绝
   */
  private handlePromiseRejection(event: PromiseRejectionEvent): void {
    if (this._status !== CollectorStatus.RUNNING) return

    const { reason } = event

    let message: string
    let stack: string | undefined

    if (reason instanceof Error) {
      message = reason.message
      stack = reason.stack
    } else if (typeof reason === 'string') {
      message = reason
    } else {
      try {
        message = JSON.stringify(reason)
      } catch {
        message = 'Unknown promise rejection'
      }
    }

    this.captureError({
      errorType: 'promise',
      message,
      stack,
      level: 'error',
      source: 'unhandledrejection',
    })
  }

  /**
   * 处理资源加载错误
   */
  private handleResourceError(event: Event): void {
    if (this._status !== CollectorStatus.RUNNING) return

    const target = event.target as HTMLElement

    // 只处理资源元素的错误
    if (!target || !target.tagName) return

    const tagName = target.tagName.toLowerCase()
    const resourceTags = ['img', 'script', 'link', 'video', 'audio', 'source', 'iframe']

    if (!resourceTags.includes(tagName)) return

    const resourceUrl = 
      (target as HTMLImageElement).src ||
      (target as HTMLLinkElement).href ||
      (target as HTMLSourceElement).src ||
      'unknown'

    this.captureError({
      errorType: 'resource',
      message: `Failed to load ${tagName}: ${resourceUrl}`,
      filename: resourceUrl,
      level: 'warn',
      source: `${tagName}.onerror`,
    })
  }

  /**
   * 捕获并上报错误
   */
  private captureError(data: ErrorData): void {
    // 采样检查
    if (!shouldSample(this.options.sampleRate)) {
      this.logger.debug('Error skipped due to sampling')
      return
    }

    // 检查是否应该忽略
    if (this.shouldIgnore(data.message)) {
      this.logger.debug('Error ignored:', data.message)
      return
    }

    // 去重检查
    const errorHash = this.getErrorHash(data)
    if (this.reportedErrors.has(errorHash)) {
      this.logger.debug('Duplicate error ignored:', data.message)
      return
    }
    this.reportedErrors.add(errorHash)

    // 限制错误集合大小
    if (this.reportedErrors.size > 100) {
      const iterator = this.reportedErrors.values()
      this.reportedErrors.delete(iterator.next().value!)
    }

    // 处理数据
    const processedData: ErrorData = {
      ...data,
      message: truncate(data.message, MAX_MESSAGE_LENGTH),
      stack: data.stack ? truncate(data.stack, MAX_STACK_LENGTH) : undefined,
    }

    const event: TrackEvent<ErrorData> = {
      id: generateUUID(),
      type: TrackEventType.ERROR,
      name: `error:${data.errorType}`,
      timestamp: Date.now(),
      url: window.location.href,
      pageTitle: document.title,
      sessionId: '',
      data: processedData,
    }

    this.logger.debug('Capturing error:', processedData.message)
    this.onEvent(event)
  }

  /**
   * 检查是否应该忽略该错误
   */
  private shouldIgnore(message: string): boolean {
    return this.options.ignorePatterns.some((pattern) => {
      if (typeof pattern === 'string') {
        return message.includes(pattern)
      }
      return pattern.test(message)
    })
  }

  /**
   * 生成错误哈希（用于去重）
   */
  private getErrorHash(data: ErrorData): string {
    const parts = [
      data.errorType,
      data.message.slice(0, 100),
      data.filename || '',
      data.lineno || '',
      data.colno || '',
    ]
    return parts.join('|')
  }

  /**
   * 手动上报错误
   * @param error 错误对象或错误消息
   * @param options 额外选项
   */
  captureException(
    error: Error | string,
    options: {
      level?: ErrorData['level']
      componentName?: string
      extra?: Record<string, unknown>
    } = {}
  ): void {
    const { level = 'error', componentName, extra } = options

    let message: string
    let stack: string | undefined

    if (error instanceof Error) {
      message = error.message
      stack = error.stack
    } else {
      message = error
    }

    this.captureError({
      errorType: 'custom',
      message,
      stack,
      level,
      source: 'manual',
      componentName,
      ...extra,
    })
  }

  /**
   * 手动上报消息
   * @param message 消息内容
   * @param level 日志级别
   */
  captureMessage(
    message: string,
    level: ErrorData['level'] = 'info'
  ): void {
    this.captureError({
      errorType: 'custom',
      message,
      level,
      source: 'manual',
    })
  }

  /**
   * 添加忽略模式
   */
  addIgnorePattern(pattern: string | RegExp): void {
    this.options.ignorePatterns.push(pattern)
  }

  /**
   * 清除已上报错误记录
   */
  clearReportedErrors(): void {
    this.reportedErrors.clear()
  }
}

/**
 * 创建错误收集器实例
 */
export function createErrorCollector(
  onEvent: (event: TrackEvent<ErrorData>) => void,
  options?: ErrorCollectorOptions
): ErrorCollector {
  return new ErrorCollector(onEvent, options)
}

/**
 * 包装函数以捕获错误
 */
export function wrapWithErrorHandler<T extends (...args: any[]) => any>(
  fn: T,
  collector: ErrorCollector,
  context?: string
): T {
  return function (this: any, ...args: Parameters<T>): ReturnType<T> {
    try {
      const result = fn.apply(this, args)

      // 处理返回 Promise 的情况
      if (result instanceof Promise) {
        return result.catch((error) => {
          collector.captureException(error, {
            componentName: context,
          })
          throw error
        }) as ReturnType<T>
      }

      return result
    } catch (error) {
      collector.captureException(error as Error, {
        componentName: context,
      })
      throw error
    }
  } as T
}
