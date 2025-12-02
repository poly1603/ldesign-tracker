/**
 * Vue 3 DTS 类型声明生成器
 * 
 * 负责生成 Vue 3 项目的 TypeScript 类型声明文件
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import type { BuilderConfig } from '../../types/config'
import { createLogger, type Logger } from '../../utils/logger'

/**
 * Vue 3 DTS 生成器类
 */
export class Vue3DtsGenerator {
  private logger: Logger

  constructor() {
    this.logger = createLogger({ prefix: 'Vue3DTS' })
  }
  /**
   * 创建 DTS 文件生成插件
   * 
   * @param config 构建配置
   * @returns Rollup 插件
   */
  createDtsCopyPlugin(config?: BuilderConfig): any {
    return {
      name: 'generate-dts-files',
      writeBundle: async (options: any) => {
        const isSilent = config?.logLevel === 'silent'

        try {
          const outputDir = options.dir
          if (!outputDir) {
            if (!isSilent) {
              this.logger.warn('输出目录未指定，跳过 DTS 生成')
            }
            return
          }

          await this.generateDtsFiles(outputDir, config)
        } catch (error) {
          if (!isSilent) {
            this.logger.warn('处理 DTS 文件失败:', error instanceof Error ? error.message : String(error))
          }
        }
      }
    }
  }

  /**
   * 使用 TypeScript 编译器生成 DTS 文件
   * 
   * @param outputDir 输出目录
   * @param config 构建配置
   */
  async generateDtsFiles(outputDir: string, config?: BuilderConfig): Promise<void> {
    const isSilent = config?.logLevel === 'silent'

    try {
      const fs = await import('fs')
      const path = await import('path')

      // 尝试导入 TypeScript
      const ts = await this.loadTypeScript(isSilent)
      if (!ts) return

      const rootDir = process.cwd()
      const srcDir = path.join(rootDir, 'src')
      const tsconfigPath = path.join(rootDir, 'tsconfig.json')

      // 检查 src 目录
      if (!fs.existsSync(srcDir)) {
        if (!isSilent) {
          console.warn('⚠️ src 目录不存在，跳过 DTS 生成')
        }
        return
      }

      // 解析 tsconfig.json
      const parsedConfig = await this.parseTsConfig(ts, tsconfigPath, path, fs, isSilent)

      // 获取所有 TypeScript 文件
      const tsFiles = await this.findTypeScriptFiles(srcDir, isSilent)
      if (tsFiles.length === 0) {
        if (!isSilent) {
          console.warn('⚠️ 未找到 TypeScript 文件')
        }
        return
      }

      // 创建编译选项
      const compilerOptions = this.createCompilerOptions(ts, parsedConfig, outputDir, srcDir)

      // 生成声明文件
      await this.emitDeclarationFiles(ts, tsFiles, compilerOptions, outputDir, rootDir, path, isSilent)

    } catch (error) {
      if (!isSilent) {
        console.warn('⚠️ 生成 TypeScript 声明文件失败:', error instanceof Error ? error.message : String(error))
      }
    }
  }

  /**
   * 加载 TypeScript 模块
   */
  private async loadTypeScript(isSilent: boolean): Promise<any | null> {
    try {
      return await import('typescript')
    } catch (error) {
      if (!isSilent) {
        console.warn('⚠️ 无法导入 TypeScript，跳过 DTS 生成')
      }
      return null
    }
  }

  /**
   * 解析 tsconfig.json
   */
  private async parseTsConfig(
    ts: any,
    tsconfigPath: string,
    path: any,
    fs: any,
    isSilent: boolean
  ): Promise<any> {
    if (fs.existsSync(tsconfigPath)) {
      const tsconfigContent = fs.readFileSync(tsconfigPath, 'utf-8')
      const configFile = ts.parseConfigFileTextToJson(tsconfigPath, tsconfigContent)

      if (configFile.error) {
        if (!isSilent) {
          console.warn('⚠️ 解析 tsconfig.json 失败:', configFile.error.messageText)
        }
        return { compilerOptions: {}, options: {}, fileNames: [], errors: [] }
      }

      return ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        path.dirname(tsconfigPath)
      )
    }

    if (!isSilent) {
      console.warn('⚠️ tsconfig.json 不存在，使用默认配置')
    }

    return {
      options: {},
      fileNames: [],
      errors: []
    }
  }

  /**
   * 查找 TypeScript 文件
   */
  private async findTypeScriptFiles(srcDir: string, isSilent: boolean): Promise<string[]> {
    try {
      const glob = await import('glob')
      return await glob.glob('**/*.{ts,tsx}', {
        cwd: srcDir,
        absolute: true,
        ignore: ['**/*.test.ts', '**/*.spec.ts', '**/__tests__/**', '**/*.d.ts']
      })
    } catch (error) {
      if (!isSilent) {
        console.warn('⚠️ 查找 TypeScript 文件失败:', error)
      }
      return []
    }
  }

  /**
   * 创建编译选项
   */
  private createCompilerOptions(
    ts: any,
    parsedConfig: any,
    outputDir: string,
    srcDir: string
  ): any {
    return {
      ...parsedConfig.options,
      declaration: true,
      emitDeclarationOnly: true,
      outDir: outputDir,
      rootDir: srcDir,
      skipLibCheck: true,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
      allowSyntheticDefaultImports: true,
      esModuleInterop: true,
      strict: false,
      noEmitOnError: false
    }
  }

  /**
   * 生成声明文件
   */
  private async emitDeclarationFiles(
    ts: any,
    tsFiles: string[],
    compilerOptions: any,
    outputDir: string,
    rootDir: string,
    path: any,
    isSilent: boolean
  ): Promise<void> {
    // 创建编译器主机
    const host = ts.createCompilerHost(compilerOptions)

    // 创建 TypeScript 程序
    const program = ts.createProgram(tsFiles, compilerOptions, host)

    // 生成声明文件
    const emitResult = program.emit(undefined, undefined, undefined, true)

    // 检查编译错误
    await this.handleDiagnostics(ts, program, emitResult, rootDir, path, isSilent)

    // 报告结果
    await this.reportEmitResult(emitResult, outputDir, isSilent)
  }

  /**
   * 处理诊断信息
   */
  private async handleDiagnostics(
    ts: any,
    program: any,
    emitResult: any,
    rootDir: string,
    path: any,
    isSilent: boolean
  ): Promise<void> {
    const allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics)

    if (allDiagnostics.length > 0 && !isSilent) {
      console.warn('⚠️ TypeScript 编译警告:')
      allDiagnostics.forEach((diagnostic: any) => {
        if (diagnostic.file) {
          const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start!)
          const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
          console.warn(`  ${path.relative(rootDir, diagnostic.file.fileName)} (${line + 1},${character + 1}): ${message}`)
        } else {
          console.warn(`  ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`)
        }
      })
    }
  }

  /**
   * 报告生成结果
   */
  private async reportEmitResult(emitResult: any, outputDir: string, isSilent: boolean): Promise<void> {
    if (emitResult.emitSkipped) {
      if (!isSilent) {
        this.logger.warn('TypeScript 声明文件生成失败')
      }
    } else {
      try {
        // 统计生成的 .d.ts 文件数量
        const glob = await import('glob')
        const generatedDtsFiles = await glob.glob('**/*.d.ts', {
          cwd: outputDir,
          absolute: false
        })
        if (!isSilent) {
          this.logger.success(`成功生成 ${generatedDtsFiles.length} 个声明文件`)
        }
      } catch (error) {
        // 忽略统计错误
      }
    }
  }
}

/**
 * 创建 Vue 3 DTS 生成器
 */
export function createVue3DtsGenerator(): Vue3DtsGenerator {
  return new Vue3DtsGenerator()
}
