/**
 * 构建上下文管理器
 * 
 * 负责管理构建过程中的上下文信息,包括:
 * - 构建状态
 * - 性能指标
 * - 统计信息
 * - 事件发射
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import { EventEmitter } from 'events'
import type { BuilderStatus, BuildResult } from '../types/builder'
import type { BuilderConfig } from '../types/config'
import type { LibraryType } from '../types/library'
import type { BundlerType } from '../types/bundler'
import { Logger } from '../utils/logger'
import * as crypto from 'crypto'

/**
 * 构建上下文接口
 */
export interface IBuildContext {
  /** 构建 ID */
  buildId: string
  
  /** 构建状态 */
  status: BuilderStatus
  
  /** 项目根目录 */
  projectRoot: string
  
  /** 库类型 */
  libraryType?: LibraryType
  
  /** 打包器类型 */
  bundler: BundlerType
  
  /** 构建模式 */
  mode: 'development' | 'production'
  
  /** 开始时间 */
  startTime: number
  
  /** 结束时间 */
  endTime?: number
  
  /** 性能指标 */
  metrics?: any
  
  /** 统计信息 */
  stats?: any
  
  /** 警告列表 */
  warnings: string[]
  
  /** 错误列表 */
  errors: Error[]
}

/**
 * 构建上下文管理器
 */
export class BuildContext extends EventEmitter {
  private context: IBuildContext
  private logger: Logger

  constructor(
    config: BuilderConfig,
    bundler: BundlerType,
    logger: Logger
  ) {
    super()
    
    this.logger = logger
    this.context = {
      buildId: this.generateBuildId(),
      status: 'idle' as BuilderStatus,
      projectRoot: (config as any).cwd || process.cwd(),
      libraryType: config.libraryType,
      bundler,
      mode: config.mode || 'production',
      startTime: Date.now(),
      warnings: [],
      errors: []
    }
  }

  /**
   * 生成构建 ID
   */
  private generateBuildId(): string {
    const randomId = crypto.randomBytes(4).toString('hex')
    return `build_${Date.now()}_${randomId}`
  }

  /**
   * 获取构建 ID
   */
  getBuildId(): string {
    return this.context.buildId
  }

  /**
   * 获取当前状态
   */
  getStatus(): BuilderStatus {
    return this.context.status
  }

  /**
   * 设置状态
   */
  setStatus(status: BuilderStatus): void {
    const oldStatus = this.context.status
    this.context.status = status
    
    this.emit('status:change', {
      from: oldStatus,
      to: status,
      timestamp: Date.now()
    })
    
    this.logger.debug(`构建状态变更: ${oldStatus} -> ${status}`)
  }

  /**
   * 设置库类型
   */
  setLibraryType(libraryType: LibraryType): void {
    this.context.libraryType = libraryType
    this.logger.debug(`设置库类型: ${libraryType}`)
  }

  /**
   * 获取库类型
   */
  getLibraryType(): LibraryType | undefined {
    return this.context.libraryType
  }

  /**
   * 开始构建
   */
  startBuild(): void {
    this.context.startTime = Date.now()
    this.context.endTime = undefined
    this.context.warnings = []
    this.context.errors = []
    this.setStatus('building' as BuilderStatus)
    
    this.emit('build:start', {
      buildId: this.context.buildId,
      timestamp: this.context.startTime
    })
  }

  /**
   * 结束构建
   */
  endBuild(success: boolean): void {
    this.context.endTime = Date.now()
    this.setStatus(success ? 'idle' as BuilderStatus : 'error' as BuilderStatus)
    
    this.emit('build:end', {
      buildId: this.context.buildId,
      success,
      duration: this.getDuration(),
      timestamp: this.context.endTime
    })
  }

  /**
   * 获取构建时长
   */
  getDuration(): number {
    if (!this.context.endTime) {
      return Date.now() - this.context.startTime
    }
    return this.context.endTime - this.context.startTime
  }

  /**
   * 添加警告
   */
  addWarning(warning: string): void {
    this.context.warnings.push(warning)
    this.emit('warning', { warning, timestamp: Date.now() })
  }

  /**
   * 添加错误
   */
  addError(error: Error): void {
    this.context.errors.push(error)
    this.emit('error', { error, timestamp: Date.now() })
  }

  /**
   * 设置性能指标
   */
  setMetrics(metrics: any): void {
    this.context.metrics = metrics
  }

  /**
   * 设置统计信息
   */
  setStats(stats: any): void {
    this.context.stats = stats
  }

  /**
   * 获取完整上下文
   */
  getContext(): Readonly<IBuildContext> {
    return { ...this.context }
  }

  /**
   * 创建构建结果
   */
  createBuildResult(outputs: string[], validationResult?: any): BuildResult {
    // 将字符串数组转换为 OutputFile 数组
    const outputFiles = outputs.map(filePath => ({
      fileName: filePath,
      type: 'chunk' as const,
      source: '',
      size: 0
    }))

    // 将字符串数组转换为 Warning 数组
    const warnings = this.context.warnings.map(w => ({
      code: 'UNKNOWN',
      message: w,
      plugin: 'builder'
    }))

    // 将 Error 数组转换为标准 Error 对象
    const errors = this.context.errors.map(e => {
      if (e instanceof Error) return e
      return new Error(typeof e === 'string' ? e : String(e))
    })

    return {
      success: this.context.errors.length === 0,
      outputs: outputFiles,
      duration: this.getDuration(),
      stats: this.context.stats,
      performance: this.context.metrics,
      warnings,
      errors,
      buildId: this.context.buildId,
      timestamp: this.context.endTime || Date.now(),
      bundler: this.context.bundler,
      mode: this.context.mode,
      libraryType: this.context.libraryType,
      validation: validationResult
    }
  }

  /**
   * 重置上下文
   */
  reset(): void {
    this.context.warnings = []
    this.context.errors = []
    this.context.metrics = undefined
    this.context.stats = undefined
    this.context.buildId = this.generateBuildId()
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.removeAllListeners()
    this.reset()
  }
}

