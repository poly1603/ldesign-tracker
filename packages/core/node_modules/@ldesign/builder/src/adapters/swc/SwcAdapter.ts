/**
 * SWC 适配器
 * 
 * 提供 SWC 打包器的适配实现，专注于快速生产构建
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import type {
  IBundlerAdapter,
  UnifiedConfig,
  AdapterOptions
} from '../../types/adapter'
import type { BuildResult, BuildWatcher } from '../../types/builder'
import type { PerformanceMetrics } from '../../types/performance'
import { Logger } from '../../utils/logger'
import { BuilderError } from '../../utils/error-handler'
import { ErrorCode } from '../../constants/errors'
import path from 'path'
import fs from 'fs-extra'
import fastGlob from 'fast-glob'

/**
 * SWC 适配器类
 * 
 * 特点：
 * - 20x 速度提升（相比 Babel）
 * - 适合生产构建
 * - 完整的 TypeScript/JSX 支持
 * - 装饰器支持
 */
export class SwcAdapter implements IBundlerAdapter {
  readonly name = 'swc' as const
  version: string
  available: boolean

  private logger: Logger
  private swc: any

  constructor(options: Partial<AdapterOptions> = {}) {
    this.logger = options.logger || new Logger()
    this.version = 'unknown'
    this.available = false

    // 检查 SWC 是否可用
    this.checkAvailability()
  }

  /**
   * 检查 SWC 可用性
   */
  private checkAvailability(): void {
    try {
      this.swc = require('@swc/core')
      this.version = this.swc.version || 'unknown'
      this.available = true
      this.logger.debug(`SWC ${this.version} 已加载`)
    } catch (error) {
      this.logger.warn('SWC 不可用，请安装: npm install @swc/core')
      this.available = false
    }
  }

  /**
   * 执行构建
   */
  async build(config: UnifiedConfig): Promise<BuildResult> {
    if (!this.available) {
      throw new BuilderError(
        ErrorCode.ADAPTER_NOT_AVAILABLE,
        'SWC 适配器不可用，请安装 @swc/core'
      )
    }

    const startTime = Date.now()

    try {
      // 解析入口文件
      const inputFiles = await this.resolveInputFiles(config.input)
      const outputs: any[] = []

      // 转换配置
      const swcConfig = await this.transformConfig(config)

      // 处理每个文件
      for (const inputFile of inputFiles) {
        const result = await this.swc.transformFile(inputFile, swcConfig)

        const outputFile = this.getOutputPath(inputFile, config)
        await fs.ensureDir(path.dirname(outputFile))
        await fs.writeFile(outputFile, result.code)

        // 如果有 source map
        if (result.map && config.sourcemap) {
          await fs.writeFile(outputFile + '.map', result.map)
        }

        outputs.push({
          fileName: path.relative(process.cwd(), outputFile),
          type: 'chunk',
          format: config.output?.format || 'esm',
          size: Buffer.byteLength(result.code),
          code: result.code,
          map: result.map
        })
      }

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
        warnings: [],
        errors: [],
        buildId: `swc-${Date.now()}`,
        timestamp: Date.now(),
        bundler: this.name,
        mode: config.mode || 'production',
        libraryType: config.libraryType
      }
    } catch (error) {
      throw new BuilderError(
        ErrorCode.BUILD_FAILED,
        `SWC 构建失败: ${error instanceof Error ? error.message : String(error)}`,
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
        'SWC 适配器不可用'
      )
    }

    // SWC 没有内置 watch 模式，需要使用 chokidar
    const chokidar = require('chokidar')
    const inputFiles = await this.resolveInputFiles(config.input)

    const watcher = chokidar.watch(inputFiles, {
      persistent: true,
      ignoreInitial: false
    })

    watcher.on('change', async (filePath: string) => {
      this.logger.info(`文件变化: ${filePath}`)
      try {
        await this.build(config)
        this.logger.success('重新构建成功')
      } catch (error) {
        this.logger.error('重新构建失败:', error)
      }
    })

    // 扩展 watcher 对象
    const buildWatcher = watcher as any
    buildWatcher.patterns = inputFiles
    buildWatcher.watching = true
    const originalClose = watcher.close.bind(watcher)
    buildWatcher.close = async () => {
      await originalClose()
    }

    return buildWatcher
  }

  /**
   * 转换配置
   */
  async transformConfig(config: UnifiedConfig): Promise<any> {
    return {
      jsc: {
        parser: {
          syntax: 'typescript',
          tsx: true,
          decorators: true,
          dynamicImport: true
        },
        transform: {
          react: {
            runtime: 'automatic',
            development: config.mode === 'development'
          },
          decoratorMetadata: true,
          legacyDecorator: true
        },
        target: this.mapTarget(config.typescript?.target),
        loose: false,
        externalHelpers: true,
        keepClassNames: true
      },
      module: {
        type: this.mapModuleType(config.output?.format as string),
        strict: false,
        strictMode: true,
        lazy: false,
        noInterop: false
      },
      minify: config.minify === true,
      sourceMaps: config.sourcemap === true || config.sourcemap === 'inline',
      inlineSourcesContent: true
    }
  }

  /**
   * 转换插件
   */
  async transformPlugins(plugins: any[]): Promise<any[]> {
    // SWC 插件系统基于 Rust，需要特殊处理
    return plugins.filter(p => p && p.swc).map(p => p.swc)
  }

  /**
   * 是否支持特性
   */
  supportsFeature(feature: string): boolean {
    const supportedFeatures = [
      'typescript',
      'jsx',
      'tsx',
      'decorators',
      'minify',
      'sourcemap',
      'react',
      'vue', // 通过插件
      'emotion',
      'styled-components'
    ]

    return supportedFeatures.includes(feature)
  }

  /**
   * 获取特性支持情况
   */
  getFeatureSupport(): any {
    return {
      treeshaking: false,
      'code-splitting': false,
      'dynamic-import': true,
      'worker-support': false,
      'css-bundling': false,
      'asset-processing': false,
      'sourcemap': true,
      'minification': true,
      'hot-reload': false,
      'module-federation': false,
      'incremental-build': false,
      'parallel-build': false,
      'cache-support': false,
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
    this.logger.debug('SWC 适配器已销毁')
  }

  /**
   * 解析入口文件
   */
  private async resolveInputFiles(input: string | string[] | Record<string, string> | undefined): Promise<string[]> {
    if (!input) {
      input = 'src/**/*.{ts,tsx,js,jsx}'
    }

    if (typeof input === 'string') {
      // 如果是 glob 模式
      if (input.includes('*')) {
        return await fastGlob(input, { absolute: true })
      }
      return [path.resolve(process.cwd(), input)]
    }

    if (Array.isArray(input)) {
      const files: string[] = []
      for (const pattern of input) {
        if (pattern.includes('*')) {
          files.push(...await fastGlob(pattern, { absolute: true }))
        } else {
          files.push(path.resolve(process.cwd(), pattern))
        }
      }
      return files
    }

    // Record 格式
    return Object.values(input).map(f => path.resolve(process.cwd(), f))
  }

  /**
   * 获取输出路径
   */
  private getOutputPath(inputFile: string, config: UnifiedConfig): string {
    const outDir = config.output?.dir || 'dist'
    const relativePath = path.relative(process.cwd(), inputFile)

    // 移除 src 前缀
    const withoutSrc = relativePath.startsWith('src/')
      ? relativePath.slice(4)
      : relativePath

    // 更改扩展名
    const format = config.output?.format as string
    let ext = '.js'
    if (format === 'cjs' || format === 'commonjs') {
      ext = '.cjs'
    } else if (format === 'esm' || format === 'es') {
      ext = '.js'
    }

    const outputPath = withoutSrc.replace(/\.(ts|tsx|js|jsx)$/, ext)

    return path.join(process.cwd(), outDir, outputPath)
  }

  /**
   * 映射目标版本
   */
  private mapTarget(target: string | undefined): string {
    if (!target) return 'es2020'

    const targetMap: Record<string, string> = {
      'ES3': 'es3',
      'ES5': 'es5',
      'ES2015': 'es2015',
      'ES2016': 'es2016',
      'ES2017': 'es2017',
      'ES2018': 'es2018',
      'ES2019': 'es2019',
      'ES2020': 'es2020',
      'ES2021': 'es2021',
      'ES2022': 'es2022',
      'ESNext': 'es2022'
    }

    return targetMap[target] || 'es2020'
  }

  /**
   * 映射模块类型
   */
  private mapModuleType(format: string | undefined): 'commonjs' | 'es6' | 'amd' | 'umd' {
    if (!format) return 'es6'

    if (format === 'cjs' || format === 'commonjs') {
      return 'commonjs'
    } else if (format === 'esm' || format === 'es') {
      return 'es6'
    } else if (format === 'amd') {
      return 'amd'
    } else if (format === 'umd') {
      return 'umd'
    }

    return 'es6'
  }
}



