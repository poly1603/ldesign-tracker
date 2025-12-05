/**
 * Rollup 插件管理器
 * 负责插件的加载、转换和配置
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import type { BundlerSpecificPlugin } from '../../types/adapter'
import type { Logger } from '../../utils/logger'
import { wrapTypeScriptPlugin } from '../../utils/misc/TypeScriptSilentPlugin'

/**
 * Rollup 插件管理器
 */
export class RollupPluginManager {
  private logger: Logger

  constructor(logger: Logger) {
    this.logger = logger
  }

  /**
   * 转换插件为 Rollup 格式
   */
  async transformPlugins(plugins: any[]): Promise<BundlerSpecificPlugin[]> {
    const transformedPlugins: BundlerSpecificPlugin[] = []

    for (const plugin of plugins) {
      try {
        if (plugin.plugin && typeof plugin.plugin === 'function') {
          const actualPlugin = await plugin.plugin()
          transformedPlugins.push(actualPlugin)
        } else if (plugin.rollup) {
          transformedPlugins.push({ ...plugin, ...plugin.rollup })
        } else {
          transformedPlugins.push(plugin)
        }
      } catch (error) {
        this.logger.warn(`插件 ${plugin.name || 'unknown'} 加载失败:`, (error as Error).message)
      }
    }

    return transformedPlugins
  }

  /**
   * 为特定格式转换插件
   */
  async transformPluginsForFormat(
    plugins: any[],
    outputDir: string,
    options?: { emitDts?: boolean }
  ): Promise<BundlerSpecificPlugin[]> {
    const { emitDts = true } = options || {}
    const transformedPlugins: BundlerSpecificPlugin[] = []

    for (const plugin of plugins) {
      try {
        const pluginName: string = (plugin && (plugin.name || plugin?.rollup?.name)) || ''
        const nameLc = String(pluginName).toLowerCase()

        // 过滤不需要的插件
        if (!emitDts && nameLc.includes('dts') && !nameLc.includes('typescript')) {
          continue
        }

        if (plugin.plugin && typeof plugin.plugin === 'function') {
          // TypeScript 插件特殊处理
          if (nameLc === 'typescript') {
            const tsPlugin = await this.createTypeScriptPlugin(plugin, outputDir, emitDts)
            transformedPlugins.push(tsPlugin)
          } else {
            const actualPlugin = await plugin.plugin()
            transformedPlugins.push(actualPlugin)
          }
        } else if (plugin.rollup) {
          const rnameLc = String(plugin.rollup.name || '').toLowerCase()
          if (!emitDts && rnameLc.includes('dts') && !rnameLc.includes('typescript')) {
            continue
          }
          transformedPlugins.push({ ...plugin, ...plugin.rollup })
        } else {
          const inameLc = String((plugin as any)?.name || '').toLowerCase()
          if (!emitDts && inameLc.includes('dts') && !inameLc.includes('typescript')) {
            continue
          }
          transformedPlugins.push(plugin)
        }
      } catch (error) {
        this.logger.warn(`插件 ${plugin.name || 'unknown'} 加载失败:`, (error as Error).message)
      }
    }

    return transformedPlugins
  }

  /**
   * 创建 TypeScript 插件（静默模式）
   */
  private async createTypeScriptPlugin(plugin: any, outputDir: string, emitDts: boolean): Promise<any> {
    const typescript = await import('@rollup/plugin-typescript')
    const originalOptions = (plugin as any).options || {}

    // 检查 originalOptions 的格式
    // 如果有 compilerOptions 字段,说明是嵌套格式: { compilerOptions: {...}, ...rest }
    // 如果没有,说明是扁平格式: { target: 'ES2020', module: 'ESNext', ... }
    let compilerOpts: any
    let otherOpts: any

    if ('compilerOptions' in originalOptions) {
      // 嵌套格式
      const { compilerOptions, ...rest } = originalOptions
      compilerOpts = compilerOptions || {}
      otherOpts = rest
    }
    else {
      // 扁平格式 - 所有选项都是 compiler options
      compilerOpts = originalOptions
      otherOpts = {}
    }

    // 清理不支持的字段
    const { outDir: _outDir, composite: _composite, incremental: _incremental, noEmit: _noEmit, tsconfigOverride: _ignored, tsconfig: _tsconfig, ...cleanedCO } = compilerOpts as any

    // 提取 tsconfig 路径
    const tsconfigPath = (originalOptions as any).tsconfig

    // 如果提供了 tsconfig，尽量使用 tsconfig 的配置，只覆盖必要的选项
    const finalTsOptions: any = {
      ...otherOpts,
      tsconfig: tsconfigPath || false,
      // 仅在需要时覆盖声明相关选项
      declaration: emitDts,
      declarationMap: false,
      declarationDir: emitDts ? outputDir : undefined,
      noEmit: false // 必须为 false 才能生成输出
    }

    const basePlugin = typescript.default(finalTsOptions)

    // 包装插件以过滤 TypeScript 警告
    const wrappedPlugin = wrapTypeScriptPlugin(basePlugin)

    // 添加进度包装（只在生成 DTS 时）
    if (emitDts) {
      return this.wrapPluginWithProgress(wrappedPlugin, 'TypeScript 类型定义')
    }

    return wrappedPlugin
  }

  /**
   * 包装插件以添加进度日志（静默模式）
   */
  private wrapPluginWithProgress(plugin: any, taskName: string): any {
    let fileCount = 0
    let startTime = 0

    return {
      ...plugin,
      name: plugin.name,

      buildStart(...args: any[]) {
        startTime = Date.now()
        fileCount = 0
        // 静默开始，不输出日志

        if (plugin.buildStart) {
          return plugin.buildStart.apply(this, args)
        }
      },

      transform(...args: any[]) {
        fileCount++
        // 不再输出进度日志

        if (plugin.transform) {
          return plugin.transform.apply(this, args)
        }
      },

      buildEnd(...args: any[]) {
        // 静默完成，不输出日志

        if (plugin.buildEnd) {
          return plugin.buildEnd.apply(this, args)
        }
      }
    }
  }
}

