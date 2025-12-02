/**
 * 错误包装工具函数
 *
 * 将与函数包装相关的逻辑从 ErrorHandler 类中抽离出来，
 * 使核心类更加聚焦于错误处理流程本身，提升可维护性和可测试性。
 */
import type { ErrorHandler } from './ErrorHandler'

/**
 * 包装同步函数以处理错误
 *
 * 【详细说明】
 * 将一个函数包装起来，自动捕获和处理其抛出的错误，
 * 同时兼容返回 Promise 的情况。
 *
 * @param handler - 错误处理器实例
 * @param fn - 要包装的函数
 * @param context - 错误上下文描述，用于日志和分析
 * @returns 包装后的安全函数
 */
export function wrapFunction<TArgs extends readonly unknown[], TReturn>(
  handler: ErrorHandler,
  fn: (...args: TArgs) => TReturn,
  context?: string,
): (...args: TArgs) => TReturn {
  return ((...args: TArgs) => {
    try {
      const result = fn(...args)

      // ========== 处理返回 Promise 的情况 ==========
      if (result && typeof result === 'object' && 'catch' in result && typeof (result as any).catch === 'function') {
        return (result as unknown as Promise<unknown>).catch((error: unknown) => {
          const err = error instanceof Error ? error : new Error(String(error))
          handler.handle(err, context)
          throw err
        }) as TReturn
      }

      return result
    }
    catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      handler.handle(err, context)
      throw err
    }
  })
}

/**
 * 包装异步函数以处理错误
 *
 * 【详细说明】
 * 将一个异步函数包装起来，自动捕获和处理其抛出的错误，
 * 并调用 ErrorHandler 的异步处理逻辑。
 *
 * @param handler - 错误处理器实例
 * @param fn - 要包装的异步函数
 * @param context - 错误上下文描述，用于日志和分析
 * @returns 包装后的安全异步函数
 */
export function wrapAsyncFunction<TArgs extends readonly unknown[], TReturn>(
  handler: ErrorHandler,
  fn: (...args: TArgs) => Promise<TReturn>,
  context?: string,
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs) => {
    try {
      return await fn(...args)
    }
    catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      await handler.handleAsync(err, context)
      throw err
    }
  }
}

