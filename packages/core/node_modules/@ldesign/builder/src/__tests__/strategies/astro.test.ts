/**
 * Astro 策略测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { AstroStrategy } from '../../strategies/astro/AstroStrategy'

describe('AstroStrategy', () => {
  let strategy: AstroStrategy

  beforeEach(() => {
    strategy = new AstroStrategy()
  })

  it('should create strategy instance', () => {
    expect(strategy).toBeDefined()
    expect(strategy.name).toBe('astro')
    expect(strategy.priority).toBe(80)
  })

  it('should match astro project', async () => {
    const context = {
      projectPath: '/test',
      packageJson: {
        dependencies: {
          astro: '^3.0.0'
        }
      }
    }

    const matches = await strategy.match(context)
    expect(matches).toBe(true)
  })

  it('should apply strategy config', async () => {
    const baseConfig = {}
    const context = {
      projectPath: '/test',
      packageJson: {}
    }

    const config = await strategy.applyStrategy(baseConfig, context)
    expect(config.external).toContain('astro')
    expect(config.output?.esm).toBeDefined()
  })

  it('should validate config', async () => {
    const config = {
      output: { format: 'esm' }
    }
    const context = {
      projectPath: '/test',
      packageJson: {}
    }

    const validation = await strategy.validate(config as any, context)
    expect(validation.valid).toBe(true)
  })

  it('should provide recommendations', () => {
    const context = {
      projectPath: '/test',
      packageJson: {}
    }

    const recommendations = strategy.getRecommendations(context)
    expect(recommendations.length).toBeGreaterThan(0)
  })
})

