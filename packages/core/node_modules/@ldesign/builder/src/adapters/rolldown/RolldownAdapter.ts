/**
 * Rolldown 适配器
 * 
 * 提供 Rolldown 打包器的适配实现
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import type {
  IBundlerAdapter,
  UnifiedConfig,
  AdapterOptions,
  BundlerSpecificConfig,
  BundlerSpecificPlugin
} from '../../types/adapter'
import type { BuildResult, BuildWatcher } from '../../types/builder'
import type { PerformanceMetrics } from '../../types/performance'
import { Logger } from '../../utils/logger'
import { BuilderError } from '../../utils/error-handler'
import { ErrorCode } from '../../constants/errors'

/**
 * Rolldown 适配器类
 */
export class RolldownAdapter implements IBundlerAdapter {
  readonly name = 'rolldown' as const
  readonly version: string
  readonly available: boolean

  private logger: Logger

  constructor(options: Partial<AdapterOptions> = {}) {
    this.logger = options.logger || new Logger()

    // 在 ES 模块环境中，我们无法在构造函数中同步加载 rolldown
    // 所以我们假设它是可用的，并在实际使用时进行检查
    try {
      const rolldown = this.loadRolldown()
      this.version = rolldown.VERSION || 'unknown'
      this.available = true
      this.logger.debug(`Rolldown 适配器初始化成功 (v${this.version})`)
    } catch (error) {
      // 同步加载失败，但这在 ES 模块环境中是预期的
      // 我们将在实际使用时尝试异步加载
      this.version = 'unknown'
      this.available = true // 假设可用，在使用时验证
      this.logger.debug('Rolldown 同步加载失败，将在使用时异步加载')
    }
  }

  /**
   * 执行构建
   */
  async build(config: UnifiedConfig): Promise<BuildResult> {
    if (!this.available) {
      throw new BuilderError(
        ErrorCode.ADAPTER_NOT_AVAILABLE,
        'Rolldown 适配器不可用'
      )
    }

    try {
      // 尝试加载 rolldown，支持异步加载
      const rolldown = await this.ensureRolldownLoaded()

      this.logger.info('开始 Rolldown 构建...')
      const startTime = Date.now()

      // 检查是否需要多格式构建
      const outputConfig = config.output
      // 处理 output 可能是数组的情况
      const singleOutput = Array.isArray(outputConfig) ? outputConfig[0] : outputConfig
      const formats = Array.isArray(singleOutput?.format) ? singleOutput.format : [singleOutput?.format || 'esm']

      // Rolldown 目前主要支持 ESM，但我们可以尝试构建多个格式
      const supportedFormats = formats.filter(format => ['esm', 'cjs'].includes(format))
      if (supportedFormats.length === 0) {
        supportedFormats.push('esm') // 默认使用 ESM
      }

      const allResults: any[] = []
      let totalDuration = 0

      // 为每个支持的格式执行构建
      for (const format of supportedFormats) {
        this.logger.info(`构建 ${format.toUpperCase()} 格式...`)

        // 为当前格式创建配置
        const formatConfig = {
          ...config,
          output: {
            ...outputConfig,
            format: format
          }
        }

        const rolldownConfig = await this.transformConfig(formatConfig)
        const formatStartTime = Date.now()

        try {
          // 使用 rolldown() + write() 确保文件被写入磁盘
          const bundle = await rolldown.rolldown(rolldownConfig)
          const writeResult = await bundle.write(rolldownConfig.output)

          const formatDuration = Date.now() - formatStartTime
          totalDuration += formatDuration

          allResults.push({
            format,
            result: writeResult,
            duration: formatDuration
          })

          this.logger.info(`${format.toUpperCase()} 格式构建完成 (${formatDuration}ms)`)
        } catch (error) {
          this.logger.warn(`${format.toUpperCase()} 格式构建失败: ${(error as Error).message}`)
          // 继续构建其他格式
        }
      }

      const duration = Date.now() - startTime

      // 合并所有构建结果
      // 注意：rolldown.build() 返回 { output: [...] } 而不是 { outputs: [...] }
      const combinedOutputs = allResults.flatMap(r => {
        const outputs = r.result.output || r.result.outputs || []
        // 转换 rolldown 输出格式
        return outputs.map((o: any) => ({
          fileName: o.fileName || o.name || '',
          code: o.code || '',
          type: o.type || (o.isEntry ? 'entry' : 'chunk'),
          format: r.format,
          size: o.code ? o.code.length : 0,
          map: o.map || null
        }))
      })
      const combinedWarnings = allResults.flatMap(r => r.result.warnings || [])

      // 构建结果
      const totalRawSize = combinedOutputs.reduce((sum: number, output: any) => sum + (output.size || 0), 0)
      const largestOutput = combinedOutputs.reduce((max: any, o: any) => (o.size || 0) > (max.size || 0) ? o : max, { size: 0, fileName: '' } as any)

      const buildResult: BuildResult = {
        success: allResults.length > 0,
        outputs: combinedOutputs,
        duration,
        stats: {
          buildTime: duration,
          fileCount: combinedOutputs.length,
          totalSize: {
            raw: totalRawSize,
            gzip: 0,
            brotli: 0,
            byType: {},
            byFormat: {} as any,
            largest: {
              file: largestOutput.fileName || '',
              size: largestOutput.size || 0
            },
            fileCount: combinedOutputs.length
          },
          byFormat: {} as any,
          modules: {
            total: 0,
            external: 0,
            internal: 0,
            largest: {
              id: '',
              size: 0,
              renderedLength: 0,
              originalLength: 0,
              isEntry: false,
              isExternal: false,
              importedIds: [],
              dynamicallyImportedIds: [],
              importers: [],
              dynamicImporters: []
            }
          },
          dependencies: {
            total: 0,
            external: [],
            bundled: [],
            circular: []
          }
        },
        performance: this.getPerformanceMetrics(),
        warnings: combinedWarnings,
        errors: [],
        buildId: `rolldown-${Date.now()}`,
        timestamp: Date.now(),
        bundler: 'rolldown',
        mode: 'production'
      }

      this.logger.success(`Rolldown 构建完成 (${duration}ms)，成功构建 ${allResults.length}/${supportedFormats.length} 个格式`)
      return buildResult

    } catch (error) {
      throw new BuilderError(
        ErrorCode.BUILD_FAILED,
        `Rolldown 构建失败: ${(error as Error).message}`,
        { cause: error as Error }
      )
    }
  }

  /**
   * 启动监听模式
   */
  async watch(config: UnifiedConfig): Promise<BuildWatcher> {
    if (!this.available) {
      throw new BuilderError(
        ErrorCode.ADAPTER_NOT_AVAILABLE,
        'Rolldown 适配器不可用'
      )
    }

    try {
      const rolldown = await this.ensureRolldownLoaded()
      const rolldownConfig = await this.transformConfig(config)

      // 启动监听
      const watcher = await rolldown.watch(rolldownConfig)

      // 创建统一的监听器接口
      const watchOptions = config.watch || {}
      const buildWatcher = {
        patterns: (typeof watchOptions === 'object' && (watchOptions as any).include) || ['src/**/*'],
        watching: true,

        async close() {
          if (watcher && typeof watcher.close === 'function') {
            await watcher.close()
          }
        },

        on(event: string, listener: (...args: any[]) => void) {
          if (watcher && typeof watcher.on === 'function') {
            watcher.on(event, listener)
          }
          return this
        },

        off(event: string, listener: (...args: any[]) => void) {
          if (watcher && typeof watcher.off === 'function') {
            watcher.off(event, listener)
          }
          return this
        },

        emit(event: string, ...args: any[]) {
          if (watcher && typeof watcher.emit === 'function') {
            return watcher.emit(event, ...args)
          }
          return false
        }
      } as BuildWatcher

      this.logger.info('Rolldown 监听模式已启动')
      return buildWatcher

    } catch (error) {
      throw new BuilderError(
        ErrorCode.BUILD_FAILED,
        `启动 Rolldown 监听模式失败: ${(error as Error).message}`,
        { cause: error as Error }
      )
    }
  }

  /**
   * 转换配置
   */
  async transformConfig(config: UnifiedConfig): Promise<BundlerSpecificConfig> {
    // 创建样式处理插件
    const stylePlugin = await this.createStylePlugin()

    // 转换为 Rolldown 配置格式
    const rolldownConfig: any = {
      input: config.input,
      external: config.external,
      plugins: [stylePlugin] // 添加样式处理插件
    }

    // 转换输出配置 - 实现标准目录结构
    if (config.output) {
      // 处理 output 可能是数组的情况
      const outputConfig = Array.isArray(config.output) ? config.output[0] : config.output
      const formats = Array.isArray(outputConfig?.format) ? outputConfig.format : [outputConfig?.format]
      const format = formats[0] || 'esm' // Rolldown 目前主要支持 ESM

      // 根据格式确定输出目录，遵循标准目录结构
      const isESM = format === 'esm'
      const isCJS = format === 'cjs'
      const isUMD = format === 'umd'

      let dir: string
      let fileName: string

      if (isESM) {
        dir = 'es'
        fileName = '[name].js'
      } else if (isCJS) {
        dir = 'cjs'
        fileName = '[name].cjs'
      } else if (isUMD) {
        dir = 'dist'
        fileName = '[name].umd.js'
      } else {
        dir = 'dist'
        fileName = '[name].js'
      }

      rolldownConfig.output = {
        dir: outputConfig?.dir || dir,
        file: outputConfig?.file,
        format: format as any,
        name: outputConfig?.name,
        sourcemap: outputConfig?.sourcemap,
        globals: outputConfig?.globals,
        entryFileNames: fileName,
        chunkFileNames: fileName
      }

      this.logger.info(`Rolldown 输出配置: 格式=${format}, 目录=${dir}, 文件名=${fileName}`)
    }

    // Rolldown 特有配置
    if (config.platform) {
      rolldownConfig.platform = config.platform
    }

    // 转换其他选项
    if (config.treeshake !== undefined) {
      rolldownConfig.treeshake = config.treeshake
    }

    return rolldownConfig
  }

  /**
   * 转换插件
   */
  async transformPlugins(plugins: any[]): Promise<BundlerSpecificPlugin[]> {
    const transformedPlugins: BundlerSpecificPlugin[] = []

    for (const plugin of plugins) {
      try {
        // 如果插件有 plugin 函数，调用它来获取实际插件
        if (plugin.plugin && typeof plugin.plugin === 'function') {
          const actualPlugin = await plugin.plugin()
          transformedPlugins.push(actualPlugin)
        }
        // 如果插件有 rolldown 特定配置，使用它
        else if (plugin.rolldown) {
          transformedPlugins.push({ ...plugin, ...plugin.rolldown })
        }
        // 如果插件有 setup 方法，保持原样
        else if (plugin.setup) {
          transformedPlugins.push(plugin)
        }
        // 尝试转换 Rollup 插件为 Rolldown 格式
        else {
          transformedPlugins.push(this.convertRollupPlugin(plugin))
        }
      } catch (error) {
        this.logger.warn(`插件 ${plugin.name || 'unknown'} 加载失败:`, (error as Error).message)
      }
    }

    return transformedPlugins
  }

  /**
   * 检查功能支持
   */
  supportsFeature(feature: any): boolean {
    // Rolldown 支持的功能
    const supportedFeatures = [
      'treeshaking',
      'code-splitting',
      'dynamic-import',
      'sourcemap',
      'minification',
      'plugin-system',
      'config-file',
      'cache-support',
      'parallel-build',
      'incremental-build'
    ]

    return supportedFeatures.includes(feature)
  }

  /**
   * 获取功能支持映射
   */
  getFeatureSupport(): any {
    return {
      treeshaking: true,
      'code-splitting': true,
      'dynamic-import': true,
      'worker-support': true,
      'css-bundling': true,
      'asset-processing': true,
      sourcemap: true,
      minification: true,
      'hot-reload': false,
      'module-federation': false,
      'incremental-build': true,
      'parallel-build': true,
      'cache-support': true,
      'plugin-system': true,
      'config-file': true
    }
  }

  /**
   * 获取性能指标
   */
  getPerformanceMetrics(): PerformanceMetrics {
    // 返回默认指标，因为 PerformanceMonitor 没有直接的 getMetrics 方法
    // 性能指标应该通过 endBuild 方法获取
    return {
      buildTime: 0,
      memoryUsage: {
        heapUsed: process.memoryUsage().heapUsed,
        heapTotal: process.memoryUsage().heapTotal,
        external: process.memoryUsage().external,
        rss: process.memoryUsage().rss,
        peak: 0,
        trend: []
      },
      cacheStats: {
        hits: 0,
        misses: 0,
        hitRate: 0,
        size: 0,
        entries: 0,
        timeSaved: 0
      },
      fileStats: {
        totalFiles: 0,
        filesByType: {},
        averageProcessingTime: 0,
        slowestFiles: [],
        processingRate: 0
      },
      pluginPerformance: [],
      systemResources: {
        cpuUsage: 0,
        availableMemory: 0,
        diskUsage: {
          total: 0,
          used: 0,
          available: 0,
          usagePercent: 0
        }
      }
    }
  }

  /**
   * 创建样式处理插件
   * 支持 Less/SCSS/CSS 文件的编译和输出
   */
  private async createStylePlugin(): Promise<any> {
    const self = this
    const collectedStyles: Map<string, string> = new Map()
    // 使用顶层导入的 fs-extra 和 path
    const fsModule = await import('fs-extra')
    const pathModule = await import('path')
    const fs = fsModule.default || fsModule

    return {
      name: 'rolldown-style-plugin',

      // 使用 load 钩子拦截样式文件
      async load(id: string) {
        // 检查是否是样式文件
        if (!/\.(less|scss|sass|css|styl)$/.test(id)) {
          return null
        }

        self.logger.debug(`处理样式文件: ${id}`)

        try {
          if (!await fs.pathExists(id)) {
            self.logger.warn(`样式文件不存在: ${id}`)
            return { code: 'export default "";', map: null }
          }

          const content = await fs.readFile(id, 'utf-8')
          let css = content

          // 根据文件类型编译样式
          if (id.endsWith('.less')) {
            try {
              const less = await import('less')
              const result = await less.default.render(content, {
                filename: id,
                paths: [pathModule.dirname(id)]
              })
              css = result.css
              self.logger.debug(`Less 编译成功: ${id}`)
            } catch (e) {
              self.logger.warn(`Less 编译失败: ${id} - ${(e as Error).message}`)
              return { code: 'export default "";', map: null }
            }
          } else if (id.endsWith('.scss') || id.endsWith('.sass')) {
            try {
              const sass = await import('sass')
              const result = sass.compile(id)
              css = result.css
              self.logger.debug(`Sass 编译成功: ${id}`)
            } catch (e) {
              self.logger.warn(`Sass 编译失败: ${id} - ${(e as Error).message}`)
              return { code: 'export default "";', map: null }
            }
          }

          // 收集样式用于后续输出
          collectedStyles.set(id, css)

          // 返回空的 JS 模块（样式已收集）
          return {
            code: `/* Style: ${pathModule.basename(id)} */\nexport default "";`,
            map: null
          }
        } catch (error) {
          self.logger.warn(`加载样式文件失败: ${id}`)
          return { code: 'export default "";', map: null }
        }
      },

      async generateBundle(options: any, bundle: any) {
        // 将收集的样式输出为 CSS 文件
        if (collectedStyles.size > 0) {
          const allCss = Array.from(collectedStyles.values()).join('\n\n')
          const outputDir = options.dir || 'dist'

          try {
            await fs.ensureDir(outputDir)
            const cssPath = pathModule.join(outputDir, 'index.css')
            await fs.writeFile(cssPath, allCss)
            self.logger.info(`✅ 样式文件已生成: ${cssPath} (${collectedStyles.size} 个样式文件)`)
          } catch (error) {
            self.logger.warn(`样式文件输出失败: ${(error as Error).message}`)
          }
        }
      }
    }
  }

  /**
   * 清理资源
   */
  async dispose(): Promise<void> {
    // Rolldown 适配器没有需要清理的资源
  }

  /**
   * 确保 Rolldown 已加载（支持异步）
   */
  private async ensureRolldownLoaded(): Promise<any> {
    try {
      // 首先尝试同步加载
      return this.loadRolldown()
    } catch (error) {
      // 同步加载失败，尝试异步加载
      try {
        this.logger.debug('尝试异步加载 rolldown...')
        const rolldown = await import('rolldown')
        if (rolldown && (rolldown.VERSION || typeof rolldown.build === 'function')) {
          this.logger.debug(`Rolldown 异步加载成功: ${rolldown.VERSION || 'unknown'}`)
          return rolldown
        }
        throw new Error('Rolldown 模块无效')
      } catch (asyncError) {
        throw new BuilderError(
          ErrorCode.ADAPTER_NOT_AVAILABLE,
          'Rolldown 未安装或无法加载，请运行: npm install rolldown --save-dev',
          { cause: asyncError as Error }
        )
      }
    }
  }

  /**
   * 加载 Rolldown（同步方式）
   */
  private loadRolldown(): any {
    try {
      // 方式1: 在 CommonJS 环境中直接使用 require
      if (typeof require !== 'undefined') {
        return require('rolldown')
      }

      // 方式2: 在 ES 模块环境中，尝试使用 createRequire
      // 由于这是一个同步方法，我们不能使用 async import
      // 但我们可以尝试访问全局的 require 函数

      // 检查是否在 Node.js 环境中
      if (typeof process !== 'undefined' && process.versions && process.versions.node) {
        // 尝试通过 globalThis 访问 require
        const globalRequire = (globalThis as any).require
        if (globalRequire) {
          return globalRequire('rolldown')
        }

        // 尝试通过 global 访问 require
        const nodeGlobal = (global as any)
        if (nodeGlobal && nodeGlobal.require) {
          return nodeGlobal.require('rolldown')
        }
      }

      throw new Error('无法在当前环境中加载 rolldown 模块')
    } catch (error) {
      throw new Error('Rolldown 未安装，请运行: npm install rolldown --save-dev')
    }
  }

  /**
   * 转换 Rollup 插件为 Rolldown 格式
   */
  private convertRollupPlugin(plugin: any): any {
    // 如果插件已经是 Rolldown 格式，直接返回
    if (plugin.setup) {
      return plugin
    }

    // 尝试转换 Rollup 插件
    return {
      name: plugin.name || 'unknown',
      setup(build: any) {
        // 转换 Rollup 钩子为 Rolldown 钩子
        if (plugin.resolveId) {
          build.onResolve({ filter: /.*/ }, plugin.resolveId)
        }

        if (plugin.load) {
          build.onLoad({ filter: /.*/ }, plugin.load)
        }

        if (plugin.transform) {
          build.onTransform({ filter: /.*/ }, plugin.transform)
        }
      }
    }
  }
}
