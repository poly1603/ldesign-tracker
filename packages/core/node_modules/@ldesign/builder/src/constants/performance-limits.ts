/**
 * 性能限制相关常量
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

/**
 * 文件大小限制
 */
export const FILE_SIZE_LIMITS = {
  /** 最大单文件大小 (字节) */
  MAX_FILE_SIZE: 500 * 1024, // 500KB

  /** 警告文件大小阈值 (字节) */
  WARN_FILE_SIZE: 400 * 1024, // 400KB

  /** 大文件阈值 (字节) - 触发流式处理 */
  LARGE_FILE_THRESHOLD: 10 * 1024 * 1024, // 10MB

  /** 最大缓存文件大小 (字节) */
  MAX_CACHE_FILE_SIZE: 50 * 1024 * 1024, // 50MB
} as const

/**
 * 时间限制
 */
export const TIME_LIMITS = {
  /** 缓存有效期 (毫秒) */
  CACHE_TTL: 24 * 60 * 60 * 1000, // 24小时

  /** 缓存最大保留时间 (毫秒) */
  CACHE_MAX_AGE: 7 * 24 * 60 * 60 * 1000, // 7天

  /** 构建超时时间 (毫秒) */
  BUILD_TIMEOUT: 30 * 60 * 1000, // 30分钟

  /** 任务默认超时 (毫秒) */
  TASK_TIMEOUT: 30 * 1000, // 30秒

  /** Watch 防抖延迟 (毫秒) */
  WATCH_DEBOUNCE: 100, // 100ms

  /** 性能监控采样间隔 (毫秒) */
  PERF_SAMPLE_INTERVAL: 1000, // 1秒

  /** 并发调整间隔 (毫秒) */
  CONCURRENCY_ADJUST_INTERVAL: 5000, // 5秒
} as const

/**
 * 内存限制
 */
export const MEMORY_LIMITS = {
  /** 默认最大堆内存 (MB) */
  MAX_HEAP_USAGE: 1024, // 1GB

  /** GC 触发阈值 (MB) */
  GC_THRESHOLD: 512, // 512MB

  /** 内存使用警告阈值 (百分比) */
  MEMORY_WARNING_THRESHOLD: 85, // 85%

  /** 内存使用危险阈值 (百分比) */
  MEMORY_CRITICAL_THRESHOLD: 95, // 95%
} as const

/**
 * 并发限制
 */
export const CONCURRENCY_LIMITS = {
  /** 默认最大并发数 */
  MAX_CONCURRENCY: 4,

  /** 最小并发数 */
  MIN_CONCURRENCY: 1,

  /** CPU使用阈值 (百分比) */
  CPU_THRESHOLD: 90, // 90%

  /** 任务队列最大长度 */
  MAX_QUEUE_LENGTH: 1000,
} as const

/**
 * 缓存限制
 */
export const CACHE_LIMITS = {
  /** 缓存最大条目数 */
  MAX_CACHE_ENTRIES: 100,

  /** 缓存最大体积 (MB) */
  MAX_CACHE_SIZE: 100, // 100MB

  /** LRU 缓存大小 */
  LRU_CACHE_SIZE: 100,

  /** LRU 缓存过期时间 (毫秒) */
  LRU_MAX_AGE: 60 * 1000, // 1分钟

  /** 构建历史最大记录数 */
  MAX_BUILD_HISTORY: 10,
} as const

/**
 * 批处理限制
 */
export const BATCH_LIMITS = {
  /** 默认批次大小 */
  DEFAULT_BATCH_SIZE: 100,

  /** 大型数组批次大小 */
  LARGE_ARRAY_BATCH_SIZE: 1000,

  /** 文件处理批次大小 */
  FILE_BATCH_SIZE: 10,
} as const

/**
 * 重试策略
 */
export const RETRY_STRATEGY = {
  /** 默认最大重试次数 */
  MAX_RETRIES: 3,

  /** 重试基础延迟 (毫秒) */
  RETRY_DELAY_BASE: 1000,

  /** 最大重试延迟 (毫秒) */
  MAX_RETRY_DELAY: 10000,
} as const

/**
 * 性能监控
 */
export const PERF_MONITORING = {
  /** 最大性能采样数 */
  MAX_SAMPLES: 100,

  /** 性能报告保留数量 */
  MAX_REPORTS: 50,

  /** 慢任务阈值 (毫秒) */
  SLOW_TASK_THRESHOLD: 5000, // 5秒
} as const

