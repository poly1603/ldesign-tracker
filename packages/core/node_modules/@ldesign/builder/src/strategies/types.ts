/**
 * 策略相关类型定义
 */

import type { Plugin, RollupOptions } from 'rollup'

/**
 * 构建策略接口
 */
export interface BuildStrategy {
  /** 策略名称 */
  readonly name: string

  /** 应用策略 */
  apply(options: RollupOptions): Promise<RollupOptions>

  /** 验证策略配置 */
  validate(): boolean

  /** 清理资源 */
  cleanup?(): void
}

/**
 * 策略配置基础接口
 */
export interface StrategyConfig {
  /** 策略特定的插件 */
  plugins?: Plugin[]

  /** 外部依赖 */
  external?: string[]

  /** 是否启用 */
  enabled?: boolean
}

/**
 * Vue 策略配置
 */
export interface VueStrategyConfig extends StrategyConfig {
  /** Vue 版本 */
  version?: 2 | 3

  /** JSX 配置 */
  jsx?: boolean | {
    /** 是否启用 */
    enabled?: boolean
    /** pragma */
    pragma?: string
    /** pragma fragment */
    pragmaFrag?: string
  }

  /** 模板编译器选项 */
  template?: {
    /** 编译器选项 */
    compilerOptions?: Record<string, any>
    /** 转换选项 */
    transformAssetUrls?: Record<string, any>
  }
}

/**
 * React 策略配置
 */
export interface ReactStrategyConfig extends StrategyConfig {
  /** React 版本 */
  version?: string

  /** JSX 运行时 */
  jsx?: 'classic' | 'automatic' | {
    /** 运行时模式 */
    runtime?: 'classic' | 'automatic'
    /** 导入源 */
    importSource?: string
    /** pragma */
    pragma?: string
    /** pragma fragment */
    pragmaFrag?: string
  }

  /** 是否启用 Fast Refresh */
  fastRefresh?: boolean
}

/**
 * 策略工厂函数
 */
export type StrategyFactory<T extends BuildStrategy = BuildStrategy> = (config?: any) => T

/**
 * 策略注册表
 */
export interface StrategyRegistry {
  /** 注册策略 */
  register(name: string, factory: StrategyFactory): void

  /** 获取策略 */
  get(name: string): BuildStrategy | undefined

  /** 检查策略是否存在 */
  has(name: string): boolean

  /** 获取所有策略名称 */
  list(): string[]
}

/**
 * 混合策略配置
 */
export interface MixedStrategyConfig extends StrategyConfig {
  /** 框架配置 */
  frameworks?: {
    vue?: VueStrategyConfig
    react?: ReactStrategyConfig
  }

  /** 检测配置 */
  detection?: {
    /** 是否自动检测 */
    auto?: boolean
    /** 文件关联 */
    associations?: Record<string, string>
  }
}

/**
 * 策略上下文
 */
export interface StrategyContext {
  /** 项目根目录 */
  root: string

  /** 构建模式 */
  mode?: 'development' | 'production'

  /** 环境变量 */
  env?: Record<string, string>

  /** 日志记录器 */
  logger?: {
    info: (message: string) => void
    warn: (message: string) => void
    error: (message: string) => void
    debug: (message: string) => void
  }
}

/**
 * 策略元数据
 */
export interface StrategyMetadata {
  /** 名称 */
  name: string

  /** 描述 */
  description?: string

  /** 版本 */
  version?: string

  /** 作者 */
  author?: string

  /** 标签 */
  tags?: string[]

  /** 依赖的其他策略 */
  dependencies?: string[]

  /** 与其他策略的冲突 */
  conflicts?: string[]
}

