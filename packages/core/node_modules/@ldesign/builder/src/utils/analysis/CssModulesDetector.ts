/**
 * CSS Modules 自动检测器
 * 
 * 根据文件命名模式和内容自动检测是否使用 CSS Modules
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import path from 'path'
import { exists, readFile, findFiles } from '../file-system'

/**
 * CSS Modules 检测结果
 */
export interface CssModulesDetectionResult {
  /** 是否启用 CSS Modules */
  enabled: boolean
  /** 检测到的 CSS Modules 文件 */
  moduleFiles: string[]
  /** 普通 CSS 文件 */
  regularFiles: string[]
  /** 文件命名模式 */
  namingPattern: 'module' | 'scoped' | 'mixed' | 'none'
  /** 推荐配置 */
  config: CssModulesConfig
  /** 检测置信度 */
  confidence: number
  /** 检测证据 */
  evidence: string[]
}

/**
 * CSS Modules 配置
 */
export interface CssModulesConfig {
  /** 是否自动启用 */
  auto: boolean | ((resourcePath: string) => boolean)
  /** 本地标识符命名规则 */
  localIdentName: string
  /** 导出全局样式 */
  exportGlobals: boolean
  /** 模式 */
  mode: 'local' | 'global' | 'pure' | 'icss'
}

/**
 * 检测选项
 */
export interface CssModulesDetectorOptions {
  /** 样式目录 */
  styleDir?: string
  /** 模块文件后缀模式 */
  modulePatterns?: string[]
}

/**
 * CSS Modules 检测器
 */
export class CssModulesDetector {
  private opts: Required<CssModulesDetectorOptions>

  // CSS Modules 常见模式
  private static readonly MODULE_PATTERNS = ['.module.css', '.module.scss', '.module.less', '.module.sass', '.module.styl']
  private static readonly SCOPED_PATTERNS = ['.scoped.css', '.scoped.scss']

  constructor(options: CssModulesDetectorOptions = {}) {
    this.opts = {
      styleDir: options.styleDir || 'src',
      modulePatterns: options.modulePatterns || CssModulesDetector.MODULE_PATTERNS
    }
  }

  /**
   * 检测 CSS Modules 使用情况
   */
  async detect(projectPath: string): Promise<CssModulesDetectionResult> {
    const srcPath = path.join(projectPath, this.opts.styleDir)
    if (!await exists(srcPath)) return this.getDefaultResult()

    try {
      const allCssFiles = await findFiles(['**/*.css', '**/*.scss', '**/*.less', '**/*.sass', '**/*.styl'], {
        cwd: srcPath,
        ignore: ['**/node_modules/**', '**/dist/**']
      })

      const moduleFiles: string[] = []
      const regularFiles: string[] = []
      const evidence: string[] = []

      for (const file of allCssFiles) {
        if (this.isModuleFile(file)) {
          moduleFiles.push(file)
        } else {
          regularFiles.push(file)
        }
      }

      // 检测源码中的 CSS Modules 导入
      const hasModuleImports = await this.detectModuleImports(srcPath)

      // 计算模式和置信度
      const namingPattern = this.detectNamingPattern(moduleFiles, regularFiles)
      const confidence = this.calculateConfidence(moduleFiles, regularFiles, hasModuleImports)
      const enabled = moduleFiles.length > 0 || hasModuleImports

      // 收集证据
      if (moduleFiles.length > 0) {
        evidence.push(`检测到 ${moduleFiles.length} 个 CSS Modules 文件`)
      }
      if (hasModuleImports) {
        evidence.push('源码中存在 CSS Modules 导入语法')
      }
      evidence.push(`命名模式: ${namingPattern}`)

      return {
        enabled,
        moduleFiles,
        regularFiles,
        namingPattern,
        config: this.generateConfig(namingPattern, enabled),
        confidence,
        evidence
      }
    } catch {
      return this.getDefaultResult()
    }
  }

  /** 判断是否为模块文件 */
  private isModuleFile(file: string): boolean {
    return this.opts.modulePatterns.some(pattern => file.endsWith(pattern)) ||
           CssModulesDetector.SCOPED_PATTERNS.some(pattern => file.endsWith(pattern))
  }

  /** 检测源码中的模块导入 */
  private async detectModuleImports(srcPath: string): Promise<boolean> {
    const jsFiles = await findFiles(['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.vue'], {
      cwd: srcPath,
      ignore: ['**/node_modules/**', '**/*.d.ts']
    })

    const importPattern = /import\s+(\w+|\{[^}]+\})\s+from\s+['"][^'"]+\.module\.(css|scss|less)['"]/

    for (const file of jsFiles.slice(0, 50)) { // 只检查前 50 个文件
      try {
        const content = await readFile(path.join(srcPath, file), 'utf-8')
        if (importPattern.test(content)) return true
      } catch { /* ignore */ }
    }
    return false
  }

  /** 检测命名模式 */
  private detectNamingPattern(moduleFiles: string[], regularFiles: string[]): 'module' | 'scoped' | 'mixed' | 'none' {
    if (moduleFiles.length === 0) return 'none'
    if (regularFiles.length === 0) return 'module'
    const hasScoped = moduleFiles.some(f => f.includes('.scoped.'))
    return hasScoped ? 'scoped' : 'mixed'
  }

  /** 计算置信度 */
  private calculateConfidence(moduleFiles: string[], regularFiles: string[], hasImports: boolean): number {
    if (moduleFiles.length === 0 && !hasImports) return 0.2
    if (moduleFiles.length > 0 && hasImports) return 0.95
    if (moduleFiles.length > 0) return 0.85
    return 0.6
  }

  /** 生成配置 */
  private generateConfig(pattern: string, enabled: boolean): CssModulesConfig {
    return {
      auto: enabled ? (path: string) => /\.module\.(css|scss|less|sass|styl)$/.test(path) : false,
      localIdentName: pattern === 'scoped' ? '[local]_[hash:base64:5]' : '[name]__[local]___[hash:base64:5]',
      exportGlobals: true,
      mode: 'local'
    }
  }

  /** 默认结果 */
  private getDefaultResult(): CssModulesDetectionResult {
    return { enabled: false, moduleFiles: [], regularFiles: [], namingPattern: 'none', config: this.generateConfig('none', false), confidence: 0, evidence: [] }
  }
}

export function createCssModulesDetector(opts?: CssModulesDetectorOptions): CssModulesDetector { return new CssModulesDetector(opts) }

