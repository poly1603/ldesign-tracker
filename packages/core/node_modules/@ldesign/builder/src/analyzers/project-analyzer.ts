/**
 * 智能项目分析器
 * 自动分析项目结构、框架、依赖等，生成最优配置
 */

import * as fs from 'fs-extra'
import * as path from 'path'
import { glob } from 'glob'
import { parse } from '@babel/parser'
import traverse from '@babel/traverse'
import { Logger } from '../utils/logger'

export interface ProjectAnalysis {
  // 项目基础信息
  root: string
  name: string
  type: 'library' | 'application' | 'component' | 'cli' | 'mixed'

  // package.json 内容
  packageJson?: Record<string, any>

  // 框架检测
  frameworks: {
    vue?: { version: 2 | 3, sfc: boolean }
    react?: { jsx: 'classic' | 'automatic', typescript: boolean }
    lit?: { version: string }
    svelte?: boolean
    angular?: boolean
    solid?: boolean
  }

  // 入口检测
  entries: {
    main?: string
    lib?: string
    types?: string
  }

  // 依赖分析
  dependencies: {
    production: string[]
    peer: string[]
    bundled: string[]
    external: string[]
  }

  // 构建需求
  requirements: {
    typescript: boolean
    jsx: boolean
    css: 'none' | 'css' | 'less' | 'sass' | 'stylus' | 'postcss'
    assets: boolean
    workers: boolean
  }

  // 输出建议
  output: {
    formats: ('esm' | 'cjs' | 'umd')[]
    preserveModules: boolean
    minify: boolean
  }
}

export class ProjectAnalyzer {
  private logger: Logger
  private cache = new Map<string, any>()

  constructor(logger?: Logger) {
    this.logger = logger || new Logger()
  }

  /**
   * 分析项目
   */
  async analyze(root: string = process.cwd()): Promise<ProjectAnalysis> {
    this.logger.info('🔍 开始分析项目...')

    // 读取 package.json
    const pkg = await this.readPackageJson(root)

    // 扫描源文件
    const sourceFiles = await this.scanSourceFiles(root)

    // 并行分析
    const [frameworks, entries, requirements] = await Promise.all([
      this.detectFrameworks(sourceFiles, root),
      this.detectEntries(pkg, sourceFiles, root),
      this.detectRequirements(sourceFiles, root)
    ])

    // 分析依赖
    const dependencies = await this.analyzeDependencies(pkg, frameworks)

    // 确定项目类型
    const type = this.detectProjectType(pkg, sourceFiles, frameworks)

    // 生成输出建议
    const output = this.suggestOutput(type, pkg, frameworks)

    const analysis: ProjectAnalysis = {
      root,
      name: pkg.name || path.basename(root),
      type,
      frameworks,
      entries,
      dependencies,
      requirements,
      output
    }

    this.logger.success(`✅ 项目分析完成: ${type} 项目，包含 ${Object.keys(frameworks).join(', ') || '纯 JS'}`)

    return analysis
  }

  /**
   * 读取 package.json
   */
  private async readPackageJson(root: string): Promise<any> {
    const pkgPath = path.join(root, 'package.json')
    if (await fs.pathExists(pkgPath)) {
      return fs.readJson(pkgPath)
    }
    return {}
  }

  /**
   * 扫描源文件
   */
  private async scanSourceFiles(root: string): Promise<string[]> {
    const srcDir = await this.findSourceDir(root)
    const patterns = [
      `${srcDir}/**/*.{ts,tsx,js,jsx,vue,svelte}`,
      `${srcDir}/**/*.{css,less,sass,scss,stylus}`,
    ]

    const files: string[] = []
    for (const pattern of patterns) {
      const matched = await glob(pattern, {
        cwd: root,
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
      })
      files.push(...matched)
    }

    return files
  }

  /**
   * 查找源码目录
   */
  private async findSourceDir(root: string): Promise<string> {
    const candidates = ['src', 'source', 'lib', 'components']

    for (const dir of candidates) {
      if (await fs.pathExists(path.join(root, dir))) {
        return dir
      }
    }

    return 'src' // 默认
  }

  /**
   * 检测框架
   */
  private async detectFrameworks(files: string[], root: string): Promise<ProjectAnalysis['frameworks']> {
    const frameworks: ProjectAnalysis['frameworks'] = {}

    // Vue 检测
    const vueFiles = files.filter(f => f.endsWith('.vue'))
    if (vueFiles.length > 0) {
      frameworks.vue = {
        version: await this.detectVueVersion(root),
        sfc: true
      }
    } else if (files.some(f => this.containsVueImport(f, root))) {
      frameworks.vue = {
        version: await this.detectVueVersion(root),
        sfc: false
      }
    }

    // React 检测
    const reactFiles = files.filter(f => f.match(/\.(jsx|tsx)$/))
    if (reactFiles.length > 0 || files.some(f => this.containsReactImport(f, root))) {
      frameworks.react = {
        jsx: await this.detectReactJSX(root),
        typescript: files.some(f => f.endsWith('.tsx'))
      }
    }

    // Lit 检测
    if (files.some(f => this.containsLitImport(f, root))) {
      frameworks.lit = { version: '3.0' }
    }

    // Svelte 检测
    if (files.some(f => f.endsWith('.svelte'))) {
      frameworks.svelte = true
    }

    // Angular 检测
    if (files.some(f => this.containsAngularDecorators(f, root))) {
      frameworks.angular = true
    }

    // Solid 检测
    if (files.some(f => this.containsSolidImport(f, root))) {
      frameworks.solid = true
    }

    return frameworks
  }

  /**
   * 检测 Vue 版本
   */
  private async detectVueVersion(root: string): Promise<2 | 3> {
    const pkg = await this.readPackageJson(root)
    const vueDep = pkg.dependencies?.vue || pkg.devDependencies?.vue || pkg.peerDependencies?.vue

    if (vueDep) {
      return vueDep.includes('3.') || vueDep.includes('^3') ? 3 : 2
    }

    return 3 // 默认 Vue 3
  }

  /**
   * 检测 React JSX 模式
   */
  private async detectReactJSX(root: string): Promise<'classic' | 'automatic'> {
    const tsConfigPath = path.join(root, 'tsconfig.json')
    if (await fs.pathExists(tsConfigPath)) {
      const tsConfig = await fs.readJson(tsConfigPath)
      const jsx = tsConfig.compilerOptions?.jsx
      if (jsx === 'react-jsx' || jsx === 'react-jsxdev') {
        return 'automatic'
      }
    }

    return 'classic'
  }

  /**
   * 检测入口文件
   */
  private async detectEntries(pkg: any, files: string[], root: string): Promise<ProjectAnalysis['entries']> {
    const entries: ProjectAnalysis['entries'] = {}

    // 从 package.json 检测
    if (pkg.main) {
      entries.main = pkg.main
    }
    if (pkg.module) {
      entries.main = pkg.module
    }
    if (pkg.types || pkg.typings) {
      entries.types = pkg.types || pkg.typings
    }

    // 自动检测常见入口
    const commonEntries = [
      'src/index.ts',
      'src/index.js',
      'src/main.ts',
      'src/main.js',
      'index.ts',
      'index.js'
    ]

    if (!entries.main) {
      for (const entry of commonEntries) {
        if (await fs.pathExists(path.join(root, entry))) {
          entries.main = entry
          break
        }
      }
    }

    // 检测 UMD 入口
    const libEntry = 'src/index-lib.ts'
    if (await fs.pathExists(path.join(root, libEntry))) {
      entries.lib = libEntry
    }

    return entries
  }

  /**
   * 检测构建需求
   */
  private async detectRequirements(files: string[], root: string): Promise<ProjectAnalysis['requirements']> {
    return {
      typescript: files.some(f => f.match(/\.tsx?$/)),
      jsx: files.some(f => f.match(/\.[jt]sx$/)),
      css: this.detectCSSType(files),
      assets: files.some(f => f.match(/\.(png|jpg|jpeg|gif|svg|woff2?|ttf|eot)$/)),
      workers: files.some(f => f.includes('.worker.'))
    }
  }

  /**
   * 检测 CSS 类型
   */
  private detectCSSType(files: string[]): ProjectAnalysis['requirements']['css'] {
    if (files.some(f => f.endsWith('.less'))) return 'less'
    if (files.some(f => f.match(/\.s[ac]ss$/))) return 'sass'
    if (files.some(f => f.endsWith('.styl') || f.endsWith('.stylus'))) return 'stylus'
    if (files.some(f => f.endsWith('.css'))) return 'css'
    return 'none'
  }

  /**
   * 分析依赖
   */
  private async analyzeDependencies(pkg: any, frameworks: ProjectAnalysis['frameworks']): Promise<ProjectAnalysis['dependencies']> {
    const deps = {
      production: Object.keys(pkg.dependencies || {}),
      peer: Object.keys(pkg.peerDependencies || {}),
      bundled: [] as string[],
      external: [] as string[]
    }

    // 框架核心库应该外部化
    const frameworkDeps = []
    if (frameworks.vue) frameworkDeps.push('vue', '@vue/composition-api')
    if (frameworks.react) frameworkDeps.push('react', 'react-dom')
    if (frameworks.lit) frameworkDeps.push('lit', '@lit/reactive-element')
    if (frameworks.svelte) frameworkDeps.push('svelte')
    if (frameworks.angular) frameworkDeps.push('@angular/core', '@angular/common')
    if (frameworks.solid) frameworkDeps.push('solid-js')

    // 大型库应该外部化
    const largeDeps = ['lodash', 'moment', 'date-fns', 'axios', 'echarts', 'd3']

    // 分类依赖
    for (const dep of deps.production) {
      if (frameworkDeps.includes(dep) || largeDeps.includes(dep) || deps.peer.includes(dep)) {
        deps.external.push(dep)
      } else if (dep.startsWith('@types/')) {
        // 类型定义不打包
        continue
      } else {
        // 小型工具库可以打包
        deps.bundled.push(dep)
      }
    }

    // Peer 依赖总是外部化
    deps.external.push(...deps.peer)

    // 去重
    deps.external = [...new Set(deps.external)]
    deps.bundled = [...new Set(deps.bundled)]

    return deps
  }

  /**
   * 检测项目类型
   */
  private detectProjectType(pkg: any, files: string[], frameworks: ProjectAnalysis['frameworks']): ProjectAnalysis['type'] {
    // CLI 工具
    if (pkg.bin) {
      return 'cli'
    }

    // 多框架组件库
    if (Object.keys(frameworks).length > 1) {
      return 'mixed'
    }

    // 组件库
    if (files.some(f => f.includes('/components/') || f.includes('/Component'))) {
      return 'component'
    }

    // 应用
    if (files.some(f => f.includes('App.') || f.includes('main.') || f.includes('index.html'))) {
      return 'application'
    }

    // 默认为库
    return 'library'
  }

  /**
   * 生成输出建议
   */
  private suggestOutput(type: ProjectAnalysis['type'], pkg: any, frameworks: ProjectAnalysis['frameworks']): ProjectAnalysis['output'] {
    const output: ProjectAnalysis['output'] = {
      formats: [],
      preserveModules: false,
      minify: false
    }

    // 根据项目类型决定输出格式
    switch (type) {
      case 'library':
      case 'component':
      case 'mixed':
        // 库需要多种格式
        output.formats = ['esm', 'cjs']
        output.preserveModules = true

        // 如果有浏览器字段，也生成 UMD
        if (pkg.browser || pkg.unpkg || pkg.jsdelivr) {
          output.formats.push('umd')
          output.minify = true
        }
        break

      case 'application':
        // 应用只需要 ESM
        output.formats = ['esm']
        output.minify = true
        break

      case 'cli':
        // CLI 只需要 CJS
        output.formats = ['cjs']
        break
    }

    return output
  }

  // 辅助方法：检测导入
  private containsVueImport(file: string, root: string): boolean {
    try {
      const content = fs.readFileSync(path.join(root, file), 'utf-8')
      return content.includes('from "vue"') || content.includes("from 'vue'")
    } catch {
      return false
    }
  }

  private containsReactImport(file: string, root: string): boolean {
    try {
      const content = fs.readFileSync(path.join(root, file), 'utf-8')
      return content.includes('from "react"') || content.includes("from 'react'")
    } catch {
      return false
    }
  }

  private containsLitImport(file: string, root: string): boolean {
    try {
      const content = fs.readFileSync(path.join(root, file), 'utf-8')
      return content.includes('from "lit"') || content.includes("from 'lit'") || content.includes('@lit/')
    } catch {
      return false
    }
  }

  private containsSolidImport(file: string, root: string): boolean {
    try {
      const content = fs.readFileSync(path.join(root, file), 'utf-8')
      return content.includes('from "solid-js"') || content.includes("from 'solid-js'")
    } catch {
      return false
    }
  }

  private containsAngularDecorators(file: string, root: string): boolean {
    try {
      const content = fs.readFileSync(path.join(root, file), 'utf-8')
      return content.includes('@Component') || content.includes('@Injectable') || content.includes('@angular/')
    } catch {
      return false
    }
  }
}

// 导出工厂函数
export function createProjectAnalyzer(logger?: Logger): ProjectAnalyzer {
  return new ProjectAnalyzer(logger)
}
