/**
 * 日志系统入口 - 重定向模块
 *
 * @deprecated 此文件已废弃，请直接使用 './logger/index' 或 './logger/Logger'
 * 为保持兼容，此文件会重新导出 logger 目录下的所有导出
 *
 * @example
 * ```typescript
 * // 推荐使用方式
 * import { Logger } from './utils/logger/Logger'
 * // 或
 * import { Logger } from './utils/logger'
 *
 * // 兼容旧代码（不推荐）
 * import { Logger } from './utils/logger.ts'
 * ```
 */

// 重新导出 logger 目录下的所有导出
export * from './logger/Logger'
export * from './logger/formatters'

// 默认导出日志器实例
import { logger as defaultLogger } from './logger/Logger'
export default defaultLogger
