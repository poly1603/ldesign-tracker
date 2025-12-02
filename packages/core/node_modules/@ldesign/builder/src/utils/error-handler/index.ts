/**
 * 错误处理系统统一导出模块
 * 
 * 【功能描述】
 * 提供错误处理系统的统一导出入口，整合错误类、错误处理器、错误恢复等功能
 * 
 * 【模块结构】
 * - BuilderError: 自定义错误类
 * - ErrorHandler: 错误处理器核心类
 * - recovery: 错误恢复策略
 * - 工具函数: 便捷的创建和配置函数
 * 
 * 【使用示例】
 * ```typescript
 * // 方式1：使用默认错误处理器
 * import { errorHandler } from '@ldesign/builder/utils/error-handler'
 * errorHandler.handle(error, 'build')
 * 
 * // 方式2：创建自定义错误处理器
 * import { createErrorHandler } from '@ldesign/builder/utils/error-handler'
 * const handler = createErrorHandler({ showStack: true })
 * 
 * // 方式3：创建和抛出构建器错误
 * import { BuilderError, ErrorCode } from '@ldesign/builder/utils/error-handler'
 * throw new BuilderError(ErrorCode.BUILD_FAILED, '构建失败')
 * 
 * // 方式4：使用错误恢复
 * import { recoverWithRetry } from '@ldesign/builder/utils/error-handler'
 * const result = await recoverWithRetry(() => fetchData(), { maxRetries: 3 })
 * ```
 * 
 * @module utils/error-handler
 * @author LDesign Team
 * @version 1.0.0
 * @since 2024-01-01
 */

// ========== 导出错误类 ==========
export {
  BuilderError,
  isBuilderError,
  getErrorCode,
  formatError,
  type BuilderErrorOptions
} from './BuilderError'

// ========== 导出错误处理器 ==========
export {
  ErrorHandler,
  createErrorHandler,
  errorHandler,
  setupGlobalErrorHandling,
} from './ErrorHandler'

// ========== 导出类型定义 ==========
export type { ErrorHandlerOptions } from './error-handler-types'

// ========== 导出错误恢复 ==========
export {
  recoverWithRetry,
  analyzeErrorRecoverability,
  getSuggestedRecoveryStrategies,
  type RecoveryOptions,
  type RecoverabilityAnalysis
} from './recovery'

// ========== 默认导出 ==========
/**
 * 默认导出错误处理器实例
 * 
 * @example
 * ```typescript
 * import errorHandler from '@ldesign/builder/utils/error-handler'
 * errorHandler.handle(error)
 * ```
 */
import { errorHandler as defaultErrorHandler } from './ErrorHandler'
export default defaultErrorHandler

