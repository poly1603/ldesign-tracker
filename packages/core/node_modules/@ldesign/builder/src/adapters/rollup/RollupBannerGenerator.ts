/**
 * Rollup Banner 生成器
 * 
 * 负责生成 Banner、Footer、Intro、Outro 等代码注释
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import fs from 'fs'
import { execSync } from 'child_process'
import { BannerGenerator } from '../../utils/formatters/BannerGenerator'
import type { Logger } from '../../utils/logger'

/**
 * Rollup Banner 生成器
 */
export class RollupBannerGenerator {
  constructor(private logger: Logger) { }

  /**
   * 解析 Banner
   * 
   * @param bannerConfig - Banner 配置
   * @param config - 构建配置
   * @returns Banner 字符串
   */
  async resolveBanner(bannerConfig: any, config?: any): Promise<string | undefined> {
    // 显式禁用
    if (bannerConfig === false) return undefined

    const banners: string[] = []

    // 自定义 Banner
    if (bannerConfig && typeof bannerConfig.banner === 'function') {
      const customBanner = await bannerConfig.banner()
      if (customBanner) banners.push(customBanner)
    }
    else if (bannerConfig && typeof bannerConfig.banner === 'string' && bannerConfig.banner) {
      banners.push(bannerConfig.banner)
    }

    // 自动生成版权信息
    if (bannerConfig && (bannerConfig as any).copyright) {
      const copyright = this.generateCopyright((bannerConfig as any).copyright)
      if (copyright) banners.push(copyright)
    }

    // 自动生成构建信息
    if (bannerConfig && (bannerConfig as any).buildInfo) {
      const buildInfo = await this.generateBuildInfo((bannerConfig as any).buildInfo)
      if (buildInfo) banners.push(buildInfo)
    }

    if (banners.length > 0) return banners.join('\n')

    // 未提供任何 banner 配置时，自动生成默认 banner
    try {
      const projectInfo = await BannerGenerator.getProjectInfo()
      const auto = BannerGenerator.generate({
        bundler: 'rollup',
        bundlerVersion: undefined,
        ...projectInfo,
        buildMode: (config as any)?.mode || process.env.NODE_ENV || 'production',
        minified: Boolean((config as any)?.minify)
      })
      return auto
    }
    catch {
      return undefined
    }
  }

  /**
   * 解析 Footer
   * 
   * @param bannerConfig - Banner 配置
   * @returns Footer 字符串
   */
  async resolveFooter(bannerConfig: any): Promise<string | undefined> {
    if (bannerConfig === false) return undefined
    if (bannerConfig && typeof bannerConfig.footer === 'function') {
      return await bannerConfig.footer()
    }
    if (bannerConfig && typeof bannerConfig.footer === 'string') {
      return bannerConfig.footer
    }
    // 默认 Footer
    try {
      const info = await BannerGenerator.getProjectInfo()
      if (info.projectName) {
        return `/*! End of ${info.projectName} | Powered by @ldesign/builder */`
      }
    }
    catch { }
    return '/*! Powered by @ldesign/builder */'
  }

  /**
   * 解析 Intro
   * 
   * @param bannerConfig - Banner 配置
   * @returns Intro 字符串
   */
  async resolveIntro(bannerConfig: any): Promise<string | undefined> {
    if (!bannerConfig) return undefined
    if (typeof bannerConfig.intro === 'function') {
      return await bannerConfig.intro()
    }
    if (typeof bannerConfig.intro === 'string') {
      return bannerConfig.intro
    }
    return undefined
  }

  /**
   * 解析 Outro
   * 
   * @param bannerConfig - Banner 配置
   * @returns Outro 字符串
   */
  async resolveOutro(bannerConfig: any): Promise<string | undefined> {
    if (!bannerConfig) return undefined
    if (typeof bannerConfig.outro === 'function') {
      return await bannerConfig.outro()
    }
    if (typeof bannerConfig.outro === 'string') {
      return bannerConfig.outro
    }
    return undefined
  }

  /**
   * 生成版权信息
   * 
   * @param copyrightConfig - 版权配置
   * @returns 版权信息字符串
   */
  generateCopyright(copyrightConfig: any): string {
    const config = typeof copyrightConfig === 'object' ? copyrightConfig : {}
    const year = config.year || new Date().getFullYear()
    const owner = config.owner || 'Unknown'
    const license = config.license || 'MIT'

    if (config.template) {
      return config.template
        .replace(/\{year\}/g, year)
        .replace(/\{owner\}/g, owner)
        .replace(/\{license\}/g, license)
    }

    return `/*!\n * Copyright (c) ${year} ${owner}\n * Licensed under ${license}\n */`
  }

  /**
   * 生成构建信息
   *
   * @param buildInfoConfig - 构建信息配置
   * @returns 构建信息字符串
   */
  async generateBuildInfo(buildInfoConfig: any): Promise<string> {
    const config = typeof buildInfoConfig === 'object' ? buildInfoConfig : {}
    const parts: string[] = []

    if (config.version !== false) {
      try {
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'))
        parts.push(`Version: ${packageJson.version}`)
      }
      catch {
        // 忽略错误
      }
    }

    if (config.buildTime !== false) {
      parts.push(`Built: ${new Date().toISOString()}`)
    }

    if (config.environment !== false) {
      parts.push(`Environment: ${process.env.NODE_ENV || 'development'}`)
    }

    if (config.git !== false) {
      try {
        const commit = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
        parts.push(`Commit: ${commit}`)
      }
      catch {
        // 忽略错误
      }
    }

    if (config.template) {
      return config.template
    }

    return parts.length > 0 ? `/*!\n * ${parts.join('\n * ')}\n */` : ''
  }
}

