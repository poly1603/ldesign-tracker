/**
 * 配置格式兼容层
 *
 * 将各种格式的配置统一转换为标准 BuilderConfig 格式
 * 支持向后兼容，处理 entry/input、formats/format 等不一致问题
 *
 * 与 config-normalizer.ts 的区别：
 * - config-normalizer.ts: 处理配置冲突和重复问题
 * - normalizer.ts (本文件): 处理配置格式兼容性问题
 *
 * @author LDesign Team
 * @version 1.0.0
 */

import type { BuilderConfig } from '../types/config'
import type { OutputConfig } from '../types/output'
import type { OutputFormat } from '../types/adapter'
import { Logger } from '../utils/logger'

/**
 * 兼容性配置接口
 * 支持旧版配置格式
 */
export interface LegacyConfig extends Partial<BuilderConfig> {
  /** 入口文件（旧版使用 entry，新版使用 input） */
  entry?: string | string[] | Record<string, string>

  /** 输出格式（旧版使用 formats，新版使用 output.format） */
  formats?: OutputFormat[]

  /** 输出目录（旧版使用 outDir，新版使用 output.dir） */
  outDir?: string

  /** 根目录（旧版配置） */
  root?: string

  /** 目标环境（旧版配置） */
  target?: string

  /** CSS 配置（旧版配置） */
  css?: boolean | object
}

/**
 * 规范化警告信息
 */
export interface NormalizationWarning {
  /** 警告类型 */
  type: 'deprecated' | 'renamed' | 'format'
  /** 旧字段名 */
  oldField: string
  /** 新字段名 */
  newField: string
  /** 警告消息 */
  message: string
}

/**
 * 规范化结果
 */
export interface NormalizationResult {
  /** 规范化后的配置 */
  config: BuilderConfig
  /** 警告信息 */
  warnings: NormalizationWarning[]
}

/**
 * 配置规范化器类
 */
export class ConfigNormalizer {
  private logger: Logger
  private warnings: NormalizationWarning[] = []

  constructor(logger?: Logger) {
    this.logger = logger || new Logger()
  }

  /**
   * 规范化配置
   *
   * @param config - 原始配置（可能包含旧版格式）
   * @returns 规范化结果
   */
  normalize(config: LegacyConfig): NormalizationResult {
    this.warnings = []

    const normalized: BuilderConfig = {
      ...config,
    }

    // 1. 规范化入口配置 (entry -> input)
    this.normalizeInput(config, normalized)

    // 2. 规范化输出格式 (formats -> output.format)
    this.normalizeFormats(config, normalized)

    // 3. 规范化输出目录 (outDir -> output.dir)
    this.normalizeOutputDir(config, normalized)

    // 4. 规范化输出配置简写形式
    this.normalizeOutputShorthand(normalized)

    // 5. 规范化其他旧版字段
    this.normalizeLegacyFields(config, normalized)

    // 清理已处理的旧版字段
    this.cleanupLegacyFields(normalized as LegacyConfig)

    // 输出警告信息
    this.logWarnings()

    return {
      config: normalized,
      warnings: this.warnings,
    }
  }

  /**
   * 规范化入口配置
   * 将 entry 转换为 input
   */
  private normalizeInput(config: LegacyConfig, normalized: BuilderConfig): void {
    if (config.entry && !config.input) {
      normalized.input = config.entry
      this.addWarning({
        type: 'renamed',
        oldField: 'entry',
        newField: 'input',
        message: '配置字段 "entry" 已重命名为 "input"，请更新配置文件',
      })
    }
  }

  /**
   * 规范化输出格式
   * 将顶层 formats 转换为 output.format
   */
  private normalizeFormats(config: LegacyConfig, normalized: BuilderConfig): void {
    if (config.formats && !config.output?.format) {
      normalized.output = normalized.output || {}
      normalized.output.format = config.formats
      this.addWarning({
        type: 'renamed',
        oldField: 'formats',
        newField: 'output.format',
        message: '配置字段 "formats" 已移动到 "output.format"，请更新配置文件',
      })
    }
  }

  /**
   * 规范化输出目录
   * 将 outDir 转换为 output.dir
   */
  private normalizeOutputDir(config: LegacyConfig, normalized: BuilderConfig): void {
    if (config.outDir && !config.output?.dir) {
      normalized.output = normalized.output || {}
      normalized.output.dir = config.outDir
      this.addWarning({
        type: 'renamed',
        oldField: 'outDir',
        newField: 'output.dir',
        message: '配置字段 "outDir" 已移动到 "output.dir"，请更新配置文件',
      })
    }
  }

  /**
   * 规范化输出配置简写形式
   * 将 output: { esm: 'es' } 转换为 output: { esm: { dir: 'es' } }
   */
  private normalizeOutputShorthand(normalized: BuilderConfig): void {
    if (!normalized.output)
      return

    const output = normalized.output as OutputConfig & Record<string, unknown>

    // 处理 esm 简写
    if (typeof output.esm === 'string') {
      output.esm = { dir: output.esm, format: 'esm' }
      this.addWarning({
        type: 'format',
        oldField: 'output.esm',
        newField: 'output.esm.dir',
        message: '输出配置 "esm" 应使用对象格式 { dir: "es" }',
      })
    }

    // 处理 cjs 简写
    if (typeof output.cjs === 'string') {
      output.cjs = { dir: output.cjs, format: 'cjs' }
      this.addWarning({
        type: 'format',
        oldField: 'output.cjs',
        newField: 'output.cjs.dir',
        message: '输出配置 "cjs" 应使用对象格式 { dir: "lib" }',
      })
    }

    // 处理 umd 简写
    if (typeof output.umd === 'string') {
      output.umd = { dir: output.umd, format: 'umd' }
      this.addWarning({
        type: 'format',
        oldField: 'output.umd',
        newField: 'output.umd.dir',
        message: '输出配置 "umd" 应使用对象格式 { dir: "dist" }',
      })
    }

    // 处理 output.formats（复数形式）
    if ('formats' in output && Array.isArray(output.formats)) {
      output.format = output.formats as OutputFormat[]
      delete output.formats
      this.addWarning({
        type: 'renamed',
        oldField: 'output.formats',
        newField: 'output.format',
        message: '配置字段 "output.formats" 已重命名为 "output.format"',
      })
    }
  }

  /**
   * 规范化其他旧版字段
   */
  private normalizeLegacyFields(config: LegacyConfig, normalized: BuilderConfig): void {
    // 处理 root -> cwd
    if (config.root && !config.cwd) {
      normalized.cwd = config.root
      this.addWarning({
        type: 'renamed',
        oldField: 'root',
        newField: 'cwd',
        message: '配置字段 "root" 已重命名为 "cwd"',
      })
    }

    // 处理 target -> typescript.target
    if (config.target && !config.typescript?.target) {
      normalized.typescript = normalized.typescript || {}
      normalized.typescript.target = config.target as any
      this.addWarning({
        type: 'renamed',
        oldField: 'target',
        newField: 'typescript.target',
        message: '配置字段 "target" 已移动到 "typescript.target"',
      })
    }

    // 处理 css -> style
    if (config.css !== undefined && !config.style) {
      if (typeof config.css === 'boolean') {
        normalized.style = config.css ? { extract: true } : { extract: false }
      }
      else if (typeof config.css === 'object') {
        normalized.style = config.css as any
      }
      this.addWarning({
        type: 'renamed',
        oldField: 'css',
        newField: 'style',
        message: '配置字段 "css" 已重命名为 "style"',
      })
    }
  }

  /**
   * 清理已处理的旧版字段
   */
  private cleanupLegacyFields(config: LegacyConfig): void {
    delete config.entry
    delete config.formats
    delete config.outDir
    delete config.root
    delete config.target
    delete config.css
  }

  /**
   * 添加警告信息
   */
  private addWarning(warning: NormalizationWarning): void {
    this.warnings.push(warning)
  }

  /**
   * 输出警告信息到日志
   */
  private logWarnings(): void {
    if (this.warnings.length === 0)
      return

    this.logger.warn('⚠️ 配置规范化警告:')
    for (const warning of this.warnings) {
      this.logger.warn(`  - ${warning.message}`)
    }
    this.logger.warn('  请参考文档更新配置格式以消除警告')
  }
}

/**
 * 默认配置规范化器实例
 */
export const configNormalizer = new ConfigNormalizer()

/**
 * 便捷函数：规范化配置
 *
 * @param config - 原始配置
 * @returns 规范化后的配置
 */
export function normalizeConfig(config: LegacyConfig): BuilderConfig {
  return configNormalizer.normalize(config).config
}

/**
 * 便捷函数：规范化配置并返回警告
 *
 * @param config - 原始配置
 * @returns 规范化结果（包含配置和警告）
 */
export function normalizeConfigWithWarnings(config: LegacyConfig): NormalizationResult {
  return configNormalizer.normalize(config)
}
