/**
 * 样式库构建策略
 *
 * 为样式库提供完整的构建策略，包括：
 * - Less/Sass 预处理器支持
 * - CSS 压缩和优化
 * - 自动添加浏览器前缀
 * - CSS 变量和主题支持
 *
 * @author LDesign Team
 * @version 1.0.0
 */

import type { ILibraryStrategy } from '../../types/strategy'
import { LibraryType } from '../../types/library'
import type { BuilderConfig } from '../../types/config'
import type { UnifiedConfig } from '../../types/adapter'
import { BaseStrategy } from '../base/BaseStrategy'

/**
 * 样式库构建策略
 */
export class StyleStrategy extends BaseStrategy implements ILibraryStrategy {
  readonly name = 'style'
  readonly supportedTypes: LibraryType[] = [LibraryType.STYLE]
  readonly priority = 8

  /**
   * 应用样式策略
   */
  override async applyStrategy(config: BuilderConfig): Promise<UnifiedConfig> {
    // 使用基类的入口解析方法
    const resolvedInput = await this.resolveInputEntriesEnhanced(config)

    const unifiedConfig: UnifiedConfig = {
      input: resolvedInput,
      output: this.buildOutputConfig(config),
      plugins: this.buildPlugins(config),
      external: config.external || [],
      treeshake: false, // CSS 不需要 Tree Shaking
      onwarn: this.createWarningHandler()
    }

    return unifiedConfig
  }

  /**
   * 检查策略是否适用
   */
  override isApplicable(config: BuilderConfig): boolean {
    return config.libraryType === LibraryType.STYLE
  }

  /**
   * 获取默认配置
   */
  override getDefaultConfig(): Partial<BuilderConfig> {
    return {
      libraryType: LibraryType.STYLE,
      output: {
        format: ['esm'], // 使用 ESM 格式，PostCSS 插件会提取 CSS
        sourcemap: true
      },
      style: {
        extract: true,
        minimize: true,
        autoprefixer: true,
        modules: false,
        preprocessor: {
          less: {
            enabled: true,
            options: {
              javascriptEnabled: true
            }
          },
          sass: {
            enabled: false
          }
        },
        browserslist: [
          '> 1%',
          'last 2 versions',
          'not dead'
        ]
      },
      performance: {
        treeshaking: false,
        minify: true
      }
    }
  }

  /**
   * 获取推荐插件
   */
  override getRecommendedPlugins(config: BuilderConfig): any[] {
    const plugins = []

    // TypeScript 插件 - 如果项目包含 TypeScript 文件，也要生成类型声明
    // 即使是样式库，也可能有 TypeScript 工具函数
    if (config.typescript?.declaration !== false) {
      plugins.push({
        name: '@rollup/plugin-typescript',
        options: {
          tsconfig: config.typescript?.tsconfig,
          compilerOptions: {
            declaration: true,
            declarationMap: config.sourcemap === true,
            skipLibCheck: true,
            ...config.typescript?.compilerOptions
          }
        }
      })
    }

    // PostCSS 插件
    plugins.push({
      name: 'postcss',
      options: this.getPostCSSOptions(config)
    })

    // Less 插件
    if (this.shouldUseLess(config)) {
      plugins.push({
        name: 'less',
        options: this.getLessOptions(config)
      })
    }

    // Sass 插件
    if (this.shouldUseSass(config)) {
      plugins.push({
        name: 'sass',
        options: this.getSassOptions(config)
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
      // 入口可选：当未提供时，策略会自动发现入口，不作为硬错误
      warnings.push('未显式指定入口，已启用自动入口发现')
    } else if (typeof config.input === 'string') {
      const inputStr = config.input as string
      const supportedExtensions = ['.css', '.less', '.scss', '.sass', '.styl']
      const hasValidExtension = supportedExtensions.some(ext =>
        inputStr.endsWith(ext)
      )

      if (!hasValidExtension) {
        warnings.push('入口文件不是样式文件，建议使用 .css, .less, .scss 等扩展名')
      }
    }

    // 检查输出配置
    if (config.output?.format && !config.output.format.includes('css')) {
      suggestions.push('样式库建议输出 CSS 格式')
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
  protected override buildOutputConfig(config: BuilderConfig): any {
    const outputConfig = config.output || {}
    const formats = Array.isArray(outputConfig.format)
      ? outputConfig.format
      : [outputConfig.format || 'esm']

    return {
      dir: outputConfig.dir || 'dist',
      format: formats,
      sourcemap: outputConfig.sourcemap !== false,
      assetFileNames: '[name][extname]' // 确保 CSS 文件使用正确的名称
    }
  }

  /**
   * 构建插件配置
   */
  private buildPlugins(config: BuilderConfig): any[] {
    const plugins: any[] = []

    // TypeScript 插件（样式库也可能包含 TS 文件）
    // 添加对 TypeScript 的支持，避免解析错误
    plugins.push({
      name: 'esbuild',
      plugin: async () => {
        const { default: esbuild } = await import('rollup-plugin-esbuild')
        return esbuild({
          include: /\.[jt]sx?$/,
          exclude: /node_modules/,
          sourceMap: config.output?.sourcemap !== false,
          target: 'es2020',
          tsconfig: 'tsconfig.json',
          loaders: {
            '.ts': 'ts',
            '.tsx': 'tsx',
            '.js': 'js',
            '.jsx': 'jsx'
          }
        })
      }
    })

    // PostCSS 插件（用于处理 CSS）
    plugins.push({
      name: 'postcss',
      plugin: async () => {
        const postcss = await import('rollup-plugin-postcss')
        const postCSSPlugins = await this.getPostCSSPlugins(config)
        return postcss.default({
          extract: true,
          minimize: config.performance?.minify !== false,
          sourceMap: config.output?.sourcemap !== false,
          plugins: postCSSPlugins
        })
      }
    })

    return plugins
  }

  /**
   * 获取 PostCSS 插件
   */
  private async getPostCSSPlugins(config: BuilderConfig): Promise<any[]> {
    const plugins: any[] = []

    // Autoprefixer
    if (config.style?.autoprefixer !== false) {
      try {
        const autoprefixer = await import('autoprefixer')
        plugins.push(autoprefixer.default({
          overrideBrowserslist: config.style?.browserslist || [
            '> 1%',
            'last 2 versions',
            'not dead'
          ]
        }))
      } catch (error) {
        console.warn('Autoprefixer 未安装，跳过自动前缀功能')
      }
    }

    return plugins
  }

  /**
   * 获取 PostCSS 选项
   */
  private async getPostCSSOptions(config: BuilderConfig): Promise<any> {
    return {
      extract: config.style?.extract !== false,
      minimize: config.style?.minimize !== false,
      sourceMap: config.output?.sourcemap !== false,
      modules: config.style?.modules || false,
      plugins: await this.getPostCSSPlugins(config)
    }
  }

  /**
   * 获取 Less 选项
   */
  private getLessOptions(config: BuilderConfig): any {
    const preprocessor = config.style?.preprocessor
    const lessConfig = typeof preprocessor === 'object' ? preprocessor.less : undefined

    return {
      javascriptEnabled: lessConfig?.options?.javascriptEnabled !== false,
      modifyVars: lessConfig?.options?.modifyVars || {},
      ...lessConfig?.options
    }
  }

  /**
   * 获取 Sass 选项
   */
  private getSassOptions(config: BuilderConfig): any {
    const preprocessor = config.style?.preprocessor
    const sassConfig = typeof preprocessor === 'object' ? preprocessor.sass : undefined

    return {
      includePaths: ['node_modules'],
      ...sassConfig?.options
    }
  }

  /**
   * 检查是否应该使用 Less
   */
  private shouldUseLess(config: BuilderConfig): boolean {
    const preprocessor = config.style?.preprocessor

    if (typeof preprocessor === 'object' && preprocessor.less?.enabled === false) {
      return false
    }

    // 如果入口文件是 .less，自动启用
    if (typeof config.input === 'string' && config.input.endsWith('.less')) {
      return true
    }

    return typeof preprocessor === 'object' && preprocessor.less?.enabled === true
  }

  /**
   * 检查是否应该使用 Sass
   */
  private shouldUseSass(config: BuilderConfig): boolean {
    const preprocessor = config.style?.preprocessor

    if (typeof preprocessor === 'object' && preprocessor.sass?.enabled === false) {
      return false
    }

    // 如果入口文件是 .scss 或 .sass，自动启用
    if (typeof config.input === 'string') {
      if (config.input.endsWith('.scss') || config.input.endsWith('.sass')) {
        return true
      }
    }

    return typeof preprocessor === 'object' && preprocessor.sass?.enabled === true
  }

  /**
   * 创建警告处理器
   */
  protected override createWarningHandler() {
    return (warning: any) => {
      // 忽略一些常见的无害警告
      if (warning.code === 'EMPTY_BUNDLE') {
        return
      }

      console.warn(`Warning: ${warning.message}`)
    }
  }

  /**
   * 获取默认入口文件
   */
  protected override getDefaultEntry(): string {
    return 'src/index.less'
  }

  /**
   * 获取默认扫描模式
   */
  protected override getDefaultPatterns(): string[] {
    return ['src/**/*.{css,less,scss,sass,styl}']
  }
}
