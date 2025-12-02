/**
 * 增强的 Less 处理插件
 * 
 * 功能:
 * - 全局变量和 mixins 注入
 * - Less 模块化支持
 * - 变量覆盖
 * - 跨文件 mixins 引用
 * - 路径别名解析
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import type { Plugin } from 'rollup'
import less from 'less'
import path from 'path'
import fs from 'fs-extra'

export interface EnhancedLessOptions {
  /**
   * Less 编译选项
   */
  lessOptions?: any

  /**
   * 全局导入的 Less 文件路径数组
   * 这些文件会自动注入到每个 Less 文件的顶部
   * @example ['src/styles/variables.less', 'src/styles/mixins.less']
   */
  globalImports?: string[]

  /**
   * Less 变量覆盖
   * @example { '@primary-color': '#1890ff', '@border-radius': '4px' }
   */
  modifyVars?: Record<string, string>

  /**
   * 是否启用模块化
   * 启用后，Less 文件将作为 ES Module 导出
   * @default false
   */
  modules?: boolean

  /**
   * 是否注入全局变量
   * @default true
   */
  injectGlobalVars?: boolean

  /**
   * 路径别名配置
   * @example { '@': 'src', '~': 'node_modules' }
   */
  alias?: Record<string, string>

  /**
   * 包含的文件模式
   * @default ['\*\*\/*.less']
   */
  include?: string[]

  /**
   * 排除的文件模式
   * @default ['node_modules/\*\*']
   */
  exclude?: string[]

  /**
   * 是否启用 source map
   * @default true
   */
  sourceMap?: boolean

  /**
   * 额外的 Less 路径
   * @default []
   */
  paths?: string[]
}

/**
 * 辅助函数：简单的文件匹配检查
 */
function isMatch(filePath: string, pattern: string): boolean {
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')
  return new RegExp(regexPattern).test(filePath)
}

/**
 * 辅助函数：生成哈希
 */
function generateHash(input: string): string {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36).slice(0, 6)
}

/**
 * 辅助函数：提取 CSS 模块类名
 */
function extractCSSModules(css: string, hash: string): Record<string, string> {
  const modules: Record<string, string> = {}

  // 简单的类名提取
  const classRegex = /\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g
  let match

  while ((match = classRegex.exec(css)) !== null) {
    const className = match[1]
    if (!modules[className]) {
      modules[className] = `${className}_${hash}`
    }
  }

  return modules
}

/**
 * 辅助函数：解析路径别名
 */
function resolveAliases(code: string, aliases: Record<string, string>, currentFile: string): string {
  let result = code

  for (const [aliasKey, aliasPath] of Object.entries(aliases)) {
    const importRegex = new RegExp(`@import\\s+["']${aliasKey}/([^"']+)["']`, 'g')
    result = result.replace(importRegex, (match, capturePath) => {
      const resolvedPath = path.resolve(process.cwd(), aliasPath, capturePath)
      const relativePath = path.relative(path.dirname(currentFile), resolvedPath)
      return `@import "${relativePath}"`
    })
  }

  return result
}

/**
 * 增强的 Less 插件
 */
export function enhancedLessPlugin(options: EnhancedLessOptions = {}): Plugin {
  const {
    lessOptions = {},
    globalImports = [],
    modifyVars = {},
    modules = false,
    injectGlobalVars = true,
    alias = {},
    include = ['**/*.less'],
    exclude = ['node_modules/**'],
    sourceMap = true,
    paths = []
  } = options

  // 缓存全局导入内容
  let globalImportContent = ''

  return {
    name: 'enhanced-less',

    /**
     * 构建开始，预加载全局导入
     */
    async buildStart() {
      if (globalImports.length > 0 && injectGlobalVars) {
        const contents = await Promise.all(
          globalImports.map(async (file) => {
            try {
              const resolvedPath = path.resolve(process.cwd(), file)
              const content = await fs.readFile(resolvedPath, 'utf-8')
              return `@import "${file}";`
            } catch (error) {
              this.warn(`Failed to load global import: ${file}`)
              return ''
            }
          })
        )
        globalImportContent = contents.filter(Boolean).join('\n')
      }
    },

    /**
     * 转换 Less 文件
     */
    async transform(code: string, id: string) {
      // 只处理 Less 文件
      if (!id.endsWith('.less')) {
        return null
      }

      // 检查排除规则
      if (exclude.some(pattern => isMatch(id, pattern))) {
        return null
      }

      // 检查包含规则
      if (!include.some(pattern => isMatch(id, pattern))) {
        return null
      }

      try {
        // 添加全局导入
        let finalCode = code
        if (globalImportContent && injectGlobalVars) {
          finalCode = globalImportContent + '\n' + code
        }

        // 解析路径别名
        finalCode = resolveAliases(finalCode, alias, id)

        // 编译 Less
        const result = await less.render(finalCode, {
          filename: id,
          paths: [
            path.dirname(id),
            'node_modules',
            process.cwd(),
            ...paths
          ],
          javascriptEnabled: true,
          modifyVars,
          sourceMap: sourceMap ? { sourceMapFileInline: true } : undefined,
          ...lessOptions
        })

        // 如果启用模块化
        if (modules) {
          // 生成唯一的类名哈希
          const hash = generateHash(id)
          const cssModules = extractCSSModules(result.css, hash)

          return {
            code: `export default ${JSON.stringify(result.css)};\nexport const styles = ${JSON.stringify(cssModules)};`,
            map: result.map ? JSON.parse(result.map) : null
          }
        }

        // 标准 CSS 输出
        return {
          code: result.css,
          map: result.map ? JSON.parse(result.map) : null
        }
      } catch (error: any) {
        this.error(`Less compilation error in ${id}:\n${error.message}`)
      }
    }
  }
}

/**
 * 默认配置
 */
export const defaultEnhancedLessOptions: EnhancedLessOptions = {
  lessOptions: {
    javascriptEnabled: true
  },
  globalImports: [],
  modifyVars: {},
  modules: false,
  injectGlobalVars: true,
  alias: {},
  include: ['**/*.less'],
  exclude: ['node_modules/**'],
  sourceMap: true,
  paths: []
}
