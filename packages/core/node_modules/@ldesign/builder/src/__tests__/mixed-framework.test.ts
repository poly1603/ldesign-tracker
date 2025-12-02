/**
 * 混合框架功能测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import path from 'path'
import fs from 'fs-extra'
import { fileURLToPath } from 'url'
import { FrameworkDetector } from '../detectors/FrameworkDetector'
import { DualJSXTransformer } from '../transformers/DualJSXTransformer'
import { PluginOrchestrator } from '../optimizers/plugin-orchestrator/PluginOrchestrator'
import { MixedFrameworkStrategy } from '../strategies/mixed/MixedFrameworkStrategy'
import type { FrameworkInfo } from '../detectors/FrameworkDetector'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(__dirname, 'fixtures', 'mixed-framework')

describe('FrameworkDetector', () => {
  let detector: FrameworkDetector

  beforeEach(() => {
    detector = new FrameworkDetector({
      enableContentDetection: true,
      enableImportDetection: true,
      enablePragmaDetection: true
    })
  })

  afterEach(() => {
    detector.clearCache()
  })

  it('应该检测 .vue 文件', async () => {
    const result = await detector.detect('Component.vue')
    expect(result.type).toBe('vue')
    expect(result.confidence).toBeGreaterThan(0.9)
  })

  it('应该通过文件命名检测框架', async () => {
    const vueResult = await detector.detect('Button.vue.tsx')
    expect(vueResult.type).toBe('vue')
    expect(vueResult.jsx).toBe('vue-jsx')

    const reactResult = await detector.detect('Button.react.tsx')
    expect(reactResult.type).toBe('react')
    expect(reactResult.jsx).toBe('react-jsx')
  })

  it('应该通过导入语句检测框架', () => {
    const vueCode = `
      import { defineComponent, ref } from 'vue'
      import { useRouter } from 'vue-router'
    `
    const vueResult = detector.detectFromImports(vueCode)
    expect(vueResult.type).toBe('vue')

    const reactCode = `
      import React, { useState } from 'react'
      import { useNavigate } from 'react-router-dom'
    `
    const reactResult = detector.detectFromImports(reactCode)
    expect(reactResult.type).toBe('react')
  })

  it('应该通过 JSX pragma 检测框架', () => {
    const vuePragma = `
      /** @jsx h */
      import { h } from 'vue'
    `
    const vueResult = detector.detectFromPragma(vuePragma)
    expect(vueResult.type).toBe('vue')
    expect(vueResult.pragma).toBe('h')

    const reactPragma = `
      /** @jsxImportSource react */
    `
    const reactResult = detector.detectFromPragma(reactPragma)
    expect(reactResult.type).toBe('react')
  })

  it('应该通过代码特征检测框架', () => {
    const vueCode = `
      export default defineComponent({
        name: 'MyComponent',
        setup() {
          const count = ref(0)
          const doubled = computed(() => count.value * 2)
          onMounted(() => {
            console.log('mounted')
          })
          return { count, doubled }
        }
      })
    `
    const vueResult = detector.detectFromContent(vueCode, 'component.ts')
    expect(vueResult.type).toBe('vue')

    const reactCode = `
      function MyComponent() {
        const [count, setCount] = useState(0)
        useEffect(() => {
          console.log('mounted')
        }, [])
        return <div>{count}</div>
      }
    `
    const reactResult = detector.detectFromContent(reactCode, 'component.tsx')
    expect(reactResult.type).toBe('react')
  })

  it('应该支持批量检测', async () => {
    const files = [
      'Component.vue',
      'Button.vue.tsx',
      'Card.react.tsx',
      'utils.ts'
    ]

    const results = await detector.detectBatch(files)

    expect(results.get('Component.vue')?.type).toBe('vue')
    expect(results.get('Button.vue.tsx')?.type).toBe('vue')
    expect(results.get('Card.react.tsx')?.type).toBe('react')
    expect(results.get('utils.ts')?.type).toBe('unknown')
  })
})

describe('DualJSXTransformer', () => {
  let transformer: DualJSXTransformer

  beforeEach(() => {
    transformer = new DualJSXTransformer()
  })

  it('应该转换 Vue JSX', async () => {
    const vueCode = `
      const Button = () => {
        return <button class="btn">Click me</button>
      }
    `

    const result = await transformer.transform(vueCode, 'vue')

    expect(result.code).toBeDefined()
    expect(result.metadata?.framework).toBe('vue')
    // Vue JSX 应该转换 class 属性
    expect(result.code).toContain('h("button"')
  })

  it('应该转换 React JSX', async () => {
    const reactCode = `
      const Button = () => {
        return <button className="btn">Click me</button>
      }
    `

    const result = await transformer.transform(reactCode, 'react')

    expect(result.code).toBeDefined()
    expect(result.metadata?.framework).toBe('react')
    // React JSX 保留 className
    expect(result.code).toMatch(/createElement|jsx/)
  })

  it('应该自动检测并转换', async () => {
    const vueCode = `
      import { defineComponent } from 'vue'
      export default defineComponent({
        render() {
          return <div>Vue Component</div>
        }
      })
    `

    const result = await transformer.autoTransform(vueCode, 'Component.vue.tsx')
    expect(result.metadata?.framework).toBe('vue')
  })

  it('应该支持自定义配置', async () => {
    transformer.updateConfig('vue', {
      pragma: 'createElement',
      optimize: false
    })

    const config = transformer.getVueConfig()
    expect(config.pragma).toBe('createElement')
    expect(config.optimize).toBe(false)
  })

  it('应该创建条件转换器', () => {
    const conditionalTransformer = transformer.createConditionalTransformer(
      (code, filePath) => filePath.includes('.vue.'),
      'vue'
    )

    expect(conditionalTransformer.name).toBe('conditional-jsx-vue')
    expect(conditionalTransformer.enforce).toBe('pre')
  })
})

describe('PluginOrchestrator', () => {
  let orchestrator: PluginOrchestrator

  beforeEach(() => {
    orchestrator = new PluginOrchestrator({
      autoResolveConflicts: true,
      strict: false
    })
  })

  afterEach(() => {
    orchestrator.cleanup()
  })

  it('应该注册和编排插件', () => {
    const vuePlugin = {
      name: '@vitejs/plugin-vue',
      transform: vi.fn()
    }

    const reactPlugin = {
      name: '@vitejs/plugin-react',
      transform: vi.fn()
    }

    orchestrator.registerPlugin(vuePlugin, {
      name: vuePlugin.name,
      frameworks: ['vue'],
      priority: 80
    })

    orchestrator.registerPlugin(reactPlugin, {
      name: reactPlugin.name,
      frameworks: ['react'],
      priority: 80
    })

    const vuePlugins = orchestrator.orchestrate(
      [vuePlugin, reactPlugin],
      'Component.vue',
      { type: 'vue', confidence: 1 }
    )

    // 应该只包含 Vue 插件
    expect(vuePlugins).toHaveLength(1)
    expect(vuePlugins[0].name).toContain('vue')
  })

  it('应该解决插件冲突', () => {
    const plugin1 = {
      name: 'plugin-1',
      __meta: {
        name: 'plugin-1',
        conflicts: ['plugin-2'],
        priority: 100
      }
    }

    const plugin2 = {
      name: 'plugin-2',
      __meta: {
        name: 'plugin-2',
        priority: 50
      }
    }

    const resolved = orchestrator['resolveConflicts'](
      [plugin1, plugin2] as any,
      { type: 'vue', confidence: 1 }
    )

    // 应该保留优先级更高的 plugin-1
    expect(resolved).toHaveLength(1)
    expect(resolved[0].name).toBe('plugin-1')
  })

  it('应该创建条件插件', () => {
    const originalPlugin = {
      name: 'test-plugin',
      transform(code: string, id: string) {
        return { code: code.toUpperCase() }
      }
    }

    const conditionalPlugin = orchestrator.createConditionalPlugin(
      originalPlugin,
      (id: string) => id.includes('.vue')
    )

    expect(conditionalPlugin.name).toBe('conditional-test-plugin')

    // 测试条件逻辑
    const vueResult = conditionalPlugin.transform?.('code', 'file.vue')
    expect(vueResult).toBeTruthy()

    const jsResult = conditionalPlugin.transform?.('code', 'file.js')
    expect(jsResult).toBeNull()
  })

  it('应该获取框架特定插件列表', () => {
    const vuePlugins = orchestrator.getFrameworkPlugins('vue')
    expect(vuePlugins).toContain('@vitejs/plugin-vue')
    expect(vuePlugins).toContain('@vitejs/plugin-vue-jsx')

    const reactPlugins = orchestrator.getFrameworkPlugins('react')
    expect(reactPlugins).toContain('@vitejs/plugin-react')
  })
})

describe('MixedFrameworkStrategy', () => {
  let strategy: MixedFrameworkStrategy

  beforeEach(() => {
    strategy = new MixedFrameworkStrategy({
      mode: 'separated',
      jsx: {
        autoDetect: true,
        defaultFramework: 'react'
      }
    })
  })

  afterEach(() => {
    strategy.cleanup()
  })

  it('应该验证策略名称', () => {
    expect(strategy.name).toBe('mixed-framework')
    expect(strategy.validate()).toBe(true)
  })

  it('应该应用统一模式配置', async () => {
    const unifiedStrategy = new MixedFrameworkStrategy({
      mode: 'unified'
    })

    const options = {
      input: 'src/index.ts',
      plugins: []
    }

    const result = await unifiedStrategy.apply(options)

    expect(result.plugins).toBeDefined()
    expect(Array.isArray(result.plugins)).toBe(true)
    expect(result.output).toBeDefined()

    unifiedStrategy.cleanup()
  })

  it('应该应用分离模式配置', async () => {
    const separatedStrategy = new MixedFrameworkStrategy({
      mode: 'separated',
      output: {
        separateFrameworks: true,
        frameworkDirs: {
          vue: 'vue-dist',
          react: 'react-dist',
          shared: 'common'
        }
      }
    })

    const options = {
      input: 'src/index.ts',
      plugins: []
    }

    const result = await separatedStrategy.apply(options)

    expect(result.input).toBeDefined()
    expect(typeof result.output).toBe('object')

    separatedStrategy.cleanup()
  })

  it('应该支持组件模式', async () => {
    const componentStrategy = new MixedFrameworkStrategy({
      mode: 'component',
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src'
      }
    })

    const options = {
      input: 'src/index.ts',
      plugins: []
    }

    const result = await componentStrategy.apply(options)

    expect(result.output).toMatchObject({
      preserveModules: true,
      preserveModulesRoot: 'src'
    })

    componentStrategy.cleanup()
  })

  it('应该支持自定义分组', async () => {
    const customStrategy = new MixedFrameworkStrategy({
      mode: 'custom',
      groups: {
        'vue-components': {
          pattern: 'src/vue/**',
          framework: 'vue',
          output: { dir: 'dist/vue' }
        },
        'react-components': {
          pattern: 'src/react/**',
          framework: 'react',
          output: { dir: 'dist/react' }
        }
      }
    })

    const options = {
      input: 'src/index.ts',
      plugins: []
    }

    // 由于自定义模式需要文件系统访问，这里只测试配置是否正确
    expect(customStrategy['config'].groups).toBeDefined()
    expect(customStrategy['config'].groups?.['vue-components']).toBeDefined()

    customStrategy.cleanup()
  })

  it('应该支持智能外部化', async () => {
    const strategy = new MixedFrameworkStrategy({
      mode: 'unified',
      advanced: {
        smartExternals: true
      }
    })

    // 模拟文件框架映射
    strategy['fileFrameworkMap'] = {
      'src/vue/Button.vue': { type: 'vue', confidence: 1 },
      'src/utils/helper.ts': { type: 'unknown', confidence: 0 }
    }

    const options = {
      input: 'src/index.ts',
      plugins: [],
      external: ['lodash']
    }

    const result = await strategy.apply(options)

    // 应该外部化未使用的 React
    const externals = result.external as string[]
    expect(externals).toContain('react')
    expect(externals).toContain('react-dom')
    expect(externals).toContain('lodash')

    strategy.cleanup()
  })
})

describe('混合框架集成测试', () => {
  it('应该完整处理混合框架项目', async () => {
    // 创建测试文件结构
    const testProject = {
      'src/vue/Button.vue.tsx': `
        import { defineComponent } from 'vue'
        export default defineComponent({
          name: 'VueButton',
          render() {
            return <button>Vue Button</button>
          }
        })
      `,
      'src/react/Button.react.tsx': `
        import React from 'react'
        export function ReactButton() {
          return <button>React Button</button>
        }
      `,
      'src/shared/utils.ts': `
        export function formatDate(date: Date) {
          return date.toISOString()
        }
      `
    }

    // 测试框架检测
    const detector = new FrameworkDetector()
    const vueInfo = await detector.detect('src/vue/Button.vue.tsx')
    const reactInfo = await detector.detect('src/react/Button.react.tsx')

    expect(vueInfo.type).toBe('vue')
    expect(reactInfo.type).toBe('react')

    // 测试JSX转换
    const transformer = new DualJSXTransformer()
    const vueResult = await transformer.transform(
      testProject['src/vue/Button.vue.tsx'],
      'vue'
    )
    const reactResult = await transformer.transform(
      testProject['src/react/Button.react.tsx'],
      'react'
    )

    expect(vueResult.code).toBeDefined()
    expect(reactResult.code).toBeDefined()

    // 清理
    detector.clearCache()
  })
})

