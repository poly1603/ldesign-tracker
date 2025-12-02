/**
 * 配置验证工具
 * 
 * 提供完整的构建配置验证功能
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import type { BuilderConfig } from '../../types/config'
import type { LibraryType } from '../../types/library'
import { existsSync } from 'fs'
import { resolve } from 'path'

/**
 * 验证结果接口
 */
export interface ValidationResult {
  /** 是否通过验证 */
  valid: boolean
  /** 错误列表 */
  errors: ValidationError[]
  /** 警告列表 */
  warnings: ValidationWarning[]
  /** 建议列表 */
  suggestions: ValidationSuggestion[]
}

/**
 * 验证错误
 */
export interface ValidationError {
  /** 错误代码 */
  code: string
  /** 错误消息 */
  message: string
  /** 错误字段 */
  field?: string
  /** 严重程度 */
  severity: 'error'
}

/**
 * 验证警告
 */
export interface ValidationWarning {
  /** 警告代码 */
  code: string
  /** 警告消息 */
  message: string
  /** 警告字段 */
  field?: string
  /** 严重程度 */
  severity: 'warning'
}

/**
 * 验证建议
 */
export interface ValidationSuggestion {
  /** 建议代码 */
  code: string
  /** 建议消息 */
  message: string
  /** 建议字段 */
  field?: string
  /** 严重程度 */
  severity: 'info'
}

/**
 * 配置验证器类
 */
export class ConfigValidator {
  private errors: ValidationError[] = []
  private warnings: ValidationWarning[] = []
  private suggestions: ValidationSuggestion[] = []

  /**
   * 验证构建配置
   * 
   * @param config 构建配置
   * @returns 验证结果
   */
  validate(config: BuilderConfig): ValidationResult {
    // 重置状态
    this.reset()

    // 执行各项验证
    this.validateInput(config)
    this.validateOutput(config)
    this.validateLibraryType(config)
    this.validateExternal(config)
    this.validateTypeScript(config)
    this.validateVue(config)
    this.validateStyle(config)
    this.validatePerformance(config)

    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      suggestions: this.suggestions
    }
  }

  /**
   * 重置验证状态
   */
  private reset(): void {
    this.errors = []
    this.warnings = []
    this.suggestions = []
  }

  /**
   * 验证入口配置
   */
  private validateInput(config: BuilderConfig): void {
    if (!config.input) {
      this.addSuggestion(
        'INPUT_AUTO_DETECT',
        '未指定入口文件，将自动检测',
        'input'
      )
      return
    }

    // 验证入口文件是否存在
    if (typeof config.input === 'string') {
      const inputPath = resolve(process.cwd(), config.input)
      if (!existsSync(inputPath)) {
        this.addWarning(
          'INPUT_NOT_FOUND',
          `入口文件不存在: ${config.input}`,
          'input'
        )
      }
    } else if (Array.isArray(config.input)) {
      for (const input of config.input) {
        const inputPath = resolve(process.cwd(), input)
        if (!existsSync(inputPath)) {
          this.addWarning(
            'INPUT_NOT_FOUND',
            `入口文件不存在: ${input}`,
            'input'
          )
        }
      }
    }
  }

  /**
   * 验证输出配置
   */
  private validateOutput(config: BuilderConfig): void {
    if (!config.output) {
      this.addSuggestion(
        'OUTPUT_DEFAULT',
        '未指定输出配置，将使用默认值',
        'output'
      )
      return
    }

    const output = config.output

    // 验证输出格式
    if (output.format) {
      const formats = Array.isArray(output.format) ? output.format : [output.format]
      const validFormats = ['esm', 'cjs', 'umd', 'iife', 'es']

      for (const format of formats) {
        if (!validFormats.includes(format)) {
          this.addError(
            'INVALID_OUTPUT_FORMAT',
            `不支持的输出格式: ${format}`,
            'output.format'
          )
        }
      }
    }

    // 验证 UMD 构建必需的配置
    if (output.format === 'umd' || (Array.isArray(output.format) && output.format.includes('umd'))) {
      if (!config.umd?.name && !output.name) {
        this.addError(
          'UMD_NAME_REQUIRED',
          'UMD 格式需要指定 name 或 umd.name',
          'umd.name'
        )
      }
    }
  }

  /**
   * 验证库类型配置
   */
  private validateLibraryType(config: BuilderConfig): void {
    if (!config.libraryType) {
      this.addSuggestion(
        'LIBRARY_TYPE_AUTO_DETECT',
        '未指定库类型，将自动检测',
        'libraryType'
      )
      return
    }

    const validTypes: LibraryType[] = [
      'typescript' as LibraryType,
      'vue2' as LibraryType,
      'vue3' as LibraryType,
      'react' as LibraryType,
      'style' as LibraryType,
      'svelte' as LibraryType,
      'solid' as LibraryType,
      'preact' as LibraryType,
      'lit' as LibraryType,
      'angular' as LibraryType,
      'qwik' as LibraryType,
      'mixed' as LibraryType,
      'enhanced-mixed' as LibraryType
    ]

    if (!validTypes.includes(config.libraryType)) {
      this.addError(
        'INVALID_LIBRARY_TYPE',
        `不支持的库类型: ${config.libraryType}`,
        'libraryType'
      )
    }
  }

  /**
   * 验证外部依赖配置
   */
  private validateExternal(config: BuilderConfig): void {
    if (!config.external) {
      this.addSuggestion(
        'EXTERNAL_RECOMMEND',
        '建议配置外部依赖以减少包体积',
        'external'
      )
      return
    }

    // 根据库类型推荐外部依赖
    const recommendations: Record<string, string[]> = {
      vue2: ['vue'],
      vue3: ['vue', '@vue/runtime-core', '@vue/runtime-dom'],
      react: ['react', 'react-dom'],
      svelte: ['svelte'],
      solid: ['solid-js']
    }

    if (config.libraryType && recommendations[config.libraryType]) {
      const recommended = recommendations[config.libraryType]
      const external = Array.isArray(config.external) ? config.external : []

      for (const dep of recommended) {
        if (!external.includes(dep)) {
          this.addSuggestion(
            'EXTERNAL_MISSING',
            `建议将 ${dep} 添加到外部依赖`,
            'external'
          )
        }
      }
    }
  }

  /**
   * 验证 TypeScript 配置
   */
  private validateTypeScript(config: BuilderConfig): void {
    if (!config.typescript) return

    const ts = config.typescript

    // 验证类型声明配置
    if (ts.declaration === false && config.dts === true) {
      this.addWarning(
        'DTS_CONFLICT',
        'dts 设置为 true 但 typescript.declaration 为 false',
        'typescript.declaration'
      )
    }

    // 验证 tsconfig.json
    if (ts.tsconfig) {
      const tsconfigPath = resolve(process.cwd(), ts.tsconfig)
      if (!existsSync(tsconfigPath)) {
        this.addError(
          'TSCONFIG_NOT_FOUND',
          `tsconfig.json 文件不存在: ${ts.tsconfig}`,
          'typescript.tsconfig'
        )
      }
    }
  }

  /**
   * 验证 Vue 配置
   */
  private validateVue(config: BuilderConfig): void {
    if (!config.vue) return

    const vue = config.vue

    // 验证 Vue 版本
    if (vue.version && ![2, 3].includes(vue.version)) {
      this.addError(
        'INVALID_VUE_VERSION',
        `不支持的 Vue 版本: ${vue.version}`,
        'vue.version'
      )
    }

    // 验证库类型与 Vue 版本匹配
    if (config.libraryType === 'vue2' as LibraryType && vue.version === 3) {
      this.addWarning(
        'VUE_VERSION_MISMATCH',
        '库类型为 vue2 但 Vue 版本配置为 3',
        'vue.version'
      )
    }

    if (config.libraryType === 'vue3' as LibraryType && vue.version === 2) {
      this.addWarning(
        'VUE_VERSION_MISMATCH',
        '库类型为 vue3 但 Vue 版本配置为 2',
        'vue.version'
      )
    }
  }

  /**
   * 验证样式配置
   */
  private validateStyle(config: BuilderConfig): void {
    if (!config.style) return

    const style = config.style

    // 验证 autoprefixer 和 browserslist
    if (style.autoprefixer && !style.browserslist) {
      this.addSuggestion(
        'BROWSERSLIST_RECOMMEND',
        '启用了 autoprefixer 建议配置 browserslist',
        'style.browserslist'
      )
    }
  }

  /**
   * 验证性能配置
   */
  private validatePerformance(config: BuilderConfig): void {
    if (!config.performance) return

    const perf = config.performance

    // 生产模式建议启用优化
    if (config.mode === 'production') {
      if (perf.minify === false) {
        this.addSuggestion(
          'MINIFY_RECOMMEND',
          '生产模式建议启用代码压缩',
          'performance.minify'
        )
      }

      if (perf.treeshaking === false) {
        this.addSuggestion(
          'TREESHAKING_RECOMMEND',
          '生产模式建议启用 tree shaking',
          'performance.treeshaking'
        )
      }
    }
  }

  /**
   * 添加错误
   */
  private addError(code: string, message: string, field?: string): void {
    this.errors.push({ code, message, field, severity: 'error' })
  }

  /**
   * 添加警告
   */
  private addWarning(code: string, message: string, field?: string): void {
    this.warnings.push({ code, message, field, severity: 'warning' })
  }

  /**
   * 添加建议
   */
  private addSuggestion(code: string, message: string, field?: string): void {
    this.suggestions.push({ code, message, field, severity: 'info' })
  }
}

/**
 * 创建配置验证器
 */
export function createConfigValidator(): ConfigValidator {
  return new ConfigValidator()
}

/**
 * 快速验证配置
 * 
 * @param config 构建配置
 * @returns 验证结果
 */
export function validateConfig(config: BuilderConfig): ValidationResult {
  const validator = createConfigValidator()
  return validator.validate(config)
}
