# @ldesign/builder 使用指南

本文档提供 `@ldesign/builder` 的详细使用说明。

## 目录

- [快速开始](#快速开始)
- [预设配置](#预设配置)
- [配置详解](#配置详解)
- [CLI 命令](#cli-命令)
- [编程式使用](#编程式使用)
- [高级功能](#高级功能)

---

## 快速开始

### 安装

```bash
# 使用 pnpm（推荐）
pnpm add -D @ldesign/builder

# 使用 npm
npm install -D @ldesign/builder

# 使用 yarn
yarn add -D @ldesign/builder
```

### 基础配置

在项目根目录创建 `builder.config.ts`：

```typescript
import { defineConfig } from '@ldesign/builder'

export default defineConfig({
  input: 'src/index.ts',
  name: 'MyLibrary',
  output: {
    format: ['esm', 'cjs'],
    esm: { dir: 'es' },
    cjs: { dir: 'lib' },
  },
  dts: true,
})
```

### 运行构建

```bash
# 使用 npx
npx ldesign-builder build

# 或添加到 package.json scripts
# "build": "ldesign-builder build"
pnpm build
```

---

## 预设配置

### Node.js 库

```typescript
import { defineConfig } from '@ldesign/builder'

// 方式一：使用预设名称
export default defineConfig('node-library')

// 方式二：使用预设名称 + 覆盖配置
export default defineConfig('node-library', {
  name: 'my-node-lib',
  minify: true,
})

// 方式三：使用预设函数
import { nodeLibrary } from '@ldesign/builder'

export default defineConfig(nodeLibrary({
  name: 'my-node-lib',
}))
```

### 浏览器库

```typescript
import { defineConfig, webLibrary } from '@ldesign/builder'

export default defineConfig(webLibrary({
  name: 'MyWebLib',
  output: {
    umd: { name: 'MyWebLib' },
  },
}))
```

### 通用库（同时支持 Node.js 和浏览器）

```typescript
import { defineConfig, universalLibrary } from '@ldesign/builder'

export default defineConfig(universalLibrary({
  name: 'MyUniversalLib',
}))
```

### CLI 工具

```typescript
import { defineConfig, cliTool } from '@ldesign/builder'

export default defineConfig(cliTool({
  name: 'my-cli',
  input: 'src/cli.ts',
}))
```

## 配置规范化

支持多种配置格式，自动转换为标准格式：

```typescript
// 旧格式（仍然支持，但会显示警告）
export default defineConfig({
  entry: 'src/index.ts',      // → 自动转换为 input
  formats: ['esm', 'cjs'],    // → 自动转换为 output.format
  outDir: 'dist',             // → 自动转换为 output.dir
})

// 新格式（推荐）
export default defineConfig({
  input: 'src/index.ts',
  output: {
    format: ['esm', 'cjs'],
    dir: 'dist',
  },
})
```

## 增强版 Package.json 更新

自动更新 `package.json` 的 `exports` 字段，支持条件导出：

```typescript
import { updatePackageJson } from '@ldesign/builder'

await updatePackageJson({
  projectRoot: process.cwd(),
  srcDir: 'src',
  outputDirs: {
    esm: 'es',
    cjs: 'lib',
    types: 'types',
  },
  conditionalExports: {
    platform: 'universal',  // 'node' | 'browser' | 'universal'
    includeDefault: true,
  },
})
```

生成的 `exports` 字段示例：

```json
{
  "exports": {
    ".": {
      "types": "./types/index.d.ts",
      "import": "./es/index.js",
      "require": "./lib/index.cjs",
      "default": "./es/index.js"
    },
    "./utils": {
      "types": "./types/utils/index.d.ts",
      "import": "./es/utils/index.js",
      "require": "./lib/utils/index.cjs"
    }
  }
}
```

## 增强版 DTS 生成

解决类型声明文件生成不稳定问题：

```typescript
import { EnhancedDtsGenerator } from '@ldesign/builder'

const generator = new EnhancedDtsGenerator({
  projectRoot: process.cwd(),
  input: ['src/index.ts'],
  outDir: 'types',
  maxRetries: 3,
  retryDelay: 1000,
  incremental: true,
  continueOnError: true,
})

const result = await generator.generate()
console.log(`生成了 ${result.generatedFiles.length} 个类型声明文件`)
```

---

## CLI 命令

### build - 构建项目

```bash
# 基础构建
ldesign-builder build

# 指定配置文件
ldesign-builder build --config builder.prod.config.ts

# 指定构建模式
ldesign-builder build --mode production

# 监听模式
ldesign-builder build --watch

# 清理输出目录
ldesign-builder build --clean

# 生成构建报告
ldesign-builder build --report

# 分析打包结果
ldesign-builder build --analyze
```

### dev - 开发模式

```bash
# 启动开发模式（自动监听）
ldesign-builder dev

# 指定端口
ldesign-builder dev --port 3000
```

### init - 初始化配置

```bash
# 生成配置文件
ldesign-builder init

# 交互式生成
ldesign-builder init --interactive
```

### analyze - 依赖分析

```bash
# 分析项目依赖
ldesign-builder analyze

# 检测循环依赖
ldesign-builder analyze --circular

# 检测未使用依赖
ldesign-builder analyze --unused
```

---

## 编程式使用

### 基础用法

```typescript
import { LibraryBuilder } from '@ldesign/builder'

const builder = new LibraryBuilder({
  input: 'src/index.ts',
  output: {
    format: ['esm', 'cjs'],
    esm: { dir: 'es' },
    cjs: { dir: 'lib' }
  }
})

// 执行构建
const result = await builder.build()
console.log('构建完成:', result)
```

### 监听模式

```typescript
import { LibraryBuilder } from '@ldesign/builder'

const builder = new LibraryBuilder(config)

const watcher = await builder.buildWatch()

watcher.on('change', (file) => {
  console.log('文件变更:', file)
})

watcher.on('rebuild', (result) => {
  console.log('重新构建完成')
})

// 停止监听
await watcher.close()
```

### 切换打包引擎

```typescript
import { LibraryBuilder } from '@ldesign/builder'

const builder = new LibraryBuilder(config)

// 使用 Rolldown（更快）
builder.setBundler('rolldown')
await builder.build()

// 使用 esbuild
builder.setBundler('esbuild')
await builder.build()
```

---

## 高级功能

### 缓存配置

```typescript
export default defineConfig({
  cache: {
    enabled: true,
    cacheDir: '.ldesign/cache',
    strategy: 'lru',  // 'lru' | 'lfu' | 'ttl'
    maxSize: 100 * 1024 * 1024  // 100MB
  }
})
```

### 并行构建

```typescript
export default defineConfig({
  parallel: {
    enabled: true,
    workers: 4  // CPU 核心数
  }
})
```

### 性能监控

```typescript
import { PerformanceMonitor } from '@ldesign/builder'

const monitor = new PerformanceMonitor()
const sessionId = monitor.startSession('my-build')

// 执行构建...

const metrics = monitor.endSession(sessionId)
console.log('构建耗时:', metrics.buildTime)
console.log('缓存命中率:', metrics.cacheHitRate)
```

---

## API 参考

### defineConfig

```typescript
// 使用配置对象
function defineConfig(config: MinimalConfig): BuilderConfig

// 使用预设名称
function defineConfig(preset: PresetName): BuilderConfig

// 预设 + 覆盖
function defineConfig(preset: PresetName, overrides: Partial<MinimalConfig>): BuilderConfig
```

### 预设函数

| 函数 | 说明 |
|------|------|
| `nodeLibrary(overrides?)` | Node.js 库预设 |
| `webLibrary(overrides?)` | 浏览器库预设 |
| `universalLibrary(overrides?)` | 通用库预设 |
| `cliTool(overrides?)` | CLI 工具预设 |
| `vueLibrary(overrides?)` | Vue 组件库预设 |
| `reactLibrary(overrides?)` | React 组件库预设 |
| `monorepoPackage(overrides?)` | Monorepo 子包预设 |

---

## 更多信息

- [API 参考文档](./API.md)
- [配置迁移指南](./MIGRATION.md)
- [使用示例](./EXAMPLES.md)
- [更新日志](../CHANGELOG.md)
