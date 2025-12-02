/**
 * 构建命令入口模块
 * 
 * 【功能描述】
 * 提供构建命令的 CLI 接口，负责解析命令行参数并调用构建执行器
 * 
 * 【主要特性】
 * - 命令行参数解析：使用 commander 解析用户输入
 * - 选项验证：验证用户提供的选项是否合法
 * - 错误处理：捕获并友好地显示错误信息
 * - 帮助信息：提供详细的使用帮助
 * 
 * 【使用示例】
 * ```bash
 * # 基础构建
 * ldesign-builder build
 * 
 * # 指定选项
 * ldesign-builder build -i src/index.ts -o dist -f esm,cjs
 * 
 * # 启用分析
 * ldesign-builder build --analyze --report
 * 
 * # 监听模式
 * ldesign-builder build --watch
 * ```
 * 
 * @module cli/commands/build
 * @author LDesign Team
 * @version 1.0.0
 * @since 2024-01-01
 */

import { Command } from 'commander'
import { logger } from '../../../utils/logger'
import { executeBuild, type BuildOptions } from './executor'

/**
 * 创建构建命令
 * 
 * 【详细说明】
 * 使用 commander 创建构建命令，定义所有可用的选项和参数
 * 
 * @returns Commander 命令对象
 */
export const buildCommand = new Command('build')
  .description('构建库文件')
  .option('-i, --input <path>', '指定入口文件')
  .option('-o, --output <dir>', '指定输出目录')
  .option('-f, --format <formats>', '指定输出格式 (esm,cjs,umd,iife,dts)')
  .option('--minify', '启用代码压缩')
  .option('--no-minify', '禁用代码压缩')
  .option('--sourcemap', '生成 sourcemap')
  .option('--no-sourcemap', '不生成 sourcemap')
  .option('--clean', '构建前清理输出目录')
  .option('--no-clean', '构建前不清理输出目录')
  .option('--analyze', '分析打包结果')
  .option('--report [file]', '输出构建报告 JSON 文件（默认 dist/build-report.json）')
  .option('--size-limit <limit>', '设置总包体或单产物大小上限，如 200k、1mb、或字节数')
  .option('-w, --watch', '监听文件变化')
  .action(async (options: BuildOptions, command: Command) => {
    try {
      await executeBuild(options, command.parent?.opts())
    } catch (error) {
      logger.error('构建失败:', error)
      process.exit(1)
    }
  })

/**
 * 默认导出构建命令
 */
export default buildCommand

