/**
 * 内存管理器 - 防止内存泄漏和优化内存使用
 *
 * 提供流式处理、资源自动释放、内存监控等功能
 *
 * @author LDesign Team
 * @version 1.0.0
 */

import { EventEmitter } from 'events'
import { Logger } from '../logger'
import { ResourceManager, type ICleanupable } from './ResourceManager'
import { StreamProcessor, type StreamProcessOptions } from './StreamProcessor'
import { GCOptimizer, createGCOptimizer as createGCOptimizerFactory } from './GCOptimizer'

// 重新导出类型和类
export type { ICleanupable, StreamProcessOptions }
export { ResourceManager, StreamProcessor, GCOptimizer }

/**
 * 内存管理器选项
 */
export interface MemoryManagerOptions {
  /** 是否启用内存监控 */
  enableMonitoring?: boolean
  /** 内存使用警告阈值(MB) */
  memoryThreshold?: number
  /** 清理间隔(ms) */
  cleanupInterval?: number
  /** 监控间隔(ms) */
  monitoringInterval?: number
  /** 是否自动清理 */
  autoCleanup?: boolean
  /** 是否启用 GC 提示 */
  enableGCHints?: boolean
}

/**
 * 内存管理器类
 */
export class MemoryManager extends EventEmitter {
  private options: Required<MemoryManagerOptions>
  private resourceManager = new ResourceManager()
  private monitoringInterval?: NodeJS.Timeout
  private cleanupInterval?: NodeJS.Timeout
  private memorySnapshots: Array<{ timestamp: number; heapUsed: number }> = []
  private maxSnapshots = 100
  // 追踪进程事件监听器
  private processListeners = {
    exit: null as (() => void) | null,
    sigint: null as (() => void) | null,
    sigterm: null as (() => void) | null
  }

  constructor(options: MemoryManagerOptions = {}) {
    super()

    this.options = {
      enableMonitoring: false,
      memoryThreshold: 500, // 500MB
      cleanupInterval: 60000, // 1分钟
      monitoringInterval: 10000, // 10秒
      autoCleanup: true,
      enableGCHints: false,
      ...options
    }

    this.initialize()
  }

  /**
   * 初始化内存管理器
   */
  private initialize(): void {
    if (this.options.enableMonitoring) {
      this.startMonitoring()
    }

    if (this.options.autoCleanup) {
      this.cleanupInterval = setInterval(() => {
        this.performCleanup()
      }, this.options.cleanupInterval)
      
      // 防止定时器阻止进程退出
      if (this.cleanupInterval.unref) {
        this.cleanupInterval.unref()
      }
      
      this.resourceManager.addTimer(this.cleanupInterval)
    }

    // 监听进程退出事件，并追踪监听器
    this.processListeners.exit = () => this.destroy()
    this.processListeners.sigint = () => this.destroy()
    this.processListeners.sigterm = () => this.destroy()

    process.on('exit', this.processListeners.exit)
    process.on('SIGINT', this.processListeners.sigint)
    process.on('SIGTERM', this.processListeners.sigterm)
  }

  /**
   * 开始内存监控
   */
  private startMonitoring(): void {
    if (this.monitoringInterval) return

    // 使用配置的监控间隔，而不是硬编码
    const interval = this.options.monitoringInterval || 10000
    this.monitoringInterval = setInterval(() => {
      this.checkMemoryUsage()
    }, interval)

    this.resourceManager.addTimer(this.monitoringInterval)
  }

  /**
   * 检查内存使用
   */
  private checkMemoryUsage(): void {
    const memUsage = process.memoryUsage()
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024

    // 记录快照
    this.memorySnapshots.push({
      timestamp: Date.now(),
      heapUsed: memUsage.heapUsed
    })

    // 限制快照数量
    if (this.memorySnapshots.length > this.maxSnapshots) {
      this.memorySnapshots.shift()
    }

    // 检查是否超过阈值
    if (heapUsedMB > this.options.memoryThreshold) {
      this.emit('memoryWarning', {
        heapUsedMB,
        threshold: this.options.memoryThreshold,
        memUsage
      })

      // 触发垃圾回收（如果可用）
      if (global.gc) {
        global.gc()
      }
    }

    // 检测内存泄漏
    this.detectMemoryLeak()
  }

  /**
   * 检测内存泄漏
   */
  private detectMemoryLeak(): void {
    if (this.memorySnapshots.length < 10) return

    const recent = this.memorySnapshots.slice(-10)
    const oldest = recent[0]
    const newest = recent[recent.length - 1]

    const timeDiff = newest.timestamp - oldest.timestamp
    const heapDiff = newest.heapUsed - oldest.heapUsed

    // 计算增长率 (bytes/second)
    const growthRate = heapDiff / (timeDiff / 1000)

    // 如果每秒增长超过1MB，可能存在内存泄漏
    if (growthRate > 1024 * 1024) {
      this.emit('memoryLeak', {
        growthRate: growthRate / 1024 / 1024, // MB/s
        duration: timeDiff / 1000, // seconds
        increase: heapDiff / 1024 / 1024 // MB
      })
    }
  }

  /**
   * 执行清理
   */
  private async performCleanup(): Promise<void> {
    try {
      // 获取清理前的内存使用
      const beforeMem = process.memoryUsage().heapUsed

      // 执行资源清理
      await this.resourceManager.cleanup()

      // 触发垃圾回收
      if (global.gc) {
        global.gc()
      }

      // 计算清理效果
      const afterMem = process.memoryUsage().heapUsed
      const freedMB = (beforeMem - afterMem) / 1024 / 1024

      this.emit('cleanupCompleted', {
        freedMB: Math.max(0, freedMB),
        stats: this.resourceManager.getStats()
      })
    } catch (error) {
      this.emit('cleanupError', error)
    }
  }

  /**
   * 获取资源管理器
   */
  getResourceManager(): ResourceManager {
    return this.resourceManager
  }

  /**
   * 获取内存使用统计
   */
  getMemoryStats(): {
    current: NodeJS.MemoryUsage
    history: Array<{ timestamp: number; heapUsed: number }>
    trend: 'stable' | 'increasing' | 'decreasing'
  } {
    const current = process.memoryUsage()

    let trend: 'stable' | 'increasing' | 'decreasing' = 'stable'
    if (this.memorySnapshots.length >= 5) {
      const recent = this.memorySnapshots.slice(-5)
      const first = recent[0].heapUsed
      const last = recent[recent.length - 1].heapUsed
      const diff = last - first

      if (diff > 10 * 1024 * 1024) { // 10MB
        trend = 'increasing'
      } else if (diff < -10 * 1024 * 1024) {
        trend = 'decreasing'
      }
    }

    return {
      current,
      history: [...this.memorySnapshots],
      trend
    }
  }

  /**
   * 手动触发清理
   */
  async cleanup(): Promise<void> {
    await this.performCleanup()
  }

  /**
   * 销毁内存管理器
   */
  async destroy(): Promise<void> {
    // 停止监控
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = undefined
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = undefined
    }

    // 移除进程事件监听器
    if (this.processListeners.exit) {
      process.removeListener('exit', this.processListeners.exit)
      this.processListeners.exit = null
    }
    if (this.processListeners.sigint) {
      process.removeListener('SIGINT', this.processListeners.sigint)
      this.processListeners.sigint = null
    }
    if (this.processListeners.sigterm) {
      process.removeListener('SIGTERM', this.processListeners.sigterm)
      this.processListeners.sigterm = null
    }

    // 清理资源
    await this.resourceManager.cleanup()

    // 清空快照
    this.memorySnapshots = []

    // 移除所有事件监听器
    this.removeAllListeners()
  }
}

/**
 * 创建全局内存管理器实例
 */
let globalMemoryManager: MemoryManager | null = null

export function getGlobalMemoryManager(): MemoryManager {
  if (!globalMemoryManager) {
    globalMemoryManager = new MemoryManager({
      enableMonitoring: process.env.NODE_ENV !== 'production',
      memoryThreshold: 500,
      cleanupInterval: 60000,
      autoCleanup: true
    })
  }
  return globalMemoryManager
}

/**
 * 重置全局内存管理器（主要用于测试）
 */
export function resetGlobalMemoryManager(): void {
  if (globalMemoryManager) {
    globalMemoryManager.destroy()
    globalMemoryManager = null
  }
}

/**
 * 创建可清理的资源包装器
 */
export function createCleanupable<T extends object>(
  resource: T,
  cleanupFn: (resource: T) => void | Promise<void>
): T & ICleanupable {
  return Object.assign(resource as any, {
    cleanup: () => cleanupFn(resource),
    isCleanedUp: false
  }) as T & ICleanupable
}

/**
 * 装饰器：自动管理资源生命周期
 */
export function managedResource(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value

  descriptor.value = async function (this: any, ...args: any[]) {
    const memoryManager = getGlobalMemoryManager()
    const resourceManager = memoryManager.getResourceManager()
    const resourceId = `${target.constructor.name}.${propertyKey}_${Date.now()}`

    try {
      const result = await originalMethod.apply(this, args)

      // 如果返回值是可清理的资源，注册它
      if (result && typeof result.cleanup === 'function') {
        resourceManager.register(resourceId, result)
      }

      return result
    } catch (error) {
      // 出错时确保清理
      resourceManager.unregister(resourceId)
      throw error
    }
  }

  return descriptor
}

/**
 * 创建流处理器实例
 *
 * @returns 流处理器实例
 */
export function createStreamProcessor(): StreamProcessor {
  return new StreamProcessor()
}

/**
 * 创建 GC 优化器实例
 *
 * @returns GC 优化器实例
 */
export function createGCOptimizer(): GCOptimizer {
  return createGCOptimizerFactory()
}
