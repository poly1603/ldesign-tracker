/**
 * Solid 策略
 * 使用 rollup-plugin-solid 处理 JSX/TSX，postcss 可选
 */

import type { ILibraryStrategy } from '../../types/strategy'
import { LibraryType } from '../../types/library'
import type { BuilderConfig } from '../../types/config'
import type { UnifiedConfig } from '../../types/adapter'
import { shouldMinify } from '../../utils/optimization/MinifyProcessor'

export class SolidStrategy implements ILibraryStrategy {
  readonly name = 'solid'
  readonly supportedTypes = [LibraryType.SOLID]
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
    return config.libraryType === LibraryType.SOLID
  }

  getDefaultConfig(): Partial<BuilderConfig> {
    return {
      libraryType: LibraryType.SOLID,
      output: { format: ['esm', 'cjs'], sourcemap: true },
      performance: { treeshaking: true, minify: true }
    }
  }

  getRecommendedPlugins(_config: BuilderConfig): any[] { return [] }
  validateConfig(_config: BuilderConfig): any { return { valid: true, errors: [], warnings: [], suggestions: [] } }

  private async buildPlugins(config: BuilderConfig): Promise<any[]> {
    const plugins: any[] = []

    // Node resolve（优化 Solid 解析）
    const nodeResolve = await import('@rollup/plugin-node-resolve')
    plugins.push(nodeResolve.default({
      browser: true,
      extensions: ['.mjs', '.js', '.json', '.ts', '.tsx', '.jsx'],
      dedupe: ['solid-js', 'solid-js/web', 'solid-js/store']
    }))

    // CommonJS
    const commonjs = await import('@rollup/plugin-commonjs')
    plugins.push(commonjs.default({
      include: /node_modules/
    }))

    // Babel 插件用于 Solid JSX 转换和 TypeScript 处理
    const babel = await import('@rollup/plugin-babel')
    plugins.push(babel.default({
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
      babelHelpers: 'bundled',
      presets: [
        ['@babel/preset-typescript', {
          isTSX: true,
          allExtensions: true
        }],
        ['babel-preset-solid', {
          generate: config.mode === 'development' ? 'dom' : 'universal',
          hydratable: true
        }]
      ],
      exclude: /node_modules/
    } as any))

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

    // 体积优化：移除未使用的代码
    if (config.mode === 'production') {
      const terser = await import('@rollup/plugin-terser')
      plugins.push(terser.default({
        compress: {
          pure_funcs: ['console.log'],
          passes: 2 // 多次压缩以获得更好的效果
        },
        mangle: {
          properties: {
            regex: /^_/ // 只混淆下划线开头的私有属性
          }
        }
      }))
    }

    return plugins
  }

  private warn(message: string): void {
    // 静默处理，避免控制台警告
    // 如需调试，可通过 logger 输出
  }

  private buildOutputConfig(config: BuilderConfig): any {
    const out = config.output || {}
    // 如果 output 本身是数组格式，直接返回
    if (Array.isArray(out)) {
      return out
    }
    const formats = Array.isArray(out.format) ? out.format : ['esm', 'cjs']
    return { dir: out.dir || 'dist', format: formats, sourcemap: out.sourcemap !== false, exports: 'auto' }
  }

  private createWarningHandler() {
    return (warning: any) => { void warning; /* 可按需过滤 Solid 特定警告 */ }
  }

  /**
   * 合并 external 配置，确保 Solid 相关依赖被标记为外部
   */
  private mergeExternal(external: any): any {
    const pkgs = ['solid-js']

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

