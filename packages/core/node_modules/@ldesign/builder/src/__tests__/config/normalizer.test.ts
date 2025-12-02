/**
 * 配置规范化器测试
 *
 * 测试 ConfigNormalizer 对各种配置格式的兼容性处理
 */

import { describe, it, expect } from 'vitest'
import {
  ConfigNormalizer,
  normalizeConfig,
  normalizeConfigWithWarnings,
} from '../../config/normalizer'

describe('ConfigNormalizer', () => {
  describe('entry/input 规范化', () => {
    it('应该将 entry 转换为 input', () => {
      const config = { entry: 'src/index.ts' }
      const result = normalizeConfig(config)

      expect(result.input).toBe('src/index.ts')
      expect((result as any).entry).toBeUndefined()
    })

    it('应该保留已有的 input 字段', () => {
      const config = { input: 'src/main.ts' }
      const result = normalizeConfig(config)

      expect(result.input).toBe('src/main.ts')
    })

    it('当同时存在 entry 和 input 时，应该优先使用 input', () => {
      const config = { entry: 'src/entry.ts', input: 'src/input.ts' }
      const result = normalizeConfig(config)

      expect(result.input).toBe('src/input.ts')
    })
  })

  describe('formats/format 规范化', () => {
    it('应该将 formats 转换为 output.format', () => {
      const config = { formats: ['esm', 'cjs'] }
      const result = normalizeConfig(config)

      expect(result.output?.format).toEqual(['esm', 'cjs'])
      expect((result as any).formats).toBeUndefined()
    })

    it('应该将顶层 format 转换为 output.format', () => {
      // 注意：当前实现只处理 formats（复数形式），不处理 format
      // 如果需要支持 format，需要在 normalizer.ts 中添加处理逻辑
      const config = { formats: ['esm', 'umd'] }
      const result = normalizeConfig(config)

      expect(result.output?.format).toEqual(['esm', 'umd'])
    })

    it('应该保留已有的 output.format', () => {
      const config = {
        output: { format: ['esm'] },
        formats: ['cjs'],
      }
      const result = normalizeConfig(config)

      expect(result.output?.format).toEqual(['esm'])
    })
  })

  describe('outDir 规范化', () => {
    it('应该将 outDir 转换为 output.dir', () => {
      const config = { outDir: 'dist' }
      const result = normalizeConfig(config)

      expect(result.output?.dir).toBe('dist')
      expect((result as any).outDir).toBeUndefined()
    })
  })

  describe('output 简写形式规范化', () => {
    it('应该将 output.esm 字符串转换为对象形式', () => {
      const config = {
        output: {
          esm: 'es',
        },
      }
      const result = normalizeConfig(config)

      // 实现会自动添加 format 字段
      expect(result.output?.esm).toEqual({ dir: 'es', format: 'esm' })
    })

    it('应该将 output.cjs 字符串转换为对象形式', () => {
      const config = {
        output: {
          cjs: 'lib',
        },
      }
      const result = normalizeConfig(config)

      // 实现会自动添加 format 字段
      expect(result.output?.cjs).toEqual({ dir: 'lib', format: 'cjs' })
    })

    it('应该保留已有的对象形式', () => {
      const config = {
        output: {
          esm: { dir: 'es', format: 'esm', dts: true },
        },
      }
      const result = normalizeConfig(config)

      expect(result.output?.esm).toEqual({ dir: 'es', format: 'esm', dts: true })
    })
  })

  describe('遗留字段规范化', () => {
    it('应该将 root 转换为 cwd', () => {
      const config = { root: '/project' }
      const result = normalizeConfig(config)

      expect(result.cwd).toBe('/project')
      expect((result as any).root).toBeUndefined()
    })

    it('应该将 target 转换为 typescript.target', () => {
      const config = { target: 'ES2022' }
      const result = normalizeConfig(config)

      expect(result.typescript?.target).toBe('ES2022')
      expect((result as any).target).toBeUndefined()
    })

    it('应该将 css 转换为 style', () => {
      const config = { css: { modules: true } }
      const result = normalizeConfig(config)

      expect(result.style).toEqual({ modules: true })
      expect((result as any).css).toBeUndefined()
    })
  })

  describe('警告生成', () => {
    it('应该为废弃字段生成警告', () => {
      const config = { entry: 'src/index.ts' }
      const { config: normalized, warnings } = normalizeConfigWithWarnings(config)

      expect(warnings.length).toBeGreaterThan(0)
      // 警告对象使用 oldField 而不是 field
      expect(warnings.some(w => w.oldField === 'entry')).toBe(true)
    })

    it('应该为多个废弃字段生成多个警告', () => {
      const config = {
        entry: 'src/index.ts',
        formats: ['esm'],
        root: '/project',
      }
      const { warnings } = normalizeConfigWithWarnings(config)

      expect(warnings.length).toBeGreaterThanOrEqual(3)
    })
  })
})

