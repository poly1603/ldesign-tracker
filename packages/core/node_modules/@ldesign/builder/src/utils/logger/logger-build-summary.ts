/**
 * 构建摘要展示工具函数
 *
 * 【功能描述】
 * 将 Logger 的构建结果摘要展示逻辑从核心类中拆分出来，
 * 便于复用和单元测试，同时保持 Logger.showBuildSummary 的行为不变。
 *
 * @module utils/logger/logger-build-summary
 */

import chalk from 'chalk'
import { formatDuration, formatBytes } from './formatters'
import { LOG_ICONS, BUILD_SUMMARY_FORMAT } from '../../constants/log-config'
import type { BuildSummaryData } from './logger-types'
import type { Logger } from './Logger'

/** 状态图标映射 */
const STATUS_ICONS: Record<BuildSummaryData['status'], string> = {
  success: '✓',
  failed: '✗',
  warning: '⚠',
}

/** 状态颜色映射 */
const STATUS_COLORS: Record<BuildSummaryData['status'], typeof chalk.green> = {
  success: chalk.green,
  failed: chalk.red,
  warning: chalk.yellow,
}

/**
 * 使用指定的 Logger 实例输出构建摘要信息
 *
 * @param logger - 日志记录器实例
 * @param data - 构建摘要数据
 */
export function renderBuildSummary(logger: Logger, data: BuildSummaryData): void {
  const statusIcon = STATUS_ICONS[data.status]
  const statusColor = STATUS_COLORS[data.status]
  
  // 美化后的构建摘要
  console.log('')
  console.log(chalk.green('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
  console.log(`${statusColor.bold(statusIcon)} ${chalk.blue.bold('构建完成')}`)
  console.log(chalk.green('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
  
  // 构建信息
  console.log(`  ${chalk.dim('耗时:')}     ${chalk.yellow(formatDuration(data.duration))}`)
  console.log(`  ${chalk.dim('文件数:')}   ${chalk.cyan(data.fileCount)} 个`)
  console.log(`  ${chalk.dim('总大小:')}   ${chalk.cyan(formatBytes(data.totalSize))}`)
  
  // 警告和错误
  if (data.warnings && data.warnings > 0) {
    console.log(`  ${chalk.dim('警告:')}     ${chalk.yellow(data.warnings)} 个`)
  }
  
  if (data.errors && data.errors > 0) {
    console.log(`  ${chalk.dim('错误:')}     ${chalk.red(data.errors)} 个`)
  }
  
  console.log(chalk.green('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
  console.log('')
}

