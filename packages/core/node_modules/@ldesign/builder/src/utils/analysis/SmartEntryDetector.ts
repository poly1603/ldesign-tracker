/**
 * 智能入口文件检测器
 *
 * 从 package.json 的 exports/main/module 字段反向推断源码入口文件
 *
 * @author LDesign Team
 * @version 1.0.0
 */

import path from 'path'
import { exists, readFile } from '../file-system'

/**
 * 入口检测结果
 */
export interface EntryDetectionResult {
  /** 检测到的入口文件 */
  entries: Record<string, string>
  /** 主入口文件 */
  main?: string
  /** 检测置信度 (0-1) */
  confidence: number
  /** 检测来源 */
  source: 'exports' | 'main' | 'module' | 'pattern' | 'default'
  /** 检测证据 */
  evidence: string[]
}

/**
 * 智能入口检测器选项
 */
export interface SmartEntryDetectorOptions {
  /** 源码目录 */
  srcDir?: string
  /** 支持的扩展名 */
  extensions?: string[]
  /** 是否启用调试日志 */
  debug?: boolean
}

/**
 * 智能入口检测器
 *
 * 实现从 package.json 的 exports/main/module 字段反向推断源码入口
 */
export class SmartEntryDetector {
  private options: Required<SmartEntryDetectorOptions>

  constructor(options: SmartEntryDetectorOptions = {}) {
    this.options = {
      srcDir: options.srcDir || 'src',
      extensions: options.extensions || ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.vue', '.svelte'],
      debug: options.debug || false
    }
  }

  /**
   * 检测入口文件
   * @param projectPath - 项目路径
   */
  async detect(projectPath: string): Promise<EntryDetectionResult> {
    const pkgPath = path.join(projectPath, 'package.json')

    if (!await exists(pkgPath)) {
      return this.getDefaultResult()
    }

    try {
      const pkgContent = await readFile(pkgPath, 'utf-8')
      const pkg = JSON.parse(pkgContent)

      // 优先级: exports > module > main > 默认模式
      let result = await this.detectFromExports(projectPath, pkg)
      if (result.confidence >= 0.8) return result

      result = await this.detectFromModule(projectPath, pkg)
      if (result.confidence >= 0.7) return result

      result = await this.detectFromMain(projectPath, pkg)
      if (result.confidence >= 0.6) return result

      // 回退到模式匹配
      return await this.detectFromPatterns(projectPath)
    } catch {
      return this.getDefaultResult()
    }
  }

  /**
   * 从 exports 字段检测入口
   */
  private async detectFromExports(
    projectPath: string,
    pkg: Record<string, any>
  ): Promise<EntryDetectionResult> {
    const exports = pkg.exports
    if (!exports) {
      return { entries: {}, confidence: 0, source: 'exports', evidence: [] }
    }

    const entries: Record<string, string> = {}
    const evidence: string[] = []

    // 处理不同的 exports 格式
    if (typeof exports === 'string') {
      // 简单字符串格式: "exports": "./dist/index.js"
      const srcEntry = await this.inferSourceFromOutput(projectPath, exports)
      if (srcEntry) {
        entries['.'] = srcEntry
        evidence.push(`从 exports 字符串推断: ${exports} -> ${srcEntry}`)
      }
    } else if (typeof exports === 'object') {
      // 对象格式
      await this.processExportsObject(projectPath, exports, entries, evidence, '')
    }

    const mainEntry = entries['.'] || Object.values(entries)[0]

    return {
      entries,
      main: mainEntry,
      confidence: Object.keys(entries).length > 0 ? 0.9 : 0,
      source: 'exports',
      evidence
    }
  }

  /**
   * 处理 exports 对象
   */
  private async processExportsObject(
    projectPath: string,
    exports: Record<string, any>,
    entries: Record<string, string>,
    evidence: string[],
    prefix: string
  ): Promise<void> {
    for (const [key, value] of Object.entries(exports)) {
      const entryKey = prefix ? `${prefix}/${key}` : key

      if (typeof value === 'string') {
        const srcEntry = await this.inferSourceFromOutput(projectPath, value)
        if (srcEntry) {
          entries[entryKey] = srcEntry
          evidence.push(`从 exports[${entryKey}] 推断: ${value} -> ${srcEntry}`)
        }
      } else if (typeof value === 'object' && value !== null) {
        // 条件导出: { import: "...", require: "..." }
        const importPath = value.import || value.default || value.require
        if (typeof importPath === 'string') {
          const srcEntry = await this.inferSourceFromOutput(projectPath, importPath)
          if (srcEntry) {
            entries[entryKey] = srcEntry
            evidence.push(`从 exports[${entryKey}].import 推断: ${importPath} -> ${srcEntry}`)
          }
        } else if (typeof importPath === 'object') {
          // 嵌套条件导出
          await this.processExportsObject(projectPath, value, entries, evidence, entryKey)
        }
      }
    }
  }



  /**
   * 从 module 字段检测入口
   */
  private async detectFromModule(
    projectPath: string,
    pkg: Record<string, any>
  ): Promise<EntryDetectionResult> {
    const modulePath = pkg.module
    if (!modulePath) {
      return { entries: {}, confidence: 0, source: 'module', evidence: [] }
    }

    const srcEntry = await this.inferSourceFromOutput(projectPath, modulePath)
    if (srcEntry) {
      return {
        entries: { '.': srcEntry },
        main: srcEntry,
        confidence: 0.8,
        source: 'module',
        evidence: [`从 module 字段推断: ${modulePath} -> ${srcEntry}`]
      }
    }

    return { entries: {}, confidence: 0, source: 'module', evidence: [] }
  }

  /**
   * 从 main 字段检测入口
   */
  private async detectFromMain(
    projectPath: string,
    pkg: Record<string, any>
  ): Promise<EntryDetectionResult> {
    const mainPath = pkg.main
    if (!mainPath) {
      return { entries: {}, confidence: 0, source: 'main', evidence: [] }
    }

    const srcEntry = await this.inferSourceFromOutput(projectPath, mainPath)
    if (srcEntry) {
      return {
        entries: { '.': srcEntry },
        main: srcEntry,
        confidence: 0.7,
        source: 'main',
        evidence: [`从 main 字段推断: ${mainPath} -> ${srcEntry}`]
      }
    }

    return { entries: {}, confidence: 0, source: 'main', evidence: [] }
  }

  /**
   * 从输出路径推断源码路径
   *
   * 例如:
   * - ./dist/index.js -> src/index.ts
   * - ./es/components/Button.js -> src/components/Button.tsx
   * - ./lib/utils/index.cjs -> src/utils/index.ts
   */
  private async inferSourceFromOutput(
    projectPath: string,
    outputPath: string
  ): Promise<string | null> {
    // 移除开头的 ./
    let cleanPath = outputPath.replace(/^\.\//, '')

    // 移除输出目录前缀
    const outputDirs = ['dist', 'es', 'lib', 'build', 'out', 'cjs', 'esm', 'umd']
    for (const dir of outputDirs) {
      if (cleanPath.startsWith(`${dir}/`)) {
        cleanPath = cleanPath.slice(dir.length + 1)
        break
      }
    }

    // 移除文件扩展名
    const basePath = cleanPath.replace(/\.(js|mjs|cjs|jsx)$/, '')

    // 尝试不同的源码扩展名
    for (const ext of this.options.extensions) {
      const srcPath = path.join(projectPath, this.options.srcDir, `${basePath}${ext}`)
      if (await exists(srcPath)) {
        return path.join(this.options.srcDir, `${basePath}${ext}`)
      }
    }

    // 尝试 index 文件
    for (const ext of this.options.extensions) {
      const indexPath = path.join(projectPath, this.options.srcDir, basePath, `index${ext}`)
      if (await exists(indexPath)) {
        return path.join(this.options.srcDir, basePath, `index${ext}`)
      }
    }

    return null
  }

  /**
   * 从模式匹配检测入口
   */
  private async detectFromPatterns(projectPath: string): Promise<EntryDetectionResult> {
    const patterns = [
      'src/index.ts',
      'src/index.tsx',
      'src/index.js',
      'src/index.jsx',
      'src/main.ts',
      'src/main.tsx',
      'src/lib.ts',
      'index.ts',
      'index.js'
    ]

    for (const pattern of patterns) {
      const fullPath = path.join(projectPath, pattern)
      if (await exists(fullPath)) {
        return {
          entries: { '.': pattern },
          main: pattern,
          confidence: 0.5,
          source: 'pattern',
          evidence: [`通过模式匹配找到: ${pattern}`]
        }
      }
    }

    return this.getDefaultResult()
  }

  /**
   * 获取默认结果
   */
  private getDefaultResult(): EntryDetectionResult {
    return {
      entries: { '.': 'src/index.ts' },
      main: 'src/index.ts',
      confidence: 0.3,
      source: 'default',
      evidence: ['使用默认入口: src/index.ts']
    }
  }
}

/**
 * 创建智能入口检测器
 */
export function createSmartEntryDetector(
  options?: SmartEntryDetectorOptions
): SmartEntryDetector {
  return new SmartEntryDetector(options)
}
