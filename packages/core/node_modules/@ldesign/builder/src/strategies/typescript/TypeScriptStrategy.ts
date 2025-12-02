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

/**
 * TypeScript 库构建策略
 */
export class TypeScriptStrategy implements ILibraryStrategy {
  readonly name = 'typescript'
  readonly supportedTypes: LibraryType[] = [LibraryType.TYPESCRIPT]
  readonly priority = 10

  /**
   * 应用 TypeScript 策略
   */
  async applyStrategy(config: BuilderConfig): Promise<UnifiedConfig> {
    const outputConfig = this.buildOutputConfig(config)

    // 计算入口：若用户未指定，则默认将 src 目录下的所有源码文件作为多入口
    const resolvedInput = await this.resolveInputEntries(config)

    // 创建基础配置，保留重要的原始配置属性
    const unifiedConfig: UnifiedConfig = {
      input: resolvedInput,
      output: outputConfig,
      plugins: this.buildPlugins(config),
      external: config.external || [],
      treeshake: config.performance?.treeshaking !== false,
      onwarn: this.createWarningHandler(),
      // 保留重要的构建选项
      clean: (config as any).clean,
      minify: config.performance?.minify,
      sourcemap: config.output?.sourcemap,
      // 保留其他可能的配置属性
      ...(config as any)
    }

    // 覆盖特定的属性以确保正确性
    unifiedConfig.input = resolvedInput
    unifiedConfig.output = outputConfig
    unifiedConfig.plugins = this.buildPlugins(config)
    unifiedConfig.external = config.external || []
    unifiedConfig.treeshake = config.performance?.treeshaking !== false
    unifiedConfig.onwarn = this.createWarningHandler()

    return unifiedConfig
  }

  /**
   * 检查策略是否适用
   */
  isApplicable(config: BuilderConfig): boolean {
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
   * 解析入口配置
   * - 若用户未传入 input，则将 src 下所有源文件作为入口（排除测试与声明文件）
   * - 若用户传入 glob 模式的数组，则解析为多入口
   * - 若用户传入单个文件或对象，则直接返回
   */
  private async resolveInputEntries(config: BuilderConfig): Promise<string | string[] | Record<string, string>> {
    // 如果没有提供input，自动扫描src目录
    if (!config.input) {
      return this.autoDiscoverEntries()
    }

    // 如果是字符串数组且包含glob模式，解析为多入口
    if (Array.isArray(config.input)) {
      return this.resolveGlobEntries(config.input)
    }

    // 其他情况直接返回用户配置
    return config.input
  }

  /**
   * 自动发现入口文件
   */
  private async autoDiscoverEntries(): Promise<string | Record<string, string>> {
    const { findFiles } = await import('../../utils/file-system')
    const { relative, extname } = await import('path')

    const files = await findFiles([
      'src/**/*.{ts,tsx,js,jsx}'
    ], {
      cwd: process.cwd(),
      ignore: ['**/*.d.ts', '**/*.test.*', '**/*.spec.*', '**/__tests__/**']
    })

    if (files.length === 0) return 'src/index.ts'

    const entryMap: Record<string, string> = {}
    for (const abs of files) {
      const rel = relative(process.cwd(), abs)
      const relFromSrc = rel.replace(/^src[\\/]/, '')
      const noExt = relFromSrc.slice(0, relFromSrc.length - extname(relFromSrc).length)
      const key = noExt.replace(/\\/g, '/')
      entryMap[key] = abs
    }
    return entryMap
  }

  /**
   * 解析glob模式的入口配置
   */
  private async resolveGlobEntries(patterns: string[]): Promise<Record<string, string>> {
    const { findFiles } = await import('../../utils/file-system')
    const { relative, extname } = await import('path')

    const files = await findFiles(patterns, {
      cwd: process.cwd(),
      ignore: ['**/*.d.ts', '**/*.test.*', '**/*.spec.*', '**/__tests__/**']
    })

    if (files.length === 0) {
      throw new Error(`No files found matching patterns: ${patterns.join(', ')}`)
    }

    const entryMap: Record<string, string> = {}
    for (const abs of files) {
      const rel = relative(process.cwd(), abs)
      const relFromSrc = rel.replace(/^src[\\/]/, '')
      const noExt = relFromSrc.slice(0, relFromSrc.length - extname(relFromSrc).length)
      const key = noExt.replace(/\\/g, '/')
      entryMap[key] = abs
    }
    return entryMap
  }















  /**
   * 获取推荐插件
   */
  getRecommendedPlugins(config: BuilderConfig): any[] {
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
  validateConfig(config: BuilderConfig): any {
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

  /**
   * 构建输出配置
   */
  private buildOutputConfig(config: BuilderConfig): any {
    const oc: any = config.output || {}

    // 若显式使用了 esm/cjs/umd 字段（boolean 或对象），优先走格式化分支
    const hasPerFormat = typeof oc.esm !== 'undefined' || typeof oc.cjs !== 'undefined' || typeof oc.umd !== 'undefined'

    const result: any = {}

    // 继承顶层 sourcemap（可被子格式覆盖）
    if (typeof oc.sourcemap !== 'undefined') {
      result.sourcemap = oc.sourcemap
    } else if (typeof (config as any).sourcemap !== 'undefined') {
      result.sourcemap = (config as any).sourcemap
    }

    // 继承公共 name/globals（供 UMD 使用）
    if (oc.name) result.name = oc.name
    if (oc.globals) result.globals = oc.globals

    if (hasPerFormat) {
      if (typeof oc.esm !== 'undefined') result.esm = oc.esm
      if (typeof oc.cjs !== 'undefined') result.cjs = oc.cjs
      if (typeof oc.umd !== 'undefined') result.umd = oc.umd
    } else {
      // 回退到 format 数组（向后兼容）
      const formats = Array.isArray(oc.format) ? oc.format : ['esm', 'cjs']
      result.format = formats
    }

    return result
  }

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



  /**
   * 创建警告处理器
   */
  private createWarningHandler() {
    return (warning: any) => {
      // 忽略一些常见的无害警告
      if (warning.code === 'THIS_IS_UNDEFINED') {
        return
      }
      if (warning.code === 'CIRCULAR_DEPENDENCY') {
        return
      }

      // 静默处理，不输出警告
      // 如需调试，可通过 logger.warn 输出
    }
  }
}
