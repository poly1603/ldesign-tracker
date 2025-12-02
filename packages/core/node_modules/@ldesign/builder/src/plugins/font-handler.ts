/**
 * 字体文件处理插件
 * 
 * 功能:
 * - 自动复制字体文件到输出目录
 * - 支持小字体内联为 base64
 * - 自动处理 CSS 中的字体路径
 * - 支持多种字体格式 (.woff, .woff2, .ttf, .eot, .otf)
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import type { Plugin } from 'rollup'
import path from 'path'
import fs from 'fs-extra'

export interface FontHandlerOptions {
  /**
   * 字体文件输出目录
   * @default 'fonts'
   */
  outputDir?: string

  /**
   * 是否内联小字体文件
   * @default false
   */
  inline?: boolean

  /**
   * 内联大小限制（字节）
   * 小于此大小的字体文件将被内联为 base64
   * @default 8192 (8KB)
   */
  inlineLimit?: number

  /**
   * 支持的字体格式
   * @default ['.woff', '.woff2', '.eot', '.ttf', '.otf']
   */
  formats?: string[]

  /**
   * 是否在文件名中添加哈希
   * @default true
   */
  hash?: boolean

  /**
   * 哈希长度
   * @default 8
   */
  hashLength?: number

  /**
   * 公共路径前缀
   * @default ''
   */
  publicPath?: string
}

/**
 * 字体处理插件
 */
export function fontHandlerPlugin(options: FontHandlerOptions = {}): Plugin {
  const {
    outputDir = 'fonts',
    inline = false,
    inlineLimit = 8192,
    formats = ['.woff', '.woff2', '.eot', '.ttf', '.otf'],
    hash = true,
    hashLength = 8,
    publicPath = ''
  } = options

  // 存储字体文件映射
  const fontFiles = new Map<string, { buffer: Buffer; fileName: string }>()

  return {
    name: 'font-handler',

    /**
     * 加载字体文件
     */
    async load(id: string) {
      const ext = path.extname(id)

      // 只处理字体文件
      if (!formats.includes(ext)) {
        return null
      }

      try {
        const buffer = await fs.readFile(id)

        // 如果启用内联且文件小于限制
        if (inline && buffer.length <= inlineLimit) {
          const base64 = buffer.toString('base64')
          const mimeType = getMimeType(ext)
          return `export default "data:${mimeType};base64,${base64}"`
        }

        // 生成文件名
        let fileName = path.basename(id, ext)

        // 添加哈希
        if (hash) {
          const crypto = await import('crypto')
          const hashStr = crypto.createHash('md5').update(buffer as any).digest('hex').slice(0, hashLength)
          fileName = `${fileName}.${hashStr}`
        }

        fileName += ext
        const outputPath = path.join(outputDir, fileName)

        // 存储字体文件
        fontFiles.set(id, { buffer, fileName: outputPath })

        // 返回相对路径（带公共路径）
        const finalPath = publicPath ? path.join(publicPath, outputPath) : `./${outputPath}`
        return `export default "${finalPath.replace(/\\/g, '/')}"`
      } catch (error: any) {
        this.error(`Failed to load font file: ${id}\n${error.message}`)
      }
    },

    /**
     * 输出字体文件
     */
    async generateBundle() {
      // 输出所有字体文件
      for (const [, { buffer, fileName }] of fontFiles.entries()) {
        this.emitFile({
          type: 'asset',
          fileName,
          source: buffer as any
        })
      }
    },

    /**
     * 构建结束清理
     */
    buildEnd() {
      fontFiles.clear()
    }
  }
}

/**
 * 获取字体文件的 MIME 类型
 */
function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.eot': 'application/vnd.ms-fontobject'
  }
  return mimeTypes[ext] || 'application/octet-stream'
}

/**
 * 导出默认配置
 */
export const defaultFontHandlerOptions: FontHandlerOptions = {
  outputDir: 'fonts',
  inline: false,
  inlineLimit: 8192,
  formats: ['.woff', '.woff2', '.eot', '.ttf', '.otf'],
  hash: true,
  hashLength: 8,
  publicPath: ''
}
