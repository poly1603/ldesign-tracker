/**
 * Rollup 格式映射工具
 * 
 * 提供格式名称映射和多入口检测功能
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

/**
 * Rollup 格式映射器
 * 负责格式名称转换和多入口构建检测
 */
export class RollupFormatMapper {
  /**
   * 映射格式名称
   * 将统一的格式名称转换为 Rollup 特定的格式名称
   * 
   * @param format - 格式名称（可能是字符串或其他类型）
   * @returns Rollup 格式名称
   * @example
   * ```typescript
   * const mapper = new RollupFormatMapper()
   * mapper.mapFormat('esm') // 返回 'es'
   * mapper.mapFormat('cjs') // 返回 'cjs'
   * ```
   */
  mapFormat(format: any): 'es' | 'cjs' | 'umd' | 'iife' | 'amd' | 'system' {
    if (typeof format === 'string') {
      const formatMap: Record<string, 'es' | 'cjs' | 'umd' | 'iife' | 'amd' | 'system'> = {
        esm: 'es',
        cjs: 'cjs',
        umd: 'umd',
        iife: 'iife',
        amd: 'amd',
        system: 'system'
      }
      return formatMap[format] || 'es'
    }
    return 'es'
  }

  /**
   * 检查是否为多入口构建
   * 根据 input 的类型和内容判断是否为多入口构建
   * 
   * @param input - 输入配置（可以是字符串、数组或对象）
   * @returns 是否为多入口构建
   * @example
   * ```typescript
   * const mapper = new RollupFormatMapper()
   * mapper.isMultiEntryBuild(['a.ts', 'b.ts']) // 返回 true
   * mapper.isMultiEntryBuild({ a: 'a.ts', b: 'b.ts' }) // 返回 true
   * mapper.isMultiEntryBuild('src/*.ts') // 返回 true (glob 模式)
   * mapper.isMultiEntryBuild('src/index.ts') // 返回 false
   * ```
   */
  isMultiEntryBuild(input: any): boolean {
    // 如果 input 是数组，则为多入口
    if (Array.isArray(input)) {
      return input.length > 1
    }

    // 如果 input 是对象，则为多入口
    if (typeof input === 'object' && input !== null) {
      return Object.keys(input).length > 1
    }

    // 如果 input 是字符串且包含 glob 模式，可能为多入口
    if (typeof input === 'string') {
      // 检查是否包含 glob 通配符
      return input.includes('*') || input.includes('?') || input.includes('[')
    }

    return false
  }

  /**
   * 获取入口数量
   * 计算输入配置中的入口数量
   * 
   * @param input - 输入配置
   * @returns 入口数量
   */
  getEntryCount(input: any): number {
    if (Array.isArray(input)) {
      return input.length
    }

    if (typeof input === 'object' && input !== null) {
      return Object.keys(input).length
    }

    return 1
  }

  /**
   * 规范化格式数组
   * 确保格式是数组形式
   * 
   * @param format - 格式配置（可以是字符串或数组）
   * @returns 格式数组
   */
  normalizeFormats(format: string | string[]): string[] {
    return Array.isArray(format) ? format : [format]
  }

  /**
   * 检查格式是否支持
   * 验证给定的格式是否被 Rollup 支持
   * 
   * @param format - 格式名称
   * @returns 是否支持
   */
  isSupportedFormat(format: string): boolean {
    const supportedFormats = ['es', 'esm', 'cjs', 'umd', 'iife', 'amd', 'system']
    return supportedFormats.includes(format)
  }

  /**
   * 获取默认输出目录
   * 根据格式返回默认的输出目录名称
   * 
   * @param format - 格式名称
   * @returns 默认输出目录
   */
  getDefaultOutputDir(format: string): string {
    const dirMap: Record<string, string> = {
      es: 'es',
      esm: 'esm',
      cjs: 'lib',
      umd: 'dist',
      iife: 'dist'
    }
    return dirMap[format] || 'dist'
  }

  /**
   * 获取默认文件扩展名
   * 根据格式返回默认的文件扩展名
   * 
   * @param format - 格式名称
   * @returns 文件扩展名（包含点号）
   */
  getDefaultExtension(format: string): string {
    const extMap: Record<string, string> = {
      es: '.js',
      esm: '.js',
      cjs: '.cjs',
      umd: '.js',
      iife: '.js'
    }
    return extMap[format] || '.js'
  }
}

