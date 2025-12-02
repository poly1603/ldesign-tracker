/**
 * 远程缓存（L3）
 * 
 * 团队共享的远程缓存
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import type { CacheLayer } from './MultiLevelCache'

/**
 * 远程缓存选项
 */
export interface RemoteCacheOptions {
  endpoint: string
  apiKey: string
  timeout: number
}

/**
 * 上传队列项
 */
interface UploadQueueItem {
  key: string
  value: any
  ttl?: number
}

/**
 * 远程缓存
 */
export class RemoteCache implements CacheLayer {
  private endpoint: string
  private apiKey: string
  private timeout: number
  private uploadQueue: UploadQueueItem[] = []
  private uploading = false
  private uploadTimer?: NodeJS.Timeout

  constructor(options: RemoteCacheOptions) {
    this.endpoint = options.endpoint
    this.apiKey = options.apiKey
    this.timeout = options.timeout

    // 定期处理上传队列
    this.uploadTimer = setInterval(() => {
      this.processUploadQueue()
    }, 5000)
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)

      const response = await fetch(
        `${this.endpoint}/cache/${encodeURIComponent(key)}`,
        {
          signal: controller.signal,
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Accept': 'application/json'
          }
        }
      )

      clearTimeout(timeoutId)

      if (response.ok) {
        const data = await response.json()
        return data.value as T
      }

      return null
    } catch (error) {
      // 降级处理：远程缓存失败不影响构建
      console.warn('Remote cache get failed:', error)
      return null
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    // 异步上传，不阻塞构建
    this.uploadQueue.push({ key, value, ttl })
  }

  async has(key: string): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)

      const response = await fetch(
        `${this.endpoint}/cache/${encodeURIComponent(key)}/exists`,
        {
          signal: controller.signal,
          method: 'HEAD',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      )

      clearTimeout(timeoutId)

      return response.ok
    } catch {
      return false
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await fetch(
        `${this.endpoint}/cache/${encodeURIComponent(key)}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      )
    } catch {
      // Ignore errors
    }
  }

  async clear(): Promise<void> {
    try {
      await fetch(
        `${this.endpoint}/cache`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      )
    } catch {
      // Ignore errors
    }
  }

  async size(): Promise<number> {
    try {
      const response = await fetch(
        `${this.endpoint}/cache/stats`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Accept': 'application/json'
          }
        }
      )

      if (response.ok) {
        const data = await response.json()
        return data.count || 0
      }
    } catch {
      // Ignore errors
    }

    return 0
  }

  /**
   * 处理上传队列
   */
  private async processUploadQueue(): Promise<void> {
    if (this.uploading || this.uploadQueue.length === 0) {
      return
    }

    this.uploading = true

    try {
      // 批量上传（最多10个）
      const batch = this.uploadQueue.splice(0, 10)

      await fetch(
        `${this.endpoint}/cache/batch`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ items: batch })
        }
      )
    } catch (error) {
      console.warn('Remote cache upload failed:', error)
    } finally {
      this.uploading = false
    }
  }

  /**
   * 清理资源
   */
  destroy(): void {
    if (this.uploadTimer) {
      clearInterval(this.uploadTimer)
    }
  }
}
