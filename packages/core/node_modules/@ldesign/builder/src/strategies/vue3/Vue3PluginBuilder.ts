/**
 * Vue 3 插件构建器
 * 
 * 负责为 Vue 3 项目构建 Rollup 插件配置
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import type { BuilderConfig } from '../../types/config'
import { shouldMinify } from '../../utils/optimization/MinifyProcessor'
import { vueStyleEntryGenerator } from '../../plugins/vue-style-entry-generator'

/**
 * Vue 3 插件构建器类
 */
export class Vue3PluginBuilder {
  /**
   * 构建 Vue 3 项目所需的所有插件
   * 
   * @param config 构建配置
   * @param dtsCopyPlugin DTS 复制插件（外部提供）
   * @returns 插件数组
   */
  async buildPlugins(config: BuilderConfig, dtsCopyPlugin: any): Promise<any[]> {
    const plugins: any[] = []

    try {
      // 1. Vue TSX/JSX 支持（必须在 Vue SFC 插件之前）
      await this.addVueJsxPlugin(plugins, config)

      // 2. Vue SFC 插件
      await this.addVueSfcPlugin(plugins, config)

      // 3. Node 解析插件
      await this.addNodeResolvePlugin(plugins)

      // 4. CommonJS 插件
      await this.addCommonJsPlugin(plugins)

      // 5. esbuild 插件处理 TypeScript 和 JSX
      await this.addEsbuildPlugin(plugins, config)

      // 6. JSON 插件
      await this.addJsonPlugin(plugins)

      // 7. 样式处理插件
      await this.addStylePlugin(plugins, config)
    } catch (error) {
      console.error('插件加载失败:', error)
    }

    // 8. 添加 DTS 复制插件
    plugins.push(dtsCopyPlugin)

    // 9. 添加 Vue 样式入口生成器插件
    plugins.push(this.createVueStyleEntryPlugin(config))

    return plugins
  }

  /**
   * 添加 Vue JSX 插件
   */
  private async addVueJsxPlugin(plugins: any[], config: BuilderConfig): Promise<void> {
    try {
      const { default: VueJsx } = await import('unplugin-vue-jsx/rollup')
      plugins.push(VueJsx({
        version: 3, // Vue 3
        optimize: config.mode === 'production'
      }))
    } catch (e) {
      // 如果未安装 JSX 插件，则跳过（仍然允许纯 Vue SFC 构建）
      console.warn('unplugin-vue-jsx 未安装，跳过 JSX/TSX 支持')
    }
  }

  /**
   * 添加 Vue SFC 插件
   */
  private async addVueSfcPlugin(plugins: any[], config: BuilderConfig): Promise<void> {
    const VuePlugin = await import('rollup-plugin-vue')

    // 注册 TypeScript 支持以解决 "No fs option provided to compileScript" 错误
    try {
      const { registerTS } = await import('@vue/compiler-sfc')
      const typescript = await import('typescript')
      registerTS(() => typescript.default)
    } catch (error) {
      console.warn('Failed to register TypeScript support for Vue SFC:', error)
    }

    plugins.push(VuePlugin.default({
      preprocessStyles: true,
      include: /\.vue$/,
      ...this.getVueOptions(config)
    }))
  }

  /**
   * 添加 Node 解析插件
   */
  private async addNodeResolvePlugin(plugins: any[]): Promise<void> {
    const nodeResolve = await import('@rollup/plugin-node-resolve')
    plugins.push(nodeResolve.default({
      preferBuiltins: false,
      browser: true,
      extensions: ['.mjs', '.js', '.json', '.ts', '.tsx', '.vue']
    }))
  }

  /**
   * 添加 CommonJS 插件
   */
  private async addCommonJsPlugin(plugins: any[]): Promise<void> {
    const commonjs = await import('@rollup/plugin-commonjs')
    plugins.push(commonjs.default())
  }

  /**
   * 添加 esbuild 插件
   */
  private async addEsbuildPlugin(plugins: any[], config: BuilderConfig): Promise<void> {
    const { default: esbuild } = await import('rollup-plugin-esbuild')
    plugins.push(esbuild({
      include: /\.(ts|tsx|js|jsx)$/,
      exclude: [/node_modules/],
      target: 'es2020',
      jsx: 'preserve', // 保留 JSX/TSX 以便后续由 Vue JSX 插件处理
      tsconfig: 'tsconfig.json',
      minify: shouldMinify(config),
      sourceMap: config.output?.sourcemap !== false
    }))
  }

  /**
   * 添加 JSON 插件
   */
  private async addJsonPlugin(plugins: any[]): Promise<void> {
    const json = await import('@rollup/plugin-json')
    plugins.push(json.default())
  }

  /**
   * 添加样式处理插件
   */
  private async addStylePlugin(plugins: any[], config: BuilderConfig): Promise<void> {
    try {
      // 优先使用 rollup-plugin-styles（更好的 Vue SFC 支持）
      const Styles = await import('rollup-plugin-styles')
      plugins.push(Styles.default({
        mode: 'extract',
        modules: false,
        minimize: shouldMinify(config),
        namedExports: true,
        include: [
          '**/*.less',
          '**/*.css',
          '**/*.scss',
          '**/*.sass'
        ],
        url: {
          inline: false,
        },
        ...this.getStylesOptions(config)
      }))
    } catch (e) {
      // 回退到 postcss
      const postcss = await import('rollup-plugin-postcss')
      plugins.push(postcss.default({
        ...this.getPostCSSOptions(config),
        include: [
          /\.(css|less|scss|sass)$/,
          /\?vue&type=style/
        ]
      }))
    }
  }

  /**
   * 创建 Vue 样式入口生成器插件
   */
  private createVueStyleEntryPlugin(config: BuilderConfig): any {
    return vueStyleEntryGenerator({
      enabled: true,
      outputDirs: ['cjs', 'esm', 'es'],
      cssPattern: 'index.css',
      generateDts: true,
      verbose: config.logLevel !== 'silent',
    })
  }

  /**
   * 获取 Vue 选项
   */
  private getVueOptions(config: BuilderConfig): any {
    const vueConfig = config.vue || {}

    return {
      target: vueConfig.target || 'browser',
      exposeFilename: vueConfig.exposeFilename !== false,
      preprocessStyles: vueConfig.preprocessStyles !== false,
      preprocessCustomRequire: vueConfig.preprocessCustomRequire,
      compiler: vueConfig.compiler,
      compilerOptions: vueConfig.compilerOptions || {},
      transformAssetUrls: vueConfig.transformAssetUrls !== false,
      isProduction: config.mode === 'production',
      cssModules: vueConfig.cssModules !== false,
      style: {
        preprocessOptions: vueConfig.style?.preprocessOptions || {}
      }
    }
  }

  /**
   * 获取 PostCSS 选项
   */
  private getPostCSSOptions(config: BuilderConfig): any {
    return {
      extract: config.style?.extract !== false,
      minimize: config.style?.minimize !== false,
      inject: false,
      modules: false
    }
  }

  /**
   * 获取 rollup-plugin-styles 选项
   */
  private getStylesOptions(config: BuilderConfig): any {
    return {
      extract: config.style?.extract !== false,
      minimize: config.style?.minimize !== false,
      inject: false,
      modules: false,
      sourceMap: config.output?.sourcemap !== false,
      plugins: config.style?.plugins || []
    }
  }
}

/**
 * 创建 Vue 3 插件构建器
 */
export function createVue3PluginBuilder(): Vue3PluginBuilder {
  return new Vue3PluginBuilder()
}
