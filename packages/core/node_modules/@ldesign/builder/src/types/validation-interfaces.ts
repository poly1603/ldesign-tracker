/**
 * 打包后验证 - 接口类型定义
 *
 * @remarks
 * 从 `validation.ts` 中拆分出验证器、测试运行器和报告生成器相关接口，
 * 保持原有接口名称和签名完全不变，仅调整所在模块，便于维护和复用。
 */

import type { PostBuildValidationConfig, ValidationContext, ValidationReportingConfig } from './validation-config'
import type { TestRunResult, ValidationReport, ValidationResult } from './validation-results'

/**
 * 验证器接口
 */
export interface IPostBuildValidator {
  /** 执行验证 */
  validate(context: ValidationContext): Promise<ValidationResult>

  /** 设置配置 */
  setConfig(config: PostBuildValidationConfig): void

  /** 获取配置 */
  getConfig(): PostBuildValidationConfig

  /** 清理资源 */
  dispose(): Promise<void>
}

/**
 * 测试运行器接口
 */
export interface ITestRunner {
  /** 运行测试 */
  runTests(context: ValidationContext): Promise<TestRunResult>

  /** 检测测试框架 */
  detectFramework(projectRoot: string): Promise<string>

  /** 安装依赖 */
  installDependencies(context: ValidationContext): Promise<void>
}

/**
 * 验证报告生成器接口
 */
export interface IValidationReporter {
  /** 生成报告 */
  generateReport(result: ValidationResult, config: ValidationReportingConfig): Promise<ValidationReport>

  /** 输出报告 */
  outputReport(report: ValidationReport, config: ValidationReportingConfig): Promise<void>
}

