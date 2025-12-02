/**
 * 错误处理器核心类模块
 * 
 * 【功能描述】
 * 提供统一的错误处理机制，包括错误记录、错误恢复、错误分析等功能
 * 
 * 【主要特性】
 * - 统一错误处理：提供一致的错误处理接口
 * - 错误日志：自动记录错误信息，支持不同级别的详细程度
 * - 错误恢复：内置重试和降级机制
 * - 错误分析：分析错误类型和严重程度
 * - 智能建议：根据错误类型提供解决建议
 * - 批量处理：支持批量处理多个错误
 * - 函数包装：提供函数包装器，自动捕获和处理错误
 * 
 * 【设计模式】
 * - 单例模式：提供全局默认实例
 * - 策略模式：不同错误类型采用不同处理策略
 * - 装饰器模式：通过 wrap 方法装饰函数，添加错误处理能力
 * 
 * 【使用示例】
 * ```typescript
 * import { ErrorHandler, createErrorHandler } from './ErrorHandler'
 * 
 * const handler = createErrorHandler({
 *   showStack: true,
 *   showSuggestions: true
 * })
 * 
 * // 处理错误
 * try {
 *   // some code
 * } catch (error) {
 *   handler.handle(error, 'initialization')
 * }
 * 
 * // 使用错误恢复
 * const result = await handler.recover(
 *   () => riskyOperation(),
 *   defaultValue,
 *   3
 * )
 * ```
 * 
 * @module utils/error-handler/ErrorHandler
 * @author LDesign Team
 * @version 1.0.0
 * @since 2024-01-01
 */

import type { Logger } from '../logger/Logger'
import { BuilderError } from './BuilderError'
import { ErrorCode } from '../../constants/errors'
import {
  recoverWithRetry,
  type RecoveryOptions
} from './recovery'
import {
  analyzeErrorContextInternal,
  formatErrorMessage,
  getErrorSuggestions,
  type ErrorSuggestionContext
} from './error-analysis-helpers'
import {
  wrapAsyncFunction,
  wrapFunction
} from './error-wrap'
import type { ErrorHandlerOptions } from './error-handler-types'

/**
 * 错误处理器类
 * 
 * 【功能说明】
 * 提供完整的错误处理功能，包括错误捕获、记录、分析、恢复等
 * 
 * 【核心方法】
 * - handle: 处理单个错误
 * - handleBatch: 批量处理错误
 * - recover: 错误恢复（带重试）
 * - wrap: 包装函数，自动捕获错误
 * - createError: 创建构建器错误
 * - getSuggestions: 获取错误建议
 * 
 * @example
 * ```typescript
 * const handler = new ErrorHandler({
 *   showStack: true,
 *   logger: myLogger
 * })
 * 
 * // 处理错误
 * handler.handle(error, 'build')
 * 
 * // 包装函数
 * const safeBuild = handler.wrap(buildFunction, 'build')
 * ```
 */
export class ErrorHandler {
  /** 日志记录器 */
  private logger?: Logger
  /** 是否显示堆栈跟踪 */
  private showStack: boolean
  /** 是否显示建议 */
  private showSuggestions: boolean
  /** 错误回调 */
  private onError?: (error: Error) => void
  /** 是否在错误时退出 */
  private exitOnError: boolean
  /** 退出码 */
  private exitCode: number

  /**
   * 构造函数
   * 
   * @param options - 错误处理器选项
   */
  constructor(options: ErrorHandlerOptions = {}) {
    this.logger = options.logger
    this.showStack = options.showStack ?? false
    this.showSuggestions = options.showSuggestions ?? true
    this.onError = options.onError
    this.exitOnError = options.exitOnError ?? false
    this.exitCode = options.exitCode ?? 1
  }

  // ========== 核心错误处理方法 ==========

  /**
   * 处理错误
   * 
   * 【详细说明】
   * 统一的错误处理入口，会执行以下操作：
   * 1. 调用错误回调（如果配置了）
   * 2. 记录错误日志
   * 3. 如果配置了 exitOnError，则退出进程
   * 
   * @param error - 错误对象
   * @param context - 错误上下文（可选）
   * 
   * @example
   * ```typescript
   * try {
   *   await build()
   * } catch (error) {
   *   handler.handle(error, 'build')
   * }
   * ```
   */
  handle(error: Error, context?: string): void {
    // ========== 调用错误回调 ==========
    if (this.onError) {
      try {
        this.onError(error)
      } catch (callbackError) {
        this.logger?.error('错误回调执行失败:', callbackError)
      }
    }

    // ========== 记录错误日志 ==========
    this.logError(error, context)

    // ========== 是否退出进程 ==========
    if (this.exitOnError) {
      process.exit(this.exitCode)
    }
  }

  /**
   * 处理异步错误
   * 
   * 【详细说明】
   * 异步错误处理方法，直接调用同步处理方法
   * （为了保持 API 一致性而提供）
   * 
   * @param error - 错误对象
   * @param context - 错误上下文
   */
  async handleAsync(error: Error, context?: string): Promise<void> {
    this.handle(error, context)
  }

  /**
   * 批量处理错误
   * 
   * 【详细说明】
   * 一次性处理多个错误，每个错误可以有独立的上下文
   * 
   * @param errors - 错误数组，每个元素包含错误对象和可选的上下文
   * 
   * @example
   * ```typescript
   * handler.handleBatch([
   *   { error: error1, context: 'phase1' },
   *   { error: error2, context: 'phase2' }
   * ])
   * ```
   */
  handleBatch(errors: Array<{ error: Error; context?: string }>): void {
    if (errors.length === 0) return

    this.logger?.info(`批量处理 ${errors.length} 个错误`)

    for (const { error, context } of errors) {
      try {
        this.handle(error, context)
      } catch (handlerError) {
        // 防止错误处理器本身出错导致的无限循环
        console.error('错误处理器执行失败:', handlerError)
      }
    }
  }

  // ========== 错误恢复方法 ==========

  /**
   * 错误恢复机制
   * 
   * 【详细说明】
   * 尝试执行一个函数，如果失败则自动重试，
   * 支持指数退避和降级方案
   * 
   * @param fn - 要执行的函数
   * @param fallback - 降级方案（可选）
   * @param maxRetries - 最大重试次数，默认 3
   * @returns 函数执行结果或降级方案结果
   * @throws 如果所有尝试都失败且没有降级方案
   * 
   * @example
   * ```typescript
   * const data = await handler.recover(
   *   async () => fetchData(),
   *   defaultData,
   *   3
   * )
   * ```
   */
  async recover<T>(
    fn: () => T | Promise<T>,
    fallback?: T | (() => T | Promise<T>),
    maxRetries = 3
  ): Promise<T> {
    return recoverWithRetry(fn, {
      maxRetries,
      fallback,
      logger: this.logger
    })
  }

  /**
   * 错误恢复（高级版本）
   * 
   * 【详细说明】
   * 提供更多配置选项的错误恢复方法
   * 
   * @param fn - 要执行的函数
   * @param options - 恢复选项
   * @returns 函数执行结果
   */
  async recoverWithOptions<T>(
    fn: () => T | Promise<T>,
    options: RecoveryOptions<T>
  ): Promise<T> {
    return recoverWithRetry(fn, {
      ...options,
      logger: options.logger || this.logger
    })
  }

  // ========== 函数包装方法 ==========

  /**
   * 包装同步函数以处理错误
   *
   * 【详细说明】
   * 将一个函数包装起来，自动捕获和处理其抛出的错误
   *
   * @param fn - 要包装的函数
   * @param context - 错误上下文
   * @returns 包装后的函数
   *
   * @example
   * ```typescript
   * const safeBuild = handler.wrap(build, 'build')
   * safeBuild(config)  // 错误会被自动捕获和处理
   * ```
   */
  wrap<TArgs extends readonly unknown[], TReturn>(
    fn: (...args: TArgs) => TReturn,
    context?: string
  ): (...args: TArgs) => TReturn {
    return wrapFunction(this, fn, context)
  }

  /**
   * 包装异步函数以处理错误
   *
   * 【详细说明】
   * 将一个异步函数包装起来，自动捕获和处理其抛出的错误
   *
   * @param fn - 要包装的异步函数
   * @param context - 错误上下文
   * @returns 包装后的异步函数
   *
   * @example
   * ```typescript
   * const safeBuildAsync = handler.wrapAsync(buildAsync, 'build')
   * await safeBuildAsync(config)
   * ```
   */
  wrapAsync<TArgs extends readonly unknown[], TReturn>(
    fn: (...args: TArgs) => Promise<TReturn>,
    context?: string
  ): (...args: TArgs) => Promise<TReturn> {
    return wrapAsyncFunction(this, fn, context)
  }

  // ========== 错误创建和格式化方法 ==========

  /**
   * 创建构建器错误
   * 
   * @param code - 错误码
   * @param message - 错误消息
   * @param options - 错误选项
   * @returns 构建器错误实例
   * 
   * @example
   * ```typescript
   * const error = handler.createError(
   *   ErrorCode.BUILD_FAILED,
   *   '构建失败',
   *   { phase: 'compilation' }
   * )
   * ```
   */
  createError(
    code: ErrorCode,
    message?: string,
    options?: {
      suggestion?: string
      details?: any
      phase?: string
      file?: string
      cause?: Error
    }
  ): BuilderError {
    return new BuilderError(code, message, options)
  }

  /**
   * 抛出构建器错误
   * 
   * @param code - 错误码
   * @param message - 错误消息
   * @param options - 错误选项
   * @throws BuilderError
   * 
   * @example
   * ```typescript
   * handler.throwError(ErrorCode.CONFIG_INVALID, '配置无效')
   * ```
   */
  throwError(
    code: ErrorCode,
    message?: string,
    options?: {
      suggestion?: string
      details?: any
      phase?: string
      file?: string
      cause?: Error
    }
  ): never {
    throw this.createError(code, message, options)
  }

  /**
   * 格式化错误信息
   *
   * @param error - 错误对象
   * @param includeStack - 是否包含堆栈跟踪
   * @returns 格式化后的错误字符串
   */
  formatError(error: Error, includeStack?: boolean): string {
    return formatErrorMessage(error, this.showStack, includeStack)
  }

  // ========== 错误分析方法 ==========

  /**
   * 获取错误建议（增强版，上下文感知）
   *
   * 【详细说明】
   * 根据错误类型和上下文，提供智能的解决建议
   *
   * @param error - 错误对象
   * @param context - 错误上下文
   * @returns 建议列表
   *
   * @example
   * ```typescript
   * const suggestions = handler.getSuggestions(error, {
   *   phase: 'build',
   *   file: 'src/index.ts'
   * })
   * ```
   */
  getSuggestions(error: Error, context?: ErrorSuggestionContext): string[] {
    return getErrorSuggestions(error, context)
  }

  /**
   * 分析错误上下文
   *
   * 【详细说明】
   * 分析错误的类型、严重程度、可恢复性等信息
   *
   * @param error - 错误对象
   * @returns 错误分析结果
   *
   * @example
   * ```typescript
   * const analysis = handler.analyzeErrorContext(error)
   * if (analysis.recoverable) {
   *   // 尝试自动恢复
   * }
   * ```
   */
  analyzeErrorContext(error: Error) {
    return analyzeErrorContextInternal(error)
  }

  // ========== 私有方法 ==========

  /**
   * 记录错误日志
   *
   * @param error - 错误对象
   * @param context - 错误上下文
   * @param depth - 递归深度（内部使用）
   */
  private logError(error: Error, context?: string, depth: number = 0): void {
    // ========== 防止无限递归 ==========
    const MAX_ERROR_DEPTH = 10
    if (depth >= MAX_ERROR_DEPTH) {
      if (this.logger) {
        this.logger.warn(`错误链过深（深度 ${depth}），停止追踪以防止栈溢出`)
      } else {
        console.warn(`错误链过深（深度 ${depth}），停止追踪以防止栈溢出`)
      }
      return
    }

    if (!this.logger) {
      console.error(error)
      return
    }

    // ========== 构建错误消息 ==========
    let message = error.message
    if (context) {
      message = `${context}: ${message}`
    }
    
    // 添加深度指示器（仅在有嵌套时显示）
    const depthPrefix = depth > 0 ? `${'  '.repeat(depth)}↳ ` : ''

    // ========== 记录基本错误信息 ==========
    this.logger.error(`${depthPrefix}${message}`)

    // ========== 如果是构建器错误，显示额外信息 ==========
    if (error instanceof BuilderError) {
      if (error.phase) {
        this.logger.error(`${depthPrefix}阶段: ${error.phase}`)
      }

      if (error.file) {
        this.logger.error(`${depthPrefix}文件: ${error.file}`)
      }

      if (error.details) {
        this.logger.debug(`${depthPrefix}错误详情:`, error.details)
      }

      if (this.showSuggestions && error.suggestion) {
        this.logger.info(`${depthPrefix}建议: ${error.suggestion}`)
      }
    }

    // ========== 显示堆栈跟踪 ==========
    if (this.showStack && error.stack) {
      this.logger.debug(`${depthPrefix}堆栈跟踪:`)
      this.logger.debug(error.stack)
    }

    // ========== 显示原因链（带深度限制和循环检测） ==========
    if ((error as any).cause) {
      // 检测循环引用
      const cause = (error as any).cause
      if (cause === error) {
        this.logger.warn(`${depthPrefix}检测到错误循环引用，停止追踪`)
        return
      }
      
      this.logger.debug(`${depthPrefix}原因:`)
      this.logError(cause as Error, undefined, depth + 1)
    }
  }
}

/**
 * 创建错误处理器实例
 * 
 * @param options - 错误处理器选项
 * @returns 新的错误处理器实例
 * 
 * @example
 * ```typescript
 * const handler = createErrorHandler({
 *   showStack: true,
 *   logger: myLogger
 * })
 * ```
 */
export function createErrorHandler(options: ErrorHandlerOptions = {}): ErrorHandler {
  return new ErrorHandler(options)
}

/**
 * 默认错误处理器实例
 * 
 * 【详细说明】
 * 提供一个全局默认的错误处理器实例
 */
export const errorHandler = new ErrorHandler()

/**
 * 设置全局错误处理
 * 
 * 【详细说明】
 * 为 Node.js 进程设置全局错误处理，捕获未捕获的异常和 Promise 拒绝
 * 
 * @param handler - 错误处理器实例
 * 
 * @example
 * ```typescript
 * setupGlobalErrorHandling(myErrorHandler)
 * ```
 */
export function setupGlobalErrorHandling(handler: ErrorHandler = errorHandler): void {
  // ========== 处理未捕获的异常 ==========
  process.on('uncaughtException', (error) => {
    handler.handle(error, '未捕获的异常')
    process.exit(1)
  })

  // ========== 处理未处理的 Promise 拒绝 ==========
  process.on('unhandledRejection', (reason, _promise) => {
    const error = reason instanceof Error ? reason : new Error(String(reason))
    handler.handle(error, '未处理的 Promise 拒绝')
  })

  // ========== 处理警告 ==========
  process.on('warning', (warning) => {
    if ((handler as any).logger) {
      (handler as any).logger.warn(`Node.js 警告: ${warning.message}`)
    }
  })
}

