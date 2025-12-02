# API 参考文档

本文档提供 `@ldesign/builder` 的完整 API 参考。

## 目录

- [核心类](#核心类)
  - [LibraryBuilder](#librarybuilder)
  - [ConfigManager](#configmanager)
  - [PerformanceMonitor](#performancemonitor)
- [配置函数](#配置函数)
  - [defineConfig](#defineconfig)
  - [autoConfig](#autoconfig)
- [预设函数](#预设函数)
- [工具函数](#工具函数)
- [类型定义](#类型定义)

---

## 核心类

### LibraryBuilder

主构建器类，负责执行构建流程。

```typescript
import { LibraryBuilder } from '@ldesign/builder'

const builder = new LibraryBuilder(config)
```

#### 构造函数

```typescript
constructor(config?: BuilderConfig)
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `config` | `BuilderConfig` | 否 | 构建配置对象 |

#### 方法

##### build()

执行构建。

```typescript
async build(config?: BuilderConfig): Promise<BuildResult>
```

**参数**：
- `config`（可选）：覆盖构造函数中的配置

**返回值**：`Promise<BuildResult>` - 构建结果

**示例**：
```typescript
const result = await builder.build()
console.log('输出文件:', result.outputs)
console.log('构建耗时:', result.duration)
```

##### buildWatch()

启动监听模式构建。

```typescript
async buildWatch(config?: BuilderConfig): Promise<Watcher>
```

**返回值**：`Promise<Watcher>` - 文件监听器

**示例**：
```typescript
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

##### setBundler()

切换打包引擎。

```typescript
setBundler(bundler: 'rollup' | 'rolldown' | 'esbuild' | 'swc'): void
```

**参数**：
- `bundler`：打包引擎名称

**示例**：
```typescript
builder.setBundler('rolldown')
await builder.build()
```

##### detectLibraryType()

自动检测项目的库类型。

```typescript
async detectLibraryType(projectPath?: string): Promise<LibraryType>
```

**参数**：
- `projectPath`（可选）：项目路径，默认为当前目录

**返回值**：`Promise<LibraryType>` - 检测到的库类型

**示例**：
```typescript
const type = await builder.detectLibraryType('./my-project')
console.log('检测到的库类型:', type) // 'vue' | 'react' | 'typescript' | ...
```

##### cleanup()

清理构建资源。

```typescript
async cleanup(): Promise<void>
```

**示例**：
```typescript
await builder.cleanup()
```

#### 事件

LibraryBuilder 继承自 EventEmitter，支持以下事件：

| 事件名 | 参数 | 说明 |
|--------|------|------|
| `buildStart` | `config` | 构建开始 |
| `buildEnd` | `result` | 构建完成 |
| `error` | `error` | 构建错误 |
| `warning` | `warning` | 构建警告 |

### PerformanceMonitor

性能监控器，用于跟踪构建性能指标。

```typescript
import { PerformanceMonitor } from '@ldesign/builder'

const monitor = new PerformanceMonitor()
```

#### 方法

##### startSession()

开始监控会话。

```typescript
startSession(name: string): string
```

**返回值**：会话 ID

##### endSession()

结束监控会话并获取指标。

```typescript
endSession(sessionId: string): PerformanceMetrics
```

**返回值**：性能指标对象

```typescript
interface PerformanceMetrics {
  buildTime: number        // 构建时间（毫秒）
  cacheHitRate: number     // 缓存命中率
  parallelization: number  // 并行度
  memoryUsage: number      // 内存使用（字节）
  fileCount: number        // 处理文件数
}
```

**示例**：
```typescript
const sessionId = monitor.startSession('my-build')

// 执行构建...
await builder.build()

const metrics = monitor.endSession(sessionId)
console.log(`构建耗时: ${metrics.buildTime}ms`)
console.log(`缓存命中率: ${(metrics.cacheHitRate * 100).toFixed(1)}%`)
```

---

## 配置函数

### defineConfig

定义构建配置，提供完整的类型提示。

```typescript
import { defineConfig } from '@ldesign/builder'
```

#### 函数签名

```typescript
// 使用预设名称
function defineConfig(preset: PresetName): BuilderConfig

// 使用预设函数
function defineConfig(preset: PresetConfig): BuilderConfig

// 使用配置对象
function defineConfig(config: BuilderConfig): BuilderConfig

// 预设 + 覆盖
function defineConfig(preset: PresetName, overrides: Partial<BuilderConfig>): BuilderConfig
```

#### 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `preset` | `PresetName \| PresetConfig` | 预设名称或预设配置 |
| `config` | `BuilderConfig` | 完整配置对象 |
| `overrides` | `Partial<BuilderConfig>` | 覆盖配置 |

#### 预设名称

| 名称 | 说明 |
|------|------|
| `'node-library'` | Node.js 库 |
| `'web-library'` | Web 库 |
| `'universal-library'` | 通用库 |
| `'vue-library'` | Vue 组件库 |
| `'react-library'` | React 组件库 |
| `'cli-tool'` | CLI 工具 |
| `'monorepo-package'` | Monorepo 子包 |

#### 示例

```typescript
// 方式 1：预设名称
export default defineConfig('vue-library')

// 方式 2：预设 + 覆盖
export default defineConfig('vue-library', {
  minify: true,
  external: ['vue', 'vue-router']
})

// 方式 3：完整配置
export default defineConfig({
  input: 'src/index.ts',
  output: {
    format: ['esm', 'cjs'],
    esm: { dir: 'es' },
    cjs: { dir: 'lib' }
  },
  dts: true
})
```

---

### autoConfig

零配置自动生成构建配置。

```typescript
import { autoConfig } from '@ldesign/builder'
```

#### 函数签名

```typescript
async function autoConfig(projectPath?: string): Promise<BuilderConfig>
```

#### 参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `projectPath` | `string` | `process.cwd()` | 项目路径 |

#### 返回值

`Promise<BuilderConfig>` - 自动生成的配置

#### 示例

```typescript
const config = await autoConfig()
const builder = new LibraryBuilder(config)
await builder.build()
```

---

## 预设函数

### nodeLibrary

Node.js 库预设。

```typescript
import { nodeLibrary } from '@ldesign/builder'

export default defineConfig(nodeLibrary({
  name: 'my-node-lib'
}))
```

#### 参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `name` | `string` | 从 package.json 推断 | 库名称 |
| `minify` | `boolean` | `false` | 是否压缩 |

#### 默认配置

- 输出格式：ESM + CJS
- 目标平台：Node.js
- 不压缩
- 生成类型声明

---

### webLibrary

Web 库预设。

```typescript
import { webLibrary } from '@ldesign/builder'

export default defineConfig(webLibrary({
  name: 'MyWebLib'
}))
```

#### 参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `name` | `string` | 必填 | UMD 全局变量名 |
| `minify` | `boolean` | `true` | 是否压缩 UMD |

#### 默认配置

- 输出格式：ESM + UMD
- 目标平台：浏览器
- UMD 压缩
- 生成类型声明

---

### universalLibrary

通用库预设（同时支持 Node.js 和浏览器）。

```typescript
import { universalLibrary } from '@ldesign/builder'

export default defineConfig(universalLibrary({
  name: 'MyLib'
}))
```

#### 默认配置

- 输出格式：ESM + CJS + UMD
- 目标平台：通用
- UMD 压缩
- 生成类型声明

---

### vueLibrary

Vue 组件库预设。

```typescript
import { vueLibrary } from '@ldesign/builder'

export default defineConfig(vueLibrary({
  name: 'MyVueLib',
  external: ['vue']
}))
```

#### 参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `name` | `string` | 必填 | 库名称 |
| `external` | `string[]` | `['vue']` | 外部依赖 |

#### 默认配置

- 库类型：Vue
- 输出格式：ESM + CJS + UMD
- Vue 作为外部依赖
- 支持 SFC 编译

---

### reactLibrary

React 组件库预设。

```typescript
import { reactLibrary } from '@ldesign/builder'

export default defineConfig(reactLibrary({
  name: 'MyReactLib'
}))
```

#### 参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `name` | `string` | 必填 | 库名称 |
| `external` | `string[]` | `['react', 'react-dom']` | 外部依赖 |

---

### cliTool

CLI 工具预设。

```typescript
import { cliTool } from '@ldesign/builder'

export default defineConfig(cliTool({
  name: 'my-cli',
  input: 'src/cli.ts'
}))
```

#### 参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `name` | `string` | 必填 | CLI 名称 |
| `input` | `string` | `'src/cli.ts'` | 入口文件 |

#### 默认配置

- 输出格式：CJS
- 压缩
- 不生成类型声明
- 添加 shebang

---

### monorepoPackage

Monorepo 子包预设。

```typescript
import { monorepoPackage } from '@ldesign/builder'

export default defineConfig(monorepoPackage({
  name: '@myorg/utils',
  external: [/^@myorg\//]
}))
```

#### 参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `name` | `string` | 必填 | 包名称 |
| `external` | `(string \| RegExp)[]` | `[]` | 外部依赖 |

---

## 工具函数

### getPresetConfig

获取预设配置。

```typescript
import { getPresetConfig } from '@ldesign/builder'

const config = getPresetConfig('vue-library')
```

### isValidPreset

验证预设名称是否有效。

```typescript
import { isValidPreset } from '@ldesign/builder'

if (isValidPreset('my-preset')) {
  // 有效的预设
}
```

### normalizeConfig

规范化配置对象。

```typescript
import { normalizeConfig } from '@ldesign/builder'

const normalized = normalizeConfig(rawConfig)
```

---

## 类型定义

### BuilderConfig

主配置接口。

```typescript
interface BuilderConfig {
  /** 库名称 */
  name?: string

  /** 入口文件 */
  input?: string | string[] | Record<string, string>

  /** 输出配置 */
  output?: OutputConfig

  /** 库类型 */
  libraryType?: LibraryType

  /** 打包引擎 */
  bundler?: 'rollup' | 'rolldown' | 'esbuild' | 'swc'

  /** 构建模式 */
  mode?: 'development' | 'production'

  /** 外部依赖 */
  external?: (string | RegExp)[]

  /** UMD 全局变量 */
  globals?: Record<string, string>

  /** 是否生成类型声明 */
  dts?: boolean | DtsConfig

  /** Source Map 配置 */
  sourcemap?: boolean | 'inline' | 'hidden'

  /** 压缩配置 */
  minify?: boolean | MinifyConfig

  /** 构建前清理 */
  clean?: boolean

  /** TypeScript 配置 */
  typescript?: TypeScriptConfig

  /** Vue 配置 */
  vue?: VueConfig

  /** React 配置 */
  react?: ReactConfig

  /** 插件列表 */
  plugins?: Plugin[]

  /** 排除文件 */
  exclude?: string[]

  /** 目标平台 */
  platform?: 'node' | 'browser' | 'neutral'

  /** 缓存配置 */
  cache?: CacheConfig

  /** 并行构建配置 */
  parallel?: ParallelConfig

  /** package.json 更新配置 */
  packageUpdate?: PackageUpdateConfig
}
```

### OutputConfig

输出配置接口。

```typescript
interface OutputConfig {
  /** 输出格式 */
  format?: ('esm' | 'cjs' | 'umd')[]

  /** ESM 输出配置 */
  esm?: {
    dir?: string
    preserveStructure?: boolean
  }

  /** CJS 输出配置 */
  cjs?: {
    dir?: string
    preserveStructure?: boolean
  }

  /** UMD 输出配置 */
  umd?: {
    dir?: string
    name?: string
    minify?: boolean
  }
}
```

### LibraryType

库类型枚举。

```typescript
type LibraryType =
  | 'typescript'
  | 'vue'
  | 'vue2'
  | 'react'
  | 'svelte'
  | 'solid'
  | 'preact'
  | 'lit'
  | 'angular'
  | 'qwik'
  | 'mixed'
```

### BuildResult

构建结果接口。

```typescript
interface BuildResult {
  /** 是否成功 */
  success: boolean

  /** 输出文件列表 */
  outputs: OutputFile[]

  /** 构建耗时（毫秒） */
  duration: number

  /** 警告信息 */
  warnings: string[]

  /** 错误信息（如果失败） */
  errors?: string[]
}

interface OutputFile {
  /** 文件路径 */
  path: string

  /** 文件大小（字节） */
  size: number

  /** 输出格式 */
  format: 'esm' | 'cjs' | 'umd'
}
```

---

## 更多信息

- [使用指南](./USAGE.md)
- [配置迁移](./MIGRATION.md)
- [使用示例](./EXAMPLES.md)
- [更新日志](../CHANGELOG.md)
