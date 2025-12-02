/**
 * 错误恢复策略模块
 * 
 * 【功能描述】
 * 提供错误恢复机制，包括自动重试、降级处理、指数退避等策略
 * 
 * 【主要特性】
 * - 自动重试：支持可配置的重试次数和延迟策略
 * - 指数退避：重试延迟呈指数增长，避免过度重试
 * - 降级处理：支持提供降级方案，当所有重试失败时使用
 * - 错误分析：分析错误类型，判断是否可恢复
 * - 上下文感知：根据错误上下文提供智能建议
 * 
 * 【使用示例】
 * ```typescript
 * import { recoverWithRetry, analyzeErrorRecoverability } from './recovery'
 * 
 * // 使用重试策略
 * const result = await recoverWithRetry(
 *   async () => fetchData(),
 *   { maxRetries: 3, fallback: defaultData }
 * )
 * 
 * // 分析错误可恢复性
 * const analysis = analyzeErrorRecoverability(error)
 * if (analysis.recoverable) {
 *   // 尝试恢复
 * }
 * ```
 * 
 * @module utils/error-handler/recovery
 * @author LDesign Team
 * @version 1.0.0
 * @since 2024-01-01
 */

import type { Logger } from '../logger/Logger'

/**
 * 错误恢复选项接口
 */
export interface RecoveryOptions<T> {
  /** 最大重试次数，默认 3 */
  maxRetries?: number
  /** 初始延迟（毫秒），默认 1000 */
  initialDelay?: number
  /** 最大延迟（毫秒），默认 10000 */
  maxDelay?: number
  /** 降级方案 */
  fallback?: T | (() => T | Promise<T>)
  /** 日志记录器 */
  logger?: Logger
  /** 是否使用指数退避，默认 true */
  useExponentialBackoff?: boolean
}

/**
 * 错误可恢复性分析结果
 */
export interface RecoverabilityAnalysis {
  /** 错误类型 */
  type: string
  /** 严重程度 */
  severity: 'critical' | 'error' | 'warning'
  /** 是否可恢复 */
  recoverable: boolean
  /** 是否需要用户操作 */
  needsUserAction: boolean
  /** 建议的恢复策略 */
  suggestedStrategy?: string
}

/**
 * 错误恢复函数（带重试机制）
 * 
 * 【详细说明】
 * 执行一个可能失败的函数，如果失败则自动重试。
 * 支持指数退避策略，重试延迟会逐渐增加。
 * 如果所有重试都失败，则尝试使用降级方案。
 * 
 * 【算法流程】
 * 1. 尝试执行目标函数
 * 2. 如果成功，直接返回结果
 * 3. 如果失败且未达到最大重试次数：
 *    - 计算下次重试的延迟（指数退避）
 *    - 等待延迟后重试
 * 4. 如果所有重试都失败：
 *    - 尝试使用降级方案
 *    - 如果降级方案也失败，抛出最后的错误
 * 
 * @param fn - 要执行的函数
 * @param options - 恢复选项
 * @returns 函数执行结果或降级方案结果
 * @throws 如果所有尝试都失败且没有降级方案，则抛出最后的错误
 * 
 * @example
 * ```typescript
 * // 基础重试
 * const data = await recoverWithRetry(
 *   async () => fetchRemoteData(),
 *   { maxRetries: 3 }
 * )
 * 
 * // 带降级方案的重试
 * const config = await recoverWithRetry(
 *   async () => loadRemoteConfig(),
 *   {
 *     maxRetries: 2,
 *     fallback: defaultConfig,
 *     logger: myLogger
 *   }
 * )
 * ```
 */
export async function recoverWithRetry<T>(
  fn: () => T | Promise<T>,
  options: RecoveryOptions<T> = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    fallback,
    logger,
    useExponentialBackoff = true
  } = options

  let lastError: Error | null = null

  // ========== 重试循环 ==========
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // 尝试执行目标函数
      return await Promise.resolve(fn())
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // 记录重试日志
      if (logger) {
        logger.warn(`尝试 ${attempt + 1}/${maxRetries + 1} 失败: ${lastError.message}`)
      }

      // 如果还未达到最大重试次数，等待后重试
      if (attempt < maxRetries) {
        // ========== 计算延迟时间（指数退避） ==========
        const delay = useExponentialBackoff
          ? Math.min(initialDelay * Math.pow(2, attempt), maxDelay)
          : initialDelay

        if (logger) {
          logger.debug(`等待 ${delay}ms 后重试...`)
        }

        // 等待指定的延迟时间
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  // ========== 所有重试都失败，尝试使用降级方案 ==========
  if (fallback !== undefined) {
    try {
      if (logger) {
        logger.info('所有重试失败，使用降级方案')
      }

      return typeof fallback === 'function'
        ? await (fallback as () => T | Promise<T>)()
        : fallback
    } catch (fallbackError) {
      if (logger) {
        logger.error('降级方案也失败:', fallbackError)
      }
    }
  }

  // ========== 抛出最后的错误 ==========
  throw lastError
}

/**
 * 分析错误的可恢复性
 * 
 * 【详细说明】
 * 根据错误消息和类型，分析错误是否可以自动恢复，
 * 以及需要采取什么样的恢复策略
 * 
 * 【分析维度】
 * - 错误类型：文件系统、网络、权限、配置等
 * - 严重程度：critical、error、warning
 * - 可恢复性：能否通过重试或其他手段恢复
 * - 用户操作需求：是否需要用户手动干预
 * 
 * @param error - 错误对象
 * @returns 可恢复性分析结果
 * 
 * @example
 * ```typescript
 * const analysis = analyzeErrorRecoverability(error)
 * console.log('错误类型:', analysis.type)
 * console.log('可恢复:', analysis.recoverable)
 * console.log('建议策略:', analysis.suggestedStrategy)
 * ```
 */
export function analyzeErrorRecoverability(error: Error): RecoverabilityAnalysis {
  let type = 'unknown'
  let severity: 'critical' | 'error' | 'warning' = 'error'
  let recoverable = false
  let needsUserAction = true
  let suggestedStrategy: string | undefined

  const message = error.message.toLowerCase()

  // ========== 文件系统错误 ==========
  if (message.includes('enoent') || message.includes('cannot find')) {
    type = 'file-not-found'
    severity = 'error'
    recoverable = false
    needsUserAction = true
    suggestedStrategy = '检查文件路径是否正确，确保文件存在'
  } else if (message.includes('eacces') || message.includes('eperm')) {
    type = 'permission'
    severity = 'critical'
    recoverable = false
    needsUserAction = true
    suggestedStrategy = '检查文件权限，可能需要以管理员身份运行'
  }
  // ========== 模块依赖错误 ==========
  else if (message.includes('module_not_found')) {
    type = 'dependency-missing'
    severity = 'error'
    recoverable = false
    needsUserAction = true
    suggestedStrategy = '运行 npm install 安装缺失的依赖'
  }
  // ========== 内存错误 ==========
  else if (message.includes('memory') || message.includes('heap')) {
    type = 'out-of-memory'
    severity = 'critical'
    recoverable = true
    needsUserAction = true
    suggestedStrategy = '增加 Node.js 内存限制或启用增量构建'
  }
  // ========== 超时错误 ==========
  else if (message.includes('timeout') || message.includes('etimedout')) {
    type = 'timeout'
    severity = 'warning'
    recoverable = true
    needsUserAction = false
    suggestedStrategy = '网络超时，建议重试'
  }
  // ========== 语法错误 ==========
  else if (message.includes('parse') || message.includes('syntaxerror')) {
    type = 'syntax'
    severity = 'error'
    recoverable = false
    needsUserAction = true
    suggestedStrategy = '检查代码语法，修复语法错误'
  }
  // ========== 循环依赖 ==========
  else if (message.includes('circular')) {
    type = 'circular-dependency'
    severity = 'warning'
    recoverable = false
    needsUserAction = true
    suggestedStrategy = '重构代码以消除循环依赖'
  }
  // ========== 网络错误 ==========
  else if (
    message.includes('network') ||
    message.includes('econnrefused') ||
    message.includes('enotfound')
  ) {
    type = 'network'
    severity = 'warning'
    recoverable = true
    needsUserAction = false
    suggestedStrategy = '检查网络连接，稍后重试'
  }

  return {
    type,
    severity,
    recoverable,
    needsUserAction,
    suggestedStrategy
  }
}

/**
 * 获取错误的建议恢复策略
 * 
 * 【详细说明】
 * 根据错误类型和上下文，返回详细的恢复建议列表
 * 
 * @param error - 错误对象
 * @param context - 错误上下文（可选）
 * @returns 建议列表
 * 
 * @example
 * ```typescript
 * const suggestions = getSuggestedRecoveryStrategies(error, {
 *   phase: 'build',
 *   file: 'src/index.ts'
 * })
 * suggestions.forEach(s => console.log('-', s))
 * ```
 */
export function getSuggestedRecoveryStrategies(
  error: Error,
  context?: { phase?: string; file?: string; config?: any }
): string[] {
  const suggestions: string[] = []
  const message = error.message

  // ========== 文件系统相关建议 ==========
  if (message.includes('ENOENT')) {
    suggestions.push('检查文件或目录是否存在')
    if (context?.file) {
      suggestions.push(`确认文件路径正确: ${context.file}`)
    }
    if (message.includes('package.json')) {
      suggestions.push('确保在项目根目录执行命令')
    }
  }

  if (message.includes('EACCES') || message.includes('EPERM')) {
    suggestions.push('检查文件权限')
    suggestions.push('尝试以管理员身份运行')
  }

  // ========== 模块相关建议 ==========
  if (message.includes('MODULE_NOT_FOUND') || message.includes('Cannot find module')) {
    const moduleMatch = message.match(/Cannot find module '([^']+)'/)
    const moduleName = moduleMatch ? moduleMatch[1] : null

    suggestions.push('运行 npm install 安装依赖')

    if (moduleName) {
      suggestions.push(`安装缺失的模块: npm install ${moduleName} --save-dev`)
    }
  }

  // ========== TypeScript 相关建议 ==========
  if (message.includes('TS') || message.includes('TypeScript')) {
    suggestions.push('检查 tsconfig.json 配置是否正确')
    suggestions.push('确保 TypeScript 版本兼容（建议 >= 5.0）')
  }

  // ========== 构建相关建议 ==========
  if (context?.phase === 'build') {
    suggestions.push('尝试清理输出目录后重新构建')
    suggestions.push('检查入口文件是否存在语法错误')

    if (message.includes('memory') || message.includes('heap')) {
      suggestions.push('尝试增加 Node.js 内存限制: NODE_OPTIONS=--max-old-space-size=4096')
      suggestions.push('考虑启用增量构建以减少内存占用')
    }
  }

  // ========== 如果没有找到任何建议 ==========
  if (suggestions.length === 0) {
    suggestions.push('查看完整的错误堆栈以获取更多信息')
    suggestions.push('访问文档或提交 Issue 寻求帮助')
  }

  return suggestions
}

