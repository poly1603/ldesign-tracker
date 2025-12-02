/**
 * CLI构建共享工具
 * 
 * 提取重复的构建相关逻辑，供多个命令使用
 */

import type { BuildResult } from '../../types/builder'
import type { BuilderConfig } from '../../types/config'
import { Logger, highlight } from '../../utils/logger'
import { formatFileSize, formatDuration } from '../../utils/formatters/format-utils'

/**
 * 显示构建信息
 */
export function showBuildInfo(config: BuilderConfig, logger: Logger): void {
  const configItems: string[] = []

  if (config.input) {
    const inputStr = typeof config.input === 'string'
      ? config.input
      : Array.isArray(config.input)
        ? `${config.input.length} files`
        : 'multiple entries'
    configItems.push(highlight.dim(`入口: ${inputStr}`))
  }

  if (config.output?.format) {
    const formats = Array.isArray(config.output.format)
      ? config.output.format.join('+')
      : config.output.format
    configItems.push(`格式: ${highlight.important(formats)}`)
  }

  if (config.mode) {
    configItems.push(highlight.dim(`模式: ${config.mode}`))
  }

  // 一行显示所有配置项
  logger.info(`📦 ${configItems.join(' | ')}`)
}

/**
 * 显示构建结果
 */
export function showBuildResult(
  result: BuildResult,
  startTime: number,
  logger: Logger,
  timings?: Record<string, number>
): void {
  const duration = Date.now() - startTime

  if (result.outputs && result.outputs.length > 0) {
    // 计算统计信息
    const stats = calculateBuildStats(result)

    // 显示构建摘要
    if (typeof logger.showBuildSummary === 'function') {
      logger.showBuildSummary({
        duration,
        fileCount: stats.total,
        totalSize: stats.totalSize,
        status: result.success ? 'success' : 'failed',
        warnings: result.warnings?.length || 0,
        errors: result.errors?.length || 0
      })
    }

    // 显示文件详情
    showFileDetails(stats, logger)

    // 显示警告
    showWarnings(result, logger)

    // 显示阶段耗时
    if (timings && Object.keys(timings).length > 0) {
      showTimings(timings, duration, logger)
    }
  }

  logger.newLine()
}

/**
 * 分析打包结果
 */
export async function analyzeBuildResult(
  result: BuildResult,
  logger: Logger
): Promise<void> {
  const { createBundleAnalyzer } = await import('../../utils/optimization/BundleAnalyzer')

  logger.newLine()
  logger.info('📊 正在分析打包结果...')

  const analyzer = createBundleAnalyzer(logger)
  const report = await analyzer.generateReport(result.outputs || [])

  // 显示体积分析
  showSizeAnalysis(report, logger)

  // 显示重复依赖
  showDuplicates(report, logger)

  // 显示优化建议
  showSuggestions(report, logger)

  logger.newLine()
  logger.success('✅ 分析完成')
}

// ========== 私有辅助函数 ==========

interface BuildStats {
  total: number
  js: number
  map: number
  dts: number
  other: number
  totalSize: number
  totalGzipSize: number
}

function calculateBuildStats(result: BuildResult): BuildStats {
  const stats: BuildStats = {
    total: 0,
    js: 0,
    map: 0,
    dts: 0,
    other: 0,
    totalSize: 0,
    totalGzipSize: 0
  }

  if (!result.outputs) return stats

  stats.total = result.outputs.length

  for (const output of result.outputs) {
    stats.totalSize += output.size || 0
    stats.totalGzipSize += output.gzipSize || 0

    const fileName = output.fileName
    if (fileName.endsWith('.d.ts') || fileName.endsWith('.d.cts')) {
      stats.dts++
    } else if (fileName.endsWith('.map')) {
      stats.map++
    } else if (fileName.endsWith('.js') || fileName.endsWith('.cjs')) {
      stats.js++
    } else {
      stats.other++
    }
  }

  return stats
}

function showFileDetails(stats: BuildStats, logger: Logger): void {
  logger.info('📋 文件详情:')

  logger.info(`  JS 文件: ${highlight.number(stats.js)} 个`)
  logger.info(`  DTS 文件: ${highlight.number(stats.dts)} 个`)
  logger.info(`  Source Map: ${highlight.number(stats.map)} 个`)

  if (stats.other > 0) {
    logger.info(`  其他文件: ${highlight.number(stats.other)} 个`)
  }

  if (stats.totalGzipSize > 0) {
    const compressionRatio = Math.round((1 - stats.totalGzipSize / stats.totalSize) * 100)
    logger.info(`  Gzip 后: ${formatFileSize(stats.totalGzipSize)} ${highlight.dim(`(压缩 ${compressionRatio}%)`)}`)
  }

  logger.newLine()
}

function showWarnings(result: BuildResult, logger: Logger): void {
  if (result.warnings && result.warnings.length > 0) {
    logger.newLine()
    logger.warn(`⚠️  发现 ${highlight.number(result.warnings.length)} 个警告:`)
    for (const warning of result.warnings) {
      const warningMsg = typeof warning === 'string' ? warning : warning.message || String(warning)
      logger.warn(`  ${warningMsg}`)
    }
  }
}

function showTimings(
  timings: Record<string, number>,
  totalDuration: number,
  logger: Logger
): void {
  logger.newLine()
  logger.info('⏱️  阶段耗时:')

  const sortedTimings = Object.entries(timings).sort((a, b) => b[1] - a[1])
  const maxTime = Math.max(...sortedTimings.map(([, time]) => time))

  for (const [phase, time] of sortedTimings) {
    const percentage = Math.round((time / totalDuration) * 100)
    const barLength = Math.round((time / maxTime) * 20)
    const bar = '█'.repeat(barLength) + '░'.repeat(20 - barLength)

    logger.info(
      `  ${phase.padEnd(12)} ${highlight.dim(bar)} ${highlight.time(formatDuration(time).padStart(8))} ${highlight.dim(`(${percentage}%)`)}`
    )
  }
}

function showSizeAnalysis(report: any, logger: Logger): void {
  logger.newLine()
  logger.info('📦 体积分析:')
  logger.info(`  总大小: ${(report.sizeAnalysis.total / 1024).toFixed(2)} KB`)

  if (report.sizeAnalysis.byModule && report.sizeAnalysis.byModule.length > 0) {
    logger.info('  最大模块:')
    report.sizeAnalysis.byModule.slice(0, 5).forEach((m: any) => {
      logger.info(
        `    ${m.module}: ${(m.size / 1024).toFixed(2)} KB (${m.percentage.toFixed(1)}%)`
      )
    })
  }
}

function showDuplicates(report: any, logger: Logger): void {
  if (report.duplicates && report.duplicates.length > 0) {
    logger.newLine()
    logger.warn(`⚠️  发现 ${report.duplicates.length} 个重复依赖:`)
    report.duplicates.forEach((dup: any) => {
      logger.warn(`  ${dup.name}: ${dup.versions.length} 个版本`)
    })
  }
}

function showSuggestions(report: any, logger: Logger): void {
  if (report.suggestions && report.suggestions.length > 0) {
    logger.newLine()
    logger.info('💡 优化建议:')
    report.suggestions.forEach((sug: any) => {
      const icon = sug.severity === 'high' ? '🔴'
        : sug.severity === 'medium' ? '🟡'
          : '🟢'
      logger.info(`  ${icon} ${sug.title}`)
      logger.info(`     ${sug.description}`)
      logger.info(`     建议: ${sug.solution}`)
    })
  }
}
