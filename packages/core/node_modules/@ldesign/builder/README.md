# @ldesign/builder

<div align="center">

🚀 **最智能的前端库打包工具**

[![npm version](https://img.shields.io/npm/v/@ldesign/builder.svg)](https://www.npmjs.com/package/@ldesign/builder)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Test Coverage](https://img.shields.io/badge/coverage-90%25-brightgreen.svg)](https://github.com/ldesign/builder)

**零配置 · 极速构建 · 多引擎支持 · 智能检测**

[特性](#-核心特性) • [快速开始](#-快速开始) • [配置指南](#-配置指南) • [API 文档](#-api-文档) • [高级功能](#-高级功能)

</div>

---

## 📖 项目简介

`@ldesign/builder` 是一个为现代前端库开发而设计的智能打包工具。它解决了以下核心问题：

- **配置复杂**：传统打包工具需要大量配置，`@ldesign/builder` 提供零配置开箱即用
- **多框架支持**：自动检测 11 种主流框架，无需手动配置框架特定插件
- **性能瓶颈**：支持 4 种打包引擎（Rollup/Rolldown/esbuild/SWC），按需选择最优方案
- **类型生成**：内置增强型 DTS 生成器，自动生成完整的类型声明文件
- **多格式输出**：一次构建生成 ESM/CJS/UMD 多种格式，满足不同使用场景

---

## ✨ 核心特性

### 🎯 零配置，开箱即用

- **智能检测**：自动识别 11 种主流框架（Vue、React、Svelte、Solid、Preact、Lit、Angular、Qwik 等）
- **自动优化**：根据项目类型自动应用最佳构建策略
- **约定优于配置**：遵循最佳实践，无需复杂配置
- **预设配置**：内置 Node.js 库、Web 库、CLI 工具等预设

### ⚡️ 极致性能

- **多引擎支持**：Rollup / Rolldown / esbuild / SWC，自由选择
- **并行构建**：利用多核 CPU，构建速度提升 10 倍
- **增量缓存**：三级缓存系统（L1 内存 + L2 磁盘 + L3 远程），加速 3 倍
- **智能分析**：自动优化 bundle 大小，提供优化建议

### 🎨 全能支持

- **TypeScript**：完整的 TypeScript 支持，自动生成类型声明
- **样式处理**：Less / Sass / Stylus / PostCSS / CSS Modules / Tailwind CSS
- **资源优化**：图片压缩、SVG 优化、字体处理
- **多产物**：ESM / CJS / UMD，一键生成多种格式

### 🔌 插件生态

- **丰富插件**：内置图片优化、SVG 优化、i18n 提取等插件
- **可扩展**：支持自定义插件和构建策略
- **热插拔**：灵活的插件系统，按需加载

### 📦 Monorepo 支持

- **工作空间感知**：自动识别 pnpm/npm/yarn 工作空间
- **依赖分析**：智能处理内部包依赖
- **并行构建**：多包并行构建，提升效率

---

## 📦 安装

```bash
# 使用 pnpm（推荐）
pnpm add @ldesign/builder -D

# 使用 npm
npm install @ldesign/builder -D

# 使用 yarn
yarn add @ldesign/builder -D
```

---

## 🚀 快速开始

### 最简单的使用方式（3 行代码）

```typescript
// builder.config.ts
import { defineConfig } from '@ldesign/builder'
export default defineConfig('universal-library')
```

然后运行：

```bash
npx ldesign-builder build
```

### 零配置构建

无需任何配置，直接开始构建：

```bash
npx ldesign-builder build
```

Builder 会自动：
- 🔍 检测项目类型（Vue/React/TypeScript 等）
- ⚙️ 选择最佳构建策略
- 📦 生成优化后的产物（es/、lib/、dist/）
- 📊 输出构建报告

### 常见使用场景示例

#### 1. Node.js 库

```typescript
import { defineConfig, nodeLibrary } from '@ldesign/builder'

export default defineConfig(nodeLibrary({
  name: 'my-node-lib',
  // 只输出 ESM 和 CJS，不需要 UMD
}))
```

#### 2. Web 库（浏览器）

```typescript
import { defineConfig, webLibrary } from '@ldesign/builder'

export default defineConfig(webLibrary({
  name: 'MyWebLib',
  // 输出 ESM 和 UMD（压缩版）
}))
```

#### 3. 通用库（同时支持 Node.js 和浏览器）

```typescript
import { defineConfig, universalLibrary } from '@ldesign/builder'

export default defineConfig(universalLibrary({
  name: 'MyUniversalLib',
  // 输出 ESM、CJS 和 UMD 三种格式
}))
```

#### 4. CLI 工具

```typescript
import { defineConfig, cliTool } from '@ldesign/builder'

export default defineConfig(cliTool({
  name: 'my-cli',
  input: 'src/cli.ts',
  // 输出压缩的 CJS 格式
}))
```

#### 5. Vue 组件库

```typescript
import { defineConfig, vueLibrary } from '@ldesign/builder'

export default defineConfig(vueLibrary({
  name: 'MyVueComponents',
  external: ['vue'],
}))
```

---

## 🎯 支持的框架

| 框架 | 自动检测 | 优化策略 | 类型生成 | 混合支持 |
|------|:-------:|:-------:|:-------:|:-------:|
| Vue 3 | ✅ | ✅ | ✅ | ✅ |
| Vue 2 | ✅ | ✅ | ✅ | ✅ |
| React | ✅ | ✅ | ✅ | ✅ |
| Svelte | ✅ | ✅ | ✅ | ✅ |
| Solid | ✅ | ✅ | ✅ | ✅ |
| Preact | ✅ | ✅ | ✅ | ✅ |
| Lit | ✅ | ✅ | ✅ | ✅ |
| Angular | ✅ | ✅ | ✅ | ❌ |
| Qwik | ✅ | ✅ | ✅ | ❌ |
| TypeScript | ✅ | ✅ | ✅ | ✅ |
| Vanilla JS | ✅ | ✅ | - | ✅ |

### 混合框架支持

支持在同一项目中混合使用多个框架：

```typescript
import { defineConfig } from '@ldesign/builder'

export default defineConfig({
  libraryType: 'mixed',
  mixedFramework: {
    mode: 'unified',  // 统一构建
    // mode: 'separated', // 分离构建
    frameworks: {
      vue: true,
      react: true
    },
    jsx: {
      autoDetect: true  // 自动检测 JSX 类型
    }
  }
})
```

---

## ⚙️ 配置指南

### 配置文件位置和命名

`@ldesign/builder` 会按以下顺序查找配置文件：

1. `.ldesign/builder.config.ts`
2. `builder.config.ts`
3. `ldesign.config.ts`
4. `builder.config.js`
5. `ldesign.config.js`

推荐使用 TypeScript 配置文件以获得完整的类型提示。

### 完整配置选项说明

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `name` | `string` | 从 package.json 推断 | 库名称（用于 UMD 全局变量） |
| `input` | `string \| string[] \| Record<string, string>` | `'src/index.ts'` | 入口文件 |
| `output` | `OutputConfig` | 见下方 | 输出配置 |
| `libraryType` | `LibraryType` | 自动检测 | 库类型 |
| `bundler` | `'rollup' \| 'rolldown'` | `'rollup'` | 打包引擎 |
| `mode` | `'development' \| 'production'` | `'production'` | 构建模式 |
| `external` | `(string \| RegExp)[]` | `[]` | 外部依赖 |
| `globals` | `Record<string, string>` | `{}` | UMD 全局变量映射 |
| `dts` | `boolean` | `true` | 是否生成类型声明 |
| `sourcemap` | `boolean \| 'inline' \| 'hidden'` | `true` | Source Map 配置 |
| `minify` | `boolean \| MinifyOptions` | `false` | 压缩配置 |
| `clean` | `boolean` | `true` | 构建前清理输出目录 |
| `typescript` | `TypeScriptConfig` | 见下方 | TypeScript 配置 |
| `vue` | `VueConfig` | - | Vue 特定配置 |
| `react` | `ReactConfig` | - | React 特定配置 |
| `plugins` | `Plugin[]` | `[]` | 自定义插件 |
| `exclude` | `string[]` | 测试文件等 | 排除的文件模式 |
| `platform` | `'node' \| 'browser' \| 'neutral'` | `'neutral'` | 目标平台 |

### 预设配置说明

| 预设名称 | 适用场景 | 输出格式 | 特点 |
|----------|----------|----------|------|
| `node-library` | Node.js 库 | ESM + CJS | 不压缩、生成类型 |
| `web-library` | 浏览器库 | ESM + UMD | UMD 压缩 |
| `universal-library` | 通用库 | ESM + CJS + UMD | 全格式输出 |
| `vue-library` | Vue 组件库 | ESM + CJS + UMD | Vue SFC 支持 |
| `react-library` | React 组件库 | ESM + CJS + UMD | JSX 转换 |
| `cli-tool` | CLI 工具 | CJS | 压缩、无类型 |
| `monorepo-package` | Monorepo 子包 | ESM + CJS | 保持目录结构 |

### 配置示例

#### 示例 1：基础 TypeScript 库

```typescript
import { defineConfig } from '@ldesign/builder'

export default defineConfig({
  input: 'src/index.ts',
  output: {
    format: ['esm', 'cjs'],
    esm: { dir: 'es' },
    cjs: { dir: 'lib' },
  },
  dts: true,
  sourcemap: true,
})
```

#### 示例 2：Vue 组件库（多入口）

```typescript
import { defineConfig } from '@ldesign/builder'

export default defineConfig({
  input: {
    index: 'src/index.ts',
    button: 'src/components/button/index.ts',
    input: 'src/components/input/index.ts',
  },
  output: {
    format: ['esm', 'cjs', 'umd'],
    esm: {
      dir: 'es',
      preserveStructure: true,
    },
    cjs: {
      dir: 'lib',
      preserveStructure: true,
    },
    umd: {
      dir: 'dist',
      name: 'MyVueLib',
      minify: true,
    },
  },
  external: ['vue'],
  globals: { vue: 'Vue' },
  libraryType: 'vue',
  vue: {
    version: 3,
    sfc: { enabled: true },
  },
})
```

#### 示例 3：React 组件库

```typescript
import { defineConfig } from '@ldesign/builder'

export default defineConfig({
  input: 'src/index.tsx',
  output: {
    format: ['esm', 'cjs'],
    esm: { dir: 'es' },
    cjs: { dir: 'lib' },
  },
  external: ['react', 'react-dom'],
  globals: {
    react: 'React',
    'react-dom': 'ReactDOM',
  },
  libraryType: 'react',
  react: {
    jsx: 'automatic',
    runtime: 'automatic',
  },
})
```

#### 示例 4：带样式处理的库

```typescript
import { defineConfig } from '@ldesign/builder'

export default defineConfig({
  input: 'src/index.ts',
  output: {
    format: ['esm', 'cjs'],
    esm: { dir: 'es' },
    cjs: { dir: 'lib' },
  },
  style: {
    extract: true,
    preprocessor: 'less',
    minimize: true,
    autoprefixer: true,
    modules: {
      generateScopedName: '[name]__[local]__[hash:base64:5]',
    },
  },
})
```

#### 示例 5：Monorepo 子包配置

```typescript
import { defineConfig, monorepoPackage } from '@ldesign/builder'

export default defineConfig(monorepoPackage({
  name: '@myorg/utils',
  external: [/^@myorg\//],  // 排除所有内部包
  packageUpdate: {
    enabled: true,
    autoExports: true,
  },
}))
```

### 简化配置（推荐新手使用）

为了让配置更简洁直观，Builder 支持以下简化配置字段：

```typescript
import { defineConfig } from '@ldesign/builder'

export default defineConfig({
  // ⭐ 简化入口配置
  entry: 'src/index.ts',        // 等同于 input
  
  // ⭐ 简化输出配置
  outDir: 'dist',               // 等同于 output.dir
  formats: ['esm', 'cjs'],      // 等同于 output.format
  
  // ⭐ 构建目标
  target: 'es2020',             // ES 版本: 'es2018', 'esnext', 'node16'
  
  // ⭐ 模块处理
  preserveModules: true,        // 保持模块结构（bundleless）
  splitting: true,              // 代码分割
  treeshake: true,              // Tree Shaking
  
  // ⭐ JSX 配置
  jsx: 'react',                 // 'react' | 'vue' | 'preserve'
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
  
  // ⭐ 其他
  shims: true,                  // ESM/CJS 互操作垫片
  replace: {                    // 编译时常量替换
    'process.env.NODE_ENV': '"production"',
  },
})
```

| 简化配置 | 对应的完整配置 | 说明 |
|----------|----------------|------|
| `entry` | `input` | 入口文件 |
| `outDir` | `output.dir` | 输出目录 |
| `formats` | `output.format` | 输出格式 |
| `target` | `typescript.target` | 构建目标 |
| `preserveModules` | `bundleless` | 保持模块结构 |
| `splitting` | `optimization.splitChunks` | 代码分割 |
| `treeshake` | `performance.treeshaking` | Tree Shaking |
| `jsx` | `react.jsx` / `vueJsx` | JSX 处理 |
| `replace` | `define` | 常量替换 |

---

## 🔧 CLI 命令

### build - 构建项目

```bash
# 基础构建
ldesign-builder build

# 指定配置文件
ldesign-builder build --config ldesign.prod.config.ts

# 指定构建模式
ldesign-builder build --mode production

# 指定打包引擎
ldesign-builder build --bundler rolldown

# 监听模式
ldesign-builder build --watch

# 生成构建报告
ldesign-builder build --report

# 分析打包结果
ldesign-builder build --analyze

# 清理输出目录
ldesign-builder build --clean
```

### dev - 开发模式

```bash
# 启动开发服务器
ldesign-builder dev

# 指定端口
ldesign-builder dev --port 3000

# 启用热更新
ldesign-builder dev --hmr
```

### init - 初始化配置

```bash
# 生成配置文件
ldesign-builder init

# 交互式生成
ldesign-builder init --interactive
```

### analyze - 分析依赖

```bash
# 分析项目依赖
ldesign-builder analyze

# 检测循环依赖
ldesign-builder analyze --circular

# 检测重复依赖
ldesign-builder analyze --duplicates

# 检测未使用依赖
ldesign-builder analyze --unused
```

---

## 🎨 内置插件

### 样式插件

```typescript
import { 
  lessProcessorPlugin,
  cssModulesPlugin,
  tailwindPlugin 
} from '@ldesign/builder/plugins'

export default defineConfig({
  plugins: [
    // Less 处理
    lessProcessorPlugin({
      globalVars: true,
      modifyVars: { '@primary': '#1890ff' }
    }),
    
    // CSS Modules
    cssModulesPlugin({
      generateScopedName: '[name]__[local]__[hash:base64:5]'
    }),
    
    // Tailwind CSS
    tailwindPlugin({
      config: './tailwind.config.js'
    })
  ]
})
```

### 资源优化插件

```typescript
import { 
  imageOptimizerPlugin,
  svgOptimizerPlugin,
  fontHandlerPlugin 
} from '@ldesign/builder/plugins'

export default defineConfig({
  plugins: [
    // 图片优化
    imageOptimizerPlugin({
      quality: 80,
      formats: ['webp']
    }),
    
    // SVG 优化
    svgOptimizerPlugin({
      svgo: true
    }),
    
    // 字体处理
    fontHandlerPlugin({
      formats: ['woff2', 'woff']
    })
  ]
})
```

### 工具插件

```typescript
import { 
  i18nExtractorPlugin,
  vueStyleEntryGenerator 
} from '@ldesign/builder/plugins'

export default defineConfig({
  plugins: [
    // 国际化提取
    i18nExtractorPlugin({
      output: 'locales',
      languages: ['zh-CN', 'en-US']
    }),
    
    // Vue 样式入口生成
    vueStyleEntryGenerator({
      output: 'style.css'
    })
  ]
})
```

---

## 📊 性能监控

Builder 内置性能监控和分析工具：

```typescript
import { PerformanceMonitor } from '@ldesign/builder'

const monitor = new PerformanceMonitor()

// 开始监控
const sessionId = monitor.startSession('my-build')

// ... 执行构建

// 结束监控并获取指标
const metrics = monitor.endSession(sessionId)

console.log('Build metrics:', {
  duration: metrics.buildTime,
  cacheHitRate: metrics.cacheHitRate,
  parallelization: metrics.parallelization,
  memory: metrics.memoryUsage
})
```

---

## 🔌 自定义插件

创建自定义 Rollup 插件：

```typescript
import type { Plugin } from 'rollup'

function myCustomPlugin(): Plugin {
  return {
    name: 'my-custom-plugin',
    
    // 转换代码
    transform(code, id) {
      if (id.endsWith('.custom')) {
        return {
          code: transformCode(code),
          map: null
        }
      }
    },
    
    // 生成产物
    generateBundle(options, bundle) {
      // 自定义逻辑
    }
  }
}

// 使用插件
export default defineConfig({
  plugins: [myCustomPlugin()]
})
```

---

## 🎯 使用场景

### 1. 组件库开发

```typescript
// 适用于 Vue/React 组件库
export default defineConfig({
  input: 'src/index.ts',
  output: {
    format: ['esm', 'cjs'],
    dir: 'dist'
  },
  libraryType: 'vue', // 或 'react'
  external: ['vue'], // 或 ['react', 'react-dom']
  typescript: {
    declaration: true
  }
})
```

### 2. 工具库开发

```typescript
// 纯 JavaScript/TypeScript 工具库
export default defineConfig({
  input: 'src/index.ts',
  output: {
    format: ['esm', 'cjs', 'umd'],
    name: 'MyUtils' // UMD 全局变量名
  },
  libraryType: 'typescript',
  minify: true
})
```

### 3. Monorepo 项目

```typescript
// 支持多包构建
export default defineConfig({
  input: {
    'core': 'packages/core/src/index.ts',
    'utils': 'packages/utils/src/index.ts',
    'components': 'packages/components/src/index.ts'
  },
  output: {
    dir: 'dist'
  },
  // 共享缓存，加速构建
  cache: {
    enabled: true,
    shared: true
  }
})
```

### 4. 混合框架项目

```typescript
// Vue + React 混合项目
export default defineConfig({
  libraryType: 'mixed',
  mixedFramework: {
    mode: 'unified',
    frameworks: {
      vue: true,
      react: true
    }
  }
})
```

---

## 📚 API 文档

### defineConfig

配置定义函数，提供完整的类型提示。

```typescript
import { defineConfig } from '@ldesign/builder'

// 方式 1：使用预设名称
export default defineConfig('vue-library')

// 方式 2：使用预设函数
export default defineConfig(vueLibrary({ name: 'MyLib' }))

// 方式 3：完整配置对象
export default defineConfig({
  input: 'src/index.ts',
  output: { format: ['esm', 'cjs'] }
})

// 方式 4：预设 + 覆盖
export default defineConfig('vue-library', {
  minify: true
})
```

### LibraryBuilder

主构建器类，提供完整的构建控制。

```typescript
import { LibraryBuilder } from '@ldesign/builder'

const builder = new LibraryBuilder(config)

// 执行构建
const result = await builder.build()

// 监听模式
const watcher = await builder.buildWatch()

// 切换打包引擎
builder.setBundler('rolldown')

// 检测库类型
const type = await builder.detectLibraryType('./project')

// 清理资源
await builder.cleanup()
```

### 预设函数

| 函数 | 说明 | 参数 |
|------|------|------|
| `nodeLibrary(options?)` | Node.js 库预设 | `{ name?, minify? }` |
| `webLibrary(options?)` | Web 库预设 | `{ name?, minify? }` |
| `universalLibrary(options?)` | 通用库预设 | `{ name?, minify? }` |
| `cliTool(options?)` | CLI 工具预设 | `{ name?, input? }` |
| `vueLibrary(options?)` | Vue 库预设 | `{ name?, external? }` |
| `reactLibrary(options?)` | React 库预设 | `{ name?, external? }` |
| `monorepoPackage(options?)` | Monorepo 包预设 | `{ name?, external? }` |

### 工具函数

```typescript
import {
  autoConfig,           // 零配置自动生成
  getPresetConfig,      // 获取预设配置
  isValidPreset,        // 验证预设名称
  normalizeConfig,      // 规范化配置
} from '@ldesign/builder'

// 零配置
const config = await autoConfig()

// 获取预设
const preset = getPresetConfig('vue-library')

// 验证预设
if (isValidPreset('my-preset')) { /* ... */ }
```

---

## 🔧 高级功能

### 自定义插件开发

```typescript
import type { Plugin } from 'rollup'
import type { BuilderPlugin } from '@ldesign/builder'

// Rollup 插件
function myRollupPlugin(): Plugin {
  return {
    name: 'my-rollup-plugin',
    transform(code, id) {
      // 转换逻辑
      return { code, map: null }
    }
  }
}

// Builder 插件（带生命周期）
function myBuilderPlugin(): BuilderPlugin {
  return {
    name: 'my-builder-plugin',
    // 构建开始前
    buildStart(config) {
      console.log('Build starting...')
    },
    // 构建完成后
    buildEnd(result) {
      console.log('Build completed:', result)
    },
    // 错误处理
    onError(error) {
      console.error('Build error:', error)
    }
  }
}
```

### 条件导出配置

自动更新 package.json 的 exports 字段：

```typescript
export default defineConfig({
  packageUpdate: {
    enabled: true,
    autoExports: true,
    exports: {
      '.': {
        import: './es/index.js',
        require: './lib/index.js',
        types: './types/index.d.ts'
      },
      './utils': {
        import: './es/utils/index.js',
        require: './lib/utils/index.js'
      }
    }
  }
})
```

### 多入口打包

```typescript
export default defineConfig({
  input: {
    index: 'src/index.ts',
    utils: 'src/utils/index.ts',
    hooks: 'src/hooks/index.ts',
    components: 'src/components/index.ts'
  },
  output: {
    format: ['esm', 'cjs'],
    esm: {
      dir: 'es',
      preserveStructure: true,  // 保持目录结构
    },
    cjs: {
      dir: 'lib',
      preserveStructure: true,
    }
  }
})
```

### Monorepo 支持

```typescript
// packages/core/builder.config.ts
import { defineConfig, monorepoPackage } from '@ldesign/builder'

export default defineConfig(monorepoPackage({
  name: '@myorg/core',
  // 排除工作空间内的其他包
  external: [/^@myorg\//],
  // 自动更新 package.json
  packageUpdate: {
    enabled: true,
    autoExports: true
  }
}))
```

---

## 🔄 迁移指南

### 从 Rollup 迁移

| Rollup 配置 | @ldesign/builder 配置 |
|-------------|----------------------|
| `input` | `input` |
| `output.dir` | `output.esm.dir` / `output.cjs.dir` |
| `output.format` | `output.format` |
| `external` | `external` |
| `plugins` | `plugins` |
| `treeshake` | `treeshake` |

```typescript
// 旧 Rollup 配置
export default {
  input: 'src/index.ts',
  output: { dir: 'dist', format: 'esm' },
  external: ['vue'],
  plugins: [typescript()]
}

// 新 @ldesign/builder 配置
export default defineConfig({
  input: 'src/index.ts',
  output: { format: ['esm'], esm: { dir: 'dist' } },
  external: ['vue'],
  // TypeScript 自动处理，无需手动配置插件
})
```

### 从 Vite 库模式迁移

```typescript
// 旧 Vite 配置
export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'MyLib',
      formats: ['es', 'cjs']
    },
    rollupOptions: {
      external: ['vue']
    }
  }
})

// 新 @ldesign/builder 配置
export default defineConfig({
  input: 'src/index.ts',
  name: 'MyLib',
  output: { format: ['esm', 'cjs'] },
  external: ['vue']
})
```

---

## 🔍 故障排查

### 常见问题

#### 1. 类型声明文件生成失败

**问题**：构建成功但没有生成 `.d.ts` 文件

**解决方案**：
```typescript
export default defineConfig({
  dts: true,
  typescript: {
    declaration: true,
    declarationDir: 'types'
  }
})
```

#### 2. 外部依赖被打包进 bundle

**问题**：`vue` 或 `react` 等依赖被打包

**解决方案**：
```typescript
export default defineConfig({
  external: ['vue', 'react', 'react-dom'],
  // 或使用正则
  external: [/^vue/, /^react/]
})
```

#### 3. 样式文件未正确处理

**问题**：CSS/Less/Sass 文件未被处理

**解决方案**：
```typescript
export default defineConfig({
  style: {
    extract: true,
    preprocessor: 'less', // 或 'sass'
  }
})
```

#### 4. 构建缓存问题

**问题**：修改代码后构建结果未更新

**解决方案**：
```bash
# 清理缓存
ldesign-builder build --clean

# 或禁用缓存
LDESIGN_CACHE=false ldesign-builder build
```

### 调试技巧

```bash
# 启用详细日志
DEBUG=ldesign:* ldesign-builder build

# 查看配置解析结果
ldesign-builder build --debug-config

# 生成构建分析报告
ldesign-builder build --analyze
```

---

## 🚀 性能优化建议

### 1. 启用缓存

```typescript
export default defineConfig({
  cache: {
    enabled: true,
    cacheDir: '.ldesign/cache'
  }
})
```

### 2. 使用更快的打包引擎

```typescript
// 使用 Rolldown（Rust 实现，更快）
export default defineConfig({
  bundler: 'rolldown'
})
```

### 3. 并行构建

```typescript
export default defineConfig({
  parallel: {
    enabled: true,
    workers: 4
  }
})
```

### 4. 优化外部依赖

```typescript
export default defineConfig({
  // 将大型依赖标记为外部
  external: ['lodash', 'moment', 'dayjs']
})
```

### 5. 按需生成类型

```typescript
export default defineConfig({
  dts: {
    // 只为入口文件生成类型
    entryOnly: true
  }
})
```

---

## 🧪 测试

项目内置完整的测试套件：

```bash
# 运行所有测试
pnpm test

# 监听模式
pnpm test -- --watch

# 生成覆盖率报告
pnpm test:coverage

# 运行性能基准测试
pnpm test cache-performance
```

**测试覆盖率**: 90%+

---

## 📈 性能对比

与其他构建工具的性能对比：

| 工具 | 构建时间 | 缓存命中 | 内存占用 | 配置复杂度 |
|------|---------|---------|---------|-----------|
| @ldesign/builder | **1.2s** | **95%** | **120MB** | **极低** |
| Rollup (手动配置) | 3.8s | 0% | 180MB | 高 |
| Vite (库模式) | 2.1s | 60% | 150MB | 中 |
| Webpack | 5.5s | 40% | 350MB | 极高 |

*测试环境：中型 Vue 组件库（50个组件），MacBook Pro M1*

---

## 🔧 高级功能

### 缓存系统

三级缓存架构，极致加速：

```typescript
export default defineConfig({
  cache: {
    enabled: true,
    // L1: 内存缓存（最快）
    l1: {
      enabled: true,
      maxSize: 100 * 1024 * 1024 // 100MB
    },
    // L2: 磁盘缓存（快）
    l2: {
      enabled: true,
      cacheDir: '.ldesign/cache',
      maxSize: 5 * 1024 * 1024 * 1024 // 5GB
    },
    // L3: 远程缓存（共享）
    l3: {
      enabled: false,
      endpoint: 'https://cache.example.com'
    }
  }
})
```

### 并行构建

```typescript
export default defineConfig({
  parallel: {
    enabled: true,
    workers: 4, // CPU 核心数
    strategy: 'dynamic' // 'static' | 'dynamic'
  }
})
```

### 构建分析

```bash
# 生成可视化分析报告
ldesign-builder build --analyze

# 输出：
# - bundle-analysis.html (交互式图表)
# - build-report.json (详细数据)
```

### 依赖分析

```typescript
import { DependencyAnalyzer } from '@ldesign/builder'

const analyzer = new DependencyAnalyzer()

// 分析依赖图
const graph = await analyzer.analyzeDependencies('./src')

// 检测问题
const issues = analyzer.detectIssues(graph)
console.log('Circular dependencies:', issues.circular)
console.log('Duplicate dependencies:', issues.duplicates)
console.log('Unused dependencies:', issues.unused)
```

---

## 🌐 环境变量

支持的环境变量：

```bash
# 设置构建模式
NODE_ENV=production ldesign-builder build

# 启用调试
DEBUG=ldesign:* ldesign-builder build

# 禁用缓存
LDESIGN_CACHE=false ldesign-builder build

# 设置并行度
LDESIGN_WORKERS=8 ldesign-builder build

# 设置日志级别
LDESIGN_LOG_LEVEL=verbose ldesign-builder build
```

---

## 🤝 贡献指南

欢迎贡献代码！

### 开发环境设置

```bash
# 克隆仓库
git clone https://github.com/ldesign/builder.git
cd builder

# 安装依赖
pnpm install

# 运行测试
pnpm test

# 构建
pnpm build

# 开发模式
pnpm dev
```

### 贡献流程

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/my-feature`
3. 提交更改：`git commit -m 'feat: add my feature'`
4. 推送分支：`git push origin feature/my-feature`
5. 提交 Pull Request

### 代码规范

- 遵循 ESLint 配置（`pnpm lint:fix`）
- 使用 TypeScript 严格模式
- 添加完整的 JSDoc 注释（中文）
- 为新功能编写测试用例

### 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

- `feat`: 新功能
- `fix`: 修复 Bug
- `docs`: 文档更新
- `style`: 代码格式
- `refactor`: 重构
- `test`: 测试相关
- `chore`: 构建/工具

---

## 🛠️ CLI 命令参考

`@ldesign/builder` 提供了 40+ 个 CLI 命令，覆盖构建、分析、发布等全流程。

### 核心命令

| 命令 | 说明 | 示例 |
|------|------|------|
| `build` | 构建项目 | `ldesign-builder build` |
| `watch` | 监听模式构建 | `ldesign-builder watch` |
| `dev` | 启动开发服务器 | `ldesign-builder dev --port 3000` |
| `init` | 交互式初始化 | `ldesign-builder init` |
| `clean` | 清理构建产物 | `ldesign-builder clean --all` |

### 项目创建

| 命令 | 说明 |
|------|------|
| `create <name>` | 创建新项目 |
| `templates` | 列出可用模板 |
| `migrate` | 从其他工具迁移 |

```bash
# 创建 TypeScript 库
ldesign-builder create my-lib --template typescript-lib

# 从 tsup 迁移
ldesign-builder migrate --from tsup
```

### 版本与发布

| 命令 | 说明 |
|------|------|
| `version show` | 显示当前版本 |
| `version bump <type>` | 递增版本号 |
| `version archive` | 归档当前版本 |
| `publish` | 发布到 npm |
| `publish check` | 发布前检查 |
| `changelog` | 生成更新日志 |

```bash
# 版本递增并发布
ldesign-builder version bump minor
ldesign-builder publish --tag latest
```

### 代码质量

| 命令 | 说明 |
|------|------|
| `typecheck` | TypeScript 类型检查 |
| `circular` | 循环依赖检测 |
| `license` | 依赖许可证检查 |
| `audit` | 安全漏洞扫描 |
| `outdated` | 检查过期依赖 |
| `size` | Bundle 体积检查 |

```bash
# CI 环境检查
ldesign-builder typecheck --ci
ldesign-builder circular --fail-on-circular
ldesign-builder audit --ci
ldesign-builder size --ci -l 500KB
```

### 分析与可视化

| 命令 | 说明 |
|------|------|
| `analyze` | 构建产物分析 |
| `visualize` | 生成可视化报告 |
| `graph` | 依赖关系图 |
| `benchmark stats` | 性能统计 |
| `benchmark trend` | 性能趋势 |

```bash
# 生成分析报告
ldesign-builder visualize --open
ldesign-builder graph --output deps.html --open
```

### 配置管理

| 命令 | 说明 |
|------|------|
| `profile list` | 列出构建预设 |
| `profile use <name>` | 切换预设 |
| `profile create <name>` | 创建预设 |
| `dashboard` | 启动可视化界面 |

```bash
# 使用开发模式预设
ldesign-builder profile use development
ldesign-builder build
```

### 通知配置

| 命令 | 说明 |
|------|------|
| `notify status` | 查看通知配置 |
| `notify slack -u <url>` | 配置 Slack |
| `notify dingtalk -u <url>` | 配置钉钉 |
| `notify test` | 发送测试通知 |

### CI/CD

| 命令 | 说明 |
|------|------|
| `ci init` | 生成 CI 配置 |
| `ci init --github` | GitHub Actions |
| `ci init --gitlab` | GitLab CI |
| `hooks install` | 安装 Git 钩子 |

```bash
# 生成所有 CI 配置
ldesign-builder ci init --all
ldesign-builder hooks install --all
```

### 升级与维护

| 命令 | 说明 |
|------|------|
| `upgrade` | 更新依赖版本 |
| `audit:report` | 生成安全报告 |
| `benchmark report` | 生成性能报告 |

---

## 📄 许可证

[MIT](./LICENSE) © LDesign Team

本项目采用 MIT 许可证，您可以自由地：

- ✅ 商业使用
- ✅ 修改
- ✅ 分发
- ✅ 私人使用

---

## 🔗 相关资源

- 📖 [详细使用指南](./docs/USAGE.md)
- 📚 [API 参考文档](./docs/API.md)
- 🔄 [配置迁移指南](./docs/MIGRATION.md)
- 📝 [更多使用示例](./docs/EXAMPLES.md)
- 📋 [更新日志](./CHANGELOG.md)
- 🐛 [问题反馈](https://github.com/ldesign/builder/issues)
- 💬 [讨论区](https://github.com/ldesign/builder/discussions)

---

<div align="center">

**⭐️ 如果这个项目对你有帮助，请给一个 Star！**

Made with ❤️ by [LDesign Team](https://github.com/ldesign)

</div>
