/**
 * 配置冲突解析器
 *
 * 检测并修复常见的配置问题：
 * - 重复的 UMD 配置
 * - 冗余的 libraryType 声明
 * - 冗余的 TypeScript 声明设置
 * - 冲突的入口点配置
 *
 * 与 normalizer.ts 的区别：
 * - normalizer.ts: 处理配置格式兼容性问题（旧版 -> 新版）
 * - 本文件: 处理配置冲突和重复问题
 *
 * @author LDesign Team
 * @version 1.0.0
 */

import type { BuilderConfig } from '../types/config'
import { createLogger } from '../utils/logger'

const logger = createLogger({ prefix: 'ConflictResolver' })

/**
 * 冲突警告类型
 */
export interface ConflictWarning {
  /** 警告类型 */
  type: 'duplicate' | 'redundant' | 'deprecated' | 'conflict'
  /** 相关字段 */
  field: string
  /** 警告消息 */
  message: string
  /** 修复建议 */
  suggestion?: string
}

/**
 * 冲突解析结果
 */
export interface ConflictResolutionResult {
  /** 解析后的配置 */
  config: BuilderConfig
  /** 警告列表 */
  warnings: ConflictWarning[]
  /** 是否进行了修复 */
  fixed: boolean
}

/**
 * 配置冲突解析器
 *
 * @example
 * ```typescript
 * const resolver = new ConfigConflictResolver()
 * const result = resolver.resolve(config)
 * if (result.warnings.length > 0) {
 *   resolver.printWarnings()
 * }
 * ```
 */
export class ConfigConflictResolver {
  private warnings: ConflictWarning[] = []

  /**
   * 解析配置冲突
   *
   * @param config - 原始配置
   * @returns 解析结果
   */
  resolve(config: BuilderConfig): ConflictResolutionResult {
    this.warnings = []
    const normalized = { ...config }

    // Check for duplicate UMD configurations
    this.checkDuplicateUMD(normalized)

    // Check for redundant libraryType
    this.checkRedundantLibraryType(normalized)

    // Check for redundant TypeScript declaration settings
    this.checkRedundantTypeScriptDeclaration(normalized)

    // Check for conflicting entry points
    this.checkConflictingEntryPoints(normalized)

    // Merge duplicate configs if found
    const fixed = this.mergeDuplicateConfigs(normalized)

    return {
      config: normalized,
      warnings: this.warnings,
      fixed: this.warnings.length > 0 || fixed,
    }
  }

  /**
   * Check for duplicate UMD configurations
   */
  private checkDuplicateUMD(config: BuilderConfig): void {
    if (config.output?.umd && (config as any).umd) {
      this.warnings.push({
        type: 'duplicate',
        field: 'umd',
        message: 'Duplicate UMD configuration found in both output.umd and top-level umd',
        suggestion: 'Remove the top-level umd configuration and keep only output.umd',
      })
    }
  }

  /**
   * Check for redundant libraryType declaration
   */
  private checkRedundantLibraryType(config: BuilderConfig): void {
    if (config.libraryType === 'typescript') {
      this.warnings.push({
        type: 'redundant',
        field: 'libraryType',
        message: 'libraryType: "typescript" is auto-detected and can be removed',
        suggestion: 'Remove libraryType field from config',
      })
    }
  }

  /**
   * Check for redundant TypeScript declaration settings
   */
  private checkRedundantTypeScriptDeclaration(config: BuilderConfig): void {
    if (config.dts && config.typescript?.declaration) {
      this.warnings.push({
        type: 'redundant',
        field: 'typescript.declaration',
        message: 'typescript.declaration is redundant when dts: true is set',
        suggestion: 'Remove typescript.declaration and typescript.declarationMap',
      })
    }
  }

  /**
   * Check for conflicting entry points
   */
  private checkConflictingEntryPoints(config: BuilderConfig): void {
    const umdOutput = config.output?.umd
    const umdOutputEntry = typeof umdOutput === 'object' && umdOutput ? (umdOutput as any).entry : undefined
    const topLevelUmdEntry = (config as any).umd?.entry

    if (umdOutputEntry && topLevelUmdEntry && umdOutputEntry !== topLevelUmdEntry) {
      this.warnings.push({
        type: 'conflict',
        field: 'umd.entry',
        message: `Conflicting UMD entry points: output.umd.entry="${umdOutputEntry}" vs umd.entry="${topLevelUmdEntry}"`,
        suggestion: 'Keep only output.umd.entry configuration',
      })
    }
  }

  /**
   * Merge duplicate configurations
   */
  private mergeDuplicateConfigs(config: BuilderConfig): boolean {
    let fixed = false

    // Merge duplicate UMD configs
    const outputUmd = config.output?.umd
    if (typeof outputUmd === 'object' && outputUmd && (config as any).umd) {
      const topLevelUmd = (config as any).umd

      // Merge properties from top-level to output if not already set
      if (topLevelUmd.entry && !(outputUmd as any).entry) {
        (outputUmd as any).entry = topLevelUmd.entry
      }
      if (topLevelUmd.name && !outputUmd.name) {
        (outputUmd as any).name = topLevelUmd.name
      }
      if (topLevelUmd.enabled !== undefined && (outputUmd as any).enabled === undefined) {
        (outputUmd as any).enabled = topLevelUmd.enabled
      }

      // Remove top-level UMD config
      delete (config as any).umd
      fixed = true
    }

    return fixed
  }

  /**
   * Print warnings to console
   */
  printWarnings(): void {
    if (this.warnings.length === 0) {
      return
    }

    logger.warn(`\n⚠️  Configuration issues detected:\n`)

    this.warnings.forEach((warning, index) => {
      logger.warn(`${index + 1}. [${warning.type.toUpperCase()}] ${warning.field}`)
      logger.warn(`   ${warning.message}`)
      if (warning.suggestion) {
        logger.info(`   💡 ${warning.suggestion}`)
      }
      logger.warn('')
    })
  }
}

/**
 * 创建配置冲突解析器
 */
export function createConflictResolver(): ConfigConflictResolver {
  return new ConfigConflictResolver()
}

/**
 * 解析配置冲突
 *
 * @param config - 原始配置
 * @param verbose - 是否输出警告信息
 * @returns 解析结果
 */
export function resolveConfigConflicts(config: BuilderConfig, verbose = true): ConflictResolutionResult {
  const resolver = createConflictResolver()
  const result = resolver.resolve(config)

  if (verbose && result.warnings.length > 0) {
    resolver.printWarnings()
  }

  return result
}

// 向后兼容的别名
/** @deprecated 使用 ConfigConflictResolver 代替 */
export { ConfigConflictResolver as ConfigNormalizer }
/** @deprecated 使用 createConflictResolver 代替 */
export { createConflictResolver as createConfigNormalizer }
/** @deprecated 使用 resolveConfigConflicts 代替 */
export { resolveConfigConflicts as normalizeConfig }
/** @deprecated 使用 ConflictWarning 代替 */
export type { ConflictWarning as NormalizationWarning }
/** @deprecated 使用 ConflictResolutionResult 代替 */
export type { ConflictResolutionResult as NormalizationResult }
