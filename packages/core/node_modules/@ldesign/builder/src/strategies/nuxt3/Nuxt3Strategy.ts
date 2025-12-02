/**
 * Nuxt 3 构建策略
 * 
 * 专门针对 Nuxt 3 框架的构建配置和优化
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import type { BuildStrategy, StrategyContext } from '../../types/strategy'
import type { BuilderConfig } from '../../types/config'
import { LibraryType } from '../../types/library'

/**
 * Nuxt 3 策略类
 */
export class Nuxt3Strategy implements BuildStrategy {
  readonly name = 'nuxt3'
  readonly priority = 85

  /**
   * 判断是否适用
   */
  async match(context: StrategyContext): Promise<boolean> {
    const { projectPath, packageJson } = context

    // 检查依赖
    if (packageJson?.dependencies?.nuxt || packageJson?.devDependencies?.nuxt) {
      const nuxtVersion = packageJson.dependencies?.nuxt || packageJson.devDependencies?.nuxt
      // Nuxt 3 的版本号是 3.x
      if (nuxtVersion.startsWith('^3') || nuxtVersion.startsWith('3')) {
        return true
      }
    }

    // 检查 nuxt.config 文件
    const fs = require('fs-extra')
    const path = require('path')

    const configFiles = [
      'nuxt.config.ts',
      'nuxt.config.js',
      'nuxt.config.mjs'
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
      libraryType: LibraryType.VUE3,

      // Nuxt 3 基于 Vue 3
      external: [
        'nuxt',
        'nuxt/*',
        'nuxt/app',
        'nuxt/kit',
        '#app',
        '#imports',
        'vue',
        'vue-router',
        '@nuxt/schema',
        '@nuxt/kit',
        ...(Array.isArray(config.external) ? config.external : [])
      ],

      // 输出配置 - Nuxt 模块通常使用 ESM
      output: {
        esm: {
          dir: 'dist',
          format: 'esm',
          preserveStructure: true,
          dts: true
        },
        ...config.output
      },

      // Vue 配置
      vue: {
        version: 3,
        jsx: {
          enabled: true
        },
        template: {
          precompile: true
        },
        ...config.vue
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
        // Nuxt 特定插件
      ],

      // 排除模式
      exclude: [
        '**/pages/**',
        '**/layouts/**',
        '**/middleware/**',
        '**/plugins/**',
        '**/server/**',
        '**/.nuxt/**',
        '**/.output/**',
        '**/public/**',
        ...(config.exclude || [])
      ],

      // 样式处理
      style: {
        extract: true,
        minimize: true,
        autoprefixer: true,
        ...config.style
      }
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

    // 检查 Nuxt 版本
    const { packageJson } = context
    const nuxtVersion = packageJson?.dependencies?.nuxt || packageJson?.devDependencies?.nuxt

    if (nuxtVersion) {
      if (!nuxtVersion.startsWith('^3') && !nuxtVersion.startsWith('3')) {
        errors.push('当前策略仅支持 Nuxt 3，检测到其他版本')
      }
    }

    // 检查 Vue 版本
    const vueVersion = packageJson?.dependencies?.vue || packageJson?.devDependencies?.vue
    if (vueVersion && !vueVersion.startsWith('^3') && !vueVersion.startsWith('3')) {
      errors.push('Nuxt 3 需要 Vue 3')
    }

    // 检查输出格式
    const format = Array.isArray(config.output?.format) ? config.output.format[0] : config.output?.format
    if (format && !['esm', 'es'].includes(format as string)) {
      warnings.push('Nuxt 3 模块建议使用 ESM 格式')
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
      '使用 ESM 格式以兼容 Nuxt 3',
      '启用 TypeScript 类型声明',
      '使用 Nuxt Kit 提供的工具函数',
      '遵循 Nuxt 模块规范',
      '使用 auto-import 减少手动导入',
      '利用 Nuxt 的组件自动导入功能'
    ]
  }
}


