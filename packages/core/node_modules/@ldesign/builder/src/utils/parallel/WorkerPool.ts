/**
 * Worker 线程池
 * 
 * 使用 worker_threads 实现真正的多线程并行构建
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import { Worker } from 'worker_threads'
import { EventEmitter } from 'events'
import os from 'os'
import path from 'path'

/**
 * Worker 池选项
 */
export interface WorkerPoolOptions {
  /** 最大 Worker 数量 */
  maxWorkers?: number
  /** Worker 脚本路径 */
  workerScript: string
  /** 默认超时时间（毫秒） */
  timeout?: number
  /** 内存限制（MB） */
  memoryLimit?: number
  /** Worker 数据 */
  workerData?: any
}

/**
 * Worker 任务
 */
export interface WorkerTask<T = any> {
  /** 任务ID */
  id: string
  /** 任务类型 */
  type: string
  /** 任务数据 */
  data: T
  /** 超时时间 */
  timeout?: number
  /** 优先级 */
  priority?: number
}

/**
 * Worker 任务结果
 */
export interface WorkerTaskResult<T = any> {
  /** 任务ID */
  id: string
  /** 是否成功 */
  success: boolean
  /** 结果数据 */
  data?: T
  /** 错误信息 */
  error?: string
  /** 执行时间 */
  duration: number
}

/**
 * Worker 状态
 */
interface WorkerState {
  worker: Worker
  busy: boolean
  taskId: string | null
  startTime: number
}

/**
 * Worker 线程池
 */
export class WorkerPool extends EventEmitter {
  private workers: WorkerState[] = []
  private taskQueue: Array<{ task: WorkerTask; resolve: Function; reject: Function }> = []
  private maxWorkers: number
  private workerScript: string
  private timeout: number
  private memoryLimit: number
  private workerData: any
  private terminated = false

  constructor(options: WorkerPoolOptions) {
    super()

    this.maxWorkers = options.maxWorkers || os.cpus().length
    this.workerScript = path.resolve(options.workerScript)
    this.timeout = options.timeout || 30000
    this.memoryLimit = options.memoryLimit || 512
    this.workerData = options.workerData

    this.initializeWorkers()
  }

  /**
   * 初始化 Worker 池
   */
  private initializeWorkers(): void {
    for (let i = 0; i < this.maxWorkers; i++) {
      this.createWorker()
    }
  }

  /**
   * 创建 Worker
   */
  private createWorker(): WorkerState {
    const worker = new Worker(this.workerScript, {
      workerData: this.workerData,
      resourceLimits: {
        maxOldGenerationSizeMb: this.memoryLimit,
        maxYoungGenerationSizeMb: Math.floor(this.memoryLimit / 4)
      }
    })

    const state: WorkerState = {
      worker,
      busy: false,
      taskId: null,
      startTime: 0
    }

    worker.on('error', (error) => {
      this.handleWorkerError(state, error)
    })

    worker.on('exit', (code) => {
      this.handleWorkerExit(state, code)
    })

    this.workers.push(state)

    return state
  }

  /**
   * 执行任务
   */
  async execute<T = any>(task: WorkerTask<T>): Promise<T> {
    if (this.terminated) {
      throw new Error('WorkerPool has been terminated')
    }

    return new Promise((resolve, reject) => {
      const workerState = this.getAvailableWorker()

      if (workerState) {
        this.executeOnWorker(workerState, task, resolve, reject)
      } else {
        // 加入队列
        this.taskQueue.push({ task, resolve, reject })
        this.emit('task-queued', task)
      }
    })
  }

  /**
   * 批量执行任务
   */
  async executeBatch<T = any>(tasks: WorkerTask<T>[]): Promise<T[]> {
    return Promise.all(tasks.map(task => this.execute(task)))
  }

  /**
   * 在 Worker 上执行任务（带监听器清理）
   */
  private executeOnWorker(
    workerState: WorkerState,
    task: WorkerTask,
    resolve: Function,
    reject: Function
  ): void {
    workerState.busy = true
    workerState.taskId = task.id
    workerState.startTime = Date.now()

    const taskTimeout = task.timeout || this.timeout
    let timeoutId: NodeJS.Timeout | undefined
    let isCompleted = false

    // 清理函数 - 确保所有资源都被释放
    const cleanup = () => {
      if (isCompleted) return
      isCompleted = true

      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = undefined
      }

      // 移除事件监听器
      workerState.worker.removeListener('message', messageHandler)
      workerState.worker.removeListener('error', errorHandler)

      workerState.busy = false
      workerState.taskId = null
    }

    // 消息处理
    const messageHandler = (result: WorkerTaskResult) => {
      cleanup()

      this.emit('task-complete', result)

      if (result.success) {
        resolve(result.data)
      } else {
        reject(new Error(result.error || 'Unknown error'))
      }

      // 处理队列中的下一个任务
      this.processQueue()
    }

    // 错误处理
    const errorHandler = (error: Error) => {
      cleanup()

      this.emit('task-error', { task, error })
      reject(error)

      // 处理队列中的下一个任务
      this.processQueue()
    }

    // 超时处理
    timeoutId = setTimeout(() => {
      cleanup()
      this.handleTaskTimeout(workerState, task)
      reject(new Error(`Task ${task.id} timeout after ${taskTimeout}ms`))
    }, taskTimeout)

    workerState.worker.once('message', messageHandler)
    workerState.worker.once('error', errorHandler)

    // 发送任务
    try {
      workerState.worker.postMessage({
        type: 'task',
        task
      })
      this.emit('task-start', task)
    } catch (error) {
      // 如果发送失败，清理并拒绝
      cleanup()
      reject(error)
    }
  }

  /**
   * 获取可用的 Worker
   */
  private getAvailableWorker(): WorkerState | null {
    return this.workers.find(state => !state.busy) || null
  }

  /**
   * 处理队列
   */
  private processQueue(): void {
    if (this.taskQueue.length === 0) return

    const workerState = this.getAvailableWorker()
    if (!workerState) return

    const { task, resolve, reject } = this.taskQueue.shift()!
    this.executeOnWorker(workerState, task, resolve, reject)
  }

  /**
   * 处理 Worker 错误
   */
  private handleWorkerError(workerState: WorkerState, error: Error): void {
    this.emit('worker-error', { worker: workerState, error })

    // 重新创建 Worker
    const index = this.workers.indexOf(workerState)
    if (index !== -1) {
      this.workers[index] = this.createWorker()
    }
  }

  /**
   * 处理 Worker 退出
   */
  private handleWorkerExit(workerState: WorkerState, code: number): void {
    this.emit('worker-exit', { worker: workerState, code })

    if (code !== 0 && !this.terminated) {
      // 异常退出，重新创建
      const index = this.workers.indexOf(workerState)
      if (index !== -1) {
        this.workers[index] = this.createWorker()
      }
    }
  }

  /**
   * 处理任务超时
   */
  private handleTaskTimeout(workerState: WorkerState, task: WorkerTask): void {
    this.emit('task-timeout', task)

    // 终止超时的 Worker
    workerState.worker.terminate()

    // 重新创建 Worker
    const index = this.workers.indexOf(workerState)
    if (index !== -1) {
      this.workers[index] = this.createWorker()
    }
  }

  /**
   * 获取池状态
   */
  getStatus() {
    return {
      maxWorkers: this.maxWorkers,
      activeWorkers: this.workers.filter(s => s.busy).length,
      idleWorkers: this.workers.filter(s => !s.busy).length,
      queuedTasks: this.taskQueue.length,
      terminated: this.terminated
    }
  }

  /**
   * 终止所有 Worker
   */
  async terminate(): Promise<void> {
    if (this.terminated) return

    this.terminated = true
    this.taskQueue = []

    await Promise.all(
      this.workers.map(state => state.worker.terminate())
    )

    this.workers = []
    this.emit('terminated')
  }
}

/**
 * 创建 Worker 池
 */
export function createWorkerPool(options: WorkerPoolOptions): WorkerPool {
  return new WorkerPool(options)
}
