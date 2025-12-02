/**
 * 打包后验证 - 结果与报告相关类型
 *
 * @remarks
 * 从 `validation.ts` 中拆分出所有与测试结果、覆盖率、验证报告有关的类型，
 * 保持原有类型名称和结构完全不变，仅调整所在模块，便于维护。
 */

/**
 * 测试运行结果
 */
export interface TestRunResult {
  /** 是否成功 */
  success: boolean

  /** 测试总数 */
  totalTests: number

  /** 通过的测试数 */
  passedTests: number

  /** 失败的测试数 */
  failedTests: number

  /** 跳过的测试数 */
  skippedTests: number

  /** 运行时间（毫秒） */
  duration: number

  /** 测试输出 */
  output: string

  /** 错误信息 */
  errors: TestError[]

  /** 覆盖率信息 */
  coverage?: CoverageInfo

  /** 性能指标 */
  performance?: TestPerformanceMetrics
}

/**
 * 测试错误信息
 */
export interface TestError {
  /** 错误消息 */
  message: string

  /** 错误堆栈 */
  stack?: string

  /** 测试文件路径 */
  file?: string

  /** 行号 */
  line?: number

  /** 列号 */
  column?: number

  /** 错误类型 */
  type: 'assertion' | 'timeout' | 'runtime' | 'syntax'
}

/**
 * 覆盖率指标
 */
export interface CoverageMetric {
  /** 总数 */
  total: number

  /** 覆盖数 */
  covered: number

  /** 覆盖率百分比 */
  percentage: number
}

/**
 * 覆盖率信息
 */
export interface CoverageInfo {
  /** 行覆盖率 */
  lines: CoverageMetric

  /** 函数覆盖率 */
  functions: CoverageMetric

  /** 分支覆盖率 */
  branches: CoverageMetric

  /** 语句覆盖率 */
  statements: CoverageMetric

  /** 详细文件覆盖率 */
  files?: Record<string, FileCoverageInfo>
}

/**
 * 文件覆盖率信息
 */
export interface FileCoverageInfo {
  /** 文件路径 */
  path: string

  /** 行覆盖率 */
  lines: CoverageMetric

  /** 函数覆盖率 */
  functions: CoverageMetric

  /** 分支覆盖率 */
  branches: CoverageMetric

  /** 语句覆盖率 */
  statements: CoverageMetric

  /** 未覆盖的行号 */
  uncoveredLines: number[]
}

/**
 * 测试性能指标
 */
export interface TestPerformanceMetrics {
  /** 测试启动时间 */
  setupTime: number

  /** 测试执行时间 */
  executionTime: number

  /** 测试清理时间 */
  teardownTime: number

  /** 内存使用峰值（MB） */
  peakMemoryUsage: number

  /** CPU 使用率 */
  cpuUsage: number
}

/**
 * 验证结果
 */
export interface ValidationResult {
  /** 验证是否成功 */
  success: boolean

  /** 验证持续时间（毫秒） */
  duration: number

  /** 测试运行结果 */
  testResult: TestRunResult

  /** 验证报告 */
  report: ValidationReport

  /** 错误信息 */
  errors: ValidationError[]

  /** 警告信息 */
  warnings: ValidationWarning[]

  /** 验证统计 */
  stats: ValidationStats

  /** 验证时间戳 */
  timestamp: number

  /** 验证ID */
  validationId: string
}
/**
 * 验证报告
 */
export interface ValidationReport {
  /** 报告标题 */
  title: string

  /** 报告摘要 */
  summary: ValidationSummary

  /** 详细结果 */
  details: ValidationDetails

  /** 建议和修复方案 */
  recommendations: ValidationRecommendation[]

  /** 报告生成时间 */
  generatedAt: number

  /** 报告格式版本 */
  version: string
}

/**
 * 验证摘要
 */
export interface ValidationSummary {
  /** 总体状态 */
  status: 'passed' | 'failed' | 'warning'

  /** 验证的文件数量 */
  totalFiles: number

  /** 成功验证的文件数量 */
  passedFiles: number

  /** 失败验证的文件数量 */
  failedFiles: number

  /** 总测试数 */
  totalTests: number

  /** 通过的测试数 */
  passedTests: number

  /** 失败的测试数 */
  failedTests: number

  /** 验证耗时 */
  duration: number
}

/**
 * 验证详细信息
 */
export interface ValidationDetails {
  /** 文件验证结果 */
  fileResults: FileValidationResult[]

  /** 格式验证结果 */
  formatResults: FormatValidationResult[]

  /** 类型验证结果 */
  typeResults?: TypeValidationResult[]

  /** 样式验证结果 */
  styleResults?: StyleValidationResult[]
}

/**
 * 文件验证结果
 */
export interface FileValidationResult {
  /** 文件路径 */
  filePath: string

  /** 验证状态 */
  status: 'passed' | 'failed' | 'skipped'

  /** 文件大小 */
  size: number

  /** 验证耗时 */
  duration: number

  /** 错误信息 */
  errors: ValidationError[]

  /** 警告信息 */
  warnings: ValidationWarning[]
}

/**
 * 格式验证结果
 */
export interface FormatValidationResult {
  /** 输出格式 */
  format: 'esm' | 'cjs' | 'umd' | 'iife'

  /** 验证状态 */
  status: 'passed' | 'failed' | 'skipped'

  /** 输出文件路径 */
  outputPath: string

  /** 文件大小 */
  size: number

  /** 压缩后大小 */
  gzipSize?: number

  /** 验证耗时 */
  duration: number

  /** 错误信息 */
  errors: ValidationError[]

  /** 警告信息 */
  warnings: ValidationWarning[]
}

/**
 * 类型验证结果
 */
export interface TypeValidationResult {
  /** 类型定义文件路径 */
  dtsPath: string

  /** 验证状态 */
  status: 'passed' | 'failed' | 'skipped'

  /** TypeScript 版本 */
  tsVersion: string

  /** 类型检查结果 */
  typeCheckResult: TypeCheckResult

  /** 验证耗时 */
  duration: number

  /** 错误信息 */
  errors: ValidationError[]

  /** 警告信息 */
  warnings: ValidationWarning[]
}

/**
 * 样式验证结果
 */
export interface StyleValidationResult {
  /** 样式文件路径 */
  stylePath: string

  /** 验证状态 */
  status: 'passed' | 'failed' | 'skipped'

  /** 样式文件大小 */
  size: number

  /** 压缩后大小 */
  minifiedSize?: number

  /** 验证耗时 */
  duration: number

  /** 错误信息 */
  errors: ValidationError[]

  /** 警告信息 */
  warnings: ValidationWarning[]
}

/**
 * TypeScript 类型检查结果
 */
export interface TypeCheckResult {
  /** 是否通过类型检查 */
  success: boolean

  /** 诊断信息 */
  diagnostics: TypeDiagnostic[]

  /** 检查耗时 */
  duration: number
}

/**
 * TypeScript 诊断信息
 */
export interface TypeDiagnostic {
  /** 错误代码 */
  code: number

  /** 错误消息 */
  message: string

  /** 文件路径 */
  file?: string

  /** 行号 */
  line?: number

  /** 列号 */
  column?: number

  /** 严重程度 */
  severity: 'error' | 'warning' | 'info'
}

/**
 * 验证错误
 */
export interface ValidationError {
  /** 错误代码 */
  code: string

  /** 错误消息 */
  message: string

  /** 错误详情 */
  details?: string

  /** 相关文件 */
  file?: string

  /** 行号 */
  line?: number

  /** 列号 */
  column?: number

  /** 错误堆栈 */
  stack?: string

  /** 错误类型 */
  type: 'build' | 'test' | 'type' | 'style' | 'runtime'
}

/**
 * 验证警告
 */
export interface ValidationWarning {
  /** 警告代码 */
  code: string

  /** 警告消息 */
  message: string

  /** 警告详情 */
  details?: string

  /** 相关文件 */
  file?: string

  /** 行号 */
  line?: number

  /** 列号 */
  column?: number

  /** 警告类型 */
  type: 'performance' | 'compatibility' | 'best-practice' | 'deprecation'
}

/**
 * 验证统计
 */
export interface ValidationStats {
  /** 验证开始时间 */
  startTime: number

  /** 验证结束时间 */
  endTime: number

  /** 验证总耗时 */
  totalDuration: number

  /** 环境准备耗时 */
  setupDuration: number

  /** 测试运行耗时 */
  testDuration: number

  /** 报告生成耗时 */
  reportDuration: number

  /** 清理耗时 */
  cleanupDuration: number

  /** 验证的文件总数 */
  totalFiles: number

  /** 验证的测试总数 */
  totalTests: number

  /** 内存使用峰值（MB） */
  peakMemoryUsage: number
}

/**
 * 验证建议
 */
export interface ValidationRecommendation {
  /** 建议类型 */
  type: 'error' | 'warning' | 'info' | 'optimization'

  /** 建议标题 */
  title: string

  /** 建议描述 */
  description: string

  /** 修复方案 */
  solution?: string

  /** 相关文件 */
  files?: string[]

  /** 优先级 */
  priority: 'high' | 'medium' | 'low'
}

