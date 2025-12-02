/**
 * 增强版 Package.json 自动更新工具
 *
 * @deprecated 此文件已废弃，所有功能已合并到 PackageUpdater.ts
 * 请使用 PackageUpdater 代替 EnhancedPackageUpdater
 *
 * @example
 * ```typescript
 * // 旧代码（不推荐）
 * import { EnhancedPackageUpdater } from './EnhancedPackageUpdater'
 *
 * // 新代码（推荐）
 * import { PackageUpdater } from './PackageUpdater'
 * // 或使用向后兼容的别名
 * import { EnhancedPackageUpdater } from '@ldesign/builder'
 * ```
 *
 * @author LDesign Team
 * @version 1.0.0
 * @see PackageUpdater
 */

import { promises as fs, existsSync } from 'node:fs'
import path from 'node:path'
import type { Logger } from '../logger'
import { createLogger } from '../logger'

/**
 * 平台类型
 */
export type Platform = 'node' | 'browser' | 'universal'

/**
 * 条件导出配置
 */
export interface ConditionalExportConfig {
  /** 目标平台 */
  platform: Platform
  /** 是否启用 development/production 条件 */
  enableDevProd?: boolean
  /** Node.js 特定入口（仅 platform 为 node 或 universal 时有效） */
  nodeEntry?: string
  /** 浏览器特定入口（仅 platform 为 browser 或 universal 时有效） */
  browserEntry?: string
  /** 是否生成 default 条件 */
  includeDefault?: boolean
}

/**
 * 增强版 Package.json 更新配置
 */
export interface EnhancedPackageUpdaterConfig {
  /** 项目根目录 */
  projectRoot: string
  /** 源码目录，默认为 'src' */
  srcDir?: string
  /** 输出目录配置 */
  outputDirs?: {
    /** ESM 输出目录，默认为 'es' */
    esm?: string
    /** CJS 输出目录，默认为 'lib' */
    cjs?: string
    /** UMD 输出目录，默认为 'dist' */
    umd?: string
    /** 类型声明目录，默认为 'es' */
    types?: string
    /** Node.js 特定输出目录 */
    node?: string
    /** 浏览器特定输出目录 */
    browser?: string
  }
  /** 条件导出配置 */
  conditionalExports?: ConditionalExportConfig
  /** 是否启用自动 exports 生成 */
  autoExports?: boolean
  /** 是否更新 main/module/types 字段 */
  updateEntryPoints?: boolean
  /** 是否更新 files 字段 */
  updateFiles?: boolean
  /** 自定义 exports 配置 */
  customExports?: Record<string, any>
  /** 日志记录器 */
  logger?: Logger
  /** 是否启用 sideEffects 字段更新 */
  updateSideEffects?: boolean
  /** sideEffects 配置 */
  sideEffects?: boolean | string[]
}

/**
 * 导出条目类型
 */
interface ExportEntry {
  types?: string
  node?: string | { import?: string, require?: string }
  browser?: string | { import?: string, require?: string }
  import?: string
  require?: string
  default?: string
}

/**
 * 增强版 Package.json 更新器
 */
export class EnhancedPackageUpdater {
  private config: Required<EnhancedPackageUpdaterConfig>
  private logger: Logger

  constructor(config: EnhancedPackageUpdaterConfig) {
    this.logger = config.logger || createLogger({ prefix: 'PackageUpdater' })
    this.config = {
      projectRoot: config.projectRoot,
      srcDir: config.srcDir || 'src',
      outputDirs: {
        esm: 'es',
        cjs: 'lib',
        umd: 'dist',
        types: 'es',
        node: undefined,
        browser: undefined,
        ...config.outputDirs,
      },
      conditionalExports: {
        platform: 'universal',
        enableDevProd: false,
        includeDefault: true,
        ...config.conditionalExports,
      },
      autoExports: config.autoExports ?? true,
      updateEntryPoints: config.updateEntryPoints ?? true,
      updateFiles: config.updateFiles ?? true,
      customExports: config.customExports || {},
      logger: this.logger,
      updateSideEffects: config.updateSideEffects ?? true,
      sideEffects: config.sideEffects ?? false,
    }
  }

  /**
   * 执行 package.json 更新
   */
  async update(): Promise<void> {
    try {
      this.logger.info('🔧 开始更新 package.json...')

      const packageJsonPath = path.join(this.config.projectRoot, 'package.json')
      const packageJson = await this.readPackageJson(packageJsonPath)

      // 生成 exports
      if (this.config.autoExports) {
        packageJson.exports = await this.generateExports()
        this.logger.debug(`生成了 ${Object.keys(packageJson.exports).length} 个导出条目`)
      }

      // 更新入口点
      if (this.config.updateEntryPoints) {
        this.updateEntryPoints(packageJson)
      }

      // 更新 files 字段
      if (this.config.updateFiles) {
        packageJson.files = await this.generateFiles()
      }

      // 更新 sideEffects
      if (this.config.updateSideEffects) {
        packageJson.sideEffects = this.config.sideEffects
      }

      // 确保 type: "module"
      if (!packageJson.type) {
        packageJson.type = 'module'
      }

      // 排序字段
      const sortedPackageJson = this.sortPackageJsonFields(packageJson)

      await this.writePackageJson(packageJsonPath, sortedPackageJson)
      this.logger.success('✅ package.json 更新完成')
    }
    catch (error) {
      this.logger.error('package.json 更新失败:', error)
      throw error
    }
  }

  /**
   * 生成 exports 配置
   */
  private async generateExports(): Promise<Record<string, any>> {
    const srcPath = path.join(this.config.projectRoot, this.config.srcDir)
    const exports: Record<string, any> = {}

    // 主入口
    exports['.'] = this.createConditionalExportEntry('index')

    // 扫描 src 下的直接子目录
    const directories = await this.scanDirectDirectories(srcPath)

    for (const dir of directories) {
      const dirName = path.basename(dir)

      // 检查是否有 TypeScript 文件
      if (await this.hasTypeScriptFiles(dir)) {
        // 检查是否有 index 文件
        if (await this.hasIndexFile(dir)) {
          exports[`./${dirName}`] = this.createConditionalExportEntry(`${dirName}/index`)
        }

        // 支持通配符导入
        exports[`./${dirName}/*`] = this.createWildcardExportEntry(dirName)
      }
    }

    // 添加 CSS 导出
    await this.addCssExports(exports)

    // 添加 package.json 导出（用于工具读取）
    exports['./package.json'] = './package.json'

    // 合并自定义 exports
    return { ...exports, ...this.config.customExports }
  }

  /**
   * 创建条件导出条目
   */
  private createConditionalExportEntry(relativePath: string): ExportEntry {
    const { esm, cjs, types, node, browser } = this.config.outputDirs
    const { platform, enableDevProd, includeDefault } = this.config.conditionalExports
    const entry: ExportEntry = {}

    // 类型声明（始终放在最前面）
    if (types) {
      entry.types = `./${types}/${relativePath}.d.ts`
    }

    // 根据平台生成条件导出
    if (platform === 'node' || platform === 'universal') {
      if (node) {
        // 有专门的 Node.js 输出目录
        entry.node = {
          import: `./${node}/${relativePath}.js`,
          require: `./${node}/${relativePath}.cjs`,
        }
      }
      else if (platform === 'node') {
        // 纯 Node.js 库，使用标准目录
        if (esm) entry.import = `./${esm}/${relativePath}.js`
        if (cjs) entry.require = `./${cjs}/${relativePath}.cjs`
      }
    }

    if (platform === 'browser' || platform === 'universal') {
      if (browser) {
        // 有专门的浏览器输出目录
        entry.browser = {
          import: `./${browser}/${relativePath}.js`,
          require: `./${browser}/${relativePath}.cjs`,
        }
      }
      else if (platform === 'browser') {
        // 纯浏览器库，使用标准目录
        if (esm) entry.import = `./${esm}/${relativePath}.js`
        if (cjs) entry.require = `./${cjs}/${relativePath}.cjs`
      }
    }

    // universal 平台且没有专门目录时，使用标准导出
    if (platform === 'universal' && !node && !browser) {
      if (esm) entry.import = `./${esm}/${relativePath}.js`
      if (cjs) entry.require = `./${cjs}/${relativePath}.cjs`
    }

    // 添加 default 条件
    if (includeDefault && esm) {
      entry.default = `./${esm}/${relativePath}.js`
    }

    return entry
  }

  /**
   * 创建通配符导出条目
   */
  private createWildcardExportEntry(dirName: string): ExportEntry {
    const { esm, cjs, types } = this.config.outputDirs
    const { includeDefault } = this.config.conditionalExports
    const entry: ExportEntry = {}

    if (types) {
      entry.types = `./${types}/${dirName}/*.d.ts`
    }

    if (esm) {
      entry.import = `./${esm}/${dirName}/*.js`
    }

    if (cjs) {
      entry.require = `./${cjs}/${dirName}/*.cjs`
    }

    if (includeDefault && esm) {
      entry.default = `./${esm}/${dirName}/*.js`
    }

    return entry
  }

  /**
   * 更新入口点字段
   */
  private updateEntryPoints(packageJson: any): void {
    const { esm, cjs, umd, types, node, browser } = this.config.outputDirs
    const { platform } = this.config.conditionalExports

    // 主入口点 - CJS 格式
    if (cjs) {
      packageJson.main = `./${cjs}/index.cjs`
    }

    // ESM 入口点
    if (esm) {
      packageJson.module = `./${esm}/index.js`
    }

    // TypeScript 类型定义
    if (types) {
      packageJson.types = `./${types}/index.d.ts`
      packageJson.typings = `./${types}/index.d.ts`
    }

    // 浏览器入口点
    if (platform === 'browser' || platform === 'universal') {
      if (browser) {
        packageJson.browser = `./${browser}/index.js`
      }
      else if (umd) {
        packageJson.browser = `./${umd}/index.js`
      }
    }

    // UMD 格式 - 用于 CDN
    if (umd) {
      const minifiedPath = `./${umd}/index.min.js`
      const regularPath = `./${umd}/index.js`

      const minifiedFullPath = path.join(this.config.projectRoot, umd, 'index.min.js')

      if (this.fileExistsSync(minifiedFullPath)) {
        packageJson.unpkg = minifiedPath
        packageJson.jsdelivr = minifiedPath
      }
      else {
        packageJson.unpkg = regularPath
        packageJson.jsdelivr = regularPath
      }
    }
  }

  /**
   * 生成 files 字段
   */
  private async generateFiles(): Promise<string[]> {
    const files = new Set(['README.md', 'LICENSE', 'CHANGELOG.md'])
    const { esm, cjs, umd, types, node, browser } = this.config.outputDirs

    // 检查输出目录是否存在
    const dirsToCheck = [esm, cjs, umd, types, node, browser].filter(Boolean) as string[]

    for (const dir of dirsToCheck) {
      const dirPath = path.join(this.config.projectRoot, dir)
      try {
        await fs.access(dirPath)
        files.add(dir)
      }
      catch {
        // 目录不存在，跳过
      }
    }

    return Array.from(files)
  }

  /**
   * 扫描直接子目录
   */
  private async scanDirectDirectories(srcPath: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(srcPath, { withFileTypes: true })
      const directories: string[] = []

      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.') && !entry.name.startsWith('_')) {
          directories.push(path.join(srcPath, entry.name))
        }
      }

      return directories
    }
    catch {
      return []
    }
  }

  /**
   * 检查是否有 index 文件
   */
  private async hasIndexFile(dir: string): Promise<boolean> {
    const indexFiles = ['index.ts', 'index.tsx', 'index.js', 'index.vue']

    for (const file of indexFiles) {
      try {
        await fs.access(path.join(dir, file))
        return true
      }
      catch {
        // 继续检查下一个
      }
    }

    return false
  }

  /**
   * 检查是否有 TypeScript 文件
   */
  private async hasTypeScriptFiles(dir: string): Promise<boolean> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
          return true
        }
      }

      return false
    }
    catch {
      return false
    }
  }

  /**
   * 添加 CSS 导出
   */
  private async addCssExports(exports: Record<string, any>): Promise<void> {
    const { esm, cjs, umd } = this.config.outputDirs
    const cssFiles = new Set<string>()

    for (const dir of [esm, cjs, umd].filter(Boolean) as string[]) {
      const dirPath = path.join(this.config.projectRoot, dir)
      try {
        await fs.access(dirPath)
        await this.findCssFiles(dirPath, cssFiles, dir)
      }
      catch {
        // 目录不存在
      }
    }

    for (const cssFile of cssFiles) {
      const exportKey = `./${cssFile}`
      if (!exports[exportKey]) {
        exports[exportKey] = `./${cssFile}`
      }
    }
  }

  /**
   * 查找 CSS 文件
   */
  private async findCssFiles(dir: string, cssFiles: Set<string>, prefix: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)

        if (entry.isDirectory()) {
          await this.findCssFiles(fullPath, cssFiles, `${prefix}/${entry.name}`)
        }
        else if (entry.name.endsWith('.css')) {
          cssFiles.add(`${prefix}/${entry.name}`)
        }
      }
    }
    catch {
      // 忽略错误
    }
  }

  /**
   * 读取 package.json
   */
  private async readPackageJson(packageJsonPath: string): Promise<any> {
    const content = await fs.readFile(packageJsonPath, 'utf-8')
    return JSON.parse(content)
  }

  /**
   * 写入 package.json
   */
  private async writePackageJson(packageJsonPath: string, packageJson: any): Promise<void> {
    const content = JSON.stringify(packageJson, null, 2) + '\n'
    await fs.writeFile(packageJsonPath, content, 'utf-8')
  }

  /**
   * 检查文件是否存在（同步）
   *
   * @param filePath - 文件路径
   * @returns 文件是否存在
   */
  private fileExistsSync(filePath: string): boolean {
    return existsSync(filePath)
  }

  /**
   * 排序 package.json 字段
   */
  private sortPackageJsonFields(packageJson: any): any {
    const fieldOrder = [
      'name', 'version', 'description', 'keywords', 'author', 'license',
      'homepage', 'repository', 'bugs',
      'type', 'sideEffects',
      'exports', 'main', 'module', 'browser', 'types', 'typings',
      'unpkg', 'jsdelivr',
      'files',
      'scripts',
      'dependencies', 'peerDependencies', 'devDependencies', 'optionalDependencies',
      'engines', 'os', 'cpu', 'publishConfig',
    ]

    const sorted: any = {}

    for (const field of fieldOrder) {
      if (packageJson[field] !== undefined) {
        sorted[field] = packageJson[field]
      }
    }

    for (const [key, value] of Object.entries(packageJson)) {
      if (!fieldOrder.includes(key)) {
        sorted[key] = value
      }
    }

    return sorted
  }
}

/**
 * 创建增强版 Package 更新器
 */
export function createEnhancedPackageUpdater(config: EnhancedPackageUpdaterConfig): EnhancedPackageUpdater {
  return new EnhancedPackageUpdater(config)
}

/**
 * 快捷更新函数
 */
export async function updatePackageJson(config: EnhancedPackageUpdaterConfig): Promise<void> {
  const updater = createEnhancedPackageUpdater(config)
  await updater.update()
}
