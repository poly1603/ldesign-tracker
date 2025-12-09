/**
 * 库类型相关常量
 */

import { LibraryType } from '../types/library'

/**
 * 库类型检测模式
 */
export const LIBRARY_TYPE_PATTERNS = {
  [LibraryType.TYPESCRIPT]: {
    // TypeScript 库检测模式
    files: [
      'src/**/*.ts',
      'src/**/*.tsx',
      'lib/**/*.ts',
      'lib/**/*.tsx',
      'index.ts',
      'main.ts'
    ],
    dependencies: [
      'typescript',
      '@types/node'
    ],
    configs: [
      'tsconfig.json',
      'tsconfig.build.json'
    ],
    packageJsonFields: [
      'types',
      'typings'
    ],
    weight: 1.0  // 提高权重，优先检测TypeScript项目
  },

  [LibraryType.STYLE]: {
    // 样式库检测模式 - 只有纯样式库才会匹配
    // 注意：如果项目主要是 TypeScript，即使有样式文件也不会被判定为样式库
    files: [
      'src/**/*.css',
      'src/**/*.less',
      'src/**/*.scss',
      'src/**/*.sass',
      'src/**/*.styl',
      'lib/**/*.css',
      'styles/**/*'
    ],
    dependencies: [
      // 移除 less/sass/stylus，只保留纯样式库才有的依赖
      'postcss'
    ],
    configs: [
      'postcss.config.js',
      '.stylelintrc'
    ],
    packageJsonFields: [
      'style',
      'sass'
      // 不包含 'less'，因为很多TS库也使用less
    ],
    weight: 0.3  // 大幅降低权重，避免误判为样式库
  },

  [LibraryType.VUE2]: {
    // Vue2 组件库检测模式
    files: [
      'src/**/*.vue',
      'lib/**/*.vue',
      'components/**/*.vue'
    ],
    dependencies: [
      'vue@^2',
      '@vue/composition-api',
      'vue-template-compiler'
    ],
    devDependencies: [
      '@vue/cli-service',
      'vue-loader'
    ],
    configs: [
      'vue.config.js'
    ],
    packageJsonFields: [],
    weight: 0.95
  },

  [LibraryType.VUE3]: {
    // Vue3 组件库检测模式
    files: [
      'src/**/*.vue',
      'lib/**/*.vue',
      'components/**/*.vue',
      'src/**/*.tsx',
      'lib/**/*.tsx',
      'components/**/*.tsx'
    ],
    dependencies: [
      'vue@^3',
      '@vue/runtime-core',
      '@vue/runtime-dom'
    ],
    devDependencies: [
      '@vitejs/plugin-vue',
      '@vue/compiler-sfc'
    ],
    configs: [
      'vite.config.ts',
      'vite.config.js'
    ],
    packageJsonFields: [],
    weight: 0.95
  },

  [LibraryType.REACT]: {
    // React 组件库检测模式
    files: [
      'src/**/*.tsx',
      'src/**/*.jsx',
      'lib/**/*.tsx',
      'components/**/*.tsx'
    ],
    dependencies: [
      'react',
      'react-dom'
    ],
    devDependencies: [
      '@vitejs/plugin-react'
    ],
    configs: [
      'vite.config.ts',
      'vite.config.js'
    ],
    packageJsonFields: [],
    weight: 0.95
  },

  [LibraryType.SVELTE]: {
    // Svelte 组件库检测模式
    files: [
      'src/**/*.svelte',
      'lib/**/*.svelte',
      'components/**/*.svelte'
    ],
    dependencies: [
      'svelte'
    ],
    devDependencies: [
      '@sveltejs/rollup-plugin-svelte'
    ],
    configs: [
      'svelte.config.js',
      'svelte.config.cjs'
    ],
    packageJsonFields: [
      'svelte'
    ],
    weight: 0.95
  },

  [LibraryType.SOLID]: {
    // Solid 组件库检测模式
    files: [
      'src/**/*.jsx',
      'src/**/*.tsx'
    ],
    dependencies: [
      'solid-js'
    ],
    devDependencies: [
      'rollup-plugin-solid',
      'vite-plugin-solid'
    ],
    configs: [
      'vite.config.ts',
      'vite.config.js'
    ],
    packageJsonFields: [],
    weight: 0.9
  },

  [LibraryType.PREACT]: {
    // Preact 组件库检测模式
    files: [
      'src/**/*.jsx',
      'src/**/*.tsx'
    ],
    dependencies: [
      'preact'
    ],
    devDependencies: [
      '@preact/preset-vite'
    ],
    configs: [
      'vite.config.ts',
      'vite.config.js'
    ],
    packageJsonFields: [],
    weight: 0.9
  },

  [LibraryType.LIT]: {
    // Lit / Web Components 检测模式
    files: [
      'src/**/*.ts',
      'src/**/*.js',
      'src/**/*.css'
    ],
    dependencies: [
      'lit'
    ],
    devDependencies: [],
    configs: [],
    packageJsonFields: [],
    weight: 0.85
  },

  [LibraryType.ANGULAR]: {
    // Angular 组件库检测模式（基础）
    files: [
      'projects/**/*.ts',
      'src/**/*.ts'
    ],
    dependencies: [
      '@angular/core',
      '@angular/common'
    ],
    devDependencies: [
      'ng-packagr'
    ],
    configs: [
      'ng-package.json',
      'angular.json'
    ],
    packageJsonFields: [],
    weight: 0.8
  },

  [LibraryType.MIXED]: {
    // 混合库检测模式（多种类型混合）
    // 提高权重，作为通用兼容策略
    files: [
      'src/**/*.{ts,tsx,vue,css,less,scss,jsx,js}'
    ],
    dependencies: [],
    configs: [],
    packageJsonFields: [],
    weight: 0.85 // ↑ 提高权重！作为通用兼容选项
  },

  [LibraryType.QWIK]: {
    // Qwik 组件库检测模式
    files: [
      'src/**/*.tsx',
      'src/**/*.ts'
    ],
    dependencies: [
      '@builder.io/qwik'
    ],
    devDependencies: [],
    configs: [
      'vite.config.ts'
    ],
    packageJsonFields: [],
    weight: 0.95
  }
} as const

/**
 * 库类型描述
 *
 * @remarks
 * 实际定义已移动至 `./library-configs` 模块，此处仅做转发导出，保持对外 API 不变。
 */
export { LIBRARY_TYPE_DESCRIPTIONS } from './library-configs'

/**
 * 库类型推荐配置
 *
 * @remarks
 * 实际定义已移动至 `./library-configs` 模块，此处仅做转发导出，保持对外 API 不变。
 */
export { LIBRARY_TYPE_RECOMMENDED_CONFIG } from './library-configs'

/**
 * 库类型优先级
 *
 * @remarks
 * 实际定义已移动至 `./library-configs` 模块，此处仅做转发导出，保持对外 API 不变。
 */
export { LIBRARY_TYPE_PRIORITY } from './library-configs'

/**
 * 库类型兼容性
 *
 * @remarks
 * 实际定义已移动至 `./library-configs` 模块，此处仅做转发导出，保持对外 API 不变。
 */
export { LIBRARY_TYPE_COMPATIBILITY } from './library-configs'

/**
 * 库类型所需插件
 *
 * @remarks
 * 实际定义已移动至 `./library-configs` 模块，此处仅做转发导出，保持对外 API 不变。
 */
export { LIBRARY_TYPE_PLUGINS } from './library-configs'




/**
 * 库类型检测权重
 */
export const DETECTION_WEIGHTS = {
  // 文件模式权重
  files: 0.4,

  // 依赖权重
  dependencies: 0.3,

  // 配置文件权重
  configs: 0.2,

  // package.json 字段权重
  packageJsonFields: 0.1
} as const

/**
 * 最小置信度阈值
 */
export const MIN_CONFIDENCE_THRESHOLD = 0.6

/**
 * 库类型检测缓存配置
 */
export const DETECTION_CACHE_CONFIG = {
  enabled: true,
  ttl: 5 * 60 * 1000, // 5 minutes
  maxSize: 100
} as const

/**
 * 库类型特定的文件扩展名
 */
export const LIBRARY_TYPE_EXTENSIONS = {
  [LibraryType.TYPESCRIPT]: ['.ts', '.tsx', '.d.ts'],
  [LibraryType.STYLE]: ['.css', '.less', '.scss', '.sass', '.styl'],
  [LibraryType.VUE2]: ['.vue', '.ts', '.tsx', '.js', '.jsx'],
  [LibraryType.VUE3]: ['.vue', '.ts', '.tsx', '.js', '.jsx'],
  [LibraryType.REACT]: ['.ts', '.tsx', '.js', '.jsx'],
  [LibraryType.SVELTE]: ['.svelte', '.ts', '.js'],
  [LibraryType.SOLID]: ['.ts', '.tsx', '.js', '.jsx'],
  [LibraryType.PREACT]: ['.ts', '.tsx', '.js', '.jsx'],
  [LibraryType.LIT]: ['.ts', '.js', '.css'],
  [LibraryType.ANGULAR]: ['.ts', '.html', '.css', '.scss'],
  [LibraryType.QWIK]: ['.ts', '.tsx', '.js', '.jsx'],
  [LibraryType.MIXED]: ['.ts', '.tsx', '.vue', '.css', '.less', '.scss', '.sass'],
  [LibraryType.ENHANCED_MIXED]: ['.ts', '.tsx', '.vue', '.jsx', '.svelte', '.css', '.less', '.scss']
} as const

/**
 * 库类型排除模式
 */
export const LIBRARY_TYPE_EXCLUDE_PATTERNS = {
  common: [
    'node_modules/**',
    'dist/**',
    'build/**',
    '**/*.test.*',
    '**/*.spec.*',
    '**/*.d.ts'
  ],

  [LibraryType.TYPESCRIPT]: [
    '**/*.js',
    '**/*.jsx'
  ],

  [LibraryType.STYLE]: [
    '**/*.ts',
    '**/*.tsx',
    '**/*.js',
    '**/*.jsx',
    '**/*.vue'
  ],

  [LibraryType.VUE2]: [],

  [LibraryType.VUE3]: [],

  [LibraryType.MIXED]: [],

  [LibraryType.SVELTE]: [],
  [LibraryType.SOLID]: [],
  [LibraryType.PREACT]: [],
  [LibraryType.LIT]: [],
  [LibraryType.ANGULAR]: []
} as const
