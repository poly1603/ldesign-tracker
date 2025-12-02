/**
 * 增强版 TypeScript 声明文件生成器
 *
 * @deprecated 此文件已废弃，所有功能已合并到 DtsGenerator.ts
 * 请使用 DtsGenerator 代替 EnhancedDtsGenerator
 *
 * @example
 * ```typescript
 * // 旧代码（不推荐）
 * import { EnhancedDtsGenerator } from './EnhancedDtsGenerator'
 *
 * // 新代码（推荐）
 * import { DtsGenerator } from './DtsGenerator'
 * // 或使用向后兼容的别名
 * import { EnhancedDtsGenerator } from '@ldesign/builder'
 * ```
 *
 * @author LDesign Team
 * @version 1.0.0
 * @see DtsGenerator
 */

import * as ts from 'typescript'
import * as path from 'path'
import * as fs from 'node:fs'
import * as fse from 'fs-extra'
import { glob } from 'glob'
import type { Logger } from '../utils/logger'
import { createLogger } from '../utils/logger'
import type { DtsGeneratorOptions, DtsGenerationResult } from './DtsGenerator'

/**
 * 增强版 DTS 生成选项
 */
export interface EnhancedDtsOptions extends DtsGeneratorOptions {
  /** 最大重试次数 */
  maxRetries?: number
  /** 重试延迟（毫秒） */
  retryDelay?: number
  /** 是否启用增量生成 */
  incremental?: boolean
  /** 是否验证生成的文件 */
  validate?: boolean
  /** 是否生成 Vue 组件类型 */
  vueTypes?: boolean
  /** 失败时是否继续 */
  continueOnError?: boolean
}

/**
 * 增强版 DTS 生成结果
 */
export interface EnhancedDtsResult extends DtsGenerationResult {
  /** 重试次数 */
  retries: number
  /** 跳过的文件 */
  skipped?: string[]
  /** 验证结果 */
  validation?: {
    valid: boolean
    issues: string[]
  }
}

/**
 * 增强版 TypeScript 声明文件生成器
 */
export class EnhancedDtsGenerator {
  private logger: Logger
  private options: Required<EnhancedDtsOptions>

  constructor(options: EnhancedDtsOptions) {
    this.logger = options.logger || createLogger({ prefix: 'EnhancedDTS' })
    this.options = {
      srcDir: options.srcDir,
      outDir: options.outDir,
      tsconfig: options.tsconfig || path.join(process.cwd(), 'tsconfig.json'),
      preserveStructure: options.preserveStructure ?? true,
      declarationMap: options.declarationMap ?? false,
      rootDir: options.rootDir || process.cwd(),
      include: options.include || ['**/*.ts', '**/*.tsx'],
      exclude: options.exclude || ['**/*.test.ts', '**/*.spec.ts', '**/__tests__/**', '**/node_modules/**'],
      logger: this.logger,
      maxRetries: options.maxRetries ?? 3,
      retryDelay: options.retryDelay ?? 1000,
      incremental: options.incremental ?? true,
      validate: options.validate ?? true,
      vueTypes: options.vueTypes ?? false,
      continueOnError: options.continueOnError ?? true,
    }
  }

  /**
   * 生成声明文件（带重试机制）
   */
  async generate(): Promise<EnhancedDtsResult> {
    let lastError: Error | null = null
    let retries = 0

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        const result = await this.doGenerate()

        // 验证生成的文件
        if (this.options.validate && result.success) {
          const validation = await this.validateGeneratedFiles(result.files)
          return {
            ...result,
            retries,
            validation,
          }
        }

        return { ...result, retries }
      }
      catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        retries = attempt

        if (attempt < this.options.maxRetries) {
          this.logger.warn(`DTS 生成失败，${this.options.retryDelay}ms 后重试 (${attempt + 1}/${this.options.maxRetries})`)
          await this.delay(this.options.retryDelay)
        }
      }
    }

    // 所有重试都失败
    return {
      success: false,
      files: [],
      errors: [lastError?.message || '未知错误'],
      duration: 0,
      retries,
    }
  }

  /**
   * 实际生成逻辑
   */
  private async doGenerate(): Promise<EnhancedDtsResult> {
    const startTime = Date.now()
    const generatedFiles: string[] = []
    const skippedFiles: string[] = []
    const errors: string[] = []
    const warnings: string[] = []

    try {
      this.logger.info('🔧 开始生成 TypeScript 声明文件...')

      // 确保输出目录存在
      await fse.ensureDir(this.options.outDir)

      // 读取并解析 tsconfig
      const tsconfig = await this.loadTsConfig()

      // 获取要处理的文件列表
      const files = await this.getSourceFiles()
      this.logger.debug(`找到 ${files.length} 个源文件`)

      if (files.length === 0) {
        this.logger.warn('没有找到需要处理的 TypeScript 文件')
        return {
          success: true,
          files: [],
          warnings: ['没有找到需要处理的 TypeScript 文件'],
          duration: Date.now() - startTime,
          retries: 0,
        }
      }

      // 检查增量编译缓存
      const filesToProcess = this.options.incremental
        ? await this.filterChangedFiles(files)
        : files

      if (filesToProcess.length === 0) {
        this.logger.info('✅ 所有文件都是最新的，无需重新生成')
        return {
          success: true,
          files: [],
          duration: Date.now() - startTime,
          retries: 0,
        }
      }

      this.logger.debug(`需要处理 ${filesToProcess.length} 个文件`)

      // 创建编译器配置
      const compilerOptions = this.createCompilerOptions(tsconfig)

      // 创建编译器主机
      const host = ts.createCompilerHost(compilerOptions)

      // 创建程序
      const program = ts.createProgram({
        rootNames: filesToProcess,
        options: compilerOptions,
        host,
      })

      // 获取诊断信息
      const diagnostics = ts.getPreEmitDiagnostics(program)

      // 过滤诊断信息
      const filteredDiagnostics = this.filterDiagnostics(diagnostics)

      // 记录诊断信息
      for (const diagnostic of filteredDiagnostics) {
        const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
        if (diagnostic.category === ts.DiagnosticCategory.Error) {
          if (this.options.continueOnError) {
            warnings.push(`[跳过] ${message}`)
            if (diagnostic.file) {
              skippedFiles.push(diagnostic.file.fileName)
            }
          }
          else {
            errors.push(message)
          }
        }
        else {
          warnings.push(message)
        }
      }

      // 如果有严重错误且不允许继续，则抛出
      if (errors.length > 0 && !this.options.continueOnError) {
        throw new Error(`TypeScript 编译错误:\n${errors.join('\n')}`)
      }

      // 生成声明文件
      const emitResult = program.emit(
        undefined,
        (fileName, data) => {
          if (fileName.endsWith('.d.ts') || fileName.endsWith('.d.ts.map')) {
            const relativePath = path.relative(compilerOptions.outDir!, fileName)
            const targetPath = path.join(this.options.outDir, relativePath)

            fse.ensureDirSync(path.dirname(targetPath))
            fs.writeFileSync(targetPath, data, 'utf-8')

            if (fileName.endsWith('.d.ts')) {
              generatedFiles.push(targetPath)
              this.logger.debug(`✓ ${relativePath}`)
            }
          }
        },
        undefined,
        true,
        undefined,
      )

      // 处理生成错误
      if (emitResult.emitSkipped && generatedFiles.length === 0) {
        throw new Error('声明文件生成被跳过')
      }

      // 更新增量编译缓存
      if (this.options.incremental) {
        await this.updateFileCache(filesToProcess)
      }

      const duration = Date.now() - startTime
      this.logger.success(`✅ 生成了 ${generatedFiles.length} 个声明文件 (${duration}ms)`)

      return {
        success: true,
        files: generatedFiles,
        skipped: skippedFiles.length > 0 ? skippedFiles : undefined,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
        duration,
        retries: 0,
      }
    }
    catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logger.error('生成声明文件失败:', errorMessage)

      return {
        success: false,
        files: generatedFiles,
        skipped: skippedFiles.length > 0 ? skippedFiles : undefined,
        errors: [errorMessage, ...errors],
        warnings: warnings.length > 0 ? warnings : undefined,
        duration,
        retries: 0,
      }
    }
  }

  /**
   * 过滤诊断信息
   */
  private filterDiagnostics(diagnostics: readonly ts.Diagnostic[]): ts.Diagnostic[] {
    return diagnostics.filter((diagnostic) => {
      const code = diagnostic.code
      const file = diagnostic.file?.fileName || ''

      // 忽略 .vue 文件相关的错误
      if (file.endsWith('.vue') || file.includes('.vue')) {
        return false
      }

      // 忽略特定的错误码
      const ignoredCodes = [
        2688, // Cannot find type definition file
        2307, // Cannot find module
        5096, // Option conflicts
        6133, // Unused variable
        7016, // Could not find declaration file
        2304, // Cannot find name
        2339, // Property does not exist
        2345, // Argument type mismatch (常见于泛型)
        2322, // Type is not assignable
        1259, // Module can only be default-imported
        1192, // Module has no default export
      ]

      return !ignoredCodes.includes(code)
    })
  }

  /**
   * 加载 tsconfig
   */
  private async loadTsConfig(): Promise<ts.ParsedCommandLine> {
    const configPath = this.options.tsconfig

    if (!await fse.pathExists(configPath)) {
      this.logger.debug(`tsconfig 不存在: ${configPath}，使用默认配置`)
      return this.getDefaultTsConfig()
    }

    const configFile = ts.readConfigFile(configPath, ts.sys.readFile)

    if (configFile.error) {
      this.logger.warn(`读取 tsconfig 失败，使用默认配置`)
      return this.getDefaultTsConfig()
    }

    return ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      path.dirname(configPath),
    )
  }

  /**
   * 获取默认 tsconfig
   */
  private getDefaultTsConfig(): ts.ParsedCommandLine {
    return {
      options: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.ESNext,
        lib: ['lib.es2020.d.ts', 'lib.dom.d.ts'],
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        esModuleInterop: true,
        skipLibCheck: true,
        strict: true,
      },
      fileNames: [],
      errors: [],
    }
  }

  /**
   * 创建编译器选项
   */
  private createCompilerOptions(tsconfig: ts.ParsedCommandLine): ts.CompilerOptions {
    const baseOptions = tsconfig.options || {}

    return {
      ...baseOptions,
      declaration: true,
      declarationMap: this.options.declarationMap,
      emitDeclarationOnly: true,
      outDir: this.options.outDir,
      rootDir: this.options.preserveStructure ? this.options.srcDir : undefined,
      skipLibCheck: true,
      skipDefaultLibCheck: true,
      noEmit: false,
      allowJs: false,
      moduleResolution: baseOptions.moduleResolution || ts.ModuleResolutionKind.Bundler,
      noUnusedLocals: false,
      noUnusedParameters: false,
      allowSyntheticDefaultImports: true,
      esModuleInterop: true,
      resolveJsonModule: true,
      isolatedModules: false,
      incremental: this.options.incremental,
      tsBuildInfoFile: this.options.incremental
        ? path.join(this.options.outDir, '.tsbuildinfo')
        : undefined,
    }
  }

  /**
   * 获取源文件列表
   */
  private async getSourceFiles(): Promise<string[]> {
    const patterns = this.options.include.map(pattern =>
      path.join(this.options.srcDir, pattern).replace(/\\/g, '/'),
    )

    const excludePatterns = this.options.exclude.map(pattern =>
      path.join(this.options.srcDir, pattern).replace(/\\/g, '/'),
    )

    const files: string[] = []

    for (const pattern of patterns) {
      const matches = await glob(pattern, {
        ignore: excludePatterns,
        absolute: true,
        nodir: true,
      })

      const tsFiles = matches.filter((file) => {
        const ext = path.extname(file)
        return ext === '.ts' || ext === '.tsx'
      })

      files.push(...tsFiles)
    }

    return Array.from(new Set(files))
  }

  /**
   * 过滤已更改的文件（增量编译）
   */
  private async filterChangedFiles(files: string[]): Promise<string[]> {
    const cacheFile = path.join(this.options.outDir, '.dts-cache.json')

    if (!await fse.pathExists(cacheFile)) {
      return files
    }

    try {
      const cache = await fse.readJson(cacheFile)
      const changedFiles: string[] = []

      for (const file of files) {
        const stat = await fse.stat(file)
        const mtime = stat.mtimeMs

        if (!cache[file] || cache[file] !== mtime) {
          changedFiles.push(file)
        }
      }

      return changedFiles
    }
    catch {
      return files
    }
  }

  /**
   * 更新文件缓存
   */
  private async updateFileCache(files: string[]): Promise<void> {
    const cacheFile = path.join(this.options.outDir, '.dts-cache.json')
    const cache: Record<string, number> = {}

    try {
      if (await fse.pathExists(cacheFile)) {
        Object.assign(cache, await fse.readJson(cacheFile))
      }

      for (const file of files) {
        const stat = await fse.stat(file)
        cache[file] = stat.mtimeMs
      }

      await fse.writeJson(cacheFile, cache, { spaces: 2 })
    }
    catch (error) {
      this.logger.debug('更新缓存失败:', error)
    }
  }

  /**
   * 验证生成的文件
   */
  private async validateGeneratedFiles(files: string[]): Promise<{ valid: boolean, issues: string[] }> {
    const issues: string[] = []

    for (const file of files) {
      try {
        if (!await fse.pathExists(file)) {
          issues.push(`文件不存在: ${file}`)
          continue
        }

        const content = await fse.readFile(file, 'utf-8')

        // 检查文件是否为空
        if (content.trim().length === 0) {
          issues.push(`文件为空: ${file}`)
          continue
        }

        // 检查是否包含有效的类型声明
        if (!content.includes('export') && !content.includes('declare')) {
          issues.push(`文件可能无效（无导出或声明）: ${file}`)
        }
      }
      catch (error) {
        issues.push(`验证失败: ${file} - ${error}`)
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    }
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 清理输出目录
   */
  async clean(): Promise<void> {
    try {
      if (await fse.pathExists(this.options.outDir)) {
        this.logger.debug(`清理输出目录: ${this.options.outDir}`)
        await fse.emptyDir(this.options.outDir)
      }
    }
    catch (error) {
      this.logger.warn(`清理输出目录失败:`, error)
    }
  }
}

/**
 * 创建增强版 DTS 生成器
 */
export function createEnhancedDtsGenerator(options: EnhancedDtsOptions): EnhancedDtsGenerator {
  return new EnhancedDtsGenerator(options)
}

/**
 * 快捷生成函数（带重试）
 */
export async function generateDtsWithRetry(options: EnhancedDtsOptions): Promise<EnhancedDtsResult> {
  const generator = createEnhancedDtsGenerator(options)
  return await generator.generate()
}
