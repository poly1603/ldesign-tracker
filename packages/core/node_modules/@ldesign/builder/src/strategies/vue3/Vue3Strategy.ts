/**
 * Vue 3 组件库构建策略
 *
 * 为 Vue 3 组件库提供完整的构建策略，包括：
 * - Vue SFC 单文件组件编译
 * - TypeScript 支持
 * - 样式提取和处理
 * - 组件类型定义生成
 * - 插件式安装支持
 *
 * @author LDesign Team
 * @version 1.0.0
 */

import type { ILibraryStrategy } from '../../types/strategy'
import { LibraryType } from '../../types/library'
import type { BuilderConfig } from '../../types/config'
import type { UnifiedConfig } from '../../types/adapter'
import { BaseStrategy } from '../base/BaseStrategy'
import { Vue3PluginBuilder } from './Vue3PluginBuilder'
import { Vue3ConfigBuilder } from './Vue3ConfigBuilder'
import { Vue3DtsGenerator } from './Vue3DtsGenerator'
import { vueStyleEntryGenerator } from '../../plugins/vue-style-entry-generator'

/**
 * Vue 3 组件库构建策略
 */
export class Vue3Strategy extends BaseStrategy implements ILibraryStrategy {
  readonly name = 'vue3'
  readonly supportedTypes: LibraryType[] = [LibraryType.VUE3]
  readonly priority = 10

  // 模块化组件
  private pluginBuilder: Vue3PluginBuilder
  private configBuilder: Vue3ConfigBuilder
  private dtsGenerator: Vue3DtsGenerator

  constructor() {
    super()
    this.pluginBuilder = new Vue3PluginBuilder()
    this.configBuilder = new Vue3ConfigBuilder()
    this.dtsGenerator = new Vue3DtsGenerator()
  }

  /**
   * 获取 Vue 3 框架的全局变量映射
   */
  protected override getFrameworkGlobals(): Record<string, string> {
    return {
      vue: 'Vue'
    }
  }

  /**
   * 应用 Vue 3 策略
   */
  override async applyStrategy(config: BuilderConfig): Promise<UnifiedConfig> {
    // 解析入口配置
    const resolvedInput = await this.resolveInputEntriesEnhanced(config)

    // 使用模块化构建器
    const dtsCopyPlugin = this.dtsGenerator.createDtsCopyPlugin(config)

    const unifiedConfig: UnifiedConfig = {
      input: resolvedInput,
      output: this.configBuilder.buildOutputConfig(config),
      plugins: await this.pluginBuilder.buildPlugins(config, dtsCopyPlugin),
      external: this.configBuilder.buildExternals(config),
      treeshake: config.performance?.treeshaking !== false,
      onwarn: this.createWarningHandler()
    }

    return unifiedConfig
  }

  /**
   * 检查策略是否适用
   */
  override isApplicable(config: BuilderConfig): boolean {
    return config.libraryType === LibraryType.VUE3
  }

  /**
   * 获取默认配置
   */
  override getDefaultConfig(): Partial<BuilderConfig> {
    return {
      libraryType: LibraryType.VUE3,
      output: {
        format: ['esm', 'cjs'],
        sourcemap: true
      },
      vue: {
        version: 3,
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
        target: 'ES2020',
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
  override getRecommendedPlugins(config: BuilderConfig): any[] {
    const plugins = []

    // Vue SFC 插件
    plugins.push({
      name: 'rollup-plugin-vue',
      options: this.getVueOptions(config)
    })

    // 注意:不使用 @rollup/plugin-typescript,因为它会读取 tsconfig.json 并验证 compiler options
    // 这会导致与根 tsconfig.json 的冲突(composite, incremental, noEmit 等)
    // 改用 esbuild 来处理 TypeScript,类型声明由单独的 DTS 插件生成

    // Node 解析插件
    plugins.push({
      name: '@rollup/plugin-node-resolve',
      options: {
        preferBuiltins: false,
        browser: true
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

    // DTS 文件复制插件（如果存在 types 目录）
    if (config.dts !== false) {
      plugins.push(this.createDtsCopyPlugin(config))
    }

    // 代码压缩插件（生产模式）
    if (this.shouldMinify(config)) {
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
  override validateConfig(config: BuilderConfig): any {
    const errors: string[] = []
    const warnings: string[] = []
    const suggestions: string[] = []

    // 检查入口文件
    if (!config.input) {
      errors.push('Vue 3 策略需要指定入口文件')
    }

    // 检查 Vue 版本
    if (config.vue?.version && config.vue.version !== 3) {
      warnings.push('当前策略针对 Vue 3 优化，建议使用 Vue 3')
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
   * 构建插件配置
   */
  private async buildPlugins(config: BuilderConfig): Promise<any[]> {
    const plugins: any[] = []

    try {
      // Vue TSX/JSX 支持（必须在 Vue SFC 插件之前）
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

      // Vue SFC 插件（使用 rollup-plugin-vue，更稳定）
      const VuePlugin = await import('rollup-plugin-vue')

      // 注册 TypeScript 支持以解决 "No fs option provided to compileScript" 错误
      try {
        const { registerTS } = await import('@vue/compiler-sfc')
        const typescript = await import('typescript')
        registerTS(() => typescript.default)
      } catch (error) {
        // 如果无法导入 TypeScript 或 @vue/compiler-sfc，继续执行
        console.warn('Failed to register TypeScript support for Vue SFC:', error)
      }

      plugins.push(VuePlugin.default({
        preprocessStyles: true,
        // 只处理 .vue 文件
        include: /\.vue$/,
        ...this.getVueOptions(config)
      }))

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

      // 注意:不使用 @rollup/plugin-typescript 生成声明文件,因为它会读取 tsconfig.json 并验证 compiler options
      // 这会导致与根 tsconfig.json 的冲突(composite, incremental, noEmit 等)
      // 改用 rollup-plugin-dts 或其他方式生成类型声明

      // esbuild 插件处理 TypeScript 和 JSX（保留 JSX 语法）
      const { default: esbuild } = await import('rollup-plugin-esbuild')
      plugins.push(esbuild({
        include: /\.(ts|tsx|js|jsx)$/,
        exclude: [/node_modules/],
        target: 'es2020',
        // 保留 JSX/TSX 以便后续由 Vue JSX 插件处理
        jsx: 'preserve',
        tsconfig: 'tsconfig.json',
        minify: this.shouldMinify(config),
        sourceMap: config.output?.sourcemap !== false
      }))

      // JSON 插件
      const json = await import('@rollup/plugin-json')
      plugins.push(json.default())

      // 样式处理插件（使用 rollup-plugin-styles，更好的 Vue SFC 支持）
      try {
        const Styles = await import('rollup-plugin-styles')
        plugins.push(Styles.default({
          mode: 'extract',
          modules: false,
          minimize: this.shouldMinify(config),
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
        // 如果 rollup-plugin-styles 不可用，回退到 postcss
        const postcss = await import('rollup-plugin-postcss')
        plugins.push(postcss.default({
          ...this.getPostCSSOptions(config),
          include: [
            /\.(css|less|scss|sass)$/,
            /\?vue&type=style/
          ]
        }))
      }
    } catch (error) {
      console.error('插件加载失败:', error)
    }

    // 添加 DTS 复制插件
    plugins.push(this.createDtsCopyPlugin(config))

    // 添加 Vue 样式入口生成器插件
    plugins.push(vueStyleEntryGenerator({
      enabled: true,
      outputDirs: ['cjs', 'esm', 'es'],
      cssPattern: 'index.css',
      generateDts: true,
      verbose: config.logLevel !== 'silent',
    }))

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
      // 如果是函数，直接返回
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
   * 获取 Vue 选项
   */
  private getVueOptions(config: BuilderConfig): any {
    const vueConfig = config.vue || {}

    return {
      include: /\.vue$/,
      exclude: /node_modules/,
      // 模板编译选项
      template: {
        compilerOptions: {
          isCustomElement: (tag: string) => tag.startsWith('ld-') || tag.startsWith('template-'),
          // 启用生产优化
          hoistStatic: config.mode === 'production',
          cacheHandlers: config.mode === 'production',
        },
        ...vueConfig.template
      },
      // 脚本处理选项
      script: {
        // 启用 defineModel 宏
        defineModel: true,
        // 启用 props 解构
        propsDestructure: true,
        ...vueConfig.script
      },
      // 样式处理选项
      style: {
        // 启用 CSS 模块
        modules: vueConfig.cssModules !== false,
        ...vueConfig.style
      },
      // 传递其他用户配置
      ...vueConfig
    }
  }

  /**
   * 获取 TypeScript 选项
   */
  private getTypeScriptOptions(config: BuilderConfig): any {
    const tsConfig = config.typescript || {}
    const compilerOptions = tsConfig.compilerOptions || {}

    // 检查多个位置的 declaration 配置
    const declarationEnabled = tsConfig.declaration === true ||
      compilerOptions.declaration === true ||
      (config as any).dts === true

    return {
      target: tsConfig.target || compilerOptions.target || 'ES2020',
      module: tsConfig.module || compilerOptions.module || 'ESNext',
      declaration: declarationEnabled,
      // declarationDir 将由 RollupAdapter 动态设置
      declarationDir: tsConfig.declarationDir || compilerOptions.declarationDir,
      declarationMap: tsConfig.declarationMap === true || compilerOptions.declarationMap === true,
      removeComments: compilerOptions.removeComments,
      strict: tsConfig.strict !== false && compilerOptions.strict !== false,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      skipLibCheck: tsConfig.skipLibCheck !== false && compilerOptions.skipLibCheck !== false,
      moduleResolution: 'node',
      resolveJsonModule: true,
      // JSX 配置
      jsx: 'preserve',
      jsxImportSource: 'vue',
      // Vue 相关类型
      types: ['vue', '@vue/runtime-core', ...(tsConfig.types || [])],
      // 路径映射
      paths: {
        '@/*': ['src/*'],
        ...tsConfig.paths
      },
      ...tsConfig
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
      // 支持 less/scss 等预处理器
      use: ['less'],
      extensions: ['.css', '.less', '.scss', '.sass']
    }
  }

  /**
   * 获取 rollup-plugin-styles 选项
   */
  private getStylesOptions(config: BuilderConfig): any {
    return {
      // 样式提取配置
      extract: config.style?.extract !== false,
      minimize: this.shouldMinify(config),
      sourceMap: config.output?.sourcemap !== false,
      modules: config.style?.modules || false,
      // 支持的文件扩展名
      extensions: ['.css', '.less', '.scss', '.sass'],
      // 预处理器配置
      less: {
        javascriptEnabled: true
      },
      scss: {
        includePaths: ['node_modules']
      }
    }
  }

  /**
   * 创建 DTS 文件生成插件
   */
  private createDtsCopyPlugin(config?: BuilderConfig): any {
    return {
      name: 'generate-dts-files',
      writeBundle: async (options: any) => {
        // 检查是否为 silent 模式，如果是则不输出调试信息
        const isSilent = config?.logLevel === 'silent'

        if (!isSilent) {

        }

        try {
          const outputDir = options.dir
          if (!outputDir) {
            if (!isSilent) {

            }
            return
          }

          if (!isSilent) {

          }
          await this.generateDtsFiles(outputDir, config)

        } catch (error) {
          if (!isSilent) {
            console.warn('⚠️ 处理 DTS 文件失败:', error instanceof Error ? error.message : String(error))
          }
        }
      }
    }
  }

  /**
   * 使用 TypeScript 编译器生成 DTS 文件
   */
  private async generateDtsFiles(outputDir: string, config?: BuilderConfig): Promise<void> {
    const isSilent = config?.logLevel === 'silent'

    try {
      const fs = await import('fs')
      const path = await import('path')

      // 尝试导入 TypeScript
      let ts: any
      try {
        ts = await import('typescript')
      } catch (error) {
        if (!isSilent) {
          console.warn('⚠️ 无法导入 TypeScript，跳过 DTS 生成')
        }
        return
      }

      const rootDir = process.cwd()
      const srcDir = path.join(rootDir, 'src')
      const tsconfigPath = path.join(rootDir, 'tsconfig.json')

      // 检查 src 目录和 tsconfig.json 是否存在
      if (!fs.existsSync(srcDir)) {
        if (!isSilent) {

        }
        return
      }

      // 读取和解析 tsconfig.json
      let parsedConfig: any
      if (fs.existsSync(tsconfigPath)) {
        const tsconfigContent = fs.readFileSync(tsconfigPath, 'utf-8')
        const configFile = ts.parseConfigFileTextToJson(tsconfigPath, tsconfigContent)

        if (configFile.error) {
          if (!isSilent) {
            console.warn('⚠️ 解析 tsconfig.json 失败:', configFile.error.messageText)
          }
          parsedConfig = { compilerOptions: {} }
        } else {
          parsedConfig = ts.parseJsonConfigFileContent(
            configFile.config,
            ts.sys,
            path.dirname(tsconfigPath)
          )
        }
      } else {
        if (!isSilent) {

        }
        parsedConfig = {
          options: {},
          fileNames: [],
          errors: []
        }
      }

      // 获取所有 TypeScript 文件
      const glob = await import('glob')
      const tsFiles = await glob.glob('**/*.{ts,tsx}', {
        cwd: srcDir,
        absolute: true,
        ignore: ['**/*.test.ts', '**/*.spec.ts', '**/__tests__/**', '**/*.d.ts']
      })

      if (tsFiles.length === 0) {
        if (!isSilent) {

        }
        return
      }

      if (!isSilent) {

      }

      // 创建编译选项
      const compilerOptions: any = {
        ...parsedConfig.options,
        declaration: true,
        emitDeclarationOnly: true,
        outDir: outputDir,
        rootDir: srcDir,
        skipLibCheck: true,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.ESNext,
        jsx: ts.JsxEmit.ReactJSX,
        allowSyntheticDefaultImports: true,
        esModuleInterop: true,
        strict: false,
        noEmitOnError: false
      }

      // 创建编译器主机
      const host = ts.createCompilerHost(compilerOptions)

      // 创建 TypeScript 程序
      const program = ts.createProgram(tsFiles, compilerOptions, host)

      // 生成声明文件
      const emitResult = program.emit(undefined, undefined, undefined, true)

      // 检查编译错误
      const allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics)

      if (allDiagnostics.length > 0 && !isSilent) {
        console.warn('⚠️ TypeScript 编译警告:')
        allDiagnostics.forEach((diagnostic: any) => {
          if (diagnostic.file) {
            const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start!)
            const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
            console.warn(`  ${path.relative(rootDir, diagnostic.file.fileName)} (${line + 1},${character + 1}): ${message}`)
          } else {
            console.warn(`  ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`)
          }
        })
      }

      if (emitResult.emitSkipped) {
        if (!isSilent) {
          console.warn('⚠️ TypeScript 声明文件生成失败')
        }
      } else {
        // 统计生成的 .d.ts 文件数量
        const generatedDtsFiles = await glob.glob('**/*.d.ts', {
          cwd: outputDir,
          absolute: false
        })
        if (!isSilent) {

        }
      }

    } catch (error) {
      if (!isSilent) {
        console.warn('⚠️ 生成 TypeScript 声明文件失败:', error instanceof Error ? error.message : String(error))
      }
    }
  }

  /**
   * 创建警告处理器
   */
  protected override createWarningHandler() {
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
   * 获取默认入口文件
   */
  protected override getDefaultEntry(): string {
    return 'src/index.ts'
  }

  /**
   * 获取默认扫描模式
   */
  protected override getDefaultPatterns(): string[] {
    return ['src/**/*.{ts,tsx,js,jsx,vue,json}']
  }
}
