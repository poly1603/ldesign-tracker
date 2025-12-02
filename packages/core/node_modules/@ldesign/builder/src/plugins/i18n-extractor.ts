/**
 * 国际化资源提取插件
 * 
 * 自动提取代码中的翻译文本，生成语言包
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import type { UnifiedPlugin } from '../types/plugin'
import path from 'path'
import fs from 'fs-extra'

/**
 * i18n 提取选项
 */
export interface I18nExtractorOptions {
  /** 是否启用 */
  enabled?: boolean

  /** 提取函数名称 */
  functionNames?: string[]

  /** 输出目录 */
  outDir?: string

  /** 支持的语言 */
  locales?: string[]

  /** 默认语言 */
  defaultLocale?: string

  /** 是否自动翻译 */
  autoTranslate?: boolean

  /** 翻译服务 */
  translateService?: 'google' | 'deepl' | 'custom'

  /** 是否生成类型定义 */
  generateTypes?: boolean
}

/**
 * 翻译条目
 */
interface TranslationEntry {
  key: string
  defaultText: string
  locations: Array<{
    file: string
    line: number
    column: number
  }>
  context?: string
}

/**
 * i18n 提取器插件
 */
export function i18nExtractorPlugin(options: I18nExtractorOptions = {}): UnifiedPlugin {
  const opts = {
    enabled: options.enabled !== false,
    functionNames: options.functionNames || ['t', '$t', 'i18n.t', 'translate'],
    outDir: options.outDir || 'locales',
    locales: options.locales || ['en', 'zh'],
    defaultLocale: options.defaultLocale || 'en',
    autoTranslate: options.autoTranslate || false,
    translateService: options.translateService || 'google',
    generateTypes: options.generateTypes !== false
  }

  const translations = new Map<string, TranslationEntry>()

  return {
    name: 'i18n-extractor',

    rollup: {
      name: 'i18n-extractor',

      async transform(code: string, id: string) {
        if (!opts.enabled) {
          return null
        }

        // 只处理源代码文件
        if (!this.isSourceFile(id)) {
          return null
        }

        // 提取翻译
        this.extractTranslations(code, id)

        return null
      },

      isSourceFile(filePath: string): boolean {
        const ext = path.extname(filePath)
        return ['.js', '.ts', '.jsx', '.tsx', '.vue', '.svelte'].includes(ext)
      },

      extractTranslations(code: string, filePath: string): void {
        // 匹配翻译函数调用
        const patterns = opts.functionNames.map(fn =>
          new RegExp(`${fn}\\s*\\(\\s*['"\`]([^'"\`]+)['"\`]`, 'g')
        )

        for (const pattern of patterns) {
          let match
          while ((match = pattern.exec(code)) !== null) {
            const key = match[1]
            const line = code.substring(0, match.index).split('\n').length

            if (!translations.has(key)) {
              translations.set(key, {
                key,
                defaultText: key,
                locations: [],
                context: undefined
              })
            }

            const entry = translations.get(key)!
            entry.locations.push({
              file: filePath,
              line,
              column: match.index - code.lastIndexOf('\n', match.index)
            })
          }
        }
      },

      async buildEnd() {
        if (translations.size === 0) {
          return
        }

        console.log(`\n[i18n] 提取了 ${translations.size} 个翻译条目`)

        // 生成语言包文件
        for (const locale of opts.locales) {
          await this.generateLocaleFile(locale)
        }

        // 生成类型定义
        if (opts.generateTypes) {
          await this.generateTypes()
        }
      },

      async generateLocaleFile(locale: string): Promise<void> {
        const localeData: Record<string, string> = {}

        for (const [key, entry] of translations) {
          if (locale === opts.defaultLocale) {
            localeData[key] = entry.defaultText
          } else {
            // 这里应该调用翻译 API
            localeData[key] = entry.defaultText // 占位
          }
        }

        const outputPath = path.join(opts.outDir, `${locale}.json`)
        await fs.ensureDir(path.dirname(outputPath))
        await fs.writeJSON(outputPath, localeData, { spaces: 2 })

        console.log(`[i18n] 生成 ${locale} 语言包: ${outputPath}`)
      },

      async generateTypes(): Promise<void> {
        const keys = Array.from(translations.keys())

        const typeDef = `// Auto-generated i18n types
export type TranslationKey = ${keys.map(k => `'${k}'`).join(' | ')}

export interface Translations {
  ${keys.map(k => `'${k}': string`).join('\n  ')}
}
`

        const typePath = path.join(opts.outDir, 'types.d.ts')
        await fs.ensureDir(path.dirname(typePath))
        await fs.writeFile(typePath, typeDef)

        console.log(`[i18n] 生成类型定义: ${typePath}`)
      }
    }
  }
}


