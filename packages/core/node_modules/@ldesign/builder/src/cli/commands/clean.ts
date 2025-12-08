/**
 * 清理命令实现
 * 
 * 提供智能清理构建产物和缓存功能
 */

import { Command } from 'commander'
import { resolve, join } from 'path'
import { existsSync, rmSync, readdirSync, statSync } from 'fs'
import { logger } from '../../utils/logger'

// ========== 类型定义 ==========

interface CleanOptions {
  dirs?: string
  cache?: boolean
  all?: boolean
  dryRun?: boolean
  force?: boolean
}

interface CleanResult {
  path: string
  size: number
  deleted: boolean
  error?: string
}

// ========== 工具函数 ==========

function getDirectorySize(dirPath: string): number {
  let totalSize = 0
  
  const scanDir = (path: string) => {
    try {
      const items = readdirSync(path)
      for (const item of items) {
        const itemPath = join(path, item)
        const stat = statSync(itemPath)
        if (stat.isDirectory()) {
          scanDir(itemPath)
        } else {
          totalSize += stat.size
        }
      }
    } catch {}
  }
  
  if (existsSync(dirPath)) {
    scanDir(dirPath)
  }
  
  return totalSize
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(2) + ' MB'
}

// ========== 清理执行 ==========

async function runClean(projectPath: string, options: CleanOptions): Promise<void> {
  console.log('')
  console.log('🧹 LDesign Builder 清理工具')
  console.log('─'.repeat(40))

  // 确定要清理的目录
  const defaultDirs = ['dist', 'es', 'lib', 'esm', 'cjs', 'umd', 'types', 'coverage']
  const cacheDirs = ['.ldesign/cache', 'node_modules/.cache', '.turbo', '.rollup.cache']
  const allDirs = [...defaultDirs, '.ldesign', 'node_modules/.vite']

  let dirsToClean: string[] = []

  if (options.all) {
    dirsToClean = [...allDirs, ...cacheDirs]
  } else if (options.dirs) {
    dirsToClean = options.dirs.split(',').map(d => d.trim())
  } else {
    dirsToClean = [...defaultDirs]
    if (options.cache) {
      dirsToClean.push(...cacheDirs)
    }
  }

  // 检查并收集要清理的目录
  const results: CleanResult[] = []
  let totalSize = 0

  for (const dir of dirsToClean) {
    const fullPath = resolve(projectPath, dir)
    if (existsSync(fullPath)) {
      const size = getDirectorySize(fullPath)
      totalSize += size
      results.push({ path: dir, size, deleted: false })
    }
  }

  if (results.length === 0) {
    console.log('\n✨ 没有需要清理的目录')
    return
  }

  // 显示要清理的内容
  console.log('\n📁 将要清理的目录:')
  for (const result of results) {
    console.log(`   ${result.path}/ (${formatSize(result.size)})`)
  }
  console.log(`\n   总计: ${formatSize(totalSize)}`)

  // Dry run 模式
  if (options.dryRun) {
    console.log('\n🔍 Dry Run 模式 - 不会实际删除')
    return
  }

  // 确认删除
  if (!options.force) {
    const readline = await import('readline')
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    const confirmed = await new Promise<boolean>((resolve) => {
      rl.question('\n确认删除? [y/N]: ', (answer) => {
        rl.close()
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes')
      })
    })

    if (!confirmed) {
      console.log('已取消')
      return
    }
  }

  // 执行删除
  console.log('\n🗑️  正在清理...\n')

  for (const result of results) {
    const fullPath = resolve(projectPath, result.path)
    try {
      rmSync(fullPath, { recursive: true, force: true })
      result.deleted = true
      logger.success(`   ✅ ${result.path}/`)
    } catch (error) {
      result.error = String(error)
      logger.error(`   ❌ ${result.path}/ - ${error}`)
    }
  }

  // 统计结果
  const deletedCount = results.filter(r => r.deleted).length
  const deletedSize = results.filter(r => r.deleted).reduce((sum, r) => sum + r.size, 0)

  console.log('')
  console.log('─'.repeat(40))
  console.log(`✨ 清理完成: ${deletedCount}/${results.length} 目录，释放 ${formatSize(deletedSize)}`)
  console.log('')
}

// ========== 命令定义 ==========

export const cleanCommand = new Command('clean')
  .description('清理构建产物和缓存')
  .option('-d, --dirs <dirs>', '指定要清理的目录 (逗号分隔)')
  .option('-c, --cache', '同时清理缓存目录')
  .option('-a, --all', '清理所有产物和缓存')
  .option('--dry-run', '仅显示将要删除的内容，不实际删除')
  .option('-f, --force', '跳过确认直接删除')
  .action(async (options: CleanOptions) => {
    try {
      await runClean(process.cwd(), options)
    } catch (error) {
      logger.error('清理失败:', error)
      process.exit(1)
    }
  })
