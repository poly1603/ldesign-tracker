/**
 * Vue Style Entry Generator Plugin
 * 
 * 为每个 Vue 组件生成 style/index.js 入口文件，用于按需导入样式
 * 
 * 功能：
 * 1. 检测打包后生成的 CSS 文件
 * 2. 为每个 CSS 文件生成对应的 style/index.js
 * 3. 支持 ESM 和 CJS 两种格式
 * 
 * 使用场景：
 * - Vue 组件库打包
 * - 需要支持按需导入样式
 * - 类似 TDesign 的样式导入方式
 * 
 * @example
 * ```typescript
 * // 生成前
 * cjs/language-switcher/index.css
 * 
 * // 生成后
 * cjs/language-switcher/style/index.js  // require('../index.css')
 * esm/language-switcher/style/index.js  // import '../index.css'
 * ```
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import type { Plugin } from 'rollup'
import * as fs from 'fs'
import * as path from 'path'
import fse from 'fs-extra'

export interface VueStyleEntryOptions {
  /**
   * 是否启用插件
   * @default true
   */
  enabled?: boolean

  /**
   * 输出目录列表
   * @default ['cjs', 'esm', 'es']
   */
  outputDirs?: string[]

  /**
   * CSS 文件匹配模式
   * @default '**\/index.css'
   */
  cssPattern?: string

  /**
   * 是否生成 TypeScript 声明文件
   * @default true
   */
  generateDts?: boolean

  /**
   * 是否在控制台输出日志
   * @default false
   */
  verbose?: boolean
}

/**
 * 创建 Vue 样式入口生成器插件
 */
export function vueStyleEntryGenerator(options: VueStyleEntryOptions = {}): Plugin {
  const {
    enabled = true,
    outputDirs = ['cjs', 'esm', 'es'],
    cssPattern = 'index.css',
    generateDts = true,
    verbose = false,
  } = options

  return {
    name: 'vue-style-entry-generator',

    /**
     * 在所有文件写入完成后执行
     */
    async writeBundle(outputOptions, bundle) {
      if (!enabled) {
        return
      }

      const outputDir = outputOptions.dir
      if (!outputDir) {
        return
      }

      try {
        await generateStyleEntries(outputDir, {
          outputDirs,
          cssPattern,
          generateDts,
          verbose,
        })
      }
      catch (error) {
        console.error('❌ 生成样式入口文件失败:', error)
      }
    },
  }
}

/**
 * 生成样式入口文件
 */
async function generateStyleEntries(
  baseDir: string,
  options: Required<Omit<VueStyleEntryOptions, 'enabled'>>,
): Promise<void> {
  const { outputDirs, cssPattern, generateDts, verbose } = options

  // 获取项目根目录
  const projectRoot = process.cwd()

  // 遍历所有输出目录
  for (const outputDir of outputDirs) {
    const fullOutputDir = path.join(projectRoot, outputDir)

    // 检查目录是否存在
    if (!fs.existsSync(fullOutputDir)) {
      // 如果是 esm 目录，尝试从 es 目录镜像
      if (path.basename(outputDir) === 'esm') {
        const esDir = path.join(path.dirname(fullOutputDir), 'es')
        if (fs.existsSync(esDir)) {
          if (verbose) {
            console.log(`📋 从 es 目录镜像到 ${outputDir}`)
          }
          // 使用 fs-extra 的 copySync
          fse.copySync(esDir, fullOutputDir, { overwrite: true })
        } else {
          if (verbose) {
            console.log(`⏭️  跳过不存在的目录: ${outputDir}`)
          }
          continue
        }
      } else {
        if (verbose) {
          console.log(`⏭️  跳过不存在的目录: ${outputDir}`)
        }
        continue
      }
    }

    // 查找所有 CSS 文件
    const cssFiles = findCssFiles(fullOutputDir, cssPattern)

    if (verbose) {
      console.log(`\n📁 处理目录: ${outputDir}`)
      console.log(`   找到 ${cssFiles.length} 个 CSS 文件`)
    }

    // 为每个 CSS 文件生成 style 入口
    for (const cssFile of cssFiles) {
      await generateStyleEntry(cssFile, outputDir, generateDts, verbose)
    }
  }
}

/**
 * 查找所有 CSS 文件
 */
function findCssFiles(dir: string, pattern: string): string[] {
  const cssFiles: string[] = []

  function walk(currentDir: string) {
    const files = fs.readdirSync(currentDir)

    for (const file of files) {
      const filePath = path.join(currentDir, file)
      const stat = fs.statSync(filePath)

      if (stat.isDirectory()) {
        // 递归遍历所有目录，包括 style 目录
        walk(filePath)
      }
      else if (file === pattern) {
        cssFiles.push(filePath)
      }
    }
  }

  walk(dir)
  return cssFiles
}

/**
 * 为单个 CSS 文件生成 style 入口
 */
async function generateStyleEntry(
  cssFilePath: string,
  outputDir: string,
  generateDts: boolean,
  verbose: boolean,
): Promise<void> {
  const cssDir = path.dirname(cssFilePath)
  const cssFileName = path.basename(cssFilePath)

  // 检查 CSS 文件是否已经在 style 目录下
  const isInStyleDir = path.basename(cssDir) === 'style'

  let styleDir: string
  let importPath: string

  if (isInStyleDir) {
    // CSS 文件已经在 style 目录下（如 es/language-switcher/style/index.css）
    // 在同一个 style 目录下生成入口文件
    styleDir = cssDir
    importPath = `./${cssFileName}`
  }
  else {
    // CSS 文件不在 style 目录下（如 cjs/language-switcher/index.css）
    // 创建 style 子目录并生成入口文件
    styleDir = path.join(cssDir, 'style')
    if (!fs.existsSync(styleDir)) {
      fs.mkdirSync(styleDir, { recursive: true })
    }
    importPath = `../${cssFileName}`
  }

  // 确定模块格式和文件扩展名
  const isESM = outputDir === 'esm' || outputDir === 'es'
  const ext = outputDir === 'es' ? '.mjs' : '.js'

  // 生成导入语句
  const importStatement = isESM
    ? `import '${importPath}';\n`
    : `require('${importPath}');\n`

  // 生成 index.js/index.mjs
  const indexPath = path.join(styleDir, `index${ext}`)
  const content = generateFileContent(importStatement, outputDir)

  fs.writeFileSync(indexPath, content, 'utf-8')

  if (verbose) {
    const relativePath = path.relative(process.cwd(), indexPath)
    console.log(`   ✅ 生成: ${relativePath}`)
  }

  // 生成 css.js/css.mjs（兼容性）
  const cssJsPath = path.join(styleDir, `css${ext}`)
  fs.writeFileSync(cssJsPath, content, 'utf-8')

  // 生成 TypeScript 声明文件
  if (generateDts) {
    const dtsContent = generateDtsContent()
    const dtsPath = path.join(styleDir, 'index.d.ts')
    fs.writeFileSync(dtsPath, dtsContent, 'utf-8')

    const cssDtsPath = path.join(styleDir, 'css.d.ts')
    fs.writeFileSync(cssDtsPath, dtsContent, 'utf-8')
  }
}

/**
 * 生成文件内容（带注释）
 */
function generateFileContent(importStatement: string, outputDir: string): string {
  return `/**
 * 样式入口文件
 *
 * 此文件由 @ldesign/builder 自动生成
 * 用于按需导入组件样式
 *
 * @example
 * \`\`\`typescript
 * // 导入组件
 * import { LanguageSwitcher } from '@ldesign/i18n-vue/language-switcher';
 * // 导入样式
 * import '@ldesign/i18n-vue/language-switcher/style';
 * \`\`\`
 */

${importStatement}
`
}

/**
 * 生成 TypeScript 声明文件内容
 */
function generateDtsContent(): string {
  return `/**
 * 样式入口文件类型声明
 *
 * 此文件由 @ldesign/builder 自动生成
 */

export {};
`
}

/**
 * 默认导出
 */
export default vueStyleEntryGenerator

