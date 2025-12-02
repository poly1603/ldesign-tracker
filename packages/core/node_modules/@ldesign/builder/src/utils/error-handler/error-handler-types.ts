/**
 * 错误处理器相关类型定义
 *
 * 专门用于声明错误处理器在创建时可配置的选项，
 * 以便在不同模块中复用类型定义，避免重复声明。
 */
import type { Logger } from '../logger/Logger'

/**
 * 错误处理器选项接口
 *
 * 定义创建错误处理器实例时可配置的行为参数。
 */
export interface ErrorHandlerOptions {
  /** 日志记录器 */
  logger?: Logger
  /** 是否显示堆栈跟踪，默认 false */
  showStack?: boolean
  /** 是否显示建议，默认 true */
  showSuggestions?: boolean
  /** 错误回调函数 */
  onError?: (error: Error) => void
  /** 是否在错误时退出进程，默认 false */
  exitOnError?: boolean
  /** 退出码，默认 1 */
  exitCode?: number
}

