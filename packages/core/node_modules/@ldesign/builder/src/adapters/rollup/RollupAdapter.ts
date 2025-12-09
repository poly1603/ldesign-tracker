/**
 * Rollup 适配器
 *
 * 提供 Rollup 打包器的适配实现
 *
 * @author LDesign Team
 * @version 1.0.0
 */

import type {
  IBundlerAdapter,
  UnifiedConfig,
  AdapterOptions,
  BundlerSpecificConfig,
  BundlerSpecificPlugin,
  UnifiedPlugin
} from '../../types/adapter'
import type { BuildResult, BuildWatcher } from '../../types/builder'
import type { PerformanceMetrics } from '../../types/performance'
import type { BuilderConfig } from '../../types/config'
import type { RollupOptions, OutputOptions, OutputChunk, OutputAsset } from 'rollup'
import path from 'path'
import fs from 'fs'
import { Logger } from '../../utils/logger'
import { BuilderError } from '../../utils/error-handler'
import { ErrorCode } from '../../constants/errors'
import { normalizeInput } from '../../utils/file-system/glob'
import { RollupCache } from '../../utils/cache'
import { RollupCacheManager } from './RollupCacheManager'
import { RollupBannerGenerator } from './RollupBannerGenerator'
import { RollupDtsHandler } from './RollupDtsHandler'
import { RollupStyleHandler } from './RollupStyleHandler'
import { RollupPluginManager } from './RollupPluginManager'
import { RollupFormatMapper } from './utils/RollupFormatMapper'
import { RollupUMDBuilder } from './config/RollupUMDBuilder'

/**
 * Rollup 适配器类
 */
export class RollupAdapter implements IBundlerAdapter {
  readonly name = 'rollup' as const
  version: string
  available: boolean

  private logger: Logger
  private multiConfigs?: RollupOptions[]

  // 模块实例
  private cacheManager: RollupCacheManager
  private bannerGenerator: RollupBannerGenerator
  private dtsHandler: RollupDtsHandler
  private styleHandler: RollupStyleHandler
  private pluginManager: RollupPluginManager
  private formatMapper: RollupFormatMapper
  private umdBuilder: RollupUMDBuilder

  constructor(options: Partial<AdapterOptions> = {}) {
    this.logger = options.logger || new Logger()

    // 初始化为可用状态，实际检查在第一次使用时进行
    this.version = 'unknown'
    this.available = true

    // 初始化模块
    this.cacheManager = new RollupCacheManager(this.logger)
    this.bannerGenerator = new RollupBannerGenerator(this.logger)
    this.dtsHandler = new RollupDtsHandler(this.logger)
    this.styleHandler = new RollupStyleHandler(this.logger)
    this.pluginManager = new RollupPluginManager(this.logger)
    this.formatMapper = new RollupFormatMapper()
    this.umdBuilder = new RollupUMDBuilder(this.logger, this.bannerGenerator)
  }



  /**
   * 执行构建
   */
  async build(config: UnifiedConfig): Promise<BuildResult> {
    if (!this.available) {
      throw new BuilderError(
        ErrorCode.ADAPTER_NOT_AVAILABLE,
        'Rollup 适配器不可用'
      )
    }

    try {
      // 检查是否为清理模式
      const isCleanMode = (config as any)?.clean === true
      this.logger.info(`清理模式检查: config.clean=${(config as any)?.clean}, isCleanMode=${isCleanMode}`)

      // 受控启用构建缓存（清理模式下禁用缓存）
      const cacheEnabled = !isCleanMode && this.cacheManager.isCacheEnabled(config)
      const cacheOptions = this.cacheManager.resolveCacheOptions(config)
      const cache = new RollupCache({
        cacheDir: cacheOptions.cacheDir,
        ttl: cacheOptions.ttl,
        maxSize: cacheOptions.maxSize,
      })

      // 如果是清理模式，清除相关缓存
      if (isCleanMode) {
        this.logger.info('清理模式：跳过缓存并清除现有缓存')
        const cacheKey = { adapter: this.name, config }
        const crypto = await import('crypto')
        const configHash = crypto.createHash('md5').update(JSON.stringify(cacheKey)).digest('hex')
        await cache.delete(`build:${configHash}`)
      }

      const cacheKey = { adapter: this.name, config }
      const lookupStart = Date.now()
      // 清理模式下强制跳过缓存查找
      const cachedResult = (cacheEnabled && !isCleanMode) ? await cache.getBuildResult(cacheKey) : null
      const lookupMs = Date.now() - lookupStart

      // 检查缓存结果和输出产物的存在性
      if (cacheEnabled && cachedResult) {
        // 验证输出产物是否存在
        const outputExists = await this.cacheManager.validateOutputArtifacts(config)

        if (outputExists) {
          // 验证源文件是否被修改（时间戳检查）
          const sourceModified = await this.cacheManager.checkSourceFilesModified(config, cachedResult)

          if (sourceModified) {
            this.logger.debug('源文件已修改，缓存失效')
          } else {
            // 附加缓存信息并返回
            cachedResult.cache = {
              enabled: true,
              hit: true,
              lookupMs,
              savedMs: typeof cachedResult.duration === 'number' ? cachedResult.duration : 0,
              dir: cache.getDirectory?.() || undefined,
              ttl: cache.getTTL?.() || undefined,
              maxSize: cache.getMaxSize?.() || undefined,
            }
            this.logger.info('使用缓存的构建结果 (cache hit, artifacts verified, sources unchanged)')
            return cachedResult
          }
        } else {
          // 输出产物不存在，尝试从缓存恢复文件
          this.logger.info('缓存命中但输出产物不存在，尝试从缓存恢复文件')

          const restored = await cache.restoreFilesFromCache(cachedResult)
          if (restored) {
            // 文件恢复成功，验证产物是否存在
            const outputExistsAfterRestore = await this.cacheManager.validateOutputArtifacts(config)
            if (outputExistsAfterRestore) {
              // 附加缓存信息并返回
              cachedResult.cache = {
                enabled: true,
                hit: true,
                lookupMs,
                savedMs: typeof cachedResult.duration === 'number' ? cachedResult.duration : 0,
                dir: cache.getDirectory?.() || undefined,
                ttl: cache.getTTL?.() || undefined,
                maxSize: cache.getMaxSize?.() || undefined,
              }
              this.logger.info('从缓存恢复文件成功 (cache hit, files restored)')
              return cachedResult
            }
          }

          // 文件恢复失败，使缓存失效并重新构建
          this.logger.info('从缓存恢复文件失败，使缓存失效并重新构建')
          const crypto = await import('crypto')
          const configHash = crypto.createHash('md5').update(JSON.stringify(cacheKey)).digest('hex')
          await cache.delete(`build:${configHash}`)
        }
      } else if (cacheEnabled) {
        this.logger.debug('未命中构建缓存 (cache miss)')
      } else if (isCleanMode) {
        this.logger.debug('清理模式：已禁用缓存')
      }

      this.logger.debug('🔧 加载 Rollup 模块...')
      const rollup = await this.loadRollup()
      this.logger.debug('✅ Rollup 模块加载完成')

      this.logger.debug('⚙️  转换配置...')
      const rollupConfig = await this.transformConfig(config)
      this.logger.debug('✅ 配置转换完成')

      // 静默开始构建（减少日志输出）
      const startTime = Date.now()

      // 收集带格式信息的输出
      const results: Array<{ chunk: OutputChunk | OutputAsset; format: string }> = []

      // 如果有多个配置，使用并行构建提升速度
      if (this.multiConfigs && this.multiConfigs.length > 1) {
        this.logger.debug(`📦 并行构建 ${this.multiConfigs.length} 个配置...`)
        // 并行构建所有配置（静默模式）
        const buildPromises = this.multiConfigs.map(async (singleConfig, index) => {
          this.logger.debug(`  [${index + 1}/${this.multiConfigs!.length}] 开始 rollup.rollup()...`)
          const bundle = await rollup.rollup(singleConfig)
          this.logger.debug(`  [${index + 1}/${this.multiConfigs!.length}] rollup.rollup() 完成`)

          // 生成并记录输出（保留每个配置的 format）
          this.logger.debug(`  [${index + 1}/${this.multiConfigs!.length}] 开始 bundle.generate()...`)
          const { output } = await bundle.generate(singleConfig.output)
          this.logger.debug(`  [${index + 1}/${this.multiConfigs!.length}] bundle.generate() 完成`)

          // 安全获取 format，处理 output 可能是数组的情况
          const outputFormat = Array.isArray(singleConfig.output)
            ? (singleConfig.output[0]?.format || 'es')
            : (singleConfig.output?.format || 'es')
          const formatResults = output.map((item: any) => ({
            chunk: item,
            format: String(outputFormat)
          }))

          // 写入文件
          this.logger.debug(`  [${index + 1}/${this.multiConfigs!.length}] 开始 bundle.write()...`)
          await bundle.write(singleConfig.output)
          this.logger.debug(`  [${index + 1}/${this.multiConfigs!.length}] bundle.write() 完成`)

          await bundle.close()

          return formatResults
        })

        // 等待所有构建完成
        this.logger.debug('⏳ 等待所有并行构建完成...')
        const allResults = await Promise.all(buildPromises)
        this.logger.debug('✅ 所有并行构建完成')
        results.push(...allResults.flat())
      } else {
        // 单配置构建
        this.logger.debug('📦 单配置构建...')
        this.logger.debug('  开始 rollup.rollup()...')
        const bundle = await rollup.rollup(rollupConfig)
        this.logger.debug('  rollup.rollup() 完成')

        const outputs = Array.isArray(rollupConfig.output)
          ? rollupConfig.output
          : [rollupConfig.output]

        this.logger.debug(`  处理 ${outputs.length} 个输出配置...`)
        for (const outputConfig of outputs) {
          this.logger.debug(`  开始 bundle.generate() for ${outputConfig?.format || 'es'}...`)
          const { output } = await bundle.generate(outputConfig)
          this.logger.debug(`  bundle.generate() 完成，生成 ${output.length} 个文件`)
          for (const item of output) {
            results.push({ chunk: item, format: String(outputConfig?.format || 'es') })
          }
        }

        // 写入文件
        this.logger.debug('  开始写入文件...')
        for (const outputConfig of outputs) {
          await bundle.write(outputConfig)
        }
        this.logger.debug('  文件写入完成')

        await bundle.close()
        this.logger.debug('✅ 单配置构建完成')
      }

      const duration = Date.now() - startTime
      this.logger.debug(`⏱️  Rollup 构建总耗时: ${duration}ms`)

      // 计算 gzip 大小并产出规范化的 outputs
      const { gzipSize } = await import('gzip-size')
      const outputs = [] as any[]
      let totalRaw = 0
      let largest = { file: '', size: 0 }
      for (const r of results) {
        const chunk = r.chunk
        const codeOrSource = chunk.type === 'chunk' ? chunk.code : chunk.source
        const rawSize = typeof codeOrSource === 'string' ? codeOrSource.length : (codeOrSource?.byteLength || 0)
        const gz = typeof codeOrSource === 'string' ? await gzipSize(codeOrSource) : 0
        totalRaw += rawSize
        if (rawSize > largest.size) {
          largest = { file: chunk.fileName, size: rawSize }
        }
        outputs.push({
          fileName: chunk.fileName,
          size: rawSize,
          source: codeOrSource,
          type: chunk.type,
          format: r.format,
          gzipSize: gz
        })
      }

      // 构建结果
      const buildResult: BuildResult = {
        success: true,
        outputs,
        duration,
        stats: {
          buildTime: duration,
          fileCount: outputs.length,
          totalSize: {
            raw: totalRaw,
            gzip: outputs.reduce((s, o) => s + (o.gzipSize || 0), 0),
            brotli: 0,
            byType: {},
            byFormat: { esm: 0, cjs: 0, umd: 0, iife: 0, css: 0, dts: 0 },
            largest,
            fileCount: outputs.length
          },
          byFormat: {
            esm: { fileCount: outputs.filter(o => o.format === 'es' || o.format === 'esm').length, size: { raw: outputs.filter(o => o.format === 'es' || o.format === 'esm').reduce((s, o) => s + o.size, 0), gzip: outputs.filter(o => o.format === 'es' || o.format === 'esm').reduce((s, o) => s + (o.gzipSize || 0), 0), brotli: 0, byType: {}, byFormat: { esm: 0, cjs: 0, umd: 0, iife: 0, css: 0, dts: 0 }, largest: { file: '', size: 0 }, fileCount: 0 } },
            cjs: { fileCount: outputs.filter(o => o.format === 'cjs').length, size: { raw: outputs.filter(o => o.format === 'cjs').reduce((s, o) => s + o.size, 0), gzip: outputs.filter(o => o.format === 'cjs').reduce((s, o) => s + (o.gzipSize || 0), 0), brotli: 0, byType: {}, byFormat: { esm: 0, cjs: 0, umd: 0, iife: 0, css: 0, dts: 0 }, largest: { file: '', size: 0 }, fileCount: 0 } },
            umd: { fileCount: outputs.filter(o => o.format === 'umd').length, size: { raw: outputs.filter(o => o.format === 'umd').reduce((s, o) => s + o.size, 0), gzip: outputs.filter(o => o.format === 'umd').reduce((s, o) => s + (o.gzipSize || 0), 0), brotli: 0, byType: {}, byFormat: { esm: 0, cjs: 0, umd: 0, iife: 0, css: 0, dts: 0 }, largest: { file: '', size: 0 }, fileCount: 0 } },
            iife: { fileCount: outputs.filter(o => o.format === 'iife').length, size: { raw: outputs.filter(o => o.format === 'iife').reduce((s, o) => s + o.size, 0), gzip: outputs.filter(o => o.format === 'iife').reduce((s, o) => s + (o.gzipSize || 0), 0), brotli: 0, byType: {}, byFormat: { esm: 0, cjs: 0, umd: 0, iife: 0, css: 0, dts: 0 }, largest: { file: '', size: 0 }, fileCount: 0 } },
            css: { fileCount: outputs.filter(o => o.format === 'css').length, size: { raw: outputs.filter(o => o.format === 'css').reduce((s, o) => s + o.size, 0), gzip: outputs.filter(o => o.format === 'css').reduce((s, o) => s + (o.gzipSize || 0), 0), brotli: 0, byType: {}, byFormat: { esm: 0, cjs: 0, umd: 0, iife: 0, css: 0, dts: 0 }, largest: { file: '', size: 0 }, fileCount: 0 } },
            dts: { fileCount: 0, size: { raw: 0, gzip: 0, brotli: 0, byType: {}, byFormat: { esm: 0, cjs: 0, umd: 0, iife: 0, css: 0, dts: 0 }, largest: { file: '', size: 0 }, fileCount: 0 } }
          },
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
        warnings: [],
        errors: [],
        buildId: `rollup-${Date.now()}`,
        timestamp: Date.now(),
        bundler: 'rollup',
        mode: 'production'
      }

      // 复制 DTS 文件到所有格式的输出目录
      await this.dtsHandler.copyDtsFiles(config as any)

      // 缓存构建结果
      if (cacheEnabled) {
        await cache.cacheBuildResult(cacheKey, buildResult)
        buildResult.cache = {
          enabled: true,
          hit: false,
          lookupMs,
          savedMs: 0,
          dir: cache.getDirectory?.() || undefined,
          ttl: cache.getTTL?.() || undefined,
          maxSize: cache.getMaxSize?.() || undefined,
        }
        this.logger.debug('构建结果已缓存')
      }

      return buildResult

    } catch (error) {
      throw new BuilderError(
        ErrorCode.BUILD_FAILED,
        `Rollup 构建失败: ${(error as Error).message}`,
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
        'Rollup 适配器不可用'
      )
    }

    try {
      const rollup = await this.loadRollup()
      const rollupConfig = await this.transformConfig(config)

      // 添加监听配置
      const watchOptions = config.watch || {}
      const watchConfig = {
        ...rollupConfig,
        watch: {
          include: (watchOptions as any).include || ['src/**/*'],
          exclude: (watchOptions as any).exclude || ['node_modules/**/*'],
          ...(typeof watchOptions === 'object' ? watchOptions : {})
        }
      }

      const watcher = rollup.watch(watchConfig)

      // 创建统一的监听器接口
      const buildWatcher = {
        patterns: watchConfig.watch.include,
        watching: true,

        async close() {
          await watcher.close()
        },

        on(event: string, listener: (...args: any[]) => void) {
          watcher.on(event, listener)
          return this
        },

        off(event: string, listener: (...args: any[]) => void) {
          watcher.off(event, listener)
          return this
        },

        emit(_event: string, ..._args: any[]) {
          return false // Rollup watcher 不支持 emit
        }
      } as BuildWatcher

      this.logger.info('Rollup 监听模式已启动')
      return buildWatcher

    } catch (error) {
      throw new BuilderError(
        ErrorCode.BUILD_FAILED,
        `启动 Rollup 监听模式失败: ${(error as Error).message}`,
        { cause: error as Error }
      )
    }
  }

  /**
   * 转换配置
   */
  async transformConfig(config: UnifiedConfig): Promise<BundlerSpecificConfig> {
    this.logger.debug('🔧 开始转换配置...')

    // 转换为 Rollup 配置格式
    this.logger.debug('  获取基础插件...')
    const basePlugins = await this.getBasePlugins(config)
    this.logger.debug(`  基础插件数量: ${basePlugins.length}`)

    // 应用 exclude 过滤到输入配置
    this.logger.debug('  规范化输入配置...')
    const filteredInput = await normalizeInput(config.input, process.cwd(), config.exclude)
    this.logger.debug(`  输入配置: ${JSON.stringify(filteredInput).substring(0, 200)}...`)

    const rollupConfig: RollupOptions = {
      input: filteredInput,
      external: config.external,
      onwarn: this.getOnWarn(config)
    }

    // 注入 Acorn 插件以支持在转换前解析 TSX/JSX/TS 语法，避免早期解析错误
    const acornPlugins = await this.getAcornPlugins()
    if (acornPlugins.length > 0) {
      // 使用类型断言，因为 acorn 是 Rollup 内部选项
      ; (rollupConfig as any).acorn = { ...((rollupConfig as any).acorn || {}), injectPlugins: acornPlugins }
    }

    // 转换输出配置
    if (config.output) {
      let outputConfig = config.output as any

      // 处理数组格式的输出配置，转换为 TDesign 风格对象格式
      // 例如: [{ format: 'esm', dir: 'es' }, { format: 'esm', dir: 'esm' }]
      // 转换为: { es: { dir: 'es' }, esm: { dir: 'esm' }, lib: { dir: 'lib' }, dist: { dir: 'dist' } }
      if (Array.isArray(outputConfig)) {
        this.logger.debug('检测到数组格式输出配置，转换为 TDesign 风格')
        const converted: any = {}

        for (const item of outputConfig) {
          const format = item.format
          const dir = item.dir

          // 使用目录名作为键（支持 es、esm、lib、dist 等）
          // 这样可以确保每个目录都有独立的配置
          const configKey = dir || format || 'es'

          converted[configKey] = {
            ...item,
            dir: dir || configKey,
            preserveStructure: item.preserveModules ?? item.preserveStructure
          }

          this.logger.debug(`转换输出配置: format=${format}, dir=${dir} -> key=${configKey}`)
        }

        outputConfig = converted
        this.logger.debug(`转换后的配置键: ${Object.keys(converted).join(', ')}`)
      }

      // 优先处理对象化的输出配置（output.es / output.esm / output.cjs / output.umd）
      this.logger.debug(`输出配置键: ${Object.keys(outputConfig).join(', ')}`)
      this.logger.debug(`outputConfig.es: ${JSON.stringify(outputConfig.es)}`)
      this.logger.debug(`outputConfig.esm: ${JSON.stringify(outputConfig.esm)}`)
      this.logger.debug(`outputConfig.cjs: ${JSON.stringify(outputConfig.cjs)}`)
      this.logger.debug(`outputConfig.umd: ${JSON.stringify(outputConfig.umd)}`)

      if (outputConfig.es || outputConfig.esm || outputConfig.cjs || outputConfig.lib || outputConfig.umd || outputConfig.dist) {
        this.logger.debug('进入 TDesign 风格配置分支')
        const configs: RollupOptions[] = []

        // 处理 ES 配置 (TDesign 风格: .mjs + 编译后的 CSS)
        if (outputConfig.es && outputConfig.es !== false) {
          const esConfig = outputConfig.es === true ? {} : outputConfig.es
          const esDir = esConfig.dir || 'es'
          const esPlugins = await this.pluginManager.transformPluginsForFormat(config.plugins || [], esDir, { emitDts: true })
          const esInput = esConfig.input
            ? await normalizeInput(esConfig.input, process.cwd(), config.exclude)
            : filteredInput

          // 解析 banner/footer/intro/outro
          const banners = await this.resolveBanners(config)

          configs.push({
            input: esInput,
            external: config.external,
            plugins: [...basePlugins, ...esPlugins],
            output: {
              dir: esDir,
              format: 'es',
              sourcemap: esConfig.sourcemap ?? outputConfig.sourcemap,
              entryFileNames: '[name].mjs',  // 使用 .mjs 扩展名
              chunkFileNames: '[name].mjs',
              assetFileNames: '[name].[ext]',
              exports: esConfig.exports ?? 'auto',
              preserveModules: esConfig.preserveStructure ?? true,
              preserveModulesRoot: 'src',
              globals: outputConfig.globals,
              name: outputConfig.name,
              ...banners
            },
            treeshake: config.treeshake,
            onwarn: this.getOnWarn(config)
          })
        }

        // 处理 ESM 配置 (TDesign 风格: .js + 忽略样式)
        if (outputConfig.esm && outputConfig.esm !== false) {
          const esmConfig = outputConfig.esm === true ? {} : outputConfig.esm
          const esmDir = esmConfig.dir || 'esm'  // 默认目录改为 'esm'
          const esmPlugins = await this.pluginManager.transformPluginsForFormat(config.plugins || [], esmDir, { emitDts: true })
          const esmInput = esmConfig.input
            ? await normalizeInput(esmConfig.input, process.cwd(), config.exclude)
            : filteredInput

          // 解析 banner/footer/intro/outro
          const banners = await this.resolveBanners(config)

          // 添加 ESM 样式清理插件 (TDesign 风格: ESM 产物不包含 style/ 目录)
          const esmStyleCleanupPlugin = this.styleHandler.createEsmStyleCleanupPlugin(esmDir)

          configs.push({
            input: esmInput,
            external: config.external,
            plugins: [...basePlugins, ...esmPlugins, esmStyleCleanupPlugin],
            output: {
              dir: esmDir,
              format: 'es',
              sourcemap: esmConfig.sourcemap ?? outputConfig.sourcemap,
              entryFileNames: '[name].js',  // 使用 .js 扩展名
              chunkFileNames: '[name].js',
              assetFileNames: '[name].[ext]',
              exports: esmConfig.exports ?? 'auto',
              preserveModules: esmConfig.preserveStructure ?? true,
              preserveModulesRoot: 'src',
              globals: outputConfig.globals,
              name: outputConfig.name,
              ...banners
            },
            treeshake: config.treeshake,
            onwarn: this.getOnWarn(config)
          })
        }

        // 处理 CJS 配置 (TDesign 风格: .js + 忽略样式)
        // 支持 cjs 和 lib 作为键名
        const cjsOutputConfig = outputConfig.cjs || outputConfig.lib
        if (cjsOutputConfig && cjsOutputConfig !== false) {
          const cjsConfig = cjsOutputConfig === true ? {} : cjsOutputConfig
          const cjsDir = cjsConfig.dir || 'lib'  // 默认目录改为 'lib'
          // CJS 格式也生成 DTS 文件
          const cjsPlugins = await this.pluginManager.transformPluginsForFormat(config.plugins || [], cjsDir, { emitDts: true })
          const cjsInput = cjsConfig.input
            ? await normalizeInput(cjsConfig.input, process.cwd(), config.exclude)
            : filteredInput

          // 解析 banner/footer/intro/outro
          const banners = await this.resolveBanners(config)

          configs.push({
            input: cjsInput,
            external: config.external,
            plugins: [...basePlugins, ...cjsPlugins],
            output: {
              dir: cjsDir,
              format: 'cjs',
              sourcemap: cjsConfig.sourcemap ?? outputConfig.sourcemap,
              entryFileNames: '[name].js',  // 使用 .js 扩展名 (不是 .cjs)
              chunkFileNames: '[name].js',
              assetFileNames: '[name].[ext]',
              exports: cjsConfig.exports ?? 'named',
              preserveModules: cjsConfig.preserveStructure ?? true,
              preserveModulesRoot: 'src',
              globals: outputConfig.globals,
              name: outputConfig.name,
              ...banners
            },
            treeshake: config.treeshake,
            onwarn: this.getOnWarn(config)
          })
        }

        // 处理 UMD 配置
        // 支持 umd 和 dist 作为键名
        const umdOutputConfig = outputConfig.umd || outputConfig.dist || (config as any).umd
        if (umdOutputConfig && umdOutputConfig !== false) {
          const umdCfg = await this.createUMDConfig(config, filteredInput, umdOutputConfig)
          // umdCfg 现在可能是数组（包含常规版本和压缩版本）
          if (Array.isArray(umdCfg)) {
            configs.push(...umdCfg)
          } else {
            configs.push(umdCfg)
          }
        }

        // 如果未声明 umd，不自动添加
        // UMD 应该通过配置显式启用，或者在 output.format 中包含 'umd'

        if (configs.length > 0) {
          this.multiConfigs = configs

          // 为了兼容测试，返回包含output数组的配置
          // 使用类型断言，因为 Rollup 内部类型与 BundlerSpecificConfig 略有差异
          if (configs.length > 1) {
            return {
              ...rollupConfig,
              output: configs.map(config => config.output).filter(Boolean)
            } as unknown as BundlerSpecificConfig
          }
          return configs[0] as unknown as BundlerSpecificConfig
        }
        // 如果没有任何子配置，则回退到单一输出逻辑
      }

      // 处理数组或者单一 format 字段
      // 处理多格式输出
      if (Array.isArray(outputConfig.format)) {
        // 原有多格式逻辑（略微精简），同上
        const isMultiEntry = this.formatMapper.isMultiEntryBuild(filteredInput)
        let formats = outputConfig.format
        const umdConfig = await this.handleUMDConfig(config, filteredInput, formats, isMultiEntry)

        // 过滤掉 UMD 和 IIFE 格式（它们由独立配置处理）
        formats = formats.filter((f: any) => f !== 'umd' && f !== 'iife')

        const configs: RollupOptions[] = []
        for (const format of formats) {
          const mapped = this.formatMapper.mapFormat(format)
          const isESM = format === 'esm'
          const isCJS = format === 'cjs'
          const dir = isESM ? 'es' : isCJS ? 'lib' : 'dist'
          const entryFileNames = isESM ? '[name].js' : isCJS ? '[name].cjs' : '[name].js'
          const chunkFileNames = entryFileNames
          const formatPlugins = await this.pluginManager.transformPluginsForFormat(config.plugins || [], dir, { emitDts: true })
          try {
            const names = [...(formatPlugins || [])].map((p: any) => p?.name || '(anon)')
            this.logger.info(`[${format}] 有效插件: ${names.join(', ')}`)
          } catch { }

          // 解析 banner/footer/intro/outro
          const banners = await this.resolveBanners(config)

          configs.push({
            input: filteredInput,
            external: config.external,
            plugins: [...basePlugins, ...formatPlugins],
            output: {
              dir,
              format: mapped,
              name: outputConfig.name,
              sourcemap: outputConfig.sourcemap,
              globals: outputConfig.globals,
              entryFileNames,
              chunkFileNames,
              assetFileNames: '[name].[ext]',
              exports: isESM ? (outputConfig as any).exports ?? 'auto' : 'named',
              preserveModules: isESM || isCJS,
              preserveModulesRoot: (isESM || isCJS) ? 'src' : undefined,
              ...banners
            },
            treeshake: config.treeshake,
            onwarn: this.getOnWarn(config)
          })
        }
        if (umdConfig) {
          // umdConfig 现在可能是数组（包含常规版本和压缩版本）
          if (Array.isArray(umdConfig)) {
            configs.push(...umdConfig)
          } else {
            configs.push(umdConfig)
          }
        }
        this.multiConfigs = configs

        // 为了兼容测试，返回包含output数组的配置
        // 使用类型断言，因为 Rollup 内部类型与 BundlerSpecificConfig 略有差异
        if (configs.length > 1) {
          return {
            ...rollupConfig,
            output: configs.map(config => config.output).filter(Boolean)
          } as unknown as BundlerSpecificConfig
        }
        return configs[0] as unknown as BundlerSpecificConfig
      } else {
        const format = (outputConfig as any).format
        const mapped = this.formatMapper.mapFormat(format)
        const isESM = format === 'esm'
        const isCJS = format === 'cjs'
        // 使用配置中的输出目录，如果没有则使用默认值
        const defaultDir = isESM ? 'es' : isCJS ? 'lib' : 'dist'
        const dir = outputConfig.dir || defaultDir
        const entryFileNames = isESM ? '[name].js' : isCJS ? '[name].cjs' : '[name].js'
        const chunkFileNames = entryFileNames
        const userPlugins = await this.pluginManager.transformPluginsForFormat(config.plugins || [], dir, { emitDts: true })
        try {
          const names = [...(userPlugins || [])].map((p: any) => p?.name || '(anon)')
          this.logger.info(`[${format}] 有效插件: ${names.join(', ')}`)
        } catch { }

        // 解析 banner/footer/intro/outro
        const banners = await this.resolveBanners(config)

        rollupConfig.plugins = [...basePlugins, ...userPlugins]
        rollupConfig.output = {
          dir,
          format: mapped,
          name: outputConfig.name,
          sourcemap: outputConfig.sourcemap,
          globals: outputConfig.globals,
          entryFileNames,
          chunkFileNames,
          assetFileNames: '[name].[ext]',
          exports: isESM ? (outputConfig as any).exports ?? 'auto' : 'named',
          preserveModules: isESM || isCJS,
          preserveModulesRoot: (isESM || isCJS) ? 'src' : undefined,
          ...banners
        }
      }
    }

    // 转换其他选项
    if (config.treeshake !== undefined) {
      rollupConfig.treeshake = config.treeshake
    }

    // 使用类型断言，因为 Rollup 内部类型与 BundlerSpecificConfig 略有差异
    return rollupConfig as unknown as BundlerSpecificConfig
  }

  /**
   * 转换统一插件格式为 Rollup 插件格式
   */
  async transformPlugins(plugins: UnifiedPlugin[]): Promise<BundlerSpecificPlugin[]> {
    return this.pluginManager.transformPluginsForFormat(plugins, 'dist', { emitDts: false })
  }

  /**
   * 检查功能支持
   */
  supportsFeature(feature: any): boolean {
    // Rollup 支持的功能
    const supportedFeatures = [
      'treeshaking',
      'code-splitting',
      'dynamic-import',
      'sourcemap',
      'plugin-system',
      'config-file',
      'cache-support'
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
      'worker-support': false,
      'css-bundling': false,
      'asset-processing': true,
      sourcemap: true,
      minification: false,
      'hot-reload': false,
      'module-federation': false,
      'incremental-build': false,
      'parallel-build': false,
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
      },
      bundleSize: 0 // 添加bundleSize属性
    }
  }






  /**
   * 尝试加载 Acorn 插件（JSX 与 TypeScript），以便 Rollup 在插件转换之前也能解析相应语法
   */
  private async getAcornPlugins(): Promise<any[]> {
    const plugins: any[] = []
    try {
      const jsx = (await import('acorn-jsx')).default
      // acorn-jsx 返回一个插件工厂函数
      plugins.push(jsx())
    } catch (e) {
      // 忽略
    }

    try {
      const ts = (await import('acorn-typescript')).default
      plugins.push(ts())
    } catch (e) {
      // 忽略
    }

    return plugins
  }

  /**
   * 清理资源
   */
  async dispose(): Promise<void> {
    // Rollup 适配器没有需要清理的资源
  }

  /**
   * 加载 Rollup
   */
  private async loadRollup(): Promise<any> {
    try {
      // 使用动态 import 加载 Rollup
      return await import('rollup')
    } catch (error) {
      throw new Error('Rollup 未安装，请运行: npm install rollup --save-dev')
    }
  }

  /**
   * 获取基础插件（内置）
   * - node-resolve: 解决第三方包解析，并优先浏览器分支
   * - commonjs: 兼容 CommonJS 包
   * - json: 允许 import JSON（如某些包内的 package.json 或配置 JSON）
   */
  private async getBasePlugins(config: UnifiedConfig): Promise<BundlerSpecificPlugin[]> {
    try {
      this.logger.debug('    加载 @rollup/plugin-node-resolve...')
      const { nodeResolve } = await import('@rollup/plugin-node-resolve')
      this.logger.debug('    ✅ node-resolve 加载完成')

      this.logger.debug('    加载 @rollup/plugin-commonjs...')
      const commonjs = (await import('@rollup/plugin-commonjs')).default
      this.logger.debug('    ✅ commonjs 加载完成')

      this.logger.debug('    加载 @rollup/plugin-json...')
      const json = (await import('@rollup/plugin-json')).default
      this.logger.debug('    ✅ json 加载完成')

      this.logger.debug('    配置 node-resolve 插件...')
      const resolvePlugin = nodeResolve({
        browser: true,
        preferBuiltins: false,
        extensions: ['.mjs', '.js', '.json', '.ts', '.tsx']
      })

      this.logger.debug('    配置 commonjs 插件...')
      const commonjsPlugin = commonjs({
        include: /node_modules/,
        ignoreDynamicRequires: false
      })

      this.logger.debug('    配置 json 插件...')
      const jsonPlugin = json({
        // 优化 JSON 插件配置
        compact: false,  // 保持 JSON 格式化，便于调试
        namedExports: true,  // 支持命名导出
        preferConst: true,  // 使用 const 声明
        // 包含所有 JSON 文件
        include: ['**/*.json'],
        exclude: ['node_modules/**']
      })

      const plugins = [
        resolvePlugin as unknown as BundlerSpecificPlugin,
        commonjsPlugin as unknown as BundlerSpecificPlugin,
        jsonPlugin as unknown as BundlerSpecificPlugin
      ]

      // 添加 Babel 插件（如果启用）
      this.logger.debug('    检查 Babel 插件...')
      const babelPlugin = await this.getBabelPlugin(config)
      if (babelPlugin) {
        this.logger.debug('    ✅ Babel 插件已添加')
        plugins.push(babelPlugin)
      } else {
        this.logger.debug('    ⊗ Babel 插件未启用')
      }

      this.logger.debug(`    ✅ 基础插件加载完成，共 ${plugins.length} 个`)
      return plugins
    } catch (error) {
      this.logger.warn('基础插件加载失败，将尝试继续构建', (error as Error).message)
      return []
    }
  }

  /**
   * 获取 Babel 插件
   */
  private async getBabelPlugin(config: UnifiedConfig): Promise<BundlerSpecificPlugin | null> {
    const babelConfig = (config as any).babel

    if (!babelConfig?.enabled) {
      return null
    }

    try {
      const { getBabelOutputPlugin } = await import('@rollup/plugin-babel')

      const babelOptions: any = {
        babelHelpers: babelConfig.runtime ? 'runtime' : 'bundled',
        exclude: babelConfig.exclude || /node_modules/,
        include: babelConfig.include,
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
        presets: babelConfig.presets || [],
        plugins: babelConfig.plugins || []
      }

      // 添加默认预设（如果没有指定）
      if (babelOptions.presets.length === 0) {
        babelOptions.presets = [
          ['@babel/preset-env', {
            targets: babelConfig.targets || 'defaults',
            useBuiltIns: babelConfig.polyfill === 'usage' ? 'usage' : false,
            corejs: babelConfig.polyfill ? 3 : false
          }]
        ]
      }

      // 添加运行时插件（如果启用）
      if (babelConfig.runtime && !babelOptions.plugins.some((p: any) =>
        (Array.isArray(p) ? p[0] : p).includes('@babel/plugin-transform-runtime')
      )) {
        babelOptions.plugins.push(['@babel/plugin-transform-runtime', {
          corejs: false,
          helpers: true,
          regenerator: true,
          useESModules: true
        }])
      }

      // 使用配置文件（如果指定）
      if (babelConfig.configFile !== false) {
        babelOptions.configFile = babelConfig.configFile
      }

      if (babelConfig.babelrc !== false) {
        babelOptions.babelrc = babelConfig.babelrc
      }

      return getBabelOutputPlugin(babelOptions) as unknown as BundlerSpecificPlugin
    } catch (error) {
      this.logger.warn('Babel 插件加载失败，将跳过 Babel 转换', (error as Error).message)
      return null
    }
  }

  /**
   * 解析 Banner 配置
   * 委托给 RollupBannerGenerator 处理
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
   * 创建 UMD 配置（返回常规版本和压缩版本的数组）
   *
   * 此方法现在委托给 RollupUMDBuilder 处理
   */
  private async createUMDConfig(
    config: UnifiedConfig,
    filteredInput?: string | string[] | Record<string, string>,
    umdOutputConfig?: any
  ): Promise<any[]> {
    // 获取基础插件和用户插件
    const basePlugins = await this.getBasePlugins(config)
    // 优先使用传入的 umdOutputConfig，其次使用 config.umd 或 config.output.umd
    const umdSection = umdOutputConfig || (config as any).umd || (config as any).output?.umd || {}
    const userPlugins = await this.pluginManager.transformPluginsForFormat(
      config.plugins || [],
      (umdSection.dir || 'dist'),
      { emitDts: false }
    )

    // 调试：打印 UMD 插件列表
    try {
      const names = [...(userPlugins || [])].map((p: any) => p?.name || '(anon)')
      this.logger.info(`[UMD] 有效插件: ${names.join(', ')}`)
    } catch { }

    // 委托给 RollupUMDBuilder 处理
    // 如果有 umdOutputConfig，将其合并到 config 中以便 umdBuilder 使用
    const configWithUmd = umdOutputConfig
      ? { ...config, umd: { ...(config as any).umd, ...umdSection } }
      : config
    return await this.umdBuilder.createUMDConfig(
      configWithUmd,
      filteredInput,
      basePlugins,
      userPlugins,
      (cfg) => this.getOnWarn(cfg)
    )
  }

  /**
   * 统一的 onwarn 处理：过滤不必要的告警
   */
  private getOnWarn(config?: any) {
    // 如果配置了 logLevel 为 silent，完全抑制所有警告
    if (config?.logLevel === 'silent') {
      return () => {
        // 完全静默，不输出任何警告
      }
    }

    // 如果用户配置了自定义的 onwarn 处理器，优先使用用户的配置
    if (config?.build?.rollupOptions?.onwarn) {
      return config.build.rollupOptions.onwarn
    }

    const ignoredCodes = new Set([
      'NAMESPACE_CONFLICT',
      'MIXED_EXPORTS',
      'EMPTY_BUNDLE',           // 忽略空chunk警告
      'FILE_NAME_CONFLICT',     // 忽略文件名冲突警告
      'MISSING_GLOBAL_NAME',    // 忽略外部模块globals警告
      'UNRESOLVED_IMPORT',      // 忽略未解析的导入警告
    ])

    return (warning: any, defaultHandler: (w: any) => void) => {
      // 过滤常见非致命告警
      if (ignoredCodes.has(warning.code)) return

      // 过滤 CSS 文件覆盖警告
      if (warning.code === 'FILE_NAME_CONFLICT' && warning.message?.includes('.css.map')) {
        return
      }

      // 过滤 Vue 组件文件的类型声明警告
      if (warning.code === 'UNRESOLVED_IMPORT' && warning.source?.endsWith('.vue')) {
        return
      }

      // 过滤 Node.js 内置模块警告
      if (warning.code === 'UNRESOLVED_IMPORT' && warning.source?.startsWith('node:')) {
        return
      }

      // 过滤 TypeScript 警告（完全静默）
      if (warning.code === 'PLUGIN_WARNING' && warning.plugin === 'typescript') {
        const msg = String(warning.message || '')

        // 完全过滤所有 TypeScript 警告
        if (msg.includes('TS')) return

        // 不在控制台显示
        return
      }

      // 其他严重警告输出到控制台
      if (warning.code === 'PLUGIN_ERROR') {
        defaultHandler(warning)
      }
    }
  }

  /**
   * 处理 UMD 配置逻辑
   * 提取复杂的 UMD 配置判断逻辑，减少嵌套
   *
   * @param config - 统一配置
   * @param filteredInput - 过滤后的输入
   * @param formats - 输出格式数组
   * @param isMultiEntry - 是否为多入口构建
   * @returns UMD 配置（可能为 null、单个配置或配置数组）
   */
  private async handleUMDConfig(
    config: UnifiedConfig,
    filteredInput: any,
    formats: any[],
    isMultiEntry: boolean
  ): Promise<RollupOptions | RollupOptions[] | null> {
    const umdSettings = (config as any).umd
    const hasUMDFormat = formats.includes('umd')
    const hasUMDSection = Boolean(umdSettings || (config as any).output?.umd)

    // 多入口构建的 UMD 处理
    if (isMultiEntry) {
      return this.handleMultiEntryUMD(config, filteredInput, hasUMDFormat, umdSettings, formats)
    }

    // 单入口构建的 UMD 处理
    if (hasUMDFormat || umdSettings?.enabled || hasUMDSection) {
      return await this.createUMDConfig(config, filteredInput)
    }

    return null
  }

  /**
   * 处理多入口构建的 UMD 配置
   *
   * @param config - 统一配置
   * @param filteredInput - 过滤后的输入
   * @param hasUMDFormat - 格式数组中是否包含 UMD
   * @param umdSettings - UMD 配置对象
   * @param originalFormats - 原始格式数组
   * @returns UMD 配置或 null
   */
  private async handleMultiEntryUMD(
    config: UnifiedConfig,
    filteredInput: any,
    hasUMDFormat: boolean,
    umdSettings: any,
    originalFormats: any[]
  ): Promise<RollupOptions | RollupOptions[] | null> {
    const forceUMD = umdSettings?.forceMultiEntry || false
    const umdEnabled = umdSettings?.enabled

    this.logger.info(
      `多入口项目UMD检查: hasUMD=${hasUMDFormat}, forceUMD=${forceUMD}, umdEnabled=${umdEnabled}`
    )

    // 强制启用 UMD
    if (hasUMDFormat && forceUMD) {
      this.logger.info('多入口项目强制启用 UMD 构建')
      return await this.createUMDConfig(config, filteredInput)
    }

    // 格式中包含 UMD 且未禁用
    if (hasUMDFormat && umdEnabled !== false) {
      this.logger.info('为多入口项目创建独立的 UMD 构建')
      return await this.createUMDConfig(config, filteredInput)
    }

    // 显式启用 UMD
    if (umdEnabled) {
      this.logger.info('根据UMD配置为多入口项目创建 UMD 构建')
      return await this.createUMDConfig(config, filteredInput)
    }

    // 检查是否有被过滤的格式
    const filteredFormats = originalFormats.filter(
      (format: any) => format === 'umd' || format === 'iife'
    )
    if (filteredFormats.length > 0) {
      this.logger.warn(
        `多入口构建不支持 ${filteredFormats.join(', ')} 格式，已自动过滤`
      )
    }

    return null
  }
}
