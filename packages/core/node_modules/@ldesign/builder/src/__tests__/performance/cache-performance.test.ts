/**
 * 缓存系统性能基准测试
 * 
 * 测试 CacheKeyGenerator、MultiLevelCache 的性能表现
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { CacheKeyGenerator } from '../../utils/cache/CacheKeyGenerator'
import { MultiLevelCache } from '../../utils/cache/MultiLevelCache'
import type { BuilderConfig } from '../../types/config'

describe('Cache Performance Benchmarks', () => {
  describe('CacheKeyGenerator Performance', () => {
    let generator: CacheKeyGenerator

    beforeEach(() => {
      generator = new CacheKeyGenerator()
    })

    it('should generate cache keys efficiently', async () => {
      const config: BuilderConfig = {
        libraryType: 'react',
        mode: 'production',
        bundler: 'rollup',
        output: { format: 'esm' }
      }

      const iterations = 1000
      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        await generator.generateBuildCacheKey(config, {
          includeDependencies: false
        })
      }

      const endTime = performance.now()
      const duration = endTime - startTime
      const avgTime = duration / iterations

      console.log(`\n📊 CacheKeyGenerator Performance:`)
      console.log(`   Total time: ${duration.toFixed(2)}ms`)
      console.log(`   Average per key: ${avgTime.toFixed(3)}ms`)
      console.log(`   Keys/second: ${(1000 / avgTime).toFixed(0)}`)

      // Should be fast - less than 1ms per key
      expect(avgTime).toBeLessThan(1)
    })

    it('should handle large config objects', async () => {
      const largeConfig: BuilderConfig = {
        libraryType: 'react',
        mode: 'production',
        bundler: 'rollup',
        output: { format: ['esm', 'cjs', 'umd'] },
        external: Array.from({ length: 100 }, (_, i) => `package-${i}`),
        input: Array.from({ length: 50 }, (_, i) => `src/file-${i}.ts`)
      }

      const iterations = 100
      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        await generator.generateBuildCacheKey(largeConfig, {
          includeDependencies: false
        })
      }

      const endTime = performance.now()
      const duration = endTime - startTime
      const avgTime = duration / iterations

      console.log(`\n📊 Large Config Performance:`)
      console.log(`   Average time: ${avgTime.toFixed(3)}ms`)

      // Should still be reasonably fast
      expect(avgTime).toBeLessThan(10)
    })

    it('should generate module cache keys efficiently', async () => {
      const modulePath = 'src/index.ts'
      const compilerOptions = {
        target: 'ES2020',
        module: 'ESNext'
      }

      const iterations = 1000
      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        // Note: This will fail without actual file, but tests the logic
        try {
          await generator.generateModuleCacheKey(modulePath, compilerOptions)
        } catch {
          // Expected to fail without file
        }
      }

      const endTime = performance.now()
      const duration = endTime - startTime
      const avgTime = duration / iterations

      console.log(`\n📊 Module Cache Key Performance:`)
      console.log(`   Average time: ${avgTime.toFixed(3)}ms`)

      expect(avgTime).toBeLessThan(5)
    })
  })

  describe('MultiLevelCache Performance', () => {
    let cache: MultiLevelCache

    beforeEach(() => {
      cache = new MultiLevelCache({
        l1: { enabled: true, maxSize: 10 * 1024 * 1024 },
        l2: { enabled: false }, // Disable for consistent benchmark
        l3: { enabled: false }
      })
    })

    it('should handle high-frequency cache operations', async () => {
      const operations = 10000
      const startTime = performance.now()

      // Write operations
      for (let i = 0; i < operations; i++) {
        await cache.set(`key-${i}`, `value-${i}`)
      }

      const writeTime = performance.now() - startTime

      // Read operations
      const readStartTime = performance.now()
      for (let i = 0; i < operations; i++) {
        await cache.get(`key-${i}`)
      }
      const readTime = performance.now() - readStartTime

      console.log(`\n📊 Cache Operations Performance (${operations} ops):`)
      console.log(`   Write time: ${writeTime.toFixed(2)}ms`)
      console.log(`   Read time: ${readTime.toFixed(2)}ms`)
      console.log(`   Write ops/sec: ${(operations / writeTime * 1000).toFixed(0)}`)
      console.log(`   Read ops/sec: ${(operations / readTime * 1000).toFixed(0)}`)

      const stats = cache.getStats()
      console.log(`   Hit rate: ${stats.hitRate.toFixed(2)}%`)

      // Should be fast
      expect(writeTime / operations).toBeLessThan(1)
      expect(readTime / operations).toBeLessThan(0.5)
      expect(stats.hitRate).toBe(100)
    })

    it('should handle concurrent cache operations', async () => {
      const concurrency = 100
      const operationsPerBatch = 100
      const startTime = performance.now()

      const batches = Array.from({ length: concurrency }, (_, batchId) => {
        return Promise.all(
          Array.from({ length: operationsPerBatch }, async (_, i) => {
            const key = `batch-${batchId}-key-${i}`
            const value = { batch: batchId, index: i, data: 'test' }
            await cache.set(key, value)
            return cache.get(key)
          })
        )
      })

      await Promise.all(batches)

      const endTime = performance.now()
      const totalOps = concurrency * operationsPerBatch * 2 // set + get
      const duration = endTime - startTime

      console.log(`\n📊 Concurrent Cache Performance:`)
      console.log(`   Total operations: ${totalOps}`)
      console.log(`   Duration: ${duration.toFixed(2)}ms`)
      console.log(`   Ops/second: ${(totalOps / duration * 1000).toFixed(0)}`)

      expect(duration).toBeLessThan(5000) // Should complete in under 5s
    })

    it('should handle large values efficiently', async () => {
      const sizes = [
        { name: '1KB', size: 1024 },
        { name: '10KB', size: 10 * 1024 },
        { name: '100KB', size: 100 * 1024 },
        { name: '1MB', size: 1024 * 1024 }
      ]

      console.log(`\n📊 Large Value Performance:`)

      for (const { name, size } of sizes) {
        const value = 'x'.repeat(size)
        const iterations = 100

        const writeStart = performance.now()
        for (let i = 0; i < iterations; i++) {
          await cache.set(`large-${name}-${i}`, value)
        }
        const writeTime = performance.now() - writeStart

        const readStart = performance.now()
        for (let i = 0; i < iterations; i++) {
          await cache.get(`large-${name}-${i}`)
        }
        const readTime = performance.now() - readStart

        console.log(`   ${name}: Write ${writeTime.toFixed(2)}ms, Read ${readTime.toFixed(2)}ms`)

        expect(writeTime / iterations).toBeLessThan(10)
        expect(readTime / iterations).toBeLessThan(5)
      }
    })

    it('should scale well with cache size', async () => {
      const cacheSizes = [100, 1000, 10000]

      console.log(`\n📊 Cache Scaling Performance:`)

      for (const size of cacheSizes) {
        const testCache = new MultiLevelCache({
          l1: { enabled: true },
          l2: { enabled: false },
          l3: { enabled: false }
        })

        // Fill cache
        const fillStart = performance.now()
        for (let i = 0; i < size; i++) {
          await testCache.set(`key-${i}`, `value-${i}`)
        }
        const fillTime = performance.now() - fillStart

        // Random reads
        const readStart = performance.now()
        for (let i = 0; i < 1000; i++) {
          const randomKey = `key-${Math.floor(Math.random() * size)}`
          await testCache.get(randomKey)
        }
        const readTime = performance.now() - readStart

        console.log(`   ${size} entries: Fill ${fillTime.toFixed(2)}ms, 1000 reads ${readTime.toFixed(2)}ms`)

        expect(readTime / 1000).toBeLessThan(1) // Should still be fast
      }
    })

    it('should maintain performance under cache pressure', async () => {
      const iterations = 5000
      const keySpace = 1000 // Reuse keys to test eviction

      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        const key = `pressure-key-${i % keySpace}`
        await cache.set(key, { iteration: i, data: 'test-data' })
        await cache.get(key)
      }

      const endTime = performance.now()
      const duration = endTime - startTime

      console.log(`\n📊 Cache Pressure Test:`)
      console.log(`   Duration: ${duration.toFixed(2)}ms`)
      console.log(`   Avg time per op: ${(duration / iterations).toFixed(3)}ms`)

      const stats = cache.getStats()
      console.log(`   Final hit rate: ${stats.hitRate.toFixed(2)}%`)

      expect(duration / iterations).toBeLessThan(1)
    })
  })

  describe('Cache Memory Efficiency', () => {
    it('should not leak memory during operations', async () => {
      const cache = new MultiLevelCache()

      const initialMemory = process.memoryUsage().heapUsed
      const iterations = 1000

      // Perform many operations
      for (let i = 0; i < iterations; i++) {
        await cache.set(`key-${i}`, { data: 'x'.repeat(1000) })
        await cache.get(`key-${i}`)
        await cache.delete(`key-${i}`)
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }

      await new Promise(resolve => setTimeout(resolve, 100))

      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = finalMemory - initialMemory

      console.log(`\n📊 Memory Efficiency:`)
      console.log(`   Initial: ${(initialMemory / 1024 / 1024).toFixed(2)}MB`)
      console.log(`   Final: ${(finalMemory / 1024 / 1024).toFixed(2)}MB`)
      console.log(`   Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`)

      // Should not increase significantly (< 10MB for this test)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024)
    })
  })

  describe('Performance Comparison', () => {
    it('should compare single vs multi-level cache', async () => {
      const operations = 1000

      // Single level (L1 only)
      const singleCache = new MultiLevelCache({
        l1: { enabled: true },
        l2: { enabled: false },
        l3: { enabled: false }
      })

      const singleStart = performance.now()
      for (let i = 0; i < operations; i++) {
        await singleCache.set(`key-${i}`, `value-${i}`)
        await singleCache.get(`key-${i}`)
      }
      const singleTime = performance.now() - singleStart

      // Multi-level (L1 + L2)
      const multiCache = new MultiLevelCache({
        l1: { enabled: true },
        l2: { enabled: true },
        l3: { enabled: false }
      })

      const multiStart = performance.now()
      for (let i = 0; i < operations; i++) {
        await multiCache.set(`key-${i}`, `value-${i}`)
        await multiCache.get(`key-${i}`)
      }
      const multiTime = performance.now() - multiStart

      console.log(`\n📊 Single vs Multi-Level Cache:`)
      console.log(`   Single-level: ${singleTime.toFixed(2)}ms`)
      console.log(`   Multi-level: ${multiTime.toFixed(2)}ms`)
      console.log(`   Overhead: ${((multiTime / singleTime - 1) * 100).toFixed(1)}%`)

      // Multi-level should have reasonable overhead (< 100%)
      expect(multiTime / singleTime).toBeLessThan(2)
    })
  })
})
