/**
 * Rollup 样式文件处理器
 * 
 * 负责样式文件的重组和清理
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import path from 'path'
import fs from 'fs'
import { promises as fsPromises } from 'fs'
import type { Logger } from '../../utils/logger'

/**
 * Rollup 样式文件处理器
 */
export class RollupStyleHandler {
  constructor(private logger: Logger) { }

  /**
   * 创建样式文件重组插件 (TDesign 风格)
   * 
   * 将组件目录下的 CSS 文件移动到 style/ 子目录，并生成 style/css.mjs 文件
   * 
   * @param outputDir - 输出目录
   * @returns Rollup 插件
   */
  createStyleReorganizePlugin(outputDir: string): any {
    const logger = this.logger

    return {
      name: 'style-reorganize',
      async writeBundle() {
        logger.debug('[style-reorganize] 插件开始执行...')
        const outputPath = path.resolve(process.cwd(), outputDir)
        logger.debug('[style-reorganize] 输出路径:', outputPath)

        // 遍历输出目录，找到所有 CSS 文件
        const processDirectory = async (dir: string) => {
          const entries = await fsPromises.readdir(dir, { withFileTypes: true })

          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name)

            if (entry.isDirectory()) {
              // 跳过已经是 style 目录的
              if (entry.name !== 'style') {
                await processDirectory(fullPath)
              }
            }
            else if (entry.isFile() && entry.name.endsWith('.css')) {
              logger.debug('[style-reorganize] 找到 CSS 文件:', fullPath)
              // 找到 CSS 文件，检查是否在 style/ 目录中
              const parentDir = path.dirname(fullPath)
              const parentDirName = path.basename(parentDir)

              if (parentDirName !== 'style') {
                // CSS 文件不在 style/ 目录中，需要重组
                const styleDir = path.join(parentDir, 'style')
                const newCssPath = path.join(styleDir, 'index.css')
                const cssMapPath = `${fullPath}.map`
                const newCssMapPath = `${newCssPath}.map`
                const cssMjsPath = path.join(styleDir, 'css.mjs')

                logger.debug('[style-reorganize] 开始重组:', fullPath)

                // 创建 style/ 目录
                await fsPromises.mkdir(styleDir, { recursive: true })

                // 移动 CSS 文件
                await fsPromises.rename(fullPath, newCssPath)

                // 移动 CSS map 文件(如果存在)
                if (fs.existsSync(cssMapPath)) {
                  await fsPromises.rename(cssMapPath, newCssMapPath)
                }

                // 生成 style/css.mjs 文件
                const cssMjsContent = `import './index.css';\n`
                await fsPromises.writeFile(cssMjsPath, cssMjsContent, 'utf-8')

                logger.debug(`[style-reorganize] ✓ 重组完成: ${path.relative(outputPath, fullPath)} -> ${path.relative(outputPath, newCssPath)}`)
              }
            }
          }
        }

        try {
          await processDirectory(outputPath)
          logger.debug('[style-reorganize] 插件执行完成')
        }
        catch (error) {
          logger.error('[style-reorganize] 错误:', error)
        }
      }
    }
  }

  /**
   * 创建 ESM 样式清理插件 (TDesign 风格)
   * 
   * 删除 ESM 产物中的 style/ 目录和 CSS 文件
   * 根据 TDesign Vue Next 的实际结构，ESM 产物不应该包含样式文件
   * 
   * @param outputDir - 输出目录
   * @returns Rollup 插件
   */
  createEsmStyleCleanupPlugin(outputDir: string): any {
    const logger = this.logger

    return {
      name: 'esm-style-cleanup',
      async writeBundle() {
        logger.debug('[esm-style-cleanup] 插件开始执行...')
        const outputPath = path.resolve(process.cwd(), outputDir)
        logger.debug('[esm-style-cleanup] 输出路径:', outputPath)

        // 遍历输出目录，删除所有 style/ 目录和 CSS 文件
        const processDirectory = async (dir: string) => {
          const entries = await fsPromises.readdir(dir, { withFileTypes: true })

          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name)

            if (entry.isDirectory()) {
              // 删除 style 目录
              if (entry.name === 'style') {
                logger.debug('[esm-style-cleanup] 删除 style 目录:', fullPath)
                await fsPromises.rm(fullPath, { recursive: true, force: true })
              }
              else {
                // 递归处理子目录
                await processDirectory(fullPath)
              }
            }
            else if (entry.isFile() && entry.name.endsWith('.css')) {
              // 删除 CSS 文件
              logger.debug('[esm-style-cleanup] 删除 CSS 文件:', fullPath)
              await fsPromises.unlink(fullPath)

              // 删除对应的 source map 文件
              const cssMapPath = `${fullPath}.map`
              if (fs.existsSync(cssMapPath)) {
                logger.debug('[esm-style-cleanup] 删除 CSS map 文件:', cssMapPath)
                await fsPromises.unlink(cssMapPath)
              }
            }
          }
        }

        try {
          await processDirectory(outputPath)
          logger.debug('[esm-style-cleanup] 插件执行完成')
        }
        catch (error) {
          logger.error('[esm-style-cleanup] 错误:', error)
        }
      }
    }
  }
}

