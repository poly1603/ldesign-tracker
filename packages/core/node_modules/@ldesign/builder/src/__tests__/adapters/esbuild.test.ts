/**
 * esbuild 适配器测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { EsbuildAdapter } from '../../adapters/esbuild/EsbuildAdapter'

describe('EsbuildAdapter', () => {
  let adapter: EsbuildAdapter

  beforeEach(() => {
    adapter = new EsbuildAdapter()
  })

  it('should create adapter instance', () => {
    expect(adapter).toBeDefined()
    expect(adapter.name).toBe('esbuild')
  })

  it('should check availability', () => {
    expect(typeof adapter.available).toBe('boolean')
  })

  it('should support typescript', () => {
    expect(adapter.supportsFeature('typescript')).toBe(true)
  })

  it('should support jsx', () => {
    expect(adapter.supportsFeature('jsx')).toBe(true)
  })

  it('should not support decorators', () => {
    expect(adapter.supportsFeature('decorators')).toBe(false)
  })

  it('should get feature support', () => {
    const features = adapter.getFeatureSupport()
    expect(features.typescript).toBe(true)
    expect(features.jsx).toBe(true)
    expect(features.decorators).toBe(false)
  })

  it('should get performance metrics', () => {
    const metrics = adapter.getPerformanceMetrics()
    expect(metrics).toBeDefined()
    expect(metrics.memoryUsage).toBeDefined()
  })
})

