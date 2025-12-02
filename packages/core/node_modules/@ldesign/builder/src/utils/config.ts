/**
 * 配置工具函数 - 重导出模块
 *
 * @deprecated 此文件已废弃，请直接使用 './config/index' 或 './config/config-loader'
 * 为了向后兼容，此文件重新导出 config 目录下的内容
 *
 * @example
 * ```typescript
 * // 推荐使用方式
 * import { defineConfig } from './utils/config/config-loader'
 * // 或
 * import { defineConfig } from './utils/config'
 *
 * // 兼容旧代码（不推荐）
 * import { defineConfig } from './utils/config.ts'
 * ```
 */

export * from './config'
