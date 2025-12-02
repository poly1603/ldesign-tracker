/**
 * 库类型配置与元数据常量
 *
 * 将库类型的描述、推荐配置、优先级、兼容性、插件依赖等从 `library-types.ts` 中拆分出来，
 * 降低单文件复杂度，同时保持对外导出的常量名称与结构完全不变。
 *
 * @module constants/library-configs
 */

import { LibraryType } from '../types/library'


/**
 * 库类型描述
 */
export const LIBRARY_TYPE_DESCRIPTIONS = {
  [LibraryType.TYPESCRIPT]: 'TypeScript 库 - 使用 TypeScript 编写的库，支持类型声明和现代 JavaScript 特性',
  [LibraryType.STYLE]: '样式库 - 包含 CSS、Less、Sass 等样式文件的库',
  [LibraryType.VUE2]: 'Vue2 组件库 - 基于 Vue 2.x 的组件库',
  [LibraryType.VUE3]: 'Vue3 组件库 - 基于 Vue 3.x 的组件库，支持 Composition API',
  [LibraryType.REACT]: 'React 组件库 - 基于 React 18+ 的组件库，支持 JSX/TSX 与 Hooks',
  [LibraryType.SVELTE]: 'Svelte 组件库 - 使用 Svelte 的库，零虚拟DOM，编译时优化',
  [LibraryType.SOLID]: 'Solid 组件库 - 使用 SolidJS 的库，细粒度响应式，JSX 支持',
  [LibraryType.PREACT]: 'Preact 组件库 - 小而快的 React 兼容库',
  [LibraryType.LIT]: 'Lit/Web Components 组件库 - 标准 Web Components，面向浏览器原生',
  [LibraryType.ANGULAR]: 'Angular 组件库（基础支持）- 建议使用 ng-packagr，但提供最小打包能力',
  [LibraryType.MIXED]: '混合库 - 包含多种类型文件的复合库'
} as const

/**
 * 库类型优先级
 *
 * 优化说明：
 * - Mixed 提高到 7，作为通用后备（比 TypeScript 更稳定）
 * - TypeScript 降低到 5（配置复杂，容易出错）
 * - 框架特定的保持高优先级（10-9）
 */
export const LIBRARY_TYPE_PRIORITY = {
  [LibraryType.ENHANCED_MIXED]: 11,  // 🆕 最高优先级！智能混合框架
  [LibraryType.VUE2]: 10,
  [LibraryType.VUE3]: 10,
  [LibraryType.REACT]: 10,
  [LibraryType.SVELTE]: 9,
  [LibraryType.SOLID]: 9,
  [LibraryType.PREACT]: 9,
  [LibraryType.LIT]: 8,
  [LibraryType.STYLE]: 8,
  [LibraryType.ANGULAR]: 7,
  [LibraryType.MIXED]: 7,        // ↑ 提高！作为通用后备
  [LibraryType.TYPESCRIPT]: 5,   // ↓ 降低！配置复杂度高
  [LibraryType.QWIK]: 9
} as const

/**
 * 库类型推荐配置
 */
export const LIBRARY_TYPE_RECOMMENDED_CONFIG = {
  [LibraryType.TYPESCRIPT]: {
    output: {
      format: ['esm', 'cjs'],
      sourcemap: true
    },
    typescript: {
      declaration: true,
      isolatedDeclarations: true
    },
    external: [],
    bundleless: false
  },

  [LibraryType.STYLE]: {
    output: {
      format: ['esm'],
      sourcemap: false
    },
    style: {
      extract: true,
      minimize: true,
      autoprefixer: true
    },
    external: [],
    bundleless: true
  },

  [LibraryType.VUE2]: {
    output: {
      format: ['esm', 'cjs', 'umd'],
      sourcemap: true
    },
    vue: {
      version: 2,
      onDemand: true
    },
    external: ['vue'],
    globals: {
      vue: 'Vue'
    },
    bundleless: false
  },

  [LibraryType.VUE3]: {
    output: {
      format: ['esm', 'cjs', 'umd'],
      sourcemap: true
    },
    vue: {
      version: 3,
      onDemand: true
    },
    external: ['vue'],
    globals: {
      vue: 'Vue'
    },
    bundleless: false
  },

  [LibraryType.REACT]: {
    output: {
      format: ['esm', 'cjs'],
      sourcemap: true
    },
    external: ['react', 'react-dom'],
    bundleless: false
  },

  [LibraryType.SVELTE]: {
    output: {
      format: ['esm', 'cjs'],
      sourcemap: true
    },
    external: ['svelte'],
    bundleless: false
  },

  [LibraryType.SOLID]: {
    output: {
      format: ['esm', 'cjs'],
      sourcemap: true
    },
    external: ['solid-js'],
    bundleless: false
  },

  [LibraryType.PREACT]: {
    output: {
      format: ['esm', 'cjs'],
      sourcemap: true
    },
    external: ['preact'],
    bundleless: false
  },

  [LibraryType.LIT]: {
    output: {
      format: ['esm', 'cjs'],
      sourcemap: true
    },
    external: ['lit'],
    bundleless: false
  },

  [LibraryType.ANGULAR]: {
    output: {
      format: ['esm', 'cjs'],
      sourcemap: true
    },
    external: ['@angular/core', '@angular/common'],
    bundleless: false
  },

  [LibraryType.MIXED]: {
    output: {
      format: ['esm', 'cjs'],
      sourcemap: true
    },
    typescript: {
      declaration: true
    },
    style: {
      extract: true
    },
    external: [],
    bundleless: false
  },

  [LibraryType.ENHANCED_MIXED]: {
    // 🆕 增强混合框架库配置
    files: [
      '**/adapters/**/*.{ts,tsx,vue,jsx}',
      'src/**/*.{ts,tsx,vue,jsx}'
    ],
    dependencies: [],
    configs: [],
    packageJsonFields: [],
    output: {
      format: ['esm', 'cjs'],
      sourcemap: true,
      preserveModules: true
    },
    typescript: {
      declaration: true
    },
    external: [], // 将由智能分析器填充
    bundleless: false
  }
} as const
/**
 * 库类型兼容性
 */
export const LIBRARY_TYPE_COMPATIBILITY = {
  [LibraryType.TYPESCRIPT]: {
    rollup: 'excellent',
    rolldown: 'excellent',
    treeshaking: true,
    codeSplitting: true,
    bundleless: true
  },

  [LibraryType.STYLE]: {
    rollup: 'good',
    rolldown: 'good',
    treeshaking: false,
    codeSplitting: false,
    bundleless: true
  },

  [LibraryType.VUE2]: {
    rollup: 'excellent',
    rolldown: 'good',
    treeshaking: true,
    codeSplitting: true,
    bundleless: false
  },

  [LibraryType.VUE3]: {
    rollup: 'excellent',
    rolldown: 'excellent',
    treeshaking: true,
    codeSplitting: true,
    bundleless: false
  },

  [LibraryType.MIXED]: {
    rollup: 'good',
    rolldown: 'good',
    treeshaking: true,
    codeSplitting: true,
    bundleless: false
  },

  [LibraryType.SVELTE]: {
    rollup: 'excellent',
    rolldown: 'good',
    treeshaking: true,
    codeSplitting: true,
    bundleless: false
  },

  [LibraryType.SOLID]: {
    rollup: 'good',
    rolldown: 'good',
    treeshaking: true,
    codeSplitting: true,
    bundleless: false
  },

  [LibraryType.PREACT]: {
    rollup: 'excellent',
    rolldown: 'good',
    treeshaking: true,
    codeSplitting: true,
    bundleless: false
  },

  [LibraryType.LIT]: {
    rollup: 'excellent',
    rolldown: 'good',
    treeshaking: true,
    codeSplitting: true,
    bundleless: false
  },

  [LibraryType.ANGULAR]: {
    rollup: 'fair',
    rolldown: 'fair',
    treeshaking: true,
    codeSplitting: true,
    bundleless: false
  }
} as const

/**
 * 库类型所需插件
 */
export const LIBRARY_TYPE_PLUGINS = {
  [LibraryType.TYPESCRIPT]: [
    'typescript',
    'dts'
  ],

  [LibraryType.STYLE]: [
    'postcss',
    'less',
    'sass',
    'stylus'
  ],

  [LibraryType.VUE2]: [
    'vue2',
    'vue-jsx',
    'typescript',
    'postcss'
  ],

  [LibraryType.VUE3]: [
    'vue3',
    'vue-jsx',
    'typescript',
    'postcss'
  ],

  [LibraryType.MIXED]: [
    'typescript',
    'vue3',
    'postcss',
    'dts'
  ],

  [LibraryType.SVELTE]: [
    'svelte',
    'postcss',
    'dts'
  ],

  [LibraryType.SOLID]: [
    'solid',
    'typescript',
    'postcss',
    'dts'
  ],

  [LibraryType.PREACT]: [
    'preact',
    'typescript',
    'postcss',
    'dts'
  ],

  [LibraryType.LIT]: [
    'typescript',
    'postcss',
    'dts'
  ],

  [LibraryType.ANGULAR]: [
    'typescript',
    'dts'
  ]
} as const


