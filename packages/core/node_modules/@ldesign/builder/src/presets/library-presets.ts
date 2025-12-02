/**
 * 库类型预设配置
 *
 * 提供 Node.js、Web、通用库的预设配置
 * 简化配置工作，只需指定预设名称即可获得合理的默认配置
 *
 * @author LDesign Team
 * @version 1.0.0
 */

import type { BuilderConfig } from '../types/config'
import { LibraryType } from '../types/library'

/**
 * 预设名称类型
 */
export type PresetName =
  | 'node-library' // Node.js 库
  | 'web-library' // 浏览器库
  | 'universal-library' // 通用库（Node + Browser）
  | 'vue-library' // Vue 组件库
  | 'react-library' // React 组件库
  | 'cli-tool' // CLI 工具
  | 'monorepo-package' // Monorepo 包

/**
 * Node.js 库预设
 *
 * 适用于纯 Node.js 环境的库
 * - 输出 ESM 和 CJS 格式
 * - 不输出 UMD（Node.js 不需要）
 * - 生成类型声明文件
 *
 * @param options - 自定义选项
 * @returns 完整配置
 */
export function nodeLibrary(options: Partial<BuilderConfig> = {}): BuilderConfig {
  return {
    libraryType: LibraryType.TYPESCRIPT,
    platform: 'node',

    output: {
      format: ['esm', 'cjs'],
      esm: {
        dir: 'es',
        format: 'esm',
        preserveStructure: true,
        dts: true,
      },
      cjs: {
        dir: 'lib',
        format: 'cjs',
        preserveStructure: true,
        dts: true,
      },
      ...options.output,
    },

    // Node.js 库通常不需要压缩
    minify: false,
    dts: true,
    sourcemap: true,
    clean: true,

    // 排除测试和示例文件
    exclude: [
      '**/examples/**',
      '**/__tests__/**',
      '**/*.test.*',
      '**/*.spec.*',
      '**/test/**',
      '**/tests/**',
      ...(options.exclude || []),
    ],

    typescript: {
      declaration: true,
      target: 'ES2020',
      module: 'ESNext',
      ...options.typescript,
    },

    ...options,
  }
}

/**
 * Web 库预设
 *
 * 适用于浏览器环境的库
 * - 输出 ESM 和 UMD 格式
 * - UMD 格式压缩
 * - 生成类型声明文件
 *
 * @param options - 自定义选项
 * @returns 完整配置
 */
export function webLibrary(options: Partial<BuilderConfig> = {}): BuilderConfig {
  return {
    libraryType: LibraryType.TYPESCRIPT,
    platform: 'browser',

    output: {
      format: ['esm', 'umd'],
      esm: {
        dir: 'es',
        format: 'esm',
        preserveStructure: true,
        dts: true,
      },
      umd: {
        dir: 'dist',
        format: 'umd',
        minify: true,
        sourcemap: true,
        name: options.name || 'Library',
      },
      ...options.output,
    },

    dts: true,
    sourcemap: true,
    clean: true,

    exclude: [
      '**/examples/**',
      '**/__tests__/**',
      '**/*.test.*',
      '**/*.spec.*',
      ...(options.exclude || []),
    ],

    typescript: {
      declaration: true,
      target: 'ES2020',
      module: 'ESNext',
      ...options.typescript,
    },

    ...options,
  }
}

/**
 * 通用库预设
 *
 * 适用于同时支持 Node.js 和浏览器的库
 * - 输出 ESM、CJS 和 UMD 三种格式
 * - UMD 格式压缩
 * - 生成类型声明文件
 *
 * @param options - 自定义选项
 * @returns 完整配置
 */
export function universalLibrary(options: Partial<BuilderConfig> = {}): BuilderConfig {
  return {
    libraryType: LibraryType.TYPESCRIPT,
    platform: 'neutral',

    output: {
      format: ['esm', 'cjs', 'umd'],
      esm: {
        dir: 'es',
        format: 'esm',
        preserveStructure: true,
        dts: true,
      },
      cjs: {
        dir: 'lib',
        format: 'cjs',
        preserveStructure: true,
        dts: true,
      },
      umd: {
        dir: 'dist',
        format: 'umd',
        minify: true,
        sourcemap: true,
        name: options.name || 'Library',
      },
      ...options.output,
    },

    dts: true,
    sourcemap: true,
    clean: true,

    exclude: [
      '**/examples/**',
      '**/__tests__/**',
      '**/*.test.*',
      '**/*.spec.*',
      ...(options.exclude || []),
    ],

    typescript: {
      declaration: true,
      target: 'ES2020',
      module: 'ESNext',
      ...options.typescript,
    },

    ...options,
  }
}

/**
 * CLI 工具预设
 *
 * 适用于命令行工具
 * - 只输出 CJS 格式（Node.js 执行）
 * - 压缩代码
 * - 不生成类型声明（CLI 工具通常不需要）
 *
 * @param options - 自定义选项
 * @returns 完整配置
 */
export function cliTool(options: Partial<BuilderConfig> = {}): BuilderConfig {
  return {
    libraryType: LibraryType.TYPESCRIPT,
    platform: 'node',

    output: {
      format: ['cjs'],
      cjs: {
        dir: 'bin',
        format: 'cjs',
        preserveStructure: false,
      },
      ...options.output,
    },

    // CLI 工具通常需要压缩
    minify: true,
    // CLI 工具通常不需要类型声明
    dts: options.dts ?? false,
    sourcemap: false,
    clean: true,

    exclude: [
      '**/examples/**',
      '**/__tests__/**',
      '**/*.test.*',
      '**/*.spec.*',
      ...(options.exclude || []),
    ],

    typescript: {
      declaration: false,
      target: 'ES2020',
      module: 'CommonJS',
      ...options.typescript,
    },

    ...options,
  }
}

/**
 * 预设配置映射表
 */
export const LIBRARY_PRESETS: Record<PresetName, (options?: Partial<BuilderConfig>) => BuilderConfig> = {
  'node-library': nodeLibrary,
  'web-library': webLibrary,
  'universal-library': universalLibrary,
  'vue-library': (options) => {
    // 导入 vueLibrary 预设
    const { vueLibrary } = require('../config/presets')
    return vueLibrary(options)
  },
  'react-library': (options) => {
    // 导入 reactLibrary 预设
    const { reactLibrary } = require('../config/presets')
    return reactLibrary(options)
  },
  'cli-tool': cliTool,
  'monorepo-package': (options) => {
    // 导入 monorepoPackage 预设
    const { monorepoPackage } = require('../config/presets')
    return monorepoPackage(options)
  },
}

/**
 * 根据预设名称获取配置
 *
 * @param preset - 预设名称
 * @param options - 自定义选项
 * @returns 完整配置
 */
export function getPresetConfig(preset: PresetName, options?: Partial<BuilderConfig>): BuilderConfig {
  const presetFn = LIBRARY_PRESETS[preset]
  if (!presetFn) {
    throw new Error(`未知的预设名称: ${preset}`)
  }
  return presetFn(options)
}

/**
 * 检查是否为有效的预设名称
 *
 * @param name - 名称
 * @returns 是否为有效预设
 */
export function isValidPreset(name: string): name is PresetName {
  return name in LIBRARY_PRESETS
}
