/**
 * 内存缓存（L1）
 * 
 * 使用 LRU 策略的内存缓存
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import type { CacheLayer } from './MultiLevelCache'

/**
 * 缓存项
 */
interface CacheEntry<T> {
  value: T
  size: number
  timestamp: number
  ttl?: number
  accessCount: number
}

/**
 * 内存缓存选项
 */
export interface MemoryCacheOptions {
  maxSize: number      // 最大大小（字节）
  maxEntries: number   // 最大条目数
}

/**
 * 内存缓存
 */
export class MemoryCache implements CacheLayer {
  private cache = new Map<string, CacheEntry<any>>()
  private maxSize: number
  private maxEntries: number
  private currentSize = 0

  constructor(options: MemoryCacheOptions) {
    this.maxSize = options.maxSize
    this.maxEntries = options.maxEntries
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    // 检查是否过期
    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      this.currentSize -= entry.size
      return null
    }

    // 更新访问统计
    entry.accessCount++
    entry.timestamp = Date.now()

    return entry.value as T
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const size = this.calculateSize(value)

    // 检查是否已存在
    const existing = this.cache.get(key)
    if (existing) {
      this.currentSize -= existing.size
    }

    // 确保有足够空间
    while (
      (this.currentSize + size > this.maxSize ||
        this.cache.size >= this.maxEntries) &&
      this.cache.size > 0
    ) {
      this.evictLRU()
    }

    // 添加新条目
    this.cache.set(key, {
      value,
      size,
      timestamp: Date.now(),
      ttl: ttl ? ttl * 1000 : undefined,
      accessCount: 0
    })

    this.currentSize += size
  }

  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key)

    if (!entry) {
      return false
    }

    // 检查是否过期
    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      this.currentSize -= entry.size
      return false
    }

    return true
  }

  async delete(key: string): Promise<void> {
    const entry = this.cache.get(key)
    if (entry) {
      this.cache.delete(key)
      this.currentSize -= entry.size
    }
  }

  async clear(): Promise<void> {
    this.cache.clear()
    this.currentSize = 0
  }

  async size(): Promise<number> {
    return this.cache.size
  }

  /**
   * LRU 淘汰
   */
  private evictLRU(): void {
    let oldestKey: string | null = null
    let oldestTime = Infinity

    for (const [key, entry] of this.cache) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp
        oldestKey = key
      }
    }

    if (oldestKey) {
      const entry = this.cache.get(oldestKey)!
      this.cache.delete(oldestKey)
      this.currentSize -= entry.size
    }
  }

  /**
   * 计算对象大小（粗略估算）
   */
  private calculateSize(value: any): number {
    const json = JSON.stringify(value)
    return Buffer.byteLength(json, 'utf8')
  }
}
