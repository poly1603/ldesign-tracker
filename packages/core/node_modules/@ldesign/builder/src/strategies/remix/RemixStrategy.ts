/**
 * Remix 构建策略
 * 
 * 专门针对 Remix 框架的构建配置和优化
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import type { BuildStrategy, StrategyContext } from '../../types/strategy'
import type { BuilderConfig } from '../../types/config'
import { LibraryType } from '../../types/library'

/**
 * Remix 策略类
 */
export class RemixStrategy implements BuildStrategy {
  readonly name = 'remix'
  readonly priority = 85

  /**
   * 判断是否适用
   */
  async match(context: StrategyContext): Promise<boolean> {
    const { projectPath, packageJson } = context

    // 检查依赖
    if (
      packageJson?.dependencies?.['@remix-run/react'] ||
      packageJson?.devDependencies?.['@remix-run/react'] ||
      packageJson?.dependencies?.['@remix-run/node'] ||
      packageJson?.devDependencies?.['@remix-run/node']
    ) {
      return true
    }

    // 检查 remix.config 文件
    const fs = require('fs-extra')
    const path = require('path')

    const configFiles = [
      'remix.config.js',
      'remix.config.ts'
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
      libraryType: LibraryType.REACT,

      // Remix 外部依赖
      external: [
        '@remix-run/react',
        '@remix-run/node',
        '@remix-run/server-runtime',
        '@remix-run/cloudflare',
        'react',
        'react-dom',
        'react-router-dom',
        ...(Array.isArray(config.external) ? config.external : [])
      ],

      // 输出配置 - Remix 使用 ESM
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
        // Remix 特定插件
      ],

      // 排除模式
      exclude: [
        '**/app/routes/**',
        '**/public/**',
        '**/.cache/**',
        '**/build/**',
        ...(config.exclude || [])
      ],

      // 样式处理
      style: {
        extract: true,
        minimize: true,
        modules: true,
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

    // 检查 React 版本
    const { packageJson } = context
    const reactVersion = packageJson?.dependencies?.react || packageJson?.devDependencies?.react

    if (reactVersion) {
      const majorVersion = parseInt(reactVersion.replace(/[^\d]/g, ''))
      if (majorVersion < 18) {
        warnings.push('Remix 建议使用 React 18+')
      }
    }

    // 检查输出格式
    const format = Array.isArray(config.output?.format) ? config.output.format[0] : config.output?.format
    if (format && !['esm', 'es'].includes(format as string)) {
      warnings.push('Remix 推荐使用 ESM 格式')
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
      '使用 ESM 格式以兼容 Remix',
      '启用 CSS Modules 支持',
      '使用 React 18+ 获得最佳性能',
      '考虑使用 Remix 的 resource routes',
      '利用 Remix 的嵌套路由功能',
      '使用 loader 和 action 进行数据处理'
    ]
  }
}


