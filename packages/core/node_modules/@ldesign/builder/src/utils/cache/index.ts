/**
 * 缓存系统模块
 *
 * 提供高级缓存管理功能
 *
 * @author LDesign Team
 * @version 1.0.0
 */

export * from './Cache'
export * from './BuildCacheManager'
export * from './CacheKeyGenerator'
export * from './CacheWarmer'
export {
  MultiLevelCache,
  createMultiLevelCache,
  type CacheOptions,
  type CacheLayer
} from './MultiLevelCache'
export { MemoryCache, type MemoryCacheOptions } from './MemoryCache'
export { FileSystemCache, type FileSystemCacheOptions } from './FileSystemCache'
export { RemoteCache, type RemoteCacheOptions } from './RemoteCache'

// 增强版缓存管理器
export {
  EnhancedCacheManager,
  createEnhancedCacheManager,
  type CacheEntry,
  type CacheOptions as EnhancedCacheOptions,
  type CacheStats
} from './EnhancedCacheManager'
