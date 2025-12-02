/**
 * 日志类型与配置定义模块
 *
 * 【功能描述】
 * 提供 Logger 使用到的枚举、配置接口、构建摘要数据类型等定义，
 * 与核心实现解耦，便于在其他模块中复用这些类型。
 *
 * @module utils/logger/logger-types
 */

import type { LogLevel } from '../../types/common'

/**
 * 日志级别枚举
 * 
 * 【详细说明】
 * 定义日志的严重程度等级，数值越大表示越详细。
 * 只有当前日志级别大于等于消息级别时，消息才会被输出。
 */
export enum LogLevelEnum {
  /** 完全静默，不输出任何日志 */
  SILENT = 0,
  /** 仅输出错误信息 */
  ERROR = 1,
  /** 输出警告和错误 */
  WARN = 2,
  /** 输出常规信息、警告和错误 */
  INFO = 3,
  /** 输出调试信息及以上所有级别 */
  DEBUG = 4,
  /** 输出详细信息及以上所有级别 */
  VERBOSE = 5
}

/**
 * 日志级别映射表
 *
 * 将字符串类型的日志级别映射到枚举值。
 */
export const LOG_LEVEL_MAP: Record<LogLevel, LogLevelEnum> = {
  silent: LogLevelEnum.SILENT,
  error: LogLevelEnum.ERROR,
  warn: LogLevelEnum.WARN,
  info: LogLevelEnum.INFO,
  debug: LogLevelEnum.DEBUG,
  verbose: LogLevelEnum.VERBOSE
}

/**
 * 日志记录器选项接口
 */
export interface LoggerOptions {
  /** 日志级别，默认 'info' */
  level?: LogLevel
  /** 是否启用颜色，默认 true */
  colors?: boolean
  /** 是否显示时间戳，默认 true */
  timestamp?: boolean
  /** 日志前缀，默认为空 */
  prefix?: string
  /** 是否静默模式，默认 false */
  silent?: boolean
}

/**
 * 构建摘要数据接口
 */
export interface BuildSummaryData {
  /** 构建耗时（毫秒） */
  duration: number
  /** 文件总数 */
  fileCount: number
  /** 总大小（字节） */
  totalSize: number
  /** 构建状态 */
  status: 'success' | 'failed' | 'warning'
  /** 警告数量 */
  warnings?: number
  /** 错误数量 */
  errors?: number
}

