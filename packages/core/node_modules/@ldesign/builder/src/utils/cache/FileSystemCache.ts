/**
 * 文件系统缓存（L2）
 * 
 * 持久化到磁盘的缓存
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import fs from 'fs-extra'
import path from 'path'
import { createHash } from 'crypto'
import type { CacheLayer } from './MultiLevelCache'

/**
 * 文件系统缓存选项
 */
export interface FileSystemCacheOptions {
  cacheDir: string
  maxSize: number  // 最大大小（字节）
}

/**
 * 文件系统缓存
 */
export class FileSystemCache implements CacheLayer {
  private cacheDir: string
  private maxSize: number
  private indexFile: string
  private index: Map<string, { size: number; mtime: number }> = new Map()

  constructor(options: FileSystemCacheOptions) {
    this.cacheDir = path.resolve(options.cacheDir)
    this.maxSize = options.maxSize
    this.indexFile = path.join(this.cacheDir, 'index.json')

    this.ensureCacheDir()
    this.loadIndex()
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const filePath = this.getFilePath(key)

      if (!await fs.pathExists(filePath)) {
        return null
      }

      const content = await fs.readFile(filePath, 'utf-8')
      const data = JSON.parse(content)

      // 检查是否过期
      if (data.ttl && Date.now() > data.ttl) {
        await this.delete(key)
        return null
      }

      return data.value as T
    } catch {
      return null
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const filePath = this.getFilePath(key)

      const data = {
        value,
        ttl: ttl ? Date.now() + ttl * 1000 : undefined,
        timestamp: Date.now()
      }

      const content = JSON.stringify(data)
      const size = Buffer.byteLength(content, 'utf8')

      // 确保有足够空间
      await this.ensureSpace(size)

      // 写入文件
      await fs.ensureDir(path.dirname(filePath))
      await fs.writeFile(filePath, content, 'utf-8')

      // 更新索引
      this.index.set(key, { size, mtime: Date.now() })
      await this.saveIndex()
    } catch (error) {
      console.error('FileSystemCache: set error', error)
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      const filePath = this.getFilePath(key)
      return await fs.pathExists(filePath)
    } catch {
      return false
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const filePath = this.getFilePath(key)
      await fs.remove(filePath)
      this.index.delete(key)
      await this.saveIndex()
    } catch {
      // Ignore errors
    }
  }

  async clear(): Promise<void> {
    try {
      await fs.emptyDir(this.cacheDir)
      this.index.clear()
      await this.saveIndex()
    } catch {
      // Ignore errors
    }
  }

  async size(): Promise<number> {
    return this.index.size
  }

  /**
   * 获取文件路径
   */
  private getFilePath(key: string): string {
    const hash = createHash('md5').update(key).digest('hex')
    const dir = hash.substring(0, 2)
    return path.join(this.cacheDir, dir, `${hash}.json`)
  }

  /**
   * 确保缓存目录存在
   */
  private ensureCacheDir(): void {
    fs.ensureDirSync(this.cacheDir)
  }

  /**
   * 加载索引
   */
  private loadIndex(): void {
    try {
      if (fs.existsSync(this.indexFile)) {
        const content = fs.readFileSync(this.indexFile, 'utf-8')
        const data = JSON.parse(content)
        this.index = new Map(Object.entries(data))
      }
    } catch {
      this.index = new Map()
    }
  }

  /**
   * 保存索引
   */
  private async saveIndex(): Promise<void> {
    try {
      const data = Object.fromEntries(this.index)
      await fs.writeJson(this.indexFile, data, { spaces: 2 })
    } catch {
      // Ignore errors
    }
  }

  /**
   * 确保有足够空间
   */
  private async ensureSpace(requiredSize: number): Promise<void> {
    const currentSize = Array.from(this.index.values())
      .reduce((sum, entry) => sum + entry.size, 0)

    if (currentSize + requiredSize > this.maxSize) {
      // 删除最旧的文件直到有足够空间
      const entries = Array.from(this.index.entries())
        .sort((a, b) => a[1].mtime - b[1].mtime)

      for (const [key] of entries) {
        if (currentSize + requiredSize <= this.maxSize) break
        await this.delete(key)
      }
    }
  }
}
