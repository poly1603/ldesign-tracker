/**
 * Rollup 专用缓存工具
 * 
 * 仅保留 RollupCache 类，用于 Rollup 适配器的构建缓存
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import { createHash } from 'crypto'
import path from 'path'
import fs from 'fs-extra'

interface CacheEntry {
  key: string
  value: any
  timestamp: number
  hash?: string
}

interface CacheOptions {
  cacheDir?: string
  ttl?: number // Time to live in milliseconds
  namespace?: string
  maxSize?: number // 最大缓存体积（字节），超过后按时间淘汰
}

/**
 * Rollup 插件缓存
 * 
 * 专门用于 Rollup 适配器的构建结果缓存
 */
export class RollupCache {
  private cacheDir: string
  private ttl: number
  private namespace: string
  private maxSize?: number
  private memoryCache: Map<string, CacheEntry> = new Map()
  private initialized: boolean = false

  constructor(options: CacheOptions = {}) {
    const defaultCacheDir = path.join(process.cwd(), 'node_modules', '.cache', '@ldesign', 'builder', 'rollup')
    this.cacheDir = options.cacheDir || defaultCacheDir
    this.ttl = options.ttl ?? 24 * 60 * 60 * 1000 // 24小时
    this.namespace = options.namespace || 'rollup'
    this.maxSize = options.maxSize
  }

  /**
   * 初始化缓存目录
   */
  private async ensureCacheDir(): Promise<void> {
    if (!this.initialized) {
      await fs.mkdir(this.cacheDir, { recursive: true })
      this.initialized = true
    }
  }

  /**
   * 生成缓存键
   */
  private generateKey(key: any): string {
    const keyStr = typeof key === 'string' ? key : JSON.stringify(key)
    const hash = createHash('md5').update(keyStr).digest('hex')
    return `${this.namespace}:${hash}`
  }

  /**
   * 获取缓存文件路径
   */
  private getCacheFilePath(key: string): string {
    return path.join(this.cacheDir, `${key}.json`)
  }

  /**
   * 设置缓存
   */
  async set(key: any, value: any): Promise<void> {
    await this.ensureCacheDir()

    const cacheKey = this.generateKey(key)
    const entry: CacheEntry = {
      key: cacheKey,
      value,
      timestamp: Date.now(),
      hash: createHash('md5').update(JSON.stringify(value)).digest('hex')
    }

    // 内存缓存
    this.memoryCache.set(cacheKey, entry)

    // 磁盘缓存
    const filePath = this.getCacheFilePath(cacheKey)
    await fs.writeJSON(filePath, entry, { spaces: 0 })
  }

  /**
   * 获取缓存
   */
  async get(key: any): Promise<any> {
    const cacheKey = this.generateKey(key)

    // 先检查内存缓存
    const memEntry = this.memoryCache.get(cacheKey)
    if (memEntry && this.isValid(memEntry)) {
      return memEntry.value
    }

    // 检查磁盘缓存
    await this.ensureCacheDir()
    const filePath = this.getCacheFilePath(cacheKey)

    if (await fs.pathExists(filePath)) {
      try {
        const entry: CacheEntry = await fs.readJSON(filePath)
        if (this.isValid(entry)) {
          // 更新内存缓存
          this.memoryCache.set(cacheKey, entry)
          return entry.value
        } else {
          // 过期，删除
          await fs.remove(filePath)
        }
      } catch (error) {
        // 读取失败，删除损坏的缓存文件
        await fs.remove(filePath).catch(() => { })
      }
    }

    return null
  }

  /**
   * 检查缓存是否有效
   */
  private isValid(entry: CacheEntry): boolean {
    if (!entry || !entry.timestamp) return false
    const age = Date.now() - entry.timestamp
    return age < this.ttl
  }

  /**
   * 删除缓存
   */
  async delete(key: any): Promise<void> {
    const cacheKey = this.generateKey(key)

    // 删除内存缓存
    this.memoryCache.delete(cacheKey)

    // 删除磁盘缓存
    await this.ensureCacheDir()
    const filePath = this.getCacheFilePath(cacheKey)
    await fs.remove(filePath).catch(() => { })
  }

  /**
   * 缓存构建结果
   */
  async cacheBuildResult(cacheKey: any, buildResult: any): Promise<void> {
    await this.set(cacheKey, buildResult)
  }

  /**
   * 获取缓存的构建结果
   */
  async getBuildResult(cacheKey: any): Promise<any> {
    return await this.get(cacheKey)
  }

  /**
   * 从缓存恢复文件
   */
  async restoreFilesFromCache(cachedResult: any): Promise<boolean> {
    // 简化实现：如果缓存结果存在，认为文件已恢复
    // 实际的文件恢复逻辑由 Rollup 适配器处理
    return cachedResult != null
  }

  /**
   * 获取缓存目录
   */
  getDirectory(): string {
    return this.cacheDir
  }

  /**
   * 获取 TTL
   */
  getTTL(): number {
    return this.ttl
  }

  /**
   * 获取最大大小
   */
  getMaxSize(): number | undefined {
    return this.maxSize
  }

  /**
   * 清除所有缓存
   */
  async clear(): Promise<void> {
    this.memoryCache.clear()
    await this.ensureCacheDir()
    await fs.emptyDir(this.cacheDir).catch(() => { })
  }
}

