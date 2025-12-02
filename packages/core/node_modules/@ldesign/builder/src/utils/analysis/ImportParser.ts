/**
 * 导入解析工具
 *
 * 统一的导入语句解析逻辑，用于分析文件中的导入依赖
 *
 * @author LDesign Team
 * @version 1.0.0
 */

import fs from 'fs-extra'
import path from 'path'

/**
 * 导入信息接口
 */
export interface ImportInfo {
  /** 导入源路径 */
  source: string
  /** 导入类型 */
  type: 'es6' | 'commonjs' | 'dynamic'
  /** 导入说明符（变量名） */
  specifiers: string[]
  /** 是否为本地导入（相对路径） */
  isLocal: boolean
  /** 原始导入语句 */
  raw: string
  /** 在文件中的行号 */
  line?: number
}

/**
 * 解析选项
 */
export interface ParseOptions {
  /** 是否包含行号信息 */
  includeLineNumbers?: boolean
  /** 是否解析注释中的导入 */
  includeComments?: boolean
}

/**
 * 解析文件中的所有导入语句
 *
 * @param filePath - 文件路径
 * @param options - 解析选项
 * @returns 导入信息数组
 *
 * @example
 * ```typescript
 * const imports = await parseImports('./src/index.ts')
 * console.log(imports)
 * // [
 * //   { source: 'react', type: 'es6', specifiers: ['React'], isLocal: false, ... },
 * //   { source: './utils', type: 'es6', specifiers: ['helper'], isLocal: true, ... }
 * // ]
 * ```
 */
export async function parseImports(
  filePath: string,
  options: ParseOptions = {}
): Promise<ImportInfo[]> {
  const content = await fs.readFile(filePath, 'utf-8')
  return parseImportsFromContent(content, options)
}

/**
 * 从文件内容中解析导入语句
 *
 * @param content - 文件内容
 * @param options - 解析选项
 * @returns 导入信息数组
 */
export function parseImportsFromContent(
  content: string,
  options: ParseOptions = {}
): ImportInfo[] {
  const imports: ImportInfo[] = []
  const lines = content.split('\n')

  // ES6 import 正则表达式
  // 匹配: import ... from '...'
  const es6ImportRegex = /import\s+(?:(?:(\*\s+as\s+\w+)|(\{[^}]*\})|(\w+))\s+from\s+)?['"]([^'"]+)['"]/g

  // CommonJS require 正则表达式
  // 匹配: require('...')
  const requireRegex = /(?:const|let|var)?\s*(?:(\{[^}]*\})|(\w+))?\s*=?\s*require\s*\(['"]([^'"]+)['"]\)/g

  // 动态 import 正则表达式
  // 匹配: import('...')
  const dynamicImportRegex = /import\s*\(['"]([^'"]+)['"]\)/g

  let match: RegExpExecArray | null

  // 解析 ES6 import
  while ((match = es6ImportRegex.exec(content)) !== null) {
    const source = match[4]
    const specifiers = extractES6Specifiers(match[0])
    const lineNumber = options.includeLineNumbers ? getLineNumber(content, match.index) : undefined

    imports.push({
      source,
      type: 'es6',
      specifiers,
      isLocal: isLocalImport(source),
      raw: match[0],
      line: lineNumber
    })
  }

  // 解析 CommonJS require
  while ((match = requireRegex.exec(content)) !== null) {
    const source = match[3]
    const specifiers = extractRequireSpecifiers(match[0])
    const lineNumber = options.includeLineNumbers ? getLineNumber(content, match.index) : undefined

    imports.push({
      source,
      type: 'commonjs',
      specifiers,
      isLocal: isLocalImport(source),
      raw: match[0],
      line: lineNumber
    })
  }

  // 解析动态 import
  while ((match = dynamicImportRegex.exec(content)) !== null) {
    const source = match[1]
    const lineNumber = options.includeLineNumbers ? getLineNumber(content, match.index) : undefined

    imports.push({
      source,
      type: 'dynamic',
      specifiers: [],
      isLocal: isLocalImport(source),
      raw: match[0],
      line: lineNumber
    })
  }

  return imports
}

/**
 * 提取 ES6 导入说明符
 *
 * @param importStatement - 导入语句
 * @returns 说明符数组
 */
function extractES6Specifiers(importStatement: string): string[] {
  const specifiers: string[] = []

  // 匹配默认导入: import React from 'react'
  const defaultMatch = importStatement.match(/import\s+(\w+)\s+from/)
  if (defaultMatch) {
    specifiers.push(defaultMatch[1])
  }

  // 匹配命名导入: import { useState, useEffect } from 'react'
  const namedMatch = importStatement.match(/import\s+\{([^}]+)\}/)
  if (namedMatch) {
    const named = namedMatch[1]
      .split(',')
      .map(s => s.trim())
      .map(s => s.split(/\s+as\s+/)[0].trim()) // 处理 as 别名
      .filter(Boolean)
    specifiers.push(...named)
  }

  // 匹配命名空间导入: import * as React from 'react'
  const namespaceMatch = importStatement.match(/import\s+\*\s+as\s+(\w+)/)
  if (namespaceMatch) {
    specifiers.push(namespaceMatch[1])
  }

  return specifiers
}

/**
 * 提取 CommonJS require 说明符
 *
 * @param requireStatement - require 语句
 * @returns 说明符数组
 */
function extractRequireSpecifiers(requireStatement: string): string[] {
  const specifiers: string[] = []

  // 匹配默认导入: const React = require('react')
  const defaultMatch = requireStatement.match(/(?:const|let|var)\s+(\w+)\s*=\s*require/)
  if (defaultMatch) {
    specifiers.push(defaultMatch[1])
  }

  // 匹配解构导入: const { useState, useEffect } = require('react')
  const destructureMatch = requireStatement.match(/\{([^}]+)\}/)
  if (destructureMatch) {
    const named = destructureMatch[1]
      .split(',')
      .map(s => s.trim())
      .map(s => s.split(/\s*:\s*/)[0].trim()) // 处理重命名
      .filter(Boolean)
    specifiers.push(...named)
  }

  return specifiers
}

/**
 * 判断是否为本地导入（相对路径）
 *
 * @param source - 导入源路径
 * @returns 是否为本地导入
 */
function isLocalImport(source: string): boolean {
  return source.startsWith('.') || source.startsWith('/')
}

/**
 * 获取字符在内容中的行号
 *
 * @param content - 文件内容
 * @param index - 字符索引
 * @returns 行号（从 1 开始）
 */
function getLineNumber(content: string, index: number): number {
  return content.substring(0, index).split('\n').length
}

/**
 * 过滤导入信息
 *
 * @param imports - 导入信息数组
 * @param filter - 过滤函数
 * @returns 过滤后的导入信息数组
 */
export function filterImports(
  imports: ImportInfo[],
  filter: (info: ImportInfo) => boolean
): ImportInfo[] {
  return imports.filter(filter)
}

/**
 * 获取所有外部依赖（非本地导入）
 *
 * @param imports - 导入信息数组
 * @returns 外部依赖数组
 */
export function getExternalDependencies(imports: ImportInfo[]): string[] {
  return Array.from(
    new Set(
      imports
        .filter(imp => !imp.isLocal)
        .map(imp => {
          // 处理作用域包: @scope/package/sub -> @scope/package
          const match = imp.source.match(/^(@[^/]+\/[^/]+)/)
          if (match) {
            return match[1]
          }
          // 处理普通包: package/sub -> package
          return imp.source.split('/')[0]
        })
    )
  )
}

/**
 * 获取所有本地导入
 *
 * @param imports - 导入信息数组
 * @returns 本地导入数组
 */
export function getLocalImports(imports: ImportInfo[]): ImportInfo[] {
  return imports.filter(imp => imp.isLocal)
}

/**
 * 按类型分组导入
 *
 * @param imports - 导入信息数组
 * @returns 按类型分组的导入信息
 */
export function groupImportsByType(imports: ImportInfo[]): Record<string, ImportInfo[]> {
  return imports.reduce((acc, imp) => {
    if (!acc[imp.type]) {
      acc[imp.type] = []
    }
    acc[imp.type].push(imp)
    return acc
  }, {} as Record<string, ImportInfo[]>)
}

/**
 * 解析目录下所有文件的导入
 *
 * @param dir - 目录路径
 * @param options - 解析选项
 * @returns 文件路径到导入信息的映射
 */
export async function parseImportsInDirectory(
  dir: string,
  options: ParseOptions = {}
): Promise<Map<string, ImportInfo[]>> {
  const result = new Map<string, ImportInfo[]>()
  const files = await fs.readdir(dir, { withFileTypes: true })

  for (const file of files) {
    const fullPath = path.join(dir, file.name)

    if (file.isDirectory()) {
      // 递归处理子目录
      const subResult = await parseImportsInDirectory(fullPath, options)
      for (const [filePath, imports] of subResult) {
        result.set(filePath, imports)
      }
    } else if (file.isFile() && /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(file.name)) {
      // 解析 TypeScript 和 JavaScript 文件
      const imports = await parseImports(fullPath, options)
      result.set(fullPath, imports)
    }
  }

  return result
}


