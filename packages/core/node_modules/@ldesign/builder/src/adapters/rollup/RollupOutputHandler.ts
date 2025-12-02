/**
 * Rollup 输出处理器
 * 负责处理构建输出、生成报告等
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import type { BuildResult } from '../../types/builder'
import type { Logger } from '../../utils/logger'
import path from 'path'
import fs from 'fs-extra'

/**
 * Rollup 输出处理器
 */
export class RollupOutputHandler {
  private logger: Logger

  constructor(logger: Logger) {
    this.logger = logger
  }

  /**
   * 处理构建输出
   */
  async processOutputs(
    results: Array<{ chunk: any; format: string }>,
    duration: number
  ): Promise<BuildResult> {
    // 计算 gzip 大小
    const { gzipSize } = await import('gzip-size')
    const outputs = [] as any[]
    let totalRaw = 0
    let largest = { file: '', size: 0 }

    for (const r of results) {
      const chunk = r.chunk
      const codeOrSource = chunk.type === 'chunk' ? chunk.code : chunk.source
      const rawSize = typeof codeOrSource === 'string'
        ? codeOrSource.length
        : (codeOrSource?.byteLength || 0)
      const gz = typeof codeOrSource === 'string' ? await gzipSize(codeOrSource) : 0

      totalRaw += rawSize
      if (rawSize > largest.size) {
        largest = { file: chunk.fileName, size: rawSize }
      }

      outputs.push({
        fileName: chunk.fileName,
        size: rawSize,
        source: codeOrSource,
        type: chunk.type,
        format: r.format,
        gzipSize: gz
      })
    }

    // 构建结果
    const buildResult: BuildResult = {
      success: true,
      outputs,
      duration,
      stats: this.generateStats(outputs, duration, totalRaw, largest),
      performance: this.getPerformanceMetrics(),
      warnings: [],
      errors: [],
      buildId: `rollup-${Date.now()}`,
      timestamp: Date.now(),
      bundler: 'rollup',
      mode: 'production'
    }

    return buildResult
  }

  /**
   * 生成统计信息
   */
  private generateStats(outputs: any[], duration: number, totalRaw: number, largest: { file: string; size: number }) {
    return {
      buildTime: duration,
      fileCount: outputs.length,
      totalSize: {
        raw: totalRaw,
        gzip: outputs.reduce((s, o) => s + (o.gzipSize || 0), 0),
        brotli: 0,
        byType: {},
        byFormat: this.groupByFormat(outputs),
        largest,
        fileCount: outputs.length
      },
      byFormat: this.generateFormatStats(outputs),
      modules: {
        total: 0,
        external: 0,
        internal: 0,
        largest: {
          id: '',
          size: 0,
          renderedLength: 0,
          originalLength: 0,
          isEntry: false,
          isExternal: false,
          importedIds: [],
          dynamicallyImportedIds: [],
          importers: [],
          dynamicImporters: []
        }
      },
      dependencies: {
        total: 0,
        external: [],
        bundled: [],
        circular: []
      }
    }
  }

  /**
   * 按格式分组
   */
  private groupByFormat(outputs: any[]) {
    return {
      esm: outputs.filter(o => o.format === 'es' || o.format === 'esm').reduce((s, o) => s + o.size, 0),
      cjs: outputs.filter(o => o.format === 'cjs').reduce((s, o) => s + o.size, 0),
      umd: outputs.filter(o => o.format === 'umd').reduce((s, o) => s + o.size, 0),
      iife: outputs.filter(o => o.format === 'iife').reduce((s, o) => s + o.size, 0),
      css: outputs.filter(o => o.format === 'css').reduce((s, o) => s + o.size, 0),
      dts: outputs.filter(o => o.format === 'dts').reduce((s, o) => s + o.size, 0)
    }
  }

  /**
   * 生成格式统计
   */
  private generateFormatStats(outputs: any[]) {
    const createFormatStat = (format: string) => {
      const filtered = outputs.filter(o => o.format === format || (format === 'esm' && o.format === 'es'))
      return {
        fileCount: filtered.length,
        size: {
          raw: filtered.reduce((s, o) => s + o.size, 0),
          gzip: filtered.reduce((s, o) => s + (o.gzipSize || 0), 0),
          brotli: 0,
          byType: {},
          byFormat: { esm: 0, cjs: 0, umd: 0, iife: 0, css: 0, dts: 0 },
          largest: { file: '', size: 0 },
          fileCount: filtered.length
        }
      }
    }

    return {
      esm: createFormatStat('esm'),
      cjs: createFormatStat('cjs'),
      umd: createFormatStat('umd'),
      iife: createFormatStat('iife'),
      css: createFormatStat('css'),
      dts: createFormatStat('dts')
    }
  }

  /**
   * 获取性能指标
   */
  private getPerformanceMetrics() {
    return {
      buildTime: 0,
      memoryUsage: {
        heapUsed: process.memoryUsage().heapUsed,
        heapTotal: process.memoryUsage().heapTotal,
        external: process.memoryUsage().external,
        rss: process.memoryUsage().rss,
        peak: 0,
        trend: []
      },
      cacheStats: {
        hits: 0,
        misses: 0,
        hitRate: 0,
        size: 0,
        entries: 0,
        timeSaved: 0
      },
      fileStats: {
        totalFiles: 0,
        filesByType: {},
        averageProcessingTime: 0,
        slowestFiles: [],
        processingRate: 0
      },
      pluginPerformance: [],
      systemResources: {
        cpuUsage: 0,
        availableMemory: 0,
        diskUsage: {
          total: 0,
          used: 0,
          available: 0,
          usagePercent: 0
        }
      },
      bundleSize: 0
    }
  }

  /**
   * 复制 DTS 文件到各格式目录
   */
  async copyDtsFiles(config: any): Promise<void> {
    const outputConfig = config.output || {}
    const esmDir = (typeof outputConfig.esm === 'object' ? outputConfig.esm.dir : 'es') || 'es'
    const cjsDir = (typeof outputConfig.cjs === 'object' ? outputConfig.cjs.dir : 'lib') || 'lib'

    if (esmDir === cjsDir || !outputConfig.cjs) {
      return
    }

    const sourceDir = path.resolve(process.cwd(), esmDir)
    const targetDir = path.resolve(process.cwd(), cjsDir)

    if (!await fs.pathExists(sourceDir)) {
      return
    }

    try {
      const dtsFiles = await this.findDtsFiles(sourceDir)

      if (dtsFiles.length === 0) {
        return
      }

      this.logger.debug(`复制 ${dtsFiles.length} 个 DTS 文件从 ${esmDir} 到 ${cjsDir}...`)

      for (const dtsFile of dtsFiles) {
        const relativePath = path.relative(sourceDir, dtsFile)
        const targetRelativePath = relativePath.replace(/\.d\.ts$/, '.d.cts')
        const targetPath = path.join(targetDir, targetRelativePath)

        await fs.ensureDir(path.dirname(targetPath))
        await fs.copy(dtsFile, targetPath, { overwrite: true })
      }

      this.logger.debug(`DTS 文件复制完成`)
    } catch (error) {
      this.logger.warn(`复制 DTS 文件失败:`, (error as Error).message)
    }
  }

  /**
   * 查找 DTS 文件
   */
  private async findDtsFiles(dir: string): Promise<string[]> {
    const files: string[] = []

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)

        if (entry.isDirectory()) {
          const subFiles = await this.findDtsFiles(fullPath)
          files.push(...subFiles)
        } else if (entry.isFile() && entry.name.endsWith('.d.ts')) {
          files.push(fullPath)
        }
      }
    } catch {
      // 忽略错误
    }

    return files
  }
}

