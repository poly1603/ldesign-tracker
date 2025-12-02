/**
 * 打包后验证 - 配置与上下文相关类型
 *
 * @remarks
 * 从 `validation.ts` 中拆分出与验证配置、环境、范围以及上下文相关的类型，
 * 保持原有类型名称和结构完全不变，仅调整所在模块，便于维护。
 */

import type { BuildContext, BuildResult } from './builder'
import type { LogLevel } from './common'
import type { TestRunResult, ValidationResult } from './validation-results'

/**
 * 验证配置接口
 */
export interface PostBuildValidationConfig {
  /** 是否启用验证 */
  enabled?: boolean

  /** 测试框架类型 */
  testFramework?: 'vitest' | 'jest' | 'mocha' | 'auto'

  /** 测试文件匹配模式 */
  testPattern?: string | string[]

  /** 测试超时时间（毫秒） */
  timeout?: number

  /** 是否在验证失败时停止构建 */
  failOnError?: boolean

  /** 验证环境配置 */
  environment?: ValidationEnvironmentConfig

  /** 验证报告配置 */
  reporting?: ValidationReportingConfig

  /** 自定义验证钩子 */
  hooks?: ValidationHooks

  /** 验证范围配置 */
  scope?: ValidationScopeConfig
}

/**
 * 验证环境配置
 */
export interface ValidationEnvironmentConfig {
  /** 临时目录路径 */
  tempDir?: string

  /** 是否保留临时文件（用于调试） */
  keepTempFiles?: boolean

  /** 环境变量 */
  env?: Record<string, string>

  /** Node.js 版本要求 */
  nodeVersion?: string

  /** 包管理器类型 */
  packageManager?: 'npm' | 'yarn' | 'pnpm' | 'auto'

  /** 是否安装依赖 */
  installDependencies?: boolean

  /** 依赖安装超时时间 */
  installTimeout?: number
}

/**
 * 验证报告配置
 */
export interface ValidationReportingConfig {
  /** 报告格式 */
  format?: 'json' | 'html' | 'markdown' | 'console'

  /** 报告输出路径 */
  outputPath?: string

  /** 是否显示详细信息 */
  verbose?: boolean

  /** 日志级别 */
  logLevel?: LogLevel

  /** 是否包含性能指标 */
  includePerformance?: boolean

  /** 是否包含覆盖率信息 */
  includeCoverage?: boolean
}

/**
 * 验证范围配置
 */
export interface ValidationScopeConfig {
  /** 要验证的输出格式 */
  formats?: ('esm' | 'cjs' | 'umd' | 'iife')[]

  /** 要验证的文件类型 */
  fileTypes?: ('js' | 'ts' | 'dts' | 'css' | 'less' | 'scss')[]

  /** 排除的文件模式 */
  exclude?: string[]

  /** 包含的文件模式 */
  include?: string[]

  /** 是否验证类型定义 */
  validateTypes?: boolean

  /** 是否验证样式文件 */
  validateStyles?: boolean

  /** 是否验证源码映射 */
  validateSourceMaps?: boolean
}

/**
 * 验证钩子
 */
export interface ValidationHooks {
  /** 验证开始前 */
  beforeValidation?: (context: ValidationContext) => Promise<void> | void

  /** 环境准备后 */
  afterEnvironmentSetup?: (context: ValidationContext) => Promise<void> | void

  /** 测试运行前 */
  beforeTestRun?: (context: ValidationContext) => Promise<void> | void

  /** 测试运行后 */
  afterTestRun?: (context: ValidationContext, result: TestRunResult) => Promise<void> | void

  /** 验证完成后 */
  afterValidation?: (context: ValidationContext, result: ValidationResult) => Promise<void> | void

  /** 验证失败时 */
  onValidationError?: (context: ValidationContext, error: Error) => Promise<void> | void
}

/**
 * 验证上下文
 */
export interface ValidationContext {
  /** 构建上下文 */
  buildContext: BuildContext

  /** 构建结果 */
  buildResult: BuildResult

  /** 验证配置 */
  config: PostBuildValidationConfig

  /** 临时目录路径 */
  tempDir: string

  /** 验证开始时间 */
  startTime: number

  /** 验证ID */
  validationId: string

  /** 项目根目录 */
  projectRoot: string

  /** 输出目录 */
  outputDir: string
}

