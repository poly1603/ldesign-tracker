/**
 * Vue 3 配置构建器
 * 
 * 负责构建 Vue 3 项目的输出配置和外部依赖配置
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import type { BuilderConfig } from '../../types/config'

/**
 * Vue 3 配置构建器类
 */
export class Vue3ConfigBuilder {
  /**
   * 构建输出配置
   * 
   * @param config 构建配置
   * @returns 输出配置对象
   */
  buildOutputConfig(config: BuilderConfig): any {
    const outputConfig = config.output || {}

    // 如果使用格式特定配置（output.es, output.esm, output.cjs, output.umd）
    if (this.hasFormatSpecificConfig(outputConfig)) {
      return this.buildFormatSpecificConfig(outputConfig)
    }

    // 使用传统的 format 数组配置
    return this.buildTraditionalConfig(outputConfig)
  }

  /**
   * 检查是否有格式特定配置
   */
  private hasFormatSpecificConfig(outputConfig: any): boolean {
    return !!(
      outputConfig.es ||
      outputConfig.esm ||
      outputConfig.cjs ||
      outputConfig.umd ||
      outputConfig.iife
    )
  }

  /**
   * 构建格式特定配置
   */
  private buildFormatSpecificConfig(outputConfig: any): any {
    const result: any = {
      ...outputConfig
    }

    // 为每个格式配置添加 Vue 全局变量
    const formats = ['es', 'esm', 'cjs', 'umd', 'iife']

    for (const format of formats) {
      if (result[format] && typeof result[format] === 'object') {
        result[format] = {
          ...result[format],
          assetFileNames: '[name].[ext]',
          globals: {
            vue: 'Vue',
            ...result[format].globals
          }
        }
      }
    }

    // 确保顶层全局变量包含 Vue
    result.globals = {
      vue: 'Vue',
      ...result.globals
    }

    return result
  }

  /**
   * 构建传统配置
   */
  private buildTraditionalConfig(outputConfig: any): any {
    const formats = Array.isArray(outputConfig.format)
      ? outputConfig.format
      : [outputConfig.format || 'esm']

    return {
      dir: outputConfig.dir || 'dist',
      format: formats,
      sourcemap: outputConfig.sourcemap !== false,
      exports: 'named',
      globals: {
        vue: 'Vue',
        ...outputConfig.globals
      }
    }
  }

  /**
   * 构建外部依赖配置
   * 
   * @param config 构建配置
   * @returns 外部依赖配置
   */
  buildExternals(config: BuilderConfig): string[] | ((id: string) => boolean) {
    let externals: string[] = []

    // 处理数组形式的 external
    if (Array.isArray(config.external)) {
      // 过滤出字符串类型的外部依赖，使用类型断言确保返回 string[]
      externals = (config.external as (string | RegExp)[])
        .filter((e): e is string => typeof e === 'string') as string[]
    }
    // 处理函数形式的 external
    else if (typeof config.external === 'function') {
      return config.external
    }

    // 确保 'vue' 始终在外部依赖中
    if (!externals.includes('vue')) {
      externals.push('vue')
    }

    // 添加常见的 Vue 生态系统包为外部依赖
    const vueEcosystemPackages = [
      'vue-router',
      'pinia',
      'vuex',
      '@vue/composition-api'
    ]

    for (const pkg of vueEcosystemPackages) {
      if (!externals.includes(pkg)) {
        externals.push(pkg)
      }
    }

    return externals
  }

  /**
   * 获取 TypeScript 选项
   * 
   * @param config 构建配置
   * @returns TypeScript 编译选项
   */
  getTypeScriptOptions(config: BuilderConfig): any {
    const tsConfig = config.typescript || {}
    const compilerOptions = tsConfig.compilerOptions || {}

    return {
      // 基础选项
      target: compilerOptions.target || 'ES2020',
      module: compilerOptions.module || 'ESNext',
      lib: compilerOptions.lib || ['ES2020', 'DOM', 'DOM.Iterable'],

      // 严格检查
      strict: compilerOptions.strict !== false,
      noImplicitAny: compilerOptions.noImplicitAny !== false,
      strictNullChecks: compilerOptions.strictNullChecks !== false,
      strictFunctionTypes: compilerOptions.strictFunctionTypes !== false,

      // 模块解析
      moduleResolution: compilerOptions.moduleResolution || 'node',
      esModuleInterop: compilerOptions.esModuleInterop !== false,
      allowSyntheticDefaultImports: compilerOptions.allowSyntheticDefaultImports !== false,
      resolveJsonModule: compilerOptions.resolveJsonModule !== false,

      // 类型声明
      declaration: tsConfig.declaration !== false,
      declarationMap: tsConfig.declarationMap !== false,
      emitDeclarationOnly: false,

      // 其他选项
      skipLibCheck: compilerOptions.skipLibCheck !== false,
      forceConsistentCasingInFileNames: compilerOptions.forceConsistentCasingInFileNames !== false,

      // Vue 特定选项
      jsx: compilerOptions.jsx || 'preserve',
      jsxImportSource: compilerOptions.jsxImportSource || 'vue',
      types: compilerOptions.types || []
    }
  }
}

/**
 * 创建 Vue 3 配置构建器
 */
export function createVue3ConfigBuilder(): Vue3ConfigBuilder {
  return new Vue3ConfigBuilder()
}
