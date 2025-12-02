/**
 * Svelte 策略
 * 使用 @sveltejs/rollup-plugin-svelte + esbuild 处理 TS/JS，postcss 处理样式
 */

import type { ILibraryStrategy } from '../../types/strategy'
import { LibraryType } from '../../types/library'
import type { BuilderConfig } from '../../types/config'
import type { UnifiedConfig } from '../../types/adapter'
import { shouldMinify } from '../../utils/optimization/MinifyProcessor'

export class SvelteStrategy implements ILibraryStrategy {
  readonly name = 'svelte'
  readonly supportedTypes = [LibraryType.SVELTE]
  readonly priority = 9

  async applyStrategy(config: BuilderConfig): Promise<UnifiedConfig> {
    const input = config.input || 'src/index.ts'

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
    return config.libraryType === LibraryType.SVELTE
  }

  getDefaultConfig(): Partial<BuilderConfig> {
    return {
      libraryType: LibraryType.SVELTE,
      output: { format: ['esm', 'cjs'], sourcemap: true },
      performance: { treeshaking: true, minify: true }
    }
  }

  getRecommendedPlugins(_config: BuilderConfig): any[] { return [] }
  validateConfig(_config: BuilderConfig): any { return { valid: true, errors: [], warnings: [], suggestions: [] } }

  private async buildPlugins(config: BuilderConfig): Promise<any[]> {
    const plugins: any[] = []

    // Node resolve
    const nodeResolve = await import('@rollup/plugin-node-resolve')
    plugins.push(nodeResolve.default({
      browser: true,
      extensions: ['.mjs', '.js', '.json', '.ts', '.svelte'],
      dedupe: ['svelte']
    }))

    // CommonJS
    const commonjs = await import('@rollup/plugin-commonjs')
    plugins.push(commonjs.default())

    // Svelte 插件（增强版，支持预处理器）
    const sveltePlugin = await import('rollup-plugin-svelte')
    plugins.push(sveltePlugin.default({
      emitCss: true,
      compilerOptions: {
        dev: (config.mode || 'production') === 'development',
        css: 'external' // 提取 CSS
      },
      preprocess: await this.getSveltePreprocessors(config)
    }))

    // PostCSS 处理（支持 SCSS、Less 等）
    if (config.style?.extract !== false) {
      const postcss = await import('rollup-plugin-postcss')
      plugins.push(postcss.default({
        extract: true,
        minimize: config.style?.minimize !== false,
        use: this.getStyleProcessors(config),
        extensions: ['.css', '.scss', '.sass', '.less']
      }))
    }

    // esbuild for TS/JS
    const esbuild = await import('rollup-plugin-esbuild')
    plugins.push(esbuild.default({
      include: /\.(ts|js)$/,
      exclude: [/node_modules/],
      target: 'es2020',
      sourceMap: config.output?.sourcemap !== false,
      minify: shouldMinify(config)
    }))

    return plugins
  }

  /**
   * 获取 Svelte 预处理器
   */
  private async getSveltePreprocessors(config: BuilderConfig): Promise<any> {
    try {
      // @ts-ignore - svelte-preprocess is optional
      const { preprocess } = await import('svelte-preprocess')
      return preprocess({
        typescript: {
          tsconfigFile: config.typescript?.tsconfig || 'tsconfig.json'
        },
        scss: {
          renderSync: true
        },
        sass: true,
        less: true,
        postcss: {
          plugins: [
            require('autoprefixer')()
          ]
        }
      })
    } catch (error) {
      // svelte-preprocess 不是必需的，如果未安装则跳过
      return undefined
    }
  }

  /**
   * 获取样式处理器
   */
  private getStyleProcessors(config: BuilderConfig): string[] {
    const processors: string[] = []

    if ((config as any).style?.less !== false) {
      processors.push('less')
    }

    if ((config as any).style?.sass !== false) {
      processors.push('sass')
    }

    return processors
  }

  private buildOutputConfig(config: BuilderConfig): any {
    const out = config.output || {}
    const formats = Array.isArray(out.format) ? out.format : ['esm', 'cjs']
    return { dir: out.dir || 'dist', format: formats, sourcemap: out.sourcemap !== false, exports: 'auto' }
  }

  private createWarningHandler() {
    return (warning: any) => { void warning; /* 可按需过滤 Svelte 特定警告 */ }
  }

  /**
   * 合并 external 配置，确保 Svelte 相关依赖被标记为外部
   */
  private mergeExternal(external: any): any {
    const pkgs = ['svelte']

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

