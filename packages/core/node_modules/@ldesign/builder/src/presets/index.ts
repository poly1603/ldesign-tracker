/**
 * 配置预设系统
 * 
 * 提供开箱即用的配置预设,大幅简化用户配置
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import type { BuilderConfig } from '../types/config'
import { LibraryType } from '../types/library'

/**
 * 预设配置类型
 */
export type PresetName =
  | 'typescript'
  | 'react'
  | 'vue3'
  | 'vue2'
  | 'svelte'
  | 'solid'
  | 'preact'
  | 'lit'
  | 'angular'
  | 'qwik'
  | 'style'
  | 'mixed'
  | 'node'
  | 'cli'

/**
 * 预设配置接口
 */
export interface Preset {
  /** 预设名称 */
  name: PresetName
  /** 预设描述 */
  description: string
  /** 预设配置 */
  config: Partial<BuilderConfig>
  /** 推荐的外部依赖 */
  recommendedExternal?: string[]
  /** 推荐的全局变量映射 */
  recommendedGlobals?: Record<string, string>
}

/**
 * TypeScript 库预设
 */
export const typescriptPreset: Preset = {
  name: 'typescript',
  description: 'TypeScript 库开发预设',
  config: {
    libraryType: LibraryType.TYPESCRIPT,
    output: {
      format: ['esm', 'cjs'],
      sourcemap: true
    },
    typescript: {
      declaration: true,
      isolatedDeclarations: false
    },
    performance: {
      treeshaking: true,
      minify: true
    }
  }
}

/**
 * React 组件库预设
 */
export const reactPreset: Preset = {
  name: 'react',
  description: 'React 组件库开发预设',
  config: {
    libraryType: LibraryType.REACT,
    output: {
      format: ['esm', 'cjs', 'umd'],
      sourcemap: true
    },
    typescript: {
      declaration: true
    },
    performance: {
      treeshaking: true,
      minify: true
    }
  },
  recommendedExternal: ['react', 'react-dom'],
  recommendedGlobals: {
    'react': 'React',
    'react-dom': 'ReactDOM'
  }
}

/**
 * Vue 3 组件库预设
 */
export const vue3Preset: Preset = {
  name: 'vue3',
  description: 'Vue 3 组件库开发预设',
  config: {
    libraryType: LibraryType.VUE3,
    output: {
      format: ['esm', 'cjs', 'umd'],
      sourcemap: true
    },
    vue: {
      version: 3,
      onDemand: true
    },
    typescript: {
      declaration: true
    },
    performance: {
      treeshaking: true,
      minify: true
    }
  },
  recommendedExternal: ['vue'],
  recommendedGlobals: {
    'vue': 'Vue'
  }
}

/**
 * Vue 2 组件库预设
 */
export const vue2Preset: Preset = {
  name: 'vue2',
  description: 'Vue 2 组件库开发预设',
  config: {
    libraryType: LibraryType.VUE2,
    output: {
      format: ['esm', 'cjs', 'umd'],
      sourcemap: true
    },
    vue: {
      version: 2,
      onDemand: true
    },
    typescript: {
      declaration: true
    },
    performance: {
      treeshaking: true,
      minify: true
    }
  },
  recommendedExternal: ['vue'],
  recommendedGlobals: {
    'vue': 'Vue'
  }
}

/**
 * Svelte 组件库预设
 */
export const sveltePreset: Preset = {
  name: 'svelte',
  description: 'Svelte 组件库开发预设',
  config: {
    libraryType: LibraryType.SVELTE,
    output: {
      format: ['esm', 'cjs'],
      sourcemap: true
    },
    typescript: {
      declaration: true
    },
    performance: {
      treeshaking: true,
      minify: true
    }
  },
  recommendedExternal: ['svelte', 'svelte/internal']
}

/**
 * Solid.js 组件库预设
 */
export const solidPreset: Preset = {
  name: 'solid',
  description: 'Solid.js 组件库开发预设',
  config: {
    libraryType: LibraryType.SOLID,
    output: {
      format: ['esm', 'cjs'],
      sourcemap: true
    },
    typescript: {
      declaration: true
    },
    performance: {
      treeshaking: true,
      minify: true
    }
  },
  recommendedExternal: ['solid-js', 'solid-js/web']
}

/**
 * Preact 组件库预设
 */
export const preactPreset: Preset = {
  name: 'preact',
  description: 'Preact 组件库开发预设',
  config: {
    libraryType: LibraryType.PREACT,
    output: {
      format: ['esm', 'cjs', 'umd'],
      sourcemap: true
    },
    typescript: {
      declaration: true
    },
    performance: {
      treeshaking: true,
      minify: true
    }
  },
  recommendedExternal: ['preact', 'preact/hooks'],
  recommendedGlobals: {
    'preact': 'preact',
    'preact/hooks': 'preactHooks'
  }
}

/**
 * Lit 组件库预设
 */
export const litPreset: Preset = {
  name: 'lit',
  description: 'Lit Web Components 开发预设',
  config: {
    libraryType: LibraryType.LIT,
    output: {
      format: ['esm', 'cjs'],
      sourcemap: true
    },
    typescript: {
      declaration: true
    },
    performance: {
      treeshaking: true,
      minify: true
    }
  },
  recommendedExternal: ['lit']
}

/**
 * Angular 库预设
 */
export const angularPreset: Preset = {
  name: 'angular',
  description: 'Angular 库开发预设',
  config: {
    libraryType: LibraryType.ANGULAR,
    output: {
      format: ['esm', 'cjs'],
      sourcemap: true
    },
    typescript: {
      declaration: true
    },
    performance: {
      treeshaking: true,
      minify: false
    }
  },
  recommendedExternal: ['@angular/core', '@angular/common']
}

/**
 * Qwik 组件库预设
 */
export const qwikPreset: Preset = {
  name: 'qwik',
  description: 'Qwik 组件库开发预设',
  config: {
    libraryType: LibraryType.QWIK as any,
    output: {
      format: ['esm'],
      sourcemap: true
    },
    typescript: {
      declaration: true
    },
    performance: {
      treeshaking: true,
      minify: true
    }
  },
  recommendedExternal: ['@builder.io/qwik']
}

/**
 * 样式库预设
 */
export const stylePreset: Preset = {
  name: 'style',
  description: '样式库开发预设',
  config: {
    libraryType: LibraryType.STYLE,
    output: {
      format: ['esm'],
      sourcemap: true
    },
    style: {
      extract: true,
      minimize: true,
      autoprefixer: true
    },
    performance: {
      treeshaking: false,
      minify: true
    }
  }
}

/**
 * 混合库预设
 */
export const mixedPreset: Preset = {
  name: 'mixed',
  description: '混合库开发预设 (TypeScript + 样式)',
  config: {
    libraryType: LibraryType.MIXED,
    output: {
      format: ['esm', 'cjs'],
      sourcemap: true
    },
    typescript: {
      declaration: true
    },
    style: {
      extract: true,
      minimize: true
    },
    performance: {
      treeshaking: true,
      minify: true
    }
  }
}

/**
 * Node.js 库预设
 */
export const nodePreset: Preset = {
  name: 'node',
  description: 'Node.js 库开发预设',
  config: {
    libraryType: LibraryType.TYPESCRIPT,
    output: {
      format: ['esm', 'cjs'],
      sourcemap: true
    },
    typescript: {
      declaration: true
    },
    performance: {
      treeshaking: true,
      minify: false
    }
  },
  recommendedExternal: ['fs', 'path', 'url', 'util', 'events', 'stream', 'crypto', 'os', 'http', 'https']
}

/**
 * CLI 工具预设
 */
export const cliPreset: Preset = {
  name: 'cli',
  description: 'CLI 工具开发预设',
  config: {
    libraryType: LibraryType.TYPESCRIPT,
    output: {
      format: ['cjs'],
      sourcemap: false
    },
    typescript: {
      declaration: false
    },
    performance: {
      treeshaking: true,
      minify: true
    }
  },
  recommendedExternal: ['fs', 'path', 'url', 'util', 'events', 'stream', 'crypto', 'os', 'http', 'https']
}

/**
 * 所有预设配置
 */
export const presets: Record<PresetName, Preset> = {
  typescript: typescriptPreset,
  react: reactPreset,
  vue3: vue3Preset,
  vue2: vue2Preset,
  svelte: sveltePreset,
  solid: solidPreset,
  preact: preactPreset,
  lit: litPreset,
  angular: angularPreset,
  qwik: qwikPreset,
  style: stylePreset,
  mixed: mixedPreset,
  node: nodePreset,
  cli: cliPreset
}

/**
 * 获取预设配置
 */
export function getPreset(name: PresetName): Preset {
  const preset = presets[name]
  if (!preset) {
    throw new Error(`Unknown preset: ${name}. Available presets: ${Object.keys(presets).join(', ')}`)
  }
  return preset
}

/**
 * 应用预设配置
 */
export function applyPreset(name: PresetName, userConfig: Partial<BuilderConfig> = {}): BuilderConfig {
  const preset = getPreset(name)

  // 合并预设配置和用户配置
  const config: BuilderConfig = {
    ...preset.config,
    ...userConfig,
    // 深度合并某些配置
    output: {
      ...preset.config.output,
      ...userConfig.output
    },
    typescript: {
      ...preset.config.typescript,
      ...userConfig.typescript
    },
    performance: {
      ...preset.config.performance,
      ...userConfig.performance
    }
  }

  // 应用推荐的外部依赖
  if (preset.recommendedExternal && !userConfig.external) {
    config.external = preset.recommendedExternal
  }

  // 应用推荐的全局变量映射
  if (preset.recommendedGlobals && !userConfig.globals) {
    config.globals = preset.recommendedGlobals
  }

  return config
}

/**
 * 列出所有可用的预设
 */
export function listPresets(): Array<{ name: PresetName; description: string }> {
  return Object.values(presets).map(preset => ({
    name: preset.name,
    description: preset.description
  }))
}

/**
 * 检查预设是否存在
 */
export function hasPreset(name: string): name is PresetName {
  return name in presets
}

// 导出新的库类型预设
export {
  nodeLibrary,
  webLibrary,
  universalLibrary,
  cliTool,
  getPresetConfig,
  isValidPreset,
  LIBRARY_PRESETS,
  type PresetName as LibraryPresetName,
} from './library-presets'
