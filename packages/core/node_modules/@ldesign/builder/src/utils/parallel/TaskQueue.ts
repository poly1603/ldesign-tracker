/**
 * 并发任务队列
 * 
 * 支持优先级、并发控制、错误处理的任务队列
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import { EventEmitter } from 'events'

/**
 * 任务定义
 */
export interface Task<T = any> {
  /** 任务ID */
  id: string
  /** 任务执行函数 */
  fn: () => Promise<T>
  /** 优先级（越大越优先） */
  priority?: number
  /** 超时时间（毫秒） */
  timeout?: number
  /** 重试次数 */
  retries?: number
  /** 依赖的任务ID */
  dependencies?: string[]
}

/**
 * 任务结果
 */
export interface TaskResult<T = any> {
  /** 任务ID */
  id: string
  /** 是否成功 */
  success: boolean
  /** 结果数据 */
  data?: T
  /** 错误信息 */
  error?: Error
  /** 执行时间（毫秒） */
  duration: number
  /** 重试次数 */
  retryCount: number
}

/**
 * 任务队列选项
 */
export interface TaskQueueOptions {
  /** 最大并发数 */
  concurrency?: number
  /** 是否自动启动 */
  autoStart?: boolean
  /** 默认超时时间 */
  defaultTimeout?: number
  /** 默认重试次数 */
  defaultRetries?: number
}

/**
 * 并发任务队列
 */
export class TaskQueue extends EventEmitter {
  private tasks = new Map<string, Task>()
  private pending: string[] = []
  private running = new Map<string, Promise<any>>()
  private results = new Map<string, TaskResult>()
  private concurrency: number
  private autoStart: boolean
  private defaultTimeout: number
  private defaultRetries: number
  private paused = false
  private destroyed = false

  constructor(options: TaskQueueOptions = {}) {
    super()
    this.concurrency = options.concurrency || 4
    this.autoStart = options.autoStart !== false
    this.defaultTimeout = options.defaultTimeout || 30000
    this.defaultRetries = options.defaultRetries || 0
  }

  /**
   * 添加任务
   */
  add<T = any>(task: Task<T>): this {
    if (this.destroyed) {
      throw new Error('Cannot add task to destroyed queue')
    }

    // 设置默认值
    task.priority = task.priority ?? 0
    task.timeout = task.timeout ?? this.defaultTimeout
    task.retries = task.retries ?? this.defaultRetries
    task.dependencies = task.dependencies ?? []

    this.tasks.set(task.id, task)
    this.pending.push(task.id)

    // 按优先级排序
    this.pending.sort((a, b) => {
      const taskA = this.tasks.get(a)!
      const taskB = this.tasks.get(b)!
      return (taskB.priority || 0) - (taskA.priority || 0)
    })

    this.emit('task-added', task)

    if (this.autoStart && !this.paused && !this.destroyed) {
      this.process()
    }

    return this
  }

  /**
   * 批量添加任务
   */
  addBatch<T = any>(tasks: Task<T>[]): this {
    for (const task of tasks) {
      this.add(task)
    }
    return this
  }

  /**
   * 启动队列
   */
  start(): void {
    this.paused = false
    this.process()
  }

  /**
   * 暂停队列
   */
  pause(): void {
    this.paused = true
  }

  /**
   * 清空队列
   */
  clear(): void {
    this.tasks.clear()
    this.pending = []
    this.results.clear()
    this.emit('cleared')
  }

  /**
   * 销毁队列，清理所有资源
   */
  destroy(): void {
    if (this.destroyed) return

    this.destroyed = true
    this.paused = true

    // 清空所有任务
    this.tasks.clear()
    this.pending = []
    this.running.clear()
    this.results.clear()

    // 移除所有事件监听器
    this.removeAllListeners()

    this.emit('destroyed')
  }

  /**
   * 等待所有任务完成
   */
  async waitAll(): Promise<Map<string, TaskResult>> {
    return new Promise((resolve, reject) => {
      if (this.pending.length === 0 && this.running.size === 0) {
        resolve(this.results)
        return
      }

      const checkCompletion = () => {
        if (this.pending.length === 0 && this.running.size === 0) {
          this.off('task-complete', checkCompletion)
          this.off('task-error', checkCompletion)
          resolve(this.results)
        }
      }

      this.on('task-complete', checkCompletion)
      this.on('task-error', checkCompletion)

      // 启动处理
      if (!this.paused) {
        this.process()
      }
    })
  }

  /**
   * 获取任务结果
   */
  getResult<T = any>(taskId: string): TaskResult<T> | undefined {
    return this.results.get(taskId) as TaskResult<T> | undefined
  }

  /**
   * 获取所有结果
   */
  getAllResults(): Map<string, TaskResult> {
    return new Map(this.results)
  }

  /**
   * 获取队列状态
   */
  getStatus() {
    return {
      total: this.tasks.size,
      pending: this.pending.length,
      running: this.running.size,
      completed: this.results.size,
      paused: this.paused
    }
  }

  /**
   * 处理队列
   */
  private process(): void {
    if (this.paused || this.destroyed) return

    // 填充到最大并发数
    while (
      this.running.size < this.concurrency &&
      this.pending.length > 0
    ) {
      const taskId = this.findReadyTask()

      if (!taskId) break

      this.executeTask(taskId)
    }
  }

  /**
   * 查找可执行的任务（依赖已满足）
   */
  private findReadyTask(): string | null {
    for (const taskId of this.pending) {
      const task = this.tasks.get(taskId)!

      // 检查依赖是否都已完成
      const dependenciesMet = task.dependencies!.every(depId => {
        const result = this.results.get(depId)
        return result && result.success
      })

      if (dependenciesMet) {
        // 从待处理列表移除
        this.pending = this.pending.filter(id => id !== taskId)
        return taskId
      }
    }

    return null
  }

  /**
   * 执行任务
   */
  private async executeTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId)!
    const startTime = Date.now()
    let retryCount = 0

    this.emit('task-start', taskId)

    const execute = async (): Promise<any> => {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Task timeout')), task.timeout)
      })

      try {
        const result = await Promise.race([
          task.fn(),
          timeoutPromise
        ])
        return result
      } catch (error) {
        if (retryCount < task.retries!) {
          retryCount++
          this.emit('task-retry', taskId, retryCount)
          return execute()
        }
        throw error
      }
    }

    const promise = execute()
      .then((data) => {
        const duration = Date.now() - startTime
        const result: TaskResult = {
          id: taskId,
          success: true,
          data,
          duration,
          retryCount
        }

        this.results.set(taskId, result)
        this.running.delete(taskId)

        this.emit('task-complete', result)
        this.process() // 继续处理

        return result
      })
      .catch((error) => {
        const duration = Date.now() - startTime
        const result: TaskResult = {
          id: taskId,
          success: false,
          error,
          duration,
          retryCount
        }

        this.results.set(taskId, result)
        this.running.delete(taskId)

        this.emit('task-error', result)
        this.process() // 继续处理

        return result
      })

    this.running.set(taskId, promise)
  }
}

/**
 * 创建任务队列
 */
export function createTaskQueue(options?: TaskQueueOptions): TaskQueue {
  return new TaskQueue(options)
}

/**
 * 并发执行任务（简化版）
 */
export async function parallel<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number = 4
): Promise<T[]> {
  const queue = new TaskQueue({ concurrency })

  tasks.forEach((fn, index) => {
    queue.add({
      id: `task-${index}`,
      fn
    })
  })

  const results = await queue.waitAll()

  return Array.from(results.values())
    .sort((a, b) => {
      const aIndex = parseInt(a.id.replace('task-', ''))
      const bIndex = parseInt(b.id.replace('task-', ''))
      return aIndex - bIndex
    })
    .map(result => {
      if (!result.success) {
        throw result.error
      }
      return result.data as T
    })
}
