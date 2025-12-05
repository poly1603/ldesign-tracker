/**
 * 构建命令实现
 */

import { Command } from 'commander'
import { LibraryBuilder } from '../../core/LibraryBuilder'
import { logger, highlight } from '../../utils/logger'
import { formatFileSize, formatDuration } from '../../utils/formatters/format-utils'
import { ConfigLoader } from '../../utils/config/config-loader'
import { ConfigValidator } from '../../core/ConfigValidator'
import type { BuilderConfig } from '../../types/config'
import path from 'path'
import { writeFile } from '../../utils/file-system'

/**
 * 构建命令选项
 */
interface BuildOptions {
  config?: string
  bundler?: 'rollup' | 'rolldown' | 'esbuild' | 'swc'
  mode?: 'development' | 'production'
  input?: string
  output?: string
  format?: string
  minify?: boolean
  sourcemap?: boolean
  clean?: boolean
  analyze?: boolean
  watch?: boolean
  report?: string | boolean
  sizeLimit?: string
  debug?: boolean
}

/**
 * 创建构建命令
 */
export const buildCommand = new Command('build')
  .description('构建库文件')
  .option('-i, --input <path>', '指定入口文件')
  .option('-o, --output <dir>', '指定输出目录')
  .option('-f, --format <formats>', '指定输出格式 (esm,cjs,umd,iife)')
  .option('--minify', '启用代码压缩')
  .option('--no-minify', '禁用代码压缩')
  .option('--sourcemap', '生成 sourcemap')
  .option('--no-sourcemap', '不生成 sourcemap')
  .option('--clean', '构建前清理输出目录')
  .option('--no-clean', '构建前不清理输出目录')
  .option('--analyze', '分析打包结果')
  .option('--report [file]', '输出构建报告 JSON 文件（默认 dist/build-report.json）')
  .option('--size-limit <limit>', '设置总包体或单产物大小上限，如 200k、1mb、或字节数')
  .option('-w, --watch', '监听文件变化')
  .option('--debug', '启用调试模式，输出详细构建信息')
  .action(async (options: BuildOptions, command: Command) => {
    try {
      await executeBuild(options, command.parent?.opts())
    } catch (error) {
      logger.error('构建失败:', error)
      process.exit(1)
    }
  })

/**
 * 执行构建
 */
async function executeBuild(options: BuildOptions, globalOptions: any = {}): Promise<void> {
  const startTime = Date.now()
  const isDebug = options.debug || process.env.DEBUG === 'true'

  // 调试模式下输出详细信息
  if (isDebug) {
    logger.info('🔍 调试模式已启用')
    logger.info('📋 构建选项:', JSON.stringify(options, null, 2))
    logger.info('🌍 环境变量:', {
      NODE_ENV: process.env.NODE_ENV,
      DEBUG: process.env.DEBUG,
      cwd: process.cwd()
    })
  }

  // 全局拦截 TypeScript 警告输出（调试模式下不拦截）
  const originalStderrWrite = process.stderr.write
  const originalConsoleWarn = console.warn
  const originalConsoleError = console.error

  const suppressedPatterns = [
    'TypeScript 编译警告',
    'Cannot find module',
    'Cannot find type definition',
    '@rollup/plugin-typescript TS',
    '.vue',
    'TS2307',
    'TS2688'
  ]

  const shouldSuppress = (msg: string) => !isDebug && suppressedPatterns.some(p => msg.includes(p))

  // 拦截 stderr
  process.stderr.write = function (...args: any[]): boolean {
    const msg = String(args[0] || '')
    if (!shouldSuppress(msg)) {
      return originalStderrWrite.apply(process.stderr, args as any)
    }
    return true
  } as any

  // 拦截 console.warn
  console.warn = (...args: any[]) => {
    const msg = args.join(' ')
    if (!shouldSuppress(msg)) {
      originalConsoleWarn.apply(console, args)
    }
  }

  // 拦截 console.error
  console.error = (...args: any[]) => {
    const msg = args.join(' ')
    if (!shouldSuppress(msg)) {
      originalConsoleError.apply(console, args)
    }
  }

  try {
    // 阶段计时器
    const timings: Record<string, number> = {}
    let phaseStart = Date.now()

    // 创建构建器实例（调试模式使用详细日志）
    const builderLogger = isDebug
      ? logger.child('Builder', { level: 'debug', silent: false })
      : logger.child('Builder', { level: 'error', silent: false })
    const builder = new LibraryBuilder({
      logger: builderLogger,
      autoDetect: true
    })

    // 初始化构建器
    await builder.initialize()
    timings['初始化'] = Date.now() - phaseStart
    if (isDebug) logger.debug(`⏱️ 初始化耗时: ${timings['初始化']}ms`)

    // 构建配置
    phaseStart = Date.now()
    const config = await buildConfig(options, globalOptions)
    timings['配置加载'] = Date.now() - phaseStart
    if (isDebug) {
      logger.debug(`⏱️ 配置加载耗时: ${timings['配置加载']}ms`)
      logger.debug('📦 最终配置:', JSON.stringify(config, null, 2))
    }

    // 显示简化的配置信息
    showBuildInfo(config)

    // 🔍 智能兼容性检查
    const bundlerName = globalOptions?.bundler || config.bundler || 'rollup'
    const skipCompatCheck = globalOptions?.compatCheck === false || globalOptions?.force

    if (bundlerName && bundlerName !== 'rollup' && !skipCompatCheck) {
      const validator = new ConfigValidator({}, logger)
      const compatResult = await validator.validateBundlerCompatibility(
        bundlerName,
        process.cwd()
      )

      // 显示兼容性警告和建议
      if (compatResult.warnings.length > 0 || compatResult.suggestions.length > 0) {
        validator.printCompatibilityWarnings(compatResult, logger)

        // 如果完全不兼容，给出提示
        if (!compatResult.compatible) {
          logger.warn('💡 提示: 使用 --force 或 --no-compat-check 可以跳过此检查')
          logger.warn('')
        }
      }
    }

    // 执行构建
    let result
    if (options.watch) {
      logger.info('启动监听模式...')
      const watcher = await builder.buildWatch(config)
      let buildCount = 0
      let lastBuildTime = Date.now()

      // 清屏函数
      const clearScreen = () => {
        if (process.stdout.isTTY) {
          process.stdout.write('\x1B[2J\x1B[0f')
        }
      }

      // 系统通知函数（跨平台）
      const sendNotification = async (title: string, message: string, success: boolean) => {
        try {
          const { exec } = await import('child_process')
          const platform = process.platform
          if (platform === 'darwin') {
            exec(`osascript -e 'display notification "${message}" with title "${title}"'`)
          } else if (platform === 'win32') {
            // Windows PowerShell 通知
            exec(`powershell -Command "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null; $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02); $template.SelectSingleNode('//text[@id=1]').InnerText = '${title}'; $template.SelectSingleNode('//text[@id=2]').InnerText = '${message}'"`)
          } else if (platform === 'linux') {
            exec(`notify-send "${title}" "${message}"`)
          }
        } catch { /* 通知失败不影响构建 */ }
      }

      // 监听构建事件
      watcher.on('change', (file) => {
        clearScreen()
        logger.info(`📝 文件变化: ${highlight.path(file)}`)
        logger.info('🔄 重新构建中...')
      })

      watcher.on('build', (buildResult) => {
        buildCount++
        const now = Date.now()
        const rebuildTime = now - lastBuildTime
        lastBuildTime = now

        clearScreen()
        logger.info(`\n${'═'.repeat(50)}`)
        logger.info(`📦 构建 #${buildCount} 完成`)
        logger.info(`⏱️  重建耗时: ${rebuildTime}ms`)
        showBuildResult(buildResult, startTime, timings)
        logger.info(`${'═'.repeat(50)}\n`)
        logger.info('👀 监听文件变化中... (按 Ctrl+C 停止)')

        // 发送系统通知
        const success = !buildResult.errors?.length
        sendNotification(
          success ? '✅ 构建成功' : '❌ 构建失败',
          success ? `构建 #${buildCount} 完成 (${rebuildTime}ms)` : `构建 #${buildCount} 失败`,
          success
        )
      })

      watcher.on('error', (error) => {
        logger.error('❌ 构建错误:', error)
        sendNotification('❌ 构建错误', String(error), false)
      })

      // 保持进程运行
      process.on('SIGINT', async () => {
        logger.info(`\n🛑 正在停止监听...`)
        await watcher.close()
        await builder.dispose()
        logger.info(`👋 已完成 ${buildCount} 次构建，再见！`)
        process.exit(0)
      })

      logger.success(`🚀 监听模式已启动`)
      logger.info(`👀 监听文件变化中... (按 Ctrl+C 停止)`)
      return
    } else {
      phaseStart = Date.now()
      logger.info(`🔨 开始打包...`)

      // 使用进度跟踪
      let progressPhase = 0
      const progressInterval = setInterval(() => {
        const spinner = logger.createSpinner(progressPhase++)
        process.stdout.write(`\r${spinner} 构建中... `)
      }, 100)

      try {
        result = await builder.build(config)
        clearInterval(progressInterval)
        process.stdout.write('\r' + ' '.repeat(50) + '\r') // 清除进度行
      } catch (error) {
        clearInterval(progressInterval)
        process.stdout.write('\r' + ' '.repeat(50) + '\r') // 清除进度行
        throw error
      }

      timings['打包'] = Date.now() - phaseStart
    }

    // 生成 TypeScript 声明文件（如果需要）
    // 从命令行选项和配置文件读取
    const originalFormats = options.format ? options.format.split(',').map(f => f.trim()) : []
    const hasDtsFromCli = originalFormats.includes('dts') || originalFormats.includes('declaration') || originalFormats.includes('types')
    const hasDtsFromConfig = config.dts === true
    const hasDts = hasDtsFromCli || hasDtsFromConfig

    if (hasDts) {
      phaseStart = Date.now()
      logger.info(`📝 生成类型声明文件...`)

      const { generateDts } = await import('../../generators/DtsGenerator')
      const fse = await import('fs-extra')
      const srcDir = config.input && typeof config.input === 'string' && config.input.startsWith('src/')
        ? 'src'
        : 'src'

      // 从配置中提取需要生成 DTS 的输出目录
      // 支持数组格式和对象格式配置
      const outputDirs: string[] = []
      const outputConfig = config.output

      if (Array.isArray(outputConfig)) {
        // 数组格式: [{ format: 'esm', dir: 'es' }, ...]
        for (const item of outputConfig) {
          const dir = item.dir
          const format = item.format
          // 排除 UMD/dist 目录，只为 ESM 和 CJS 生成 DTS
          if (dir && format !== 'umd' && dir !== 'dist') {
            if (!outputDirs.includes(dir)) {
              outputDirs.push(dir)
            }
          }
        }
      } else if (outputConfig) {
        // 对象格式: { es: {...}, esm: {...}, lib: {...}, dist: {...} }
        const oc = outputConfig as any
        const formats = Array.isArray(oc.format) ? oc.format : [oc.format].filter(Boolean)
        if (formats.includes('esm')) outputDirs.push('es')
        if (formats.includes('cjs')) outputDirs.push('lib')
        // 检查子配置
        if (oc.es) outputDirs.push('es')
        if (oc.esm) outputDirs.push('esm')
        if (oc.cjs || oc.lib) outputDirs.push('lib')
        // 去重
        const uniqueDirs = [...new Set(outputDirs)]
        outputDirs.length = 0
        outputDirs.push(...uniqueDirs)
      }

      // 如果没有指定其他格式，默认生成到 es 目录
      if (outputDirs.length === 0) {
        outputDirs.push('es')
      }

      // 优化: 只生成一次 DTS，然后复制到其他目录
      const primaryDir = outputDirs[0]
      const otherDirs = outputDirs.slice(1)

      try {
        // 生成 DTS 到第一个目录
        const dtsResult = await generateDts({
          srcDir,
          outDir: primaryDir,
          preserveStructure: true,
          declarationMap: config.sourcemap === true || config.sourcemap === 'inline',
          rootDir: process.cwd()
        })

        if (dtsResult.success) {
          logger.success(`✅ 已生成 ${dtsResult.files.length} 个声明文件到 ${primaryDir}/`)

          // 复制 DTS 文件到其他目录（比重新生成快得多）
          for (const targetDir of otherDirs) {
            try {
              // 确保目标目录存在
              await fse.ensureDir(targetDir)

              // 复制所有 .d.ts 和 .d.ts.map 文件
              let copiedCount = 0
              for (const filePath of dtsResult.files) {
                // 文件路径是相对于项目根目录的完整路径，如 es/index.d.ts
                // 需要将 primaryDir 替换为 targetDir
                const relativePath = path.relative(primaryDir, filePath)
                const destPath = path.join(targetDir, relativePath)

                // 确保目标文件的目录存在
                await fse.ensureDir(path.dirname(destPath))

                // 复制文件
                if (await fse.pathExists(filePath)) {
                  await fse.copy(filePath, destPath)
                  copiedCount++
                }
              }

              logger.success(`✅ 已复制 ${copiedCount} 个声明文件到 ${targetDir}/`)
            } catch (copyError) {
              logger.warn(`⚠️  复制声明文件到 ${targetDir}/ 失败: ${copyError instanceof Error ? copyError.message : String(copyError)}`)
            }
          }
        } else {
          logger.warn(`⚠️  生成声明文件到 ${primaryDir}/ 时出现错误`)
          if (dtsResult.errors && dtsResult.errors.length > 0) {
            dtsResult.errors.forEach(err => logger.error(err))
          }
        }
      } catch (error) {
        logger.warn(`⚠️  生成声明文件失败: ${error instanceof Error ? error.message : String(error)}`)
      }

      timings['类型声明'] = Date.now() - phaseStart
    }

    // 显示构建结果
    showBuildResult(result, startTime, timings)

    // 分析打包结果
    if (options.analyze) {
      phaseStart = Date.now()
      await analyzeBuildResult(result)
      timings['分析'] = Date.now() - phaseStart
    }

    // 输出构建报告（JSON）
    if (options.report) {
      phaseStart = Date.now()
      const reportPath = typeof options.report === 'string' && options.report.trim()
        ? options.report
        : path.join((config.output?.dir || 'dist'), 'build-report.json')
      await writeBuildReport(result, reportPath)
      logger.info(`报告已输出: ${highlight.path(reportPath)}`)
      timings['报告生成'] = Date.now() - phaseStart
    }

    // 体积阈值检查（使用 gzip 优先，回退原始大小）
    if (options.sizeLimit) {
      enforceSizeLimit(result, options.sizeLimit)
    }

    // 清理资源
    phaseStart = Date.now()
    await builder.dispose()
    timings['清理'] = Date.now() - phaseStart

    logger.newLine()
    logger.complete(`✨ 构建完成`)

    // 恢复原始输出方法
    process.stderr.write = originalStderrWrite
    console.warn = originalConsoleWarn
    console.error = originalConsoleError

    // 确保进程正常退出
    // 使用 setImmediate 确保所有日志都已输出
    setImmediate(() => {
      process.exit(0)
    })

  } catch (error) {
    const duration = Date.now() - startTime
    logger.fail(`构建失败 ${highlight.time(`(${formatDuration(duration)})`)}`)

    // 恢复原始输出方法
    process.stderr.write = originalStderrWrite
    console.warn = originalConsoleWarn
    console.error = originalConsoleError

    // 确保进程退出
    setImmediate(() => {
      process.exit(1)
    })

    throw error
  }
}

/**
 * 构建配置
 */
async function buildConfig(options: BuildOptions, globalOptions: any): Promise<BuilderConfig> {
  // 使用ConfigManager加载配置（包含默认配置合并）
  const { ConfigManager } = await import('../..')
  const configManager = new ConfigManager()
  let baseConfig: BuilderConfig = await configManager.loadConfig({})

  try {
    const configPath = options.config
    if (configPath) {
      baseConfig = await configManager.loadConfig({ configFile: configPath })
    } else {
      // 查找配置文件
      const configLoader = new ConfigLoader()
      const foundConfigPath = await configLoader.findConfigFile()
      if (foundConfigPath) {
        baseConfig = await configManager.loadConfig({ configFile: foundConfigPath })
      } else {
        baseConfig = await configManager.loadConfig({})
      }
    }
  } catch (error) {
    // 配置加载失败静默处理
    baseConfig = await configManager.loadConfig({})
  }

  // 命令行选项覆盖配置文件
  const config: BuilderConfig = { ...baseConfig }

  // 基础配置
  if (options.input) {
    config.input = options.input
  }

  if (options.output) {
    config.output = { ...config.output, dir: options.output }
  }

  if (options.format) {
    const formats = options.format.split(',').map(f => f.trim())
    // 将 dts 从 Rollup 的 formats 中分离出来
    const rollupFormats = formats.filter(f => f !== 'dts' && f !== 'declaration' && f !== 'types')
    const hasDts = formats.some(f => f === 'dts' || f === 'declaration' || f === 'types')

    // 只将 Rollup 支持的格式传递给 output.format
    config.output = {
      ...config.output,
      format: rollupFormats.length > 0 ? rollupFormats as any : ['esm', 'cjs']
    }

      // 将完整的 formats（包括 dts）存储到配置中供后续使用
      ; (config as any)._formats = formats
  }

  // 构建选项
  if (options.minify !== undefined) {
    config.minify = options.minify
  }

  if (options.clean !== undefined) {
    config.clean = options.clean
  }

  // 输出选项
  if (options.sourcemap !== undefined) {
    config.output = { ...config.output, sourcemap: options.sourcemap }
  }

  // 全局选项 - CLI 参数优先级最高
  if (globalOptions.bundler) {
    config.bundler = globalOptions.bundler
    logger.debug(`CLI 指定打包器: ${globalOptions.bundler}`)
  } else if (config.bundler) {
    logger.debug(`配置文件指定打包器: ${config.bundler}`)
  }

  if (globalOptions.mode) {
    config.mode = globalOptions.mode
  }

  return config
}

/**
 * 显示构建信息（简化版）
 */
function showBuildInfo(config: BuilderConfig): void {
  const configItems: string[] = []

  if (config.input) {
    const inputStr = typeof config.input === 'string'
      ? config.input
      : Array.isArray(config.input)
        ? `${config.input.length} files`
        : 'multiple entries'
    configItems.push(highlight.dim(`入口: ${inputStr}`))
  }

  if (config.output?.format) {
    const formats = Array.isArray(config.output.format)
      ? config.output.format.join('+')
      : config.output.format
    configItems.push(`格式: ${highlight.important(formats)}`)
  }

  if (config.mode) {
    configItems.push(highlight.dim(`模式: ${config.mode}`))
  }

  // 一行显示所有配置项
  console.log(`📦 ${configItems.join(' | ')}`)
}

/**
 * 显示构建结果
 */
function showBuildResult(result: any, startTime: number, timings?: Record<string, number>): void {
  const duration = Date.now() - startTime

  if (result.outputs && result.outputs.length > 0) {
    // 计算统计信息
    const stats = {
      total: result.outputs.length,
      js: 0,
      map: 0,
      dts: 0,
      other: 0,
      totalSize: 0,
      totalGzipSize: 0
    }

    for (const output of result.outputs) {
      stats.totalSize += output.size || 0
      stats.totalGzipSize += output.gzipSize || 0

      if (output.fileName.endsWith('.d.ts') || output.fileName.endsWith('.d.cts')) {
        stats.dts++
      } else if (output.fileName.endsWith('.map')) {
        stats.map++
      } else if (output.fileName.endsWith('.js') || output.fileName.endsWith('.cjs')) {
        stats.js++
      } else {
        stats.other++
      }
    }

    // 使用增强的构建摘要显示
    logger.showBuildSummary({
      duration,
      fileCount: stats.total,
      totalSize: stats.totalSize,
      status: result.success ? 'success' : 'failed',
      warnings: result.warnings?.length || 0,
      errors: result.errors?.length || 0
    })

    // 根据日志级别显示不同详细程度的信息
    const logLevel = logger.getLevel()

    if (logLevel === 'debug' || logLevel === 'verbose') {
      // Debug 模式: 显示所有文件
      logger.info(`输出文件:`)
      for (const output of result.outputs) {
        const size = formatFileSize(output.size)
        const gzipSize = output.gzipSize ? ` ${highlight.dim(`(gzip: ${formatFileSize(output.gzipSize)})`)}` : ''
        logger.info(`  ${highlight.path(output.fileName)} ${highlight.dim(size)}${gzipSize}`)
      }
      logger.newLine()
    }

    // 显示详细信息
    logger.info(`📋 文件详情:`)
    logger.info(`  JS 文件: ${highlight.number(stats.js)} 个`)
    logger.info(`  DTS 文件: ${highlight.number(stats.dts)} 个`)
    logger.info(`  Source Map: ${highlight.number(stats.map)} 个`)
    if (stats.other > 0) {
      logger.info(`  其他文件: ${highlight.number(stats.other)} 个`)
    }

    if (stats.totalGzipSize > 0) {
      const compressionRatio = Math.round((1 - stats.totalGzipSize / stats.totalSize) * 100)
      logger.info(`  Gzip 后: ${highlight.size(formatFileSize(stats.totalGzipSize))} ${highlight.dim(`(压缩 ${compressionRatio}%)`)}`)
    }

    logger.newLine()
  }

  // 缓存摘要
  if (result.cache) {
    logger.newLine()
    const parts: string[] = []
    const enabledStr = result.cache.enabled ? '启用' : '禁用'
    parts.push(`状态 ${enabledStr}`)
    if (result.cache.enabled && typeof result.cache.hit === 'boolean') {
      parts.push(result.cache.hit ? '命中' : '未命中')
    }
    if (typeof result.cache.lookupMs === 'number') {
      parts.push(`查询 ${highlight.time(formatDuration(result.cache.lookupMs))}`)
    }
    if (result.cache.hit && typeof result.cache.savedMs === 'number' && result.cache.savedMs > 0) {
      parts.push(`节省 ${highlight.time(formatDuration(result.cache.savedMs))}`)
    }
    logger.info(`💾 缓存: ${parts.join('， ')}`)
  }

  if (result.warnings && result.warnings.length > 0) {
    logger.newLine()
    logger.warn(`⚠️  发现 ${highlight.number(result.warnings.length)} 个警告:`)
    for (const warning of result.warnings) {
      logger.warn(`  ${warning.message}`)
    }
  }

  // 显示阶段耗时统计
  if (timings && Object.keys(timings).length > 0) {
    logger.newLine()
    logger.info(`⏱️  阶段耗时:`)

    const sortedTimings = Object.entries(timings).sort((a, b) => b[1] - a[1])
    const maxTime = Math.max(...sortedTimings.map(([, time]) => time))

    for (const [phase, time] of sortedTimings) {
      const percentage = Math.round((time / duration) * 100)
      const barLength = Math.round((time / maxTime) * 20)
      const bar = '█'.repeat(barLength) + '░'.repeat(20 - barLength)

      logger.info(`  ${phase.padEnd(12)} ${highlight.dim(bar)} ${highlight.time(formatDuration(time).padStart(8))} ${highlight.dim(`(${percentage}%)`)}`)
    }
  }

  logger.newLine()
}

/**
 * 写出构建报告 JSON
 */
async function writeBuildReport(result: any, reportPath: string): Promise<void> {
  const files = (result.outputs || []).map((o: any) => ({
    fileName: o.fileName,
    type: o.type,
    format: o.format,
    size: o.size,
    gzipSize: o.gzipSize ?? null
  }))

  const totalRaw = files.reduce((s: number, f: any) => s + (f.size || 0), 0)
  const totalGzip = files.reduce((s: number, f: any) => s + (f.gzipSize || 0), 0)

  const report = {
    meta: {
      bundler: result.bundler,
      mode: result.mode,
      libraryType: result.libraryType || null,
      buildId: result.buildId,
      timestamp: result.timestamp,
      duration: result.duration,
      cache: result.cache || undefined
    },
    totals: {
      raw: totalRaw,
      gzip: totalGzip,
      fileCount: files.length
    },
    files
  }

  const abs = path.isAbsolute(reportPath) ? reportPath : path.resolve(process.cwd(), reportPath)
  await writeFile(abs, JSON.stringify(report, null, 2), 'utf8')
}

/**
 * 体积阈值检查（优先使用 gzip）
 * 超限则抛出错误
 */
function enforceSizeLimit(result: any, limitStr: string): void {
  const limit = parseSizeLimit(limitStr)
  if (!isFinite(limit) || limit <= 0) return

  const outputs = result.outputs || []
  const totalGzip = outputs.reduce((s: number, o: any) => s + (o.gzipSize || 0), 0)
  const totalRaw = outputs.reduce((s: number, o: any) => s + (o.size || 0), 0)
  const metric = totalGzip > 0 ? totalGzip : totalRaw
  const using = totalGzip > 0 ? 'gzip' : 'raw'

  if (metric > limit) {
    // 显示前若干个最大文件帮助定位
    const top = [...outputs]
      .sort((a: any, b: any) => (b.gzipSize || b.size || 0) - (a.gzipSize || a.size || 0))
      .slice(0, 5)
      .map((o: any) => `- ${o.fileName} ${formatFileSize(o.gzipSize || o.size)}${o.format ? ` (${o.format})` : ''}`)
      .join('\n')

    throw new Error(
      `构建包体超出限制: ${formatFileSize(metric)} > ${formatFileSize(limit)} （度量: ${using}）\nTop 较大文件:\n${top}`
    )
  }
}

/**
 * 解析尺寸字符串：支持 200k / 1mb / 12345（字节）
 */
function parseSizeLimit(input: string): number {
  const s = String(input || '').trim().toLowerCase()
  const m = s.match(/^(\d+(?:\.\d+)?)(b|kb|k|mb|m|gb|g)?$/i)
  if (!m) return Number(s) || 0
  const n = parseFloat(m[1])
  const unit = (m[2] || 'b').toLowerCase()
  const factor = unit === 'gb' || unit === 'g' ? 1024 ** 3
    : unit === 'mb' || unit === 'm' ? 1024 ** 2
      : unit === 'kb' || unit === 'k' ? 1024
        : 1
  return Math.round(n * factor)
}

async function analyzeBuildResult(result: any): Promise<void> {
  const { createBundleAnalyzer } = await import('../../utils/optimization/BundleAnalyzer')

  logger.newLine()
  logger.info('📊 正在分析打包结果...')

  const analyzer = createBundleAnalyzer(logger)
  const report = await analyzer.generateReport(result.outputs || [])

  // 显示体积分析
  logger.newLine()
  logger.info('📦 体积分析:')
  logger.info(`  总大小: ${(report.sizeAnalysis.total / 1024).toFixed(2)} KB`)

  if (report.sizeAnalysis.byModule.length > 0) {
    logger.info('  最大模块:')
    report.sizeAnalysis.byModule.slice(0, 5).forEach(m => {
      logger.info(`    ${m.module}: ${(m.size / 1024).toFixed(2)} KB (${m.percentage.toFixed(1)}%)`)
    })
  }

  // 显示重复依赖
  if (report.duplicates.length > 0) {
    logger.newLine()
    logger.warn(`⚠️  发现 ${report.duplicates.length} 个重复依赖:`)
    report.duplicates.forEach(dup => {
      logger.warn(`  ${dup.name}: ${dup.versions.length} 个版本`)
    })
  }

  // 显示优化建议
  if (report.suggestions.length > 0) {
    logger.newLine()
    logger.info('💡 优化建议:')
    report.suggestions.forEach((sug, index) => {
      const icon = sug.severity === 'high' ? '🔴' : sug.severity === 'medium' ? '🟡' : '🟢'
      logger.info(`  ${icon} ${sug.title}`)
      logger.info(`     ${sug.description}`)
      logger.info(`     建议: ${sug.solution}`)
    })
  }

  logger.newLine()
  logger.success('✅ 分析完成')
}
