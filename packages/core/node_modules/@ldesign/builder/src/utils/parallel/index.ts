/**
 * 并行处理工具统一导出模块
 *
 * @module utils/parallel
 *
 * @description
 * 提供高效的并行任务处理能力：
 *
 * **ParallelProcessor** - 并行处理器
 *    - 适用于并行任务处理
 *    - 支持优先级队列、超时、重试
 *    - 支持智能调度和自动并发调整
 *    - 支持性能监控和资源管理
 *
 * @example
 * ```typescript
 * // 使用并行处理器
 * import { ParallelProcessor, createParallelProcessor } from './parallel'
 *
 * const processor = createParallelProcessor({ maxConcurrency: 4 })
 * processor.addTask({
 *   id: 'task1',
 *   fn: async (data) => processData(data),
 *   data: { input: 'test' },
 *   priority: 10
 * })
 * await processor.waitAll()
 * ```
 */

// ========== 并行处理器导出 ==========
export {
  ParallelProcessor,
  createParallelProcessor,
  TaskStatus,
  type Task,
  type TaskResult,
  type ParallelProcessorOptions
} from './ParallelProcessor'

// ========== 默认导出 ==========

/**
 * 并行处理模块
 * 
 * 提供并行构建、任务调度等功能
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

export * from './ParallelProcessor'
export * from './ParallelBuildManager'
export * from './TaskQueue'
export * from './WorkerPool'
