/**
 * 配置解析器
 * 
 * 负责配置的解析、合并、验证和增强,包括:
 * - 配置文件加载
 * - 配置合并
 * - 配置验证
 * - 自动配置增强
 * - 库类型检测
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import type { BuilderConfig } from '../types/config'
import type { ValidationResult } from '../types/common'
import type { LibraryType } from '../types/library'
import type { SimpleConfig } from '../config/simple-config'
import { ConfigManager } from './ConfigManager'
import { LibraryDetector } from './LibraryDetector'
// import { AutoConfigEnhancer } from '../utils/auto-config-enhancer' // 已删除
import { Logger } from '../utils/logger'
import { DEFAULT_BUILDER_CONFIG } from '../constants/defaults'
import { expandSimpleConfig } from '../config/simple-config'
import { hasPreset } from '../presets'

/**
 * 配置解析选项
 */
export interface ConfigResolverOptions {
  /** 日志记录器 */
  logger?: Logger

  /** 是否启用自动增强 */
  autoEnhance?: boolean

  /** 是否启用库类型检测 */
  autoDetect?: boolean

  /** 配置文件路径 */
  configFile?: string
}

/**
 * 配置解析器
 */
export class ConfigResolver {
  private configManager: ConfigManager
  private libraryDetector: LibraryDetector
  private logger: Logger
  private options: ConfigResolverOptions

  constructor(options: ConfigResolverOptions = {}) {
    this.logger = options.logger || new Logger()
    this.options = {
      autoEnhance: true,
      autoDetect: true,
      ...options
    }

    this.configManager = new ConfigManager({ logger: this.logger })
    this.libraryDetector = new LibraryDetector({ logger: this.logger })
  }

  /**
   * 解析配置 (支持简化配置)
   *
   * @param config 用户配置 (支持简化配置或完整配置)
   * @param projectPath 项目路径
   * @returns 解析后的完整配置
   */
  async resolveConfig(
    config: BuilderConfig | SimpleConfig = {},
    projectPath?: string
  ): Promise<BuilderConfig> {
    this.logger.debug('开始解析配置...')

    // 0. 检测并转换简化配置
    let userConfig = config as BuilderConfig
    if (this.isSimpleConfig(config)) {
      this.logger.debug('检测到简化配置,正在转换...')
      userConfig = expandSimpleConfig(config as SimpleConfig)
      this.logger.debug('简化配置转换完成')
    }

    // 1. 加载配置文件 (如果指定)
    let fileConfig: BuilderConfig = {}
    if (this.options.configFile) {
      fileConfig = await this.loadConfigFile(this.options.configFile)
    }

    // 2. 合并配置 (默认配置 < 文件配置 < 用户配置)
    let mergedConfig = this.mergeConfigs(
      DEFAULT_BUILDER_CONFIG,
      fileConfig,
      userConfig
    )

    // 3. 设置项目路径
    const resolvedProjectPath = projectPath || (mergedConfig as any).cwd || process.cwd()
    mergedConfig = {
      ...mergedConfig,
      projectPath: resolvedProjectPath
    }

    // 4. 自动检测库类型 (如果启用且未指定)
    if (this.options.autoDetect && !mergedConfig.libraryType) {
      mergedConfig.libraryType = await this.detectLibraryType(resolvedProjectPath)
      this.logger.info(`自动检测库类型: ${mergedConfig.libraryType}`)
    }

    // 5. 自动增强配置 (如果启用)
    if (this.options.autoEnhance) {
      mergedConfig = await this.enhanceConfig(mergedConfig, resolvedProjectPath)
    }

    // 6. 验证配置
    const validation = this.validateConfig(mergedConfig)
    if (!validation.valid) {
      this.logger.warn('配置验证发现问题:')
      validation.errors.forEach(error => this.logger.error(`  - ${error}`))
      validation.warnings.forEach(warning => this.logger.warn(`  - ${warning}`))
    }

    this.logger.debug('配置解析完成')
    return mergedConfig
  }

  /**
   * 检测是否为简化配置
   */
  private isSimpleConfig(config: any): boolean {
    // 如果配置中包含 preset 字段,或者只包含简化配置的字段,则认为是简化配置
    if ('preset' in config) {
      return true
    }

    // 简化配置的字段列表
    const simpleConfigFields = [
      'preset', 'input', 'outDir', 'formats', 'external',
      'dts', 'sourcemap', 'minify', 'mode', 'clean', 'globals', 'name'
    ]

    const configKeys = Object.keys(config)

    // 如果所有字段都在简化配置字段列表中,则认为是简化配置
    return configKeys.length > 0 && configKeys.every(key => simpleConfigFields.includes(key))
  }

  /**
   * 加载配置文件
   */
  async loadConfigFile(configPath: string): Promise<BuilderConfig> {
    try {
      this.logger.debug(`加载配置文件: ${configPath}`)
      return await this.configManager.loadConfig({ configFile: configPath })
    } catch (error) {
      this.logger.warn(`加载配置文件失败: ${error}`)
      return {}
    }
  }

  /**
   * 合并多个配置
   */
  mergeConfigs(...configs: BuilderConfig[]): BuilderConfig {
    return configs.reduce((merged, config) => {
      return this.configManager.mergeConfigs(merged, config)
    }, {} as BuilderConfig)
  }

  /**
   * 验证配置
   */
  validateConfig(config: BuilderConfig): ValidationResult {
    return this.configManager.validateConfig(config)
  }

  /**
   * 检测库类型
   */
  async detectLibraryType(projectPath: string): Promise<LibraryType> {
    const result = await this.libraryDetector.detect(projectPath)
    return result.type
  }

  /**
   * 增强配置
   */
  async enhanceConfig(
    config: BuilderConfig,
    projectPath: string
  ): Promise<BuilderConfig> {
    this.logger.debug('自动增强配置功能已禁用')

    // const enhancer = new AutoConfigEnhancer(projectPath, this.logger)
    // const enhanced = await enhancer.enhanceConfig(config)

    // this.logger.debug('配置自动增强完成')
    return config // 直接返回原配置
  }

  /**
   * 获取配置管理器
   */
  getConfigManager(): ConfigManager {
    return this.configManager
  }

  /**
   * 获取库类型检测器
   */
  getLibraryDetector(): LibraryDetector {
    return this.libraryDetector
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    // 清理资源
  }
}

