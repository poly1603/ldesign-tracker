/**
 * TypeScript 静默插件包装器
 * 过滤不必要的 TypeScript 警告
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import type { Plugin } from 'rollup'

/**
 * 包装 TypeScript 插件，完全过滤警告
 */
export function wrapTypeScriptPlugin(originalPlugin: Plugin): Plugin {
  // 保存原始的输出方法
  const originalWarn = console.warn
  const originalError = console.error
  const originalLog = console.log
  const originalInfo = console.info
  const originalStdoutWrite = process.stdout.write
  const originalStderrWrite = process.stderr.write

  let isBuilding = false

  // 创建警告过滤器
  const shouldSuppressMessage = (message: string): boolean => {
    if (!isBuilding) return false

    const suppressPatterns = [
      'TS2688',  // 类型定义文件不存在
      'TS2307',  // 找不到模块（.vue 文件）
      'TS5096',  // 选项冲突
      'TS6133',  // 未使用的变量
      'Cannot find type definition',
      'Cannot find module',
      '.vue',    // 所有 .vue 相关的警告
      'Entry point of type library',
      '@rollup/plugin-typescript',
      'TypeScript 编译警告'
    ]

    return suppressPatterns.some(pattern => message.includes(pattern))
  }

  // 创建过滤的输出函数
  const createFilteredOutput = (originalFn: Function) => {
    return (...args: any[]) => {
      const message = args.join(' ')
      if (!shouldSuppressMessage(message)) {
        return originalFn.apply(console, args)
      }
    }
  }

  return {
    ...originalPlugin,

    buildStart(...args) {
      isBuilding = true

      // 拦截所有可能的输出方法
      console.warn = createFilteredOutput(originalWarn)
      console.error = createFilteredOutput(originalError)
      console.log = createFilteredOutput(originalLog)
      console.info = createFilteredOutput(originalInfo)

      // 拦截 stderr 输出
      process.stderr.write = function (...writeArgs: any[]) {
        const message = String(writeArgs[0] || '')
        if (!shouldSuppressMessage(message)) {
          return originalStderrWrite.apply(process.stderr, writeArgs as any)
        }
        return true
      } as any

      if (originalPlugin.buildStart) {
        if (typeof originalPlugin.buildStart === 'function') {
          return originalPlugin.buildStart.apply(this, args)
        } else if (typeof originalPlugin.buildStart === 'object' && 'handler' in originalPlugin.buildStart) {
          return originalPlugin.buildStart.handler.apply(this, args)
        }
      }
    },

    buildEnd(...args) {
      // 恢复所有原始方法
      console.warn = originalWarn
      console.error = originalError
      console.log = originalLog
      console.info = originalInfo
      process.stdout.write = originalStdoutWrite
      process.stderr.write = originalStderrWrite

      isBuilding = false

      if (originalPlugin.buildEnd) {
        if (typeof originalPlugin.buildEnd === 'function') {
          return originalPlugin.buildEnd.apply(this, args)
        } else if (typeof originalPlugin.buildEnd === 'object' && 'handler' in originalPlugin.buildEnd) {
          return originalPlugin.buildEnd.handler.apply(this, args)
        }
      }
    }
  }
}

