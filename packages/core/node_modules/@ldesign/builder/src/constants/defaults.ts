/**
 * 默认配置常量
 */

import type { BuilderConfig } from '../types/config'
import type { LibraryBuildOptions } from '../types/library'
import type { PostBuildValidationConfig } from '../types/validation'
import { LibraryType } from '../types/library'

/**
 * 性能相关常量
 */
export const PERFORMANCE_CONSTANTS = {
  /** 默认文件大小限制 (500KB) */
  DEFAULT_FILE_SIZE_LIMIT: 500 * 1024,
  /** 文件大小警告阈值比例 */
  FILE_SIZE_WARNING_RATIO: 0.8,
  /** 默认内存阈值 (MB) */
  DEFAULT_MEMORY_THRESHOLD: 500,
  /** 默认清理间隔 (ms) */
  DEFAULT_CLEANUP_INTERVAL: 60000,
  /** 默认监控间隔 (ms) */
  DEFAULT_MONITORING_INTERVAL: 10000,
  /** 最大并行任务数 */
  MAX_PARALLEL_TASKS: 4,
  /** 缓存大小 (MB) */
  DEFAULT_CACHE_SIZE: 100
} as const

/**
 * 构建相关常量
 */
export const BUILD_CONSTANTS = {
  /** 默认构建超时时间 (ms) */
  DEFAULT_BUILD_TIMEOUT: 300000, // 5分钟
  /** 默认测试超时时间 (ms) */
  DEFAULT_TEST_TIMEOUT: 60000, // 1分钟
  /** 最大重试次数 */
  MAX_RETRY_COUNT: 3,
  /** 重试延迟基数 (ms) */
  RETRY_DELAY_BASE: 1000
} as const

/**
 * 默认构建器配置
 */
export const DEFAULT_BUILDER_CONFIG: Omit<
  Required<Omit<BuilderConfig, 'env' | 'library' | 'libraryType' | 'qwik'>>,
  never
> & {
  env: Record<string, Partial<BuilderConfig>>
  library: Required<LibraryBuildOptions>
  // 默认库类型，可以被自动检测覆盖
  libraryType: LibraryType
  qwik?: import('../types/library').QwikLibraryConfig
} = {
  // 基础配置
  input: 'src/index.ts', // 保留作为兼容，但优先使用 output 中的配置
  libraryType: LibraryType.TYPESCRIPT, // 默认为 TypeScript 库
  // 路径别名
  alias: {},
  // 顶层开关：dts 与 sourcemap（可被各格式覆盖）
  dts: true,
  sourcemap: true,
  output: {
    dir: 'dist',
    format: ['esm', 'cjs'],
    fileName: '[name].[format].js',
    sourcemap: true,
    chunkFileNames: '[name]-[hash].js',
    assetFileNames: '[name]-[hash][extname]',
    // ESM 格式默认配置
    esm: {
      dir: 'es',
      format: 'esm',
      preserveStructure: true,
      dts: true,
      // 默认入口：所有源文件，但排除 UMD 专用入口文件
      input: ['src/**/*.ts', 'src/**/*.js', 'src/**/*.vue', 'src/**/*.tsx', 'src/**/*.jsx', '!src/index-lib.ts', '!src/index-lib.js', '!src/index-umd.ts', '!src/index-umd.js']
    },
    // CommonJS 格式默认配置
    cjs: {
      dir: 'lib',
      format: 'cjs',
      preserveStructure: true,
      dts: true,
      // 默认入口：所有源文件，但排除 UMD 专用入口文件
      input: ['src/**/*.ts', 'src/**/*.js', 'src/**/*.vue', 'src/**/*.tsx', 'src/**/*.jsx', '!src/index-lib.ts', '!src/index-lib.js', '!src/index-umd.ts', '!src/index-umd.js']
    },
    // UMD 格式默认配置
    umd: {
      dir: 'dist',
      format: 'umd',
      minify: true,
      sourcemap: true,
      // UMD 默认单入口：优先使用 index-lib.ts，回退到 index.ts
      input: 'src/index-lib.ts'
    }
  },

  // 打包器配置
  bundler: 'rollup',

  // 模式配置
  mode: 'production',

  // 库类型（自动检测）：默认不设置，交由 LibraryDetector 自动识别
  // libraryType: undefined,

  // 输出选项
  bundleless: false,
  minify: false, // 默认不压缩
  clean: true,

  // 排除文件配置 - 默认排除测试、示例、文档等非生产代码
  exclude: [
    '**/__tests__/**',
    '**/*.test.*',
    '**/*.spec.*',
    '**/test/**',
    '**/tests/**',
    '**/*.stories.*',
    '**/stories/**',
    '**/docs/**',
    '**/examples/**',
    '**/example/**',
    '**/demo/**',
    '**/demos/**',
    '**/__mocks__/**',
    '**/__fixtures__/**',
    '**/e2e/**',
    '**/benchmark/**',
    '**/benchmarks/**',
    '**/.vitepress/**',
    '**/.vuepress/**',
    '**/scripts/**',
    '**/dev/**'
  ],

  // UMD 构建配置
  umd: {
    enabled: true,
    entry: 'src/index.ts',
    name: 'MyLibrary', // 默认名称，会自动从 package.json 推断
    forceMultiEntry: false,
    fileName: 'index.umd.js',
    globals: {},
    minify: false // 默认不压缩
  },

  // Babel 转换配置
  babel: {
    enabled: false, // 默认不启用
    presets: [],
    plugins: [],
    targets: 'defaults',
    polyfill: false,
    runtime: false,
    configFile: false,
    babelrc: true,
    exclude: /node_modules/,
    include: []
  },

  // Banner 和 Footer 配置
  banner: {
    banner: '',
    footer: '',
    intro: '',
    outro: '',
    copyright: false,
    buildInfo: false
  },

  // 外部依赖
  external: [],
  globals: {},

  // 插件配置
  plugins: [],

  // TypeScript 配置
  typescript: {
    tsconfig: './tsconfig.json',
    declaration: true,
    declarationDir: '', // 默认与 output.dir 相同
    isolatedDeclarations: false,
    skipLibCheck: true,
    allowSyntheticDefaultImports: true,
    strict: true,
    target: 'ES2020',
    module: 'ESNext',
    moduleResolution: 'node'
  },

  // Vue 配置（仅作为默认项；实际是否启用由库类型检测与策略决定）
  vue: {
    version: 3,
    onDemand: false,
    compilerOptions: {},
    jsx: {
      enabled: false,
      factory: 'h',
      fragment: 'Fragment'
    },
    template: {
      precompile: true
    }
  },

  // Vue JSX 配置
  vueJsx: {
    include: /\.[jt]sx$/,
    exclude: /node_modules/,
    typescript: true,
    optimize: false,
    factory: 'h',
    fragment: 'Fragment',
    jsxImportSource: 'vue',
    development: false
  },

  // 样式配置
  style: {
    preprocessor: 'auto', // 自动检测
    extract: true,
    minimize: true,
    autoprefixer: true,
    modules: false,
    postcssPlugins: []
  },

  // 性能配置
  performance: {
    bundleAnalyzer: false,
    sizeLimit: '500kb',
    treeshaking: true,
    cache: true,
    parallel: true,
    monitoring: false
  },

  // 调试配置
  debug: false,

  // 打包后验证配置
  postBuildValidation: {
    enabled: false,
    testFramework: 'auto',
    testPattern: ['**/*.test.{js,ts}', '**/*.spec.{js,ts}'],
    timeout: 60000,
    failOnError: true,
    environment: {
      tempDir: '.validation-temp',
      keepTempFiles: false,
      env: {},
      packageManager: 'auto',
      installDependencies: true,
      installTimeout: 300000
    },
    reporting: {
      format: 'console',
      outputPath: 'validation-report',
      verbose: false,
      logLevel: 'info',
      includePerformance: true,
      includeCoverage: false
    },
    hooks: {},
    scope: {
      formats: ['esm', 'cjs'],
      fileTypes: ['js', 'ts', 'dts'],
      exclude: ['**/*.d.ts', '**/node_modules/**'],
      include: ['**/*'],
      validateTypes: true,
      validateStyles: false,
      validateSourceMaps: false
    }
  } as PostBuildValidationConfig,

  // 环境配置
  env: {
    development: {
      mode: 'development',
      minify: false,
      output: {
        sourcemap: 'inline'
      },
      debug: true
    },
    production: {
      mode: 'production',
      minify: true,
      output: {
        sourcemap: true
      },
      debug: false
    }
  },

  // 缓存配置
  cache: {
    enabled: true,
    dir: 'node_modules/.cache/@ldesign/builder',
    maxAge: 86400000, // 24 hours
    maxSize: 500 * 1024 * 1024 // 500MB
  },

  // 监听配置
  watch: {
    include: ['src/**/*'],
    exclude: ['node_modules/**/*', 'dist/**/*'],
    persistent: true,
    ignoreInitial: true
  },

  // 环境变量
  define: {},

  // 工作目录
  cwd: process.cwd(),

  // 配置文件路径
  configFile: '.ldesign/builder.config.ts',

  // 日志级别
  logLevel: 'info',

  // 库构建选项
  library: {
    bundleless: false,
    preserveModules: false,
    generateTypes: true,
    minify: true,
    sourcemap: true,
    external: [],
    globals: {},
    formats: ['esm', 'cjs'],
    splitting: false
  },

  // Package.json 自动更新配置
  packageUpdate: {
    enabled: true,
    srcDir: 'src',
    outputDirs: {
      esm: 'es',
      cjs: 'lib',
      umd: 'dist',
      types: 'es'
    },
    autoExports: true,
    updateEntryPoints: true,
    updateFiles: true,
    customExports: {}
  },

  // 混合框架配置（默认不启用）
  mixedFramework: undefined as any,

  // 自动检测框架（默认不启用）
  autoDetectFramework: false,

  // 项目名称
  name: '',

  // 目标平台
  platform: 'browser' as const,

  // React 配置
  react: {
    jsx: 'automatic' as const,
    jsxImportSource: 'react',
    runtime: 'automatic' as const
  },

  // 优化配置
  optimization: {
    splitChunks: false,
    minimize: false,
    treeShaking: true,
    commonChunks: false
  },

  // 项目路径
  projectPath: process.cwd()
}

/**
 * 预设配置
 *
 * @remarks
 * 实际定义已移动至 `./default-presets` 模块，此处仅做转发导出，保持对外 API 不变。
 */
export { PRESET_CONFIGS } from './default-presets'

/**
 * 支持的配置文件名称
 */
export const CONFIG_FILE_NAMES = [
  '.ldesign/builder.config.ts',
  '.ldesign/builder.config.js',
  '.ldesign/builder.config.mjs',
  '.ldesign/builder.config.json',
  'ldesign.config.ts',
  'ldesign.config.js',
  'ldesign.config.mjs',
  'ldesign.config.json',
  'builder.config.ts',
  'builder.config.js',
  'builder.config.mjs',
  'builder.config.json',
  '.builderrc.ts',
  '.builderrc.js',
  '.builderrc.json'
] as const

/**
 * 默认外部依赖
 */
export const DEFAULT_EXTERNAL_DEPS = [
  // Node.js 内置模块
  'fs', 'path', 'url', 'util', 'events', 'stream', 'crypto', 'os', 'http', 'https',

  // 常见的前端框架（通常作为外部依赖）
  'react', 'react-dom', 'vue', '@vue/runtime-core', '@vue/runtime-dom',
  'angular', '@angular/core', '@angular/common',

  // 常见的工具库
  'lodash', 'moment', 'dayjs', 'axios'
] as const

/**
 * 默认全局变量映射
 */
export const DEFAULT_GLOBALS = {
  'react': 'React',
  'react-dom': 'ReactDOM',
  'vue': 'Vue',
  'lodash': '_',
  'moment': 'moment',
  'dayjs': 'dayjs',
  'axios': 'axios'
} as const

/**
 * 默认文件名模式
 *
 * @remarks
 * 实际定义已移动至 `./runtime-defaults` 模块，此处仅做转发导出，保持对外 API 不变。
 */
export { DEFAULT_FILE_PATTERNS } from './runtime-defaults'

/**
 * 默认缓存配置
 *
 * @remarks
 * 实际定义已移动至 `./runtime-defaults` 模块，此处仅做转发导出，保持对外 API 不变。
 */
export { DEFAULT_CACHE_CONFIG } from './runtime-defaults'

/**
 * 默认性能配置
 *
 * @remarks
 * 实际定义已移动至 `./runtime-defaults` 模块，此处仅做转发导出，保持对外 API 不变。
 */
export { DEFAULT_PERFORMANCE_CONFIG } from './runtime-defaults'

/**
 * 默认监听配置
 *
 * @remarks
 * 实际定义已移动至 `./runtime-defaults` 模块，此处仅做转发导出，保持对外 API 不变。
 */
export { DEFAULT_WATCH_CONFIG } from './runtime-defaults'
