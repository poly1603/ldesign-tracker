/**
 * Rollup DTS 文件处理器
 * 
 * 负责 TypeScript 声明文件的复制和处理
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import type { BuilderConfig } from '../../types/config'
import type { Logger } from '../../utils/logger'

/**
 * Rollup DTS 文件处理器
 */
export class RollupDtsHandler {
  constructor(private logger: Logger) { }

  /**
   * 复制 DTS 文件到所有格式的输出目录
   * 
   * 确保 ESM 和 CJS 格式都有完整的类型定义文件
   * 
   * @param config - 构建配置
   */
  async copyDtsFiles(config: BuilderConfig): Promise<void> {
    const fs = await import('fs-extra')
    const path = await import('path')

    // 获取输出配置
    const outputConfig = config.output || {}
    const esmDir = (typeof outputConfig.esm === 'object' ? outputConfig.esm.dir : 'es') || 'es'
    const cjsDir = (typeof outputConfig.cjs === 'object' ? outputConfig.cjs.dir : 'lib') || 'lib'

    // 如果两个目录相同，不需要复制
    if (esmDir === cjsDir) {
      return
    }

    // 如果没有启用 CJS 输出，不需要复制
    if (!outputConfig.cjs) {
      return
    }

    // 确定源目录和目标目录
    // ESM 目录有 .d.ts 文件，需要复制到 CJS 目录并重命名为 .d.cts
    const sourceDir = path.resolve(process.cwd(), esmDir)
    const targetDir = path.resolve(process.cwd(), cjsDir)

    // 检查源目录是否存在
    if (!await fs.pathExists(sourceDir)) {
      return
    }

    try {
      // 递归查找所有 .d.ts 文件
      const dtsFiles = await this.findDtsFiles(sourceDir)

      if (dtsFiles.length === 0) {
        return
      }

      this.logger.debug(`复制 ${dtsFiles.length} 个 DTS 文件从 ${esmDir} 到 ${cjsDir} (重命名为 .d.cts)...`)

      // 复制每个 DTS 文件并重命名
      for (const dtsFile of dtsFiles) {
        const relativePath = path.relative(sourceDir, dtsFile)
        // 将 .d.ts 替换为 .d.cts
        const targetRelativePath = relativePath.replace(/\.d\.ts$/, '.d.cts')
        const targetPath = path.join(targetDir, targetRelativePath)

        // 确保目标目录存在
        await fs.ensureDir(path.dirname(targetPath))

        // 复制文件
        await fs.copy(dtsFile, targetPath, { overwrite: true })
      }

      this.logger.debug(`DTS 文件复制完成 (${dtsFiles.length} 个文件)`)
    }
    catch (error) {
      this.logger.warn(`复制 DTS 文件失败:`, (error as Error).message)
    }
  }

  /**
   * 递归查找目录中的所有 .d.ts 文件
   * 
   * @param dir - 目录路径
   * @returns .d.ts 文件路径数组
   */
  async findDtsFiles(dir: string): Promise<string[]> {
    const fs = await import('fs-extra')
    const path = await import('path')
    const files: string[] = []

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)

        if (entry.isDirectory()) {
          // 递归查找子目录
          const subFiles = await this.findDtsFiles(fullPath)
          files.push(...subFiles)
        }
        else if (entry.isFile() && entry.name.endsWith('.d.ts')) {
          // 添加 .d.ts 文件
          files.push(fullPath)
        }
      }
    }
    catch (error) {
      // 忽略错误
    }

    return files
  }
}

