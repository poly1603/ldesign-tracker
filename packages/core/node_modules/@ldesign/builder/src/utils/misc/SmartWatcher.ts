/**
 * 智能文件监听器
 * 提供高性能的文件监听和变更检测
 * 
 * @author LDesign Team  
 * @version 1.0.0
 */

import { EventEmitter } from 'events'
import { watch, FSWatcher } from 'chokidar'
import path from 'path'
import { Logger } from '../logger'

/**
 * 文件变更事件
 */
export interface FileChangeEvent {
  type: 'add' | 'change' | 'unlink'
  path: string
  timestamp: number
}

/**
 * 批量变更事件
 */
export interface BatchChangeEvent {
  changes: FileChangeEvent[]
  timestamp: number
}

/**
 * 智能监听器选项
 */
export interface SmartWatcherOptions {
  /** 监听的文件模式 */
  patterns: string[]
  /** 忽略的文件模式 */
  ignored?: string | RegExp | (string | RegExp)[]
  /** 去抖延迟 (ms) */
  debounce?: number
  /** 批处理窗口 (ms) */
  batchWindow?: number
  /** 是否启用轮询 */
  usePolling?: boolean
  /** 轮询间隔 (ms) */
  interval?: number
}

/**
 * 智能文件监听器
 */
export class SmartWatcher extends EventEmitter {
  private watcher: FSWatcher | null = null
  private logger: Logger
  private options: Required<SmartWatcherOptions>
  private changeBuffer: FileChangeEvent[] = []
  private debounceTimer: NodeJS.Timeout | null = null
  private isWatching = false

  constructor(options: SmartWatcherOptions) {
    super()

    this.logger = new Logger({ prefix: 'SmartWatcher' })
    this.options = {
      patterns: options.patterns,
      ignored: options.ignored || [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/es/**',
        '**/lib/**',
        '**/*.log'
      ],
      debounce: options.debounce || 100,
      batchWindow: options.batchWindow || 300,
      usePolling: options.usePolling || false,
      interval: options.interval || 100
    }
  }

  /**
   * 启动监听
   */
  async start(): Promise<void> {
    if (this.isWatching) {
      this.logger.warn('监听器已在运行')
      return
    }

    this.watcher = watch(this.options.patterns, {
      ignored: this.options.ignored,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 100
      },
      usePolling: this.options.usePolling,
      interval: this.options.interval
    })

    // 监听文件变更
    this.watcher
      .on('add', path => this.onFileChange('add', path))
      .on('change', path => this.onFileChange('change', path))
      .on('unlink', path => this.onFileChange('unlink', path))
      .on('error', error => this.emit('error', error))
      .on('ready', () => {
        this.isWatching = true
        this.emit('ready')
      })

    this.logger.debug('文件监听已启动')
  }

  /**
   * 停止监听
   */
  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close()
      this.watcher = null
      this.isWatching = false

      // 清理定时器
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer)
        this.debounceTimer = null
      }

      this.logger.debug('文件监听已停止')
      this.emit('stopped')
    }
  }

  /**
   * 处理文件变更
   */
  private onFileChange(type: 'add' | 'change' | 'unlink', filePath: string): void {
    const changeEvent: FileChangeEvent = {
      type,
      path: path.normalize(filePath),
      timestamp: Date.now()
    }

    // 添加到缓冲区
    this.changeBuffer.push(changeEvent)

    // 去抖处理
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    this.debounceTimer = setTimeout(() => {
      this.flushChanges()
    }, this.options.debounce)
  }

  /**
   * 刷新变更
   */
  private flushChanges(): void {
    if (this.changeBuffer.length === 0) return

    const changes = [...this.changeBuffer]
    this.changeBuffer = []

    // 合并相同文件的多次变更（只保留最后一次）
    const uniqueChanges = new Map<string, FileChangeEvent>()
    for (const change of changes) {
      uniqueChanges.set(change.path, change)
    }

    const batchEvent: BatchChangeEvent = {
      changes: Array.from(uniqueChanges.values()),
      timestamp: Date.now()
    }

    this.emit('batch-change', batchEvent)

    // 分类触发事件
    const addedFiles = batchEvent.changes.filter(c => c.type === 'add')
    const changedFiles = batchEvent.changes.filter(c => c.type === 'change')
    const removedFiles = batchEvent.changes.filter(c => c.type === 'unlink')

    if (addedFiles.length > 0) {
      this.emit('files-added', addedFiles)
    }

    if (changedFiles.length > 0) {
      this.emit('files-changed', changedFiles)
    }

    if (removedFiles.length > 0) {
      this.emit('files-removed', removedFiles)
    }
  }

  /**
   * 获取监听状态
   */
  getStatus(): {
    watching: boolean
    patterns: string[]
    bufferedChanges: number
  } {
    return {
      watching: this.isWatching,
      patterns: this.options.patterns,
      bufferedChanges: this.changeBuffer.length
    }
  }
}

/**
 * 创建智能监听器
 */
export function createSmartWatcher(options: SmartWatcherOptions): SmartWatcher {
  return new SmartWatcher(options)
}

