/**
 * 简化配置接口
 * 
 * 提供更简洁的配置方式,只需要配置核心选项
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import type { BuilderConfig } from '../types/config'
import type { PresetName } from '../presets'
import { applyPreset } from '../presets'

/**
 * 简化配置接口
 * 
 * 只包含最常用的配置项,其他配置使用智能默认值
 */
export interface SimpleConfig {
  /**
   * 使用预设配置
   * 
   * @example
   * preset: 'react' // 使用 React 预设
   * preset: 'vue3'  // 使用 Vue 3 预设
   */
  preset?: PresetName

  /**
   * 入口文件
   * 
   * @default 'src/index.ts' (自动检测)
   * @example
   * input: 'src/index.ts'
   * input: ['src/index.ts', 'src/utils.ts']
   * input: { main: 'src/index.ts', utils: 'src/utils.ts' }
   */
  input?: string | string[] | Record<string, string>

  /**
   * 输出目录
   * 
   * @default 'dist'
   */
  outDir?: string

  /**
   * 输出格式
   * 
   * @default ['esm', 'cjs'] (根据项目类型自动推断)
   * @example
   * formats: ['esm', 'cjs', 'umd']
   */
  formats?: Array<'esm' | 'cjs' | 'umd' | 'iife'>

  /**
   * 外部依赖
   * 
   * @default [] (自动检测 package.json 的 dependencies 和 peerDependencies)
   * @example
   * external: ['react', 'react-dom']
   */
  external?: string[]

  /**
   * 是否生成类型声明文件
   * 
   * @default true
   */
  dts?: boolean

  /**
   * 是否生成 sourcemap
   * 
   * @default true
   */
  sourcemap?: boolean

  /**
   * 是否压缩代码
   * 
   * @default true (生产模式)
   */
  minify?: boolean

  /**
   * 构建模式
   * 
   * @default 'production'
   */
  mode?: 'development' | 'production'

  /**
   * 是否清理输出目录
   * 
   * @default true
   */
  clean?: boolean

  /**
   * 全局变量映射 (用于 UMD 格式)
   * 
   * @default {} (自动推断常见库的全局变量)
   * @example
   * globals: { react: 'React', 'react-dom': 'ReactDOM' }
   */
  globals?: Record<string, string>

  /**
   * UMD 模块名称
   * 
   * @default package.json 的 name 字段 (转换为驼峰命名)
   * @example
   * name: 'MyLibrary'
   */
  name?: string
}

/**
 * 将简化配置转换为完整配置
 */
export function expandSimpleConfig(simpleConfig: SimpleConfig): BuilderConfig {
  // 如果指定了预设,先应用预设
  let config: BuilderConfig = simpleConfig.preset
    ? applyPreset(simpleConfig.preset)
    : {}

  // 应用用户配置
  if (simpleConfig.input !== undefined) {
    config.input = simpleConfig.input
  }

  if (simpleConfig.outDir !== undefined) {
    config.output = {
      ...config.output,
      dir: simpleConfig.outDir
    }
  }

  if (simpleConfig.formats !== undefined) {
    config.output = {
      ...config.output,
      format: simpleConfig.formats
    }
  }

  if (simpleConfig.external !== undefined) {
    config.external = simpleConfig.external
  }

  if (simpleConfig.dts !== undefined) {
    config.dts = simpleConfig.dts
    config.typescript = {
      ...config.typescript,
      declaration: simpleConfig.dts
    }
  }

  if (simpleConfig.sourcemap !== undefined) {
    config.sourcemap = simpleConfig.sourcemap
    config.output = {
      ...config.output,
      sourcemap: simpleConfig.sourcemap
    }
  }

  if (simpleConfig.minify !== undefined) {
    config.minify = simpleConfig.minify
    config.performance = {
      ...config.performance,
      minify: simpleConfig.minify
    }
  }

  if (simpleConfig.mode !== undefined) {
    config.mode = simpleConfig.mode
  }

  if (simpleConfig.clean !== undefined) {
    config.clean = simpleConfig.clean
  }

  if (simpleConfig.globals !== undefined) {
    config.globals = simpleConfig.globals
  }

  if (simpleConfig.name !== undefined) {
    config.umd = {
      ...config.umd,
      name: simpleConfig.name
    }
  }

  return config
}

/**
 * 创建简化配置构建器
 */
export function defineConfig(config: SimpleConfig): BuilderConfig {
  return expandSimpleConfig(config)
}

/**
 * 配置示例
 */
export const configExamples = {
  /**
   * 最小配置 - React 组件库
   */
  minimalReact: {
    preset: 'react'
  } as SimpleConfig,

  /**
   * 基础配置 - TypeScript 库
   */
  basicTypescript: {
    preset: 'typescript',
    input: 'src/index.ts',
    outDir: 'dist',
    formats: ['esm', 'cjs']
  } as SimpleConfig,

  /**
   * 完整配置 - Vue 3 组件库
   */
  fullVue3: {
    preset: 'vue3',
    input: 'src/index.ts',
    outDir: 'dist',
    formats: ['esm', 'cjs', 'umd'],
    external: ['vue'],
    globals: { vue: 'Vue' },
    name: 'MyVueLibrary',
    dts: true,
    sourcemap: true,
    minify: true,
    clean: true
  } as SimpleConfig,

  /**
   * CLI 工具配置
   */
  cli: {
    preset: 'cli',
    input: 'src/cli.ts',
    outDir: 'bin',
    formats: ['cjs'],
    dts: false,
    sourcemap: false,
    minify: true
  } as SimpleConfig,

  /**
   * 样式库配置
   */
  style: {
    preset: 'style',
    input: 'src/index.less',
    outDir: 'dist',
    formats: ['esm']
  } as SimpleConfig
}

