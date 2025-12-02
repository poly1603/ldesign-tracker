/**
 * 目标环境推断器
 *
 * 从 package.json 的 engines 字段和 browserslist 配置自动推断构建目标
 *
 * @author LDesign Team
 * @version 1.0.0
 */

import path from 'path'
import { exists, readFile } from '../file-system'

/**
 * 目标环境推断结果
 */
export interface TargetEnvironmentResult {
  /** 目标平台 */
  platform: 'browser' | 'node' | 'neutral'
  /** ES 目标版本 */
  esTarget: string
  /** Node.js 目标版本 */
  nodeTarget?: string
  /** 浏览器目标列表 */
  browserTargets?: string[]
  /** 推断置信度 (0-1) */
  confidence: number
  /** 推断来源 */
  source: 'engines' | 'browserslist' | 'type' | 'default'
  /** 推断证据 */
  evidence: string[]
}

/**
 * 目标环境推断器选项
 */
export interface TargetInferrerOptions {
  /** 默认 ES 目标 */
  defaultEsTarget?: string
  /** 默认 Node 目标 */
  defaultNodeTarget?: string
}

/**
 * 目标环境推断器
 */
export class TargetInferrer {
  private options: Required<TargetInferrerOptions>

  constructor(options: TargetInferrerOptions = {}) {
    this.options = {
      defaultEsTarget: options.defaultEsTarget || 'es2020',
      defaultNodeTarget: options.defaultNodeTarget || '18'
    }
  }

  /**
   * 推断目标环境
   */
  async infer(projectPath: string): Promise<TargetEnvironmentResult> {
    const pkgPath = path.join(projectPath, 'package.json')
    if (!await exists(pkgPath)) return this.getDefaultResult()

    try {
      const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'))

      let result = this.inferFromEngines(pkg)
      if (result.confidence >= 0.8) return result

      result = await this.inferFromBrowserslist(projectPath, pkg)
      if (result.confidence >= 0.7) return result

      result = this.inferFromPackageType(pkg)
      if (result.confidence >= 0.6) return result

      return this.getDefaultResult()
    } catch {
      return this.getDefaultResult()
    }
  }

  /**
   * 从 engines 字段推断
   */
  private inferFromEngines(pkg: Record<string, any>): TargetEnvironmentResult {
    const engines = pkg.engines
    if (!engines) return { ...this.getDefaultResult(), confidence: 0 }

    const evidence: string[] = []
    let platform: 'browser' | 'node' | 'neutral' = 'neutral'
    let esTarget = this.options.defaultEsTarget
    let nodeTarget: string | undefined

    if (engines.node) {
      const version = this.parseNodeVersion(engines.node)
      if (version) {
        nodeTarget = version
        esTarget = this.nodeVersionToEsTarget(version)
        platform = 'node'
        evidence.push(`engines.node: ${engines.node} -> Node ${version}, ES ${esTarget}`)
      }
    }

    if (engines.browsers || engines.browser) {
      platform = engines.node ? 'neutral' : 'browser'
      evidence.push('检测到 engines.browsers 字段')
    }

    return { platform, esTarget, nodeTarget, confidence: evidence.length > 0 ? 0.85 : 0, source: 'engines', evidence }
  }

  /**
   * 从 browserslist 推断
   */
  private async inferFromBrowserslist(projectPath: string, pkg: Record<string, any>): Promise<TargetEnvironmentResult> {
    const evidence: string[] = []
    let browserTargets: string[] = []

    if (pkg.browserslist) {
      browserTargets = Array.isArray(pkg.browserslist) ? pkg.browserslist : [pkg.browserslist]
      evidence.push('从 package.json browserslist 读取')
    }

    const rcPath = path.join(projectPath, '.browserslistrc')
    if (await exists(rcPath)) {
      const content = await readFile(rcPath, 'utf-8')
      browserTargets = content.split('\n').filter(l => l.trim() && !l.startsWith('#'))
      evidence.push('从 .browserslistrc 读取')
    }

    if (browserTargets.length === 0) return { ...this.getDefaultResult(), confidence: 0 }

    const esTarget = this.browserslistToEsTarget(browserTargets)
    evidence.push(`推断 ES 目标: ${esTarget}`)

    return { platform: 'browser', esTarget, browserTargets, confidence: 0.8, source: 'browserslist', evidence }
  }

  /**
   * 从 package.json type 字段推断
   */
  private inferFromPackageType(pkg: Record<string, any>): TargetEnvironmentResult {
    const evidence: string[] = []
    let platform: 'browser' | 'node' | 'neutral' = 'neutral'

    if (pkg.type === 'module') evidence.push('package.json type 为 module')
    if (pkg.browser) { platform = 'browser'; evidence.push('检测到 browser 字段') }

    const deps = { ...pkg.dependencies, ...pkg.peerDependencies }
    const browserDeps = ['react', 'vue', 'svelte', 'solid-js', 'preact', '@angular/core']
    const nodeDeps = ['express', 'koa', 'fastify', 'fs-extra']

    if (browserDeps.some(d => deps[d])) { platform = 'browser'; evidence.push('检测到浏览器框架依赖') }
    else if (nodeDeps.some(d => deps[d])) { platform = 'node'; evidence.push('检测到 Node.js 框架依赖') }

    return { platform, esTarget: this.options.defaultEsTarget, confidence: evidence.length > 0 ? 0.6 : 0, source: 'type', evidence }
  }

  /** 解析 Node.js 版本字符串 */
  private parseNodeVersion(versionStr: string): string | null {
    const match = versionStr.match(/(\d+)/)
    return match ? match[1] : null
  }

  /** 将 Node.js 版本映射到 ES 目标 */
  private nodeVersionToEsTarget(nodeVersion: string): string {
    const v = parseInt(nodeVersion, 10)
    if (v >= 22) return 'es2024'
    if (v >= 21) return 'es2023'
    if (v >= 18) return 'es2022'
    if (v >= 16) return 'es2021'
    if (v >= 14) return 'es2020'
    if (v >= 12) return 'es2019'
    return 'es2017'
  }

  /** 将 browserslist 映射到 ES 目标 */
  private browserslistToEsTarget(targets: string[]): string {
    const str = targets.join(' ')
    if (str.includes('last 1') || str.includes('last 2')) return 'es2022'
    if (str.includes('> 1%') || str.includes('> 0.5%')) return 'es2020'
    if (str.includes('ie 11') || str.includes('ie11')) return 'es5'
    if (str.includes('chrome >= 80')) return 'es2020'
    if (str.includes('chrome >= 60')) return 'es2017'
    return 'es2020'
  }

  /** 获取默认结果 */
  private getDefaultResult(): TargetEnvironmentResult {
    return {
      platform: 'neutral',
      esTarget: this.options.defaultEsTarget,
      confidence: 0.3,
      source: 'default',
      evidence: ['使用默认目标环境配置']
    }
  }
}

/**
 * 创建目标环境推断器
 */
export function createTargetInferrer(options?: TargetInferrerOptions): TargetInferrer {
  return new TargetInferrer(options)
}
