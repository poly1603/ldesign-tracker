/**
 * 配置 Schema 验证器
 * 提供类型安全的配置验证和解析
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import type { BuilderConfig } from '../types/config'
import type { ValidationResult } from '../types/common'
import { LibraryType } from '../types/library'
import { Logger } from '../utils/logger'

/**
 * 配置改进建议
 */
export interface ConfigSuggestion {
  type: 'performance' | 'compatibility' | 'best-practice'
  field: string
  message: string
  suggestedValue?: any
}

/**
 * 验证规则
 */
interface ValidationRule {
  field: string
  required?: boolean
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'function'
  validator?: (value: any) => boolean | string
}

/**
 * 配置 Schema 验证器
 */
export class ConfigSchemaValidator {
  private logger: Logger

  constructor(logger?: Logger) {
    this.logger = logger || new Logger({ prefix: 'SchemaValidator' })
  }

  /**
   * 验证配置
   */
  validateSchema(config: BuilderConfig): ValidationResult & { suggestions: ConfigSuggestion[] } {
    const errors: string[] = []
    const warnings: string[] = []
    const suggestions: ConfigSuggestion[] = []

    // 验证输入配置
    if (!config.input) {
      warnings.push('未指定 input，将使用默认值 src/index.ts')
    } else {
      this.validateInput(config.input, errors, warnings)
    }

    // 验证输出配置
    if (config.output) {
      this.validateOutput(config.output, errors, warnings, suggestions)
    }

    // 验证外部依赖
    if (config.external) {
      this.validateExternal(config.external, errors, warnings)
    }

    // 验证插件配置
    if (config.plugins) {
      this.validatePlugins(config.plugins, errors, warnings)
    }

    // 验证 TypeScript 配置
    if (config.typescript) {
      this.validateTypeScriptConfig(config.typescript, warnings, suggestions)
    }

    // 性能配置建议
    if (config.performance) {
      this.suggestPerformanceImprovements(config.performance, suggestions)
    }

    // 检查不推荐的配置组合
    this.checkConfigConflicts(config, warnings, suggestions)

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions
    }
  }

  /**
   * 验证输入配置
   */
  private validateInput(input: any, errors: string[], warnings: string[]): void {
    if (typeof input === 'string') {
      // 单入口字符串
      if (!input.trim()) {
        errors.push('input 不能为空字符串')
      }
    } else if (Array.isArray(input)) {
      // 多入口数组
      if (input.length === 0) {
        errors.push('input 数组不能为空')
      }
      for (const entry of input) {
        if (typeof entry !== 'string' || !entry.trim()) {
          errors.push('input 数组中存在无效的入口项')
          break
        }
      }
    } else if (typeof input === 'object' && input !== null) {
      // 对象形式的多入口
      if (Object.keys(input).length === 0) {
        errors.push('input 对象不能为空')
      }
    } else {
      errors.push('input 类型无效，应为 string | string[] | Record<string, string>')
    }
  }

  /**
   * 验证输出配置
   */
  private validateOutput(output: any, errors: string[], warnings: string[], suggestions: ConfigSuggestion[]): void {
    // 检查输出格式
    if (output.format) {
      const formats = Array.isArray(output.format) ? output.format : [output.format]
      const validFormats = ['esm', 'cjs', 'umd', 'iife', 'es', 'commonjs']

      for (const format of formats) {
        if (!validFormats.includes(format)) {
          errors.push(`无效的输出格式: ${format}`)
        }
      }

      // UMD 格式需要 name
      if (formats.includes('umd') && !output.name && !output.umd?.name) {
        warnings.push('UMD 格式需要指定 name 属性')
      }
    }

    // 检查 sourcemap 配置
    if (output.sourcemap === undefined) {
      suggestions.push({
        type: 'best-practice',
        field: 'output.sourcemap',
        message: '建议启用 sourcemap 以便调试',
        suggestedValue: true
      })
    }

    // 检查目录配置
    if (output.esm && output.cjs && output.esm.dir === output.cjs.dir) {
      errors.push('ESM 和 CJS 的输出目录不能相同')
    }
  }

  /**
   * 验证外部依赖
   */
  private validateExternal(external: any, errors: string[], warnings: string[]): void {
    if (Array.isArray(external)) {
      for (const dep of external) {
        if (typeof dep !== 'string' && !(dep instanceof RegExp) && typeof dep !== 'function') {
          errors.push('external 数组中存在无效的依赖项')
          break
        }
      }
    } else if (typeof external !== 'function' && !(external instanceof RegExp)) {
      errors.push('external 类型无效')
    }
  }

  /**
   * 验证插件配置
   */
  private validatePlugins(plugins: any[], errors: string[], warnings: string[]): void {
    if (!Array.isArray(plugins)) {
      errors.push('plugins 必须是数组')
      return
    }

    for (let i = 0; i < plugins.length; i++) {
      const plugin = plugins[i]
      if (!plugin || typeof plugin !== 'object') {
        errors.push(`插件 [${i}] 配置无效`)
      } else if (!plugin.name && !plugin.plugin) {
        warnings.push(`插件 [${i}] 缺少 name 属性`)
      }
    }
  }

  /**
   * 验证 TypeScript 配置
   */
  private validateTypeScriptConfig(tsConfig: any, warnings: string[], suggestions: ConfigSuggestion[]): void {
    // 建议启用 declaration
    if (tsConfig.declaration === false) {
      suggestions.push({
        type: 'best-practice',
        field: 'typescript.declaration',
        message: '建议启用类型声明文件生成',
        suggestedValue: true
      })
    }

    // 建议启用 skipLibCheck
    if (tsConfig.skipLibCheck === false) {
      suggestions.push({
        type: 'performance',
        field: 'typescript.skipLibCheck',
        message: '建议启用 skipLibCheck 以加快编译速度',
        suggestedValue: true
      })
    }
  }

  /**
   * 性能配置建议
   */
  private suggestPerformanceImprovements(perfConfig: any, suggestions: ConfigSuggestion[]): void {
    if (perfConfig.treeshaking === false) {
      suggestions.push({
        type: 'performance',
        field: 'performance.treeshaking',
        message: '建议启用 Tree Shaking 以减小打包体积',
        suggestedValue: true
      })
    }

    if (perfConfig.minify === false) {
      suggestions.push({
        type: 'best-practice',
        field: 'performance.minify',
        message: '生产环境建议启用代码压缩',
        suggestedValue: true
      })
    }
  }

  /**
   * 检查配置冲突
   */
  private checkConfigConflicts(config: BuilderConfig, warnings: string[], suggestions: ConfigSuggestion[]): void {
    // 检查 bundleless 和 format 冲突
    if (config.bundleless && config.output?.format) {
      const formats = Array.isArray(config.output.format) ? config.output.format : [config.output.format]
      if (formats.includes('umd') || formats.includes('iife')) {
        warnings.push('bundleless 模式与 UMD/IIFE 格式冲突')
      }
    }

    // 检查库类型和插件匹配
    if (config.libraryType === LibraryType.VUE3 || config.libraryType === LibraryType.VUE2) {
      const hasVuePlugin = config.plugins?.some(p =>
        p.name === 'vue' || p.name?.includes('vue')
      )
      if (!hasVuePlugin) {
        suggestions.push({
          type: 'best-practice',
          field: 'plugins',
          message: '检测到 Vue 项目，建议添加 Vue 插件'
        })
      }
    }

    // 检查是否同时使用多个编译器
    if (config.typescript && (config as any).babel) {
      warnings.push('同时配置了 TypeScript 和 Babel，可能产生冲突')
    }
  }

  /**
   * 类型安全的配置解析
   */
  parseAndValidate(raw: unknown): BuilderConfig {
    if (typeof raw !== 'object' || raw === null) {
      throw new Error('配置必须是对象')
    }

    const config = raw as BuilderConfig

    // 验证配置
    const result = this.validateSchema(config)

    if (!result.valid) {
      throw new Error(`配置验证失败:\n${result.errors.join('\n')}`)
    }

    // 输出警告和建议
    if (result.warnings.length > 0) {
      this.logger.warn('配置警告:')
      result.warnings.forEach(w => this.logger.warn(`  - ${w}`))
    }

    if (result.suggestions.length > 0) {
      this.logger.info('配置建议:')
      result.suggestions.forEach(s => this.logger.info(`  - ${s.message}`))
    }

    return config
  }

  /**
   * 生成配置改进建议
   */
  suggestImprovements(config: BuilderConfig): ConfigSuggestion[] {
    const suggestions: ConfigSuggestion[] = []

    // 性能相关建议
    if (!config.performance?.treeshaking) {
      suggestions.push({
        type: 'performance',
        field: 'performance.treeshaking',
        message: '启用 Tree Shaking 可以减小 30-50% 的打包体积',
        suggestedValue: true
      })
    }

    // 缓存相关建议
    if (!config.cache || (config.cache as any).enabled === false) {
      suggestions.push({
        type: 'performance',
        field: 'cache.enabled',
        message: '启用缓存可以提升 60-80% 的重复构建速度',
        suggestedValue: true
      })
    }

    // 增量构建建议
    if (!(config as any).incremental?.enabled) {
      suggestions.push({
        type: 'performance',
        field: 'incremental.enabled',
        message: '启用增量构建可以提升 70-80% 的开发构建速度',
        suggestedValue: true
      })
    }

    return suggestions
  }
}

/**
 * 创建配置验证器
 */
export function createConfigSchemaValidator(logger?: Logger): ConfigSchemaValidator {
  return new ConfigSchemaValidator(logger)
}

