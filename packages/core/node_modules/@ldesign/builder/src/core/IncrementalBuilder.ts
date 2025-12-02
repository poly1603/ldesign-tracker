/**
 * 增量构建器
 * 
 * 实现智能增量构建,只重新构建变更的文件
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import type { BuilderConfig } from '../types/config'
import { Logger } from '../utils/logger'

/**
 * 文件变更信息
 */
export interface FileChange {
  /** 文件路径 */
  path: string
  /** 变更类型 */
  type: 'added' | 'modified' | 'deleted'
  /** 文件哈希 */
  hash?: string
  /** 变更时间 */
  timestamp: number
}

/**
 * 构建缓存条目
 */
export interface BuildCacheEntry {
  /** 文件哈希 */
  hash: string
  /** 依赖文件哈希 */
  dependencies: Record<string, string>
  /** 输出文件 */
  outputs: string[]
  /** 构建时间 */
  buildTime: number
  /** 缓存时间 */
  timestamp: number
}

/**
 * 增量构建缓存
 */
export interface IncrementalCache {
  /** 文件缓存 */
  files: Record<string, BuildCacheEntry>
  /** 配置哈希 */
  configHash: string
  /** 版本号 */
  version: string
}

/**
 * 增量构建选项
 */
export interface IncrementalBuilderOptions {
  /** 缓存目录 */
  cacheDir?: string
  /** 是否启用 */
  enabled?: boolean
  /** 日志记录器 */
  logger?: Logger
}

/**
 * 增量构建器
 */
export class IncrementalBuilder {
  private cacheDir: string
  private cacheFile: string
  private cache: IncrementalCache
  private logger: Logger
  private enabled: boolean

  constructor(options: IncrementalBuilderOptions = {}) {
    this.cacheDir = options.cacheDir || path.join(process.cwd(), 'node_modules', '.cache', '@ldesign', 'builder')
    this.cacheFile = path.join(this.cacheDir, 'incremental-cache.json')
    this.logger = options.logger || new Logger()
    this.enabled = options.enabled !== false

    this.cache = this.loadCache()
  }

  /**
   * 加载缓存
   */
  private loadCache(): IncrementalCache {
    if (!this.enabled) {
      return this.createEmptyCache()
    }

    try {
      if (fs.existsSync(this.cacheFile)) {
        const data = fs.readFileSync(this.cacheFile, 'utf-8')
        const cache = JSON.parse(data) as IncrementalCache
        
        // 验证缓存版本
        if (cache.version === '1.0.0') {
          this.logger.debug('增量构建缓存已加载')
          return cache
        }
      }
    } catch (error) {
      this.logger.warn('加载增量构建缓存失败:', error)
    }

    return this.createEmptyCache()
  }

  /**
   * 创建空缓存
   */
  private createEmptyCache(): IncrementalCache {
    return {
      files: {},
      configHash: '',
      version: '1.0.0'
    }
  }

  /**
   * 保存缓存
   */
  private saveCache(): void {
    if (!this.enabled) return

    try {
      // 确保缓存目录存在
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true })
      }

      // 保存缓存
      fs.writeFileSync(this.cacheFile, JSON.stringify(this.cache, null, 2), 'utf-8')
      this.logger.debug('增量构建缓存已保存')
    } catch (error) {
      this.logger.warn('保存增量构建缓存失败:', error)
    }
  }

  /**
   * 计算文件哈希
   */
  private calculateFileHash(filePath: string): string {
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      return crypto.createHash('md5').update(content).digest('hex')
    } catch {
      return ''
    }
  }

  /**
   * 计算配置哈希
   */
  private calculateConfigHash(config: BuilderConfig): string {
    const configStr = JSON.stringify({
      input: config.input,
      output: config.output,
      libraryType: config.libraryType,
      bundler: config.bundler,
      mode: config.mode,
      minify: config.minify,
      sourcemap: config.sourcemap
    })
    return crypto.createHash('md5').update(configStr).digest('hex')
  }

  /**
   * 检查文件是否需要重新构建
   */
  needsRebuild(filePath: string, config: BuilderConfig): boolean {
    if (!this.enabled) return true

    // 检查配置是否变更
    const configHash = this.calculateConfigHash(config)
    if (configHash !== this.cache.configHash) {
      this.logger.debug('配置已变更,需要完全重新构建')
      this.cache.configHash = configHash
      return true
    }

    // 检查文件是否存在于缓存中
    const cacheEntry = this.cache.files[filePath]
    if (!cacheEntry) {
      this.logger.debug(`文件 ${filePath} 不在缓存中,需要构建`)
      return true
    }

    // 检查文件哈希是否变更
    const currentHash = this.calculateFileHash(filePath)
    if (currentHash !== cacheEntry.hash) {
      this.logger.debug(`文件 ${filePath} 已变更,需要重新构建`)
      return true
    }

    // 检查依赖文件是否变更
    for (const [depPath, depHash] of Object.entries(cacheEntry.dependencies)) {
      const currentDepHash = this.calculateFileHash(depPath)
      if (currentDepHash !== depHash) {
        this.logger.debug(`依赖文件 ${depPath} 已变更,需要重新构建 ${filePath}`)
        return true
      }
    }

    this.logger.debug(`文件 ${filePath} 未变更,跳过构建`)
    return false
  }

  /**
   * 更新文件缓存
   */
  updateCache(
    filePath: string,
    dependencies: string[],
    outputs: string[],
    buildTime: number
  ): void {
    if (!this.enabled) return

    const hash = this.calculateFileHash(filePath)
    const dependencyHashes: Record<string, string> = {}

    for (const dep of dependencies) {
      dependencyHashes[dep] = this.calculateFileHash(dep)
    }

    this.cache.files[filePath] = {
      hash,
      dependencies: dependencyHashes,
      outputs,
      buildTime,
      timestamp: Date.now()
    }

    this.saveCache()
  }

  /**
   * 检测文件变更
   */
  detectChanges(files: string[]): FileChange[] {
    const changes: FileChange[] = []

    for (const file of files) {
      const cacheEntry = this.cache.files[file]
      const currentHash = this.calculateFileHash(file)

      if (!cacheEntry) {
        // 新文件
        changes.push({
          path: file,
          type: 'added',
          hash: currentHash,
          timestamp: Date.now()
        })
      } else if (currentHash !== cacheEntry.hash) {
        // 修改的文件
        changes.push({
          path: file,
          type: 'modified',
          hash: currentHash,
          timestamp: Date.now()
        })
      }
    }

    // 检测删除的文件
    for (const cachedFile of Object.keys(this.cache.files)) {
      if (!files.includes(cachedFile) && !fs.existsSync(cachedFile)) {
        changes.push({
          path: cachedFile,
          type: 'deleted',
          timestamp: Date.now()
        })
        delete this.cache.files[cachedFile]
      }
    }

    return changes
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache = this.createEmptyCache()
    this.saveCache()
    this.logger.info('增量构建缓存已清除')
  }

  /**
   * 获取缓存统计
   */
  getStats() {
    return {
      totalFiles: Object.keys(this.cache.files).length,
      cacheSize: JSON.stringify(this.cache).length,
      configHash: this.cache.configHash,
      version: this.cache.version
    }
  }
}

