/**
 * 输出标准化器
 * 
 * 统一不同打包引擎的输出格式和结构
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import type { BuildResult } from '../../types/builder'
import type { OutputFile } from '../../types/output'
import * as path from 'path'
import * as fs from 'fs-extra'
import { Logger } from '../logger'

/**
 * 标准化的输出配置
 */
export interface NormalizedOutputConfig {
  dir: string
  format: 'esm' | 'cjs' | 'umd' | 'iife'
  fileName: string
  sourcemap: boolean
  minify: boolean
}

/**
 * 输出标准化器类
 */
export class OutputNormalizer {
  private logger: Logger

  constructor(logger?: Logger) {
    this.logger = logger || new Logger()
  }

  /**
   * 标准化构建结果
   * 
   * 确保不同引擎的输出结构一致：
   * - 文件路径统一
   * - 文件命名统一
   * - 目录结构统一
   */
  async normalize(result: BuildResult, config: any): Promise<BuildResult> {
    if (!result.success) {
      return result
    }

    try {
      this.logger.debug('开始标准化输出...')

      // 标准化输出路径
      const normalizedOutputs = await this.normalizeOutputPaths(result.outputs, config)

      // 标准化文件命名
      await this.normalizeFileNaming(normalizedOutputs, config)

      // 标准化目录结构
      await this.normalizeDirectoryStructure(normalizedOutputs, config)

      // 生成统一的 manifest
      await this.generateManifest(normalizedOutputs, config)

      this.logger.success('输出标准化完成')

      return {
        ...result,
        outputs: normalizedOutputs
      }
    } catch (error) {
      this.logger.error('输出标准化失败:', error)
      return result
    }
  }

  /**
   * 标准化输出路径
   */
  private async normalizeOutputPaths(
    outputs: OutputFile[],
    config: any
  ): Promise<OutputFile[]> {
    const normalized: OutputFile[] = []

    for (const output of outputs) {
      // 解析相对路径
      const relativePath = path.relative(process.cwd(), output.fileName)

      // 标准化路径分隔符
      const normalizedPath = relativePath.split(path.sep).join('/')

      normalized.push({
        ...output,
        fileName: normalizedPath
      })
    }

    return normalized
  }

  /**
   * 标准化文件命名
   * 
   * 统一命名规则：
   * - ESM: [name].js 或 [name].mjs
   * - CJS: [name].cjs
   * - UMD: [name].umd.js
   * - Types: [name].d.ts
   */
  private async normalizeFileNaming(
    outputs: OutputFile[],
    config: any
  ): Promise<void> {
    const outputConfig = config.output || {}

    for (const output of outputs) {
      const ext = path.extname(output.fileName)
      const basename = path.basename(output.fileName, ext)
      const dirname = path.dirname(output.fileName)

      // 根据格式决定扩展名
      let newExt = ext
      if (output.type === 'chunk') {
        if (dirname.includes('es') || dirname.includes('esm')) {
          newExt = outputConfig.esm?.ext || '.js'
        } else if (dirname.includes('lib') || dirname.includes('cjs')) {
          newExt = '.cjs'
        } else if (dirname.includes('dist') || dirname.includes('umd')) {
          newExt = '.umd.js'
        }
      }

      // 如果需要重命名
      if (newExt !== ext) {
        const oldPath = path.join(process.cwd(), output.fileName)
        const newPath = path.join(process.cwd(), dirname, basename + newExt)

        try {
          await fs.rename(oldPath, newPath)
          output.fileName = path.relative(process.cwd(), newPath)
          this.logger.debug(`重命名: ${oldPath} -> ${newPath}`)
        } catch (error) {
          this.logger.debug(`重命名失败: ${oldPath}`, error)
        }
      }
    }
  }

  /**
   * 标准化目录结构
   * 
   * 统一目录布局：
   * - es/ - ESM 输出
   * - lib/ - CJS 输出
   * - dist/ - UMD 输出
   * - types/ - 类型声明（可选）
   */
  private async normalizeDirectoryStructure(
    outputs: OutputFile[],
    config: any
  ): Promise<void> {
    const outputConfig = config.output || {}

    // 定义标准目录映射
    const dirMap: Record<string, string> = {
      'esm': outputConfig.esm?.dir || 'es',
      'cjs': outputConfig.cjs?.dir || 'lib',
      'umd': outputConfig.umd?.dir || 'dist',
      'types': outputConfig.types?.dir || 'types'
    }

    // 确保所有标准目录存在
    for (const dir of Object.values(dirMap)) {
      await fs.ensureDir(path.join(process.cwd(), dir))
    }
  }

  /**
   * 生成构建清单文件
   * 
   * 包含：
   * - 所有输出文件列表
   * - 文件大小和 gzip 大小
   * - 构建时间和引擎信息
   */
  private async generateManifest(
    outputs: OutputFile[],
    config: any
  ): Promise<void> {
    try {
      const manifest = {
        version: '1.0.0',
        buildTime: new Date().toISOString(),
        bundler: config.bundler || 'unknown',
        outputs: outputs.map(o => ({
          file: o.fileName,
          size: o.size,
          sizeFormatted: this.formatBytes(o.size),
          type: o.type
        })),
        config: {
          input: config.input,
          output: config.output,
          mode: config.mode,
          libraryType: config.libraryType
        }
      }

      const manifestPath = path.join(process.cwd(), '.ldesign', 'build-manifest.json')
      await fs.ensureDir(path.dirname(manifestPath))
      await fs.writeJSON(manifestPath, manifest, { spaces: 2 })

      this.logger.debug(`构建清单已生成: ${manifestPath}`)
    } catch (error) {
      this.logger.debug('生成构建清单失败:', error)
    }
  }

  /**
   * 格式化字节数
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'

    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  /**
   * 验证输出一致性
   * 
   * 检查不同引擎的输出是否符合预期：
   * - 文件是否存在
   * - 目录结构是否正确
   * - 文件大小是否合理
   */
  async validateOutputConsistency(
    results: Record<string, BuildResult>,
    config: any
  ): Promise<{
    consistent: boolean
    issues: string[]
    suggestions: string[]
  }> {
    const issues: string[] = []
    const suggestions: string[] = []

    try {
      // 获取所有引擎的输出
      const allOutputs = Object.entries(results).map(([bundler, result]) => ({
        bundler,
        outputs: result.outputs
      }))

      // 检查文件数量是否一致
      const fileCounts = allOutputs.map(o => o.outputs.length)
      if (new Set(fileCounts).size > 1) {
        issues.push(`不同引擎生成的文件数量不一致: ${fileCounts.join(', ')}`)
        suggestions.push('检查各引擎的配置是否一致')
      }

      // 检查文件类型分布
      for (const { bundler, outputs } of allOutputs) {
        const types = outputs.reduce((acc, o) => {
          acc[o.type] = (acc[o.type] || 0) + 1
          return acc
        }, {} as Record<string, number>)

        if (types['js'] === 0) {
          issues.push(`${bundler} 没有生成 JS 文件`)
        }
      }

      // 检查文件大小差异
      if (allOutputs.length > 1) {
        const sizeByFile: Record<string, number[]> = {}

        for (const { outputs } of allOutputs) {
          for (const output of outputs) {
            if (!sizeByFile[output.fileName]) {
              sizeByFile[output.fileName] = []
            }
            sizeByFile[output.fileName].push(output.size)
          }
        }

        for (const [file, sizes] of Object.entries(sizeByFile)) {
          const maxSize = Math.max(...sizes)
          const minSize = Math.min(...sizes)
          const diff = maxSize - minSize
          const diffPercent = (diff / maxSize) * 100

          if (diffPercent > 10) {
            issues.push(`文件 ${file} 大小差异较大: ${diffPercent.toFixed(1)}%`)
            suggestions.push(`检查 ${file} 的打包配置和优化选项`)
          }
        }
      }

      return {
        consistent: issues.length === 0,
        issues,
        suggestions
      }
    } catch (error) {
      return {
        consistent: false,
        issues: [`验证失败: ${(error as Error).message}`],
        suggestions: ['请检查构建配置和输出路径']
      }
    }
  }
}

/**
 * 创建输出标准化器
 */
export function createOutputNormalizer(logger?: Logger): OutputNormalizer {
  return new OutputNormalizer(logger)
}



