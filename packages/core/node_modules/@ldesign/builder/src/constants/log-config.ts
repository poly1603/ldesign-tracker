/**
 * 日志配置常量
 * 
 * 统一定义日志前缀、颜色、格式等配置，
 * 确保整个项目的日志输出风格一致
 * 
 * @module constants/log-config
 * @author LDesign Team
 * @version 1.0.0
 */

/**
 * 模块日志前缀配置
 * 统一管理各模块的日志前缀，确保命名一致性
 */
export const LOG_PREFIXES = {
  // 核心模块
  BUILDER: 'Builder',
  CONFIG: 'Config',
  PLUGIN: 'Plugin',
  ADAPTER: 'Adapter',
  STRATEGY: 'Strategy',

  // 适配器模块
  ROLLUP: 'Rollup',
  ROLLDOWN: 'Rolldown',
  ESBUILD: 'esbuild',
  SWC: 'SWC',

  // 功能模块
  CACHE: 'Cache',
  WATCH: 'Watch',
  VALIDATE: 'Validate',
  TRANSFORM: 'Transform',
  OPTIMIZE: 'Optimize',

  // 工具模块
  FILE_SYSTEM: 'FileSystem',
  MEMORY: 'Memory',
  PARALLEL: 'Parallel',
  REPORTER: 'Reporter',

  // CLI 模块
  CLI: 'CLI',
  INTERACTIVE: 'Interactive',
} as const

/**
 * 日志图标配置
 * 为不同类型的日志消息提供统一的图标
 */
export const LOG_ICONS = {
  // 状态图标
  SUCCESS: '✓',
  ERROR: '✗',
  WARNING: '⚠',
  INFO: 'ℹ',
  DEBUG: '⚙',

  // 进度图标
  START: '▶',
  STOP: '■',
  PAUSE: '⏸',
  COMPLETE: '✓',

  // 操作图标
  BUILD: '🔨',
  WATCH: '👁',
  BUNDLE: '📦',
  CLEAN: '🧹',
  TEST: '🧪',

  // 状态指示
  ARROW_RIGHT: '→',
  ARROW_LEFT: '←',
  BULLET: '•',
  CHECKMARK: '✓',
  CROSS: '✗',
} as const

/**
 * 日志级别阈值配置
 * 用于性能监控和警告触发
 */
export const LOG_THRESHOLDS = {
  /** 慢构建警告阈值（毫秒）*/
  SLOW_BUILD_MS: 30000,
  /** 大文件警告阈值（字节）*/
  LARGE_FILE_BYTES: 500 * 1024,
  /** 高内存使用警告阈值（MB）*/
  HIGH_MEMORY_MB: 1024,
  /** 最大日志行数（用于批量操作）*/
  MAX_LOG_LINES: 100,
  /** 最大错误堆栈行数 */
  MAX_STACK_LINES: 10,
} as const

/**
 * 日志格式配置
 */
export const LOG_FORMAT = {
  /** 时间戳格式 */
  TIMESTAMP_FORMAT: 'HH:mm:ss',
  /** 日期时间格式 */
  DATETIME_FORMAT: 'YYYY-MM-DD HH:mm:ss',
  /** 分隔符 */
  SEPARATOR: ' | ',
  /** 缩进字符 */
  INDENT: '  ',
  /** 分隔线字符 */
  DIVIDER_CHAR: '─',
  /** 分隔线长度 */
  DIVIDER_LENGTH: 50,
} as const

/**
 * 日志输出目标配置
 */
export const LOG_TARGETS = {
  /** 控制台输出 */
  CONSOLE: 'console',
  /** 文件输出 */
  FILE: 'file',
  /** 静默模式 */
  SILENT: 'silent',
} as const

/**
 * 环境变量名配置
 */
export const LOG_ENV_VARS = {
  /** 日志级别环境变量 */
  LOG_LEVEL: 'LOG_LEVEL',
  /** 是否禁用颜色 */
  NO_COLOR: 'NO_COLOR',
  /** 是否启用调试模式 */
  DEBUG: 'DEBUG',
  /** 是否显示时间戳 */
  LOG_TIMESTAMP: 'LOG_TIMESTAMP',
} as const

/**
 * 默认日志配置
 */
export const DEFAULT_LOG_CONFIG = {
  /** 默认日志级别 */
  level: 'info' as const,
  /** 默认是否启用颜色 */
  colors: true,
  /** 默认是否显示时间戳 */
  timestamp: true,
  /** 默认前缀 */
  prefix: '',
  /** 默认是否静默 */
  silent: false,
} as const

/**
 * 构建摘要日志格式
 */
export const BUILD_SUMMARY_FORMAT = {
  /** 标题 */
  TITLE: '构建摘要',
  /** 分隔线 */
  DIVIDER: '═'.repeat(50),
  /** 状态标签 */
  STATUS_LABELS: {
    success: '成功',
    failed: '失败',
    warning: '警告',
  },
  /** 字段标签 */
  FIELD_LABELS: {
    duration: '耗时',
    fileCount: '文件数',
    totalSize: '总大小',
    warnings: '警告',
    errors: '错误',
  },
} as const

/**
 * 获取模块完整日志前缀
 * 
 * @param module - 模块名称
 * @param subModule - 子模块名称（可选）
 * @returns 格式化的日志前缀
 * 
 * @example
 * ```typescript
 * getLogPrefix('Builder')          // '@ldesign/builder'
 * getLogPrefix('Builder', 'Cache') // '@ldesign/builder:Cache'
 * ```
 */
export function getLogPrefix(module: string, subModule?: string): string {
  const base = `@ldesign/builder`
  if (!module) return base
  return subModule ? `${base}:${module}:${subModule}` : `${base}:${module}`
}

/**
 * 格式化日志消息
 * 
 * @param icon - 日志图标
 * @param message - 日志消息
 * @returns 格式化的消息
 */
export function formatLogMessage(icon: string, message: string): string {
  return `${icon} ${message}`
}

