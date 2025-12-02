/**
 * @ldesign/builder - 工具函数统一导出
 *
 * 提供所有工具函数的统一导出
 *
 * @author LDesign Team
 * @version 2.0.0
 * @since 2024-01-01
 *
 * @description
 * 工具模块已重组为功能性子目录，提供更清晰的模块结构：
 * - cache/          缓存相关工具
 * - parallel/       并行处理工具
 * - memory/         内存管理工具
 * - file-system/    文件系统工具
 * - build/          构建相关工具
 * - optimization/   优化工具
 * - analysis/       分析工具
 * - formatters/     格式化工具
 * - config/         配置工具
 * - logger/         日志工具
 * - error-handler/  错误处理工具
 * - misc/           其他工具
 */

// ========== 核心工具模块 ==========

// 配置相关工具
export * from './config'

// 日志系统
export {
  // 核心类和方法
  Logger,
  createLogger,
  logger,
  setLogLevel,
  setSilent,
  LogLevelEnum,
  // 类型导出
  type LoggerOptions,
  type BuildSummaryData,
  // 格式化工具
  formatDuration,
  formatBytes,
  createProgressBar,
  createAdvancedProgressBar,
  createSpinner,
  highlight
} from './logger'

// 错误处理
export * from './error-handler'

// ========== 功能性工具模块 ==========

// 缓存工具
export * from './cache'

// 并行处理工具
export * from './parallel'

// 内存管理工具
export * from './memory'

// 文件系统工具
export * from './file-system'

// 构建工具
export * from './build'

// 优化工具
export * from './optimization'

// 分析工具 - 使用命名空间导出避免冲突
export * as analysis from './analysis'

// 格式化工具 - 使用命名空间导出避免冲突
export * as formatters from './formatters'

// 其他工具 - 使用命名空间导出避免冲突
export * as misc from './misc'
