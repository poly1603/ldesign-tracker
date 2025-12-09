/**
 * 混合框架策略
 * 
 * 支持在同一项目中智能识别和打包Vue/React混合组件
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import type { Plugin, RollupOptions, OutputOptions } from 'rollup'
import { BuildStrategy } from '../types'
import { Logger } from '../../utils/logger'
import { FrameworkDetector, createFrameworkDetector } from '../../detectors/FrameworkDetector'
import { DualJSXTransformer, createDualJSXTransformer } from '../../transformers/DualJSXTransformer'
import { PluginOrchestrator, createPluginOrchestrator } from '../../optimizers/plugin-orchestrator/PluginOrchestrator'
import type { FrameworkInfo } from '../../detectors/FrameworkDetector'
import type { JSXTransformConfig } from '../../transformers/DualJSXTransformer'

/**
 * 混合框架配置
 */
export interface MixedFrameworkConfig {
  /** 打包模式 */
  mode: 'unified' | 'separated' | 'component' | 'custom'

  /** 框架特定配置 */
  frameworks?: {
    vue?: {
      version?: 2 | 3
      jsx?: boolean | JSXTransformConfig
      external?: string[]
    }
    react?: {
      version?: string
      jsx?: 'classic' | 'automatic' | JSXTransformConfig
      external?: string[]
    }
  }

  /** 文件分组规则 */
  groups?: {
    [groupName: string]: {
      pattern: string | RegExp | ((path: string) => boolean)
      framework: 'vue' | 'react' | 'auto'
      output?: Partial<OutputOptions>
    }
  }

  /** JSX处理策略 */
  jsx?: {
    autoDetect?: boolean
    defaultFramework?: 'vue' | 'react'
    fileAssociations?: Record<string, 'vue' | 'react'>
  }

  /** 输出配置 */
  output?: {
    preserveModules?: boolean
    preserveModulesRoot?: string
    /** 分离框架代码 */
    separateFrameworks?: boolean
    /** 按框架分目录 */
    frameworkDirs?: {
      vue?: string
      react?: string
      shared?: string
    }
  }

  /** 高级选项 */
  advanced?: {
    /** 并行检测 */
    parallelDetection?: boolean
    /** 缓存检测结果 */
    cacheDetection?: boolean
    /** 智能外部化 */
    smartExternals?: boolean
    /** 共享运行时 */
    sharedRuntime?: boolean
  }
}

/**
 * 文件框架映射
 */
interface FileFrameworkMap {
  [filePath: string]: FrameworkInfo
}

/**
 * 混合框架策略
 */
export class MixedFrameworkStrategy implements BuildStrategy {
  readonly name = 'mixed-framework'
  private logger: Logger
  private detector: FrameworkDetector
  private jsxTransformer: DualJSXTransformer
  private orchestrator: PluginOrchestrator
  private fileFrameworkMap: FileFrameworkMap = {}
  private config: MixedFrameworkConfig

  constructor(config: MixedFrameworkConfig = { mode: 'unified' }) {
    const defaultConfig: MixedFrameworkConfig = {
      mode: 'unified',
      jsx: {
        autoDetect: true,
        defaultFramework: 'react'
      },
      advanced: {
        parallelDetection: true,
        cacheDetection: true,
        smartExternals: true,
        sharedRuntime: false
      }
    }

    this.config = {
      ...defaultConfig,
      ...config,
      jsx: {
        ...defaultConfig.jsx,
        ...config.jsx
      },
      advanced: {
        ...defaultConfig.advanced,
        ...config.advanced
      }
    }

    this.logger = new Logger({ prefix: '[EnhancedMixedStrategy]' })
    this.detector = createFrameworkDetector({
      fileAssociations: this.config.jsx?.fileAssociations,
      defaultFramework: this.config.jsx?.defaultFramework,
      enableContentDetection: true,
      enableImportDetection: true,
      enablePragmaDetection: true
    })
    this.jsxTransformer = createDualJSXTransformer()
    this.orchestrator = createPluginOrchestrator({
      autoResolveConflicts: true,
      strict: false
    })
  }

  /**
   * 应用策略
   */
  async apply(options: RollupOptions): Promise<RollupOptions> {
    this.logger.info('应用增强混合策略')

    // 检测项目中的框架使用情况
    await this.detectFrameworks(options)

    // 根据模式调整配置
    switch (this.config.mode) {
      case 'unified':
        return this.applyUnifiedMode(options)
      case 'separated':
        return this.applySeparatedMode(options)
      case 'component':
        return this.applyComponentMode(options)
      case 'custom':
        return this.applyCustomMode(options)
      default:
        throw new Error(`不支持的模式: ${this.config.mode}`)
    }
  }

  /**
   * 检测框架
   */
  private async detectFrameworks(options: RollupOptions): Promise<void> {
    this.logger.debug('开始检测项目框架使用情况')

    // 获取所有源文件
    const sourceFiles = await this.getSourceFiles(options)

    if (this.config.advanced?.parallelDetection) {
      // 并行检测
      const detectionPromises = sourceFiles.map(file =>
        this.detector.detect(file).then(info => {
          this.fileFrameworkMap[file] = info
        })
      )
      await Promise.all(detectionPromises)
    } else {
      // 串行检测
      for (const file of sourceFiles) {
        this.fileFrameworkMap[file] = await this.detector.detect(file)
      }
    }

    // 统计框架使用情况
    const stats = this.getFrameworkStats()
    this.logger.info(`框架检测完成: Vue文件 ${stats.vue}个, React文件 ${stats.react}个, 未知 ${stats.unknown}个`)
  }

  /**
   * 获取框架统计
   */
  private getFrameworkStats(): { vue: number; react: number; unknown: number } {
    const stats = { vue: 0, react: 0, unknown: 0 }

    Object.values(this.fileFrameworkMap).forEach(info => {
      stats[info.type]++
    })

    return stats
  }

  /**
   * 统一模式
   */
  private async applyUnifiedMode(options: RollupOptions): Promise<RollupOptions> {
    this.logger.debug('应用统一打包模式')

    const plugins = await this.createUnifiedPlugins()

    return {
      ...options,
      plugins: [...(Array.isArray(options.plugins) ? options.plugins : []), ...plugins],
      output: this.createUnifiedOutput(options.output),
      external: this.createSmartExternals(options.external)
    }
  }

  /**
   * 分离模式
   */
  private async applySeparatedMode(options: RollupOptions): Promise<RollupOptions> {
    this.logger.debug('应用分离打包模式')

    // 创建多入口配置
    const entries = this.createSeparatedEntries()
    const plugins = await this.createSeparatedPlugins()

    return {
      ...options,
      input: entries,
      plugins: [...(Array.isArray(options.plugins) ? options.plugins : []), ...plugins],
      output: this.createSeparatedOutput(options.output),
      external: this.createSmartExternals(options.external)
    }
  }

  /**
   * 组件模式
   */
  private async applyComponentMode(options: RollupOptions): Promise<RollupOptions> {
    this.logger.debug('应用组件级打包模式')

    const plugins = await this.createComponentPlugins()

    return {
      ...options,
      plugins: [...(Array.isArray(options.plugins) ? options.plugins : []), ...plugins],
      output: {
        ...this.createComponentOutput(options.output),
        preserveModules: true,
        preserveModulesRoot: this.config.output?.preserveModulesRoot || 'src'
      },
      external: this.createSmartExternals(options.external)
    }
  }

  /**
   * 自定义模式
   */
  private async applyCustomMode(options: RollupOptions): Promise<RollupOptions> {
    this.logger.debug('应用自定义打包模式')

    if (!this.config.groups) {
      throw new Error('自定义模式需要配置groups')
    }

    // 根据分组规则创建多个构建配置
    const configs = await this.createCustomConfigs(options)

    // 返回第一个配置，其他配置通过额外的构建步骤处理
    return configs[0]
  }

  /**
   * 创建统一模式插件
   */
  private async createUnifiedPlugins(): Promise<Plugin[]> {
    const plugins: Plugin[] = []

    // 检测项目中实际使用的框架
    const stats = this.getFrameworkStats()

    this.logger.debug(`框架使用统计: Vue=${stats.vue}, React=${stats.react}, Unknown=${stats.unknown}`)

    // 只为实际使用的框架加载插件
    // 1. Vue JSX 插件（必须在 Vue SFC 插件之前）
    if (stats.vue > 0) {
      try {
        const { default: VueJsx } = await import('unplugin-vue-jsx/rollup')
        plugins.push(VueJsx({
          version: 3, // Vue 3
          optimize: true
        }) as any)
        this.logger.debug('已加载 Vue JSX 插件')
      } catch (e) {
        this.logger.debug('Vue JSX 插件不可用，跳过 JSX/TSX 支持')
      }

      // 2. Vue SFC 插件
      try {
        // 注册 TypeScript 支持以解决 "No fs option provided to compileScript" 错误
        try {
          const { registerTS } = await import('@vue/compiler-sfc')
          const typescript = await import('typescript')
          registerTS(() => typescript.default)
          this.logger.debug('已注册 TypeScript 支持')
        } catch (tsError) {
          this.logger.debug('TypeScript 注册失败，继续使用默认配置')
        }

        const { default: vue } = await import('rollup-plugin-vue')
        // 使用类型断言，因为 rollup-plugin-vue 类型定义可能不完整
        plugins.push(vue({
          compileTemplate: true,
          preprocessStyles: true,
          include: /\.vue$/,
          // Vue 插件内部处理样式
          css: true
        } as any) as any)

        this.logger.debug('已加载 Vue SFC 插件')
      } catch (e) {
        this.logger.debug('Vue SFC 插件加载失败:', e)
      }
    }

    // 2. 样式处理插件 - 优先使用 rollup-plugin-styles（更好的 Vue SFC 支持）
    try {
      const Styles = await import('rollup-plugin-styles')
      plugins.push(Styles.default({
        mode: 'extract',
        modules: false,
        minimize: true,
        namedExports: true,
        include: [
          '**/*.less',
          '**/*.css',
          '**/*.scss',
          '**/*.sass'
        ],
        url: {
          inline: false,
        }
      }) as any)
      this.logger.debug('已加载 rollup-plugin-styles 插件')
    } catch (e) {
      // 回退到 rollup-plugin-postcss
      try {
        const { default: postcss } = await import('rollup-plugin-postcss')
        plugins.push(postcss({
          extract: true,
          inject: false,
          minimize: true,
          modules: false,
          // 包含 Vue 样式块
          include: [
            /\.(css|less|scss|sass)$/,
            /\?vue&type=style/
          ],
          use: ['less']
        }) as any)
        this.logger.debug('已加载 PostCSS 插件（回退）')
      } catch (e2) {
        this.logger.debug('样式插件加载失败:', e2)
      }
    }

    // 3. Node Resolve（解析依赖）
    const { default: nodeResolve } = await import('@rollup/plugin-node-resolve')
    plugins.push(nodeResolve({
      preferBuiltins: true,
      extensions: ['.js', '.ts', '.tsx', '.jsx', '.vue', '.json']
    }) as any)

    // 4. CommonJS 支持
    const { default: commonjs } = await import('@rollup/plugin-commonjs')
    plugins.push(commonjs({
      include: /node_modules/,
      sourceMap: false
    }) as any)

    // 5. esbuild 插件（更快，更简单，无 outDir 问题）
    try {
      const { default: esbuild } = await import('rollup-plugin-esbuild')
      plugins.push(esbuild({
        include: /\.[jt]sx?$/,
        exclude: /node_modules/,
        sourceMap: true,
        minify: false,
        target: 'es2020',
        jsx: 'preserve', // 保留 JSX
        tsconfig: './tsconfig.json',
        loaders: {
          '.vue': 'ts'
        }
      }) as any)
    } catch (e) {
      // 如果 esbuild 不可用，fallback 到 TypeScript
      this.logger.warn('esbuild 插件不可用，使用 TypeScript 插件')
      const { default: typescript } = await import('@rollup/plugin-typescript')
      plugins.push(typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        sourceMap: true
      }) as any)
    }

    // 6. JSON 支持
    const { default: json } = await import('@rollup/plugin-json')
    plugins.push(json() as any)

    // JSX转换插件
    const jsxPlugin: any = {
      name: 'enhanced-mixed-jsx',
      enforce: 'pre',

      transform: async (code: string, id: string) => {
        if (!id.match(/\.[jt]sx?$/)) return null

        const framework = this.fileFrameworkMap[id]
        if (!framework || framework.type === 'unknown') return null

        const result = await this.jsxTransformer.transform(code, framework.type)
        return {
          code: result.code,
          map: result.map
        }
      }
    }

    plugins.push(jsxPlugin)

    // 框架检测插件
    plugins.push({
      name: 'framework-detector',

      buildStart: async () => {
        // 可以在这里输出框架使用报告
        const stats = this.getFrameworkStats()
        this.logger.info(`项目框架分析: ${JSON.stringify(stats)}`)
      }
    })

    return plugins
  }

  /**
   * 创建分离模式插件
   */
  private async createSeparatedPlugins(): Promise<Plugin[]> {
    const plugins: Plugin[] = []

    // 路径重写插件
    plugins.push({
      name: 'separated-path-rewriter',

      resolveId: (source: string, importer?: string) => {
        if (!importer) return null

        const importerFramework = this.fileFrameworkMap[importer]
        if (!importerFramework) return null

        // 重写跨框架导入
        if (source.startsWith('./') || source.startsWith('../')) {
          const resolved = this.resolveFrameworkPath(source, importer, importerFramework)
          if (resolved !== source) {
            return { id: resolved, external: false }
          }
        }

        return null
      }
    })

    // 添加统一模式的插件
    plugins.push(...await this.createUnifiedPlugins())

    return plugins
  }

  /**
   * 创建组件模式插件
   */
  private async createComponentPlugins(): Promise<Plugin[]> {
    const plugins = await this.createUnifiedPlugins()

    // 组件边界标记插件
    plugins.push({
      name: 'component-boundary-marker',

      transform: (code: string, id: string) => {
        const framework = this.fileFrameworkMap[id]
        if (!framework || framework.type === 'unknown') return null

        // 在组件代码中注入框架标记
        const marker = `\n/* __FRAMEWORK__: ${framework.type} */\n`
        return {
          code: marker + code,
          map: null
        }
      }
    })

    return plugins
  }

  /**
   * 创建自定义配置
   */
  private async createCustomConfigs(baseOptions: RollupOptions): Promise<RollupOptions[]> {
    const configs: RollupOptions[] = []

    for (const [groupName, group] of Object.entries(this.config.groups!)) {
      const groupFiles = this.filterFilesByGroup(group)

      if (groupFiles.length === 0) {
        this.logger.warn(`分组 ${groupName} 没有匹配的文件`)
        continue
      }

      const config: RollupOptions = {
        ...baseOptions,
        input: groupFiles.reduce((acc, file) => {
          acc[file] = file
          return acc
        }, {} as Record<string, string>),
        output: {
          ...baseOptions.output,
          ...group.output,
          dir: group.output?.dir || `dist/${groupName}`
        },
        plugins: await this.createGroupPlugins(group, groupFiles)
      }

      configs.push(config)
    }

    return configs
  }

  /**
   * 创建分组插件
   */
  private async createGroupPlugins(
    group: any,
    files: string[]
  ): Promise<Plugin[]> {
    const framework = group.framework === 'auto'
      ? this.detectDominantFramework(files)
      : group.framework

    // 根据框架类型选择合适的插件
    return this.orchestrator.orchestrate(
      await this.createUnifiedPlugins(),
      files[0], // 使用第一个文件作为参考
      { type: framework, confidence: 1 }
    )
  }

  /**
   * 检测主导框架
   */
  private detectDominantFramework(files: string[]): 'vue' | 'react' {
    const counts = { vue: 0, react: 0 }

    files.forEach(file => {
      const framework = this.fileFrameworkMap[file]
      if (framework && framework.type !== 'unknown') {
        counts[framework.type]++
      }
    })

    return counts.vue > counts.react ? 'vue' : 'react'
  }

  /**
   * 过滤文件
   */
  private filterFilesByGroup(
    group: any
  ): string[] {
    return Object.keys(this.fileFrameworkMap).filter(file => {
      if (typeof group.pattern === 'function') {
        return group.pattern(file)
      } else if (group.pattern instanceof RegExp) {
        return group.pattern.test(file)
      } else {
        return file.includes(group.pattern)
      }
    })
  }

  /**
   * 创建分离入口
   */
  private createSeparatedEntries(): Record<string, string> {
    const entries: Record<string, string> = {}

    // Vue入口
    const vueFiles = Object.entries(this.fileFrameworkMap)
      .filter(([_, info]) => info.type === 'vue')
      .map(([file]) => file)

    if (vueFiles.length > 0) {
      entries['vue/index'] = this.createVirtualEntry(vueFiles, 'vue')
    }

    // React入口
    const reactFiles = Object.entries(this.fileFrameworkMap)
      .filter(([_, info]) => info.type === 'react')
      .map(([file]) => file)

    if (reactFiles.length > 0) {
      entries['react/index'] = this.createVirtualEntry(reactFiles, 'react')
    }

    return entries
  }

  /**
   * 创建虚拟入口
   */
  private createVirtualEntry(files: string[], framework: string): string {
    // 这里应该创建一个虚拟模块，暂时返回第一个文件
    return files[0]
  }

  /**
   * 创建统一输出配置
   */
  private createUnifiedOutput(
    baseOutput?: OutputOptions | OutputOptions[]
  ): OutputOptions | OutputOptions[] {
    // 如果是数组格式，保留所有输出配置
    if (Array.isArray(baseOutput) && baseOutput.length > 0) {
      return baseOutput.map(output => ({
        ...output,
        dir: output.dir || 'dist',
        format: output.format || 'es',
        chunkFileNames: output.chunkFileNames || '[name]-[hash].js',
        manualChunks: this.createManualChunks.bind(this)
      }))
    }

    const output = (baseOutput || {}) as OutputOptions
    return {
      ...output,
      dir: output.dir || 'dist',
      format: output.format || 'es',
      chunkFileNames: '[name]-[hash].js',
      manualChunks: this.createManualChunks.bind(this)
    }
  }

  /**
   * 创建分离输出配置
   */
  private createSeparatedOutput(
    baseOutput?: OutputOptions | OutputOptions[]
  ): OutputOptions | OutputOptions[] {
    const dirs = this.config.output?.frameworkDirs || {
      vue: 'vue',
      react: 'react',
      shared: 'shared'
    }

    // 如果是数组格式，保留所有输出配置
    if (Array.isArray(baseOutput) && baseOutput.length > 0) {
      return baseOutput.map(output => ({
        ...output,
        dir: output.dir || 'dist',
        format: output.format || 'es',
        chunkFileNames: (chunkInfo: any) => {
          const framework = this.getChunkFramework(chunkInfo)
          const dir = dirs[framework] || dirs.shared || 'shared'
          return `${dir}/[name]-[hash].js`
        },
        manualChunks: this.createSeparatedManualChunks.bind(this)
      }))
    }

    const output = (baseOutput || {}) as OutputOptions
    return {
      ...output,
      dir: output.dir || 'dist',
      format: output.format || 'es',
      chunkFileNames: (chunkInfo) => {
        const framework = this.getChunkFramework(chunkInfo)
        const dir = dirs[framework] || dirs.shared || 'shared'
        return `${dir}/[name]-[hash].js`
      },
      manualChunks: this.createSeparatedManualChunks.bind(this)
    }
  }

  /**
   * 创建组件输出配置
   */
  private createComponentOutput(
    baseOutput?: OutputOptions | OutputOptions[]
  ): OutputOptions | OutputOptions[] {
    // 如果是数组格式，保留所有输出配置
    if (Array.isArray(baseOutput) && baseOutput.length > 0) {
      return baseOutput.map(output => ({
        ...output,
        dir: output.dir || 'dist',
        format: output.format || 'es',
        entryFileNames: output.entryFileNames || '[name].js',
        chunkFileNames: output.chunkFileNames || 'chunks/[name]-[hash].js'
      }))
    }

    const output = (baseOutput || {}) as OutputOptions
    return {
      ...output,
      dir: output.dir || 'dist',
      format: output.format || 'es',
      entryFileNames: '[name].js',
      chunkFileNames: 'chunks/[name]-[hash].js'
    }
  }

  /**
   * 创建手动分块
   */
  private createManualChunks(id: string): string | undefined {
    const framework = this.fileFrameworkMap[id]

    if (!framework || framework.type === 'unknown') {
      return 'vendor'
    }

    // 根据框架类型分块
    if (id.includes('node_modules')) {
      return `vendor-${framework.type}`
    }

    return undefined
  }

  /**
   * 创建分离模式手动分块
   */
  private createSeparatedManualChunks(id: string): string | undefined {
    const framework = this.fileFrameworkMap[id]

    if (!framework || framework.type === 'unknown') {
      return 'shared/vendor'
    }

    // 更细粒度的分块
    if (id.includes('node_modules')) {
      if (id.includes('@vue') || id.includes('vue')) {
        return 'vue/vendor'
      }
      if (id.includes('react')) {
        return 'react/vendor'
      }
      return 'shared/vendor'
    }

    return undefined
  }

  /**
   * 创建智能外部化
   */
  private createSmartExternals(
    baseExternal?: RollupOptions['external']
  ): RollupOptions['external'] {
    if (!this.config.advanced?.smartExternals) {
      return baseExternal
    }

    const stats = this.getFrameworkStats()
    const externals: string[] = []

    // 根据使用情况决定外部化
    if (stats.vue === 0) {
      externals.push('vue', '@vue/*')
    }
    if (stats.react === 0) {
      externals.push('react', 'react-dom', 'react/*')
    }

    // 合并用户配置的外部化
    if (Array.isArray(baseExternal)) {
      externals.push(...baseExternal.filter(e => typeof e === 'string'))
    } else if (typeof baseExternal === 'function') {
      return (source, importer, isResolved) => {
        if (externals.includes(source)) return true
        return baseExternal(source, importer, isResolved)
      }
    }

    return externals
  }

  /**
   * 获取源文件
   */
  private async getSourceFiles(options: RollupOptions): Promise<string[]> {
    try {
      const fastGlob = await import('fast-glob')
      const glob = (fastGlob as any).default || fastGlob

      // 从 options.input 推断项目根目录
      let cwd = process.cwd()
      if (typeof options.input === 'string') {
        const path = await import('path')
        cwd = path.default.dirname(path.default.resolve(options.input))
        // 如果入口在 src 目录，取父目录
        if (cwd.endsWith('src') || cwd.includes('/src/') || cwd.includes('\\src\\')) {
          cwd = path.default.dirname(cwd)
        }
      }

      // 搜索所有可能的源文件
      const files = await glob.async([
        'src/**/*.vue',
        'src/**/*.tsx',
        'src/**/*.jsx',
        'src/**/*.ts',
        'src/**/*.js',
        'src/**/*.svelte',
        'lib/**/*.vue',
        'lib/**/*.tsx',
        'lib/**/*.jsx',
        'components/**/*.vue',
        'components/**/*.tsx'
      ], {
        cwd,
        absolute: true,
        ignore: ['node_modules/**', 'dist/**', 'es/**', 'lib/**', 'esm/**', '**/*.d.ts', '**/*.test.*', '**/*.spec.*']
      })

      this.logger.debug(`找到 ${files.length} 个源文件`)
      return files
    } catch (error) {
      this.logger.warn('获取源文件失败:', error)
      return []
    }
  }

  /**
   * 解析框架路径
   */
  private resolveFrameworkPath(
    source: string,
    importer: string,
    framework: FrameworkInfo
  ): string {
    // 处理跨框架导入的路径重写
    return source
  }

  /**
   * 获取chunk框架
   */
  private getChunkFramework(chunkInfo: any): 'vue' | 'react' | 'shared' {
    // 分析chunk包含的模块，确定主要框架
    const moduleIds = Object.keys(chunkInfo.modules || {})
    const frameworks = moduleIds.map(id => this.fileFrameworkMap[id]?.type).filter(Boolean)

    const counts = { vue: 0, react: 0 }
    frameworks.forEach(f => {
      if (f === 'vue') counts.vue++
      if (f === 'react') counts.react++
    })

    if (counts.vue > counts.react) return 'vue'
    if (counts.react > counts.vue) return 'react'
    return 'shared'
  }

  /**
   * 验证配置
   */
  validate(): boolean {
    return true
  }

  /**
   * 清理
   */
  cleanup(): void {
    this.detector.clearCache()
    this.orchestrator.cleanup()
    this.fileFrameworkMap = {}
  }
}

/**
 * 创建混合框架策略
 */
export function createMixedFrameworkStrategy(config?: MixedFrameworkConfig): MixedFrameworkStrategy {
  return new MixedFrameworkStrategy(config)
}
