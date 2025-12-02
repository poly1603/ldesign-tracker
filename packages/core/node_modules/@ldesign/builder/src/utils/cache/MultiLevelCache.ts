/**
 * 多级缓存系统
 * 
 * L1: 内存缓存（最快）
 * L2: 磁盘缓存（快）
 * L3: 远程缓存（慢但共享）
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import { EventEmitter } from 'events'

/**
 * 缓存选项
 */
export interface CacheOptions {
  /** L1 内存缓存配置 */
  l1?: {
    enabled?: boolean
    maxSize?: number  // 字节
    maxEntries?: number
  }

  /** L2 磁盘缓存配置 */
  l2?: {
    enabled?: boolean
    cacheDir?: string
    maxSize?: number  // 字节
  }

  /** L3 远程缓存配置 */
  l3?: {
    enabled?: boolean
    endpoint?: string
    apiKey?: string
    timeout?: number
  }
}

/**
 * 缓存统计
 */
export interface CacheStats {
  l1Hits: number
  l2Hits: number
  l3Hits: number
  misses: number
  total: number
  hitRate: number
}

/**
 * 缓存层接口
 */
export interface CacheLayer {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T, ttl?: number): Promise<void>
  has(key: string): Promise<boolean>
  delete(key: string): Promise<void>
  clear(): Promise<void>
  size(): Promise<number>
}

/**
 * 多级缓存
 */
export class MultiLevelCache extends EventEmitter {
  private l1?: CacheLayer  // 内存缓存
  private l2?: CacheLayer  // 磁盘缓存
  private l3?: CacheLayer  // 远程缓存

  private stats: CacheStats = {
    l1Hits: 0,
    l2Hits: 0,
    l3Hits: 0,
    misses: 0,
    total: 0,
    hitRate: 0
  }

  constructor(options: CacheOptions = {}) {
    super()

    // 初始化各级缓存
    if (options.l1?.enabled !== false) {
      this.l1 = this.createMemoryCache(options.l1)
    }

    if (options.l2?.enabled !== false) {
      this.l2 = this.createFileSystemCache(options.l2)
    }

    if (options.l3?.enabled === true) {
      this.l3 = this.createRemoteCache(options.l3)
    }
  }

  /**
   * 获取缓存值
   */
  async get<T>(key: string): Promise<T | null> {
    this.stats.total++

    // L1: 内存缓存
    if (this.l1) {
      const value = await this.l1.get<T>(key)
      if (value !== null) {
        this.stats.l1Hits++
        this.updateHitRate()
        this.emit('cache-hit', { level: 'L1', key })
        return value
      }
    }

    // L2: 磁盘缓存
    if (this.l2) {
      const value = await this.l2.get<T>(key)
      if (value !== null) {
        this.stats.l2Hits++
        this.updateHitRate()
        this.emit('cache-hit', { level: 'L2', key })

        // 提升到 L1
        if (this.l1) {
          await this.l1.set(key, value)
        }

        return value
      }
    }

    // L3: 远程缓存
    if (this.l3) {
      const value = await this.l3.get<T>(key)
      if (value !== null) {
        this.stats.l3Hits++
        this.updateHitRate()
        this.emit('cache-hit', { level: 'L3', key })

        // 提升到 L2 和 L1
        const promotionPromises: Promise<void>[] = []
        if (this.l2) promotionPromises.push(this.l2.set(key, value))
        if (this.l1) promotionPromises.push(this.l1.set(key, value))
        await Promise.all(promotionPromises)

        return value
      }
    }

    // 未命中
    this.stats.misses++
    this.updateHitRate()
    this.emit('cache-miss', { key })

    return null
  }

  /**
   * 设置缓存值
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const promises: Promise<void>[] = []

    // 写入所有启用的缓存层
    if (this.l1) promises.push(this.l1.set(key, value, ttl))
    if (this.l2) promises.push(this.l2.set(key, value, ttl))
    if (this.l3) promises.push(this.l3.set(key, value, ttl))

    await Promise.all(promises)
    this.emit('cache-set', { key, levels: promises.length })
  }

  /**
   * 检查缓存是否存在
   */
  async has(key: string): Promise<boolean> {
    // 从 L1 到 L3 依次检查
    if (this.l1 && await this.l1.has(key)) return true
    if (this.l2 && await this.l2.has(key)) return true
    if (this.l3 && await this.l3.has(key)) return true
    return false
  }

  /**
   * 删除缓存
   */
  async delete(key: string): Promise<void> {
    const promises: Promise<void>[] = []

    if (this.l1) promises.push(this.l1.delete(key))
    if (this.l2) promises.push(this.l2.delete(key))
    if (this.l3) promises.push(this.l3.delete(key))

    await Promise.all(promises)
    this.emit('cache-delete', { key })
  }

  /**
   * 清空所有缓存
   */
  async clear(): Promise<void> {
    const promises: Promise<void>[] = []

    if (this.l1) promises.push(this.l1.clear())
    if (this.l2) promises.push(this.l2.clear())
    if (this.l3) promises.push(this.l3.clear())

    await Promise.all(promises)
    this.emit('cache-clear')
  }

  /**
   * 获取缓存统计
   */
  getStats(): CacheStats {
    return { ...this.stats }
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.stats = {
      l1Hits: 0,
      l2Hits: 0,
      l3Hits: 0,
      misses: 0,
      total: 0,
      hitRate: 0
    }
  }

  /**
   * 更新命中率
   */
  private updateHitRate(): void {
    const hits = this.stats.l1Hits + this.stats.l2Hits + this.stats.l3Hits
    this.stats.hitRate = this.stats.total > 0
      ? (hits / this.stats.total) * 100
      : 0
  }

  /**
   * 创建内存缓存
   */
  private createMemoryCache(options: any = {}): CacheLayer {
    const { MemoryCache } = require('./MemoryCache')
    return new MemoryCache({
      maxSize: options.maxSize || 100 * 1024 * 1024, // 100MB
      maxEntries: options.maxEntries || 1000
    })
  }

  /**
   * 创建文件系统缓存
   */
  private createFileSystemCache(options: any = {}): CacheLayer {
    const { FileSystemCache } = require('./FileSystemCache')
    return new FileSystemCache({
      cacheDir: options.cacheDir || '.ldesign/cache',
      maxSize: options.maxSize || 5 * 1024 * 1024 * 1024 // 5GB
    })
  }

  /**
   * 创建远程缓存
   */
  private createRemoteCache(options: any): CacheLayer {
    const { RemoteCache } = require('./RemoteCache')
    return new RemoteCache({
      endpoint: options.endpoint,
      apiKey: options.apiKey,
      timeout: options.timeout || 5000
    })
  }
}

/**
 * 创建多级缓存
 */
export function createMultiLevelCache(options?: CacheOptions): MultiLevelCache {
  return new MultiLevelCache(options)
}
