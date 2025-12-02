/**
 * TypeScript 配置加载器
 * 
 * 支持配置继承链解析、智能缓存、与构建器配置集成
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import path from 'path'
import * as ts from 'typescript'
import { exists, readFile } from '../file-system'

/**
 * 加载的 TypeScript 配置
 */
export interface LoadedTsConfig {
  /** 编译选项 */
  compilerOptions: ts.CompilerOptions
  /** 包含的文件 */
  include?: string[]
  /** 排除的文件 */
  exclude?: string[]
  /** 继承链 */
  extends?: string[]
  /** 文件列表 */
  files?: string[]
  /** 路径别名 */
  paths?: Record<string, string[]>
  /** 基础URL */
  baseUrl?: string
  /** 原始配置 */
  raw: Record<string, any>
  /** 配置文件路径 */
  configPath: string
}

/**
 * 加载选项
 */
export interface TsConfigLoaderOptions {
  /** 项目根目录 */
  projectPath?: string
  /** 是否缓存配置 */
  cache?: boolean
}

// 配置缓存
const configCache = new Map<string, LoadedTsConfig>()

/**
 * TypeScript 配置加载器
 */
export class TsConfigLoader {
  private projectPath: string
  private useCache: boolean

  constructor(options: TsConfigLoaderOptions = {}) {
    this.projectPath = options.projectPath || process.cwd()
    this.useCache = options.cache ?? true
  }

  /**
   * 加载 TypeScript 配置
   */
  async load(configPath?: string): Promise<LoadedTsConfig | null> {
    const resolvedPath = configPath 
      ? path.resolve(this.projectPath, configPath)
      : await this.findTsConfig()

    if (!resolvedPath) return null

    // 检查缓存
    if (this.useCache && configCache.has(resolvedPath)) {
      return configCache.get(resolvedPath)!
    }

    try {
      const result = await this.parseConfig(resolvedPath)
      if (this.useCache) configCache.set(resolvedPath, result)
      return result
    } catch {
      return null
    }
  }

  /**
   * 查找 tsconfig.json
   */
  private async findTsConfig(): Promise<string | null> {
    const candidates = [
      'tsconfig.json',
      'tsconfig.build.json',
      'tsconfig.lib.json'
    ]

    for (const name of candidates) {
      const configPath = path.join(this.projectPath, name)
      if (await exists(configPath)) return configPath
    }
    return null
  }

  /**
   * 解析配置文件
   */
  private async parseConfig(configPath: string): Promise<LoadedTsConfig> {
    const configFile = ts.readConfigFile(configPath, ts.sys.readFile)
    if (configFile.error) throw new Error(`读取 tsconfig 失败: ${configFile.error.messageText}`)

    const raw = configFile.config
    const parsed = ts.parseJsonConfigFileContent(raw, ts.sys, path.dirname(configPath))

    // 解析继承链
    const extendsChain: string[] = []
    if (raw.extends) {
      await this.resolveExtends(raw.extends, path.dirname(configPath), extendsChain)
    }

    return {
      compilerOptions: parsed.options,
      include: raw.include,
      exclude: raw.exclude,
      extends: extendsChain.length > 0 ? extendsChain : undefined,
      files: raw.files,
      paths: parsed.options.paths,
      baseUrl: parsed.options.baseUrl,
      raw,
      configPath
    }
  }

  /**
   * 解析 extends 链
   */
  private async resolveExtends(ext: string | string[], basePath: string, chain: string[]): Promise<void> {
    const extList = Array.isArray(ext) ? ext : [ext]
    for (const e of extList) {
      let resolved: string
      if (e.startsWith('.')) {
        resolved = path.resolve(basePath, e)
      } else {
        // 处理 npm 包引用
        try {
          resolved = require.resolve(e, { paths: [basePath] })
        } catch {
          continue
        }
      }
      if (!resolved.endsWith('.json')) resolved += '.json'
      chain.push(resolved)

      // 递归解析
      if (await exists(resolved)) {
        const content = await readFile(resolved, 'utf-8')
        const config = JSON.parse(content)
        if (config.extends) {
          await this.resolveExtends(config.extends, path.dirname(resolved), chain)
        }
      }
    }
  }

  /** 清除缓存 */
  static clearCache(): void { configCache.clear() }

  /** 获取推荐的构建器配置 */
  getBuilderConfig(tsConfig: LoadedTsConfig): Partial<{ target: string; paths: Record<string, string[]>; baseUrl: string }> {
    const opts = tsConfig.compilerOptions
    return {
      target: opts.target ? ts.ScriptTarget[opts.target].toLowerCase() : 'es2020',
      paths: opts.paths,
      baseUrl: opts.baseUrl
    }
  }
}

export function createTsConfigLoader(opts?: TsConfigLoaderOptions): TsConfigLoader { return new TsConfigLoader(opts) }

