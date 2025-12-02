/**
 * 库类型预设测试
 *
 * 测试 node-library, web-library, universal-library 等预设配置
 */

import { describe, it, expect } from 'vitest'
import {
  nodeLibrary,
  webLibrary,
  universalLibrary,
  cliTool,
  getPresetConfig,
  isValidPreset,
  LIBRARY_PRESETS,
} from '../../presets/library-presets'

describe('Library Presets', () => {
  describe('nodeLibrary', () => {
    it('应该返回 Node.js 库的默认配置', () => {
      const config = nodeLibrary()

      expect(config.platform).toBe('node')
      expect(config.output?.format).toContain('esm')
      expect(config.output?.format).toContain('cjs')
      expect(config.output?.format).not.toContain('umd')
      expect(config.dts).toBe(true)
    })

    it('应该允许覆盖默认配置', () => {
      const config = nodeLibrary({
        name: 'my-node-lib',
        minify: true,
      })

      expect(config.name).toBe('my-node-lib')
      expect(config.minify).toBe(true)
      expect(config.platform).toBe('node')
    })

    it('应该设置正确的输出目录', () => {
      const config = nodeLibrary()

      expect(config.output?.esm?.dir).toBe('es')
      expect(config.output?.cjs?.dir).toBe('lib')
    })
  })

  describe('webLibrary', () => {
    it('应该返回浏览器库的默认配置', () => {
      const config = webLibrary()

      expect(config.platform).toBe('browser')
      expect(config.output?.format).toContain('esm')
      expect(config.output?.format).toContain('umd')
    })

    it('应该包含 UMD 配置', () => {
      const config = webLibrary({ name: 'MyLib' })

      expect(config.output?.umd).toBeDefined()
    })

    it('应该允许自定义 UMD 全局名称', () => {
      const config = webLibrary({
        name: 'MyLib',
        output: {
          umd: { name: 'CustomGlobalName' },
        },
      })

      expect(config.output?.umd?.name).toBe('CustomGlobalName')
    })
  })

  describe('universalLibrary', () => {
    it('应该返回通用库的默认配置', () => {
      const config = universalLibrary()

      expect(config.platform).toBe('neutral')
      expect(config.output?.format).toContain('esm')
      expect(config.output?.format).toContain('cjs')
      expect(config.output?.format).toContain('umd')
    })

    it('应该同时支持 Node.js 和浏览器', () => {
      const config = universalLibrary()

      expect(config.output?.esm).toBeDefined()
      expect(config.output?.cjs).toBeDefined()
      expect(config.output?.umd).toBeDefined()
    })
  })

  describe('cliTool', () => {
    it('应该返回 CLI 工具的默认配置', () => {
      const config = cliTool()

      expect(config.platform).toBe('node')
      expect(config.output?.format).toContain('cjs')
      expect(config.minify).toBe(true)
    })

    it('应该只生成 CJS 格式', () => {
      const config = cliTool()

      expect(config.output?.format).toEqual(['cjs'])
    })
  })

  describe('getPresetConfig', () => {
    it('应该根据预设名称返回配置', () => {
      const nodeConfig = getPresetConfig('node-library')
      expect(nodeConfig.platform).toBe('node')

      const webConfig = getPresetConfig('web-library')
      expect(webConfig.platform).toBe('browser')

      const universalConfig = getPresetConfig('universal-library')
      expect(universalConfig.platform).toBe('neutral')
    })

    it('应该支持覆盖配置', () => {
      const config = getPresetConfig('node-library', { name: 'custom-name' })
      expect(config.name).toBe('custom-name')
      expect(config.platform).toBe('node')
    })

    it('对于未知预设应该抛出错误', () => {
      expect(() => getPresetConfig('unknown-preset' as any)).toThrow()
    })
  })

  describe('isValidPreset', () => {
    it('应该验证有效的预设名称', () => {
      expect(isValidPreset('node-library')).toBe(true)
      expect(isValidPreset('web-library')).toBe(true)
      expect(isValidPreset('universal-library')).toBe(true)
      expect(isValidPreset('cli-tool')).toBe(true)
    })

    it('应该拒绝无效的预设名称', () => {
      expect(isValidPreset('invalid')).toBe(false)
      expect(isValidPreset('')).toBe(false)
      expect(isValidPreset('node')).toBe(false)
    })
  })

  describe('LIBRARY_PRESETS', () => {
    it('应该包含所有预设', () => {
      expect(LIBRARY_PRESETS['node-library']).toBeDefined()
      expect(LIBRARY_PRESETS['web-library']).toBeDefined()
      expect(LIBRARY_PRESETS['universal-library']).toBeDefined()
      expect(LIBRARY_PRESETS['cli-tool']).toBeDefined()
    })
  })
})

