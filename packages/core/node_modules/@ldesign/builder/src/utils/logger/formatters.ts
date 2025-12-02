/**
 * 日志格式化工具模块
 * 
 * 【功能描述】
 * 提供各种日志格式化功能，包括时间格式化、文件大小格式化、
 * 进度条生成、颜色高亮等实用工具函数
 * 
 * 【主要特性】
 * - 时间格式化：支持毫秒、秒、分钟等多种时间格式
 * - 文件大小格式化：自动转换为合适的单位（B、KB、MB、GB）
 * - 进度条生成：支持基础进度条和高级渐变进度条
 * - 颜色高亮：提供多种高亮工具函数，用于美化日志输出
 * - 动画效果：支持旋转动画、加载动画等
 * 
 * 【使用示例】
 * ```typescript
 * import { formatDuration, formatBytes, highlight } from './formatters'
 * 
 * console.log(formatDuration(1500))  // "1.50s"
 * console.log(formatBytes(1024))     // "1.00 KB"
 * console.log(highlight.path('/path/to/file'))
 * ```
 * 
 * @module utils/logger/formatters
 * @author LDesign Team
 * @version 1.0.0
 * @since 2024-01-01
 */

import chalk from 'chalk'

/**
 * 格式化时间持续时长
 * 
 * 【详细说明】
 * 根据毫秒数自动选择合适的时间单位进行格式化：
 * - 小于 1 秒：显示为毫秒（ms）
 * - 小于 60 秒：显示为秒（s），保留 2 位小数
 * - 大于等于 60 秒：显示为分钟和秒（m s）
 * 
 * 【算法复杂度】
 * 时间复杂度：O(1)
 * 空间复杂度：O(1)
 * 
 * @param ms - 毫秒数
 * @returns 格式化后的时间字符串
 * 
 * @example
 * ```typescript
 * formatDuration(500)    // "500ms"
 * formatDuration(1500)   // "1.50s"
 * formatDuration(65000)  // "1m 5.00s"
 * ```
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms.toFixed(0)}ms`
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)}s`
  } else {
    const minutes = Math.floor(ms / 60000)
    const seconds = ((ms % 60000) / 1000).toFixed(2)
    return `${minutes}m ${seconds}s`
  }
}

/**
 * 格式化字节大小
 * 
 * 【详细说明】
 * 根据字节数自动选择合适的单位进行格式化：
 * - 小于 1 KB：显示为字节（B）
 * - 小于 1 MB：显示为千字节（KB），保留 2 位小数
 * - 大于等于 1 MB：显示为兆字节（MB），保留 2 位小数
 * 
 * 【算法复杂度】
 * 时间复杂度：O(1)
 * 空间复杂度：O(1)
 * 
 * @param bytes - 字节数
 * @returns 格式化后的大小字符串
 * 
 * @example
 * ```typescript
 * formatBytes(512)          // "512 B"
 * formatBytes(1024)         // "1.00 KB"
 * formatBytes(1048576)      // "1.00 MB"
 * ```
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }
}

/**
 * 创建基础进度条
 * 
 * 【详细说明】
 * 生成一个简单的进度条字符串，使用 Unicode 字符绘制
 * 
 * 【算法复杂度】
 * 时间复杂度：O(width)
 * 空间复杂度：O(width)
 * 
 * @param percent - 进度百分比（0-100）
 * @param width - 进度条宽度（字符数）
 * @param useColors - 是否使用颜色
 * @returns 进度条字符串
 * 
 * @example
 * ```typescript
 * createProgressBar(50, 20)  // "██████████░░░░░░░░░░"
 * ```
 */
export function createProgressBar(
  percent: number,
  width: number = 20,
  useColors: boolean = true
): string {
  const filled = Math.round((percent / 100) * width)
  const empty = width - filled
  const bar = '█'.repeat(filled) + '░'.repeat(empty)
  return useColors ? chalk.cyan(bar) : bar
}

/**
 * 高级进度条选项
 */
export interface AdvancedProgressBarOptions {
  /** 进度条宽度（字符数），默认 30 */
  width?: number
  /** 是否显示百分比，默认 true */
  showPercent?: boolean
  /** 是否显示计数，默认 true */
  showCount?: boolean
  /** 进度条标签 */
  label?: string
  /** 是否使用颜色渐变，默认 true */
  useGradient?: boolean
}

/**
 * 创建高级进度条（带颜色渐变）
 * 
 * 【详细说明】
 * 生成一个功能丰富的进度条，支持：
 * - 根据进度自动选择颜色（红 -> 黄 -> 青 -> 绿）
 * - 显示百分比和计数信息
 * - 自定义标签
 * - 灵活的配置选项
 * 
 * 【颜色映射】
 * - 0-50%：红色
 * - 50-75%：黄色
 * - 75-100%：青色
 * - 100%：绿色
 * 
 * @param current - 当前进度值
 * @param total - 总进度值
 * @param options - 配置选项
 * @returns 格式化的进度条字符串
 * 
 * @example
 * ```typescript
 * createAdvancedProgressBar(50, 100, {
 *   label: '构建中',
 *   showPercent: true,
 *   showCount: true
 * })
 * // "构建中 [███████████████░░░░░░░░░░░░░] 50.0% (50/100)"
 * ```
 */
export function createAdvancedProgressBar(
  current: number,
  total: number,
  options: AdvancedProgressBarOptions = {}
): string {
  const {
    width = 30,
    showPercent = true,
    showCount = true,
    label = '',
    useGradient = true
  } = options

  // ========== 计算进度百分比 ==========
  const percent = Math.min(100, Math.max(0, (current / total) * 100))
  const filled = Math.round((percent / 100) * width)
  const empty = width - filled

  // ========== 根据进度选择颜色 ==========
  let barColor = chalk.cyan
  if (useGradient) {
    if (percent >= 100) {
      barColor = chalk.green
    } else if (percent >= 75) {
      barColor = chalk.cyan
    } else if (percent >= 50) {
      barColor = chalk.yellow
    } else {
      barColor = chalk.red
    }
  }

  // ========== 生成进度条 ==========
  const bar = barColor('█'.repeat(filled)) + chalk.gray('░'.repeat(empty))

  // ========== 组装结果字符串 ==========
  let result = label ? `${label} ` : ''
  result += `[${bar}]`

  if (showPercent) {
    result += ` ${percent.toFixed(1)}%`
  }

  if (showCount) {
    result += ` (${current}/${total})`
  }

  return result
}

/**
 * 旋转动画帧
 * 
 * 【详细说明】
 * 用于创建 CLI 加载动画的字符序列
 */
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

/**
 * 创建旋转动画字符
 * 
 * 【详细说明】
 * 返回动画序列中的一帧，用于创建旋转加载效果
 * 
 * 【算法复杂度】
 * 时间复杂度：O(1)
 * 空间复杂度：O(1)
 * 
 * @param phase - 动画帧索引
 * @param useColors - 是否使用颜色
 * @returns 动画字符
 * 
 * @example
 * ```typescript
 * // 在循环中使用
 * let phase = 0
 * setInterval(() => {
 *   process.stdout.write('\r' + createSpinner(phase++))
 * }, 100)
 * ```
 */
export function createSpinner(phase: number = 0, useColors: boolean = true): string {
  const frame = SPINNER_FRAMES[phase % SPINNER_FRAMES.length]
  return useColors ? chalk.cyan(frame) : frame
}

/**
 * 日志高亮工具函数集合
 * 
 * 【功能说明】
 * 提供一组用于高亮特定类型内容的工具函数，
 * 使日志输出更加美观和易读
 * 
 * @example
 * ```typescript
 * import { highlight } from './formatters'
 * 
 * console.log(highlight.path('/src/index.ts'))
 * console.log(highlight.success('构建成功！'))
 * console.log(highlight.error('构建失败！'))
 * ```
 */
export const highlight = {
  /**
   * 高亮文件路径（青色）
   * 
   * @param path - 文件路径
   * @returns 高亮后的字符串
   */
  path: (path: string): string => chalk.cyan(path),

  /**
   * 高亮数字/数据（黄色）
   * 
   * @param value - 数值
   * @returns 高亮后的字符串
   */
  number: (value: number | string): string => chalk.yellow(String(value)),

  /**
   * 高亮百分比（黄色）
   * 
   * @param value - 百分比数值
   * @returns 高亮后的字符串（带百分号）
   */
  percent: (value: number): string => chalk.yellow(`${value}%`),

  /**
   * 高亮文件大小（青色）
   * 
   * @param size - 文件大小字符串
   * @returns 高亮后的字符串
   */
  size: (size: string): string => chalk.cyan(size),

  /**
   * 高亮耗时（黄色）
   * 
   * @param time - 时间字符串
   * @returns 高亮后的字符串
   */
  time: (time: string): string => chalk.yellow(time),

  /**
   * 高亮成功信息（绿色）
   * 
   * @param text - 文本内容
   * @returns 高亮后的字符串
   */
  success: (text: string): string => chalk.green(text),

  /**
   * 高亮错误信息（红色）
   * 
   * @param text - 文本内容
   * @returns 高亮后的字符串
   */
  error: (text: string): string => chalk.red(text),

  /**
   * 高亮警告信息（黄色）
   * 
   * @param text - 文本内容
   * @returns 高亮后的字符串
   */
  warn: (text: string): string => chalk.yellow(text),

  /**
   * 高亮重要信息（青色加粗）
   * 
   * @param text - 文本内容
   * @returns 高亮后的字符串
   */
  important: (text: string): string => chalk.cyan.bold(text),

  /**
   * 高亮次要信息（灰色）
   * 
   * @param text - 文本内容
   * @returns 高亮后的字符串
   */
  dim: (text: string): string => chalk.gray(text)
} as const


