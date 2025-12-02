/**
 * SolidStart 构建策略
 * 
 * 专门针对 SolidStart 框架的构建配置和优化
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import type { BuildStrategy, StrategyContext } from '../../types/strategy'
import type { BuilderConfig } from '../../types/config'
import { LibraryType } from '../../types/library'

/**
 * SolidStart 策略类
 */
export class SolidStartStrategy implements BuildStrategy {
  readonly name = 'solid-start'
  readonly priority = 85

  /**
   * 判断是否适用
   */
  async match(context: StrategyContext): Promise<boolean> {
    const { projectPath, packageJson } = context

    // 检查依赖
    if (
      packageJson?.dependencies?.['solid-start'] ||
      packageJson?.devDependencies?.['solid-start']
    ) {
      return true
    }

    // 检查配置文件
    const fs = require('fs-extra')
    const path = require('path')

    const configFiles = [
      'app.config.ts',
      'app.config.js'
    ]

    for (const file of configFiles) {
      const filePath = path.join(projectPath, file)
      const exists = await fs.pathExists(filePath)
      if (exists) {
        const content = await fs.readFile(filePath, 'utf-8')
        if (content.includes('solid-start')) {
          return true
        }
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
      libraryType: LibraryType.SOLID,

      // SolidStart 外部依赖
      external: [
        'solid-js',
        'solid-js/web',
        'solid-js/store',
        'solid-start',
        'solid-start/*',
        '@solidjs/router',
        '@solidjs/meta',
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

      // Babel 配置（Solid 需要特殊的 JSX 转换）
      babel: {
        enabled: true,
        presets: [
          ['babel-preset-solid', { generate: 'dom', hydratable: true }]
        ],
        ...config.babel
      },

      // 插件配置
      plugins: [
        ...(config.plugins || []),
        // SolidStart 特定插件
      ],

      // 排除模式
      exclude: [
        '**/routes/**',
        '**/.solid/**',
        '**/public/**',
        '**/dist/**',
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

    // 检查 Solid.js 依赖
    const { packageJson } = context
    const solidVersion = packageJson?.dependencies?.['solid-js'] || packageJson?.devDependencies?.['solid-js']

    if (!solidVersion) {
      errors.push('SolidStart 需要 solid-js 依赖')
    }

    // 检查 babel-preset-solid
    const hasSolidPreset = packageJson?.dependencies?.['babel-preset-solid'] ||
      packageJson?.devDependencies?.['babel-preset-solid']

    if (!hasSolidPreset) {
      warnings.push('建议安装 babel-preset-solid 以获得更好的 JSX 转换')
    }

    // 检查输出格式
    const format = Array.isArray(config.output?.format) ? config.output.format[0] : config.output?.format
    if (format && !['esm', 'es'].includes(format as string)) {
      warnings.push('SolidStart 推荐使用 ESM 格式')
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
      '使用 ESM 格式以兼容 SolidStart',
      '启用 babel-preset-solid 进行 JSX 转换',
      '使用 Solid 的响应式系统',
      '利用 SolidStart 的文件路由',
      '使用 createServerData$ 进行服务端数据加载',
      '考虑使用 Solid 的细粒度响应性优化性能'
    ]
  }
}


