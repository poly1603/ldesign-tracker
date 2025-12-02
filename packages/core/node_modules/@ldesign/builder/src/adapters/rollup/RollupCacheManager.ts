/**
 * Rollup 缓存管理器
 * 负责构建缓存的管理和验证
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import type { Logger } from '../../utils/logger'
import type { BuildResult } from '../../types/builder'
import { RollupCache } from '../../utils/cache'
import path from 'path'
import * as fs from 'fs-extra'

/**
 * Rollup 缓存管理器
 */
export class RollupCacheManager {
  private logger: Logger
  private cache: RollupCache

  constructor(logger: Logger, cacheOptions?: { cacheDir?: string; ttl?: number; maxSize?: number }) {
    this.logger = logger
    this.cache = new RollupCache(cacheOptions)
  }

  /**
   * 获取缓存
   */
  getCache(): RollupCache {
    return this.cache
  }

  /**
   * 检查缓存是否启用
   */
  isCacheEnabled(config: any): boolean {
    const c = (config as any)?.cache
    if (c === false) return false
    if (typeof c === 'object' && c) {
      if ('enabled' in c) return (c as any).enabled !== false
    }
    return true
  }

  /**
   * 解析缓存选项
   */
  resolveCacheOptions(config: any): { cacheDir?: string; ttl?: number; maxSize?: number } {
    const c = (config as any)?.cache
    const opts: { cacheDir?: string; ttl?: number; maxSize?: number } = {}

    if (typeof c === 'object' && c) {
      if (typeof c.dir === 'string' && c.dir.trim()) {
        opts.cacheDir = path.isAbsolute(c.dir) ? c.dir : path.resolve(process.cwd(), c.dir)
      }
      if (typeof c.maxAge === 'number' && isFinite(c.maxAge) && c.maxAge > 0) {
        opts.ttl = Math.floor(c.maxAge)
      }
      if (typeof c.maxSize === 'number' && isFinite(c.maxSize) && c.maxSize > 0) {
        opts.maxSize = Math.floor(c.maxSize)
      }
    }

    return opts
  }

  /**
   * 验证输出产物是否存在
   */
  async validateOutputArtifacts(config: any): Promise<boolean> {
    try {
      const outputConfig = config.output || {}
      const outputDir = config.outDir || 'dist'
      const mainOutputFiles: string[] = []

      // ESM 输出
      if (outputConfig.esm) {
        const esmDir = typeof outputConfig.esm === 'object' && outputConfig.esm.dir
          ? outputConfig.esm.dir
          : (outputConfig.esm === true ? 'es' : outputDir)
        mainOutputFiles.push(path.join(esmDir, 'index.js'))
      }

      // CJS 输出
      if (outputConfig.cjs) {
        const cjsDir = typeof outputConfig.cjs === 'object' && outputConfig.cjs.dir
          ? outputConfig.cjs.dir
          : (outputConfig.cjs === true ? 'lib' : outputDir)
        mainOutputFiles.push(path.join(cjsDir, 'index.cjs'))
      }

      // UMD 输出
      if (outputConfig.umd) {
        const umdDir = typeof outputConfig.umd === 'object' && outputConfig.umd.dir
          ? outputConfig.umd.dir
          : outputDir
        mainOutputFiles.push(path.join(umdDir, 'index.umd.js'))
      }

      // 检查通用格式配置
      if (outputConfig.format) {
        const formats = Array.isArray(outputConfig.format) ? outputConfig.format : [outputConfig.format]
        for (const format of formats) {
          if (format === 'esm' && !outputConfig.esm) {
            mainOutputFiles.push(path.join(outputDir, 'index.js'))
          } else if (format === 'cjs' && !outputConfig.cjs) {
            mainOutputFiles.push(path.join(outputDir, 'index.cjs'))
          } else if (format === 'umd' && !outputConfig.umd) {
            mainOutputFiles.push(path.join(outputDir, 'index.js'))
          }
        }
      }

      if (mainOutputFiles.length === 0) {
        mainOutputFiles.push(path.join(outputDir, 'index.js'))
      }

      // 检查至少一个主要输出文件是否存在
      for (const outputFile of mainOutputFiles) {
        const fullPath = path.isAbsolute(outputFile)
          ? outputFile
          : path.resolve(process.cwd(), outputFile)

        if (await fs.pathExists(fullPath)) {
          this.logger.debug(`输出产物验证通过: ${fullPath}`)
          return true
        }
      }

      this.logger.debug(`输出产物验证失败，未找到任何主要输出文件`)
      return false
    } catch (error) {
      this.logger.warn(`验证输出产物时出错: ${(error as Error).message}`)
      return false
    }
  }

  /**
   * 缓存构建结果
   */
  async cacheBuildResult(cacheKey: any, buildResult: BuildResult): Promise<void> {
    try {
      await this.cache.cacheBuildResult(cacheKey, buildResult)
      this.logger.debug('构建结果已缓存')
    } catch (error) {
      this.logger.warn('缓存构建结果失败:', (error as Error).message)
    }
  }

  /**
   * 获取缓存的构建结果
   */
  async getCachedBuildResult(cacheKey: any): Promise<any> {
    try {
      return await this.cache.getBuildResult(cacheKey)
    }
    catch (error) {
      this.logger.debug('获取缓存失败:', (error as Error).message)
      return null
    }
  }

  /**
   * 检查源文件是否被修改
   *
   * 通过比较源文件的修改时间与缓存时间来判断
   *
   * @param config - 构建配置
   * @param cachedResult - 缓存的构建结果
   * @returns 源文件是否被修改
   */
  async checkSourceFilesModified(config: any, cachedResult: BuildResult): Promise<boolean> {
    try {
      const glob = await import('fast-glob')

      // 获取缓存时间戳
      const cacheTime = cachedResult.cache?.timestamp || cachedResult.timestamp || 0
      if (!cacheTime) {
        // 如果没有缓存时间戳，保守处理认为已修改
        return true
      }

      // 获取源文件路径模式
      const input = config.input || 'src/index.ts'
      const sourcePatterns: string[] = []

      if (typeof input === 'string') {
        // 单入口：扫描 src 目录
        const srcDir = path.dirname(input)
        sourcePatterns.push(`${srcDir}/**/*.{ts,tsx,js,jsx,vue,css,less,scss,sass}`)
      }
      else if (Array.isArray(input)) {
        // 多入口数组
        input.forEach((entry) => {
          if (typeof entry === 'string') {
            sourcePatterns.push(entry)
          }
        })
      }
      else if (typeof input === 'object') {
        // 入口对象
        Object.values(input).forEach((entry) => {
          if (typeof entry === 'string') {
            sourcePatterns.push(entry)
          }
        })
      }

      // 如果没有模式，使用默认
      if (sourcePatterns.length === 0) {
        sourcePatterns.push('src/**/*.{ts,tsx,js,jsx,vue,css,less,scss,sass}')
      }

      // 扫描源文件
      const sourceFiles = await glob.glob(sourcePatterns, {
        cwd: process.cwd(),
        absolute: true,
        ignore: ['**/node_modules/**', '**/*.d.ts', '**/*.test.*', '**/*.spec.*']
      })

      // 检查每个源文件的修改时间
      for (const file of sourceFiles) {
        try {
          const stat = await fs.stat(file)
          if (stat.mtimeMs > cacheTime) {
            this.logger.debug(`源文件已修改: ${path.relative(process.cwd(), file)}`)
            return true
          }
        }
        catch (err) {
          // 文件可能被删除，认为已修改
          return true
        }
      }

      // 所有源文件都未修改
      return false
    }
    catch (error) {
      this.logger.warn(`检查源文件修改时出错: ${(error as Error).message}`)
      // 出错时保守处理，认为已修改
      return true
    }
  }
}

