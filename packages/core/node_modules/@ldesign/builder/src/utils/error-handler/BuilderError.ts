/**
 * 构建器错误类模块
 * 
 * 【功能描述】
 * 定义专门用于构建器的自定义错误类，提供丰富的错误信息和上下文
 * 
 * 【主要特性】
 * - 错误码支持：每个错误都有唯一的错误码，便于识别和处理
 * - 错误建议：自动提供解决建议，帮助用户快速定位和解决问题
 * - 上下文信息：支持附加构建阶段、文件路径、详细信息等上下文
 * - 错误链：支持 cause 属性，记录原始错误，便于追踪错误根源
 * - JSON 序列化：支持将错误转换为 JSON 格式，便于日志记录和传输
 * 
 * 【使用示例】
 * ```typescript
 * import { BuilderError } from './BuilderError'
 * import { ErrorCode } from '../../constants/errors'
 * 
 * // 创建基础错误
 * throw new BuilderError(ErrorCode.BUILD_FAILED, '构建失败')
 * 
 * // 创建带上下文的错误
 * throw new BuilderError(
 *   ErrorCode.FILE_NOT_FOUND,
 *   '找不到入口文件',
 *   {
 *     file: 'src/index.ts',
 *     phase: 'initialization',
 *     suggestion: '请检查配置文件中的 input 路径'
 *   }
 * )
 * ```
 * 
 * @module utils/error-handler/BuilderError
 * @author LDesign Team
 * @version 1.0.0
 * @since 2024-01-01
 */

import { ErrorCode, ERROR_MESSAGES, ERROR_SUGGESTIONS } from '../../constants/errors'

/**
 * 构建器错误选项接口
 */
export interface BuilderErrorOptions {
  /** 错误建议 */
  suggestion?: string
  /** 错误详细信息（可以是任意类型） */
  details?: any
  /** 发生错误的构建阶段 */
  phase?: string
  /** 相关文件路径 */
  file?: string
  /** 原始错误（错误链） */
  cause?: Error
}

/**
 * 构建器错误类
 * 
 * 【功能说明】
 * 继承自原生 Error 类，增强了错误信息的表达能力，
 * 专门用于构建器中的错误处理
 * 
 * 【核心特性】
 * - 错误码：通过 ErrorCode 枚举标识错误类型
 * - 建议信息：自动从 ERROR_SUGGESTIONS 映射表获取或自定义
 * - 上下文记录：记录错误发生的阶段、文件等信息
 * - 错误链：支持记录原始错误，便于问题追溯
 * 
 * 【设计模式】
 * 继承模式：扩展原生 Error 类
 * 
 * @example
 * ```typescript
 * try {
 *   // 某些构建操作
 * } catch (error) {
 *   throw new BuilderError(
 *     ErrorCode.BUILD_FAILED,
 *     '编译失败',
 *     {
 *       phase: 'compilation',
 *       file: 'src/index.ts',
 *       cause: error as Error
 *     }
 *   )
 * }
 * ```
 */
export class BuilderError extends Error {
  /** 错误码 */
  public readonly code: ErrorCode
  /** 错误建议 */
  public readonly suggestion?: string
  /** 错误详细信息 */
  public readonly details?: any
  /** 构建阶段 */
  public readonly phase?: string
  /** 相关文件 */
  public readonly file?: string
  /** 原始错误 */
  public readonly cause?: Error

  /**
   * 构造函数
   * 
   * 【详细说明】
   * 创建一个新的构建器错误实例
   * 
   * @param code - 错误码（来自 ErrorCode 枚举）
   * @param message - 错误消息（可选，如果不提供则使用默认消息）
   * @param options - 错误选项
   * 
   * @example
   * ```typescript
   * const error = new BuilderError(
   *   ErrorCode.CONFIG_INVALID,
   *   '配置文件格式错误',
   *   {
   *     file: 'ldesign.config.ts',
   *     suggestion: '请检查配置文件的 JSON 格式是否正确'
   *   }
   * )
   * ```
   */
  constructor(
    code: ErrorCode,
    message?: string,
    options: BuilderErrorOptions = {}
  ) {
    // ========== 构建错误消息 ==========
    // 优先使用传入的消息，否则从错误消息映射表获取，最后使用默认消息
    const errorMessage = message || ERROR_MESSAGES[code] || '未知错误'
    super(errorMessage)

    // ========== 设置错误名称 ==========
    this.name = 'BuilderError'

    // ========== 设置错误属性 ==========
    this.code = code
    this.suggestion = options.suggestion || ERROR_SUGGESTIONS[code]
    this.details = options.details
    this.phase = options.phase
    this.file = options.file

    // ========== 设置错误链 ==========
    if (options.cause) {
      this.cause = options.cause
    }

    // ========== 保持堆栈跟踪 ==========
    // V8 引擎提供的特性，用于生成更准确的堆栈跟踪
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BuilderError)
    }
  }

  /**
   * 获取完整的错误信息
   * 
   * 【详细说明】
   * 返回格式化的完整错误信息，包括错误码、消息、阶段、文件和建议
   * 
   * 【算法复杂度】
   * 时间复杂度：O(1)
   * 空间复杂度：O(1)
   * 
   * @returns 完整的错误信息字符串
   * 
   * @example
   * ```typescript
   * const error = new BuilderError(ErrorCode.BUILD_FAILED, '构建失败')
   * console.log(error.getFullMessage())
   * // 输出: "[BUILD_FAILED] 构建失败\n建议: 请检查源代码是否有语法错误"
   * ```
   */
  getFullMessage(): string {
    let message = `[${this.code}] ${this.message}`

    // ========== 添加构建阶段信息 ==========
    if (this.phase) {
      message += ` (阶段: ${this.phase})`
    }

    // ========== 添加文件信息 ==========
    if (this.file) {
      message += ` (文件: ${this.file})`
    }

    // ========== 添加建议信息 ==========
    if (this.suggestion) {
      message += `\n建议: ${this.suggestion}`
    }

    return message
  }

  /**
   * 转换为 JSON 格式
   * 
   * 【详细说明】
   * 将错误对象序列化为 JSON 格式，便于日志记录、网络传输等场景
   * 
   * 【算法复杂度】
   * 时间复杂度：O(1)
   * 空间复杂度：O(1)
   * 
   * @returns JSON 对象
   * 
   * @example
   * ```typescript
   * const error = new BuilderError(ErrorCode.BUILD_FAILED, '构建失败')
   * const json = error.toJSON()
   * console.log(JSON.stringify(json, null, 2))
   * ```
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      suggestion: this.suggestion,
      details: this.details,
      phase: this.phase,
      file: this.file,
      stack: this.stack
    }
  }
}

/**
 * 判断是否为构建器错误
 * 
 * 【详细说明】
 * 类型守卫函数，用于判断一个错误是否为 BuilderError 实例
 * 
 * @param error - 待判断的错误对象
 * @returns 是否为构建器错误
 * 
 * @example
 * ```typescript
 * try {
 *   // some code
 * } catch (error) {
 *   if (isBuilderError(error)) {
 *     console.log('错误码:', error.code)
 *     console.log('建议:', error.suggestion)
 *   }
 * }
 * ```
 */
export function isBuilderError(error: any): error is BuilderError {
  return error instanceof BuilderError
}

/**
 * 从错误中提取错误码
 * 
 * 【详细说明】
 * 如果错误是 BuilderError，返回其错误码；否则返回 undefined
 * 
 * @param error - 错误对象
 * @returns 错误码或 undefined
 * 
 * @example
 * ```typescript
 * const code = getErrorCode(error)
 * if (code === ErrorCode.BUILD_FAILED) {
 *   // 处理构建失败错误
 * }
 * ```
 */
export function getErrorCode(error: Error): ErrorCode | undefined {
  if (isBuilderError(error)) {
    return error.code
  }
  return undefined
}

/**
 * 格式化错误信息
 * 
 * 【详细说明】
 * 将错误格式化为字符串，可选是否包含堆栈跟踪
 * 
 * @param error - 错误对象
 * @param includeStack - 是否包含堆栈跟踪，默认 false
 * @returns 格式化后的错误字符串
 * 
 * @example
 * ```typescript
 * const message = formatError(error, true)
 * console.log(message)
 * ```
 */
export function formatError(error: Error, includeStack: boolean = false): string {
  if (isBuilderError(error)) {
    return error.getFullMessage()
  }

  let message = error.message
  if (includeStack && error.stack) {
    message += `\n${error.stack}`
  }

  return message
}

