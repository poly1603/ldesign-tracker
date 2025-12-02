/**
 * CSS-in-JS 插件
 * 支持 styled-components、emotion 等 CSS-in-JS 方案
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import type { Plugin } from 'rollup'

/**
 * CSS-in-JS 方案类型
 */
export type CSSInJSLibrary = 'styled-components' | 'emotion' | '@emotion/react' | '@emotion/styled'

/**
 * CSS-in-JS 插件选项
 */
export interface CSSInJSPluginOptions {
  /** CSS-in-JS 库 */
  library?: CSSInJSLibrary
  /** 是否启用 SSR */
  ssr?: boolean
  /** 是否启用 source maps */
  sourceMap?: boolean
  /** 自定义标签名 */
  displayName?: boolean
  /** 是否压缩 */
  minify?: boolean
}

/**
 * 创建 CSS-in-JS 插件
 */
export function cssInJSPlugin(options: CSSInJSPluginOptions = {}): Plugin {
  const {
    library = 'styled-components',
    ssr = false,
    sourceMap = true,
    displayName = true,
    minify = false
  } = options

  // 辅助函数定义在插件对象外部
  const usesCSSInJS = (code: string, lib: CSSInJSLibrary): boolean => {
    if (lib === 'styled-components') {
      return code.includes('styled-components') || code.includes('styled.')
    } else if (lib.startsWith('emotion') || lib.startsWith('@emotion')) {
      return code.includes('@emotion') || code.includes('css`') || code.includes('styled(')
    }
    return false
  }

  const transformStyledComponents = async (code: string, id: string, opts: any, warn: (msg: string) => void) => {
    try {
      // 尝试使用 Babel 插件转换
      const babel = await import('@babel/core' as any)
      const babelPluginStyledComponents = await import('babel-plugin-styled-components' as any)

      const result = await babel.transformAsync(code, {
        filename: id,
        plugins: [
          [babelPluginStyledComponents.default, {
            ssr: opts.ssr,
            displayName: opts.displayName,
            fileName: true,
            minify: opts.minify,
            transpileTemplateLiterals: true
          }]
        ],
        sourceMaps: opts.sourceMap,
        compact: opts.minify
      })

      return {
        code: result?.code || code,
        map: result?.map || null
      }
    } catch (error) {
      warn('styled-components 转换失败，需要安装 babel-plugin-styled-components')
      return null
    }
  }

  const transformEmotion = async (code: string, id: string, opts: any, warn: (msg: string) => void) => {
    try {
      // 尝试使用 Babel 插件转换
      const babel = await import('@babel/core' as any)
      const babelPluginEmotion = await import('@emotion/babel-plugin' as any)

      const result = await babel.transformAsync(code, {
        filename: id,
        plugins: [
          [babelPluginEmotion.default, {
            sourceMap: opts.sourceMap,
            autoLabel: opts.displayName ? 'dev-only' : 'never',
            labelFormat: '[local]'
          }]
        ],
        sourceMaps: opts.sourceMap
      })

      return {
        code: result?.code || code,
        map: result?.map || null
      }
    } catch (error) {
      warn('Emotion 转换失败，需要安装 @emotion/babel-plugin')
      return null
    }
  }

  return {
    name: 'css-in-js',

    async transform(code, id) {
      // 只处理 JS/TS 文件
      if (!/\.(jsx?|tsx?)$/.test(id)) {
        return null
      }

      // 检查是否使用了 CSS-in-JS
      if (!usesCSSInJS(code, library)) {
        return null
      }

      try {
        // 根据不同的库使用不同的处理方式
        if (library === 'styled-components') {
          return await transformStyledComponents(code, id, {
            ssr,
            displayName,
            sourceMap,
            minify
          }, this.warn.bind(this))
        } else if (library.startsWith('emotion') || library.startsWith('@emotion')) {
          return await transformEmotion(code, id, {
            sourceMap,
            displayName
          }, this.warn.bind(this))
        }

        return null
      } catch (error) {
        this.warn(`处理 CSS-in-JS 失败: ${(error as Error).message}`)
        return null
      }
    }
  }
}

