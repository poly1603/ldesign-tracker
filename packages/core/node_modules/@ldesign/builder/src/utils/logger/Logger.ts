/**
 * 日志记录器核心类模块
 *
 * 【功能描述】
 * 提供功能强大的日志记录器类，支持多级别日志、颜色输出、
 * 时间戳、前缀、进度显示、构建摘要等功能
 *
 * 【主要特性】
 * - 多级别日志：支持 silent、error、warn、info、debug、verbose 六个级别
 * - 颜色支持：可选的彩色输出，提升日志可读性
 * - 时间戳：可配置的时间戳显示
 * - 前缀支持：支持自定义日志前缀，方便区分不同模块
 * - 子日志器：支持创建带有特定前缀的子日志器
 * - 静默模式：支持完全静默，不输出任何日志
 * - 进度显示：内置进度条和旋转动画支持
 * - 构建摘要：专门的构建结果摘要显示
 *
 * 【设计模式】
 * - 单例模式：提供默认的全局日志器实例
 * - 构建器模式：通过选项对象配置日志器行为
 * - 策略模式：不同的日志级别对应不同的输出策略
 *
 * 【使用示例】
 * ```typescript
 * import { Logger, createLogger } from './Logger'
 *
 * const logger = createLogger({ level: 'info', prefix: '[App]' })
 * logger.info('应用启动')
 * logger.success('操作成功')
 * logger.error('操作失败', error)
 *
 * // 创建子日志器
 * const moduleLogger = logger.child('Module', { level: 'debug' })
 * moduleLogger.debug('模块调试信息')
 * ```
 *
 * @module utils/logger/Logger
 * @author LDesign Team
 * @version 1.0.0
 * @since 2024-01-01
 */

import chalk from 'chalk'
import type { LogLevel } from '../../types/common'
import {
  createProgressBar,
  createAdvancedProgressBar,
  createSpinner,
  type AdvancedProgressBarOptions
} from './formatters'
import {
  LogLevelEnum,
  LOG_LEVEL_MAP
} from './logger-types'
import type {
  LoggerOptions,
  BuildSummaryData
} from './logger-types'
import { renderBuildSummary } from './logger-build-summary'

/**
 * 日志记录器类
 *
 * 【功能说明】
 * 提供完整的日志记录功能，包括不同级别的日志输出、
 * 格式化、颜色支持、时间戳等
 *
 * 【核心方法】
 * - error: 记录错误日志
 * - warn: 记录警告日志
 * - info: 记录信息日志
 * - debug: 记录调试日志
 * - success: 记录成功日志
 * - progress: 显示进度条
 * - child: 创建子日志器
 *
 * @example
 * ```typescript
 * const logger = new Logger({ level: 'info', prefix: '[App]' })
 * logger.info('应用启动')
 * logger.progress(50, 100, '处理中')
 * ```
 */
export class Logger {
  /** 当前日志级别 */
  private level: LogLevelEnum
  /** 是否启用颜色 */
  private colors: boolean
  /** 是否显示时间戳 */
  private timestamp: boolean
  /** 日志前缀 */
  private prefix: string
  /** 是否静默模式 */
  private silent: boolean

  /**
   * 构造函数
   *
   * @param options - 日志器配置选项
   */
  constructor(options: LoggerOptions = {}) {
    this.level = LOG_LEVEL_MAP[options.level || 'info']
    this.colors = options.colors ?? true
    this.timestamp = options.timestamp ?? true
    this.prefix = options.prefix || ''
    this.silent = options.silent ?? false
  }

  // ========== 配置方法 ==========

  /**
   * 设置日志级别
   *
   * @param level - 新的日志级别
   */
  setLevel(level: LogLevel): void {
    this.level = LOG_LEVEL_MAP[level]
  }

  /**
   * 获取当前日志级别
   *
   * @returns 当前日志级别
   */
  getLevel(): LogLevel {
    const entries = Object.entries(LOG_LEVEL_MAP)
    const entry = entries.find(([, value]) => value === this.level)
    return (entry?.[0] as LogLevel) || 'info'
  }

  /**
   * 设置静默模式
   *
   * @param silent - 是否启用静默模式
   */
  setSilent(silent: boolean): void {
    this.silent = silent
  }

  // ========== 基础日志方法 ==========

  /**
   * 记录错误日志
   *
   * @param message - 错误消息
   * @param args - 附加参数
   */
  error(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevelEnum.ERROR)) {
      // 美化错误输出 - 使用 this.colors 检查
      if (this.colors) {
        console.log(`${chalk.red('✗')} ${chalk.red(message)}`, ...args)
      } else {
        console.log(`✗ ${message}`, ...args)
      }
    }
  }

  /**
   * 记录警告日志
   *
   * @param message - 警告消息
   * @param args - 附加参数
   */
  warn(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevelEnum.WARN)) {
      // 美化警告输出 - 使用 this.colors 检查
      if (this.colors) {
        console.log(`${chalk.yellow('⚠')} ${chalk.yellow(message)}`, ...args)
      } else {
        console.log(`⚠ ${message}`, ...args)
      }
    }
  }

  /**
   * 记录信息日志
   *
   * @param message - 信息消息
   * @param args - 附加参数
   */
  info(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevelEnum.INFO)) {
      // 简化info输出，去掉时间戳和标签
      if (this.colors) {
        console.log(`${chalk.blue('ℹ')} ${message}`, ...args)
      } else {
        console.log(`ℹ ${message}`, ...args)
      }
    }
  }

  /**
   * 记录调试日志
   *
   * @param message - 调试消息
   * @param args - 附加参数
   */
  debug(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevelEnum.DEBUG)) {
      this.log('DEBUG', message, chalk.gray, ...args)
    }
  }

  /**
   * 记录详细日志
   *
   * @param message - 详细消息
   * @param args - 附加参数
   */
  verbose(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevelEnum.VERBOSE)) {
      this.log('VERBOSE', message, chalk.gray, ...args)
    }
  }

  /**
   * 记录成功日志
   *
   * @param message - 成功消息
   * @param args - 附加参数
   */
  success(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevelEnum.INFO)) {
      // 美化成功输出
      if (this.colors) {
        console.log(`${chalk.green('✓')} ${chalk.green(message)}`, ...args)
      } else {
        console.log(`✓ ${message}`, ...args)
      }
    }
  }

  // ========== 特殊格式日志方法 ==========

  /**
   * 记录开始日志（带图标）
   *
   * @param message - 开始消息
   * @param args - 附加参数
   */
  start(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevelEnum.INFO)) {
      this.log('START', `▶ ${message}`, chalk.cyan, ...args)
    }
  }

  /**
   * 记录完成日志（带图标）
   *
   * @param message - 完成消息
   * @param args - 附加参数
   */
  complete(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevelEnum.INFO)) {
      this.log('COMPLETE', `✓ ${message}`, chalk.green, ...args)
    }
  }

  /**
   * 记录失败日志（带图标）
   *
   * @param message - 失败消息
   * @param args - 附加参数
   */
  fail(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevelEnum.ERROR)) {
      this.log('FAIL', `✗ ${message}`, chalk.red, ...args)
    }
  }

  // ========== 进度和可视化方法 ==========

  /**
   * 显示进度条
   *
   * @param current - 当前进度值
   * @param total - 总进度值
   * @param message - 进度消息（可选）
   */
  progress(current: number, total: number, message?: string): void {
    if (this.shouldLog(LogLevelEnum.INFO)) {
      const percent = Math.round((current / total) * 100)
      const progressBar = createProgressBar(percent, 20, this.colors)
      const progressMessage = message ? ` ${message}` : ''
      this.log('PROGRESS', `${progressBar} ${percent}%${progressMessage}`, chalk.cyan)
    }
  }

  /**
   * 显示表格数据
   *
   * @param data - 表格数据数组
   */
  table(data: Record<string, any>[]): void {
    if (this.shouldLog(LogLevelEnum.INFO) && data.length > 0) {
      console.table(data)
    }
  }

  /**
   * 开始分组
   *
   * @param label - 分组标签
   */
  group(label: string): void {
    if (this.shouldLog(LogLevelEnum.INFO)) {
      console.group(this.formatMessage('GROUP', label, chalk.cyan))
    }
  }

  /**
   * 结束分组
   */
  groupEnd(): void {
    if (this.shouldLog(LogLevelEnum.INFO)) {
      console.groupEnd()
    }
  }

  /**
   * 高亮输出
   *
   * @param message - 要高亮的消息
   * @returns 高亮后的字符串（如果启用颜色）
   */
  highlight(message: string): string {
    return this.colors ? chalk.cyan.bold(message) : message
  }

  // ========== 辅助输出方法 ==========

  /**
   * 清屏
   */
  clear(): void {
    if (!this.silent) {
      console.clear()
    }
  }

  /**
   * 输出空行
   */
  newLine(): void {
    if (this.shouldLog(LogLevelEnum.INFO)) {
      console.log('')
    }
  }

  /**
   * 输出分隔线
   *
   * @param char - 分隔字符，默认 '-'
   * @param length - 分隔线长度，默认 50
   */
  divider(char: string = '-', length: number = 50): void {
    if (this.shouldLog(LogLevelEnum.INFO)) {
      console.log(char.repeat(length))
    }
  }

  // ========== 高级功能方法 ==========

  /**
   * 创建子日志记录器
   *
   * 【详细说明】
   * 创建一个新的日志器实例，继承当前日志器的配置，
   * 并在前缀上追加新的标识
   *
   * @param prefix - 子日志器的前缀
   * @param options - 覆盖选项（可选）
   * @returns 新的日志器实例
   *
   * @example
   * ```typescript
   * const mainLogger = new Logger({ prefix: '[App]' })
   * const moduleLogger = mainLogger.child('Database')
   * moduleLogger.info('连接成功')  // 输出: [App]:Database 连接成功
   * ```
   */
  child(prefix: string, options: Partial<LoggerOptions> = {}): Logger {
    return new Logger({
      level: this.getLevel(),
      colors: this.colors,
      timestamp: this.timestamp,
      prefix: `${this.prefix}:${prefix}`,
      silent: this.silent,
      ...options
    })
  }

  /**
   * 创建高级进度条
   *
   * @param current - 当前进度值
   * @param total - 总进度值
   * @param options - 进度条选项
   * @returns 进度条字符串
   */
  createAdvancedProgressBar(
    current: number,
    total: number,
    options: AdvancedProgressBarOptions = {}
  ): string {
    return createAdvancedProgressBar(current, total, {
      ...options,
      useGradient: this.colors
    })
  }

  /**
   * 创建旋转动画字符
   *
   * @param phase - 动画帧索引
   * @returns 动画字符
   */
  createSpinner(phase: number = 0): string {
    return createSpinner(phase, this.colors)
  }

  /**
   * 显示构建摘要
   *
   * 【详细说明】
   * 显示一个格式化的构建结果摘要，包括状态、耗时、文件数量、
   * 总大小、警告和错误数量等信息
   *
   * @param data - 构建摘要数据
   */
  showBuildSummary(data: BuildSummaryData): void {
    if (!this.shouldLog(LogLevelEnum.INFO)) return
    renderBuildSummary(this, data)
  }

  // ========== 私有方法 ==========

  /**
   * 判断是否应该记录日志
   *
   * @param level - 消息的日志级别
   * @returns 是否应该记录
   */
  private shouldLog(level: LogLevelEnum): boolean {
    return !this.silent && this.level >= level
  }

  /**
   * 核心日志记录方法
   *
   * @param type - 日志类型
   * @param message - 日志消息
   * @param colorFn - 颜色函数
   * @param args - 附加参数
   */
  private log(
    type: string,
    message: string,
    colorFn: (str: string) => string,
    ...args: any[]
  ): void {
    const formattedMessage = this.formatMessage(type, message, colorFn)
    console.log(formattedMessage, ...args)
  }

  /**
   * 格式化消息
   *
   * 【详细说明】
   * 按照统一格式组装日志消息：
   * [HH:mm:ss] [LEVEL] 消息内容
   *
   * - 时间戳使用灰色
   * - 日志级别标签使用对应颜色
   * - 消息内容保持原样（可能包含自定义颜色）
   *
   * @param type - 日志类型
   * @param message - 原始消息
   * @param colorFn - 颜色函数
   * @returns 格式化后的消息
   */
  private formatMessage(
    type: string,
    message: string,
    colorFn: (str: string) => string
  ): string {
    let formatted = ''

    // ========== 添加时间戳 ==========
    if (this.timestamp) {
      const now = new Date()
      const hours = String(now.getHours()).padStart(2, '0')
      const minutes = String(now.getMinutes()).padStart(2, '0')
      const seconds = String(now.getSeconds()).padStart(2, '0')
      const timestamp = `${hours}:${minutes}:${seconds}`
      formatted += chalk.gray(`[${timestamp}] `)
    }

    // ========== 添加日志级别标签 ==========
    if (this.colors) {
      formatted += colorFn(`[${type}]`) + ' '
    } else {
      formatted += `[${type}] `
    }

    // ========== 添加消息内容 ==========
    formatted += message

    return formatted
  }
}

/**
 * 创建日志记录器实例
 *
 * @param options - 日志器配置选项
 * @returns 新的日志器实例
 *
 * @example
 * ```typescript
 * const logger = createLogger({ level: 'debug', prefix: '[MyModule]' })
 * ```
 */
export function createLogger(options: LoggerOptions = {}): Logger {
  return new Logger(options)
}

/**
 * 默认日志记录器实例
 *
 * 【详细说明】
 * 提供一个全局默认的日志器实例，可以直接导入使用
 *
 * @example
 * ```typescript
 * import { logger } from './Logger'
 * logger.info('应用启动')
 * ```
 */
export const logger = new Logger()

/**
 * 设置全局日志级别
 *
 * @param level - 新的日志级别
 */
export function setLogLevel(level: LogLevel): void {
  logger.setLevel(level)
}

/**
 * 设置全局静默模式
 *
 * @param silent - 是否启用静默模式
 */
export function setSilent(silent: boolean): void {
  logger.setSilent(silent)
}

export { LogLevelEnum } from './logger-types'
export type { LoggerOptions, BuildSummaryData } from './logger-types'



