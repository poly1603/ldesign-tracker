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
    const { outDir: _outDir, composite: _composite, incremental: _incremental, noEmit: _noEmit, tsconfigOverride: _ignored, ...cleanedCO } = compilerOpts as any

    const basePlugin = typescript.default({
      ...otherOpts,
      // 完全禁用 tsconfig 读取，只使用 compilerOptions
      tsconfig: false,
      compilerOptions: {
        ...cleanedCO,
        declaration: emitDts,
        declarationMap: false,
        declarationDir: emitDts ? outputDir : undefined,
        outDir: undefined,
        // 禁用 composite 和 incremental，因为 Rollup 不需要这些
        composite: false,
        incremental: false,
        rootDir: cleanedCO?.rootDir ?? 'src',
        skipLibCheck: true,
        isolatedModules: !emitDts,
        // 禁用诊断输出
        noEmit: false,
        // 抑制所有错误（只在构建失败时才会报错）
        noUnusedLocals: false,
        noUnusedParameters: false
      },
      // 自定义过滤诊断
      filterDiagnostics: (diagnostic: any) => {
        const code = diagnostic.code
        const file = diagnostic.file?.fileName || ''

        // 过滤 .vue 文件相关的诊断
        if (file.endsWith('.vue') || file.includes('.vue')) {
          return false
        }

        // 过滤特定的诊断代码
        const suppressedCodes = [
          2688,  // TS2688: Cannot find type definition file
          2307,  // TS2307: Cannot find module
          5096,  // TS5096: Option conflicts
          6133   // TS6133: Unused variable
        ]

        if (suppressedCodes.includes(code)) {
          return false
        }

        // 保留其他诊断
        return true
      }
    })

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

