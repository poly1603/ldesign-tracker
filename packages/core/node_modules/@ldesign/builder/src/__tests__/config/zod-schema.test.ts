/**
 * Zod Schema 验证测试
 */

import { describe, it, expect } from 'vitest'
import { validateConfig, getConfigDefaults, mergeConfigWithValidation } from '../../config/zod-schema'

describe('Zod Schema Validation', () => {
  it('should validate valid config', () => {
    const config = {
      bundler: 'rollup',
      mode: 'production',
      dts: true
    }

    const result = validateConfig(config)
    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
  })

  it('should reject invalid bundler', () => {
    const config = {
      bundler: 'invalid-bundler'
    }

    const result = validateConfig(config)
    expect(result.success).toBe(false)
    expect(result.errors).toBeDefined()
  })

  it('should reject invalid mode', () => {
    const config = {
      mode: 'invalid-mode'
    }

    const result = validateConfig(config)
    expect(result.success).toBe(false)
  })

  it('should get config defaults', () => {
    const defaults = getConfigDefaults()
    expect(defaults.bundler).toBe('rollup')
    expect(defaults.mode).toBe('production')
    expect(defaults.dts).toBe(true)
  })

  it('should merge config with validation', () => {
    const base = { bundler: 'rollup' }
    const override = { mode: 'development' }

    const result = mergeConfigWithValidation(base, override)
    expect(result.success).toBe(true)
    expect(result.data?.bundler).toBe('rollup')
    expect(result.data?.mode).toBe('development')
  })

  it('should validate output config', () => {
    const config = {
      output: {
        esm: {
          dir: 'es',
          format: 'esm',
          dts: true
        }
      }
    }

    const result = validateConfig(config)
    expect(result.success).toBe(true)
  })
})

