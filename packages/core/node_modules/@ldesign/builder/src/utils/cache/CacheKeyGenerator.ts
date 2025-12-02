/**
 * 缓存键生成器
 * 
 * 生成稳定且精确的缓存键，提高缓存命中率
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import { createHash } from 'crypto'
import type { BuilderConfig } from '../../types/config'
import fs from 'fs-extra'
import path from 'path'

/**
 * 缓存键选项
 */
export interface CacheKeyOptions {
  /** 是否包含依赖版本 */
  includeDependencies?: boolean
  /** 是否包含环境变量 */
  includeEnv?: boolean
  /** 是否包含文件内容哈希 */
  includeFileContent?: boolean
  /** 自定义因素 */
  customFactors?: Record<string, any>
}

/**
 * 缓存键生成器
 */
export class CacheKeyGenerator {
  /**
   * 生成构建缓存键
   */
  async generateBuildCacheKey(
    config: BuilderConfig,
    options: CacheKeyOptions = {}
  ): Promise<string> {
    const factors: any = {
      // 基础配置
      libraryType: config.libraryType,
      mode: config.mode,
      bundler: config.bundler,

      // 输出配置
      output: {
        format: config.output?.format,
        sourcemap: config.sourcemap,
        minify: config.minify
      },

      // TypeScript 配置
      typescript: config.typescript ? {
        target: config.typescript.target,
        module: config.typescript.module,
        declaration: config.typescript.declaration
      } : null,

      // 外部依赖
      external: Array.isArray(config.external)
        ? config.external.sort()
        : null
    }

    // 包含依赖版本
    if (options.includeDependencies !== false) {
      factors.dependencies = await this.getDependencyVersions()
    }

    // 包含环境变量
    if (options.includeEnv) {
      factors.env = {
        NODE_ENV: process.env.NODE_ENV,
        BABEL_ENV: process.env.BABEL_ENV
      }
    }

    // 包含输入文件内容哈希
    if (options.includeFileContent && config.input) {
      factors.inputHash = await this.hashInputFiles(config.input)
    }

    // 自定义因素
    if (options.customFactors) {
      factors.custom = options.customFactors
    }

    // 生成稳定的哈希
    return this.hashObject(factors)
  }

  /**
   * 生成模块缓存键
   */
  async generateModuleCacheKey(
    modulePath: string,
    compilerOptions?: any
  ): Promise<string> {
    const factors = {
      // 文件路径
      path: modulePath,

      // 文件内容哈希
      contentHash: await this.hashFile(modulePath),

      // 编译选项
      compilerOptions: compilerOptions ? {
        target: compilerOptions.target,
        module: compilerOptions.module,
        jsx: compilerOptions.jsx
      } : null,

      // 文件修改时间
      mtime: (await fs.stat(modulePath)).mtimeMs
    }

    return this.hashObject(factors)
  }

  /**
   * 生成依赖缓存键
   */
  async generateDependencyCacheKey(
    modulePath: string,
    dependencies: string[]
  ): Promise<string> {
    const factors = {
      module: modulePath,
      dependencies: await Promise.all(
        dependencies.map(async (dep) => ({
          path: dep,
          hash: await this.hashFile(dep)
        }))
      )
    }

    return this.hashObject(factors)
  }

  /**
   * 获取依赖版本信息
   */
  private async getDependencyVersions(): Promise<Record<string, string>> {
    try {
      const pkgPath = path.join(process.cwd(), 'package.json')
      const pkg = await fs.readJson(pkgPath)

      return {
        ...pkg.dependencies,
        ...pkg.devDependencies,
        ...pkg.peerDependencies
      }
    } catch {
      return {}
    }
  }

  /**
   * 哈希输入文件
   */
  private async hashInputFiles(
    input: string | string[] | Record<string, string>
  ): Promise<string> {
    let files: string[] = []

    if (typeof input === 'string') {
      files = [input]
    } else if (Array.isArray(input)) {
      files = input
    } else {
      files = Object.values(input)
    }

    const hashes = await Promise.all(
      files.map(file => this.hashFile(file))
    )

    return this.hashObject(hashes)
  }

  /**
   * 哈希单个文件
   */
  private async hashFile(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return createHash('md5').update(content, 'utf-8').digest('hex')
    } catch {
      return ''
    }
  }

  /**
   * 哈希对象（稳定排序）
   */
  private hashObject(obj: any): string {
    const json = JSON.stringify(obj, Object.keys(obj).sort())
    return createHash('md5').update(json).digest('hex')
  }
}

/**
 * 创建缓存键生成器
 */
export function createCacheKeyGenerator(): CacheKeyGenerator {
  return new CacheKeyGenerator()
}

/**
 * 快速生成缓存键
 */
export async function generateCacheKey(
  config: BuilderConfig,
  options?: CacheKeyOptions
): Promise<string> {
  const generator = new CacheKeyGenerator()
  return generator.generateBuildCacheKey(config, options)
}
