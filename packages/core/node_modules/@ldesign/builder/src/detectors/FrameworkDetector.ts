/**
 * 框架检测器
 * 
 * 自动检测文件所属的前端框架类型（Vue/React）
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import * as fs from 'fs-extra'
import * as path from 'path'
import { parse } from '@babel/parser'
import traverse from '@babel/traverse'
import * as t from '@babel/types'
import { Logger } from '../utils/logger'

/**
 * 框架信息
 */
export interface FrameworkInfo {
  /** 框架类型 */
  type: 'vue' | 'react' | 'unknown'
  /** 框架版本 */
  version?: string
  /** JSX处理方式 */
  jsx?: 'vue-jsx' | 'react-jsx' | 'preserve'
  /** JSX pragma */
  pragma?: string
  /** JSX Fragment pragma */
  pragmaFrag?: string
  /** 置信度 (0-1) */
  confidence: number
}

/**
 * 检测配置
 */
export interface DetectionConfig {
  /** 文件关联规则 */
  fileAssociations?: Record<string, 'vue' | 'react'>
  /** 默认框架 */
  defaultFramework?: 'vue' | 'react'
  /** 启用内容检测 */
  enableContentDetection?: boolean
  /** 启用导入检测 */
  enableImportDetection?: boolean
  /** 启用pragma检测 */
  enablePragmaDetection?: boolean
}

/**
 * 框架检测器
 */
export class FrameworkDetector {
  private logger: Logger
  private config: DetectionConfig
  private cache: Map<string, FrameworkInfo> = new Map()

  constructor(config: DetectionConfig = {}) {
    this.config = {
      enableContentDetection: true,
      enableImportDetection: true,
      enablePragmaDetection: true,
      ...config
    }
    this.logger = new Logger({ prefix: '[FrameworkDetector]' })
  }

  /**
   * 检测文件的框架类型
   */
  async detect(filePath: string): Promise<FrameworkInfo> {
    // 检查缓存
    if (this.cache.has(filePath)) {
      return this.cache.get(filePath)!
    }

    let result: FrameworkInfo = {
      type: 'unknown',
      confidence: 0
    }

    // 1. 通过文件扩展名检测
    const extResult = this.detectFromExtension(filePath)
    if (extResult.confidence > result.confidence) {
      result = extResult
    }

    // 2. 通过文件关联规则检测
    if (this.config.fileAssociations) {
      const assocResult = this.detectFromAssociations(filePath)
      if (assocResult.confidence > result.confidence) {
        result = assocResult
      }
    }

    // 3. 通过文件内容检测
    if (this.config.enableContentDetection && await fs.pathExists(filePath)) {
      const content = await fs.readFile(filePath, 'utf-8')

      // 3.1 通过导入语句检测
      if (this.config.enableImportDetection) {
        const importResult = this.detectFromImports(content)
        if (importResult.confidence > result.confidence) {
          result = importResult
        }
      }

      // 3.2 通过JSX pragma检测
      if (this.config.enablePragmaDetection) {
        const pragmaResult = this.detectFromPragma(content)
        if (pragmaResult.confidence > result.confidence) {
          result = pragmaResult
        }
      }

      // 3.3 通过代码特征检测
      const contentResult = this.detectFromContent(content, filePath)
      if (contentResult.confidence > result.confidence) {
        result = contentResult
      }
    }

    // 4. 使用默认框架
    if (result.type === 'unknown' && this.config.defaultFramework) {
      result = {
        type: this.config.defaultFramework,
        confidence: 0.1
      }
    }

    // 缓存结果
    this.cache.set(filePath, result)

    this.logger.debug(`检测文件 ${filePath}: ${result.type} (置信度: ${result.confidence})`)

    return result
  }

  /**
   * 通过文件扩展名检测
   */
  private detectFromExtension(filePath: string): FrameworkInfo {
    const ext = path.extname(filePath).toLowerCase()
    const basename = path.basename(filePath)

    // Vue 文件
    if (ext === '.vue') {
      return {
        type: 'vue',
        confidence: 1.0
      }
    }

    // 特定命名模式
    if (basename.includes('.vue.')) {
      return {
        type: 'vue',
        jsx: 'vue-jsx',
        confidence: 0.9
      }
    }

    if (basename.includes('.react.')) {
      return {
        type: 'react',
        jsx: 'react-jsx',
        confidence: 0.9
      }
    }

    return {
      type: 'unknown',
      confidence: 0
    }
  }

  /**
   * 通过文件关联规则检测
   */
  private detectFromAssociations(filePath: string): FrameworkInfo {
    if (!this.config.fileAssociations) {
      return { type: 'unknown', confidence: 0 }
    }

    const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/')

    for (const [pattern, framework] of Object.entries(this.config.fileAssociations)) {
      if (this.matchPattern(relativePath, pattern)) {
        return {
          type: framework,
          jsx: framework === 'vue' ? 'vue-jsx' : 'react-jsx',
          confidence: 0.95
        }
      }
    }

    return { type: 'unknown', confidence: 0 }
  }

  /**
   * 通过导入语句检测
   */
  detectFromImports(content: string): FrameworkInfo {
    const imports = this.extractImports(content)

    let vueScore = 0
    let reactScore = 0

    for (const imp of imports) {
      // Vue 相关导入
      if (imp === 'vue' || imp.startsWith('@vue/')) {
        vueScore += 10
      }
      if (imp === 'vue-router' || imp === 'vuex' || imp === 'pinia') {
        vueScore += 5
      }
      if (imp.includes('vue')) {
        vueScore += 2
      }

      // React 相关导入
      if (imp === 'react' || imp === 'react-dom') {
        reactScore += 10
      }
      if (imp.startsWith('@react/') || imp === 'react-router' || imp === 'redux') {
        reactScore += 5
      }
      if (imp.includes('react')) {
        reactScore += 2
      }
    }

    if (vueScore > reactScore && vueScore > 0) {
      return {
        type: 'vue',
        jsx: 'vue-jsx',
        confidence: Math.min(vueScore / 20, 0.95)
      }
    }

    if (reactScore > vueScore && reactScore > 0) {
      return {
        type: 'react',
        jsx: 'react-jsx',
        confidence: Math.min(reactScore / 20, 0.95)
      }
    }

    return { type: 'unknown', confidence: 0 }
  }

  /**
   * 通过JSX pragma检测
   */
  detectFromPragma(content: string): FrameworkInfo {
    // 检查 @jsx pragma
    const jsxPragmaMatch = content.match(/\/\*\*?\s*@jsx\s+(\S+)\s*\*\//m)
    if (jsxPragmaMatch) {
      const pragma = jsxPragmaMatch[1]

      if (pragma === 'h' || pragma === 'createElement') {
        return {
          type: 'vue',
          jsx: 'vue-jsx',
          pragma,
          confidence: 0.9
        }
      }

      if (pragma === 'React.createElement' || pragma === 'jsx') {
        return {
          type: 'react',
          jsx: 'react-jsx',
          pragma,
          confidence: 0.9
        }
      }
    }

    // 检查 @jsxImportSource pragma
    const importSourceMatch = content.match(/\/\*\*?\s*@jsxImportSource\s+(\S+)\s*\*\//m)
    if (importSourceMatch) {
      const source = importSourceMatch[1]

      if (source === 'vue') {
        return {
          type: 'vue',
          jsx: 'vue-jsx',
          confidence: 0.95
        }
      }

      if (source === 'react') {
        return {
          type: 'react',
          jsx: 'react-jsx',
          confidence: 0.95
        }
      }
    }

    return { type: 'unknown', confidence: 0 }
  }

  /**
   * 通过文件内容检测
   */
  detectFromContent(content: string, filePath: string): FrameworkInfo {
    try {
      const ast = parse(content, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx', 'decorators-legacy'],
        errorRecovery: true
      })

      let vueFeatures = 0
      let reactFeatures = 0

      traverse(ast, {
        // 检测 Vue 特征
        CallExpression(path) {
          const callee = path.node.callee

          // Vue 3 Composition API
          if (t.isIdentifier(callee)) {
            const name = callee.name
            if (['defineComponent', 'ref', 'reactive', 'computed', 'watch', 'onMounted'].includes(name)) {
              vueFeatures += 3
            }
            if (['createApp', 'h', 'createVNode'].includes(name)) {
              vueFeatures += 2
            }
          }

          // React Hooks
          if (t.isIdentifier(callee)) {
            const name = callee.name
            if (name.startsWith('use') && name.length > 3) {
              reactFeatures += 2
            }
            if (['useState', 'useEffect', 'useCallback', 'useMemo', 'useRef'].includes(name)) {
              reactFeatures += 3
            }
          }

          // React.createElement
          if (t.isMemberExpression(callee)) {
            if (t.isIdentifier(callee.object, { name: 'React' }) &&
              t.isIdentifier(callee.property, { name: 'createElement' })) {
              reactFeatures += 3
            }
          }
        },

        // 检测装饰器
        Decorator(path) {
          const decorator = path.node.expression
          if (t.isIdentifier(decorator)) {
            // Vue 装饰器
            if (['Component', 'Prop', 'Watch', 'Emit'].includes(decorator.name)) {
              vueFeatures += 2
            }
          }
        },

        // 检测JSX
        JSXElement() {
          // 有JSX但还不能确定是哪个框架
          // 需要结合其他特征判断
        },

        // 检测类组件
        ClassDeclaration(path) {
          const superClass = path.node.superClass

          // React.Component
          if (t.isMemberExpression(superClass)) {
            if (t.isIdentifier(superClass.object, { name: 'React' }) &&
              t.isIdentifier(superClass.property, { name: 'Component' })) {
              reactFeatures += 5
            }
          }

          // Vue.extend
          if (t.isCallExpression(superClass)) {
            if (t.isMemberExpression(superClass.callee)) {
              if (t.isIdentifier(superClass.callee.object, { name: 'Vue' }) &&
                t.isIdentifier(superClass.callee.property, { name: 'extend' })) {
                vueFeatures += 5
              }
            }
          }
        }
      })

      if (vueFeatures > reactFeatures && vueFeatures > 0) {
        return {
          type: 'vue',
          jsx: 'vue-jsx',
          confidence: Math.min(vueFeatures / 15, 0.9)
        }
      }

      if (reactFeatures > vueFeatures && reactFeatures > 0) {
        return {
          type: 'react',
          jsx: 'react-jsx',
          confidence: Math.min(reactFeatures / 15, 0.9)
        }
      }

    } catch (error) {
      this.logger.debug(`解析文件 ${filePath} 失败: ${error}`)
    }

    return { type: 'unknown', confidence: 0 }
  }

  /**
   * 提取导入语句
   */
  private extractImports(content: string): string[] {
    const imports: string[] = []

    // ES6 import
    const importRegex = /import\s+(?:.*?\s+from\s+)?['"]([^'"]+)['"]/g
    let match
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1])
    }

    // require
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
    while ((match = requireRegex.exec(content)) !== null) {
      imports.push(match[1])
    }

    return imports
  }

  /**
   * 匹配模式
   */
  private matchPattern(filePath: string, pattern: string): boolean {
    // 转换为正则表达式
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.')

    const regex = new RegExp(`^${regexPattern}$`)
    return regex.test(filePath)
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * 批量检测
   */
  async detectBatch(filePaths: string[]): Promise<Map<string, FrameworkInfo>> {
    const results = new Map<string, FrameworkInfo>()

    await Promise.all(
      filePaths.map(async filePath => {
        const info = await this.detect(filePath)
        results.set(filePath, info)
      })
    )

    return results
  }
}

/**
 * 创建框架检测器
 */
export function createFrameworkDetector(config?: DetectionConfig): FrameworkDetector {
  return new FrameworkDetector(config)
}


