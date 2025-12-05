/**
 * ESBuild 适配器
 * 
 * 提供 ESBuild 打包器的适配实现，专注于极速开发构建
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import type {
  IBundlerAdapter,
  UnifiedConfig,
  AdapterOptions,
  BundlerSpecificConfig
} from '../../types/adapter'
import type { BuildResult, BuildWatcher } from '../../types/builder'
import type { PerformanceMetrics } from '../../types/performance'
import { Logger } from '../../utils/logger'
import { BuilderError } from '../../utils/error-handler'
import { ErrorCode } from '../../constants/errors'
import path from 'path'
import fs from 'fs-extra'

/**
 * ESBuild 适配器类
 * 
 * 特点：
 * - 极速构建（10-100x 速度提升）
 * - 适合开发模式
 * - 内置 TypeScript/JSX 支持
 * - 限制：不支持装饰器、某些复杂转换
 */
export class EsbuildAdapter implements IBundlerAdapter {
  readonly name = 'esbuild' as const
  version: string
  available: boolean

  private logger: Logger
  private esbuild: any

  constructor(options: Partial<AdapterOptions> = {}) {
    this.logger = options.logger || new Logger()
    this.version = 'unknown'
    this.available = true // 假设可用，在实际使用时验证

    // 尝试同步加载
    this.checkAvailability()
  }

  /**
   * 检查 esbuild 可用性（同步）
   */
  private checkAvailability(): void {
    try {
      // 尝试同步加载
      if (typeof require !== 'undefined') {
        this.esbuild = require('esbuild')
        this.version = this.esbuild.version || 'unknown'
        this.available = true
        this.logger.debug(`ESBuild ${this.version} 已加载`)
      }
    } catch (error) {
      // 同步加载失败，将在使用时尝试异步加载
      this.logger.debug('ESBuild 同步加载失败，将在使用时异步加载')
    }
  }

  /**
   * 确保 esbuild 已加载（支持异步）
   */
  private async ensureEsbuildLoaded(): Promise<any> {
    if (this.esbuild) {
      return this.esbuild
    }

    try {
      this.esbuild = await import('esbuild')
      this.version = this.esbuild.version || 'unknown'
      this.available = true
      this.logger.debug(`ESBuild 异步加载成功: ${this.version}`)
      return this.esbuild
    } catch (error) {
      this.available = false
      throw new BuilderError(
        ErrorCode.ADAPTER_NOT_AVAILABLE,
        'ESBuild 未安装或无法加载，请运行: npm install esbuild --save-dev',
        { cause: error as Error }
      )
    }
  }

  /**
   * 执行构建
   */
  async build(config: UnifiedConfig): Promise<BuildResult> {
    const startTime = Date.now()

    try {
      // 确保 esbuild 已加载
      const esbuild = await this.ensureEsbuildLoaded()

      // 转换配置
      const esbuildConfig = await this.transformConfig(config)

      // 执行构建
      const result = await esbuild.build(esbuildConfig)

      // 处理输出
      const outputs = await this.processOutputs(result, config)

      // 计算性能指标
      const duration = Date.now() - startTime
      const metrics = this.getPerformanceMetrics()

      const totalRawSize = outputs.reduce((sum, o) => sum + (o.size || 0), 0)

      return {
        success: true,
        outputs,
        duration,
        stats: {
          buildTime: duration,
          fileCount: outputs.length,
          totalSize: {
            raw: totalRawSize,
            gzip: 0,
            brotli: 0,
            byType: {},
            byFormat: {} as any,
            largest: {
              file: outputs[0]?.fileName || '',
              size: outputs[0]?.size || 0
            },
            fileCount: outputs.length
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
        performance: metrics,
        warnings: result.warnings.map((w: any) => ({
          message: w.text,
          location: w.location
        })),
        errors: [],
        buildId: `esbuild-${Date.now()}`,
        timestamp: Date.now(),
        bundler: this.name,
        mode: config.mode || 'development',
        libraryType: config.libraryType
      }
    } catch (error) {
      const duration = Date.now() - startTime

      throw new BuilderError(
        ErrorCode.BUILD_FAILED,
        `ESBuild 构建失败: ${error instanceof Error ? error.message : String(error)}`,
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
        'ESBuild 适配器不可用'
      )
    }

    const esbuildConfig = await this.transformConfig(config)

    // ESBuild 的 watch 模式
    const ctx = await this.esbuild.context({
      ...esbuildConfig,
      watch: {
        onRebuild: (error: any, result: any) => {
          if (error) {
            this.logger.error('重新构建失败:', error)
          } else {
            this.logger.success('重新构建成功')
          }
        }
      }
    })

    await ctx.watch()

    const { EventEmitter } = require('events')
    const watcher = new EventEmitter() as any
    watcher.patterns = [config.input as string || 'src/**/*']
    watcher.watching = true
    watcher.close = async () => {
      await ctx.dispose()
    }

    return watcher
  }

  /**
   * 转换配置
   */
  async transformConfig(config: UnifiedConfig): Promise<any> {
    const input = this.resolveInput(config.input)
    const outdir = this.resolveOutDir(config)

    return {
      entryPoints: Array.isArray(input) ? input : [input],
      bundle: true,
      outdir,
      format: this.mapFormat(config.output?.format as string),
      target: config.typescript?.target || 'es2020',
      minify: config.minify === true,
      sourcemap: config.sourcemap === true || config.sourcemap === 'inline',
      splitting: config.output?.format === 'esm', // 仅 ESM 支持代码分割
      platform: 'neutral', // 或 'browser', 'node'
      external: config.external,
      define: config.define || {},
      loader: {
        '.ts': 'ts',
        '.tsx': 'tsx',
        '.js': 'js',
        '.jsx': 'jsx',
        '.json': 'json',
        '.css': 'css',
        '.less': 'css',
        '.scss': 'css'
      },
      logLevel: 'warning',
      metafile: true, // 用于分析
    }
  }

  /**
   * 转换插件
   */
  async transformPlugins(plugins: any[]): Promise<any[]> {
    // ESBuild 插件系统与 Rollup 不同，需要适配
    return plugins.filter(p => p && p.esbuild).map(p => p.esbuild)
  }

  /**
   * 是否支持特性
   */
  supportsFeature(feature: string): boolean {
    const supportedFeatures = [
      'typescript',
      'jsx',
      'minify',
      'sourcemap',
      'code-splitting',
      'tree-shaking',
      'fast-refresh'
    ]

    // 不支持的特性
    const unsupportedFeatures = [
      'decorators', // 实验性支持
      'vue-sfc',
      'angular',
      'complex-transforms'
    ]

    if (unsupportedFeatures.includes(feature)) {
      return false
    }

    return supportedFeatures.includes(feature)
  }

  /**
   * 获取特性支持情况
   */
  getFeatureSupport(): any {
    return {
      treeshaking: true,
      'code-splitting': true,
      'dynamic-import': true,
      'worker-support': true,
      'css-bundling': true,
      'asset-processing': true,
      'sourcemap': true,
      'minification': true,
      'hot-reload': true,
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
    const memUsage = process.memoryUsage()

    return {
      buildTime: 0,
      memoryUsage: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss,
        peak: memUsage.heapUsed,
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
   * 销毁资源
   */
  async dispose(): Promise<void> {
    this.logger.debug('ESBuild 适配器已销毁')
  }

  /**
   * 解析入口文件
   */
  private resolveInput(input: string | string[] | Record<string, string> | undefined): string | string[] {
    if (!input) {
      return 'src/index.ts'
    }

    if (typeof input === 'string') {
      return input
    }

    if (Array.isArray(input)) {
      return input
    }

    // Record 格式转为数组
    return Object.values(input)
  }

  /**
   * 解析输出目录
   */
  private resolveOutDir(config: UnifiedConfig): string {
    if (config.output?.dir) {
      return config.output.dir
    }

    // 根据格式选择默认目录
    const format = config.output?.format as string
    if (format === 'esm' || format === 'es') {
      return 'es'
    } else if (format === 'cjs' || format === 'commonjs') {
      return 'lib'
    }

    return 'dist'
  }

  /**
   * 映射输出格式
   */
  private mapFormat(format: string | undefined): 'iife' | 'cjs' | 'esm' {
    if (!format) return 'esm'

    if (format === 'cjs' || format === 'commonjs') {
      return 'cjs'
    } else if (format === 'iife' || format === 'umd') {
      return 'iife'
    }

    return 'esm'
  }

  /**
   * 处理输出文件
   */
  private async processOutputs(result: any, config: UnifiedConfig): Promise<any[]> {
    const outputs: any[] = []

    if (result.metafile && result.metafile.outputs) {
      for (const [fileName, output] of Object.entries(result.metafile.outputs as Record<string, any>)) {
        const relativePath = path.relative(process.cwd(), fileName)

        outputs.push({
          fileName: relativePath,
          type: fileName.endsWith('.map') ? 'sourcemap' : 'chunk',
          format: config.output?.format || 'esm',
          size: output.bytes || 0,
          code: undefined, // ESBuild 直接写入文件
          map: undefined
        })
      }
    }

    return outputs
  }
}



