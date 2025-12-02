/**
 * 插件懒加载器
 * 
 * 实现插件按需加载，减少启动时内存占用
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

/**
 * 插件定义
 */
export interface PluginDefinition {
  /** 插件名称 */
  name: string
  /** 插件加载器 */
  loader: () => Promise<any>
  /** 插件选项 */
  options?: Record<string, any>
  /** 是否必需 */
  required?: boolean
  /** 依赖的其他插件 */
  dependencies?: string[]
  /** 条件加载 */
  when?: () => boolean
}

/**
 * 已加载的插件
 */
export interface LoadedPlugin {
  name: string
  instance: any
  loadTime: number
}

/**
 * 加载器选项
 */
export interface LazyLoaderOptions {
  /** 是否启用预加载 */
  preload?: boolean
  /** 最大并行加载数 */
  maxParallel?: number
  /** 加载超时 (ms) */
  timeout?: number
}

/**
 * 常用 Rollup 插件的懒加载定义
 */
export const ROLLUP_PLUGIN_DEFINITIONS: Record<string, () => PluginDefinition> = {
  nodeResolve: () => ({
    name: 'node-resolve',
    loader: async () => (await import('@rollup/plugin-node-resolve')).default
  }),
  commonjs: () => ({
    name: 'commonjs',
    loader: async () => (await import('@rollup/plugin-commonjs')).default
  }),
  typescript: () => ({
    name: 'typescript',
    loader: async () => (await import('@rollup/plugin-typescript')).default
  }),
  json: () => ({
    name: 'json',
    loader: async () => (await import('@rollup/plugin-json')).default
  }),
  replace: () => ({
    name: 'replace',
    loader: async () => (await import('@rollup/plugin-replace')).default
  }),
  terser: () => ({
    name: 'terser',
    loader: async () => (await import('@rollup/plugin-terser')).default,
    when: () => process.env.NODE_ENV === 'production'
  }),
  alias: () => ({
    name: 'alias',
    loader: async () => (await import('@rollup/plugin-alias')).default
  }),
  vue: () => ({
    name: 'vue',
    loader: async () => (await import('rollup-plugin-vue')).default
  }),
  esbuild: () => ({
    name: 'esbuild',
    loader: async () => (await import('rollup-plugin-esbuild')).default
  })
}

/**
 * 插件懒加载器
 */
export class LazyPluginLoader {
  private opts: Required<LazyLoaderOptions>
  private loaded = new Map<string, LoadedPlugin>()
  private loading = new Map<string, Promise<LoadedPlugin>>()

  constructor(options: LazyLoaderOptions = {}) {
    this.opts = {
      preload: options.preload ?? false,
      maxParallel: options.maxParallel ?? 4,
      timeout: options.timeout ?? 10000
    }
  }

  /**
   * 加载单个插件
   */
  async load(definition: PluginDefinition): Promise<any> {
    const { name } = definition

    // 检查条件
    if (definition.when && !definition.when()) {
      return null
    }

    // 已加载
    if (this.loaded.has(name)) {
      return this.loaded.get(name)!.instance
    }

    // 正在加载
    if (this.loading.has(name)) {
      return (await this.loading.get(name))!.instance
    }

    // 开始加载
    const loadPromise = this.doLoad(definition)
    this.loading.set(name, loadPromise)

    try {
      const result = await loadPromise
      this.loaded.set(name, result)
      return result.instance
    } finally {
      this.loading.delete(name)
    }
  }

  /**
   * 批量加载插件
   */
  async loadAll(definitions: PluginDefinition[]): Promise<any[]> {
    const results: any[] = []
    const batches = this.createBatches(definitions, this.opts.maxParallel)

    for (const batch of batches) {
      const batchResults = await Promise.all(batch.map(def => this.load(def)))
      results.push(...batchResults.filter(Boolean))
    }

    return results
  }

  private async doLoad(definition: PluginDefinition): Promise<LoadedPlugin> {
    const start = Date.now()
    const loader = Promise.race([
      definition.loader(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`插件 ${definition.name} 加载超时`)), this.opts.timeout))
    ])

    const factory = await loader
    const instance = definition.options ? factory(definition.options) : factory

    return { name: definition.name, instance, loadTime: Date.now() - start }
  }

  private createBatches<T>(items: T[], size: number): T[][] {
    const batches: T[][] = []
    for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size))
    return batches
  }

  /** 获取加载统计 */
  getStats(): { loaded: number; totalLoadTime: number; plugins: string[] } {
    const plugins = [...this.loaded.values()]
    return { loaded: plugins.length, totalLoadTime: plugins.reduce((sum, p) => sum + p.loadTime, 0), plugins: plugins.map(p => p.name) }
  }

  /** 清除已加载的插件 */
  clear(): void { this.loaded.clear() }
}

export function createLazyPluginLoader(opts?: LazyLoaderOptions): LazyPluginLoader { return new LazyPluginLoader(opts) }

