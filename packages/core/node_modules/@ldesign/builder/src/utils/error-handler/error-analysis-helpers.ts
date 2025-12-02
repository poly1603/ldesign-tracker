/**
 * 错误分析与格式化工具函数
 *
 * 将错误格式化、建议生成与上下文分析的逻辑从 ErrorHandler 类中抽离，
 * 便于复用与单元测试，同时让核心类职责更单一。
 */
import { isBuilderError } from './BuilderError'
import {
  analyzeErrorRecoverability,
  getSuggestedRecoveryStrategies,
} from './recovery'

/**
 * 错误建议上下文
 *
 * 用于为恢复策略和建议生成提供更多语义化信息。
 */
export interface ErrorSuggestionContext {
  /** 构建阶段名称，例如 'build'、'validate' 等 */
  phase?: string
  /** 相关文件路径 */
  file?: string
  /** 相关配置对象 */
  config?: unknown
}

/**
 * 格式化错误信息，支持可选的堆栈输出。
 *
 * @param error - 错误对象
 * @param defaultShowStack - 默认是否显示堆栈
 * @param includeStackOverride - 调用时临时覆盖是否显示堆栈
 * @returns 格式化后的错误字符串
 */
export function formatErrorMessage(
  error: Error,
  defaultShowStack: boolean,
  includeStackOverride?: boolean,
): string {
  const showStack = includeStackOverride ?? defaultShowStack

  if (isBuilderError(error)) {
    return error.getFullMessage()
  }

  let message = error.message
  if (showStack && error.stack) {
    message += `\n${error.stack}`
  }

  return message
}

/**
 * 获取错误建议（增强版，上下文感知）。
 *
 * @param error - 错误对象
 * @param context - 错误上下文
 * @returns 去重后的建议列表
 */
export function getErrorSuggestions(
  error: Error,
  context?: ErrorSuggestionContext,
): string[] {
  const suggestions: string[] = []

  if (isBuilderError(error) && error.suggestion) {
    suggestions.push(error.suggestion)
  }

  const recoverySuggestions = getSuggestedRecoveryStrategies(error, context)
  suggestions.push(...recoverySuggestions)

  return [...new Set(suggestions)]
}

/**
 * 分析错误上下文，返回可恢复性分析结果。
 *
 * @param error - 错误对象
 */
export function analyzeErrorContextInternal(error: Error) {
  return analyzeErrorRecoverability(error)
}

