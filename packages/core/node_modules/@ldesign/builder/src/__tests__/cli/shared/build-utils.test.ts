/**
 * build-utils 测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { showBuildInfo, showBuildResult, analyzeBuildResult } from '../../../cli/shared/build-utils'
import type { BuildResult } from '../../../types/builder'
import type { BuilderConfig } from '../../../types/config'

// Mock logger
const createMockLogger = () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
  newLine: vi.fn(),
  getLevel: vi.fn().mockReturnValue('info'),
  showBuildSummary: vi.fn(),
  highlight: {
    dim: vi.fn((s: string) => s),
    important: vi.fn((s: string) => s),
    number: vi.fn((n: any) => String(n)),
    time: vi.fn((s: string) => s),
    path: vi.fn((s: string) => s),
    size: vi.fn((s: string) => s)
  }
})

// Mock BundleAnalyzer
vi.mock('../../../utils/optimization/BundleAnalyzer', () => ({
  createBundleAnalyzer: vi.fn(() => ({
    generateReport: vi.fn().mockResolvedValue({
      sizeAnalysis: {
        total: 102400,
        byModule: [
          { module: 'react', size: 51200, percentage: 50 },
          { module: 'lodash', size: 25600, percentage: 25 }
        ]
      },
      duplicates: [
        { name: 'react', versions: ['17.0.0', '18.0.0'] }
      ],
      suggestions: [
        {
          severity: 'high',
          title: 'Large bundle size',
          description: 'Bundle is too large',
          solution: 'Enable code splitting'
        }
      ]
    })
  }))
}))

describe('build-utils', () => {
  describe('showBuildInfo', () => {
    it('should display basic build configuration', () => {
      const mockLogger = createMockLogger()
      const config: BuilderConfig = {
        input: 'src/index.ts',
        output: {
          format: 'esm'
        },
        mode: 'production'
      }

      showBuildInfo(config, mockLogger as any)

      expect(mockLogger.info).toHaveBeenCalled()
      const call = mockLogger.info.mock.calls[0][0]
      expect(call).toContain('📦')
    })

    it('should handle string input', () => {
      const mockLogger = createMockLogger()
      const config: BuilderConfig = {
        input: 'src/index.ts'
      }

      showBuildInfo(config, mockLogger as any)

      expect(mockLogger.info).toHaveBeenCalled()
    })

    it('should handle array input', () => {
      const mockLogger = createMockLogger()
      const config: BuilderConfig = {
        input: ['src/index.ts', 'src/utils.ts']
      }

      showBuildInfo(config, mockLogger as any)

      expect(mockLogger.info).toHaveBeenCalled()
      const call = mockLogger.info.mock.calls[0][0]
      expect(call).toContain('files')
    })

    it('should handle multiple formats', () => {
      const mockLogger = createMockLogger()
      const config: BuilderConfig = {
        output: {
          format: ['esm', 'cjs']
        }
      }

      showBuildInfo(config, mockLogger as any)

      expect(mockLogger.info).toHaveBeenCalled()
      const call = mockLogger.info.mock.calls[0][0]
      expect(call).toContain('格式')
    })

    it('should handle missing logger highlight', () => {
      const mockLogger: any = {
        info: vi.fn()
      }

      const config: BuilderConfig = {
        input: 'src/index.ts'
      }

      expect(() => showBuildInfo(config, mockLogger)).not.toThrow()
    })
  })

  describe('showBuildResult', () => {
    it('should display build result with outputs', () => {
      const mockLogger = createMockLogger()
      const result: BuildResult = {
        success: true,
        outputs: [
          {
            fileName: 'index.js',
            size: 1024,
            gzipSize: 512,
            type: 'chunk',
            format: 'esm'
          }
        ],
        duration: 1000,
        warnings: [],
        errors: [],
        buildId: 'build-1',
        timestamp: Date.now(),
        bundler: 'rollup',
        mode: 'production',
        libraryType: 'react'
      }

      const startTime = Date.now() - 1000

      showBuildResult(result, startTime, mockLogger as any)

      expect(mockLogger.showBuildSummary).toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalled()
      expect(mockLogger.newLine).toHaveBeenCalled()
    })

    it('should handle result without outputs', () => {
      const mockLogger = createMockLogger()
      const result: BuildResult = {
        success: true,
        outputs: [],
        duration: 1000,
        warnings: [],
        errors: [],
        buildId: 'build-1',
        timestamp: Date.now(),
        bundler: 'rollup',
        mode: 'production',
        libraryType: 'react'
      }

      showBuildResult(result, Date.now() - 1000, mockLogger as any)

      expect(mockLogger.newLine).toHaveBeenCalled()
    })

    it('should display file details', () => {
      const mockLogger = createMockLogger()
      const result: BuildResult = {
        success: true,
        outputs: [
          { fileName: 'index.js', size: 1024, type: 'chunk', format: 'esm' },
          { fileName: 'index.d.ts', size: 512, type: 'asset', format: 'esm' },
          { fileName: 'index.js.map', size: 2048, type: 'asset', format: 'esm' }
        ],
        duration: 1000,
        warnings: [],
        errors: [],
        buildId: 'build-1',
        timestamp: Date.now(),
        bundler: 'rollup',
        mode: 'production',
        libraryType: 'react'
      }

      showBuildResult(result, Date.now() - 1000, mockLogger as any)

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('📋 文件详情'))
    })

    it('should display warnings', () => {
      const mockLogger = createMockLogger()
      const result: BuildResult = {
        success: true,
        outputs: [
          { fileName: 'index.js', size: 1024, type: 'chunk', format: 'esm' }
        ],
        duration: 1000,
        warnings: [
          { message: 'Warning 1' },
          { message: 'Warning 2' }
        ],
        errors: [],
        buildId: 'build-1',
        timestamp: Date.now(),
        bundler: 'rollup',
        mode: 'production',
        libraryType: 'react'
      }

      showBuildResult(result, Date.now() - 1000, mockLogger as any)

      expect(mockLogger.warn).toHaveBeenCalled()
    })

    it('should display timings when provided', () => {
      const mockLogger = createMockLogger()
      const result: BuildResult = {
        success: true,
        outputs: [
          { fileName: 'index.js', size: 1024, type: 'chunk', format: 'esm' }
        ],
        duration: 1000,
        warnings: [],
        errors: [],
        buildId: 'build-1',
        timestamp: Date.now(),
        bundler: 'rollup',
        mode: 'production',
        libraryType: 'react'
      }

      const timings = {
        'Setup': 100,
        'Compile': 500,
        'Bundle': 300,
        'Minify': 100
      }

      showBuildResult(result, Date.now() - 1000, mockLogger as any, timings)

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('⏱️'))
    })

    it('should calculate gzip compression ratio', () => {
      const mockLogger = createMockLogger()
      const result: BuildResult = {
        success: true,
        outputs: [
          {
            fileName: 'index.js',
            size: 10240,
            gzipSize: 3072,
            type: 'chunk',
            format: 'esm'
          }
        ],
        duration: 1000,
        warnings: [],
        errors: [],
        buildId: 'build-1',
        timestamp: Date.now(),
        bundler: 'rollup',
        mode: 'production',
        libraryType: 'react'
      }

      showBuildResult(result, Date.now() - 1000, mockLogger as any)

      const calls = mockLogger.info.mock.calls
      const hasGzipInfo = calls.some((call: any) =>
        call[0].includes('Gzip') || call[0].includes('压缩')
      )
      expect(hasGzipInfo).toBe(true)
    })

    it('should handle missing logger methods gracefully', () => {
      const mockLogger: any = {
        info: vi.fn(),
        warn: vi.fn(),
        newLine: vi.fn()
      }

      const result: BuildResult = {
        success: true,
        outputs: [
          { fileName: 'index.js', size: 1024, type: 'chunk', format: 'esm' }
        ],
        duration: 1000,
        warnings: [],
        errors: [],
        buildId: 'build-1',
        timestamp: Date.now(),
        bundler: 'rollup',
        mode: 'production',
        libraryType: 'react'
      }

      expect(() =>
        showBuildResult(result, Date.now() - 1000, mockLogger)
      ).not.toThrow()
    })
  })

  describe('analyzeBuildResult', () => {
    it('should analyze build result', async () => {
      const mockLogger = createMockLogger()
      const result: BuildResult = {
        success: true,
        outputs: [
          { fileName: 'index.js', size: 102400, type: 'chunk', format: 'esm' }
        ],
        duration: 1000,
        warnings: [],
        errors: [],
        buildId: 'build-1',
        timestamp: Date.now(),
        bundler: 'rollup',
        mode: 'production',
        libraryType: 'react'
      }

      await analyzeBuildResult(result, mockLogger as any)

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('📊'))
      expect(mockLogger.newLine).toHaveBeenCalled()
    })

    it('should display size analysis', async () => {
      const mockLogger = createMockLogger()
      const result: BuildResult = {
        success: true,
        outputs: [
          { fileName: 'index.js', size: 102400, type: 'chunk', format: 'esm' }
        ],
        duration: 1000,
        warnings: [],
        errors: [],
        buildId: 'build-1',
        timestamp: Date.now(),
        bundler: 'rollup',
        mode: 'production',
        libraryType: 'react'
      }

      await analyzeBuildResult(result, mockLogger as any)

      const calls = mockLogger.info.mock.calls
      const hasSizeInfo = calls.some((call: any) =>
        call[0].includes('📦') || call[0].includes('体积')
      )
      expect(hasSizeInfo).toBe(true)
    })

    it('should display duplicates warning', async () => {
      const mockLogger = createMockLogger()
      const result: BuildResult = {
        success: true,
        outputs: [
          { fileName: 'index.js', size: 102400, type: 'chunk', format: 'esm' }
        ],
        duration: 1000,
        warnings: [],
        errors: [],
        buildId: 'build-1',
        timestamp: Date.now(),
        bundler: 'rollup',
        mode: 'production',
        libraryType: 'react'
      }

      await analyzeBuildResult(result, mockLogger as any)

      expect(mockLogger.warn).toHaveBeenCalled()
    })

    it('should display optimization suggestions', async () => {
      const mockLogger = createMockLogger()
      const result: BuildResult = {
        success: true,
        outputs: [
          { fileName: 'index.js', size: 102400, type: 'chunk', format: 'esm' }
        ],
        duration: 1000,
        warnings: [],
        errors: [],
        buildId: 'build-1',
        timestamp: Date.now(),
        bundler: 'rollup',
        mode: 'production',
        libraryType: 'react'
      }

      await analyzeBuildResult(result, mockLogger as any)

      const calls = mockLogger.info.mock.calls
      const hasSuggestions = calls.some((call: any) =>
        call[0].includes('💡') || call[0].includes('优化建议')
      )
      expect(hasSuggestions).toBe(true)
    })

    it('should complete analysis successfully', async () => {
      const mockLogger = createMockLogger()
      const result: BuildResult = {
        success: true,
        outputs: [],
        duration: 1000,
        warnings: [],
        errors: [],
        buildId: 'build-1',
        timestamp: Date.now(),
        bundler: 'rollup',
        mode: 'production',
        libraryType: 'react'
      }

      await analyzeBuildResult(result, mockLogger as any)

      expect(mockLogger.success).toHaveBeenCalledWith(expect.stringContaining('✅'))
    })
  })

  describe('error handling', () => {
    it('showBuildInfo should handle null config gracefully', () => {
      const mockLogger = createMockLogger()
      const config: BuilderConfig = {}

      expect(() => showBuildInfo(config, mockLogger as any)).not.toThrow()
    })

    it('showBuildResult should handle malformed result', () => {
      const mockLogger = createMockLogger()
      const result: any = {
        success: true
        // Missing required fields
      }

      expect(() =>
        showBuildResult(result, Date.now(), mockLogger as any)
      ).not.toThrow()
    })

    it('should handle empty outputs array', () => {
      const mockLogger = createMockLogger()
      const result: BuildResult = {
        success: true,
        outputs: [],
        duration: 1000,
        warnings: [],
        errors: [],
        buildId: 'build-1',
        timestamp: Date.now(),
        bundler: 'rollup',
        mode: 'production',
        libraryType: 'react'
      }

      expect(() =>
        showBuildResult(result, Date.now(), mockLogger as any)
      ).not.toThrow()
    })
  })
})
