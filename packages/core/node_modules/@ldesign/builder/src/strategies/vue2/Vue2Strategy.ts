/**
 * Vue 2 组件库构建策略
 *
 * 为 Vue 2 组件库提供完整的构建策略，包括：
 * - Vue SFC 单文件组件编译
 * - TypeScript 支持
 * - JSX/TSX 支持
 * - 样式提取和处理
 * - 组件类型定义生成
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
 * Vue 2 组件库构建策略
 */
export class Vue2Strategy implements ILibraryStrategy {
  readonly name = 'vue2'
  readonly supportedTypes: LibraryType[] = [LibraryType.VUE2]
  readonly priority = 10

  /**
   * 应用 Vue 2 策略
   */
  async applyStrategy(config: BuilderConfig): Promise<UnifiedConfig> {
    // 解析入口配置
    const resolvedInput = await this.resolveInputEntries(config)

    const unifiedConfig: UnifiedConfig = {
      input: resolvedInput,
      output: this.buildOutputConfig(config),
      plugins: await this.buildPlugins(config),
      external: this.buildExternals(config),
      treeshake: config.performance?.treeshaking !== false,
      onwarn: this.createWarningHandler()
    }

    return unifiedConfig
  }

  /**
   * 检查策略是否适用
   */
  isApplicable(config: BuilderConfig): boolean {
    return config.libraryType === LibraryType.VUE2
  }

  /**
   * 获取默认配置
   */
  getDefaultConfig(): Partial<BuilderConfig> {
    return {
      libraryType: LibraryType.VUE2,
      output: {
        format: ['esm', 'cjs'],
        sourcemap: true
      },
      vue: {
        version: 2,
        jsx: {
          enabled: true
        },
        template: {
          precompile: true
        }
      },
      typescript: {
        declaration: true,
        declarationDir: 'dist',
        target: 'ES2015', // Vue 2 支持较低版本
        module: 'ESNext',
        strict: true
      },
      style: {
        extract: true,
        minimize: true,
        autoprefixer: true
      },
      performance: {
        treeshaking: true,
        minify: true
      },
      external: ['vue']
    }
  }

  /**
   * 获取推荐插件
   */
  getRecommendedPlugins(config: BuilderConfig): any[] {
    const plugins = []

    // Vue 2 SFC 插件
    plugins.push({
      name: '@vitejs/plugin-vue2',
      options: {
        include: /\.vue$/
      }
    })

    // Vue 2 JSX 插件
    if (config.vue?.jsx?.enabled !== false) {
      plugins.push({
        name: '@vitejs/plugin-vue2-jsx',
        options: {}
      })
    }

    // Node 解析插件
    plugins.push({
      name: '@rollup/plugin-node-resolve',
      options: {
        preferBuiltins: false,
        browser: true,
        extensions: ['.mjs', '.js', '.json', '.ts', '.tsx', '.vue']
      }
    })

    // CommonJS 插件
    plugins.push({
      name: '@rollup/plugin-commonjs',
      options: {}
    })

    // 样式处理插件
    if (config.style?.extract !== false) {
      plugins.push({
        name: 'rollup-plugin-postcss',
        options: this.getPostCSSOptions(config)
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
      errors.push('Vue 2 策略需要指定入口文件')
    }

    // 检查 Vue 版本
    if (config.vue?.version && config.vue.version !== 2) {
      warnings.push('当前策略针对 Vue 2 优化，建议使用 Vue 2')
    }

    // 检查外部依赖
    const hasVueExternal = Array.isArray(config.external)
      && config.external.some(e => e === 'vue' || (e instanceof RegExp && e.test('vue')))
    if (Array.isArray(config.external) && !hasVueExternal) {
      suggestions.push('建议将 Vue 添加到外部依赖中以减少包体积')
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
    const outputConfig = config.output || {}

    // 如果使用格式特定配置
    if (outputConfig.es || outputConfig.esm || outputConfig.cjs || outputConfig.umd) {
      const result = { ...outputConfig }

      // 为每个输出格式添加全局变量配置
      const addGlobals = (output: any) => ({
        ...output,
        assetFileNames: '[name].[ext]',
        globals: {
          vue: 'Vue',
          ...output.globals
        }
      })

      if (result.es && typeof result.es === 'object') result.es = addGlobals(result.es)
      if (result.esm && typeof result.esm === 'object') result.esm = addGlobals(result.esm)
      if (result.cjs && typeof result.cjs === 'object') result.cjs = addGlobals(result.cjs)
      if (result.umd && typeof result.umd === 'object') result.umd = addGlobals(result.umd)

      result.globals = {
        vue: 'Vue',
        ...result.globals
      }

      return result
    }

    // 使用传统的 format 数组配置
    const formats = Array.isArray(outputConfig.format)
      ? outputConfig.format
      : [outputConfig.format || 'esm']

    return {
      dir: outputConfig.dir || 'dist',
      format: formats,
      sourcemap: outputConfig.sourcemap !== false,
      exports: 'named',
      globals: {
        vue: 'Vue',
        ...outputConfig.globals
      }
    }
  }

  /**
   * 构建插件配置
   */
  private async buildPlugins(config: BuilderConfig): Promise<any[]> {
    const plugins: any[] = []

    try {
      // Vue 2 JSX 支持（必须在 Vue SFC 插件之前）
      if (config.vue?.jsx?.enabled !== false) {
        try {
          const { default: VueJsx } = await import('@vitejs/plugin-vue2-jsx')
          plugins.push(VueJsx())
        } catch (e) {
          console.warn('@vitejs/plugin-vue2-jsx 未安装，跳过 JSX/TSX 支持')
        }
      }

      // Vue 2 SFC 插件
      try {
        const { default: Vue2Plugin } = await import('@vitejs/plugin-vue2')
        plugins.push(Vue2Plugin({
          include: /\.vue$/,
        }))
      } catch (error) {
        console.error('Vue 2 插件加载失败:', error)
        throw new Error('请安装 @vitejs/plugin-vue2: npm install @vitejs/plugin-vue2 --save-dev')
      }

      // Node 解析插件
      const nodeResolve = await import('@rollup/plugin-node-resolve')
      plugins.push(nodeResolve.default({
        preferBuiltins: false,
        browser: true,
        extensions: ['.mjs', '.js', '.json', '.ts', '.tsx', '.vue']
      }))

      // CommonJS 插件
      const commonjs = await import('@rollup/plugin-commonjs')
      plugins.push(commonjs.default())

      // esbuild 插件处理 TypeScript（保留 JSX）
      const { default: esbuild } = await import('rollup-plugin-esbuild')
      plugins.push(esbuild({
        include: /\.(ts|tsx|js|jsx)$/,
        exclude: [/node_modules/],
        target: 'es2015', // Vue 2 通常支持较低版本
        jsx: 'preserve', // 保留 JSX，由 Vue JSX 插件处理
        tsconfig: 'tsconfig.json',
        minify: shouldMinify(config),
        sourceMap: config.output?.sourcemap !== false
      }))

      // JSON 插件
      const json = await import('@rollup/plugin-json')
      plugins.push(json.default())

      // 样式处理插件
      try {
        const Styles = await import('rollup-plugin-styles')
        plugins.push(Styles.default({
          mode: 'extract',
          modules: false,
          minimize: shouldMinify(config),
          namedExports: true,
          include: ['**/*.less', '**/*.css', '**/*.scss', '**/*.sass'],
          url: {
            inline: false,
          }
        }))
      } catch (e) {
        // 回退到 postcss
        const postcss = await import('rollup-plugin-postcss')
        plugins.push(postcss.default({
          extract: true,
          minimize: shouldMinify(config),
          sourceMap: config.output?.sourcemap !== false
        }))
      }
    } catch (error) {
      console.error('插件加载失败:', error)
    }

    return plugins
  }

  /**
   * 构建外部依赖配置
   */
  private buildExternals(config: BuilderConfig): string[] | ((id: string) => boolean) {
    let externals: string[] = []

    if (Array.isArray(config.external)) {
      // 过滤出字符串类型的外部依赖，使用类型断言确保返回 string[]
      externals = (config.external as (string | RegExp)[])
        .filter((e): e is string => typeof e === 'string') as string[]
    } else if (typeof config.external === 'function') {
      return config.external
    } else {
      externals = []
    }

    // 确保 Vue 是外部依赖
    if (!externals.includes('vue')) {
      externals.push('vue')
    }

    // 添加 node_modules 排除规则
    return (id: string) => {
      // 排除 node_modules 中的所有模块
      if (id.includes('node_modules')) {
        return true
      }

      // 检查是否在外部依赖列表中
      return externals.some(ext => {
        return id === ext || id.startsWith(ext + '/')
      })
    }
  }

  /**
   * 获取 PostCSS 选项
   */
  private getPostCSSOptions(config: BuilderConfig): any {
    return {
      extract: config.style?.extract !== false,
      minimize: config.style?.minimize !== false,
      sourceMap: config.output?.sourcemap !== false,
      modules: config.style?.modules || false,
      use: ['less'],
      extensions: ['.css', '.less', '.scss', '.sass']
    }
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

      console.warn(`Warning: ${warning.message}`)
    }
  }

  /**
   * 解析入口配置
   */
  private async resolveInputEntries(config: BuilderConfig): Promise<string | string[] | Record<string, string>> {
    // 如果没有提供input，自动扫描src目录
    if (!config.input) {
      return this.autoDiscoverEntries(config)
    }

    // 如果是字符串数组且包含glob模式，解析为多入口
    if (Array.isArray(config.input)) {
      return this.resolveGlobEntries(config.input, config)
    }

    // 其他情况直接返回用户配置
    return config.input
  }

  /**
   * 自动发现入口文件
   */
  private async autoDiscoverEntries(config?: BuilderConfig): Promise<string | Record<string, string>> {
    const { findFiles } = await import('../../utils/file-system')
    const { relative, extname } = await import('path')

    const defaultIgnore = [
      '**/*.d.ts',
      '**/*.test.*',
      '**/*.spec.*',
      '**/__tests__/**',
      '**/examples/**',
      '**/example/**',
      '**/demo/**',
      '**/demos/**',
      '**/docs/**',
      '**/dev/**',
      '**/.vitepress/**',
      '**/scripts/**',
      '**/e2e/**',
      '**/benchmark/**'
    ]

    const ignorePatterns = [
      ...defaultIgnore,
      ...(config?.exclude || [])
    ]

    const files = await findFiles([
      'src/**/*.{ts,tsx,js,jsx,vue,json}'
    ], {
      cwd: process.cwd(),
      ignore: ignorePatterns
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
  private async resolveGlobEntries(patterns: string[], config?: BuilderConfig): Promise<Record<string, string>> {
    const { findFiles } = await import('../../utils/file-system')
    const { relative, extname } = await import('path')

    const defaultIgnore = [
      '**/*.d.ts',
      '**/*.test.*',
      '**/*.spec.*',
      '**/__tests__/**'
    ]

    const ignorePatterns = [
      ...defaultIgnore,
      ...(config?.exclude || [])
    ]

    const files = await findFiles(patterns, {
      cwd: process.cwd(),
      ignore: ignorePatterns
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
}
