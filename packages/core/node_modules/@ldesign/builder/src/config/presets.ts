/**
 * 配置预设
 * 
 * 提供常用的构建配置预设，简化配置工作
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import type { BuilderConfig } from '../types/config'
import { LibraryType } from '../types/library'

/**
 * Monorepo 包配置预设
 * 
 * 适用于 monorepo 中的标准包，输出 ESM + CJS + UMD 三种格式
 * 
 * @param options - 自定义选项
 * @returns 完整配置
 */
export function monorepoPackage(options: Partial<BuilderConfig> = {}): BuilderConfig {
  return {
    // 自动检测库类型
    libraryType: options.libraryType || LibraryType.TYPESCRIPT,

    // 输出配置 - 三种格式
    output: {
      // ESM 格式 - 输出到 es/ 目录，保留模块结构
      esm: {
        dir: 'es',
        format: 'esm',
        preserveStructure: true,
        dts: true,
        // 使用完整入口，排除 UMD 专用文件
        input: [
          'src/**/*.ts',
          'src/**/*.tsx',
          '!src/**/*.test.*',
          '!src/**/*.spec.*',
          '!src/index-lib.ts',
          '!src/index-umd.ts'
        ]
      },

      // CJS 格式 - 输出到 lib/ 目录，保留模块结构
      cjs: {
        dir: 'lib',
        format: 'cjs',
        preserveStructure: true,
        dts: true,
        // 使用完整入口，排除 UMD 专用文件
        input: [
          'src/**/*.ts',
          'src/**/*.tsx',
          '!src/**/*.test.*',
          '!src/**/*.spec.*',
          '!src/index-lib.ts',
          '!src/index-umd.ts'
        ]
      },

      // UMD 格式 - 输出到 dist/ 目录，单文件打包
      umd: {
        dir: 'dist',
        format: 'umd',
        minify: true,
        sourcemap: true,
        // UMD 优先使用精简入口
        input: 'src/index-lib.ts'
      },

      ...options.output
    },

    // 默认排除模式
    exclude: [
      '**/examples/**',
      '**/example/**',
      '**/demo/**',
      '**/demos/**',
      '**/__tests__/**',
      '**/*.test.*',
      '**/*.spec.*',
      '**/test/**',
      '**/tests/**',
      '**/docs/**',
      '**/.vitepress/**',
      '**/scripts/**',
      '**/dev/**',
      ...(options.exclude || [])
    ],

    // 类型声明
    dts: true,
    sourcemap: true,

    // 清理旧文件
    clean: true,

    // TypeScript 配置
    typescript: {
      declaration: true,
      target: 'ES2020',
      module: 'ESNext',
      ...options.typescript
    },

    // 合并其他自定义选项
    ...options
  }
}

/**
 * 独立库包配置预设
 * 
 * 适用于独立发布的库，通常只需要 ESM + CJS
 * 
 * @param options - 自定义选项
 * @returns 完整配置
 */
export function libraryPackage(options: Partial<BuilderConfig> = {}): BuilderConfig {
  return {
    libraryType: options.libraryType || LibraryType.TYPESCRIPT,

    output: {
      esm: {
        dir: 'es',
        format: 'esm',
        preserveStructure: true,
        dts: true
      },
      cjs: {
        dir: 'lib',
        format: 'cjs',
        preserveStructure: true,
        dts: true
      },
      ...options.output
    },

    exclude: [
      '**/examples/**',
      '**/__tests__/**',
      '**/*.test.*',
      '**/*.spec.*',
      ...(options.exclude || [])
    ],

    dts: true,
    sourcemap: true,
    clean: true,

    typescript: {
      declaration: true,
      isolatedDeclarations: true,
      ...options.typescript
    },

    ...options
  }
}

/**
 * Vue 组件库配置预设
 * 
 * 适用于 Vue 3 组件库
 * 
 * @param options - 自定义选项
 * @returns 完整配置
 */
export function vueLibrary(options: Partial<BuilderConfig> = {}): BuilderConfig {
  return {
    libraryType: LibraryType.VUE3,

    output: {
      esm: {
        dir: 'es',
        format: 'esm',
        preserveStructure: true,
        dts: true,
        input: [
          'src/**/*.ts',
          'src/**/*.vue',
          '!src/**/*.test.*',
          '!src/**/*.spec.*',
          '!src/index-lib.ts'
        ]
      },
      cjs: {
        dir: 'lib',
        format: 'cjs',
        preserveStructure: true,
        dts: true,
        input: [
          'src/**/*.ts',
          'src/**/*.vue',
          '!src/**/*.test.*',
          '!src/**/*.spec.*',
          '!src/index-lib.ts'
        ]
      },
      umd: {
        dir: 'dist',
        format: 'umd',
        minify: true,
        sourcemap: true,
        input: 'src/index-lib.ts'
      },
      ...options.output
    },

    // Vue 专用排除
    exclude: [
      '**/examples/**',
      '**/example/**',
      '**/demo/**',
      '**/__tests__/**',
      '**/*.test.*',
      '**/*.spec.*',
      '**/docs/**',
      '**/dev/**',
      ...(options.exclude || [])
    ],

    // Vue 配置
    vue: {
      version: 3,
      onDemand: true,
      jsx: {
        enabled: true
      },
      template: {
        precompile: true
      },
      ...options.vue
    },

    // 样式处理
    style: {
      extract: true,
      minimize: true,
      autoprefixer: true,
      ...options.style
    },

    // 外部依赖
    external: ['vue', ...(Array.isArray(options.external) ? options.external : [])],

    // 全局变量
    globals: {
      vue: 'Vue',
      ...options.globals
    },

    dts: true,
    sourcemap: true,
    clean: true,

    ...options
  }
}

/**
 * React 组件库配置预设
 * 
 * 适用于 React 组件库
 * 
 * @param options - 自定义选项
 * @returns 完整配置
 */
export function reactLibrary(options: Partial<BuilderConfig> = {}): BuilderConfig {
  return {
    libraryType: LibraryType.REACT,

    output: {
      esm: {
        dir: 'es',
        format: 'esm',
        preserveStructure: true,
        dts: true,
        input: [
          'src/**/*.ts',
          'src/**/*.tsx',
          '!src/**/*.test.*',
          '!src/**/*.spec.*',
          '!src/index-lib.ts'
        ]
      },
      cjs: {
        dir: 'lib',
        format: 'cjs',
        preserveStructure: true,
        dts: true,
        input: [
          'src/**/*.ts',
          'src/**/*.tsx',
          '!src/**/*.test.*',
          '!src/**/*.spec.*',
          '!src/index-lib.ts'
        ]
      },
      umd: {
        dir: 'dist',
        format: 'umd',
        minify: true,
        sourcemap: true,
        input: 'src/index-lib.ts'
      },
      ...options.output
    },

    exclude: [
      '**/examples/**',
      '**/__tests__/**',
      '**/*.test.*',
      '**/*.spec.*',
      '**/stories/**',
      ...(options.exclude || [])
    ],

    // React 配置 - 注释掉因为 BuilderConfig 中没有这个属性
    // react: {
    //   runtime: 'automatic',
    //   development: false,
    //   ...(options as any).react
    // } as any,

    // 样式处理
    style: {
      extract: true,
      minimize: true,
      modules: true,
      ...options.style
    },

    // 外部依赖
    external: ['react', 'react-dom', ...(Array.isArray(options.external) ? options.external : [])],

    // 全局变量
    globals: {
      react: 'React',
      'react-dom': 'ReactDOM',
      ...options.globals
    },

    dts: true,
    sourcemap: true,
    clean: true,

    ...options
  }
}

/**
 * 多框架适配器配置预设
 * 
 * 适用于需要支持多个框架的库（如 cropper）
 * 
 * @param options - 自定义选项
 * @returns 完整配置
 */
export function multiFrameworkLibrary(options: {
  name?: string
  core?: Partial<BuilderConfig>
  vue?: Partial<BuilderConfig>
  react?: Partial<BuilderConfig>
  angular?: Partial<BuilderConfig>
} = {}): BuilderConfig[] {
  const configs: BuilderConfig[] = []

  // 核心库配置
  if ((options.core as any) !== false) {
    configs.push({
      libraryType: LibraryType.TYPESCRIPT,
      input: 'src/index.ts',
      output: {
        esm: { dir: 'dist', format: 'esm', dts: true },
        cjs: { dir: 'dist', format: 'cjs', dts: true },
        umd: {
          dir: 'dist',
          format: 'umd',
          name: options.name || 'Library',
          minify: true
        }
      },
      exclude: ['**/adapters/**', '**/examples/**', '**/__tests__/**'],
      ...options.core
    })
  }

  // Vue 适配器
  if ((options.vue as any) !== false) {
    configs.push({
      libraryType: LibraryType.VUE3,
      input: 'src/adapters/vue/index.ts',
      output: {
        esm: { dir: 'dist/adapters/vue', format: 'esm', dts: true },
        cjs: { dir: 'dist/adapters/vue', format: 'cjs', dts: true }
      },
      external: ['vue', options.name || 'library-core'],
      ...options.vue
    })
  }

  // React 适配器
  if ((options.react as any) !== false) {
    configs.push({
      libraryType: LibraryType.REACT,
      input: 'src/adapters/react/index.tsx',
      output: {
        esm: { dir: 'dist/adapters/react', format: 'esm', dts: true },
        cjs: { dir: 'dist/adapters/react', format: 'cjs', dts: true }
      },
      external: ['react', 'react-dom', options.name || 'library-core'],
      ...options.react
    })
  }

  // Angular 适配器
  if ((options.angular as any) !== false) {
    configs.push({
      libraryType: LibraryType.ANGULAR,
      input: 'src/adapters/angular/index.ts',
      output: {
        esm: { dir: 'dist/adapters/angular', format: 'esm', dts: true },
        cjs: { dir: 'dist/adapters/angular', format: 'cjs', dts: true }
      },
      external: ['@angular/core', '@angular/common', options.name || 'library-core'],
      ...options.angular
    })
  }

  return configs
}

/**
 * LDesign Package配置预设
 * 
 * 专门为 @ldesign 包优化的预设，使用最简配置
 * 自动从 package.json 推断大部分配置
 * 
 * @param options - 自定义选项
 * @returns 完整配置
 */
export function ldesignPackage(options: Partial<BuilderConfig> = {}): BuilderConfig {
  return {
    input: options.input || 'src/index.ts',

    output: {
      format: ['esm', 'cjs', 'umd'],
      esm: {
        dir: 'es',
        preserveStructure: true,
        ...(options.output as any)?.esm
      },
      cjs: {
        dir: 'lib',
        preserveStructure: true,
        ...(options.output as any)?.cjs
      },
      umd: {
        dir: 'dist',
        name: options.name || 'LDesignPackage', // Should be auto-inferred from package.json
        ...(options.output as any)?.umd
      },
      ...(options.output || {})
    },

    dts: true,
    sourcemap: true,
    minify: false,
    clean: true,

    // Standard external dependencies for @ldesign packages
    external: options.external || [
      'vue',
      'react',
      'react-dom',
      /^@ldesign\//,
      /^lodash/,
    ],

    // Merge other custom options
    ...options
  }
}

/**
 * 导出所有预设
 */
export const presets = {
  monorepoPackage,
  libraryPackage,
  vueLibrary,
  reactLibrary,
  multiFrameworkLibrary,
  ldesignPackage
}

/**
 * 默认导出
 */
export default presets

