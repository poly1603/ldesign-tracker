/**
 * 智能外部依赖分析器
 * 自动分析项目导入，区分运行时依赖和构建时依赖，决定哪些依赖应该被 external 排除
 */

import path from 'path'
import { exists, readFile, findFiles } from '../file-system'

/** 依赖分类 */
export type DependencyCategory = 'runtime' | 'buildtime' | 'peer' | 'bundled'

/** 外部依赖分析结果 */
export interface ExternalAnalysisResult {
  externals: string[]
  bundled: string[]
  peerDeps: string[]
  details: Map<string, DependencyDetail>
  confidence: number
  evidence: string[]
}

/** 依赖详情 */
export interface DependencyDetail {
  name: string
  category: DependencyCategory
  importCount: number
  importPaths: string[]
  isTypeOnly: boolean
  shouldExternal: boolean
  reason: string
}

/** 分析选项 */
export interface SmartExternalOptions {
  srcDir?: string
  autoPeer?: boolean
  forceExternal?: string[]
  forceBundled?: string[]
}

type ImportInfo = { count: number; paths: string[]; typeOnly: boolean }

/** 智能外部依赖分析器 */
export class SmartExternalAnalyzer {
  private opts: Required<SmartExternalOptions>

  constructor(options: SmartExternalOptions = {}) {
    this.opts = {
      srcDir: options.srcDir || 'src',
      autoPeer: options.autoPeer ?? true,
      forceExternal: options.forceExternal || [],
      forceBundled: options.forceBundled || []
    }
  }

  /** 分析外部依赖 */
  async analyze(projectPath: string): Promise<ExternalAnalysisResult> {
    const pkgPath = path.join(projectPath, 'package.json')
    if (!await exists(pkgPath)) return this.emptyResult()

    try {
      const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'))
      const imports = await this.scanImports(projectPath)
      return this.processPackage(pkg, imports)
    } catch {
      return this.emptyResult()
    }
  }

  private processPackage(pkg: Record<string, any>, imports: Map<string, ImportInfo>): ExternalAnalysisResult {
    const deps = pkg.dependencies || {}
    const devDeps = pkg.devDependencies || {}
    const peerDeps = pkg.peerDependencies || {}
    const details = new Map<string, DependencyDetail>()
    const externals: string[] = []
    const bundled: string[] = []
    const evidence: string[] = []

    // peer 依赖 - 总是外部化
    for (const dep of Object.keys(peerDeps)) {
      details.set(dep, this.createDetail(dep, 'peer', imports.get(dep), true, 'peer 依赖'))
      externals.push(dep)
      evidence.push(`${dep}: peer -> external`)
    }

    // 处理 dependencies
    for (const dep of Object.keys(deps)) {
      if (details.has(dep)) continue
      const info = imports.get(dep)
      const shouldExt = this.shouldExternal(dep, info, pkg)
      details.set(dep, this.createDetail(dep, shouldExt ? 'runtime' : 'bundled', info, shouldExt, this.getReason(dep, info, shouldExt)))
      if (shouldExt) { externals.push(dep); evidence.push(`${dep}: runtime -> external`) }
      else { bundled.push(dep); evidence.push(`${dep}: bundled`) }
    }

    // 处理被导入的 devDependencies
    for (const dep of Object.keys(devDeps)) {
      if (details.has(dep)) continue
      const info = imports.get(dep)
      if (info?.count) {
        details.set(dep, this.createDetail(dep, 'buildtime', info, false, '开发依赖被导入'))
        bundled.push(dep)
      }
    }

    return { externals: [...new Set([...externals, ...this.opts.forceExternal])], bundled: [...new Set([...bundled, ...this.opts.forceBundled])], peerDeps: Object.keys(peerDeps), details, confidence: 0.85, evidence }
  }

  private async scanImports(projectPath: string): Promise<Map<string, ImportInfo>> {
    const imports = new Map<string, ImportInfo>()
    const srcPath = path.join(projectPath, this.opts.srcDir)
    if (!await exists(srcPath)) return imports

    const files = await findFiles(['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.vue', '**/*.svelte'], { cwd: srcPath, ignore: ['**/node_modules/**', '**/*.d.ts'] })
    const importRe = /(?:import|export)\s+(?:type\s+)?(?:[\w{},*\s]+\s+from\s+)?['"]([^'"]+)['"]/g
    const requireRe = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g

    for (const file of files) {
      const content = await readFile(path.join(srcPath, file), 'utf-8')
      const isTypeImport = /import\s+type\s+/.test(content)
      let m
      while ((m = importRe.exec(content))) { const dep = this.pkgName(m[1]); if (dep && !dep.startsWith('.')) this.addImport(imports, dep, file, isTypeImport) }
      importRe.lastIndex = 0
      while ((m = requireRe.exec(content))) { const dep = this.pkgName(m[1]); if (dep && !dep.startsWith('.')) this.addImport(imports, dep, file, false) }
      requireRe.lastIndex = 0
    }
    return imports
  }

  private pkgName(imp: string): string | null {
    if (imp.startsWith('@')) { const p = imp.split('/'); return p.length >= 2 ? `${p[0]}/${p[1]}` : null }
    return imp.split('/')[0]
  }

  private addImport(imports: Map<string, ImportInfo>, dep: string, file: string, typeOnly: boolean): void {
    const e = imports.get(dep); if (e) { e.count++; e.paths.push(file); if (!typeOnly) e.typeOnly = false }
    else imports.set(dep, { count: 1, paths: [file], typeOnly })
  }

  private shouldExternal(dep: string, info: ImportInfo | undefined, pkg: Record<string, any>): boolean {
    if (this.opts.forceExternal.includes(dep)) return true
    if (this.opts.forceBundled.includes(dep)) return false
    if (info?.typeOnly) return true
    if (['vue', 'react', 'react-dom', 'svelte', 'solid-js', 'preact', '@angular/core'].includes(dep)) return true
    if (pkg.peerDependencies?.[dep]) return true
    return true // 库模式默认外部化
  }

  private getReason(dep: string, info: ImportInfo | undefined, ext: boolean): string {
    if (info?.typeOnly) return '仅类型导入'
    if (['vue', 'react', 'svelte', 'solid-js'].includes(dep)) return '框架依赖'
    return ext ? '运行时依赖' : '打包依赖'
  }

  private createDetail(name: string, cat: DependencyCategory, info: ImportInfo | undefined, ext: boolean, reason: string): DependencyDetail {
    return { name, category: cat, importCount: info?.count || 0, importPaths: info?.paths || [], isTypeOnly: info?.typeOnly || false, shouldExternal: ext, reason }
  }

  private emptyResult(): ExternalAnalysisResult { return { externals: [], bundled: [], peerDeps: [], details: new Map(), confidence: 0, evidence: [] } }
}

export function createSmartExternalAnalyzer(opts?: SmartExternalOptions): SmartExternalAnalyzer { return new SmartExternalAnalyzer(opts) }

