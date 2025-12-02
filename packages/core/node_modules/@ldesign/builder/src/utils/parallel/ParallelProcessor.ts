/**
 * 并行处理器
 * 
 * 提供高效的并行任务处理能力，支持任务队列、优先级、超时等
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import { EventEmitter } from 'events'
import * as os from 'os'
import { Logger } from '../logger'

/**
 * 任务状态
 */
export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  TIMEOUT = 'timeout',
  CANCELLED = 'cancelled'
}

/**
 * 任务定义
 */
export interface Task<T = any, R = any> {
  id: string
  fn: (data: T) => Promise<R>
  data: T
  priority?: number
  timeout?: number
  retries?: number
  onProgress?: (progress: number) => void
}

/**
 * 任务结果
 */
export interface TaskResult<R = any> {
  id: string
  status: TaskStatus
  result?: R
  error?: Error
  duration: number
  retryCount: number
}

/**
 * 并行处理器选项
 */
export interface ParallelProcessorOptions {
  /** 最大并发数 */
  maxConcurrency?: number
  /** 默认超时时间 (ms) */
  defaultTimeout?: number
  /** 默认重试次数 */
  defaultRetries?: number
  /** 是否启用优先级队列 */
  enablePriority?: boolean
  /** 是否自动调整并发数 */
  autoAdjustConcurrency?: boolean
  /** 是否启用智能调度 */
  enableSmartScheduling?: boolean
  /** 内存使用阈值(百分比) */
  memoryThreshold?: number
  /** CPU 使用阈值(百分比) */
  cpuThreshold?: number
}

/**
 * 并行处理器
 */
export class ParallelProcessor extends EventEmitter {
  private maxConcurrency: number
  private defaultTimeout: number
  private defaultRetries: number
  private enablePriority: boolean
  private autoAdjustConcurrency: boolean
  private enableSmartScheduling: boolean
  private memoryThreshold: number
  private cpuThreshold: number
  private logger: Logger

  private runningTasks = new Map<string, { task: Task; startTime: number; estimatedDuration?: number }>()
  private pendingTasks: Task[] = []
  private completedTasks: TaskResult[] = []
  private currentConcurrency = 0

  // 智能调度相关
  private taskHistory: Map<string, { avgDuration: number; successRate: number; count: number }> = new Map()
  private lastAdjustTime = Date.now()
  private adjustInterval = 5000 // 5秒调整一次

  // 性能指标
  private performanceMetrics = {
    totalTasks: 0,
    successfulTasks: 0,
    failedTasks: 0,
    avgDuration: 0,
    throughput: 0 // 任务/秒
  }

  constructor(options: ParallelProcessorOptions = {}) {
    super()

    this.maxConcurrency = options.maxConcurrency || Math.max(1, os.cpus().length - 1)
    this.defaultTimeout = options.defaultTimeout || 30000
    this.defaultRetries = options.defaultRetries || 0
    this.enablePriority = options.enablePriority !== false
    this.autoAdjustConcurrency = options.autoAdjustConcurrency || false
    this.enableSmartScheduling = options.enableSmartScheduling !== false
    this.memoryThreshold = options.memoryThreshold || 85 // 85%
    this.cpuThreshold = options.cpuThreshold || 90 // 90%
    this.logger = new Logger({ prefix: 'ParallelProcessor' })

    this.logger.debug(`初始化并行处理器，最大并发数: ${this.maxConcurrency}`)

    // 启动性能监控
    if (this.autoAdjustConcurrency) {
      this.startPerformanceMonitoring()
    }
  }

  /**
   * 添加任务
   */
  addTask<T, R>(task: Task<T, R>): void {
    const fullTask: Task<T, R> = {
      ...task,
      priority: task.priority ?? 0,
      timeout: task.timeout ?? this.defaultTimeout,
      retries: task.retries ?? this.defaultRetries
    }

    this.pendingTasks.push(fullTask)

    // 如果启用优先级，按优先级排序
    if (this.enablePriority) {
      this.pendingTasks.sort((a, b) => (b.priority || 0) - (a.priority || 0))
    }

    this.emit('task:added', task.id)
    this.processQueue()
  }

  /**
   * 批量添加任务
   */
  addTasks<T, R>(tasks: Task<T, R>[]): void {
    tasks.forEach(task => this.addTask(task))
  }

  /**
   * 处理任务队列（优化版）
   */
  private async processQueue(): Promise<void> {
    // 智能调度：根据系统资源动态调整并发数
    if (this.autoAdjustConcurrency && Date.now() - this.lastAdjustTime > this.adjustInterval) {
      await this.smartAdjustConcurrency()
      this.lastAdjustTime = Date.now()
    }

    // 智能任务选择：优先处理预计耗时短的高优先级任务
    if (this.enableSmartScheduling && this.pendingTasks.length > 1) {
      this.smartSortTasks()
    }

    while (
      this.pendingTasks.length > 0 &&
      this.currentConcurrency < this.maxConcurrency
    ) {
      const task = this.pendingTasks.shift()
      if (!task) break

      this.currentConcurrency++
      this.runTask(task)
    }
  }

  /**
   * 智能任务排序
   * 结合优先级、预估耗时和成功率进行综合排序
   */
  private smartSortTasks(): void {
    this.pendingTasks.sort((a, b) => {
      const priorityA = a.priority || 0
      const priorityB = b.priority || 0

      // 获取任务历史信息
      const historyA = this.getTaskHistory(a.id)
      const historyB = this.getTaskHistory(b.id)

      // 计算任务得分 = 优先级 * 成功率 / 预估耗时
      const scoreA = (priorityA + 1) * historyA.successRate / (historyA.avgDuration || 1)
      const scoreB = (priorityB + 1) * historyB.successRate / (historyB.avgDuration || 1)

      return scoreB - scoreA // 降序
    })
  }

  /**
   * 获取任务历史信息
   */
  private getTaskHistory(taskId: string): { avgDuration: number; successRate: number; count: number } {
    // 提取任务类型（去除时间戳等）
    const taskType = taskId.split('-')[0] || taskId
    return this.taskHistory.get(taskType) || {
      avgDuration: this.defaultTimeout / 2,
      successRate: 0.8,
      count: 0
    }
  }

  /**
   * 更新任务历史
   */
  private updateTaskHistory(taskId: string, duration: number, success: boolean): void {
    const taskType = taskId.split('-')[0] || taskId
    const history = this.taskHistory.get(taskType) || {
      avgDuration: 0,
      successRate: 0,
      count: 0
    }

    // 指数移动平均
    const alpha = 0.3 // 权重因子
    history.avgDuration = history.count === 0
      ? duration
      : history.avgDuration * (1 - alpha) + duration * alpha

    history.successRate = history.count === 0
      ? (success ? 1 : 0)
      : history.successRate * (1 - alpha) + (success ? 1 : 0) * alpha

    history.count++

    this.taskHistory.set(taskType, history)
  }

  /**
   * 运行单个任务（优化版）
   */
  private async runTask<T, R>(task: Task<T, R>): Promise<void> {
    const startTime = Date.now()
    const history = this.getTaskHistory(task.id)
    this.runningTasks.set(task.id, { task, startTime, estimatedDuration: history.avgDuration })
    this.emit('task:start', task.id)

    let retryCount = 0
    let lastError: Error | undefined
    let success = false

    while (retryCount <= (task.retries || 0)) {
      try {
        const result = await this.executeWithTimeout(task)

        const duration = Date.now() - startTime
        const taskResult: TaskResult<R> = {
          id: task.id,
          status: TaskStatus.COMPLETED,
          result,
          duration,
          retryCount
        }

        this.completedTasks.push(taskResult)
        this.emit('task:complete', taskResult)

        // 更新性能指标
        this.updatePerformanceMetrics(duration, true)
        success = true
        break
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        if (retryCount < (task.retries || 0)) {
          retryCount++
          this.logger.debug(`任务 ${task.id} 失败，重试 ${retryCount}/${task.retries}`)
          this.emit('task:retry', { id: task.id, retryCount, error: lastError })

          // 指数退避
          await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(2, retryCount), 10000)))
        } else {
          const duration = Date.now() - startTime
          const taskResult: TaskResult = {
            id: task.id,
            status: TaskStatus.FAILED,
            error: lastError,
            duration,
            retryCount
          }

          this.completedTasks.push(taskResult)
          this.emit('task:failed', taskResult)

          // 更新性能指标
          this.updatePerformanceMetrics(duration, false)
          break
        }
      }
    }

    // 更新任务历史
    const duration = Date.now() - startTime
    this.updateTaskHistory(task.id, duration, success)

    this.runningTasks.delete(task.id)
    this.currentConcurrency--

    // 继续处理队列
    this.processQueue()
  }

  /**
   * 更新性能指标
   */
  private updatePerformanceMetrics(duration: number, success: boolean): void {
    this.performanceMetrics.totalTasks++
    if (success) {
      this.performanceMetrics.successfulTasks++
    } else {
      this.performanceMetrics.failedTasks++
    }

    // 指数移动平均
    const alpha = 0.2
    this.performanceMetrics.avgDuration = this.performanceMetrics.totalTasks === 1
      ? duration
      : this.performanceMetrics.avgDuration * (1 - alpha) + duration * alpha

    // 计算吞吐量（任务/秒）
    this.performanceMetrics.throughput = 1000 / this.performanceMetrics.avgDuration
  }

  /**
   * 带超时的任务执行
   */
  private async executeWithTimeout<T, R>(task: Task<T, R>): Promise<R> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`任务 ${task.id} 超时 (${task.timeout}ms)`))
      }, task.timeout!)

      task.fn(task.data)
        .then(result => {
          clearTimeout(timeout)
          resolve(result)
        })
        .catch(error => {
          clearTimeout(timeout)
          reject(error)
        })
    })
  }

  /**
   * 智能调整并发数
   * 综合考虑内存、CPU、任务成功率等因素
   */
  private async smartAdjustConcurrency(): Promise<void> {
    const memUsage = process.memoryUsage()
    const heapUsedRatio = (memUsage.heapUsed / memUsage.heapTotal) * 100

    // 获取系统资源使用情况
    const cpuCount = os.cpus().length
    const loadAvg = os.loadavg()[0] / cpuCount * 100 // 转换为百分比

    // 计算成功率
    const successRate = this.performanceMetrics.totalTasks > 0
      ? (this.performanceMetrics.successfulTasks / this.performanceMetrics.totalTasks) * 100
      : 100

    // 决策逻辑
    let adjustment = 0

    // 内存压力大 - 降低并发
    if (heapUsedRatio > this.memoryThreshold) {
      adjustment = -1
      this.logger.debug(`内存使用率 ${heapUsedRatio.toFixed(1)}% 过高，降低并发`)
    }
    // CPU 压力大 - 降低并发
    else if (loadAvg > this.cpuThreshold) {
      adjustment = -1
      this.logger.debug(`CPU 使用率 ${loadAvg.toFixed(1)}% 过高，降低并发`)
    }
    // 成功率低 - 可能并发过高，降低并发
    else if (successRate < 70 && this.performanceMetrics.totalTasks > 10) {
      adjustment = -1
      this.logger.debug(`任务成功率 ${successRate.toFixed(1)}% 过低，降低并发`)
    }
    // 资源充足且成功率高 - 提高并发
    else if (
      heapUsedRatio < this.memoryThreshold * 0.7 &&
      loadAvg < this.cpuThreshold * 0.7 &&
      successRate > 90 &&
      this.maxConcurrency < cpuCount * 2
    ) {
      adjustment = 1
      this.logger.debug(`系统资源充足，提升并发`)
    }

    // 应用调整
    if (adjustment !== 0) {
      const oldConcurrency = this.maxConcurrency
      this.maxConcurrency = Math.max(1, Math.min(cpuCount * 2, this.maxConcurrency + adjustment))

      if (this.maxConcurrency !== oldConcurrency) {
        this.logger.info(`并发数调整: ${oldConcurrency} -> ${this.maxConcurrency}`)
        this.emit('concurrency:adjusted', {
          old: oldConcurrency,
          new: this.maxConcurrency,
          reason: adjustment > 0 ? 'increase' : 'decrease'
        })
      }
    }
  }

  /**
   * 启动性能监控
   */
  private startPerformanceMonitoring(): void {
    // 每5秒记录一次性能指标
    const interval = setInterval(() => {
      if (this.runningTasks.size === 0 && this.pendingTasks.length === 0) {
        return
      }

      const metrics = {
        pending: this.pendingTasks.length,
        running: this.runningTasks.size,
        completed: this.performanceMetrics.totalTasks,
        successRate: this.performanceMetrics.totalTasks > 0
          ? (this.performanceMetrics.successfulTasks / this.performanceMetrics.totalTasks) * 100
          : 0,
        avgDuration: this.performanceMetrics.avgDuration,
        throughput: this.performanceMetrics.throughput,
        concurrency: this.maxConcurrency
      }

      this.emit('performance:metrics', metrics)
    }, 5000)

    // 清理监控（在 dispose 时）
    this.once('dispose', () => {
      clearInterval(interval)
    })
  }

  /**
   * 取消任务
   */
  cancelTask(taskId: string): boolean {
    // 从待处理队列中移除
    const index = this.pendingTasks.findIndex(t => t.id === taskId)
    if (index !== -1) {
      this.pendingTasks.splice(index, 1)
      this.emit('task:cancelled', taskId)
      return true
    }

    // 正在运行的任务无法取消（可以扩展支持 AbortController）
    return false
  }

  /**
   * 等待所有任务完成
   */
  async waitAll(): Promise<TaskResult[]> {
    return new Promise((resolve) => {
      const check = () => {
        if (this.pendingTasks.length === 0 && this.runningTasks.size === 0) {
          resolve(this.completedTasks)
        } else {
          setTimeout(check, 100)
        }
      }
      check()
    })
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    pending: number
    running: number
    completed: number
    failed: number
    maxConcurrency: number
    currentConcurrency: number
  } {
    const failed = this.completedTasks.filter(t => t.status === TaskStatus.FAILED).length

    return {
      pending: this.pendingTasks.length,
      running: this.runningTasks.size,
      completed: this.completedTasks.length,
      failed,
      maxConcurrency: this.maxConcurrency,
      currentConcurrency: this.currentConcurrency
    }
  }

  /**
   * 清空所有任务
   */
  clear(): void {
    this.pendingTasks = []
    this.completedTasks = []
    this.emit('cleared')
  }

  /**
   * 获取性能指标
   */
  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      pending: this.pendingTasks.length,
      running: this.runningTasks.size,
      maxConcurrency: this.maxConcurrency,
      taskHistory: Array.from(this.taskHistory.entries()).map(([type, history]) => ({
        type,
        ...history
      }))
    }
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.emit('dispose')
    this.clear()
    this.removeAllListeners()
    this.taskHistory.clear()
    this.runningTasks.clear()
  }
}

/**
 * 创建并行处理器
 */
export function createParallelProcessor(
  options?: ParallelProcessorOptions
): ParallelProcessor {
  return new ParallelProcessor(options)
}

