/**
 * 双JSX转换器
 * 
 * 支持在同一项目中处理Vue JSX和React JSX的转换
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import { transformSync, TransformOptions } from '@babel/core'
import babelPluginJsx from '@vue/babel-plugin-jsx'
import { Logger } from '../utils/logger'

/**
 * JSX转换配置
 */
export interface JSXTransformConfig {
  /** JSX pragma */
  pragma?: string
  /** JSX Fragment pragma */
  pragmaFrag?: string
  /** 导入源 */
  importSource?: string
  /** 运行时 */
  runtime?: 'classic' | 'automatic'
  /** 是否优化 */
  optimize?: boolean
  /** 是否合并props */
  mergeProps?: boolean
  /** 是否启用对象插槽 */
  enableObjectSlots?: boolean
  /** 转换开关 */
  transformOn?: boolean
  /** 是否解析嵌套 */
  resolveType?: boolean
}

/**
 * 转换结果
 */
export interface TransformResult {
  /** 转换后的代码 */
  code: string
  /** Source map */
  map?: any
  /** AST */
  ast?: any
  /** 元数据 */
  metadata?: {
    framework: 'vue' | 'react'
    imports: string[]
    components: string[]
  }
}

/**
 * 双JSX转换器
 */
export class DualJSXTransformer {
  private logger: Logger

  /** Vue JSX默认配置 */
  private vueJSXConfig: JSXTransformConfig = {
    pragma: 'h',
    pragmaFrag: 'Fragment',
    importSource: 'vue',
    optimize: true,
    mergeProps: true,
    enableObjectSlots: true,
    transformOn: true,
    resolveType: true
  }

  /** React JSX默认配置 */
  private reactJSXConfig: JSXTransformConfig = {
    pragma: 'React.createElement',
    pragmaFrag: 'React.Fragment',
    importSource: 'react',
    runtime: 'automatic'
  }

  constructor() {
    this.logger = new Logger({ prefix: '[DualJSXTransformer]' })
  }

  /**
   * 转换代码
   */
  async transform(
    code: string,
    framework: 'vue' | 'react',
    options: Partial<JSXTransformConfig> = {}
  ): Promise<TransformResult> {
    this.logger.debug(`转换 ${framework} JSX`)

    try {
      if (framework === 'vue') {
        return await this.transformVueJSX(code, options)
      } else {
        return await this.transformReactJSX(code, options)
      }
    } catch (error) {
      this.logger.error(`JSX转换失败: ${error}`)
      throw error
    }
  }

  /**
   * 转换Vue JSX
   */
  private async transformVueJSX(
    code: string,
    options: Partial<JSXTransformConfig>
  ): Promise<TransformResult> {
    const config = { ...this.vueJSXConfig, ...options }

    // 准备Babel配置
    const babelOptions: TransformOptions = {
      filename: 'temp.tsx',
      presets: [
        ['@babel/preset-typescript', {
          isTSX: true,
          allExtensions: true
        }]
      ],
      plugins: [
        [babelPluginJsx, {
          optimize: config.optimize,
          mergeProps: config.mergeProps,
          enableObjectSlots: config.enableObjectSlots,
          transformOn: config.transformOn,
          resolveType: config.resolveType,
          pragma: config.pragma,
          pragmaFrag: config.pragmaFrag
        }]
      ],
      sourceMaps: true,
      ast: true
    }

    // 执行转换
    const result = transformSync(code, babelOptions)

    if (!result || !result.code) {
      throw new Error('Vue JSX转换失败')
    }

    // 提取元数据
    const metadata = this.extractVueMetadata(code, result.ast)

    return {
      code: result.code,
      map: result.map,
      ast: result.ast,
      metadata: {
        framework: 'vue',
        ...metadata
      }
    }
  }

  /**
   * 转换React JSX
   */
  private async transformReactJSX(
    code: string,
    options: Partial<JSXTransformConfig>
  ): Promise<TransformResult> {
    const config = { ...this.reactJSXConfig, ...options }

    // 准备Babel配置
    const babelOptions: TransformOptions = {
      filename: 'temp.tsx',
      presets: [
        ['@babel/preset-typescript', {
          isTSX: true,
          allExtensions: true
        }],
        ['@babel/preset-react', {
          runtime: config.runtime,
          importSource: config.importSource,
          pragma: config.runtime === 'classic' ? config.pragma : undefined,
          pragmaFrag: config.runtime === 'classic' ? config.pragmaFrag : undefined
        }]
      ],
      sourceMaps: true,
      ast: true
    }

    // 执行转换
    const result = transformSync(code, babelOptions)

    if (!result || !result.code) {
      throw new Error('React JSX转换失败')
    }

    // 提取元数据
    const metadata = this.extractReactMetadata(code, result.ast)

    return {
      code: result.code,
      map: result.map,
      ast: result.ast,
      metadata: {
        framework: 'react',
        ...metadata
      }
    }
  }

  /**
   * 提取Vue元数据
   */
  private extractVueMetadata(code: string, ast: any): any {
    const imports: string[] = []
    const components: string[] = []

    // 简单的正则提取，实际应该用AST遍历
    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g
    let match
    while ((match = importRegex.exec(code)) !== null) {
      imports.push(match[1])
    }

    // 提取组件
    const componentRegex = /defineComponent\s*\(\s*\{[\s\S]*?name:\s*['"]([^'"]+)['"]/g
    while ((match = componentRegex.exec(code)) !== null) {
      components.push(match[1])
    }

    return { imports, components }
  }

  /**
   * 提取React元数据
   */
  private extractReactMetadata(code: string, ast: any): any {
    const imports: string[] = []
    const components: string[] = []

    // 简单的正则提取
    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g
    let match
    while ((match = importRegex.exec(code)) !== null) {
      imports.push(match[1])
    }

    // 提取组件（函数组件和类组件）
    const functionComponentRegex = /(?:export\s+)?(?:const|function)\s+([A-Z][A-Za-z0-9]*)\s*[=:]/g
    while ((match = functionComponentRegex.exec(code)) !== null) {
      components.push(match[1])
    }

    const classComponentRegex = /class\s+([A-Z][A-Za-z0-9]*)\s+extends\s+(?:React\.)?Component/g
    while ((match = classComponentRegex.exec(code)) !== null) {
      components.push(match[1])
    }

    return { imports, components }
  }

  /**
   * 批量转换
   */
  async transformBatch(
    files: Array<{
      code: string
      framework: 'vue' | 'react'
      options?: Partial<JSXTransformConfig>
    }>
  ): Promise<TransformResult[]> {
    return Promise.all(
      files.map(file => this.transform(file.code, file.framework, file.options))
    )
  }

  /**
   * 自动检测并转换
   */
  async autoTransform(
    code: string,
    filePath: string,
    frameworkHint?: 'vue' | 'react'
  ): Promise<TransformResult> {
    // 如果提供了框架提示，直接使用
    if (frameworkHint) {
      return this.transform(code, frameworkHint)
    }

    // 否则尝试从代码中检测
    const framework = this.detectFrameworkFromCode(code, filePath)
    return this.transform(code, framework)
  }

  /**
   * 从代码中检测框架
   */
  private detectFrameworkFromCode(code: string, filePath: string): 'vue' | 'react' {
    // 检查文件路径
    if (filePath.includes('.vue.') || filePath.includes('/vue/')) {
      return 'vue'
    }
    if (filePath.includes('.react.') || filePath.includes('/react/')) {
      return 'react'
    }

    // 检查导入
    if (code.includes('from "vue"') || code.includes("from 'vue'")) {
      return 'vue'
    }
    if (code.includes('from "react"') || code.includes("from 'react'")) {
      return 'react'
    }

    // 检查特征代码
    if (code.includes('defineComponent') || code.includes('ref(') || code.includes('reactive(')) {
      return 'vue'
    }
    if (code.includes('useState') || code.includes('useEffect') || code.includes('React.Component')) {
      return 'react'
    }

    // 默认为React（更通用）
    return 'react'
  }

  /**
   * 创建条件转换器
   */
  createConditionalTransformer(
    condition: (code: string, filePath: string) => boolean,
    framework: 'vue' | 'react',
    options?: Partial<JSXTransformConfig>
  ) {
    return {
      name: `conditional-jsx-${framework}`,
      enforce: 'pre' as const,

      transform: async (code: string, id: string) => {
        if (!id.match(/\.[jt]sx?$/) || !condition(code, id)) {
          return null
        }

        const result = await this.transform(code, framework, options)
        return {
          code: result.code,
          map: result.map
        }
      }
    }
  }

  /**
   * 获取Vue JSX配置
   */
  getVueConfig(): JSXTransformConfig {
    return { ...this.vueJSXConfig }
  }

  /**
   * 获取React JSX配置
   */
  getReactConfig(): JSXTransformConfig {
    return { ...this.reactJSXConfig }
  }

  /**
   * 更新配置
   */
  updateConfig(framework: 'vue' | 'react', config: Partial<JSXTransformConfig>): void {
    if (framework === 'vue') {
      this.vueJSXConfig = { ...this.vueJSXConfig, ...config }
    } else {
      this.reactJSXConfig = { ...this.reactJSXConfig, ...config }
    }
  }
}

/**
 * 创建双JSX转换器
 */
export function createDualJSXTransformer(): DualJSXTransformer {
  return new DualJSXTransformer()
}
