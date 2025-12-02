/**
 * 增强型 Tree Shaking 模块
 * 
 * 提供深度死代码消除、副作用分析、CSS Tree Shaking 等高级功能
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

// @ts-nocheck - 此文件包含实验性功能，暂时跳过严格类型检查

import * as path from 'path'
import * as fs from 'fs-extra'
import { parse as parseJS } from '@babel/parser'
import traverse from '@babel/traverse'
import * as t from '@babel/types'
import generate from '@babel/generator'
import postcss from 'postcss'
import cssnano from 'cssnano'
import { Logger } from '../../utils/logger'

/**
 * Tree Shaking 配置
 */
export interface TreeShakingConfig {
  /** 启用 Tree Shaking */
  enabled?: boolean
  /** 保留的导出 */
  preserveExports?: string[]
  /** 标记为无副作用的模块 */
  sideEffectsFree?: string[] | boolean
  /** 启用 CSS Tree Shaking */
  enableCssTreeShaking?: boolean
  /** 启用条件编译 */
  enableConditionalCompilation?: boolean
  /** 环境变量 */
  env?: Record<string, any>
  /** 深度分析 */
  deepAnalysis?: boolean
  /** 分析报告 */
  generateReport?: boolean
  /** 排除的文件 */
  exclude?: RegExp[]
  /** 包含的文件 */
  include?: RegExp[]
}

/**
 * 导出信息
 */
interface ExportInfo {
  name: string
  used: boolean
  usedBy: Set<string>
  sideEffects: boolean
  type: 'named' | 'default' | 'namespace'
}

/**
 * 模块信息
 */
interface ModuleInfo {
  path: string
  exports: Map<string, ExportInfo>
  imports: Map<string, Set<string>>
  sideEffects: boolean
  cssFiles: Set<string>
  usedSelectors: Set<string>
  conditionalBlocks: ConditionalBlock[]
}

/**
 * 条件编译块
 */
interface ConditionalBlock {
  condition: string
  start: number
  end: number
  keep: boolean
}

/**
 * Tree Shaking 结果
 */
export interface TreeShakingResult {
  /** 处理的文件数 */
  filesProcessed: number
  /** 移除的代码量（字节） */
  bytesRemoved: number
  /** 移除的导出数 */
  exportsRemoved: number
  /** 移除的 CSS 规则数 */
  cssRulesRemoved: number
  /** 优化后的文件 */
  optimizedFiles: Map<string, string>
  /** 分析报告 */
  report?: TreeShakingReport
}

/**
 * Tree Shaking 报告
 */
export interface TreeShakingReport {
  /** 未使用的导出 */
  unusedExports: Array<{
    module: string
    exports: string[]
  }>
  /** 未使用的 CSS */
  unusedCss: Array<{
    file: string
    selectors: string[]
  }>
  /** 副作用分析 */
  sideEffectsAnalysis: Array<{
    module: string
    hasSideEffects: boolean
    reason?: string
  }>
  /** 优化建议 */
  suggestions: string[]
}

/**
 * 增强型 Tree Shaker
 */
export class EnhancedTreeShaker {
  private config: TreeShakingConfig
  private logger: Logger
  private modules: Map<string, ModuleInfo> = new Map()
  private entryPoints: Set<string> = new Set()
  private processedFiles: Set<string> = new Set()
  private bytesRemoved: number = 0
  private exportsRemoved: number = 0
  private cssRulesRemoved: number = 0

  constructor(config: TreeShakingConfig = {}) {
    this.config = {
      enabled: true,
      enableCssTreeShaking: true,
      enableConditionalCompilation: true,
      deepAnalysis: true,
      generateReport: true,
      sideEffectsFree: false,
      ...config
    }

    this.logger = new Logger({ prefix: '[TreeShaker]' })
  }

  /**
   * 执行 Tree Shaking
   */
  async shake(entryPoints: string | string[]): Promise<TreeShakingResult> {
    this.logger.info('开始 Tree Shaking 分析...')

    // 重置状态
    this.reset()

    // 设置入口点
    const entries = Array.isArray(entryPoints) ? entryPoints : [entryPoints]
    entries.forEach(entry => this.entryPoints.add(entry))

    // 第一阶段：构建依赖图
    this.logger.debug('构建依赖图...')
    for (const entry of entries) {
      await this.analyzeModule(entry)
    }

    // 第二阶段：标记使用的导出
    this.logger.debug('标记使用的导出...')
    await this.markUsedExports()

    // 第三阶段：分析副作用
    this.logger.debug('分析副作用...')
    await this.analyzeSideEffects()

    // 第四阶段：移除未使用的代码
    this.logger.debug('移除未使用的代码...')
    const optimizedFiles = await this.removeUnusedCode()

    // 第五阶段：CSS Tree Shaking
    if (this.config.enableCssTreeShaking) {
      this.logger.debug('执行 CSS Tree Shaking...')
      await this.shakeCss(optimizedFiles)
    }

    // 生成报告
    let report: TreeShakingReport | undefined
    if (this.config.generateReport) {
      report = this.generateReport()
    }

    const result: TreeShakingResult = {
      filesProcessed: this.processedFiles.size,
      bytesRemoved: this.bytesRemoved,
      exportsRemoved: this.exportsRemoved,
      cssRulesRemoved: this.cssRulesRemoved,
      optimizedFiles,
      report
    }

    this.logger.success(`Tree Shaking 完成，移除了 ${this.formatSize(this.bytesRemoved)} 的代码`)

    return result
  }

  /**
   * 分析模块
   */
  private async analyzeModule(modulePath: string): Promise<void> {
    if (this.processedFiles.has(modulePath)) return

    this.processedFiles.add(modulePath)

    if (!await fs.pathExists(modulePath)) {
      this.logger.warn(`模块不存在: ${modulePath}`)
      return
    }

    const code = await fs.readFile(modulePath, 'utf-8')
    const ast = parseJS(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx', 'decorators-legacy', 'dynamicImport']
    })

    const moduleInfo: ModuleInfo = {
      path: modulePath,
      exports: new Map(),
      imports: new Map(),
      sideEffects: false,
      cssFiles: new Set(),
      usedSelectors: new Set(),
      conditionalBlocks: []
    }

    // 分析 AST
    traverse(ast, {
      // 分析导出
      ExportNamedDeclaration(path) {
        if (path.node.declaration) {
          if (t.isVariableDeclaration(path.node.declaration)) {
            path.node.declaration.declarations.forEach(decl => {
              if (t.isIdentifier(decl.id)) {
                moduleInfo.exports.set(decl.id.name, {
                  name: decl.id.name,
                  used: false,
                  usedBy: new Set(),
                  sideEffects: false,
                  type: 'named'
                })
              }
            })
          } else if (t.isFunctionDeclaration(path.node.declaration) || t.isClassDeclaration(path.node.declaration)) {
            if (path.node.declaration.id) {
              moduleInfo.exports.set(path.node.declaration.id.name, {
                name: path.node.declaration.id.name,
                used: false,
                usedBy: new Set(),
                sideEffects: false,
                type: 'named'
              })
            }
          }
        }

        // 处理导出说明符
        if (path.node.specifiers) {
          path.node.specifiers.forEach(spec => {
            if (t.isExportSpecifier(spec) && t.isIdentifier(spec.exported)) {
              moduleInfo.exports.set(spec.exported.name, {
                name: spec.exported.name,
                used: false,
                usedBy: new Set(),
                sideEffects: false,
                type: 'named'
              })
            }
          })
        }
      },

      // 分析默认导出
      ExportDefaultDeclaration(path) {
        moduleInfo.exports.set('default', {
          name: 'default',
          used: false,
          usedBy: new Set(),
          sideEffects: false,
          type: 'default'
        })
      },

      // 分析导入
      ImportDeclaration(path) {
        const source = path.node.source.value
        if (!moduleInfo.imports.has(source)) {
          moduleInfo.imports.set(source, new Set())
        }

        path.node.specifiers.forEach(spec => {
          if (t.isImportSpecifier(spec) && t.isIdentifier(spec.imported)) {
            moduleInfo.imports.get(source)!.add(spec.imported.name)
          } else if (t.isImportDefaultSpecifier(spec)) {
            moduleInfo.imports.get(source)!.add('default')
          } else if (t.isImportNamespaceSpecifier(spec)) {
            moduleInfo.imports.get(source)!.add('*')
          }
        })

        // 检查 CSS 导入
        if (source.endsWith('.css') || source.endsWith('.less') || source.endsWith('.scss')) {
          moduleInfo.cssFiles.add(source)
        }
      },

      // 检测副作用
      CallExpression(path) {
        // 检查是否是顶层调用
        if (path.getFunctionParent() === null) {
          moduleInfo.sideEffects = true
        }

        // 收集使用的 CSS 选择器
        if (t.isIdentifier(path.node.callee) && path.node.callee.name === 'classNames') {
          path.node.arguments.forEach(arg => {
            if (t.isStringLiteral(arg)) {
              moduleInfo.usedSelectors.add(`.${arg.value}`)
            }
          })
        }
      },

      // 分析条件编译
      IfStatement(path) {
        if (this.config.enableConditionalCompilation) {
          const condition = this.evaluateCondition(path.node.test)
          if (condition !== null) {
            moduleInfo.conditionalBlocks.push({
              condition: generate(path.node.test).code,
              start: path.node.start!,
              end: path.node.end!,
              keep: condition
            })
          }
        }
      }
    })

    this.modules.set(modulePath, moduleInfo)

    // 递归分析导入的模块
    for (const [importPath] of moduleInfo.imports) {
      const resolvedPath = await this.resolveModule(importPath, modulePath)
      if (resolvedPath) {
        await this.analyzeModule(resolvedPath)
      }
    }
  }

  /**
   * 标记使用的导出
   */
  private async markUsedExports(): Promise<void> {
    // 从入口点开始标记
    const visited = new Set<string>()
    const queue = [...this.entryPoints]

    while (queue.length > 0) {
      const modulePath = queue.shift()!
      if (visited.has(modulePath)) continue
      visited.add(modulePath)

      const moduleInfo = this.modules.get(modulePath)
      if (!moduleInfo) continue

      // 标记所有导出为已使用（入口点）
      if (this.entryPoints.has(modulePath)) {
        moduleInfo.exports.forEach(exportInfo => {
          exportInfo.used = true
        })
      }

      // 处理导入
      for (const [importPath, importedNames] of moduleInfo.imports) {
        const resolvedPath = await this.resolveModule(importPath, modulePath)
        if (!resolvedPath) continue

        const importedModule = this.modules.get(resolvedPath)
        if (!importedModule) continue

        // 标记导入的名称为已使用
        for (const name of importedNames) {
          if (name === '*') {
            // 命名空间导入，标记所有导出
            importedModule.exports.forEach(exportInfo => {
              exportInfo.used = true
              exportInfo.usedBy.add(modulePath)
            })
          } else {
            const exportInfo = importedModule.exports.get(name)
            if (exportInfo) {
              exportInfo.used = true
              exportInfo.usedBy.add(modulePath)
            }
          }
        }

        queue.push(resolvedPath)
      }
    }
  }

  /**
   * 分析副作用
   */
  private async analyzeSideEffects(): Promise<void> {
    for (const [modulePath, moduleInfo] of this.modules) {
      // 检查配置中的 sideEffectsFree
      if (this.config.sideEffectsFree === true) {
        moduleInfo.sideEffects = false
      } else if (Array.isArray(this.config.sideEffectsFree)) {
        const isSideEffectsFree = this.config.sideEffectsFree.some(pattern =>
          modulePath.includes(pattern)
        )
        if (isSideEffectsFree) {
          moduleInfo.sideEffects = false
        }
      }

      // 深度分析
      if (this.config.deepAnalysis && !moduleInfo.sideEffects) {
        // 检查是否所有导出都未使用且无副作用
        const allUnused = Array.from(moduleInfo.exports.values()).every(exp => !exp.used)
        if (allUnused && !moduleInfo.sideEffects) {
          // 可以完全移除此模块
          this.logger.debug(`模块 ${modulePath} 可以完全移除`)
        }
      }
    }
  }

  /**
   * 移除未使用的代码
   */
  private async removeUnusedCode(): Promise<Map<string, string>> {
    const optimizedFiles = new Map<string, string>()

    for (const [modulePath, moduleInfo] of this.modules) {
      const code = await fs.readFile(modulePath, 'utf-8')
      const ast = parseJS(code, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx', 'decorators-legacy', 'dynamicImport']
      })

      let modified = false
      const originalSize = Buffer.byteLength(code, 'utf-8')

      // 移除未使用的导出
      traverse(ast, {
        ExportNamedDeclaration(path) {
          if (path.node.declaration) {
            if (t.isVariableDeclaration(path.node.declaration)) {
              const declarations = path.node.declaration.declarations.filter(decl => {
                if (t.isIdentifier(decl.id)) {
                  const exportInfo = moduleInfo.exports.get(decl.id.name)
                  if (exportInfo && !exportInfo.used && !exportInfo.sideEffects) {
                    modified = true
                    return false
                  }
                }
                return true
              })

              if (declarations.length === 0) {
                path.remove()
              } else {
                path.node.declaration.declarations = declarations
              }
            } else if (t.isFunctionDeclaration(path.node.declaration) || t.isClassDeclaration(path.node.declaration)) {
              if (path.node.declaration.id) {
                const exportInfo = moduleInfo.exports.get(path.node.declaration.id.name)
                if (exportInfo && !exportInfo.used && !exportInfo.sideEffects) {
                  path.remove()
                  modified = true
                }
              }
            }
          }
        },

        // 移除条件编译块
        IfStatement(path) {
          const block = moduleInfo.conditionalBlocks.find(b =>
            b.start === path.node.start && b.end === path.node.end
          )

          if (block && !block.keep) {
            if (path.node.alternate) {
              path.replaceWith(path.node.alternate)
            } else {
              path.remove()
            }
            modified = true
          } else if (block && block.keep) {
            path.replaceWith(path.node.consequent)
            modified = true
          }
        }
      })

      if (modified) {
        const optimizedCode = generate(ast, {
          retainLines: true,
          compact: false
        }).code

        const newSize = Buffer.byteLength(optimizedCode, 'utf-8')
        const saved = originalSize - newSize

        if (saved > 0) {
          this.bytesRemoved += saved
          optimizedFiles.set(modulePath, optimizedCode)
          this.logger.debug(`优化 ${modulePath}: 节省 ${this.formatSize(saved)}`)
        }
      }
    }

    return optimizedFiles
  }

  /**
   * CSS Tree Shaking
   */
  private async shakeCss(optimizedFiles: Map<string, string>): Promise<void> {
    const allUsedSelectors = new Set<string>()

    // 收集所有使用的选择器
    for (const moduleInfo of this.modules.values()) {
      moduleInfo.usedSelectors.forEach(selector => allUsedSelectors.add(selector))
    }

    // 处理 CSS 文件
    for (const moduleInfo of this.modules.values()) {
      for (const cssFile of moduleInfo.cssFiles) {
        const resolvedCssPath = await this.resolveModule(cssFile, moduleInfo.path)
        if (!resolvedCssPath || !await fs.pathExists(resolvedCssPath)) continue

        const cssContent = await fs.readFile(resolvedCssPath, 'utf-8')
        const result = await postcss([
          // 移除未使用的选择器
          {
            postcssPlugin: 'remove-unused-selectors',
            Once(root) {
              root.walkRules(rule => {
                const selectors = rule.selector.split(',').map(s => s.trim())
                const usedSelectors = selectors.filter(selector => {
                  // 简单的选择器匹配
                  return allUsedSelectors.has(selector) ||
                    selector.startsWith(':') || // 伪类
                    selector.startsWith('::') || // 伪元素
                    selector === '*' || // 通配符
                    selector.includes('[') // 属性选择器
                })

                if (usedSelectors.length === 0) {
                  rule.remove()
                  this.cssRulesRemoved++
                } else if (usedSelectors.length < selectors.length) {
                  rule.selector = usedSelectors.join(', ')
                }
              })
            }
          },
          // CSS 压缩
          cssnano({
            preset: 'default'
          })
        ]).process(cssContent, { from: resolvedCssPath })

        const originalSize = Buffer.byteLength(cssContent, 'utf-8')
        const newSize = Buffer.byteLength(result.css, 'utf-8')
        const saved = originalSize - newSize

        if (saved > 0) {
          this.bytesRemoved += saved
          optimizedFiles.set(resolvedCssPath, result.css)
          this.logger.debug(`优化 CSS ${resolvedCssPath}: 节省 ${this.formatSize(saved)}`)
        }
      }
    }
  }

  /**
   * 评估条件
   */
  private evaluateCondition(node: t.Node): boolean | null {
    if (t.isBooleanLiteral(node)) {
      return node.value
    }

    if (t.isIdentifier(node) && this.config.env) {
      if (node.name === 'process' || node.name === '__DEV__' || node.name === '__PROD__') {
        // 特殊处理常见的环境变量
        if (node.name === '__DEV__') {
          return this.config.env.NODE_ENV === 'development'
        }
        if (node.name === '__PROD__') {
          return this.config.env.NODE_ENV === 'production'
        }
      }
    }

    if (t.isMemberExpression(node) && this.config.env) {
      const code = generate(node).code

      // 处理 process.env.XXX
      if (code.startsWith('process.env.')) {
        const envKey = code.substring('process.env.'.length)
        return this.config.env[envKey] === 'true' || this.config.env[envKey] === true
      }
    }

    if (t.isBinaryExpression(node)) {
      const left = this.evaluateCondition(node.left)
      const right = this.evaluateCondition(node.right)

      if (left !== null && right !== null) {
        switch (node.operator) {
          case '===':
          case '==':
            return left === right
          case '!==':
          case '!=':
            return left !== right
          case '&&':
            return left && right
          case '||':
            return left || right
        }
      }
    }

    if (t.isUnaryExpression(node) && node.operator === '!') {
      const value = this.evaluateCondition(node.argument)
      return value !== null ? !value : null
    }

    return null
  }

  /**
   * 生成报告
   */
  private generateReport(): TreeShakingReport {
    const unusedExports: Array<{ module: string; exports: string[] }> = []
    const unusedCss: Array<{ file: string; selectors: string[] }> = []
    const sideEffectsAnalysis: Array<{ module: string; hasSideEffects: boolean; reason?: string }> = []
    const suggestions: string[] = []

    // 收集未使用的导出
    for (const [modulePath, moduleInfo] of this.modules) {
      const unused = Array.from(moduleInfo.exports.entries())
        .filter(([, info]) => !info.used)
        .map(([name]) => name)

      if (unused.length > 0) {
        unusedExports.push({
          module: modulePath,
          exports: unused
        })
      }

      // 副作用分析
      sideEffectsAnalysis.push({
        module: modulePath,
        hasSideEffects: moduleInfo.sideEffects,
        reason: moduleInfo.sideEffects ? '包含顶层函数调用或修改' : undefined
      })
    }

    // 生成优化建议
    if (unusedExports.length > 10) {
      suggestions.push('考虑将大型模块拆分为更小的、功能单一的模块')
    }

    if (this.cssRulesRemoved > 100) {
      suggestions.push('CSS 中有大量未使用的规则，考虑使用 CSS-in-JS 或 CSS Modules')
    }

    const totalExports = Array.from(this.modules.values())
      .reduce((sum, m) => sum + m.exports.size, 0)
    const unusedRatio = this.exportsRemoved / totalExports

    if (unusedRatio > 0.3) {
      suggestions.push(`${Math.round(unusedRatio * 100)}% 的导出未被使用，考虑重新组织代码结构`)
    }

    return {
      unusedExports,
      unusedCss,
      sideEffectsAnalysis,
      suggestions
    }
  }

  /**
   * 解析模块路径
   */
  private async resolveModule(modulePath: string, fromFile: string): Promise<string | null> {
    if (modulePath.startsWith('.')) {
      const resolved = path.resolve(path.dirname(fromFile), modulePath)

      // 尝试不同的扩展名
      const extensions = ['.ts', '.tsx', '.js', '.jsx', '.css', '.less', '.scss']
      for (const ext of extensions) {
        const fullPath = resolved + ext
        if (await fs.pathExists(fullPath)) {
          return fullPath
        }
      }

      // 尝试 index 文件
      for (const ext of extensions) {
        const indexPath = path.join(resolved, `index${ext}`)
        if (await fs.pathExists(indexPath)) {
          return indexPath
        }
      }
    }

    return null
  }

  /**
   * 重置状态
   */
  private reset(): void {
    this.modules.clear()
    this.entryPoints.clear()
    this.processedFiles.clear()
    this.bytesRemoved = 0
    this.exportsRemoved = 0
    this.cssRulesRemoved = 0
  }

  /**
   * 格式化文件大小
   */
  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`
  }

  /**
   * 生成优化配置
   */
  generateOptimizationConfig(): any {
    const sideEffectsFreeModules: string[] = []

    // 收集无副作用的模块
    for (const [modulePath, moduleInfo] of this.modules) {
      if (!moduleInfo.sideEffects) {
        sideEffectsFreeModules.push(modulePath)
      }
    }

    return {
      optimization: {
        usedExports: true,
        sideEffects: true,
        providedExports: true,
        concatenateModules: true,
        innerGraph: true,
        mangleExports: true
      },
      module: {
        rules: [
          {
            test: /\.js$/,
            sideEffects: false,
            include: sideEffectsFreeModules
          }
        ]
      }
    }
  }
}

/**
 * 创建增强型 Tree Shaker
 */
export function createEnhancedTreeShaker(config?: TreeShakingConfig): EnhancedTreeShaker {
  return new EnhancedTreeShaker(config)
}


