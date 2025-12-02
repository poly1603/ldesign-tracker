# 配置迁移指南

本文档帮助您从其他构建工具迁移到 `@ldesign/builder`。

## 目录

- [从 Rollup 迁移](#从-rollup-迁移)
- [从 Vite 库模式迁移](#从-vite-库模式迁移)
- [从 Webpack 迁移](#从-webpack-迁移)
- [从 tsup 迁移](#从-tsup-迁移)
- [从 unbuild 迁移](#从-unbuild-迁移)
- [配置字段对照表](#配置字段对照表)

---

## 从 Rollup 迁移

### 配置对照

| Rollup 配置 | @ldesign/builder 配置 | 说明 |
|-------------|----------------------|------|
| `input` | `input` | 完全兼容 |
| `output.dir` | `output.esm.dir` | 按格式分别配置 |
| `output.format` | `output.format` | 使用数组形式 |
| `output.name` | `name` 或 `output.umd.name` | UMD 全局变量名 |
| `external` | `external` | 完全兼容 |
| `plugins` | `plugins` | 兼容 Rollup 插件 |
| `treeshake` | `treeshake` | 完全兼容 |

### 迁移示例

**旧 Rollup 配置** (`rollup.config.js`)：

```javascript
import typescript from '@rollup/plugin-typescript'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'

export default {
  input: 'src/index.ts',
  output: [
    { dir: 'dist/esm', format: 'esm' },
    { dir: 'dist/cjs', format: 'cjs' },
    { dir: 'dist/umd', format: 'umd', name: 'MyLib' }
  ],
  external: ['vue'],
  plugins: [
    resolve(),
    commonjs(),
    typescript({ declaration: true })
  ]
}
```

**新 @ldesign/builder 配置** (`builder.config.ts`)：

```typescript
import { defineConfig } from '@ldesign/builder'

export default defineConfig({
  input: 'src/index.ts',
  output: {
    format: ['esm', 'cjs', 'umd'],
    esm: { dir: 'dist/esm' },
    cjs: { dir: 'dist/cjs' },
    umd: { dir: 'dist/umd', name: 'MyLib' }
  },
  external: ['vue'],
  dts: true
  // 无需手动配置 resolve、commonjs、typescript 插件
})
```

### 迁移要点

1. **无需手动配置常用插件**：`@ldesign/builder` 自动处理 TypeScript、Node 模块解析、CommonJS 转换
2. **输出配置更清晰**：按格式分别配置输出目录
3. **类型声明自动生成**：设置 `dts: true` 即可

---

## 从 Vite 库模式迁移

### 配置对照

| Vite 配置 | @ldesign/builder 配置 | 说明 |
|-----------|----------------------|------|
| `build.lib.entry` | `input` | 入口文件 |
| `build.lib.name` | `name` | UMD 全局变量名 |
| `build.lib.formats` | `output.format` | 输出格式 |
| `build.lib.fileName` | 自动生成 | 文件名自动处理 |
| `build.rollupOptions.external` | `external` | 外部依赖 |
| `build.rollupOptions.output.globals` | `globals` | 全局变量映射 |

### 迁移示例

**旧 Vite 配置** (`vite.config.ts`)：

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [vue(), dts()],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'MyVueLib',
      formats: ['es', 'cjs', 'umd']
    },
    rollupOptions: {
      external: ['vue'],
      output: {
        globals: { vue: 'Vue' }
      }
    }
  }
})
```

**新 @ldesign/builder 配置** (`builder.config.ts`)：

```typescript
import { defineConfig, vueLibrary } from '@ldesign/builder'

export default defineConfig(vueLibrary({
  name: 'MyVueLib',
  external: ['vue']
}))

// 或者完整配置
export default defineConfig({
  input: 'src/index.ts',
  name: 'MyVueLib',
  output: { format: ['esm', 'cjs', 'umd'] },
  external: ['vue'],
  globals: { vue: 'Vue' },
  libraryType: 'vue',
  dts: true
})
```

### 迁移要点

1. **使用预设简化配置**：`vueLibrary()` 预设自动配置 Vue 相关选项
2. **无需额外插件**：Vue SFC 编译和类型生成内置支持
3. **格式名称差异**：Vite 使用 `'es'`，@ldesign/builder 使用 `'esm'`

### 迁移要点

1. **无需配置 loader**：TypeScript、Less、Sass 等自动处理
2. **配置大幅简化**：从几十行减少到几行
3. **更好的 Tree-shaking**：基于 Rollup 的更优 Tree-shaking

---

## 从 tsup 迁移

### 配置对照

| tsup 配置 | @ldesign/builder 配置 | 说明 |
|-----------|----------------------|------|
| `entry` | `input` | 入口文件 |
| `outDir` | `output.esm.dir` | 输出目录 |
| `format` | `output.format` | 输出格式 |
| `dts` | `dts` | 类型声明 |
| `splitting` | `splitting` | 代码分割 |
| `sourcemap` | `sourcemap` | Source Map |
| `minify` | `minify` | 压缩 |
| `external` | `external` | 外部依赖 |

### 迁移示例

**旧 tsup 配置** (`tsup.config.ts`)：

```typescript
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  external: ['vue']
})
```

**新 @ldesign/builder 配置** (`builder.config.ts`)：

```typescript
import { defineConfig } from '@ldesign/builder'

export default defineConfig({
  input: 'src/index.ts',
  output: { format: ['esm', 'cjs'] },
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  external: ['vue']
})
```

### 迁移要点

1. **配置几乎相同**：迁移成本极低
2. **更多框架支持**：支持 Vue、React 等框架特定优化
3. **更强大的缓存**：三级缓存系统加速构建

---

## 从 unbuild 迁移

### 配置对照

| unbuild 配置 | @ldesign/builder 配置 | 说明 |
|--------------|----------------------|------|
| `entries` | `input` | 入口文件 |
| `outDir` | `output.esm.dir` | 输出目录 |
| `declaration` | `dts` | 类型声明 |
| `rollup.emitCJS` | `output.format` | CJS 输出 |
| `externals` | `external` | 外部依赖 |

### 迁移示例

**旧 unbuild 配置** (`build.config.ts`)：

```typescript
import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: ['src/index'],
  outDir: 'dist',
  declaration: true,
  rollup: {
    emitCJS: true
  },
  externals: ['vue']
})
```

**新 @ldesign/builder 配置** (`builder.config.ts`)：

```typescript
import { defineConfig } from '@ldesign/builder'

export default defineConfig({
  input: 'src/index.ts',
  output: {
    format: ['esm', 'cjs'],
    esm: { dir: 'dist' },
    cjs: { dir: 'dist' }
  },
  dts: true,
  external: ['vue']
})
```

---

## 配置字段对照表

### 通用字段对照

| 功能 | Rollup | Vite | Webpack | tsup | unbuild | @ldesign/builder |
|------|--------|------|---------|------|---------|------------------|
| 入口 | `input` | `build.lib.entry` | `entry` | `entry` | `entries` | `input` |
| 输出目录 | `output.dir` | `build.outDir` | `output.path` | `outDir` | `outDir` | `output.*.dir` |
| 输出格式 | `output.format` | `build.lib.formats` | `output.libraryTarget` | `format` | - | `output.format` |
| 外部依赖 | `external` | `build.rollupOptions.external` | `externals` | `external` | `externals` | `external` |
| 类型声明 | 插件 | 插件 | 插件 | `dts` | `declaration` | `dts` |
| 压缩 | 插件 | 自动 | 插件 | `minify` | - | `minify` |
| Source Map | `output.sourcemap` | `build.sourcemap` | `devtool` | `sourcemap` | - | `sourcemap` |

### 框架特定配置

| 框架 | @ldesign/builder 配置 |
|------|----------------------|
| Vue 3 | `libraryType: 'vue'` 或 `vueLibrary()` |
| Vue 2 | `libraryType: 'vue2'` |
| React | `libraryType: 'react'` 或 `reactLibrary()` |
| Svelte | `libraryType: 'svelte'` |
| Solid | `libraryType: 'solid'` |
| Lit | `libraryType: 'lit'` |

---

## 迁移检查清单

迁移完成后，请检查以下项目：

- [ ] 入口文件配置正确
- [ ] 输出格式符合需求
- [ ] 外部依赖正确排除
- [ ] 类型声明正常生成
- [ ] 样式文件正确处理
- [ ] 构建产物结构正确
- [ ] package.json exports 字段正确

---

## 常见迁移问题

### 1. 输出文件名不同

**问题**：迁移后输出文件名与之前不同

**解决**：配置 `output.*.fileName`：

```typescript
export default defineConfig({
  output: {
    esm: {
      dir: 'dist',
      fileName: 'index.mjs'
    }
  }
})
```

### 2. 外部依赖被打包

**问题**：某些依赖被打包进 bundle

**解决**：检查 `external` 配置：

```typescript
export default defineConfig({
  external: [
    'vue',
    'react',
    /^@vue\//,  // 使用正则匹配
    /^lodash/
  ]
})
```

### 3. 类型声明缺失

**问题**：`.d.ts` 文件未生成

**解决**：确保 `dts` 配置正确：

```typescript
export default defineConfig({
  dts: true,
  // 或详细配置
  dts: {
    entryOnly: false,
    outputDir: 'types'
  }
})
```

---

## 更多信息

- [使用指南](./USAGE.md)
- [API 参考](./API.md)
- [使用示例](./EXAMPLES.md)

