/**
 * 内存管理工具统一导出模块
 *
 * @module utils/memory
 *
 * @description
 * 提供三种内存管理工具：
 *
 * 1. **MemoryManager** - 资源管理器
 *    - 自动资源清理和生命周期管理
 *    - 流式处理支持
 *    - 事件监听器和定时器管理
 *    - 防止内存泄漏
 *    - 推荐用于需要管理多种资源的场景
 *
 * 2. **MemoryOptimizer** - 内存优化器
 *    - 实时内存监控和统计
 *    - 自动 GC 触发
 *    - 内存压缩
 *    - 内存使用历史记录
 *    - 推荐用于需要优化内存使用的场景
 *
 * 3. **MemoryLeakDetector** - 内存泄漏检测器
 *    - 检测潜在的内存泄漏
 *    - 跟踪对象引用
 *    - 生成泄漏报告
 *    - 推荐用于开发和调试阶段
 *
 * @example
 * ```typescript
 * // 使用资源管理器
 * import { ResourceManager, createCleanupable } from './memory'
 *
 * const manager = new ResourceManager()
 * const resource = createCleanupable(() => {
 *   console.log('清理资源')
 * })
 * manager.register('my-resource', resource)
 *
 * // 使用完毕后清理
 * await manager.cleanup()
 *
 * // 使用内存优化器
 * import { MemoryOptimizer } from './memory'
 *
 * const optimizer = new MemoryOptimizer({
 *   maxHeapUsage: 1024, // 1GB
 *   gcThreshold: 512,   // 512MB
 *   enableAutoGC: true
 * })
 * optimizer.startMonitoring()
 *
 * // 构建完成后停止监控
 * optimizer.stopMonitoring()
 * const report = optimizer.getReport()
 *
 * // 使用内存泄漏检测器
 * import { MemoryLeakDetector } from './memory'
 *
 * const detector = new MemoryLeakDetector()
 * detector.startTracking()
 *
 * // 执行可能泄漏的代码
 * // ...
 *
 * const leaks = detector.detectLeaks()
 * if (leaks.length > 0) {
 *   console.warn('检测到内存泄漏:', leaks)
 * }
 * ```
 */

// ========== 资源管理器 ==========
export {
  ResourceManager,
  MemoryManager,
  StreamProcessor,
  GCOptimizer,
  getGlobalMemoryManager,
  resetGlobalMemoryManager,
  createCleanupable,
  managedResource,
  createStreamProcessor,
  createGCOptimizer,
  type ICleanupable,
  type MemoryManagerOptions,
  type StreamProcessOptions
} from './MemoryManager'

// ========== 内存优化器 ==========
export {
  MemoryOptimizer,
  type MemoryStats,
  type MemoryConfig
} from './MemoryOptimizer'

// ========== 内存泄漏检测器 ==========
export {
  MemoryLeakDetector,
  type MemorySnapshot,
  type MemoryLeakDetection,
  type MemoryLeakDetectorOptions
} from './MemoryLeakDetector'

// ========== 便捷工厂函数 ==========

/**
 * 创建完整的内存管理套件
 *
 * @param options - 配置选项
 * @returns 包含所有内存管理工具的对象
 *
 * @example
 * ```typescript
 * const { manager, optimizer, detector } = createMemorySuite({
 *   enableMonitoring: true,
 *   maxHeapUsage: 1024,
 *   enableLeakDetection: true
 * })
 *
 * // 使用管理器
 * manager.register('resource', myResource)
 *
 * // 启动监控
 * optimizer.startMonitoring()
 *
 * // 启动泄漏检测
 * detector.startTracking()
 * ```
 */
export function createMemorySuite(options: {
  enableMonitoring?: boolean
  maxHeapUsage?: number
  gcThreshold?: number
  enableLeakDetection?: boolean
} = {}) {
  const { MemoryManager } = require('./MemoryManager')
  const { MemoryOptimizer } = require('./MemoryOptimizer')
  const { MemoryLeakDetector } = require('./MemoryLeakDetector')

  const manager = new MemoryManager({
    enableMonitoring: options.enableMonitoring,
    autoCleanup: true
  })

  const optimizer = new MemoryOptimizer({
    maxHeapUsage: options.maxHeapUsage,
    gcThreshold: options.gcThreshold,
    enableAutoGC: true
  })

  const detector = options.enableLeakDetection
    ? new MemoryLeakDetector()
    : null

  return {
    manager,
    optimizer,
    detector,
    /**
     * 启动所有监控
     */
    startAll() {
      if (options.enableMonitoring) {
        optimizer.startMonitoring()
      }
      if (detector) {
        detector.startTracking()
      }
    },
    /**
     * 停止所有监控并清理
     */
    async stopAll() {
      optimizer.stopMonitoring()
      if (detector) {
        detector.stopTracking()
      }
      await manager.cleanup()
    },
    /**
     * 获取完整报告
     */
    getReport() {
      return {
        memory: optimizer.getReport(),
        leaks: detector ? detector.detectLeaks() : []
      }
    }
  }
}

// ========== 默认导出 ==========

/**
 * 默认导出资源管理器（最常用）
 */
export { MemoryManager as default } from './MemoryManager'

