/**
 * 并行构建管理器
 * 
 * 提供高效的并行构建能力，支持多格式并行输出、JS/DTS 并行生成
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import os from 'os'
import { EventEmitter } from 'events'

/**
 * 并行任务类型
 */
export type ParallelTaskType = 'format' | 'dts' | 'minify' | 'analyze'

/**
 * 并行任务
 */
export interface ParallelTask<T = unknown> {
  id: string
  type: ParallelTaskType
  name: string
  execute: () => Promise<T>
  priority?: number
  dependencies?: string[]
}

/**
 * 任务执行结果
 */
export interface TaskResult<T = unknown> {
  id: string
  success: boolean
  data?: T
  error?: Error
  duration: number
}

/**
 * 并行构建选项
 */
export interface ParallelBuildOptions {
  /** 最大并发数 */
  concurrency?: number
  /** 是否启用 DTS 并行生成 */
  parallelDts?: boolean
  /** 是否失败后继续 */
  continueOnError?: boolean
  /** 任务超时时间 (ms) */
  taskTimeout?: number
}

/**
 * 并行构建管理器
 */
export class ParallelBuildManager extends EventEmitter {
  private opts: Required<ParallelBuildOptions>
  private tasks: Map<string, ParallelTask> = new Map()
  private results: Map<string, TaskResult> = new Map()
  private running: Set<string> = new Set()

  constructor(options: ParallelBuildOptions = {}) {
    super()
    this.opts = {
      concurrency: options.concurrency ?? Math.max(1, os.cpus().length - 1),
      parallelDts: options.parallelDts ?? true,
      continueOnError: options.continueOnError ?? true,
      taskTimeout: options.taskTimeout ?? 120000
    }
  }

  /**
   * 添加构建任务
   */
  addTask<T>(task: ParallelTask<T>): this {
    this.tasks.set(task.id, task as ParallelTask)
    return this
  }

  /**
   * 批量添加格式构建任务
   */
  addFormatTasks(formats: string[], buildFn: (format: string) => Promise<unknown>): this {
    for (const format of formats) {
      this.addTask({
        id: `format:${format}`,
        type: 'format',
        name: `构建 ${format.toUpperCase()} 格式`,
        execute: () => buildFn(format),
        priority: format === 'esm' ? 10 : 5
      })
    }
    return this
  }

  /**
   * 添加 DTS 生成任务
   */
  addDtsTask(outDirs: string[], generateFn: (outDir: string) => Promise<unknown>): this {
    for (const dir of outDirs) {
      this.addTask({
        id: `dts:${dir}`,
        type: 'dts',
        name: `生成 ${dir} 类型声明`,
        execute: () => generateFn(dir),
        priority: 1
      })
    }
    return this
  }

  /**
   * 执行所有任务
   */
  async execute(): Promise<Map<string, TaskResult>> {
    const sortedTasks = this.sortTasksByPriority()
    const pending = [...sortedTasks]
    const executing: Promise<void>[] = []

    const runTask = async (task: ParallelTask): Promise<void> => {
      const startTime = Date.now()
      this.running.add(task.id)
      this.emit('task:start', { id: task.id, name: task.name })

      try {
        const data = await Promise.race([
          task.execute(),
          this.createTimeout(task.id)
        ])
        this.results.set(task.id, { id: task.id, success: true, data, duration: Date.now() - startTime })
        this.emit('task:complete', { id: task.id, success: true, duration: Date.now() - startTime })
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        this.results.set(task.id, { id: task.id, success: false, error: err, duration: Date.now() - startTime })
        this.emit('task:error', { id: task.id, error: err })
        if (!this.opts.continueOnError) throw err
      } finally {
        this.running.delete(task.id)
      }
    }

    while (pending.length > 0 || executing.length > 0) {
      // 填充并发槽
      while (pending.length > 0 && this.running.size < this.opts.concurrency) {
        const task = pending.shift()!
        if (this.canRun(task)) {
          executing.push(runTask(task))
        } else {
          pending.push(task) // 依赖未满足，放回队列
        }
      }
      if (executing.length > 0) {
        await Promise.race(executing)
        executing.length = 0 // 清空执行列表，重新填充
      }
    }

    return this.results
  }

  private sortTasksByPriority(): ParallelTask[] {
    return [...this.tasks.values()].sort((a, b) => (b.priority || 0) - (a.priority || 0))
  }

  private canRun(task: ParallelTask): boolean {
    if (!task.dependencies?.length) return true
    return task.dependencies.every(dep => this.results.has(dep) && this.results.get(dep)!.success)
  }

  private createTimeout(taskId: string): Promise<never> {
    return new Promise((_, reject) => setTimeout(() => reject(new Error(`任务 ${taskId} 超时`)), this.opts.taskTimeout))
  }

  /** 获取统计信息 */
  getStats(): { total: number; success: number; failed: number; totalDuration: number } {
    const results = [...this.results.values()]
    return { total: results.length, success: results.filter(r => r.success).length, failed: results.filter(r => !r.success).length, totalDuration: results.reduce((sum, r) => sum + r.duration, 0) }
  }
}

export function createParallelBuildManager(opts?: ParallelBuildOptions): ParallelBuildManager { return new ParallelBuildManager(opts) }

