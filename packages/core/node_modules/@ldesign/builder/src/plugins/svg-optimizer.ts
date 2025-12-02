/**
 * SVG 优化插件
 * 
 * SVGO 集成、SVG Sprite 生成、React/Vue 组件生成
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import type { UnifiedPlugin } from '../types/plugin'
import path from 'path'
import fs from 'fs-extra'

/**
 * SVG 优化选项
 */
export interface SVGOptimizerOptions {
  /** 是否启用 */
  enabled?: boolean

  /** SVGO 配置 */
  svgo?: boolean | {
    plugins?: any[]
  }

  /** 是否生成 sprite */
  sprite?: boolean | {
    outputPath?: string
    symbolId?: string | ((fileName: string) => string)
  }

  /** 是否生成 React 组件 */
  reactComponent?: boolean

  /** 是否生成 Vue 组件 */
  vueComponent?: boolean

  /** 是否内联小 SVG */
  inlineLimit?: number // bytes
}

/**
 * SVG 优化插件
 */
export function svgOptimizerPlugin(options: SVGOptimizerOptions = {}): UnifiedPlugin {
  const opts = {
    enabled: options.enabled !== false,
    svgo: options.svgo !== false,
    sprite: options.sprite || false,
    reactComponent: options.reactComponent || false,
    vueComponent: options.vueComponent || false,
    inlineLimit: options.inlineLimit || 4096 // 4KB
  }

  const processedSVGs = new Map<string, string>()
  const spriteSymbols: Array<{ id: string; content: string }> = []

  return {
    name: 'svg-optimizer',

    rollup: {
      name: 'svg-optimizer',

      async load(id: string) {
        if (!opts.enabled || !id.endsWith('.svg')) {
          return null
        }

        const content = await fs.readFile(id, 'utf-8')
        let optimized = content

        // SVGO 优化
        if (opts.svgo) {
          optimized = this.optimizeSVG(content)
        }

        // 生成 React 组件
        if (opts.reactComponent) {
          return this.generateReactComponent(optimized, id)
        }

        // 生成 Vue 组件
        if (opts.vueComponent) {
          return this.generateVueComponent(optimized, id)
        }

        // 添加到 sprite
        if (opts.sprite) {
          const symbolId = this.generateSymbolId(id)
          spriteSymbols.push({ id: symbolId, content: optimized })
        }

        // 内联或作为资源
        if (Buffer.byteLength(optimized) < opts.inlineLimit) {
          return `export default ${JSON.stringify(optimized)}`
        }

        return null
      },

      optimizeSVG(content: string): string {
        // 简化实现 - 实际应该使用 SVGO
        // 移除注释、多余空白等
        return content
          .replace(/<!--[\s\S]*?-->/g, '')
          .replace(/\s+/g, ' ')
          .replace(/>\s+</g, '><')
          .trim()
      },

      generateReactComponent(svg: string, filePath: string): string {
        const componentName = this.getComponentName(filePath)

        return `
import React from 'react'

export function ${componentName}(props) {
  return (
    <svg {...props} dangerouslySetInnerHTML={{ __html: ${JSON.stringify(svg)} }} />
  )
}

export default ${componentName}
`
      },

      generateVueComponent(svg: string, filePath: string): string {
        const componentName = this.getComponentName(filePath)

        return `
<template>
  <svg v-bind="$attrs" v-html="svgContent" />
</template>

<script setup>
const svgContent = ${JSON.stringify(svg)}
</script>
`
      },

      getComponentName(filePath: string): string {
        const name = path.basename(filePath, '.svg')
        return name
          .split(/[-_]/)
          .map(part => part.charAt(0).toUpperCase() + part.slice(1))
          .join('')
      },

      generateSymbolId(filePath: string): string {
        const name = path.basename(filePath, '.svg')
        return `icon-${name}`
      },

      async buildEnd() {
        // 生成 sprite 文件
        if (opts.sprite && spriteSymbols.length > 0) {
          const spriteContent = this.generateSprite(spriteSymbols)
          const spritePath = typeof opts.sprite === 'object' && opts.sprite.outputPath
            ? opts.sprite.outputPath
            : 'dist/sprite.svg'

          await fs.ensureDir(path.dirname(spritePath))
          await fs.writeFile(spritePath, spriteContent)
        }
      },

      generateSprite(symbols: Array<{ id: string; content: string }>): string {
        const symbolsHTML = symbols.map(({ id, content }) => {
          // 提取 SVG 内容
          const match = content.match(/<svg[^>]*>([\s\S]*)<\/svg>/i)
          const innerContent = match ? match[1] : content

          return `<symbol id="${id}">${innerContent}</symbol>`
        }).join('\n')

        return `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">
${symbolsHTML}
</svg>`
      }
    }

    // esbuild 插件实现（可选）
    /*
    , esbuild: {
      name: 'svg-optimizer',
      setup(build: any) {
        build.onLoad({ filter: /\.svg$/ }, async (args: any) => {
          const content = await fs.readFile(args.path, 'utf-8')

          // 简单内联
          if (Buffer.byteLength(content) < opts.inlineLimit) {
            return {
              contents: `export default ${JSON.stringify(content)}`,
              loader: 'js'
            }
          }

          return {
            contents: content,
            loader: 'file'
          }
        })
      }
    }
    */
  }
}


