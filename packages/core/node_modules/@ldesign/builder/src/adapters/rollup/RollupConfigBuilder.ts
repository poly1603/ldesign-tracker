/**
 * Rollup 配置构建器
 * 负责将统一配置转换为 Rollup 特定配置
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import type { UnifiedConfig, BundlerSpecificConfig } from '../../types/adapter'
import type { Logger } from '../../utils/logger'
import { normalizeInput } from '../../utils/file-system/glob'
import { RollupFormatMapper } from './utils/RollupFormatMapper'
import path from 'path'
import fs from 'fs'

/**
 * Rollup 配置构建器
 */
export class RollupConfigBuilder {
  private logger: Logger
  private formatMapper: RollupFormatMapper

  constructor(logger: Logger) {
    this.logger = logger
    this.formatMapper = new RollupFormatMapper()
  }

  /**
   * 构建 Rollup 配置
   */
  async build(config: UnifiedConfig): Promise<{ configs: any[], mainConfig: BundlerSpecificConfig }> {
    const basePlugins = await this.getBasePlugins(config)
    const filteredInput = await normalizeInput(config.input, process.cwd(), config.exclude)

    const rollupConfig: any = {
      input: filteredInput,
      external: config.external,
      onwarn: this.createWarningHandler(config)
    }

    // 注入 Acorn 插件以支持在转换前解析 TSX/JSX/TS 语法
    const acornPlugins = await this.getAcornPlugins()
    if (acornPlugins.length > 0) {
      rollupConfig.acorn = { ...(rollupConfig.acorn || {}), injectPlugins: acornPlugins }
    }

    const configs: any[] = []
    const outputConfig = config.output as any

    // 调试日志
    this.logger.info(`[RollupConfigBuilder] 输出配置检测:`)
    this.logger.info(`  - outputConfig.es: ${!!outputConfig?.es}`)
    this.logger.info(`  - outputConfig.esm: ${!!outputConfig?.esm}`)
    this.logger.info(`  - outputConfig.cjs: ${!!outputConfig?.cjs}`)
    this.logger.info(`  - outputConfig.umd: ${!!outputConfig?.umd}`)
    this.logger.info(`  - outputConfig.format: ${outputConfig?.format}`)

    // 处理输出配置
    if (outputConfig?.es || outputConfig?.esm || outputConfig?.cjs || outputConfig?.umd) {
      this.logger.info(`[RollupConfigBuilder] 使用格式特定配置 (es/esm/cjs/umd)`)
      const formatConfigs = await this.buildFormatConfigs(config, filteredInput, basePlugins)
      configs.push(...formatConfigs)
    } else if (Array.isArray(outputConfig?.format)) {
      this.logger.info(`[RollupConfigBuilder] 使用多格式配置`)
      const multiFormatConfigs = await this.buildMultiFormatConfigs(config, filteredInput, basePlugins)
      configs.push(...multiFormatConfigs)
    } else {
      this.logger.info(`[RollupConfigBuilder] 使用单格式配置`)
      const singleFormatConfig = await this.buildSingleFormatConfig(config, filteredInput, basePlugins, rollupConfig)
      return { configs: [singleFormatConfig], mainConfig: singleFormatConfig }
    }

    return {
      configs,
      mainConfig: configs.length > 1
        ? { ...rollupConfig, output: configs.map(c => c.output).filter(Boolean) }
        : configs[0]
    }
  }

  /**
   * 构建格式特定配置（es/esm/cjs/umd）
   */
  private async buildFormatConfigs(config: UnifiedConfig, filteredInput: any, basePlugins: any[]): Promise<any[]> {
    const configs: any[] = []
    const outputConfig = config.output as any

    // ES 配置 - TDesign 风格: .mjs + style/ 目录(包含 css.mjs 和 index.css)
    if (outputConfig.es && outputConfig.es !== false) {
      const esConfig = await this.buildESConfig(config, filteredInput, basePlugins)
      configs.push(esConfig)
    }

    // ESM 配置 - TDesign 风格: .js,不包含样式文件
    if (outputConfig.esm && outputConfig.esm !== false) {
      const esmConfig = await this.buildESMConfig(config, filteredInput, basePlugins)
      configs.push(esmConfig)
    }

    // CJS 配置 - 忽略样式
    if (outputConfig.cjs && outputConfig.cjs !== false) {
      const cjsConfig = await this.buildCJSConfig(config, filteredInput, basePlugins)
      configs.push(cjsConfig)
    }

    // UMD 配置 - 单个 CSS
    if (outputConfig.umd && outputConfig.umd !== false) {
      const umdConfigs = await this.buildUMDConfig(config, filteredInput, basePlugins)
      configs.push(...umdConfigs)
    }

    return configs
  }

  /**
   * 构建 ES 配置 (TDesign 风格: .mjs + 编译后的 CSS)
   */
  private async buildESConfig(config: UnifiedConfig, filteredInput: any, basePlugins: any[]): Promise<any> {
    const outputConfig = config.output as any
    const esConfig = typeof outputConfig.es === 'object' ? outputConfig.es : {}
    const esDir = esConfig.dir || 'es'

    // 获取样式插件 - 使用 multi 模式 (每个组件独立 CSS)
    const stylePlugins = await this.getStylePluginsByMode('multi', config, esDir)

    // 添加样式重组插件,将 CSS 文件移动到 style/ 子目录
    const styleReorganizePlugin = this.createStyleReorganizePlugin(esDir)

    return {
      input: esConfig.input ? await normalizeInput(esConfig.input, process.cwd(), config.exclude) : filteredInput,
      external: config.external,
      plugins: [...basePlugins, ...stylePlugins, ...await this.getFormatPlugins(config, esDir, true), styleReorganizePlugin],
      output: {
        dir: esDir,
        format: 'es',
        sourcemap: esConfig.sourcemap ?? outputConfig.sourcemap ?? true,
        entryFileNames: '[name].mjs',  // 使用 .mjs 扩展名
        chunkFileNames: '[name].mjs',
        assetFileNames: '[name].[ext]',
        exports: esConfig.exports ?? 'auto',
        preserveModules: esConfig.preserveStructure ?? true,
        preserveModulesRoot: 'src',
        globals: outputConfig.globals,
        name: outputConfig.name
      },
      treeshake: false,  // 保留 style/css.js
      onwarn: this.createWarningHandler(config)
    }
  }

  /**
   * 构建 ESM 配置 (TDesign 风格: .js,不包含样式)
   *
   * 注意: 根据 TDesign Vue Next 的实际产物结构,ESM 产物不包含样式文件
   */
  private async buildESMConfig(config: UnifiedConfig, filteredInput: any, basePlugins: any[]): Promise<any> {
    const outputConfig = config.output as any
    const esmConfig = typeof outputConfig.esm === 'object' ? outputConfig.esm : {}
    const esmDir = esmConfig.dir || 'esm'

    // 获取样式插件 - 使用 ignore 模式 (忽略样式)
    const stylePlugins = await this.getStylePluginsByMode('ignore', config, esmDir)

    return {
      input: esmConfig.input ? await normalizeInput(esmConfig.input, process.cwd(), config.exclude) : filteredInput,
      external: config.external,
      plugins: [...basePlugins, ...stylePlugins, ...await this.getFormatPlugins(config, esmDir, true)],
      output: {
        dir: esmDir,
        format: 'es',
        sourcemap: esmConfig.sourcemap ?? outputConfig.sourcemap ?? true,
        entryFileNames: '[name].js',  // 使用 .js 扩展名
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
        exports: esmConfig.exports ?? 'auto',
        preserveModules: esmConfig.preserveStructure ?? true,
        preserveModulesRoot: 'src',
        globals: outputConfig.globals,
        name: outputConfig.name
      },
      treeshake: config.treeshake,
      onwarn: this.createWarningHandler(config)
    }
  }

  /**
   * 构建 CJS 配置 (TDesign 风格: 忽略样式)
   */
  private async buildCJSConfig(config: UnifiedConfig, filteredInput: any, basePlugins: any[]): Promise<any> {
    const outputConfig = config.output as any
    const cjsConfig = typeof outputConfig.cjs === 'object' ? outputConfig.cjs : {}
    const cjsDir = cjsConfig.dir || 'cjs'

    // 获取样式插件 - 使用 ignore 模式 (完全忽略样式)
    const stylePlugins = await this.getStylePluginsByMode('ignore', config, cjsDir)

    return {
      input: cjsConfig.input ? await normalizeInput(cjsConfig.input, process.cwd(), config.exclude) : filteredInput,
      external: config.external,
      plugins: [...basePlugins, ...stylePlugins, ...await this.getFormatPlugins(config, cjsDir, true)],
      output: {
        dir: cjsDir,
        format: 'cjs',
        sourcemap: cjsConfig.sourcemap ?? outputConfig.sourcemap ?? true,
        entryFileNames: '[name].js',  // CJS 使用 .js 扩展名
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
        exports: cjsConfig.exports ?? 'named',
        preserveModules: cjsConfig.preserveStructure ?? true,
        preserveModulesRoot: 'src',
        globals: outputConfig.globals,
        name: outputConfig.name
      },
      treeshake: config.treeshake,
      onwarn: this.createWarningHandler(config)
    }
  }

  /**
   * 构建 UMD 配置（返回数组：常规版和压缩版）(TDesign 风格: 单个 CSS)
   */
  private async buildUMDConfig(config: UnifiedConfig, filteredInput: any, basePlugins: any[]): Promise<any[]> {
    const outputConfig = config.output as any
    const umdConfig = typeof outputConfig.umd === 'object' ? outputConfig.umd : {}

    // 检查是否禁用
    if (umdConfig.enabled === false) {
      return []
    }

    const umdDir = umdConfig.dir || 'dist'
    const umdName = umdConfig.name || outputConfig.name || 'MyLibrary'
    const fileName = umdConfig.fileName || 'index.js'

    // 确定入口文件
    let umdEntry = umdConfig.input || umdConfig.entry
    if (!umdEntry) {
      // 自动查找入口
      umdEntry = await this.findUMDEntry()
    }

    // UMD 全局变量映射
    const defaultGlobals: Record<string, string> = {
      react: 'React',
      'react-dom': 'ReactDOM',
      vue: 'Vue',
      '@angular/core': 'ngCore'
    }

    const mergedGlobals = {
      ...defaultGlobals,
      ...(outputConfig.globals || {}),
      ...(umdConfig.globals || {})
    }

    const baseConfig = {
      input: umdEntry,
      external: config.external,
      treeshake: config.treeshake,
      onwarn: this.createWarningHandler(config)
    }

    // 获取样式插件 - 使用 single 模式 (打包到单个 CSS)
    const stylePlugins = await this.getStylePluginsByMode('single', { ...config, name: umdName, minify: false }, umdDir)
    const stylePluginsMin = await this.getStylePluginsByMode('single', { ...config, name: umdName, minify: true }, umdDir)

    // 常规版本
    const regularConfig = {
      ...baseConfig,
      plugins: [...basePlugins, ...stylePlugins, ...await this.getFormatPlugins(config, umdDir, false)],
      output: {
        format: 'umd',
        name: umdName,
        file: `${umdDir}/${fileName}`,
        inlineDynamicImports: true,
        sourcemap: umdConfig.sourcemap ?? outputConfig.sourcemap ?? true,
        globals: mergedGlobals,
        exports: 'named',
        assetFileNames: '[name].[ext]'
      }
    }

    // 压缩版本
    const terserPlugin = await this.getTerserPlugin()
    const minifiedConfig = {
      ...baseConfig,
      plugins: terserPlugin
        ? [...basePlugins, ...stylePluginsMin, ...await this.getFormatPlugins(config, umdDir, false), terserPlugin]
        : [...basePlugins, ...stylePluginsMin, ...await this.getFormatPlugins(config, umdDir, false)],
      output: {
        format: 'umd',
        name: umdName,
        file: `${umdDir}/${fileName.replace(/\.js$/, '.min.js')}`,
        inlineDynamicImports: true,
        sourcemap: umdConfig.sourcemap ?? outputConfig.sourcemap ?? true,
        globals: mergedGlobals,
        exports: 'named',
        assetFileNames: '[name].[ext]'
      }
    }

    return [regularConfig, minifiedConfig]
  }

  /**
   * 构建多格式配置
   */
  private async buildMultiFormatConfigs(config: UnifiedConfig, filteredInput: any, basePlugins: any[]): Promise<any[]> {
    const configs: any[] = []
    const outputConfig = config.output as any
    const formats = outputConfig.format

    for (const format of formats) {
      if (format === 'umd' || format === 'iife') {
        const umdConfigs = await this.buildUMDConfig(config, filteredInput, basePlugins)
        configs.push(...umdConfigs)
      } else {
        const formatConfig = await this.buildFormatConfig(config, filteredInput, basePlugins, format)
        configs.push(formatConfig)
      }
    }

    return configs
  }

  /**
   * 构建单一格式配置
   */
  private async buildFormatConfig(config: UnifiedConfig, filteredInput: any, basePlugins: any[], format: string): Promise<any> {
    const outputConfig = config.output as any
    const mapped = this.formatMapper.mapFormat(format)
    const isESM = format === 'esm'
    const isCJS = format === 'cjs'
    const dir = isESM ? 'es' : isCJS ? 'lib' : 'dist'
    const entryFileNames = isESM ? '[name].js' : isCJS ? '[name].cjs' : '[name].js'

    return {
      input: filteredInput,
      external: config.external,
      plugins: [...basePlugins, ...await this.getFormatPlugins(config, dir, true)],
      output: {
        dir,
        format: mapped,
        name: outputConfig.name,
        sourcemap: outputConfig.sourcemap,
        globals: outputConfig.globals,
        entryFileNames,
        chunkFileNames: entryFileNames,
        assetFileNames: '[name].[ext]',
        exports: isESM ? 'auto' : 'named',
        preserveModules: isESM || isCJS,
        preserveModulesRoot: (isESM || isCJS) ? 'src' : undefined
      },
      treeshake: config.treeshake,
      onwarn: this.createWarningHandler(config)
    }
  }

  /**
   * 构建单一输出配置
   */
  private async buildSingleFormatConfig(config: UnifiedConfig, filteredInput: any, basePlugins: any[], rollupConfig: any): Promise<any> {
    const outputConfig = config.output as any
    const format = outputConfig?.format || 'esm'
    const mapped = this.formatMapper.mapFormat(format)
    const isESM = format === 'esm'
    const isCJS = format === 'cjs'
    const dir = outputConfig.dir || (isESM ? 'es' : isCJS ? 'lib' : 'dist')
    const entryFileNames = isESM ? '[name].js' : isCJS ? '[name].cjs' : '[name].js'

    rollupConfig.plugins = [...basePlugins, ...await this.getFormatPlugins(config, dir, true)]
    rollupConfig.output = {
      dir,
      format: mapped,
      name: outputConfig.name,
      sourcemap: outputConfig.sourcemap,
      globals: outputConfig.globals,
      entryFileNames,
      chunkFileNames: entryFileNames,
      assetFileNames: '[name].[ext]',
      exports: isESM ? 'auto' : 'named',
      preserveModules: isESM || isCJS,
      preserveModulesRoot: (isESM || isCJS) ? 'src' : undefined
    }

    if (config.treeshake !== undefined) {
      rollupConfig.treeshake = config.treeshake
    }

    return rollupConfig
  }

  /**
   * 获取基础插件
   */
  private async getBasePlugins(config: UnifiedConfig): Promise<any[]> {
    try {
      const { nodeResolve } = await import('@rollup/plugin-node-resolve')
      const commonjs = (await import('@rollup/plugin-commonjs')).default
      const json = (await import('@rollup/plugin-json')).default

      const plugins = [
        nodeResolve({
          browser: true,
          preferBuiltins: false,
          extensions: ['.mjs', '.js', '.json', '.ts', '.tsx']
        }),
        commonjs({
          include: /node_modules/,
          ignoreDynamicRequires: false
        }),
        json({
          compact: false,
          namedExports: true,
          preferConst: true,
          include: ['**/*.json'],
          exclude: ['node_modules/**']
        })
      ]

      return plugins
    } catch (error) {
      this.logger.warn('基础插件加载失败，将尝试继续构建', (error as Error).message)
      return []
    }
  }

  /**
   * 获取格式特定插件
   */
  private async getFormatPlugins(config: UnifiedConfig, outputDir: string, emitDts: boolean): Promise<any[]> {
    const plugins: any[] = []

    // 添加用户插件（已转换）
    if (config.plugins) {
      for (const plugin of config.plugins) {
        if (plugin && typeof plugin === 'object') {
          plugins.push(plugin)
        }
      }
    }

    return plugins
  }

  /**
   * 获取 Acorn 插件
   */
  private async getAcornPlugins(): Promise<any[]> {
    const plugins: any[] = []

    try {
      const jsx = (await import('acorn-jsx')).default
      plugins.push(jsx())
    } catch {
      // 忽略
    }

    try {
      const ts = (await import('acorn-typescript')).default
      plugins.push(ts())
    } catch {
      // 忽略
    }

    return plugins
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
      this.logger.warn('Terser 插件不可用，跳过压缩')
      return null
    }
  }

  /**
   * 查找 UMD 入口文件
   */
  private async findUMDEntry(): Promise<string> {
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

    for (const entry of candidates) {
      if (fs.existsSync(path.resolve(process.cwd(), entry))) {
        this.logger.info(`UMD 入口文件自动检测: ${entry}`)
        return entry
      }
    }

    return 'src/index.ts'
  }

  /**
   * 创建警告处理器
   */
  private createWarningHandler(config?: any) {
    if (config?.logLevel === 'silent') {
      return () => { }
    }

    const ignoredCodes = new Set([
      'NAMESPACE_CONFLICT',
      'MIXED_EXPORTS',
      'EMPTY_BUNDLE',
      'FILE_NAME_CONFLICT',
      'MISSING_GLOBAL_NAME',
      'UNRESOLVED_IMPORT'
    ])

    return (warning: any, defaultHandler: (w: any) => void) => {
      if (ignoredCodes.has(warning.code)) return
      if (warning.code === 'FILE_NAME_CONFLICT' && warning.message?.includes('.css.map')) return
      if (warning.code === 'UNRESOLVED_IMPORT' && warning.source?.endsWith('.vue')) return
      if (warning.code === 'UNRESOLVED_IMPORT' && warning.source?.startsWith('node:')) return
      if (warning.code === 'PLUGIN_WARNING' && warning.plugin === 'typescript') {
        const msg = String(warning.message || '')
        if (msg.includes('TS5096')) return
      }
      defaultHandler(warning)
    }
  }

  /**
   * 根据样式模式获取样式处理插件 (TDesign 风格)
   *
   * @param mode - 样式处理模式
   *   - single: 打包到单个 CSS 文件 (UMD)
   *   - multi: 每个组件独立 CSS (ES)
   *   - source: 保留 less 源文件 (ESM)
   *   - ignore: 完全忽略样式 (CJS)
   * @param config - 构建配置
   * @param outputDir - 输出目录
   */
  private async getStylePluginsByMode(
    mode: 'single' | 'multi' | 'source' | 'ignore',
    config: any,
    outputDir: string
  ): Promise<any[]> {
    const plugins: any[] = []

    switch (mode) {
      case 'single': {
        // 打包到单个 CSS 文件 (UMD)
        try {
          const postcss = await import('rollup-plugin-postcss')
          plugins.push(postcss.default({
            extract: `${config.name || 'index'}${config.minify ? '.min' : ''}.css`,
            minimize: config.minify,
            sourceMap: true,
            extensions: ['.sass', '.scss', '.css', '.less'],
          }))
        } catch (e) {
          this.logger.warn('single 样式模式需要安装: pnpm add -D rollup-plugin-postcss')
        }
        break
      }

      case 'multi': {
        // 每个组件独立 CSS (ES)
        try {
          const staticImport = await import('rollup-plugin-static-import')
          const ignoreImport = await import('rollup-plugin-ignore-import')
          const copy = await import('rollup-plugin-copy')

          plugins.push(
            staticImport.default({
              baseDir: 'src',
              include: ['**/style/css.mjs'],
            }),
            ignoreImport.default({
              include: ['**/style/*'],
              body: 'import "./style/css.mjs";',
            }),
            copy.default({
              targets: [{
                src: 'src/**/style/css.js',
                dest: outputDir,
                rename: (name: string, extension: string, fullPath: string) => {
                  const relativePath = fullPath.replace(/\\/g, '/').replace('src/', '')
                  return `${relativePath.slice(0, -6)}${name}.mjs`
                },
              }],
              verbose: false
            })
          )
        } catch (e) {
          this.logger.warn('multi 样式模式需要安装: pnpm add -D rollup-plugin-static-import rollup-plugin-ignore-import rollup-plugin-copy')
        }
        break
      }

      case 'source': {
        // 保留 less 源文件 (已废弃)
        // 根据 TDesign Vue Next 的实际产物结构,不再需要此模式
        // ESM 产物不包含样式文件,使用 ignore 模式即可
        this.logger.warn('source 样式模式已废弃,请使用 ignore 模式')
        break
      }

      case 'ignore': {
        // 完全忽略样式 (CJS)
        try {
          const ignoreImport = await import('rollup-plugin-ignore-import')
          plugins.push(
            ignoreImport.default({
              include: ['**/style/index.js', '**/*.less', '**/*.css', '**/*.scss', '**/*.sass'],
            })
          )
        } catch (e) {
          this.logger.warn('ignore 样式模式需要安装: pnpm add -D rollup-plugin-ignore-import')
        }
        break
      }
    }

    return plugins
  }

  /**
   * 创建样式文件重组插件 (TDesign 风格)
   *
   * 将组件目录下的 CSS 文件移动到 style/ 子目录,并生成 style/css.mjs 文件
   *
   * @param outputDir - 输出目录
   * @returns Rollup 插件
   */
  private createStyleReorganizePlugin(outputDir: string): any {
    return {
      name: 'style-reorganize',
      async writeBundle() {
        console.log('[style-reorganize] 插件开始执行...')
        const outputPath = path.resolve(process.cwd(), outputDir)
        console.log('[style-reorganize] 输出路径:', outputPath)

        // 遍历输出目录,找到所有 CSS 文件
        const processDirectory = async (dir: string) => {
          const entries = await fs.promises.readdir(dir, { withFileTypes: true })

          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name)

            if (entry.isDirectory()) {
              // 跳过已经是 style 目录的
              if (entry.name !== 'style') {
                await processDirectory(fullPath)
              }
            } else if (entry.isFile() && entry.name.endsWith('.css')) {
              console.log('[style-reorganize] 找到 CSS 文件:', fullPath)
              // 找到 CSS 文件,检查是否在 style/ 目录中
              const parentDir = path.dirname(fullPath)
              const parentDirName = path.basename(parentDir)

              if (parentDirName !== 'style') {
                // CSS 文件不在 style/ 目录中,需要重组
                const styleDir = path.join(parentDir, 'style')
                const newCssPath = path.join(styleDir, 'index.css')
                const cssMapPath = `${fullPath}.map`
                const newCssMapPath = `${newCssPath}.map`
                const cssMjsPath = path.join(styleDir, 'css.mjs')

                console.log('[style-reorganize] 开始重组:', fullPath)

                // 创建 style/ 目录
                await fs.promises.mkdir(styleDir, { recursive: true })

                // 移动 CSS 文件
                await fs.promises.rename(fullPath, newCssPath)

                // 移动 CSS map 文件(如果存在)
                if (fs.existsSync(cssMapPath)) {
                  await fs.promises.rename(cssMapPath, newCssMapPath)
                }

                // 生成 style/css.mjs 文件
                const cssMjsContent = `import './index.css';\n`
                await fs.promises.writeFile(cssMjsPath, cssMjsContent, 'utf-8')

                console.log(`[style-reorganize] ✓ 重组完成: ${path.relative(outputPath, fullPath)} -> ${path.relative(outputPath, newCssPath)}`)
              }
            }
          }
        }

        try {
          await processDirectory(outputPath)
          console.log('[style-reorganize] 插件执行完成')
        } catch (error) {
          console.error('[style-reorganize] 错误:', error)
        }
      }
    }
  }
}

