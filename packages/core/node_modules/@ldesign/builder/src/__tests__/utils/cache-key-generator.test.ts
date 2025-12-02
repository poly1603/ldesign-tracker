/**
 * CacheKeyGenerator 测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CacheKeyGenerator, createCacheKeyGenerator, generateCacheKey } from '../../utils/cache/CacheKeyGenerator'
import type { BuilderConfig } from '../../types/config'
import fs from 'fs-extra'

// Mock fs-extra
vi.mock('fs-extra', () => ({
  default: {
    readFile: vi.fn(),
    readJson: vi.fn(),
    stat: vi.fn()
  },
  readFile: vi.fn(),
  readJson: vi.fn(),
  stat: vi.fn()
}))

describe('CacheKeyGenerator', () => {
  let generator: CacheKeyGenerator

  beforeEach(() => {
    generator = new CacheKeyGenerator()
    vi.clearAllMocks()
  })

  describe('generateBuildCacheKey', () => {
    it('should generate consistent cache key for same config', async () => {
      const config: BuilderConfig = {
        libraryType: 'react',
        mode: 'production',
        bundler: 'rollup',
        output: {
          format: 'esm'
        }
      }

      // Mock dependencies
      vi.mocked(fs.readJson).mockResolvedValue({
        dependencies: { react: '^18.0.0' },
        devDependencies: { typescript: '^5.0.0' }
      })

      const key1 = await generator.generateBuildCacheKey(config)
      const key2 = await generator.generateBuildCacheKey(config)

      expect(key1).toBe(key2)
      expect(key1).toMatch(/^[a-f0-9]{32}$/) // MD5 hash format
    })

    it('should generate different keys for different configs', async () => {
      vi.mocked(fs.readJson).mockResolvedValue({})

      const config1: BuilderConfig = {
        libraryType: 'react',
        mode: 'production'
      }

      const config2: BuilderConfig = {
        libraryType: 'vue',
        mode: 'production'
      }

      const key1 = await generator.generateBuildCacheKey(config1)
      const key2 = await generator.generateBuildCacheKey(config2)

      expect(key1).not.toBe(key2)
    })

    it('should include dependencies when option is enabled', async () => {
      const config: BuilderConfig = {
        libraryType: 'react',
        mode: 'production'
      }

      vi.mocked(fs.readJson)
        .mockResolvedValueOnce({
          dependencies: { react: '^18.0.0' }
        })
        .mockResolvedValueOnce({
          dependencies: { react: '^17.0.0' } // Different version
        })

      const key1 = await generator.generateBuildCacheKey(config, {
        includeDependencies: true
      })

      const key2 = await generator.generateBuildCacheKey(config, {
        includeDependencies: true
      })

      expect(key1).not.toBe(key2) // Different dependency versions
    })

    it('should exclude dependencies when option is disabled', async () => {
      const config: BuilderConfig = {
        libraryType: 'react',
        mode: 'production'
      }

      const key1 = await generator.generateBuildCacheKey(config, {
        includeDependencies: false
      })

      const key2 = await generator.generateBuildCacheKey(config, {
        includeDependencies: false
      })

      expect(key1).toBe(key2)
      expect(fs.readJson).not.toHaveBeenCalled()
    })

    it('should include environment variables when option is enabled', async () => {
      const config: BuilderConfig = {
        libraryType: 'react'
      }

      vi.mocked(fs.readJson).mockResolvedValue({})

      const originalNodeEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      const key1 = await generator.generateBuildCacheKey(config, {
        includeDependencies: false,
        includeEnv: true
      })

      process.env.NODE_ENV = 'development'

      const key2 = await generator.generateBuildCacheKey(config, {
        includeDependencies: false,
        includeEnv: true
      })

      expect(key1).not.toBe(key2)

      process.env.NODE_ENV = originalNodeEnv
    })

    it('should include file content hash when option is enabled', async () => {
      const config: BuilderConfig = {
        libraryType: 'react',
        input: 'src/index.ts'
      }

      vi.mocked(fs.readJson).mockResolvedValue({})
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce('export const foo = 1')
        .mockResolvedValueOnce('export const foo = 2') // Different content

      const key1 = await generator.generateBuildCacheKey(config, {
        includeDependencies: false,
        includeFileContent: true
      })

      const key2 = await generator.generateBuildCacheKey(config, {
        includeDependencies: false,
        includeFileContent: true
      })

      expect(key1).not.toBe(key2)
    })

    it('should handle multiple input files', async () => {
      const config: BuilderConfig = {
        libraryType: 'react',
        input: ['src/index.ts', 'src/utils.ts']
      }

      vi.mocked(fs.readJson).mockResolvedValue({})
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce('export const foo = 1')
        .mockResolvedValueOnce('export const bar = 2')

      const key = await generator.generateBuildCacheKey(config, {
        includeDependencies: false,
        includeFileContent: true
      })

      expect(key).toMatch(/^[a-f0-9]{32}$/)
      expect(fs.readFile).toHaveBeenCalledTimes(2)
    })

    it('should include custom factors', async () => {
      const config: BuilderConfig = {
        libraryType: 'react'
      }

      vi.mocked(fs.readJson).mockResolvedValue({})

      const key1 = await generator.generateBuildCacheKey(config, {
        includeDependencies: false,
        customFactors: { version: '1.0.0' }
      })

      const key2 = await generator.generateBuildCacheKey(config, {
        includeDependencies: false,
        customFactors: { version: '2.0.0' }
      })

      expect(key1).not.toBe(key2)
    })

    it('should sort external dependencies for consistent keys', async () => {
      vi.mocked(fs.readJson).mockResolvedValue({})

      const config1: BuilderConfig = {
        libraryType: 'react',
        external: ['react', 'vue', 'lodash']
      }

      const config2: BuilderConfig = {
        libraryType: 'react',
        external: ['lodash', 'react', 'vue'] // Different order
      }

      const key1 = await generator.generateBuildCacheKey(config1, {
        includeDependencies: false
      })

      const key2 = await generator.generateBuildCacheKey(config2, {
        includeDependencies: false
      })

      expect(key1).toBe(key2) // Should be same because sorted
    })
  })

  describe('generateModuleCacheKey', () => {
    it('should generate cache key for module', async () => {
      const modulePath = 'src/index.ts'
      const compilerOptions = {
        target: 'ES2020',
        module: 'ESNext',
        jsx: 'react'
      }

      vi.mocked(fs.readFile).mockResolvedValue('export const foo = 1')
      vi.mocked(fs.stat).mockResolvedValue({
        mtimeMs: 1234567890
      } as any)

      const key = await generator.generateModuleCacheKey(modulePath, compilerOptions)

      expect(key).toMatch(/^[a-f0-9]{32}$/)
      expect(fs.readFile).toHaveBeenCalledWith(modulePath, 'utf-8')
      expect(fs.stat).toHaveBeenCalledWith(modulePath)
    })

    it('should generate different keys for different file content', async () => {
      const modulePath = 'src/index.ts'

      vi.mocked(fs.stat).mockResolvedValue({ mtimeMs: 1234567890 } as any)
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce('export const foo = 1')
        .mockResolvedValueOnce('export const foo = 2')

      const key1 = await generator.generateModuleCacheKey(modulePath)
      const key2 = await generator.generateModuleCacheKey(modulePath)

      expect(key1).not.toBe(key2)
    })

    it('should generate different keys for different modification times', async () => {
      const modulePath = 'src/index.ts'

      vi.mocked(fs.readFile).mockResolvedValue('export const foo = 1')
      vi.mocked(fs.stat)
        .mockResolvedValueOnce({ mtimeMs: 1234567890 } as any)
        .mockResolvedValueOnce({ mtimeMs: 9876543210 } as any)

      const key1 = await generator.generateModuleCacheKey(modulePath)
      const key2 = await generator.generateModuleCacheKey(modulePath)

      expect(key1).not.toBe(key2)
    })
  })

  describe('generateDependencyCacheKey', () => {
    it('should generate cache key for module with dependencies', async () => {
      const modulePath = 'src/index.ts'
      const dependencies = ['src/utils.ts', 'src/types.ts']

      vi.mocked(fs.readFile)
        .mockResolvedValueOnce('export const foo = 1') // index.ts
        .mockResolvedValueOnce('export const bar = 2') // utils.ts
        .mockResolvedValueOnce('export type Baz = {}') // types.ts

      const key = await generator.generateDependencyCacheKey(modulePath, dependencies)

      expect(key).toMatch(/^[a-f0-9]{32}$/)
      expect(fs.readFile).toHaveBeenCalledTimes(2) // Only dependencies
    })

    it('should generate different keys when dependency content changes', async () => {
      const modulePath = 'src/index.ts'
      const dependencies = ['src/utils.ts']

      vi.mocked(fs.readFile)
        .mockResolvedValueOnce('export const bar = 1')
        .mockResolvedValueOnce('export const bar = 2') // Changed content

      const key1 = await generator.generateDependencyCacheKey(modulePath, dependencies)
      const key2 = await generator.generateDependencyCacheKey(modulePath, dependencies)

      expect(key1).not.toBe(key2)
    })

    it('should handle empty dependencies', async () => {
      const modulePath = 'src/index.ts'
      const dependencies: string[] = []

      const key = await generator.generateDependencyCacheKey(modulePath, dependencies)

      expect(key).toMatch(/^[a-f0-9]{32}$/)
      expect(fs.readFile).not.toHaveBeenCalled()
    })
  })

  describe('factory functions', () => {
    it('createCacheKeyGenerator should create new instance', () => {
      const gen = createCacheKeyGenerator()
      expect(gen).toBeInstanceOf(CacheKeyGenerator)
    })

    it('generateCacheKey should generate key using factory', async () => {
      const config: BuilderConfig = {
        libraryType: 'react',
        mode: 'production'
      }

      vi.mocked(fs.readJson).mockResolvedValue({})

      const key = await generateCacheKey(config, {
        includeDependencies: false
      })

      expect(key).toMatch(/^[a-f0-9]{32}$/)
    })
  })

  describe('error handling', () => {
    it('should handle missing package.json gracefully', async () => {
      const config: BuilderConfig = {
        libraryType: 'react'
      }

      vi.mocked(fs.readJson).mockRejectedValue(new Error('ENOENT'))

      const key = await generator.generateBuildCacheKey(config, {
        includeDependencies: true
      })

      expect(key).toMatch(/^[a-f0-9]{32}$/) // Should still generate key
    })

    it('should handle missing file gracefully', async () => {
      const modulePath = 'non-existent.ts'

      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'))
      vi.mocked(fs.stat).mockResolvedValue({ mtimeMs: 0 } as any)

      const key = await generator.generateModuleCacheKey(modulePath)

      expect(key).toMatch(/^[a-f0-9]{32}$/) // Should still generate key
    })
  })

  describe('stability', () => {
    it('should generate same key when called multiple times with same input', async () => {
      const config: BuilderConfig = {
        libraryType: 'react',
        mode: 'production',
        bundler: 'rollup',
        output: {
          format: 'esm',
          sourcemap: true
        },
        minify: true,
        external: ['react', 'react-dom']
      }

      vi.mocked(fs.readJson).mockResolvedValue({
        dependencies: { react: '^18.0.0' }
      })

      const keys = await Promise.all([
        generator.generateBuildCacheKey(config),
        generator.generateBuildCacheKey(config),
        generator.generateBuildCacheKey(config)
      ])

      expect(keys[0]).toBe(keys[1])
      expect(keys[1]).toBe(keys[2])
    })
  })
})
