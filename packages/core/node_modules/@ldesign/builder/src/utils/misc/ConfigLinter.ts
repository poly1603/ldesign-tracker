/**
 * Config Linter
 * Validates all package configurations in the monorepo
 */

import * as path from 'path'
import * as fs from 'fs-extra'
import { glob } from 'glob'
import { createLogger } from '../logger'
import { normalizeConfig, type NormalizationWarning } from '../../config/config-normalizer'
import type { BuilderConfig } from '../../types/config'

const logger = createLogger({ prefix: 'ConfigLinter' })

export interface LintResult {
  package: string
  configPath: string
  valid: boolean
  warnings: NormalizationWarning[]
  errors: string[]
}

export interface LintSummary {
  total: number
  passed: number
  warnings: number
  errors: number
  results: LintResult[]
}

export class ConfigLinter {
  private rootDir: string

  constructor(rootDir = process.cwd()) {
    this.rootDir = rootDir
  }

  /**
   * Lint all package configurations
   */
  async lintAll(pattern = 'packages/*/ldesign.config.ts'): Promise<LintSummary> {
    const configFiles = await glob(pattern, {
      cwd: this.rootDir,
      absolute: true,
    })

    logger.info(`\n📋 Found ${configFiles.length} package configurations\n`)

    const results: LintResult[] = []

    for (const configPath of configFiles) {
      const result = await this.lintConfig(configPath)
      results.push(result)
    }

    return this.generateSummary(results)
  }

  /**
   * Lint a single configuration file
   */
  async lintConfig(configPath: string): Promise<LintResult> {
    const packageName = this.getPackageName(configPath)
    const errors: string[] = []
    let config: BuilderConfig | null = null

    // Check if file exists
    if (!await fs.pathExists(configPath)) {
      errors.push('Configuration file not found')
      return {
        package: packageName,
        configPath,
        valid: false,
        warnings: [],
        errors,
      }
    }

    // Try to load the configuration
    try {
      // Note: In production, you'd use dynamic import or jiti
      // For now, we'll do basic file reading and validation
      const content = await fs.readFile(configPath, 'utf-8')

      // Basic syntax checks
      if (!content.includes('defineConfig')) {
        errors.push('Configuration must use defineConfig')
      }

      if (!content.includes('export default')) {
        errors.push('Configuration must have default export')
      }

      // Check for common issues in the content
      const issues = this.checkConfigContent(content)
      errors.push(...issues)

    } catch (error) {
      errors.push(`Failed to read config: ${(error as Error).message}`)
    }

    // Normalize if we can load it
    let warnings: NormalizationWarning[] = []
    if (errors.length === 0 && config) {
      const normalized = normalizeConfig(config, false)
      warnings = normalized.warnings
    }

    return {
      package: packageName,
      configPath,
      valid: errors.length === 0,
      warnings,
      errors,
    }
  }

  /**
   * Check config file content for common issues
   */
  private checkConfigContent(content: string): string[] {
    const issues: string[] = []

    // Check for duplicate UMD configs
    const umdMatches = content.match(/umd\s*:/g)
    if (umdMatches && umdMatches.length > 1) {
      // Check if one is in output and one is top-level
      if (content.includes('output:') && content.includes('umd:')) {
        const outputIndex = content.indexOf('output:')
        const firstUmdIndex = content.indexOf('umd:')
        const lastUmdIndex = content.lastIndexOf('umd:')

        if (firstUmdIndex < outputIndex && lastUmdIndex > outputIndex) {
          issues.push('Duplicate UMD configuration detected (top-level and in output)')
        }
      }
    }

    // Check for redundant libraryType
    if (content.includes("libraryType: 'typescript'")) {
      issues.push("Redundant 'libraryType: typescript' (auto-detected)")
    }

    // Check for redundant typescript.declaration
    if (content.includes('dts: true') && content.includes('typescript:') && content.includes('declaration:')) {
      issues.push('Redundant typescript.declaration settings (handled by dts: true)')
    }

    // Check for standard output directories
    if (!content.includes("dir: 'es'")) {
      issues.push("Missing standard ESM output directory 'es'")
    }
    if (!content.includes("dir: 'lib'")) {
      issues.push("Missing standard CJS output directory 'lib'")
    }
    if (!content.includes("dir: 'dist'")) {
      issues.push("Missing standard UMD output directory 'dist'")
    }

    return issues
  }

  /**
   * Get package name from config path
   */
  private getPackageName(configPath: string): string {
    const parts = configPath.split(path.sep)
    const packagesIndex = parts.findIndex(p => p === 'packages')
    if (packagesIndex >= 0 && parts.length > packagesIndex + 1) {
      return parts[packagesIndex + 1]
    }
    return path.basename(path.dirname(configPath))
  }

  /**
   * Generate summary from results
   */
  private generateSummary(results: LintResult[]): LintSummary {
    const total = results.length
    const passed = results.filter(r => r.valid && r.warnings.length === 0).length
    const hasWarnings = results.filter(r => r.warnings.length > 0).length
    const hasErrors = results.filter(r => !r.valid).length

    return {
      total,
      passed,
      warnings: hasWarnings,
      errors: hasErrors,
      results,
    }
  }

  /**
   * Print summary to console
   */
  printSummary(summary: LintSummary): void {
    logger.info('\n' + '='.repeat(60))
    logger.info('Configuration Lint Summary')
    logger.info('='.repeat(60) + '\n')

    // Print results for each package
    for (const result of summary.results) {
      const status = result.valid && result.warnings.length === 0
        ? '✅'
        : result.valid
          ? '⚠️'
          : '❌'

      logger.info(`${status} ${result.package}`)

      if (result.errors.length > 0) {
        result.errors.forEach(err => {
          logger.error(`   ❌ ${err}`)
        })
      }

      if (result.warnings.length > 0) {
        result.warnings.forEach(warn => {
          logger.warn(`   ⚠️  [${warn.type}] ${warn.field}: ${warn.message}`)
          if (warn.suggestion) {
            logger.info(`      💡 ${warn.suggestion}`)
          }
        })
      }

      logger.info('')
    }

    // Print summary stats
    logger.info('='.repeat(60))
    logger.info(`Total Packages: ${summary.total}`)
    logger.success(`✅ Passed: ${summary.passed}`)
    if (summary.warnings > 0) {
      logger.warn(`⚠️  With Warnings: ${summary.warnings}`)
    }
    if (summary.errors > 0) {
      logger.error(`❌ With Errors: ${summary.errors}`)
    }
    logger.info('='.repeat(60) + '\n')

    // Exit code
    if (summary.errors > 0) {
      process.exitCode = 1
    }
  }
}

/**
 * Factory function
 */
export function createConfigLinter(rootDir?: string): ConfigLinter {
  return new ConfigLinter(rootDir)
}

/**
 * CLI entry point
 */
export async function lintConfigs(pattern?: string, rootDir?: string): Promise<void> {
  const linter = createConfigLinter(rootDir)
  const summary = await linter.lintAll(pattern)
  linter.printSummary(summary)
}


