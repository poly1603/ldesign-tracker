/**
 * 文件系统操作工具模块
 * 
 * 提供跨平台的文件系统操作封装，包括：
 * - 文件/目录的增删改查
 * - Glob 模式匹配
 * - 临时文件/目录管理
 * - 文件类型检测
 * 
 * @module utils/file-system/FileSystem
 * @author LDesign Team
 * @version 1.0.0
 */

import path from 'path'
import os from 'os'
import fs from 'fs-extra'
import fastGlob from 'fast-glob'
import type { FileInfo } from '../../types/common'

/** 支持的文件扩展名到类型的映射表 */
const FILE_TYPE_MAP: Readonly<Record<string, string>> = {
  // JavaScript/TypeScript
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.ts': 'typescript',
  '.mts': 'typescript',
  '.cts': 'typescript',
  '.jsx': 'jsx',
  '.tsx': 'tsx',
  '.d.ts': 'declaration',

  // 框架文件
  '.vue': 'vue',
  '.svelte': 'svelte',
  '.astro': 'astro',

  // 样式
  '.css': 'css',
  '.less': 'less',
  '.scss': 'scss',
  '.sass': 'sass',
  '.styl': 'stylus',
  '.stylus': 'stylus',
  '.pcss': 'postcss',

  // 数据格式
  '.json': 'json',
  '.json5': 'json5',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',

  // 文档
  '.md': 'markdown',
  '.mdx': 'mdx',
  '.html': 'html',
  '.htm': 'html',
  '.xml': 'xml',

  // 图片
  '.svg': 'svg',
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.gif': 'image',
  '.webp': 'image',
  '.ico': 'image',
  '.bmp': 'image',
  '.avif': 'image',

  // 字体
  '.woff': 'font',
  '.woff2': 'font',
  '.ttf': 'font',
  '.otf': 'font',
  '.eot': 'font',

  // 其他
  '.txt': 'text',
  '.log': 'log',
  '.map': 'sourcemap',
} as const

/**
 * 文件系统工具类
 */
export class FileSystem {
  /**
   * 检查文件或目录是否存在
   */
  static async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * 同步检查文件或目录是否存在
   */
  static existsSync(filePath: string): boolean {
    try {
      fs.accessSync(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * 读取文件内容
   */
  static async readFile(filePath: string, encoding: BufferEncoding = 'utf8'): Promise<string> {
    return fs.readFile(filePath, encoding)
  }

  /**
   * 写入文件内容
   */
  static async writeFile(filePath: string, content: string, encoding: BufferEncoding = 'utf8'): Promise<void> {
    // 确保目录存在
    await this.ensureDir(path.dirname(filePath))
    return fs.writeFile(filePath, content, encoding)
  }

  /**
   * 复制文件
   */
  static async copyFile(src: string, dest: string): Promise<void> {
    // 确保目标目录存在
    await this.ensureDir(path.dirname(dest))
    return fs.copyFile(src, dest)
  }

  /**
   * 删除文件
   */
  static async removeFile(filePath: string): Promise<void> {
    if (await this.exists(filePath)) {
      return fs.unlink(filePath)
    }
  }

  /**
   * 创建目录
   */
  static async ensureDir(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true })
    } catch (error) {
      // 忽略目录已存在的错误
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error
      }
    }
  }

  /**
   * 删除目录
   */
  static async removeDir(dirPath: string): Promise<void> {
    if (await this.exists(dirPath)) {
      return fs.rmdir(dirPath, { recursive: true })
    }
  }

  /**
   * 清空目录
   */
  static async emptyDir(dirPath: string): Promise<void> {
    if (await this.exists(dirPath)) {
      const files = await fs.readdir(dirPath)
      await Promise.all(
        files.map(async (file) => {
          const filePath = path.join(dirPath, file)
          const stat = await fs.stat(filePath)
          if (stat.isDirectory()) {
            await this.removeDir(filePath)
          } else {
            await this.removeFile(filePath)
          }
        })
      )
    }
  }

  /**
   * 获取文件统计信息
   */
  static async stat(filePath: string): Promise<FileInfo> {
    const stats = await fs.stat(filePath)
    const ext = path.extname(filePath)

    return {
      path: filePath,
      size: stats.size,
      type: stats.isDirectory() ? 'directory' : this.getFileType(ext)
    }
  }

  /**
   * 读取目录内容
   */
  static async readDir(dirPath: string): Promise<string[]> {
    return fs.readdir(dirPath)
  }

  /**
   * 递归读取目录内容
   */
  static async readDirRecursive(dirPath: string): Promise<string[]> {
    const files: string[] = []

    const traverse = async (currentPath: string) => {
      const items = await fs.readdir(currentPath)

      for (const item of items) {
        const itemPath = path.join(currentPath, item)
        const stat = await fs.stat(itemPath)

        if (stat.isDirectory()) {
          await traverse(itemPath)
        } else {
          files.push(itemPath)
        }
      }
    }

    await traverse(dirPath)
    return files
  }

  /**
   * 使用 glob 模式查找文件
   */
  static async glob(pattern: string | string[], options: {
    cwd?: string
    ignore?: string[]
    absolute?: boolean
    onlyFiles?: boolean
    onlyDirectories?: boolean
  } = {}): Promise<string[]> {
    return fastGlob(pattern, {
      cwd: options.cwd || process.cwd(),
      ignore: options.ignore || [],
      absolute: options.absolute ?? true,
      onlyFiles: options.onlyFiles ?? true,
      onlyDirectories: options.onlyDirectories ?? false
    })
  }

  /**
   * 查找文件
   */
  static async findFiles(
    patterns: string[],
    options: {
      cwd?: string
      ignore?: string[]
      maxDepth?: number
    } = {}
  ): Promise<string[]> {
    return this.glob(patterns, {
      cwd: options.cwd,
      ignore: options.ignore,
      onlyFiles: true
    })
  }

  /**
   * 查找目录
   */
  static async findDirs(
    patterns: string[],
    options: {
      cwd?: string
      ignore?: string[]
      maxDepth?: number
    } = {}
  ): Promise<string[]> {
    return this.glob(patterns, {
      cwd: options.cwd,
      ignore: options.ignore,
      onlyDirectories: true
    })
  }

  /**
   * 获取文件大小
   */
  static async getFileSize(filePath: string): Promise<number> {
    const stats = await fs.stat(filePath)
    return stats.size
  }

  /**
   * 获取目录大小
   */
  static async getDirSize(dirPath: string): Promise<number> {
    let totalSize = 0

    const traverse = async (currentPath: string) => {
      const items = await fs.readdir(currentPath)

      for (const item of items) {
        const itemPath = path.join(currentPath, item)
        const stat = await fs.stat(itemPath)

        if (stat.isDirectory()) {
          await traverse(itemPath)
        } else {
          totalSize += stat.size
        }
      }
    }

    await traverse(dirPath)
    return totalSize
  }

  /**
   * 检查路径是否为文件
   */
  static async isFile(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath)
      return stats.isFile()
    } catch {
      return false
    }
  }

  /**
   * 检查路径是否为目录
   */
  static async isDirectory(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(dirPath)
      return stats.isDirectory()
    } catch {
      return false
    }
  }

  /**
   * 获取文件的修改时间
   */
  static async getModifiedTime(filePath: string): Promise<Date> {
    const stats = await fs.stat(filePath)
    return stats.mtime
  }

  /**
   * 比较文件修改时间
   */
  static async isNewer(file1: string, file2: string): Promise<boolean> {
    if (!(await this.exists(file1))) return false
    if (!(await this.exists(file2))) return true

    const time1 = await this.getModifiedTime(file1)
    const time2 = await this.getModifiedTime(file2)

    return time1 > time2
  }

  /**
   * 创建临时文件
   */
  static async createTempFile(prefix: string = 'temp', suffix: string = '.tmp'): Promise<string> {
    const tempDir = os.tmpdir()
    const fileName = `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}${suffix}`
    return path.join(tempDir, fileName)
  }

  /**
   * 创建临时目录
   */
  static async createTempDir(prefix: string = 'temp'): Promise<string> {
    const tempDir = os.tmpdir()
    const dirName = `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const tempDirPath = path.join(tempDir, dirName)
    await this.ensureDir(tempDirPath)
    return tempDirPath
  }

  /**
   * 获取文件类型
   * 
   * @param extension - 文件扩展名（包含点号）
   * @returns 文件类型字符串
   */
  private static getFileType(extension: string): string {
    const ext = extension.toLowerCase()
    return FILE_TYPE_MAP[ext] || 'unknown'
  }

  /**
   * 判断是否为源代码文件
   * 
   * @param filePath - 文件路径
   * @returns 是否为源代码文件
   */
  static isSourceFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase()
    const sourceTypes = ['javascript', 'typescript', 'jsx', 'tsx', 'vue', 'svelte', 'astro']
    const type = FILE_TYPE_MAP[ext]
    return sourceTypes.includes(type || '')
  }

  /**
   * 判断是否为样式文件
   * 
   * @param filePath - 文件路径
   * @returns 是否为样式文件
   */
  static isStyleFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase()
    const styleTypes = ['css', 'less', 'scss', 'sass', 'stylus', 'postcss']
    const type = FILE_TYPE_MAP[ext]
    return styleTypes.includes(type || '')
  }

  /**
   * 判断是否为资源文件（图片、字体等）
   * 
   * @param filePath - 文件路径
   * @returns 是否为资源文件
   */
  static isAssetFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase()
    const assetTypes = ['image', 'svg', 'font']
    const type = FILE_TYPE_MAP[ext]
    return assetTypes.includes(type || '')
  }
}

// 导出便捷函数
export const {
  exists,
  existsSync,
  readFile,
  writeFile,
  copyFile,
  removeFile,
  ensureDir,
  removeDir,
  emptyDir,
  stat,
  readDir,
  readDirRecursive,
  findDirs,
  getFileSize,
  getDirSize,
  isFile,
  isDirectory,
  getModifiedTime,
  isNewer,
  createTempFile,
  createTempDir,
  isSourceFile,
  isStyleFile,
  isAssetFile
} = FileSystem

// 单独导出 findFiles 以保持正确的 this 上下文
export const findFiles = FileSystem.findFiles.bind(FileSystem)

// 导出文件类型映射表供外部使用
export { FILE_TYPE_MAP }
