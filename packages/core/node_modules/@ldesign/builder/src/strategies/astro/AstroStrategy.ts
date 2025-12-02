/**
 * Astro 构建策略
 * 
 * 专门针对 Astro 框架的构建配置和优化
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import type { BuildStrategy, StrategyContext } from '../../types/strategy'
import type { BuilderConfig } from '../../types/config'
import { LibraryType } from '../../types/library'

/**
 * Astro 策略类
 */
export class AstroStrategy implements BuildStrategy {
  readonly name = 'astro'
  readonly priority = 80

  /**
   * 判断是否适用
   */
  async match(context: StrategyContext): Promise<boolean> {
    const { projectPath, packageJson } = context

    // 检查依赖
    if (packageJson?.dependencies?.astro || packageJson?.devDependencies?.astro) {
      return true
    }

    // 检查 astro.config 文件
    const fs = require('fs-extra')
    const path = require('path')

    const configFiles = [
      'astro.config.mjs',
      'astro.config.js',
      'astro.config.ts'
    ]

    for (const file of configFiles) {
      const exists = await fs.pathExists(path.join(projectPath, file))
      if (exists) {
        return true
      }
    }

    return false
  }

  /**
   * 应用策略
   */
  async applyStrategy(config: BuilderConfig, context: StrategyContext): Promise<BuilderConfig> {
    return {
      ...config,
      libraryType: LibraryType.MIXED,

      // Astro 组件可以混合多种技术
      external: [
        'astro',
        'astro:*',
        ...(Array.isArray(config.external) ? config.external : [])
      ],

      // 输出配置
      output: {
        esm: {
          dir: 'dist',
          format: 'esm',
          preserveStructure: true,
          dts: true
        },
        ...config.output
      },

      // TypeScript 配置
      typescript: {
        declaration: true,
        target: 'ES2020',
        module: 'ESNext',
        ...config.typescript
      },

      // 插件配置
      plugins: [
        ...(config.plugins || []),
        // Astro 特定插件将在这里添加
      ],

      // 排除模式
      exclude: [
        '**/pages/**',
        '**/layouts/**',
        '**/.astro/**',
        '**/public/**',
        ...(config.exclude || [])
      ]
    }
  }

  /**
   * 验证配置
   */
  async validate(config: BuilderConfig, context: StrategyContext): Promise<{
    valid: boolean
    errors: string[]
    warnings: string[]
  }> {
    const errors: string[] = []
    const warnings: string[] = []

    // 检查 Astro 版本
    const { packageJson } = context
    const astroVersion = packageJson?.dependencies?.astro || packageJson?.devDependencies?.astro

    if (astroVersion) {
      const majorVersion = parseInt(astroVersion.replace(/[^\d]/g, ''))
      if (majorVersion < 3) {
        warnings.push(`检测到 Astro ${astroVersion}，建议升级到 v3+ 获得更好的性能`)
      }
    }

    // 检查输出格式
    if (config.output?.format && !['esm', 'es'].includes(config.output.format as string)) {
      errors.push('Astro 组件库必须使用 ESM 格式')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * 获取推荐配置
   */
  getRecommendations(context: StrategyContext): string[] {
    return [
      '使用 ESM 格式以获得最佳兼容性',
      '启用 TypeScript 类型声明',
      '考虑使用 Astro 的内置优化功能',
      '使用 Astro 的内容集合功能管理数据'
    ]
  }
}


