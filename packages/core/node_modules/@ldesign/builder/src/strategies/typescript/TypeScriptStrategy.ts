/**
 * TypeScript 策略
 *
 * 为 TypeScript 库提供完整的构建策略，包括：
 * - TypeScript 编译和类型检查
 * - 声明文件生成
 * - 多格式输出支持
 * - Tree Shaking 优化
 *
 * @author LDesign Team
 * @version 1.0.0
 */

import type { ILibraryStrategy } from '../../types/strategy'
import { LibraryType } from '../../types/library'
import type { BuilderConfig } from '../../types/config'
import type { UnifiedConfig } from '../../types/adapter'
import { shouldMinify } from '../../utils/optimization/MinifyProcessor'
import { BaseStrategy } from '../base/BaseStrategy'

/**
 * TypeScript 库构建策略
 */
export class TypeScriptStrategy extends BaseStrategy implements ILibraryStrategy {
  readonly name = 'typescript'
  readonly supportedTypes: LibraryType[] = [LibraryType.TYPESCRIPT]
  readonly priority = 10

  /**
   * 应用 TypeScript 策略
   */
  override async applyStrategy(config: BuilderConfig): Promise<UnifiedConfig> {
    // 使用基类的入口解析方法
    const resolvedInput = await this.resolveInputEntriesEnhanced(config)

    return {
      input: resolvedInput,
      output: this.buildOutputConfig(config),
      plugins: this.buildPlugins(config),
      external: config.external || [],
      treeshake: config.performance?.treeshaking !== false,
      onwarn: (warning: any) => {
        // 忽略常见的无害警告
        if (warning.code === 'THIS_IS_UNDEFINED' || warning.code === 'CIRCULAR_DEPENDENCY') return
      },
      clean: config.clean,
      minify: config.performance?.minify as boolean | undefined,
      sourcemap: config.output?.sourcemap
    }
  }

  /**
   * 检查策略是否适用
   */
  override isApplicable(config: BuilderConfig): boolean {
    return config.libraryType === LibraryType.TYPESCRIPT
  }

  /**
   * 获取默认配置
   */
  getDefaultConfig(): Partial<BuilderConfig> {
    return {
      libraryType: LibraryType.TYPESCRIPT,
      output: {
        format: ['esm', 'cjs', 'umd'],
        sourcemap: true
      },
      typescript: {
        declaration: true,
        // declarationDir 将由 RollupAdapter 动态设置
        target: 'ES2020',
        module: 'ESNext',
        strict: true,
        skipLibCheck: true,
        // 也支持 compilerOptions 格式
        compilerOptions: {
          declaration: true,
          declarationMap: true
        }
      },
      performance: {
        treeshaking: true,
        minify: true
      }
    }
  }

  /**
   * 获取推荐插件
   */
  override getRecommendedPlugins(config: BuilderConfig): any[] {
    const plugins = []

    // TypeScript 插件
    plugins.push({
      name: '@rollup/plugin-typescript',
      options: this.getTypeScriptOptions(config)
    })

    // Node 解析插件（优先浏览器分支，避免引入 Node 内置依赖）
    plugins.push({
      name: '@rollup/plugin-node-resolve',
      options: {
        preferBuiltins: false,
        browser: true,
        extensions: ['.mjs', '.js', '.json', '.ts', '.tsx']
      }
    })

    // CommonJS 插件
    plugins.push({
      name: '@rollup/plugin-commonjs',
      options: {}
    })

    // JSON 插件（允许导入 JSON 文件）
    plugins.push({
      name: '@rollup/plugin-json',
      options: {}
    })

    // 样式处理（支持 css/less/scss），在 TS 库中也允许按需引入样式
    plugins.push({
      name: 'postcss',
      plugin: async () => {
        const postcss = await import('rollup-plugin-postcss')
        return postcss.default({
          extract: (config as any).style?.extract !== false,
          minimize: (config as any).style?.minimize !== false,
          sourceMap: (config as any).output?.sourcemap !== false,
          modules: (config as any).style?.modules || false,
          use: ['less'],
          extensions: ['.css', '.less', '.scss', '.sass']
        })
      }
    })

    // 代码压缩插件（生产模式）
    if (config.mode === 'production' && config.performance?.minify !== false) {
      plugins.push({
        name: '@rollup/plugin-terser',
        options: {
          compress: {
            drop_console: true,
          },
          format: {
            comments: false
          }
        }
      })
    }

    return plugins
  }

  /**
   * 验证配置
   */
  override validateConfig(config: BuilderConfig): any {
    const errors: string[] = []
    const warnings: string[] = []
    const suggestions: string[] = []

    // 检查入口文件
    if (!config.input) {
      errors.push('TypeScript 策略需要指定入口文件')
    } else if (typeof config.input === 'string') {
      if (!config.input.endsWith('.ts') && !config.input.endsWith('.tsx')) {
        warnings.push('入口文件不是 TypeScript 文件，建议使用 .ts 或 .tsx 扩展名')
      }
    }

    // 检查输出配置 - 只在没有任何输出配置时才建议
    if (!config.output?.format && !config.output?.esm && !config.output?.cjs && !config.output?.umd) {
      suggestions.push('建议指定输出格式，如 ["esm", "cjs"]')
    }

    // 检查 TypeScript 配置 - 只在明确禁用时才建议
    if (config.typescript?.declaration === false) {
      suggestions.push('建议启用类型声明文件生成 (declaration: true)')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions
    }
  }

  // 使用 BaseStrategy.buildOutputConfig 处理输出配置

  /**
   * 构建插件配置
   */
  private buildPlugins(config: BuilderConfig): any[] {
    const plugins: any[] = []

    // 不再使用 @rollup/plugin-typescript，它在某些配置下会出问题
    // 依赖 esbuild 插件来处理 TypeScript

    // Node 解析插件（优先浏览器分支）
    plugins.push({
      name: 'node-resolve',
      plugin: async () => {
        const nodeResolve = await import('@rollup/plugin-node-resolve')
        return nodeResolve.nodeResolve({
          preferBuiltins: false,
          browser: true,
          extensions: ['.mjs', '.js', '.json', '.ts', '.tsx']
        })
      }
    })

    // CommonJS 插件
    plugins.push({
      name: 'commonjs',
      plugin: async () => {
        const commonjs = await import('@rollup/plugin-commonjs')
        return commonjs.default()
      }
    })

    // JSON 插件
    plugins.push({
      name: 'json',
      plugin: async () => {
        const json = await import('@rollup/plugin-json')
        return json.default()
      }
    })

    // 样式处理（支持 css/less/scss）
    plugins.push({
      name: 'postcss',
      plugin: async () => {
        const postcss = await import('rollup-plugin-postcss')
        return postcss.default({
          extract: (config as any).style?.extract !== false,
          minimize: (config as any).style?.minimize !== false,
          sourceMap: config.output?.sourcemap !== false,
          modules: (config as any).style?.modules || false,
          use: ['less'],
          extensions: ['.css', '.less', '.scss', '.sass']
        })
      }
    })

    // 使用 esbuild 转译 TS/TSX 为 JS（保留 JSX，由后续链按需处理）
    plugins.push({
      name: 'esbuild',
      plugin: async () => {
        const esbuild = await import('rollup-plugin-esbuild')
        const options: any = {
          include: /\.(ts|tsx|js|jsx)(\?|$)/,
          exclude: [/node_modules/],
          target: 'es2020',
          jsx: 'preserve',
          loaders: { '.ts': 'ts', '.tsx': 'tsx' },
          minify: shouldMinify(config),
          sourceMap: config.output?.sourcemap !== false
        }
        return esbuild.default(options)
      }
    })

    // 代码压缩插件（生产模式）
    if (shouldMinify(config)) {
      plugins.push({
        name: 'terser',
        plugin: async () => {
          const terser = await import('@rollup/plugin-terser')
          return terser.default({
            compress: {
              drop_console: true,
            },
            format: {
              comments: false
            }
          })
        }
      })
    }

    return plugins
  }

  /**
   * 获取 TypeScript 选项（修复版）
   */
  private getTypeScriptOptions(config: BuilderConfig): any {
    const tsConfig = config.typescript || {}
    const compilerOptions = tsConfig.compilerOptions || {}

    // 检查是否需要生成类型声明
    const declarationEnabled = tsConfig.declaration === true ||
      compilerOptions.declaration === true ||
      (config as any).dts === true

    // 构建正确的选项结构（@rollup/plugin-typescript 需要特定格式）
    const options: any = {
      // tsconfig 文件路径（如果指定）
      tsconfig: tsConfig.tsconfig,

      // compilerOptions 应该是嵌套对象
      compilerOptions: {
        target: tsConfig.target || compilerOptions.target || 'ES2020',
        module: tsConfig.module || compilerOptions.module || 'ESNext',
        strict: tsConfig.strict !== false && compilerOptions.strict !== false,
        skipLibCheck: tsConfig.skipLibCheck !== false && compilerOptions.skipLibCheck !== false,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        // 使用 bundler 模块解析策略以支持 TypeScript 5.x
        moduleResolution: compilerOptions.moduleResolution || 'bundler',
        resolveJsonModule: true,
        isolatedModules: !declarationEnabled,  // 生成 DTS 时不能使用 isolatedModules
        noEmitOnError: false,
        // 强制覆盖 noEmit，确保能够生成输出
        noEmit: false,
        // 不要硬编码 allowImportingTsExtensions，让用户配置生效
        // 但如果生成声明文件，必须禁用它
        allowImportingTsExtensions: declarationEnabled ? false : (compilerOptions.allowImportingTsExtensions ?? false),
        // 抑制未使用的警告
        noUnusedLocals: false,
        noUnusedParameters: false,
        // 声明文件配置
        declaration: declarationEnabled,
        declarationMap: declarationEnabled && (tsConfig.declarationMap === true || compilerOptions.declarationMap === true)
      },

      // exclude 应该在顶层，不在 compilerOptions 中
      exclude: ['**/*.test.ts', '**/*.spec.ts', 'node_modules/**'],

      // 诊断过滤器
      filterDiagnostics: (diagnostic: any) => {
        const code = diagnostic.code
        const file = diagnostic.file?.fileName || ''

        // 过滤 .vue 文件相关的诊断
        if (file.endsWith('.vue') || file.includes('.vue') || file.includes('/vue/')) {
          return false
        }

        // 过滤特定的诊断代码
        const suppressedCodes = [
          2688,  // TS2688: Cannot find type definition file
          2307,  // TS2307: Cannot find module  
          5096,  // TS5096: Option conflicts
          6133,  // TS6133: Unused variable
          7016   // TS7016: Could not find declaration file
        ]

        if (suppressedCodes.includes(code)) {
          return false
        }

        // 保留其他诊断
        return true
      }
    }

    // 如果指定了 declarationDir，添加到 compilerOptions 中
    if (declarationEnabled && (tsConfig.declarationDir || compilerOptions.declarationDir)) {
      options.compilerOptions.declarationDir = tsConfig.declarationDir || compilerOptions.declarationDir
    }

    // 合并其他 compilerOptions
    if (compilerOptions.removeComments !== undefined) {
      options.compilerOptions.removeComments = compilerOptions.removeComments
    }

    return options
  }
}
