/**
 * 运行时相关默认配置常量
 *
 * 将原 defaults.ts 中与缓存、性能、监听等运行时行为相关的默认配置
 * 独立拆分到此模块，减小单文件体积，提升可维护性。
 *
 * @remarks
 * 对外仍然通过 `constants/defaults` 进行统一导出，不影响现有调用方。
 */

/**
 * 默认文件名模式
 */
export const DEFAULT_FILE_PATTERNS = {
  entry: '[name].[format].js',
  chunk: '[name]-[hash].js',
  asset: '[name]-[hash][extname]',
  types: '[name].d.ts'
} as const

/**
 * 默认缓存配置
 */
export const DEFAULT_CACHE_CONFIG = {
  enabled: true,
  dir: 'node_modules/.cache/@ldesign/builder',
  ttl: 24 * 60 * 60 * 1000, // 24 hours
  maxSize: 500 * 1024 * 1024, // 500MB
  compress: true,
  version: '1.0.0'
} as const

/**
 * 默认性能配置
 */
export const DEFAULT_PERFORMANCE_CONFIG = {
  bundleAnalyzer: false,
  sizeLimit: undefined,
  treeshaking: true,
  cache: true,
  parallel: true,
  memoryLimit: '2GB',
  timeout: 300000, // 5 minutes
  monitoring: false
} as const

/**
 * 默认监听配置
 */
export const DEFAULT_WATCH_CONFIG = {
  include: ['src/**/*'],
  exclude: ['node_modules/**/*', 'dist/**/*', '**/*.test.*', '**/*.spec.*'],
  persistent: true,
  ignoreInitial: true,
  followSymlinks: true,
  usePolling: false,
  interval: 100,
  binaryInterval: 300,
  alwaysStat: false,
  depth: 99,
  awaitWriteFinish: {
    stabilityThreshold: 2000,
    pollInterval: 100
  }
} as const

