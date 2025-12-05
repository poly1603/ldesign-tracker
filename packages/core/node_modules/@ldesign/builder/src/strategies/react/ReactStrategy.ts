/**
 * React 策略
 * 使用 esbuild 处理 TS/TSX，postcss 处理样式，rollup 输出 ESM/CJS
 */

import type { ILibraryStrategy } from '../../types/strategy'
import { LibraryType } from '../../types/library'
import type { BuilderConfig } from '../../types/config'
import type { UnifiedConfig } from '../../types/adapter'
import { shouldMinify } from '../../utils/optimization/MinifyProcessor'
import { BaseStrategy } from '../base/BaseStrategy'

export class ReactStrategy extends BaseStrategy implements ILibraryStrategy {
  readonly name = 'react'
  readonly supportedTypes = [LibraryType.REACT]
  readonly priority = 10

  override async applyStrategy(config: BuilderConfig): Promise<UnifiedConfig> {
    // 使用基类的入口解析方法
    const resolvedInput = await this.resolveInputEntriesEnhanced(config)

    return {
      input: resolvedInput,
      output: this.buildOutputConfig(config),
      plugins: await this.buildPlugins(config),
      external: this.mergeExternal(config.external),
      treeshake: config.performance?.treeshaking !== false,
      onwarn: this.createWarningHandler()
    }
  }

  override isApplicable(config: BuilderConfig): boolean {
    return config.libraryType === LibraryType.REACT
  }

  override getDefaultConfig(): Partial<BuilderConfig> {
    return {
      libraryType: LibraryType.REACT,
      output: { format: ['esm', 'cjs'], sourcemap: true },
      performance: { treeshaking: true, minify: true }
    }
  }

  override getRecommendedPlugins(_config: BuilderConfig): any[] { return [] }
  override validateConfig(_config: BuilderConfig): any { return { valid: true, errors: [], warnings: [], suggestions: [] } }

  private async buildPlugins(config: BuilderConfig): Promise<any[]> {
    const plugins: any[] = []

    // Node resolve
    const nodeResolve = await import('@rollup/plugin-node-resolve')
    plugins.push(nodeResolve.default({ browser: true, extensions: ['.mjs', '.js', '.json', '.ts', '.tsx'] }))

    // CommonJS
    const commonjs = await import('@rollup/plugin-commonjs')
    plugins.push(commonjs.default())

    // TypeScript for DTS only
    const ts = await import('@rollup/plugin-typescript')
    plugins.push({
      name: 'typescript',
      plugin: async () => ts.default({
        tsconfig: 'tsconfig.json'
      } as any),
      options: {
        tsconfig: 'tsconfig.json'
      }
    })

    // PostCSS (optional)
    if (config.style?.extract !== false) {
      const postcss = await import('rollup-plugin-postcss')
      plugins.push(postcss.default({ extract: true, minimize: config.style?.minimize !== false }))
    }

    // esbuild for TS/TSX/JSX
    const esbuild = await import('rollup-plugin-esbuild')
    plugins.push(esbuild.default({
      include: /\.(tsx?|jsx?)$/, exclude: [/node_modules/], target: 'es2020',
      jsx: 'automatic', jsxImportSource: 'react', tsconfig: 'tsconfig.json',
      sourceMap: config.output?.sourcemap !== false, minify: shouldMinify(config)
    }))

    return plugins
  }

  /**
   * 获取 React 框架的全局变量映射
   */
  protected override getFrameworkGlobals(): Record<string, string> {
    return {
      react: 'React',
      'react-dom': 'ReactDOM'
    }
  }

  /**
   * 获取默认外部依赖
   */
  protected override getDefaultExternal(): (string | RegExp)[] {
    return ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime']
  }

  protected override createWarningHandler() {
    return (warning: any) => { if (warning.code === 'THIS_IS_UNDEFINED' || warning.code === 'CIRCULAR_DEPENDENCY') return; console.warn(`Warning: ${warning.message}`) }
  }

  /**
   * 获取默认入口文件
   */
  protected override getDefaultEntry(): string {
    return 'src/index.ts'
  }

  /**
   * 获取默认扫描模式
   */
  protected override getDefaultPatterns(): string[] {
    return ['src/**/*.{ts,tsx,js,jsx,json}']
  }

  /**
   * 合并 external 配置，确保 React 相关依赖被标记为外部
   */
  protected override mergeExternal(external: any): any {
    const reactPkgs = this.getDefaultExternal() as string[]

    if (!external) return reactPkgs

    if (Array.isArray(external)) {
      return [...external, ...reactPkgs]
    }

    if (typeof external === 'function') {
      return (id: string, ...args: any[]) => reactPkgs.includes(id) || external(id, ...args)
    }

    if (external instanceof RegExp) {
      return (id: string) => reactPkgs.includes(id) || (external as RegExp).test(id)
    }

    if (typeof external === 'string') {
      return [external, ...reactPkgs]
    }

    if (typeof external === 'object') {
      return [...Object.keys(external), ...reactPkgs]
    }

    return reactPkgs
  }
}

