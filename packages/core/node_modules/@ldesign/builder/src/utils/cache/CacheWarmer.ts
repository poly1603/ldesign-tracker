/**
 * 缓存预热器
 * 
 * 在后台预热常用构建配置的缓存，提高后续构建速度
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import path from 'path'
import { EventEmitter } from 'events'
import { exists, readFile, findFiles } from '../file-system'

/**
 * 预热任务
 */
export interface WarmupTask {
  id: string
  type: 'module' | 'dependency' | 'transform'
  path: string
  priority: number
}

/**
 * 预热结果
 */
export interface WarmupResult {
  total: number
  warmed: number
  failed: number
  duration: number
  tasks: { id: string; success: boolean; duration: number }[]
}

/**
 * 预热选项
 */
export interface CacheWarmerOptions {
  /** 并发数 */
  concurrency?: number
  /** 优先预热的文件模式 */
  priorityPatterns?: string[]
  /** 跳过的文件模式 */
  skipPatterns?: string[]
  /** 最大预热文件数 */
  maxFiles?: number
}

/**
 * 缓存预热器
 */
export class CacheWarmer extends EventEmitter {
  private opts: Required<CacheWarmerOptions>
  private isWarming = false
  private aborted = false

  constructor(options: CacheWarmerOptions = {}) {
    super()
    this.opts = {
      concurrency: options.concurrency ?? 4,
      priorityPatterns: options.priorityPatterns ?? ['**/index.ts', '**/main.ts', '**/entry.ts'],
      skipPatterns: options.skipPatterns ?? ['**/*.test.ts', '**/*.spec.ts', '**/__tests__/**'],
      maxFiles: options.maxFiles ?? 200
    }
  }

  /**
   * 执行预热
   */
  async warmup(projectPath: string, cacheSet: (key: string, data: any) => Promise<void>): Promise<WarmupResult> {
    if (this.isWarming) throw new Error('预热任务正在进行中')
    
    this.isWarming = true
    this.aborted = false
    const startTime = Date.now()
    const results: { id: string; success: boolean; duration: number }[] = []

    try {
      const tasks = await this.collectTasks(projectPath)
      this.emit('warmup:start', { total: tasks.length })

      // 按优先级分批处理
      const batches = this.createBatches(tasks, this.opts.concurrency)
      let warmed = 0
      let failed = 0

      for (const batch of batches) {
        if (this.aborted) break

        const batchResults = await Promise.allSettled(
          batch.map(task => this.warmupTask(task, projectPath, cacheSet))
        )

        for (let i = 0; i < batchResults.length; i++) {
          const result = batchResults[i]
          const task = batch[i]
          const success = result.status === 'fulfilled'
          const duration = success ? (result.value as number) : 0

          results.push({ id: task.id, success, duration })
          if (success) warmed++
          else failed++

          this.emit('warmup:progress', { warmed, failed, total: tasks.length })
        }
      }

      const finalResult: WarmupResult = {
        total: tasks.length,
        warmed,
        failed,
        duration: Date.now() - startTime,
        tasks: results
      }

      this.emit('warmup:complete', finalResult)
      return finalResult
    } finally {
      this.isWarming = false
    }
  }

  /**
   * 终止预热
   */
  abort(): void {
    this.aborted = true
    this.emit('warmup:abort')
  }

  /**
   * 收集预热任务
   */
  private async collectTasks(projectPath: string): Promise<WarmupTask[]> {
    const srcPath = path.join(projectPath, 'src')
    if (!await exists(srcPath)) return []

    const files = await findFiles(['**/*.ts', '**/*.tsx', '**/*.vue', '**/*.svelte'], {
      cwd: srcPath,
      ignore: [...this.opts.skipPatterns, '**/node_modules/**']
    })

    // 按优先级排序
    const priorityFiles = files.filter(f => 
      this.opts.priorityPatterns.some(p => this.matchPattern(f, p))
    )
    const regularFiles = files.filter(f => !priorityFiles.includes(f))

    const allFiles = [...priorityFiles, ...regularFiles].slice(0, this.opts.maxFiles)

    return allFiles.map((file, index) => ({
      id: `warmup:${file}`,
      type: 'module' as const,
      path: path.join(srcPath, file),
      priority: priorityFiles.includes(file) ? 10 : 5 - Math.floor(index / 20)
    }))
  }

  private matchPattern(file: string, pattern: string): boolean {
    const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'))
    return regex.test(file)
  }

  private createBatches<T>(items: T[], size: number): T[][] {
    const batches: T[][] = []
    for (let i = 0; i < items.length; i += size) {
      batches.push(items.slice(i, i + size))
    }
    return batches
  }

  private async warmupTask(task: WarmupTask, projectPath: string, cacheSet: (key: string, data: any) => Promise<void>): Promise<number> {
    const start = Date.now()
    const content = await readFile(task.path, 'utf-8')
    await cacheSet(task.id, { content, mtime: Date.now() })
    return Date.now() - start
  }
}

export function createCacheWarmer(opts?: CacheWarmerOptions): CacheWarmer { return new CacheWarmer(opts) }

