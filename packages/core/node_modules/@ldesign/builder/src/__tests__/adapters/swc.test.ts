/**
 * swc 适配器测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { SwcAdapter } from '../../adapters/swc/SwcAdapter'

describe('SwcAdapter', () => {
  let adapter: SwcAdapter

  beforeEach(() => {
    adapter = new SwcAdapter()
  })

  it('should create adapter instance', () => {
    expect(adapter).toBeDefined()
    expect(adapter.name).toBe('swc')
  })

  it('should support typescript', () => {
    expect(adapter.supportsFeature('typescript')).toBe(true)
  })

  it('should support decorators', () => {
    expect(adapter.supportsFeature('decorators')).toBe(true)
  })

  it('should support tsx', () => {
    expect(adapter.supportsFeature('tsx')).toBe(true)
  })

  it('should get feature support', () => {
    const features = adapter.getFeatureSupport()
    expect(features.typescript).toBe(true)
    expect(features.decorators).toBe(true)
  })
})

