/**
 * 混合框架策略适配器
 * 
 * 使 MixedFrameworkStrategy 兼容 ILibraryStrategy 接口
 */

import type { ILibraryStrategy, StrategyValidationResult } from '../../types/strategy'
import type { BuilderConfig } from '../../types/config'
import type { UnifiedConfig, UnifiedPlugin } from '../../types/adapter'
import { LibraryType } from '../../types/library'
import { MixedFrameworkStrategy, type MixedFrameworkConfig } from './MixedFrameworkStrategy'

/**
 * 混合框架策略适配器
 */
export class MixedFrameworkAdapter implements ILibraryStrategy {
  readonly name = 'mixed-framework'
  readonly supportedTypes = [LibraryType.MIXED, LibraryType.ENHANCED_MIXED]
  readonly priority = 100

  private strategy: MixedFrameworkStrategy

  constructor(config?: MixedFrameworkConfig) {
    this.strategy = new MixedFrameworkStrategy(config)
  }

  /**
   * 应用策略
   */
  async applyStrategy(config: BuilderConfig): Promise<UnifiedConfig> {
    // 从 BuilderConfig 中提取混合框架配置
    const mixedConfig = config.mixedFramework || { mode: 'unified' as const }

    // 创建新的策略实例（如果配置不同）
    if (JSON.stringify(mixedConfig) !== JSON.stringify(this.strategy['config'])) {
      this.strategy = new MixedFrameworkStrategy(mixedConfig)
    }

    // 准备基础 Rollup 配置
    const rollupOptions = {
      input: config.input || 'src/index.ts',
      output: config.output as any,
      external: config.external,
      plugins: (config.plugins || []) as any
    }

    // 应用策略
    const enhancedOptions = await this.strategy.apply(rollupOptions)

    // 转换为 UnifiedConfig
    const normalizedExternal = Array.isArray(enhancedOptions.external)
      ? enhancedOptions.external as string[]
      : typeof enhancedOptions.external === 'function'
        ? enhancedOptions.external as any
        : []

    const normalizedPlugins = Array.isArray(enhancedOptions.plugins)
      ? enhancedOptions.plugins as any[]
      : []

    const outputOptions = enhancedOptions.output || {}

    // 保留数组格式的输出配置
    let outputConfig: any
    if (Array.isArray(outputOptions)) {
      // 如果是数组格式，保留所有输出配置
      outputConfig = outputOptions
    } else {
      // 单一输出格式
      const baseOutput = outputOptions
      outputConfig = {
        dir: (baseOutput as any).dir || 'dist',
        format: (baseOutput as any).format || 'es',
        fileName: '[name].js',
        sourcemap: (baseOutput as any).sourcemap,
        chunkFileNames: '[name]-[hash].js',
        assetFileNames: '[name][extname]'
      }
    }

    return {
      input: enhancedOptions.input as string | string[] | Record<string, string>,
      output: outputConfig,
      external: normalizedExternal,
      plugins: normalizedPlugins,
      // 其他必要的配置
      resolve: {
        alias: {},
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.vue', '.json']
      },
      define: config.define || {},
      server: {
        port: 3000
      },
      build: {
        target: 'es2015',
        minify: config.minify || false,
        sourcemap: config.sourcemap || false
      }
    }
  }

  /**
   * 检测是否适用
   */
  isApplicable(config: BuilderConfig): boolean {
    // 如果指定了 enhanced-mixed 策略，或者配置了 mixedFramework
    return config.libraryType === LibraryType.MIXED ||
      config.libraryType === LibraryType.ENHANCED_MIXED ||
      !!config.mixedFramework ||
      !!config.autoDetectFramework
  }

  /**
   * 获取默认配置
   */
  getDefaultConfig(): Partial<BuilderConfig> {
    return {
      libraryType: LibraryType.MIXED,
      mixedFramework: {
        mode: 'unified',
        jsx: {
          autoDetect: true,
          defaultFramework: 'react'
        },
        advanced: {
          parallelDetection: true,
          cacheDetection: true,
          smartExternals: true,
          sharedRuntime: false
        }
      },
      autoDetectFramework: true,
      external: [],
      output: {
        dir: 'dist',
        format: 'es' as any,
        preserveModules: false
      }
    }
  }

  /**
   * 获取推荐插件
   */
  getRecommendedPlugins(_config: BuilderConfig): UnifiedPlugin[] {
    // 插件会在策略应用时动态添加
    return []
  }

  /**
   * 验证配置
   */
  validateConfig(config: BuilderConfig): StrategyValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // 验证混合框架配置
    if (config.mixedFramework) {
      const { mode, groups } = config.mixedFramework

      // 验证模式
      if (mode && !['unified', 'separated', 'component', 'custom'].includes(mode)) {
        errors.push(`无效的混合框架模式: ${mode}`)
      }

      // 如果是自定义模式，必须有分组配置
      if (mode === 'custom' && !groups) {
        errors.push('自定义模式需要配置 groups')
      }

      // 验证分组配置
      if (groups) {
        for (const [groupName, group] of Object.entries(groups)) {
          if (!group.pattern) {
            errors.push(`分组 ${groupName} 缺少 pattern 配置`)
          }
          if (group.framework && !['vue', 'react', 'auto'].includes(group.framework)) {
            errors.push(`分组 ${groupName} 的 framework 配置无效: ${group.framework}`)
          }
        }
      }
    }

    // 验证输入配置
    if (!config.input && !config.mixedFramework?.groups) {
      warnings.push('未配置输入文件，将使用默认值 src/index.ts')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions: []
    }
  }

  /**
   * 优化配置
   */
  async optimizeConfig(config: BuilderConfig): Promise<BuilderConfig> {
    // 如果启用了自动检测，添加默认的文件关联
    if (config.autoDetectFramework && !config.mixedFramework?.jsx?.fileAssociations) {
      const defaultAssociations = {
        '**/*.vue.tsx': 'vue' as const,
        '**/*.vue.ts': 'vue' as const,
        '**/*.react.tsx': 'react' as const,
        '**/*.react.ts': 'react' as const,
        '**/vue/**/*.tsx': 'vue' as const,
        '**/vue/**/*.ts': 'vue' as const,
        '**/react/**/*.tsx': 'react' as const,
        '**/react/**/*.ts': 'react' as const
      }

      config.mixedFramework = {
        mode: config.mixedFramework?.mode || 'unified',
        ...config.mixedFramework,
        jsx: {
          ...config.mixedFramework?.jsx,
          autoDetect: true,
          fileAssociations: defaultAssociations
        }
      }
    }

    return config
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.strategy.cleanup()
  }
}

/**
 * 创建混合框架策略适配器
 */
export function createMixedFrameworkAdapter(config?: MixedFrameworkConfig): MixedFrameworkAdapter {
  return new MixedFrameworkAdapter(config)
}
