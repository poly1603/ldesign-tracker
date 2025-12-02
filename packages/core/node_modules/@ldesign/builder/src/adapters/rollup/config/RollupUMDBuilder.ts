/**
 * Rollup UMD 配置构建器
 * 
 * 负责构建 UMD 格式的 Rollup 配置
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import type { UnifiedConfig } from '../../../types/adapter'
import type { RollupOptions } from 'rollup'
import { Logger } from '../../../utils/logger'
import { normalizeInput } from '../../../utils/file-system/glob'
import { RollupBannerGenerator } from '../RollupBannerGenerator'

/**
 * UMD 配置构建器
 * 负责创建 UMD 格式的构建配置
 */
export class RollupUMDBuilder {
  private logger: Logger
  private bannerGenerator: RollupBannerGenerator

  constructor(logger: Logger, bannerGenerator: RollupBannerGenerator) {
    this.logger = logger
    this.bannerGenerator = bannerGenerator
  }

  /**
   * 创建 UMD 配置
   * 返回常规版本和压缩版本的配置数组
   * 
   * @param config - 统一配置
   * @param filteredInput - 过滤后的输入
   * @param basePlugins - 基础插件列表
   * @param userPlugins - 用户插件列表
   * @param getOnWarn - 警告处理函数
   * @returns UMD 配置数组（包含常规版本和压缩版本）
   */
  async createUMDConfig(
    config: UnifiedConfig,
    filteredInput: string | string[] | Record<string, string> | undefined,
    basePlugins: any[],
    userPlugins: any[],
    getOnWarn: (config: UnifiedConfig) => any
  ): Promise<RollupOptions[]> {
    // 检查是否禁用 UMD
    if (!this.isUMDEnabled(config)) {
      return []
    }

    const umdSection = this.getUMDSection(config)
    const outputConfig = config.output || {}

    // 确定 UMD 入口文件
    const umdEntry = await this.resolveUMDEntry(config, umdSection, filteredInput)

    // 确定 UMD 全局变量名
    const umdName = await this.resolveUMDName(config, umdSection, outputConfig)

    // 解析 Banner 配置
    const banners = await this.resolveBanners(config)

    // 合并全局变量映射
    const mergedGlobals = this.mergeGlobals(outputConfig, umdSection)

    // 创建基础配置
    const baseConfig = {
      input: umdEntry,
      external: config.external,
      treeshake: config.treeshake,
      onwarn: getOnWarn(config)
    }

    const outputDir = umdSection.dir || 'dist'
    const fileName = umdSection.fileName || 'index.js'
    const baseFileName = fileName.replace(/\.js$/, '')

    // 创建常规版本配置
    const regularConfig: RollupOptions = {
      ...baseConfig,
      plugins: [...basePlugins, ...userPlugins],
      output: {
        format: 'umd',
        name: umdName,
        file: `${outputDir}/${fileName}`,
        inlineDynamicImports: true,
        sourcemap: umdSection.sourcemap ?? outputConfig.sourcemap,
        globals: mergedGlobals,
        exports: 'named',
        assetFileNames: '[name].[ext]',
        ...banners
      }
    }

    // 创建压缩版本配置
    const terserPlugin = await this.getTerserPlugin()
    const minifiedPlugins = terserPlugin
      ? [...basePlugins, ...userPlugins, terserPlugin]
      : [...basePlugins, ...userPlugins]

    const minifiedConfig: RollupOptions = {
      ...baseConfig,
      plugins: minifiedPlugins,
      output: {
        format: 'umd',
        name: umdName,
        file: `${outputDir}/${baseFileName}.min.js`,
        inlineDynamicImports: true,
        sourcemap: umdSection.sourcemap ?? outputConfig.sourcemap,
        globals: mergedGlobals,
        exports: 'named',
        assetFileNames: '[name].[ext]',
        ...banners
      }
    }

    return [regularConfig, minifiedConfig]
  }

  /**
   * 检查是否启用 UMD
   */
  private isUMDEnabled(config: UnifiedConfig): boolean {
    const topLevelUmd = (config as any).umd
    const outputUmd = (config as any).output?.umd

    // 检查顶层 umd.enabled
    if (topLevelUmd && typeof topLevelUmd === 'object' && topLevelUmd.enabled === false) {
      return false
    }

    // 检查 output.umd.enabled
    if (outputUmd && typeof outputUmd === 'object' && outputUmd.enabled === false) {
      return false
    }

    return true
  }

  /**
   * 获取 UMD 配置节
   */
  private getUMDSection(config: UnifiedConfig): any {
    const topLevelUmd = (config as any).umd
    const outputUmd = (config as any).output?.umd

    let umdSection = topLevelUmd || outputUmd || {}

    if (umdSection === true) {
      return {}
    }

    if (umdSection === false || (typeof umdSection === 'object' && umdSection.enabled === false)) {
      return {}
    }

    return umdSection
  }

  /**
   * 解析 UMD 入口文件
   */
  private async resolveUMDEntry(
    config: UnifiedConfig,
    umdSection: any,
    filteredInput: string | string[] | Record<string, string> | undefined
  ): Promise<string> {
    const fs = await import('fs')
    const path = await import('path')
    const projectRoot = (config as any).root || (config as any).cwd || process.cwd()

    // 优先使用 output.umd.input，然后是 umd.entry，最后是顶层 input
    let umdEntry = umdSection.input || umdSection.entry ||
      (typeof filteredInput === 'string' ? filteredInput : undefined)

    // 如果有通配符，需要解析
    if (umdEntry && (umdEntry.includes('*') || Array.isArray(umdEntry))) {
      const resolved = await normalizeInput(umdEntry, projectRoot, config.exclude)

      // UMD 必须是单入口
      if (Array.isArray(resolved)) {
        throw new Error('UMD 格式不支持多入口，请在配置中指定单个入口文件。例如: umd: { entry: "src/index.ts" }')
      }
      if (typeof resolved === 'object' && !Array.isArray(resolved)) {
        throw new Error('UMD 格式不支持多入口配置。请指定单个入口文件，例如: umd: { entry: "src/index.ts" }')
      }
      umdEntry = resolved as string
    }

    // 如果未显式指定，自动检测入口文件
    if (!umdEntry) {
      umdEntry = await this.detectUMDEntry(config, filteredInput, projectRoot, fs, path)
    }

    // 验证入口文件是否存在
    if (!fs.existsSync(path.resolve(projectRoot, umdEntry))) {
      throw new Error(
        `UMD 入口文件不存在: ${umdEntry}\n\n` +
        `请检查：\n` +
        `1. 确保文件存在于指定路径\n` +
        `2. 或在配置中指定正确的入口文件: umd: { entry: "your-entry.ts" }\n` +
        `3. 或禁用 UMD 构建: umd: { enabled: false }`
      )
    }

    return umdEntry
  }

  /**
   * 自动检测 UMD 入口文件
   */
  private async detectUMDEntry(
    config: UnifiedConfig,
    filteredInput: string | string[] | Record<string, string> | undefined,
    projectRoot: string,
    fs: any,
    path: any
  ): Promise<string> {
    const candidates = [
      'src/index-lib.ts',
      'src/index-lib.js',
      'src/index-umd.ts',
      'src/index-umd.js',
      'src/index.ts',
      'src/index.js',
      'src/main.ts',
      'src/main.js',
      'index.ts',
      'index.js'
    ]

    // 尝试候选文件
    for (const entry of candidates) {
      if (fs.existsSync(path.resolve(projectRoot, entry))) {
        this.logger.info(`UMD 入口文件自动检测: ${entry}`)
        return entry
      }
    }

    // 尝试使用主入口文件
    const mainInput = typeof config.input === 'string' ? config.input :
      typeof filteredInput === 'string' ? filteredInput : null

    if (mainInput && fs.existsSync(path.resolve(projectRoot, mainInput))) {
      this.logger.info(`UMD 入口文件使用主入口: ${mainInput}`)
      return mainInput
    }

    // 最后的兜底
    this.logger.warn(`未找到有效的 UMD 入口文件，使用默认值: src/index.ts`)
    return 'src/index.ts'
  }

  /**
   * 解析 UMD 全局变量名
   */
  private async resolveUMDName(
    config: UnifiedConfig,
    umdSection: any,
    outputConfig: any
  ): Promise<string> {
    let umdName = umdSection.name || outputConfig.name

    if (!umdName) {
      // 尝试从 package.json 推断
      try {
        const fs = await import('fs')
        const path = await import('path')
        const packageJson = JSON.parse(
          fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf-8')
        )
        umdName = this.generateUMDName(packageJson.name)
      } catch {
        umdName = 'MyLibrary'
      }
    }

    return umdName
  }

  /**
   * 生成 UMD 全局变量名
   * 将 package 名称转换为 PascalCase 格式
   */
  private generateUMDName(packageName: string): string {
    if (!packageName) return 'MyLibrary'

    // 移除作用域前缀 (@scope/package -> package)
    const name = packageName.replace(/^@[^/]+\//, '')

    // 转换为 PascalCase
    return name
      .split(/[-_/]/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('')
  }

  /**
   * 解析 Banner 配置
   */
  private async resolveBanners(config: UnifiedConfig): Promise<{
    banner?: string
    footer?: string
    intro?: string
    outro?: string
  }> {
    const bannerConfig = (config as any).banner

    return {
      banner: await this.bannerGenerator.resolveBanner(bannerConfig, config),
      footer: await this.bannerGenerator.resolveFooter(bannerConfig),
      intro: await this.bannerGenerator.resolveIntro(bannerConfig),
      outro: await this.bannerGenerator.resolveOutro(bannerConfig)
    }
  }

  /**
   * 合并全局变量映射
   */
  private mergeGlobals(outputConfig: any, umdSection: any): Record<string, string> {
    // 默认 UMD 全局变量映射（用于常见外部库）
    const defaultGlobals: Record<string, string> = {
      'react': 'React',
      'react-dom': 'ReactDOM',
      'react/jsx-runtime': 'jsxRuntime',
      'react/jsx-dev-runtime': 'jsxDevRuntime',
      'vue': 'Vue',
      'vue-demi': 'VueDemi',
      '@angular/core': 'ngCore',
      '@angular/common': 'ngCommon',
      'preact': 'Preact',
      'preact/hooks': 'preactHooks',
      'preact/jsx-runtime': 'jsxRuntime',
      'preact/jsx-dev-runtime': 'jsxDevRuntime',
      'solid-js': 'Solid',
      'solid-js/web': 'SolidWeb',
      'solid-js/jsx-runtime': 'jsxRuntime',
      'svelte': 'Svelte',
      'lit': 'Lit',
      'lit-html': 'litHtml'
    }

    return {
      ...defaultGlobals,
      ...(outputConfig.globals || {}),
      ...(umdSection.globals || {})
    }
  }

  /**
   * 获取 Terser 压缩插件
   */
  private async getTerserPlugin(): Promise<any> {
    try {
      const { default: terser } = await import('@rollup/plugin-terser')
      return terser({
        compress: {
          drop_console: false,
          pure_funcs: ['console.log']
        },
        mangle: {
          reserved: ['exports', 'require', 'module', '__dirname', '__filename']
        },
        format: {
          comments: /^!/
        }
      })
    } catch (error) {
      this.logger.warn('Terser 插件不可用，跳过压缩:', error)
      return null
    }
  }
}

