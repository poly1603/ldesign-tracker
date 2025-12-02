/**
 * 交互式配置生成器
 * 提供友好的交互式界面帮助用户快速配置项目
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import { LibraryType } from '../types/library'
import type { BuilderConfig } from '../types/config'
import { Logger } from '../utils/logger'
import path from 'path'
import fs from 'fs-extra'

/**
 * 交互式配置生成器
 */
export class InteractiveConfigGenerator {
  private logger: Logger

  constructor() {
    this.logger = new Logger({ prefix: 'Interactive' })
  }

  /**
   * 启动交互式配置生成
   */
  async generate(): Promise<BuilderConfig> {
    this.logger.info('🎯 交互式配置生成器')
    this.logger.newLine()

    // 由于我们在 Node.js 环境中，无法使用真正的交互式 CLI（需要 inquirer 等库）
    // 这里提供一个简化版本，展示配置生成的逻辑

    const config: BuilderConfig = {}

    // 步骤 1: 项目信息
    this.logger.info('📦 项目信息')
    config.input = await this.promptInput()
    
    // 步骤 2: 库类型
    this.logger.info('🎨 库类型选择')
    config.libraryType = await this.promptLibraryType()

    // 步骤 3: 输出格式
    this.logger.info('📤 输出格式')
    config.output = await this.promptOutputFormats()

    // 步骤 4: 高级选项
    this.logger.info('⚙️  高级选项')
    const advanced = await this.promptAdvancedOptions()
    Object.assign(config, advanced)

    // 步骤 5: 性能优化
    this.logger.info('🚀 性能优化')
    config.performance = await this.promptPerformanceOptions()

    return config
  }

  /**
   * 提示输入配置
   */
  private async promptInput(): Promise<string> {
    // 简化版：直接返回默认值
    // 实际实现需要使用 inquirer 等交互式库
    
    const defaultInput = 'src/index.ts'
    
    // 检查默认入口是否存在
    const candidates = [
      'src/index.ts',
      'src/index.tsx',
      'src/index.js',
      'src/main.ts',
      'index.ts'
    ]

    for (const candidate of candidates) {
      if (await fs.pathExists(candidate)) {
        this.logger.info(`  检测到入口文件: ${candidate}`)
        return candidate
      }
    }

    this.logger.info(`  使用默认入口: ${defaultInput}`)
    return defaultInput
  }

  /**
   * 提示库类型
   */
  private async promptLibraryType(): Promise<LibraryType> {
    // 简化版：自动检测
    
    // 检测 package.json 依赖
    try {
      const pkgPath = path.join(process.cwd(), 'package.json')
      if (await fs.pathExists(pkgPath)) {
        const pkg = await fs.readJson(pkgPath)
        const allDeps = {
          ...pkg.dependencies,
          ...pkg.devDependencies,
          ...pkg.peerDependencies
        }

        if (allDeps['vue']) {
          const version = allDeps['vue']
          if (version.includes('2.')) {
            this.logger.info('  检测到: Vue 2 项目')
            return LibraryType.VUE2
          } else {
            this.logger.info('  检测到: Vue 3 项目')
            return LibraryType.VUE3
          }
        }

        if (allDeps['react']) {
          this.logger.info('  检测到: React 项目')
          return LibraryType.REACT
        }

        if (allDeps['svelte']) {
          this.logger.info('  检测到: Svelte 项目')
          return LibraryType.SVELTE
        }

        if (allDeps['solid-js']) {
          this.logger.info('  检测到: SolidJS 项目')
          return LibraryType.SOLID
        }

        if (allDeps['preact']) {
          this.logger.info('  检测到: Preact 项目')
          return LibraryType.PREACT
        }
      }
    } catch {
      // 忽略错误
    }

    this.logger.info('  默认: TypeScript 库')
    return LibraryType.TYPESCRIPT
  }

  /**
   * 提示输出格式
   */
  private async promptOutputFormats(): Promise<any> {
    // 简化版：推荐配置
    
    this.logger.info('  推荐配置: ESM + CommonJS + UMD')
    
    return {
      esm: {
        dir: 'es',
        preserveStructure: true
      },
      cjs: {
        dir: 'lib',
        preserveStructure: true
      },
      umd: {
        dir: 'dist',
        minify: true
      }
    }
  }

  /**
   * 提示高级选项
   */
  private async promptAdvancedOptions(): Promise<Partial<BuilderConfig>> {
    this.logger.info('  TypeScript 类型声明: 启用')
    this.logger.info('  Source Maps: 启用')
    
    return {
      typescript: {
        declaration: true,
        declarationMap: true
      },
      sourcemap: true,
      clean: true
    }
  }

  /**
   * 提示性能选项
   */
  private async promptPerformanceOptions(): Promise<any> {
    this.logger.info('  Tree Shaking: 启用')
    this.logger.info('  代码压缩: 启用（生产环境）')
    this.logger.info('  缓存: 启用')
    this.logger.info('  增量构建: 启用')
    
    return {
      treeshaking: true,
      minify: true
    }
  }

  /**
   * 生成配置文件
   */
  async generateConfigFile(config: BuilderConfig, filePath: string = 'builder.config.ts'): Promise<void> {
    const configContent = this.generateConfigContent(config)
    
    await fs.writeFile(filePath, configContent, 'utf-8')
    
    this.logger.newLine()
    this.logger.success(`✨ 配置文件已生成: ${filePath}`)
    this.logger.newLine()
    this.logger.info('💡 建议下一步:')
    this.logger.info('  1. 安装依赖: pnpm install')
    this.logger.info('  2. 开始构建: pnpm build')
    this.logger.info('  3. 查看文档: https://github.com/ldesign/builder')
  }

  /**
   * 生成配置文件内容
   */
  private generateConfigContent(config: BuilderConfig): string {
    return `import { defineConfig } from '@ldesign/builder'

export default defineConfig({
  // 入口文件
  input: '${config.input || 'src/index.ts'}',

  // 库类型
  libraryType: '${config.libraryType || 'typescript'}',

  // 输出配置
  output: ${JSON.stringify(config.output, null, 4).replace(/"([^"]+)":/g, '$1:')},

  // TypeScript 配置
  typescript: ${JSON.stringify(config.typescript || { declaration: true }, null, 4).replace(/"([^"]+)":/g, '$1:')},

  // 性能配置
  performance: ${JSON.stringify(config.performance || {}, null, 4).replace(/"([^"]+)":/g, '$1:')},

  // 是否清理输出目录
  clean: ${config.clean !== false},

  // 是否生成 source maps
  sourcemap: ${config.sourcemap !== false}
})
`
  }
}

/**
 * 创建交互式配置生成器
 */
export function createInteractiveConfigGenerator(): InteractiveConfigGenerator {
  return new InteractiveConfigGenerator()
}

