/**
 * 高级 CSS Modules 插件
 * 提供更强大的 CSS Modules 支持
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import type { Plugin } from 'rollup'
import { createHash } from 'crypto'
import path from 'path'

/**
 * CSS Modules 插件选项
 */
export interface CSSModulesAdvancedOptions {
  /** 是否启用 CSS Modules */
  enabled?: boolean
  /** 生成的类名模式 */
  generateScopedName?: string | ((name: string, filename: string, css: string) => string)
  /** 是否启用作用域隔离 */
  scopeIsolation?: boolean
  /** 导出格式 */
  exportFormat?: 'camelCase' | 'camelCaseOnly' | 'dashes' | 'dashesOnly'
  /** 是否提取到单独文件 */
  extract?: boolean
  /** 输出文件路径 */
  outputPath?: string
  /** 是否压缩 */
  minify?: boolean
  /** 自定义 PostCSS 插件 */
  postcssPlugins?: any[]
}

/**
 * 创建高级 CSS Modules 插件
 */
export function cssModulesAdvancedPlugin(options: CSSModulesAdvancedOptions = {}): Plugin {
  const {
    enabled = true,
    generateScopedName,
    scopeIsolation = true,
    exportFormat = 'camelCase',
    extract = true,
    outputPath,
    minify = false,
    postcssPlugins = []
  } = options

  const cssMap = new Map<string, { code: string; exports: Record<string, string> }>()
  let extractedCSS = ''

  // 辅助函数定义在插件对象外部
  const defaultScopedName = (name: string, filename: string, css: string): string => {
    const hash = createHash('md5')
      .update(filename + css)
      .digest('hex')
      .substring(0, 6)

    const moduleName = path.basename(filename, path.extname(filename))
      .replace(/\.module$/, '')

    return `${moduleName}_${name}_${hash}`
  }

  const generateJSExport = (classes: Record<string, string>, format: string): string => {
    let exportObj = { ...classes }

    // 根据导出格式转换类名
    if (format === 'camelCase' || format === 'camelCaseOnly') {
      const converted: Record<string, string> = {}
      for (const [key, value] of Object.entries(classes)) {
        const camelKey = key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
        converted[camelKey] = value
        if (format === 'camelCase') {
          converted[key] = value // 保留原始的
        }
      }
      exportObj = converted
    }

    return `export default ${JSON.stringify(exportObj, null, 2)};`
  }

  return {
    name: 'css-modules-advanced',

    async transform(code, id) {
      if (!enabled) return null

      // 只处理 .module.css、.module.less、.module.scss 文件
      if (!/\.module\.(css|less|scss|sass)$/.test(id)) {
        return null
      }

      try {
        const postcss = (await import('postcss')).default
        const postcssModules = (await import('postcss-modules' as any)).default

        // CSS Modules 导出对象
        let exportedClasses: Record<string, string> = {}

        const plugins = [
          postcssModules({
            generateScopedName: generateScopedName || defaultScopedName,
            exportGlobals: true,
            getJSON: (cssFileName: string, json: Record<string, string>) => {
              exportedClasses = json
            }
          }),
          ...postcssPlugins
        ]

        // 添加压缩插件
        if (minify) {
          const cssnano = (await import('cssnano')).default
          plugins.push(cssnano({ preset: 'default' }))
        }

        const result = await postcss(plugins).process(code, {
          from: id,
          to: outputPath || id.replace(/\.module\.(css|less|scss|sass)$/, '.css')
        })

        // 存储处理后的 CSS
        cssMap.set(id, {
          code: result.css,
          exports: exportedClasses
        })

        if (extract) {
          extractedCSS += result.css + '\n'
        }

        // 生成 JS 模块导出
        const jsExport = generateJSExport(exportedClasses, exportFormat)

        return {
          code: jsExport,
          map: null
        }
      } catch (error) {
        this.error(`处理 CSS Modules 失败: ${(error as Error).message}`)
        return null
      }
    },

    async generateBundle() {
      // 如果启用了提取，输出 CSS 文件
      if (extract && extractedCSS) {
        const fileName = outputPath || 'styles.css'

        this.emitFile({
          type: 'asset',
          fileName,
          source: extractedCSS
        })
      }
    }
  }
}

/**
 * 创建 CSS 作用域隔离插件
 */
export function cssScopeIsolationPlugin(options: {
  scopePrefix?: string
  include?: RegExp
  exclude?: RegExp
} = {}): Plugin {
  const {
    scopePrefix = 'scope',
    include = /\.css$/,
    exclude = /node_modules/
  } = options

  const addScopeToCSS = (css: string, scope: string): string => {
    // 简单的作用域添加（为每个选择器添加前缀）
    return css.replace(/([^\r\n,{}]+)(,(?=[^}]*{)|\s*{)/g, (match, selector, delimiter) => {
      // 跳过 @规则
      if (selector.trim().startsWith('@')) {
        return match
      }

      // 跳过伪元素和伪类的根选择器
      if (selector.trim().startsWith(':')) {
        return match
      }

      return `[data-${scope}] ${selector.trim()}${delimiter}`
    })
  }

  return {
    name: 'css-scope-isolation',

    async transform(code, id) {
      if (!include.test(id) || exclude.test(id)) {
        return null
      }

      try {
        const scopeId = createHash('md5')
          .update(id)
          .digest('hex')
          .substring(0, 8)

        const scopedCode = addScopeToCSS(code, `${scopePrefix}-${scopeId}`)

        return {
          code: scopedCode,
          map: null
        }
      } catch (error) {
        this.error(`CSS 作用域隔离失败: ${(error as Error).message}`)
        return null
      }
    }
  }
}

