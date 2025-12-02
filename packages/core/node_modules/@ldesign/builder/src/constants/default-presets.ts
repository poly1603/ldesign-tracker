/**
 * 预设构建配置常量
 *
 * 将不同库类型的默认预设配置从 defaults.ts 中拆分出来，
 * 提升单文件可读性，同时保持对外 PRESET_CONFIGS 导出不变。
 *
 * @module constants/default-presets
 */

import { LibraryType } from '../types/library'

/**
 * 预设配置
 */
export const PRESET_CONFIGS = {
  // TypeScript 库预设
  typescript: {
    libraryType: LibraryType.TYPESCRIPT,
    typescript: {
      declaration: true,
      isolatedDeclarations: true
    },
    output: {
      format: ['esm', 'cjs']
    },
    library: {
      generateTypes: true,
      formats: ['esm', 'cjs']
    }
  },

  // Vue3 组件库预设
  vue3: {
    libraryType: LibraryType.VUE3,
    vue: {
      version: 3,
      onDemand: true
    },
    external: ['vue'],
    globals: {
      vue: 'Vue'
    },
    library: {
      formats: ['esm', 'cjs', 'umd']
    }
  },

  // Vue2 组件库预设
  vue2: {
    libraryType: LibraryType.VUE2,
    vue: {
      version: 2,
      onDemand: true
    },
    external: ['vue'],
    globals: {
      vue: 'Vue'
    },
    library: {
      formats: ['esm', 'cjs', 'umd']
    }
  },

  // 样式库预设
  style: {
    libraryType: LibraryType.STYLE,
    style: {
      extract: true,
      minimize: true
    },
    output: {
      format: ['esm']
    },
    library: {
      formats: ['esm']
    }
  },

  // 混合库预设
  mixed: {
    libraryType: LibraryType.MIXED,
    typescript: {
      declaration: true
    },
    style: {
      extract: true
    },
    output: {
      format: ['esm', 'cjs']
    },
    library: {
      formats: ['esm', 'cjs']
    }
  }
} as const

