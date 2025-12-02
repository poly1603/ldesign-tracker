/**
 * GC 优化器
 * 
 * 提供垃圾回收优化功能
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import { Logger } from '../logger'

/**
 * GC 优化器类
 */
export class GCOptimizer {
  private logger: Logger
  private gcEnabled: boolean

  constructor() {
    this.logger = new Logger({ prefix: 'GCOptimizer' })
    this.gcEnabled = typeof global.gc === 'function'

    if (!this.gcEnabled) {
      this.logger.debug('GC 未启用，需要使用 --expose-gc 标志运行 Node.js')
    }
  }

  /**
   * 手动触发 GC
   * 
   * @returns 是否成功触发 GC
   */
  triggerGC(): boolean {
    if (this.gcEnabled && global.gc) {
      try {
        global.gc()
        this.logger.debug('已触发垃圾回收')
        return true
      }
      catch (error) {
        this.logger.warn('触发 GC 失败:', error)
        return false
      }
    }
    return false
  }

  /**
   * 在内存压力下触发 GC
   * 
   * @param threshold - 内存使用率阈值（0-1）
   * @returns 是否触发了 GC
   */
  triggerGCIfNeeded(threshold: number = 0.8): boolean {
    const usage = process.memoryUsage()
    const heapUsedRatio = usage.heapUsed / usage.heapTotal

    if (heapUsedRatio > threshold) {
      this.logger.debug(`内存使用率 ${(heapUsedRatio * 100).toFixed(1)}% 超过阈值，触发 GC`)
      return this.triggerGC()
    }

    return false
  }

  /**
   * 创建带 GC 优化的异步函数包装器
   * 
   * @param fn - 要包装的异步函数
   * @param options - GC 选项
   * @returns 包装后的函数
   */
  withGC<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    options: { threshold?: number; force?: boolean } = {},
  ): T {
    const { threshold = 0.8, force = false } = options

    return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
      try {
        const result = await fn(...args)

        // 执行后检查是否需要 GC
        if (force) {
          this.triggerGC()
        }
        else {
          this.triggerGCIfNeeded(threshold)
        }

        return result
      }
      catch (error) {
        // 出错时也尝试清理内存
        this.triggerGC()
        throw error
      }
    }) as T
  }
}

/**
 * 创建 GC 优化器实例
 * 
 * @returns GC 优化器实例
 */
export function createGCOptimizer(): GCOptimizer {
  return new GCOptimizer()
}

