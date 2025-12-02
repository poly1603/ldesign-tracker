/**
 * 资源管理器
 * 
 * 负责管理和清理各种资源（定时器、监听器、文件监听器等）
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import { EventEmitter } from 'events'

/**
 * 资源清理接口
 */
export interface ICleanupable {
  cleanup(): void | Promise<void>
  isCleanedUp?: boolean
}

/**
 * 资源管理器类
 */
export class ResourceManager implements ICleanupable {
  private resources = new Map<string, ICleanupable>()
  private timers = new Set<NodeJS.Timeout>()
  private watchers = new Set<any>()
  private listeners = new Map<EventEmitter, Map<string | symbol, Set<Function>>>()
  private isDestroyed = false

  /**
   * 注册资源
   * 
   * @param id - 资源 ID
   * @param resource - 可清理的资源对象
   */
  register(id: string, resource: ICleanupable): void {
    if (this.isDestroyed) {
      // 在测试环境中，允许重新初始化
      if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') {
        this.isDestroyed = false
        this.resources.clear()
        this.timers.clear()
        this.watchers.clear()
        this.listeners.clear()
      }
      else {
        throw new Error('ResourceManager has been destroyed')
      }
    }
    this.resources.set(id, resource)
  }

  /**
   * 注销资源
   * 
   * @param id - 资源 ID
   */
  unregister(id: string): void {
    const resource = this.resources.get(id)
    if (resource && !resource.isCleanedUp) {
      this.cleanupResource(resource)
    }
    this.resources.delete(id)
  }

  /**
   * 添加定时器
   * 
   * @param timer - 定时器对象
   */
  addTimer(timer: NodeJS.Timeout): void {
    this.timers.add(timer)
  }

  /**
   * 清除定时器
   * 
   * @param timer - 定时器对象
   */
  clearTimer(timer: NodeJS.Timeout): void {
    clearTimeout(timer)
    clearInterval(timer)
    this.timers.delete(timer)
  }

  /**
   * 添加文件监听器
   * 
   * @param watcher - 文件监听器对象
   */
  addWatcher(watcher: any): void {
    this.watchers.add(watcher)
  }

  /**
   * 添加事件监听器追踪
   * 
   * @param emitter - 事件发射器
   * @param event - 事件名称
   * @param listener - 监听器函数
   */
  trackListener(emitter: EventEmitter, event: string | symbol, listener: Function): void {
    if (!this.listeners.has(emitter)) {
      this.listeners.set(emitter, new Map())
    }
    const events = this.listeners.get(emitter)!
    if (!events.has(event)) {
      events.set(event, new Set())
    }
    events.get(event)!.add(listener)
  }

  /**
   * 移除事件监听器追踪
   * 
   * @param emitter - 事件发射器
   * @param event - 事件名称
   * @param listener - 监听器函数
   */
  untrackListener(emitter: EventEmitter, event: string | symbol, listener: Function): void {
    const events = this.listeners.get(emitter)
    if (!events) return

    const listeners = events.get(event)
    if (listeners) {
      listeners.delete(listener)
      if (listeners.size === 0) {
        events.delete(event)
      }
    }

    if (events.size === 0) {
      this.listeners.delete(emitter)
    }
  }

  /**
   * 清理单个资源
   * 
   * @param resource - 要清理的资源
   */
  private async cleanupResource(resource: ICleanupable): Promise<void> {
    if (resource.isCleanedUp) return

    try {
      await resource.cleanup()
      resource.isCleanedUp = true
    }
    catch (error) {
      console.error('资源清理失败:', error)
    }
  }

  /**
   * 清理所有资源
   */
  async cleanup(): Promise<void> {
    if (this.isDestroyed) return

    // 清理所有定时器
    for (const timer of this.timers) {
      this.clearTimer(timer)
    }
    this.timers.clear()

    // 清理所有文件监听器
    for (const watcher of this.watchers) {
      if (watcher && typeof watcher.close === 'function') {
        try {
          await watcher.close()
        }
        catch (error) {
          console.error('关闭文件监听器失败:', error)
        }
      }
    }
    this.watchers.clear()

    // 清理所有事件监听器
    for (const [emitter, events] of this.listeners) {
      for (const [event, listeners] of events) {
        for (const listener of listeners) {
          try {
            emitter.removeListener(event, listener as any)
          }
          catch (error) {
            console.error('移除事件监听器失败:', error)
          }
        }
      }
    }
    this.listeners.clear()

    // 清理所有注册的资源
    for (const resource of this.resources.values()) {
      await this.cleanupResource(resource)
    }
    this.resources.clear()

    this.isDestroyed = true
  }

  /**
   * 获取资源统计
   *
   * @returns 资源统计信息
   */
  getStats(): {
    resources: number
    timers: number
    watchers: number
    listeners: number
  } {
    let listenerCount = 0
    for (const events of this.listeners.values()) {
      for (const listeners of events.values()) {
        listenerCount += listeners.size
      }
    }

    return {
      resources: this.resources.size,
      timers: this.timers.size,
      watchers: this.watchers.size,
      listeners: listenerCount,
    }
  }
}

