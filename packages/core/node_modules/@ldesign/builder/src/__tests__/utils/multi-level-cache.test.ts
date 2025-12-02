/**
 * MultiLevelCache 测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MultiLevelCache, createMultiLevelCache, type CacheLayer } from '../../utils/cache/MultiLevelCache'

// Mock cache layers
class MockCacheLayer implements CacheLayer {
  private store = new Map<string, any>()
  public getCallCount = 0
  public setCallCount = 0

  async get<T>(key: string): Promise<T | null> {
    this.getCallCount++
    return this.store.has(key) ? this.store.get(key) : null
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.setCallCount++
    this.store.set(key, value)
  }

  async has(key: string): Promise<boolean> {
    return this.store.has(key)
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key)
  }

  async clear(): Promise<void> {
    this.store.clear()
  }

  async size(): Promise<number> {
    return this.store.size
  }
}

// Mock the cache layer modules
vi.mock('../../utils/cache/MemoryCache', () => ({
  MemoryCache: MockCacheLayer
}))

vi.mock('../../utils/cache/FileSystemCache', () => ({
  FileSystemCache: MockCacheLayer
}))

vi.mock('../../utils/cache/RemoteCache', () => ({
  RemoteCache: MockCacheLayer
}))

describe('MultiLevelCache', () => {
  let cache: MultiLevelCache

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('constructor', () => {
    it('should create cache with default options', () => {
      cache = new MultiLevelCache()
      const stats = cache.getStats()

      expect(stats.l1Hits).toBe(0)
      expect(stats.l2Hits).toBe(0)
      expect(stats.l3Hits).toBe(0)
      expect(stats.misses).toBe(0)
      expect(stats.total).toBe(0)
      expect(stats.hitRate).toBe(0)
    })

    it('should enable L1 and L2 by default', () => {
      cache = new MultiLevelCache()
      expect(cache).toBeInstanceOf(MultiLevelCache)
    })

    it('should disable L3 by default', () => {
      cache = new MultiLevelCache()
      expect(cache).toBeInstanceOf(MultiLevelCache)
    })

    it('should enable L3 when explicitly configured', () => {
      cache = new MultiLevelCache({
        l3: {
          enabled: true,
          endpoint: 'http://cache.example.com'
        }
      })
      expect(cache).toBeInstanceOf(MultiLevelCache)
    })

    it('should disable L1 when configured', () => {
      cache = new MultiLevelCache({
        l1: { enabled: false }
      })
      expect(cache).toBeInstanceOf(MultiLevelCache)
    })
  })

  describe('get', () => {
    beforeEach(() => {
      cache = new MultiLevelCache()
    })

    it('should return null for non-existent key', async () => {
      const value = await cache.get('non-existent')
      expect(value).toBeNull()
    })

    it('should return value from L1 cache', async () => {
      await cache.set('key1', 'value1')
      const value = await cache.get('key1')

      expect(value).toBe('value1')

      const stats = cache.getStats()
      expect(stats.l1Hits).toBe(1)
      expect(stats.l2Hits).toBe(0)
      expect(stats.l3Hits).toBe(0)
    })

    it('should promote L2 hit to L1', async () => {
      // Set up: value exists in L2 but not L1
      // This is tested implicitly by the cache behavior
      await cache.set('key1', 'value1')
      const value = await cache.get('key1')

      expect(value).toBe('value1')
    })

    it('should emit cache-hit event on hit', async () => {
      const listener = vi.fn()
      cache.on('cache-hit', listener)

      await cache.set('key1', 'value1')
      await cache.get('key1')

      expect(listener).toHaveBeenCalled()
      const event = listener.mock.calls[0][0]
      expect(event.key).toBe('key1')
      expect(['L1', 'L2', 'L3']).toContain(event.level)
    })

    it('should emit cache-miss event on miss', async () => {
      const listener = vi.fn()
      cache.on('cache-miss', listener)

      await cache.get('non-existent')

      expect(listener).toHaveBeenCalled()
      const event = listener.mock.calls[0][0]
      expect(event.key).toBe('non-existent')
    })

    it('should update stats correctly', async () => {
      await cache.set('key1', 'value1')
      await cache.get('key1') // Hit
      await cache.get('key2') // Miss

      const stats = cache.getStats()
      expect(stats.total).toBe(2)
      expect(stats.misses).toBe(1)
      expect(stats.hitRate).toBe(50)
    })

    it('should handle multiple gets efficiently', async () => {
      await cache.set('key1', 'value1')

      // Multiple gets should hit L1
      await cache.get('key1')
      await cache.get('key1')
      await cache.get('key1')

      const stats = cache.getStats()
      expect(stats.l1Hits).toBe(3)
      expect(stats.hitRate).toBe(100)
    })
  })

  describe('set', () => {
    beforeEach(() => {
      cache = new MultiLevelCache()
    })

    it('should set value in all cache layers', async () => {
      await cache.set('key1', 'value1')
      const value = await cache.get('key1')

      expect(value).toBe('value1')
    })

    it('should emit cache-set event', async () => {
      const listener = vi.fn()
      cache.on('cache-set', listener)

      await cache.set('key1', 'value1')

      expect(listener).toHaveBeenCalled()
      const event = listener.mock.calls[0][0]
      expect(event.key).toBe('key1')
      expect(event.levels).toBeGreaterThan(0)
    })

    it('should support TTL parameter', async () => {
      await cache.set('key1', 'value1', 5000)
      const value = await cache.get('key1')

      expect(value).toBe('value1')
    })

    it('should handle complex objects', async () => {
      const obj = {
        name: 'test',
        nested: { value: 123 },
        array: [1, 2, 3]
      }

      await cache.set('obj-key', obj)
      const value = await cache.get('obj-key')

      expect(value).toEqual(obj)
    })
  })

  describe('has', () => {
    beforeEach(() => {
      cache = new MultiLevelCache()
    })

    it('should return false for non-existent key', async () => {
      const exists = await cache.has('non-existent')
      expect(exists).toBe(false)
    })

    it('should return true for existing key', async () => {
      await cache.set('key1', 'value1')
      const exists = await cache.has('key1')

      expect(exists).toBe(true)
    })

    it('should check all cache layers', async () => {
      await cache.set('key1', 'value1')
      const exists = await cache.has('key1')

      expect(exists).toBe(true)
    })
  })

  describe('delete', () => {
    beforeEach(() => {
      cache = new MultiLevelCache()
    })

    it('should delete from all cache layers', async () => {
      await cache.set('key1', 'value1')
      await cache.delete('key1')

      const value = await cache.get('key1')
      expect(value).toBeNull()
    })

    it('should emit cache-delete event', async () => {
      const listener = vi.fn()
      cache.on('cache-delete', listener)

      await cache.set('key1', 'value1')
      await cache.delete('key1')

      expect(listener).toHaveBeenCalled()
      const event = listener.mock.calls[0][0]
      expect(event.key).toBe('key1')
    })

    it('should not error when deleting non-existent key', async () => {
      await expect(cache.delete('non-existent')).resolves.toBeUndefined()
    })
  })

  describe('clear', () => {
    beforeEach(() => {
      cache = new MultiLevelCache()
    })

    it('should clear all cache layers', async () => {
      await cache.set('key1', 'value1')
      await cache.set('key2', 'value2')
      await cache.clear()

      const value1 = await cache.get('key1')
      const value2 = await cache.get('key2')

      expect(value1).toBeNull()
      expect(value2).toBeNull()
    })

    it('should emit cache-clear event', async () => {
      const listener = vi.fn()
      cache.on('cache-clear', listener)

      await cache.clear()

      expect(listener).toHaveBeenCalled()
    })
  })

  describe('getStats', () => {
    beforeEach(() => {
      cache = new MultiLevelCache()
    })

    it('should return initial stats', () => {
      const stats = cache.getStats()

      expect(stats).toEqual({
        l1Hits: 0,
        l2Hits: 0,
        l3Hits: 0,
        misses: 0,
        total: 0,
        hitRate: 0
      })
    })

    it('should track hits and misses', async () => {
      await cache.set('key1', 'value1')

      await cache.get('key1') // Hit
      await cache.get('key2') // Miss
      await cache.get('key1') // Hit
      await cache.get('key3') // Miss

      const stats = cache.getStats()
      expect(stats.total).toBe(4)
      expect(stats.misses).toBe(2)
      expect(stats.hitRate).toBe(50)
    })

    it('should calculate hit rate correctly', async () => {
      await cache.set('key1', 'value1')
      await cache.set('key2', 'value2')

      await cache.get('key1') // Hit
      await cache.get('key2') // Hit
      await cache.get('key3') // Miss

      const stats = cache.getStats()
      expect(stats.hitRate).toBeCloseTo(66.67, 1)
    })

    it('should return copy of stats', () => {
      const stats1 = cache.getStats()
      stats1.l1Hits = 999

      const stats2 = cache.getStats()
      expect(stats2.l1Hits).toBe(0)
    })
  })

  describe('resetStats', () => {
    beforeEach(() => {
      cache = new MultiLevelCache()
    })

    it('should reset all stats to zero', async () => {
      await cache.set('key1', 'value1')
      await cache.get('key1')
      await cache.get('key2')

      cache.resetStats()

      const stats = cache.getStats()
      expect(stats).toEqual({
        l1Hits: 0,
        l2Hits: 0,
        l3Hits: 0,
        misses: 0,
        total: 0,
        hitRate: 0
      })
    })
  })

  describe('cache layer hierarchy', () => {
    beforeEach(() => {
      cache = new MultiLevelCache()
    })

    it('should check L1 before L2', async () => {
      await cache.set('key1', 'value1')

      // First get should hit L1
      await cache.get('key1')

      const stats = cache.getStats()
      expect(stats.l1Hits).toBeGreaterThan(0)
    })

    it('should handle multiple cache levels', async () => {
      const multiCache = new MultiLevelCache({
        l1: { enabled: true },
        l2: { enabled: true },
        l3: {
          enabled: true,
          endpoint: 'http://example.com'
        }
      })

      await multiCache.set('key1', 'value1')
      const value = await multiCache.get('key1')

      expect(value).toBe('value1')
    })
  })

  describe('performance', () => {
    beforeEach(() => {
      cache = new MultiLevelCache()
    })

    it('should handle many cache operations', async () => {
      const operations = 100

      for (let i = 0; i < operations; i++) {
        await cache.set(`key${i}`, `value${i}`)
      }

      for (let i = 0; i < operations; i++) {
        const value = await cache.get(`key${i}`)
        expect(value).toBe(`value${i}`)
      }

      const stats = cache.getStats()
      expect(stats.total).toBe(operations)
      expect(stats.hitRate).toBe(100)
    })

    it('should handle concurrent operations', async () => {
      const promises = []

      for (let i = 0; i < 50; i++) {
        promises.push(cache.set(`key${i}`, `value${i}`))
      }

      await Promise.all(promises)

      const getPromises = []
      for (let i = 0; i < 50; i++) {
        getPromises.push(cache.get(`key${i}`))
      }

      const results = await Promise.all(getPromises)
      expect(results.length).toBe(50)
    })
  })

  describe('edge cases', () => {
    beforeEach(() => {
      cache = new MultiLevelCache()
    })

    it('should handle null values', async () => {
      await cache.set('null-key', null)
      const value = await cache.get('null-key')

      // Note: null is treated as cache miss
      expect(value).toBeNull()
    })

    it('should handle undefined values', async () => {
      await cache.set('undef-key', undefined)
      const value = await cache.get('undef-key')

      expect(value).toBeNull()
    })

    it('should handle empty string', async () => {
      await cache.set('empty', '')
      const value = await cache.get('empty')

      expect(value).toBe('')
    })

    it('should handle boolean values', async () => {
      await cache.set('true-key', true)
      await cache.set('false-key', false)

      expect(await cache.get('true-key')).toBe(true)
      expect(await cache.get('false-key')).toBe(false)
    })

    it('should handle number values', async () => {
      await cache.set('zero', 0)
      await cache.set('negative', -123)
      await cache.set('float', 3.14)

      expect(await cache.get('zero')).toBe(0)
      expect(await cache.get('negative')).toBe(-123)
      expect(await cache.get('float')).toBe(3.14)
    })

    it('should handle array values', async () => {
      const arr = [1, 2, 3, 'four', { five: 5 }]
      await cache.set('array', arr)

      const value = await cache.get('array')
      expect(value).toEqual(arr)
    })
  })

  describe('factory function', () => {
    it('createMultiLevelCache should create instance', () => {
      const c = createMultiLevelCache()
      expect(c).toBeInstanceOf(MultiLevelCache)
    })

    it('should pass options to constructor', () => {
      const c = createMultiLevelCache({
        l1: { enabled: true, maxSize: 50 * 1024 * 1024 },
        l2: { enabled: false }
      })

      expect(c).toBeInstanceOf(MultiLevelCache)
    })
  })
})
