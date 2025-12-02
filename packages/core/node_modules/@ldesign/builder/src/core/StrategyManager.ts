/**
 * 策略管理器
 * 
 * 负责管理不同库类型的构建策略
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import type {
  ILibraryStrategy,
  StrategyManagerOptions,
  StrategyDetectionResult,
  StrategyApplicationResult
} from '../types/strategy'
import { LibraryType } from '../types/library'
import type { BuilderConfig } from '../types/config'
import { Logger } from '../utils/logger'
import { ErrorHandler, BuilderError } from '../utils/error-handler'
import { ErrorCode } from '../constants/errors'

// 导入具体策略实现
import { TypeScriptStrategy } from '../strategies/typescript/TypeScriptStrategy'
import { StyleStrategy } from '../strategies/style/StyleStrategy'
import { Vue3Strategy } from '../strategies/vue3/Vue3Strategy'
import { Vue2Strategy } from '../strategies/vue2/Vue2Strategy'
import { ReactStrategy } from '../strategies/react/ReactStrategy'
import { SvelteStrategy } from '../strategies/svelte/SvelteStrategy'
import { SolidStrategy } from '../strategies/solid/SolidStrategy'
import { PreactStrategy } from '../strategies/preact/PreactStrategy'
import { LitStrategy } from '../strategies/lit/LitStrategy'
import { AngularStrategy } from '../strategies/angular/AngularStrategy'
import { MixedStrategy } from '../strategies/mixed/MixedStrategy'
import { MixedFrameworkAdapter } from '../strategies/mixed/MixedFrameworkAdapter'


/**
 * 策略管理器类
 */
export class StrategyManager {
  private logger: Logger
  private errorHandler: ErrorHandler
  private strategies: Map<LibraryType, ILibraryStrategy> = new Map()

  constructor(_options: StrategyManagerOptions = {}) {
    this.logger = (_options as any).logger || new Logger()
    this.errorHandler = new ErrorHandler({ logger: this.logger })

    // 注册默认策略
    this.registerDefaultStrategies()
  }

  /**
   * 注册策略
   */
  registerStrategy(strategy: ILibraryStrategy): void {
    for (const type of strategy.supportedTypes) {
      this.strategies.set(type, strategy)
    }

    this.logger.debug(`注册策略: ${strategy.name}`)
  }

  /**
   * 获取策略
   */
  getStrategy(libraryType: LibraryType): ILibraryStrategy {
    const strategy = this.strategies.get(libraryType)

    if (!strategy) {
      throw new BuilderError(
        ErrorCode.CONFIG_VALIDATION_ERROR,
        `未找到库类型 ${libraryType} 的策略`
      )
    }

    return strategy
  }

  /**
   * 检测最佳策略
   *
   * @param projectPath - 项目路径
   * @returns 策略检测结果
   */
  async detectStrategy(projectPath: string): Promise<StrategyDetectionResult> {
    const fs = await import('fs-extra')
    const path = await import('path')
    const evidence: string[] = []
    const alternatives: LibraryType[] = []
    let detectedStrategy: LibraryType = LibraryType.TYPESCRIPT
    let confidence = 0.5

    try {
      // 读取 package.json
      const packageJsonPath = path.join(projectPath, 'package.json')
      if (await fs.pathExists(packageJsonPath)) {
        const packageJson = await fs.readJSON(packageJsonPath)

        // 检测 Vue
        if (packageJson.dependencies?.vue || packageJson.devDependencies?.vue) {
          const vueVersion = packageJson.dependencies?.vue || packageJson.devDependencies?.vue
          if (vueVersion.startsWith('^3') || vueVersion.startsWith('3')) {
            detectedStrategy = LibraryType.VUE3
            confidence = 0.9
            evidence.push('检测到 Vue 3 依赖')
          } else if (vueVersion.startsWith('^2') || vueVersion.startsWith('2')) {
            detectedStrategy = LibraryType.VUE2
            confidence = 0.9
            evidence.push('检测到 Vue 2 依赖')
          }
        }

        // 检测 React
        if (packageJson.dependencies?.react || packageJson.devDependencies?.react) {
          if (detectedStrategy === LibraryType.TYPESCRIPT) {
            detectedStrategy = LibraryType.REACT
            confidence = 0.9
            evidence.push('检测到 React 依赖')
          } else {
            alternatives.push(LibraryType.REACT)
          }
        }

        // 检测 Svelte
        if (packageJson.dependencies?.svelte || packageJson.devDependencies?.svelte) {
          if (detectedStrategy === LibraryType.TYPESCRIPT) {
            detectedStrategy = LibraryType.SVELTE
            confidence = 0.9
            evidence.push('检测到 Svelte 依赖')
          } else {
            alternatives.push(LibraryType.SVELTE)
          }
        }

        // 检测 Solid
        if (packageJson.dependencies?.['solid-js'] || packageJson.devDependencies?.['solid-js']) {
          if (detectedStrategy === LibraryType.TYPESCRIPT) {
            detectedStrategy = LibraryType.SOLID
            confidence = 0.9
            evidence.push('检测到 Solid.js 依赖')
          } else {
            alternatives.push(LibraryType.SOLID)
          }
        }

        // 检测 Angular
        if (packageJson.dependencies?.['@angular/core'] || packageJson.devDependencies?.['@angular/core']) {
          if (detectedStrategy === LibraryType.TYPESCRIPT) {
            detectedStrategy = LibraryType.ANGULAR
            confidence = 0.9
            evidence.push('检测到 Angular 依赖')
          } else {
            alternatives.push(LibraryType.ANGULAR)
          }
        }
      }

      // 检查文件扩展名
      const srcPath = path.join(projectPath, 'src')
      if (await fs.pathExists(srcPath)) {
        const fastGlob = await import('fast-glob')
        const glob = fastGlob.default || fastGlob
        const files = await glob.async('**/*.{vue,jsx,tsx,svelte}', {
          cwd: srcPath,
          absolute: false
        })

        if (files.some((f: string) => f.endsWith('.vue'))) {
          evidence.push('发现 .vue 文件')
          if (detectedStrategy === LibraryType.TYPESCRIPT) {
            detectedStrategy = LibraryType.VUE3
            confidence = 0.7
          }
        }

        if (files.some((f: string) => f.endsWith('.jsx') || f.endsWith('.tsx'))) {
          evidence.push('发现 JSX/TSX 文件')
          if (detectedStrategy === LibraryType.TYPESCRIPT) {
            detectedStrategy = LibraryType.REACT
            confidence = 0.7
          }
        }

        if (files.some((f: string) => f.endsWith('.svelte'))) {
          evidence.push('发现 .svelte 文件')
          if (detectedStrategy === LibraryType.TYPESCRIPT) {
            detectedStrategy = LibraryType.SVELTE
            confidence = 0.7
          }
        }
      }

      // 如果没有检测到任何框架，默认为 TypeScript
      if (detectedStrategy === LibraryType.TYPESCRIPT && evidence.length === 0) {
        evidence.push('未检测到特定框架，使用 TypeScript 策略')
        confidence = 0.6
      }

    } catch (error) {
      // 检测失败，使用默认策略
      evidence.push('检测过程中出错，使用默认策略')
    }

    return {
      strategy: detectedStrategy,
      confidence,
      evidence: evidence.map(e => ({ type: 'file' as const, description: e, weight: 1 })),
      alternatives: alternatives.map(alt => ({ strategy: alt, confidence: 0.5 }))
    }
  }

  /**
   * 应用策略
   */
  async applyStrategy(
    libraryType: LibraryType,
    config: BuilderConfig
  ): Promise<StrategyApplicationResult> {
    const startTime = Date.now()

    try {
      const strategy = this.getStrategy(libraryType)

      // 验证策略是否适用
      if (!strategy.isApplicable(config)) {
        throw new BuilderError(
          ErrorCode.CONFIG_VALIDATION_ERROR,
          `策略 ${strategy.name} 不适用于当前配置`
        )
      }

      // 应用策略
      const transformedConfig = await strategy.applyStrategy(config)
      const plugins = strategy.getRecommendedPlugins(config)

      const duration = Date.now() - startTime

      return {
        strategy,
        config: transformedConfig,
        plugins,
        duration,
        warnings: [],
        optimizations: []
      }

    } catch (error) {
      this.errorHandler.handle(error as Error, 'applyStrategy')
      throw error
    }
  }

  /**
   * 获取所有已注册的策略
   */
  getAllStrategies(): ILibraryStrategy[] {
    return Array.from(this.strategies.values())
  }

  /**
   * 获取支持的库类型
   */
  getSupportedTypes(): LibraryType[] {
    return Array.from(this.strategies.keys())
  }

  /**
   * 注册默认策略
   */
  private registerDefaultStrategies(): void {
    // TypeScript 策略
    this.registerStrategy(new TypeScriptStrategy())

    // Vue3 策略
    this.registerStrategy(new Vue3Strategy())

    // Vue2 策略
    this.registerStrategy(new Vue2Strategy())

    // 样式策略
    this.registerStrategy(new StyleStrategy())

    // React 策略
    this.registerStrategy(new ReactStrategy())

    // Svelte 策略
    this.registerStrategy(new SvelteStrategy())

    // Solid 策略
    this.registerStrategy(new SolidStrategy())

    // Preact 策略
    this.registerStrategy(new PreactStrategy())

    // Lit / Web Components 策略
    this.registerStrategy(new LitStrategy())

    // Angular（基础）策略
    this.registerStrategy(new AngularStrategy())

    // 混合策略
    this.registerStrategy(new MixedStrategy())

    // 增强混合策略（混合框架适配器）
    this.registerStrategy(new MixedFrameworkAdapter())
  }
}
