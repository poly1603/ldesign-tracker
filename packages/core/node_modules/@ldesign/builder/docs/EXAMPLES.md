# 使用示例

本文档提供 `@ldesign/builder` 的各种实际使用示例。

## 目录

- [基础示例](#基础示例)
- [Vue 组件库](#vue-组件库)
- [React 组件库](#react-组件库)
- [Node.js 工具库](#nodejs-工具库)
- [CLI 工具](#cli-工具)
- [Monorepo 项目](#monorepo-项目)
- [混合框架项目](#混合框架项目)
- [高级配置](#高级配置)

---

## 基础示例

### 最简配置

```typescript
// builder.config.ts
import { defineConfig } from '@ldesign/builder'

export default defineConfig({
  input: 'src/index.ts'
})
```

### 使用预设

```typescript
// builder.config.ts
import { defineConfig } from '@ldesign/builder'

// 直接使用预设名称
export default defineConfig('universal-library')
```

### 多格式输出

```typescript
// builder.config.ts
import { defineConfig } from '@ldesign/builder'

export default defineConfig({
  input: 'src/index.ts',
  output: {
    format: ['esm', 'cjs', 'umd'],
    esm: { dir: 'es' },
    cjs: { dir: 'lib' },
    umd: {
      dir: 'dist',
      name: 'MyLib',
      minify: true
    }
  }
})
```

---

## Vue 组件库

### Vue 3 组件库

```typescript
// builder.config.ts
import { defineConfig, vueLibrary } from '@ldesign/builder'

export default defineConfig(vueLibrary({
  name: 'MyVueComponents'
}))
```

### Vue 3 组件库（完整配置）

```typescript
// builder.config.ts
import { defineConfig } from '@ldesign/builder'

export default defineConfig({
  input: 'src/index.ts',
  output: {
    format: ['esm', 'cjs', 'umd'],
    esm: {
      dir: 'es',
      preserveStructure: true
    },
    cjs: {
      dir: 'lib',
      preserveStructure: true
    },
    umd: {
      dir: 'dist',
      name: 'MyVueComponents',
      minify: true
    }
  },
  external: ['vue', 'vue-router', 'pinia'],
  globals: {
    vue: 'Vue',
    'vue-router': 'VueRouter',
    pinia: 'Pinia'
  },
  libraryType: 'vue',
  vue: {
    version: 3,
    sfc: {
      enabled: true,
      style: {
        preprocessor: 'less'
      }
    }
  },
  dts: true,
  sourcemap: true
})
```

### Vue 2 组件库

```typescript
// builder.config.ts
import { defineConfig } from '@ldesign/builder'

export default defineConfig({
  input: 'src/index.ts',
  output: { format: ['esm', 'cjs'] },
  external: ['vue'],
  libraryType: 'vue2',
  vue: {
    version: 2,
    sfc: { enabled: true }
  }
})
```

### 多入口 Vue 组件库

```typescript
// builder.config.ts
import { defineConfig } from '@ldesign/builder'

export default defineConfig({
  input: {
    index: 'src/index.ts',

### React 组件库（完整配置）

```typescript
// builder.config.ts
import { defineConfig } from '@ldesign/builder'

export default defineConfig({
  input: 'src/index.tsx',
  output: {
    format: ['esm', 'cjs'],
    esm: { dir: 'es' },
    cjs: { dir: 'lib' }
  },
  external: ['react', 'react-dom'],
  globals: {
    react: 'React',
    'react-dom': 'ReactDOM'
  },
  libraryType: 'react',
  react: {
    jsx: 'automatic',
    runtime: 'automatic'
  },
  dts: true,
  sourcemap: true
})
```

### React + TypeScript + CSS Modules

```typescript
// builder.config.ts
import { defineConfig } from '@ldesign/builder'

export default defineConfig({
  input: 'src/index.tsx',
  output: { format: ['esm', 'cjs'] },
  external: ['react', 'react-dom'],
  libraryType: 'react',
  style: {
    extract: true,
    modules: {
      generateScopedName: '[name]__[local]__[hash:base64:5]'
    }
  }
})
```

---

## Node.js 工具库

### 基础 Node.js 库

```typescript
// builder.config.ts
import { defineConfig, nodeLibrary } from '@ldesign/builder'

export default defineConfig(nodeLibrary({
  name: 'my-node-utils'
}))
```

### Node.js 库（完整配置）

```typescript
// builder.config.ts
import { defineConfig } from '@ldesign/builder'

export default defineConfig({
  input: 'src/index.ts',
  output: {
    format: ['esm', 'cjs'],
    esm: { dir: 'es' },
    cjs: { dir: 'lib' }
  },
  platform: 'node',
  // Node.js 内置模块自动排除
  external: [
    'fs', 'path', 'os', 'crypto', 'http', 'https',
    'stream', 'util', 'events', 'child_process'
  ],
  dts: true,
  // 不压缩 Node.js 库
  minify: false
})
```

### 带 CLI 的 Node.js 库

```typescript
// builder.config.ts
import { defineConfig } from '@ldesign/builder'

export default defineConfig({
  input: {
    index: 'src/index.ts',
    cli: 'src/cli.ts'
  },
  output: {
    format: ['esm', 'cjs'],
    esm: { dir: 'es' },
    cjs: { dir: 'lib' }
  },
  platform: 'node',
  dts: true
})
```

---

## CLI 工具

### 基础 CLI 工具

```typescript
// builder.config.ts
import { defineConfig, cliTool } from '@ldesign/builder'

export default defineConfig(cliTool({
  name: 'my-cli',
  input: 'src/cli.ts'
}))
```

### CLI 工具（完整配置）

```typescript
// builder.config.ts
import { defineConfig } from '@ldesign/builder'

export default defineConfig({
  input: 'src/cli.ts',
  output: {
    format: ['cjs'],
    cjs: {
      dir: 'dist',
      // 添加 shebang
      banner: '#!/usr/bin/env node'
    }
  },
  platform: 'node',
  // CLI 工具通常需要压缩
  minify: true,
  // 不需要类型声明
  dts: false,
  // 打包所有依赖（单文件分发）
  external: []
})
```

---

## Monorepo 项目

### 基础 Monorepo 包

```typescript
// packages/utils/builder.config.ts
import { defineConfig, monorepoPackage } from '@ldesign/builder'

export default defineConfig(monorepoPackage({
  name: '@myorg/utils'
}))
```

### Monorepo 包（排除内部依赖）

```typescript
// packages/components/builder.config.ts
import { defineConfig } from '@ldesign/builder'

export default defineConfig({
  input: 'src/index.ts',
  output: {
    format: ['esm', 'cjs'],
    esm: { dir: 'es' },
    cjs: { dir: 'lib' }
  },
  // 排除所有 @myorg 开头的包
  external: [
    /^@myorg\//,
    'vue'
  ],
  dts: true,
  // 自动更新 package.json
  packageUpdate: {
    enabled: true,
    autoExports: true,
    exports: {
      '.': {
        import: './es/index.js',
        require: './lib/index.js',
        types: './types/index.d.ts'
      }
    }
  }
})
```

### 共享配置的 Monorepo

```typescript
// build.config.base.ts（根目录）
import { defineConfig } from '@ldesign/builder'

export const baseConfig = {
  output: {
    format: ['esm', 'cjs'] as const,
    esm: { dir: 'es' },
    cjs: { dir: 'lib' }
  },
  dts: true,
  sourcemap: true
}

// packages/utils/builder.config.ts
import { defineConfig } from '@ldesign/builder'
import { baseConfig } from '../../build.config.base'

export default defineConfig({
  ...baseConfig,
  input: 'src/index.ts',
  external: [/^@myorg\//]
})
```

---

## 混合框架项目

### Vue + React 混合

```typescript
// builder.config.ts
import { defineConfig } from '@ldesign/builder'

export default defineConfig({
  input: {
    'vue/index': 'src/vue/index.ts',
    'react/index': 'src/react/index.tsx'
  },
  output: {
    format: ['esm', 'cjs'],
    esm: {
      dir: 'es',
      preserveStructure: true
    },
    cjs: {
      dir: 'lib',
      preserveStructure: true
    }
  },
  libraryType: 'mixed',
  mixedFramework: {
    mode: 'separated',
    frameworks: {
      vue: true,
      react: true
    },
    jsx: {
      autoDetect: true
    }
  },
  external: ['vue', 'react', 'react-dom']
})
```

---

## 高级配置

### 自定义插件

```typescript
// builder.config.ts
import { defineConfig } from '@ldesign/builder'
import type { Plugin } from 'rollup'

// 自定义 Rollup 插件
function myPlugin(): Plugin {
  return {
    name: 'my-plugin',
    transform(code, id) {
      if (id.endsWith('.txt')) {
        return `export default ${JSON.stringify(code)}`
      }
    }
  }
}

export default defineConfig({
  input: 'src/index.ts',
  output: { format: ['esm', 'cjs'] },
  plugins: [myPlugin()]
})
```

### 条件导出配置

```typescript
// builder.config.ts
import { defineConfig } from '@ldesign/builder'

export default defineConfig({
  input: 'src/index.ts',
  output: { format: ['esm', 'cjs'] },
  packageUpdate: {
    enabled: true,
    exports: {
      '.': {
        import: {
          types: './types/index.d.ts',
          default: './es/index.js'
        },
        require: {
          types: './types/index.d.ts',
          default: './lib/index.js'
        }
      },
      './utils': {
        import: './es/utils/index.js',
        require: './lib/utils/index.js'
      },
      './styles/*': './styles/*'
    }
  }
})
```

### 性能优化配置

```typescript
// builder.config.ts
import { defineConfig } from '@ldesign/builder'

export default defineConfig({
  input: 'src/index.ts',
  output: { format: ['esm', 'cjs'] },
  // 启用缓存
  cache: {
    enabled: true,
    cacheDir: '.ldesign/cache',
    strategy: 'lru',
    maxSize: 100 * 1024 * 1024 // 100MB
  },
  // 并行构建
  parallel: {
    enabled: true,
    workers: 4
  },
  // 使用更快的打包引擎
  bundler: 'rolldown'
})
```

### 样式处理配置

```typescript
// builder.config.ts
import { defineConfig } from '@ldesign/builder'

export default defineConfig({
  input: 'src/index.ts',
  output: { format: ['esm', 'cjs'] },
  style: {
    // 提取 CSS 到单独文件
    extract: true,
    // 使用 Less 预处理器
    preprocessor: 'less',
    // Less 配置
    less: {
      javascriptEnabled: true,
      modifyVars: {
        '@primary-color': '#1890ff'
      }
    },
    // PostCSS 配置
    postcss: {
      plugins: ['autoprefixer', 'cssnano']
    },
    // CSS Modules
    modules: {
      generateScopedName: '[name]__[local]__[hash:base64:5]'
    }
  }
})
```

### 环境变量配置

```typescript
// builder.config.ts
import { defineConfig } from '@ldesign/builder'

export default defineConfig({
  input: 'src/index.ts',
  output: { format: ['esm', 'cjs'] },
  define: {
    __VERSION__: JSON.stringify(process.env.npm_package_version),
    __DEV__: process.env.NODE_ENV !== 'production',
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV)
  }
})
```

---

## 更多信息

- [使用指南](./USAGE.md)
- [API 参考](./API.md)
- [配置迁移](./MIGRATION.md)
  name: 'MyReactComponents'
}))
```

