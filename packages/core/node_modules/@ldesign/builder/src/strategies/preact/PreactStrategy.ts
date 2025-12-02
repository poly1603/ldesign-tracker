/**
 * Preact 策略
 * 使用 rollup-plugin-esbuild 处理 TS/JSX（jsxImportSource: preact），postcss 可选
 */

import type { ILibraryStrategy } from '../../types/strategy'
import { LibraryType } from '../../types/library'
import type { BuilderConfig } from '../../types/config'
import type { UnifiedConfig } from '../../types/adapter'
import { shouldMinify } from '../../utils/optimization/MinifyProcessor'

export class PreactStrategy implements ILibraryStrategy {
  readonly name = 'preact'
  readonly supportedTypes = [LibraryType.PREACT]
  readonly priority = 9

  async applyStrategy(config: BuilderConfig): Promise<UnifiedConfig> {
    const input = config.input || 'src/index.tsx'

    return {
      input,
      output: this.buildOutputConfig(config),
      plugins: await this.buildPlugins(config),
      external: this.mergeExternal(config.external),
      treeshake: config.performance?.treeshaking !== false,
      onwarn: this.createWarningHandler()
    }
  }

  isApplicable(config: BuilderConfig): boolean {
    return config.libraryType === LibraryType.PREACT
  }

  getDefaultConfig(): Partial<BuilderConfig> {
    return {
      libraryType: LibraryType.PREACT,
      output: { format: ['esm', 'cjs'], sourcemap: true },
      performance: { treeshaking: true, minify: true }
    }
  }

  getRecommendedPlugins(_config: BuilderConfig): any[] { return [] }
  validateConfig(_config: BuilderConfig): any { return { valid: true, errors: [], warnings: [], suggestions: [] } }

  private async buildPlugins(config: BuilderConfig): Promise<any[]> {
    const plugins: any[] = []

    // Node resolve（优化 Preact 的别名解析）
    const nodeResolve = await import('@rollup/plugin-node-resolve')
    plugins.push(nodeResolve.default({
      browser: true,
      extensions: ['.mjs', '.js', '.json', '.ts', '.tsx', '.jsx'],
      // 该策略通过 resolveId 钩子处理 React 到 Preact 的别名
      dedupe: ['preact', 'preact/hooks']
    }))

    // CommonJS
    const commonjs = await import('@rollup/plugin-commonjs')
    plugins.push(commonjs.default({
      include: /node_modules/
    }))

    // Preact 优化插件
    plugins.push(this.createPreactOptimizationPlugin())

    // esbuild for TS/JSX with Preact automatic JSX
    const esbuild = await import('rollup-plugin-esbuild')
    plugins.push(esbuild.default({
      include: /\.(tsx?|jsx?)$/,
      exclude: [/node_modules/],
      target: 'es2020',
      jsx: 'automatic',
      jsxImportSource: 'preact',
      jsxDev: config.mode === 'development',
      tsconfig: 'tsconfig.json',
      sourceMap: config.output?.sourcemap !== false,
      minify: shouldMinify(config)
    }))

    // PostCSS 处理（支持多种预处理器）
    if (config.style?.extract !== false) {
      const postcss = await import('rollup-plugin-postcss')
      plugins.push(postcss.default({
        extract: true,
        minimize: config.style?.minimize !== false,
        modules: (config as any).style?.modules || false,
        use: ['less', 'sass'],
        extensions: ['.css', '.scss', '.sass', '.less']
      }))
    }

    // 体积优化（Preact 的核心优势）
    if (config.mode === 'production') {
      const terser = await import('@rollup/plugin-terser')
      plugins.push(terser.default({
        compress: {
          pure_funcs: ['console.log'],
          passes: 3, // Preact 多次压缩效果更好
          unsafe: true, // 启用更激进的优化
          unsafe_comps: true,
          unsafe_math: true,
          unsafe_proto: true
        },
        mangle: {
          properties: {
            regex: /^_/
          }
        },
        format: {
          comments: false
        }
      }))
    }

    return plugins
  }

  /**
   * 创建 Preact 优化插件
   * 自动替换 React 导入为 Preact/compat
   */
  private createPreactOptimizationPlugin(): any {
    return {
      name: 'preact-optimization',
      resolveId(source: string) {
        // 将 React 导入重定向到 Preact
        if (source === 'react' || source === 'react-dom') {
          return { id: 'preact/compat', external: true }
        }
        if (source === 'react/jsx-runtime') {
          return { id: 'preact/jsx-runtime', external: true }
        }
        if (source === 'react/jsx-dev-runtime') {
          return { id: 'preact/jsx-dev-runtime', external: true }
        }
        return null
      }
    }
  }

  private buildOutputConfig(config: BuilderConfig): any {
    const out = config.output || {}
    const formats = Array.isArray(out.format) ? out.format : ['esm', 'cjs']
    return { dir: out.dir || 'dist', format: formats, sourcemap: out.sourcemap !== false, exports: 'auto' }
  }

  private createWarningHandler() {
    return (warning: any) => { void warning; /* 可按需过滤 */ }
  }

  /**
   * 合并 external 配置，确保 Preact 相关依赖被标记为外部
   */
  private mergeExternal(external: any): any {
    const pkgs = ['preact']

    if (!external) return pkgs

    if (Array.isArray(external)) {
      return [...external, ...pkgs]
    }

    if (typeof external === 'function') {
      return (id: string, ...args: any[]) => pkgs.includes(id) || external(id, ...args)
    }

    if (external instanceof RegExp) {
      return (id: string) => pkgs.includes(id) || (external as RegExp).test(id)
    }

    if (typeof external === 'string') {
      return [external, ...pkgs]
    }

    if (typeof external === 'object') {
      return [...Object.keys(external), ...pkgs]
    }

    return pkgs
  }
}

