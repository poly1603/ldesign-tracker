/**
 * 日志系统统一导出模块
 * 
 * 【功能描述】
 * 提供日志系统的统一导出入口，整合日志核心类、格式化工具等功能
 * 
 * 【模块结构】
 * - Logger: 日志核心类
 * - formatters: 格式化工具集合
 * - 工具函数: 便捷的创建和配置函数
 * 
 * 【使用示例】
 * ```typescript
 * // 导入方式1：使用默认日志器
 * import { logger } from '@ldesign/builder/utils/logger'
 * logger.info('应用启动')
 * 
 * // 导入方式2：创建自定义日志器
 * import { createLogger } from '@ldesign/builder/utils/logger'
 * const myLogger = createLogger({ level: 'debug', prefix: '[MyApp]' })
 * 
 * // 导入方式3：使用格式化工具
 * import { highlight, formatDuration } from '@ldesign/builder/utils/logger'
 * console.log(highlight.success('成功！'))
 * console.log(formatDuration(1500))
 * ```
 * 
 * @module utils/logger
 * @author LDesign Team
 * @version 1.0.0
 * @since 2024-01-01
 */

// ========== 导出核心类和类型 ==========
export {
  Logger,
  LogLevelEnum,
  createLogger,
  logger,
  setLogLevel,
  setSilent,
  type LoggerOptions,
  type BuildSummaryData
} from './Logger'

// ========== 导出格式化工具 ==========
export {
  formatDuration,
  formatBytes,
  createProgressBar,
  createAdvancedProgressBar,
  createSpinner,
  highlight,
  type AdvancedProgressBarOptions
} from './formatters'

// ========== 导出控制台报告器 ==========
export {
  ConsoleReporter,
  createConsoleReporter,
  consoleReporter,
  type BuildPhase,
  type FileOutput,
  type BuildSummary,
  type ReporterOptions
} from './ConsoleReporter'

// ========== 默认导出 ==========
/**
 * 默认导出日志器实例
 * 
 * @example
 * ```typescript
 * import logger from '@ldesign/builder/utils/logger'
 * logger.info('使用默认日志器')
 * ```
 */
import { logger as defaultLogger } from './Logger'
export default defaultLogger


