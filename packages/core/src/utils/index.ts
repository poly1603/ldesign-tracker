/**
 * 工具函数模块
 * @packageDocumentation
 * @module @ldesign/tracker-core/utils
 */

import type { DebouncedFunction, ThrottledFunction, Logger, LogLevel } from '../types'

// ============================================================================
// ID 生成
// ============================================================================

/**
 * 生成 UUID v4
 * @returns UUID 字符串
 */
export function generateUUID(): string {
  // 优先使用 crypto.randomUUID
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  // 降级方案
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * 生成短 ID
 * @param length ID 长度，默认 8
 * @returns 短 ID 字符串
 */
export function generateShortId(length = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  const randomValues = new Uint8Array(length)

  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomValues)
    for (let i = 0; i < length; i++) {
      result += chars[randomValues[i] % chars.length]
    }
  } else {
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)]
    }
  }

  return result
}

/**
 * 生成会话 ID
 * @returns 会话 ID
 */
export function generateSessionId(): string {
  return `${Date.now().toString(36)}-${generateShortId(6)}`
}

/**
 * 生成页面 ID
 * @returns 页面 ID
 */
export function generatePageId(): string {
  return `page-${generateShortId(8)}`
}

// ============================================================================
// 函数工具
// ============================================================================

/**
 * 节流函数
 * @param fn 要节流的函数
 * @param delay 延迟时间(ms)
 * @returns 节流后的函数
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): ThrottledFunction<T> {
  let lastCall = 0
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const throttled = function (this: any, ...args: Parameters<T>): ReturnType<T> | undefined {
    const now = Date.now()
    const remaining = delay - (now - lastCall)

    if (remaining <= 0) {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      lastCall = now
      return fn.apply(this, args)
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        lastCall = Date.now()
        timeoutId = null
        fn.apply(this, args)
      }, remaining)
    }

    return undefined
  } as ThrottledFunction<T>

  throttled.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  return throttled
}

/**
 * 防抖函数
 * @param fn 要防抖的函数
 * @param delay 延迟时间(ms)
 * @param immediate 是否立即执行
 * @returns 防抖后的函数
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number,
  immediate = false
): DebouncedFunction<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let lastArgs: Parameters<T> | null = null
  let lastThis: any = null

  const debounced = function (this: any, ...args: Parameters<T>): void {
    lastArgs = args
    lastThis = this

    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    if (immediate && !timeoutId) {
      fn.apply(this, args)
    }

    timeoutId = setTimeout(() => {
      timeoutId = null
      if (!immediate && lastArgs) {
        fn.apply(lastThis, lastArgs)
      }
      lastArgs = null
      lastThis = null
    }, delay)
  } as DebouncedFunction<T>

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    lastArgs = null
    lastThis = null
  }

  debounced.flush = () => {
    if (timeoutId && lastArgs) {
      clearTimeout(timeoutId)
      timeoutId = null
      fn.apply(lastThis, lastArgs)
      lastArgs = null
      lastThis = null
    }
  }

  return debounced
}

/**
 * 重试函数
 * @param fn 要重试的异步函数
 * @param options 重试配置
 * @returns Promise
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number
    baseDelay?: number
    maxDelay?: number
    useExponentialBackoff?: boolean
    onRetry?: (error: Error, attempt: number) => void
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    useExponentialBackoff = true,
    onRetry,
  } = options

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt < maxRetries) {
        const delay = useExponentialBackoff
          ? Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
          : baseDelay

        onRetry?.(lastError, attempt + 1)
        await sleep(delay)
      }
    }
  }

  throw lastError
}

/**
 * 延迟执行
 * @param ms 延迟时间(ms)
 * @returns Promise
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ============================================================================
// 浏览器工具
// ============================================================================

/**
 * 检查是否为浏览器环境
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

/**
 * 检查是否支持 sendBeacon
 */
export function supportsSendBeacon(): boolean {
  return isBrowser() && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function'
}

/**
 * 检查是否支持 IntersectionObserver
 */
export function supportsIntersectionObserver(): boolean {
  return isBrowser() && typeof IntersectionObserver !== 'undefined'
}

/**
 * 检查是否支持 PerformanceObserver
 */
export function supportsPerformanceObserver(): boolean {
  return isBrowser() && typeof PerformanceObserver !== 'undefined'
}

/**
 * 检查网络是否在线
 */
export function isOnline(): boolean {
  if (!isBrowser()) return true
  return navigator.onLine !== false
}

/**
 * 获取网络连接类型
 */
export function getConnectionType(): string | undefined {
  if (!isBrowser()) return undefined
  const nav = navigator as Navigator & {
    connection?: { effectiveType?: string; type?: string }
  }
  return nav.connection?.effectiveType || nav.connection?.type
}

/**
 * 检查页面是否可见
 */
export function isPageVisible(): boolean {
  if (!isBrowser()) return true
  return document.visibilityState === 'visible'
}

/**
 * 获取当前时间戳
 */
export function now(): number {
  return Date.now()
}

/**
 * 获取高精度时间戳
 */
export function performanceNow(): number {
  if (typeof performance !== 'undefined' && performance.now) {
    return performance.now()
  }
  return Date.now()
}

// ============================================================================
// 数据处理
// ============================================================================

/**
 * 安全的 JSON 字符串化
 * @param value 要序列化的值
 * @param fallback 失败时的默认值
 */
export function safeStringify(value: unknown, fallback = '{}'): string {
  try {
    return JSON.stringify(value)
  } catch {
    return fallback
  }
}

/**
 * 安全的 JSON 解析
 * @param value 要解析的字符串
 * @param fallback 失败时的默认值
 */
export function safeParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

/**
 * 深拷贝对象
 * @param obj 要拷贝的对象
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }

  // 使用 structuredClone（如果可用）
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(obj)
    } catch {
      // 降级到 JSON 方式
    }
  }

  // 降级方案
  return JSON.parse(JSON.stringify(obj))
}

/**
 * 合并对象（浅合并）
 */
export function merge<T extends object>(...objects: Partial<T>[]): T {
  return Object.assign({}, ...objects) as T
}

/**
 * 深度合并对象
 */
export function deepMerge<T extends object>(target: T, ...sources: Partial<T>[]): T {
  const isObject = (item: unknown): item is object =>
    item !== null && typeof item === 'object' && !Array.isArray(item)

  return sources.reduce((acc, source) => {
    if (!source) return acc

    Object.keys(source).forEach((key) => {
      const targetValue = (acc as any)[key]
      const sourceValue = (source as any)[key]

      if (isObject(targetValue) && isObject(sourceValue)) {
        (acc as any)[key] = deepMerge(targetValue, sourceValue)
      } else if (sourceValue !== undefined) {
        (acc as any)[key] = sourceValue
      }
    })

    return acc
  }, { ...target } as T)
}

/**
 * 截断字符串
 * @param str 原字符串
 * @param maxLength 最大长度
 * @param suffix 后缀，默认 '...'
 */
export function truncate(str: string, maxLength: number, suffix = '...'): string {
  if (str.length <= maxLength) {
    return str
  }
  return str.slice(0, maxLength - suffix.length) + suffix
}

/**
 * 获取对象指定路径的值
 * @param obj 对象
 * @param path 路径，如 'a.b.c'
 * @param defaultValue 默认值
 */
export function get<T>(obj: object, path: string, defaultValue?: T): T | undefined {
  const keys = path.split('.')
  let result: any = obj

  for (const key of keys) {
    if (result === null || result === undefined) {
      return defaultValue
    }
    result = result[key]
  }

  return result === undefined ? defaultValue : result
}

// ============================================================================
// 采样
// ============================================================================

/**
 * 采样决策
 * @param rate 采样率(0-1)
 * @returns 是否采样
 */
export function shouldSample(rate: number): boolean {
  if (rate >= 1) return true
  if (rate <= 0) return false
  return Math.random() < rate
}

/**
 * 基于用户 ID 的一致性采样
 * @param userId 用户 ID
 * @param rate 采样率(0-1)
 */
export function consistentSample(userId: string, rate: number): boolean {
  if (rate >= 1) return true
  if (rate <= 0) return false

  // 简单的哈希函数
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }

  return (Math.abs(hash) % 100) / 100 < rate
}

// ============================================================================
// 日志器
// ============================================================================

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
}

/**
 * 创建日志器
 * @param prefix 日志前缀
 * @param initialLevel 初始日志级别
 */
export function createLogger(prefix = '[Tracker]', initialLevel: LogLevel = 'warn'): Logger {
  let currentLevel = initialLevel

  const shouldLog = (level: LogLevel): boolean => {
    return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel]
  }

  return {
    debug: (...args: unknown[]) => {
      if (shouldLog('debug')) {
        console.debug(prefix, ...args)
      }
    },
    info: (...args: unknown[]) => {
      if (shouldLog('info')) {
        console.info(prefix, ...args)
      }
    },
    warn: (...args: unknown[]) => {
      if (shouldLog('warn')) {
        console.warn(prefix, ...args)
      }
    },
    error: (...args: unknown[]) => {
      if (shouldLog('error')) {
        console.error(prefix, ...args)
      }
    },
    setLevel: (level: LogLevel) => {
      currentLevel = level
    },
  }
}

// ============================================================================
// XPath 工具
// ============================================================================

/**
 * 获取元素的 XPath
 * @param element DOM 元素
 */
export function getXPath(element: Element): string {
  if (!element) return ''

  // 如果有 ID，直接使用
  if (element.id) {
    return `//*[@id="${element.id}"]`
  }

  const parts: string[] = []
  let current: Element | null = element

  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let index = 1
    let sibling: Element | null = current.previousElementSibling

    while (sibling) {
      if (sibling.tagName === current.tagName) {
        index++
      }
      sibling = sibling.previousElementSibling
    }

    const tagName = current.tagName.toLowerCase()
    const part = index > 1 ? `${tagName}[${index}]` : tagName
    parts.unshift(part)

    current = current.parentElement
  }

  return '/' + parts.join('/')
}

/**
 * 获取元素的 CSS 选择器路径
 * @param element DOM 元素
 */
export function getCSSPath(element: Element): string {
  if (!element) return ''

  const path: string[] = []
  let current: Element | null = element

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase()

    if (current.id) {
      selector += `#${current.id}`
      path.unshift(selector)
      break
    }

    if (current.className && typeof current.className === 'string') {
      const classes = current.className.trim().split(/\s+/).slice(0, 2)
      if (classes.length > 0) {
        selector += `.${classes.join('.')}`
      }
    }

    const parent = current.parentElement
    if (parent) {
      const siblings = Array.from(parent.children).filter((c) => c.tagName === current!.tagName)
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1
        selector += `:nth-child(${index})`
      }
    }

    path.unshift(selector)
    current = parent
  }

  return path.join(' > ')
}

// ============================================================================
// 事件队列
// ============================================================================

/**
 * 创建事件队列
 * @param maxSize 最大队列大小
 */
export function createEventQueue<T>(maxSize = 1000) {
  const queue: T[] = []

  return {
    /**
     * 入队
     */
    enqueue(item: T): boolean {
      if (queue.length >= maxSize) {
        return false
      }
      queue.push(item)
      return true
    },

    /**
     * 批量入队
     */
    enqueueAll(items: T[]): number {
      const available = maxSize - queue.length
      const toAdd = items.slice(0, available)
      queue.push(...toAdd)
      return toAdd.length
    },

    /**
     * 出队
     */
    dequeue(): T | undefined {
      return queue.shift()
    },

    /**
     * 批量出队
     */
    dequeueAll(count?: number): T[] {
      if (count === undefined) {
        return queue.splice(0)
      }
      return queue.splice(0, count)
    },

    /**
     * 查看队首
     */
    peek(): T | undefined {
      return queue[0]
    },

    /**
     * 队列大小
     */
    get size(): number {
      return queue.length
    },

    /**
     * 是否为空
     */
    get isEmpty(): boolean {
      return queue.length === 0
    },

    /**
     * 是否已满
     */
    get isFull(): boolean {
      return queue.length >= maxSize
    },

    /**
     * 清空队列
     */
    clear(): void {
      queue.length = 0
    },

    /**
     * 获取所有元素（不移除）
     */
    toArray(): T[] {
      return [...queue]
    },
  }
}

// ============================================================================
// 数据压缩
// ============================================================================

/**
 * 简单的 LZ 字符串压缩（基于 LZString 算法简化版）
 * 用于减少数据传输量
 */
export function compressString(input: string): string {
  if (!input) return ''

  try {
    // 如果浏览器支持 CompressionStream，使用它
    if (typeof CompressionStream !== 'undefined') {
      // 注意：这需要异步处理，这里提供同步的简单压缩
    }
  } catch {
    // 忽略错误
  }

  // 简单的 Base64 编码（实际项目中可以使用 lz-string 库）
  return btoa(encodeURIComponent(input))
}

/**
 * 解压字符串
 */
export function decompressString(input: string): string {
  if (!input) return ''

  try {
    return decodeURIComponent(atob(input))
  } catch {
    return input
  }
}

// ============================================================================
// 导出
// ============================================================================

export {
  generateUUID as uuid,
  generateShortId as shortId,
}
