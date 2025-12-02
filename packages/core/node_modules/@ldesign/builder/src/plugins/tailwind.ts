/**
 * Tailwind CSS 插件
 * 支持在构建过程中处理 Tailwind CSS
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import type { Plugin } from 'rollup'
import path from 'path'
import fs from 'fs-extra'

// 为了解决类型错误，扩展 Plugin 类型
interface TailwindPlugin extends Plugin {
  loadTailwindConfig?: (configPath: string) => Promise<any>
  getDefaultTailwindConfig?: (contentPaths: string[], jitMode: boolean) => any
}

/**
 * Tailwind 插件选项
 */
export interface TailwindPluginOptions {
  /** Tailwind 配置文件路径 */
  config?: string
  /** 是否启用 JIT 模式 */
  jit?: boolean
  /** 内容路径 */
  content?: string[]
  /** 是否压缩 */
  minify?: boolean
  /** 输出文件名 */
  output?: string
}

/**
 * 创建 Tailwind CSS 插件
 */
export function tailwindPlugin(options: TailwindPluginOptions = {}): TailwindPlugin {
  const {
    config: configPath,
    jit = true,
    content = ['./src/**/*.{js,jsx,ts,tsx,vue,html}'],
    minify = true,
    output = 'tailwind.css'
  } = options

  let postcss: any
  let tailwindcss: any
  let autoprefixer: any
  let cssnano: any

  return {
    name: 'tailwind-css',

    async buildStart() {
      // 动态加载依赖（可选依赖）
      try {
        postcss = (await import('postcss')).default
        // @ts-ignore - tailwindcss 可能没有类型定义
        tailwindcss = (await import('tailwindcss')).default
        autoprefixer = (await import('autoprefixer')).default

        if (minify) {
          cssnano = (await import('cssnano')).default
        }
      } catch (error) {
        this.warn('Tailwind CSS 相关依赖未安装，插件将被跳过')
        return
      }
    },

    async transform(code, id) {
      // 只处理 CSS 文件
      if (!id.endsWith('.css')) {
        return null
      }

      // 检查是否包含 Tailwind 指令
      if (!code.includes('@tailwind') && !code.includes('@apply')) {
        return null
      }

      try {
        // 构建 Tailwind 配置
        const tailwindConfig = configPath
          ? await loadTailwindConfigHelper(configPath, content, jit)
          : getDefaultTailwindConfigHelper(content, jit)

        // 处理 CSS
        const plugins = [
          tailwindcss(tailwindConfig),
          autoprefixer
        ]

        if (minify) {
          plugins.push(cssnano({ preset: 'default' }))
        }

        const result = await postcss(plugins).process(code, {
          from: id,
          to: output
        })

        return {
          code: result.css,
          map: result.map ? result.map.toString() : null
        }
      } catch (error) {
        this.error(`处理 Tailwind CSS 失败: ${(error as Error).message}`)
        return null
      }
    },

    /**
     * 加载 Tailwind 配置
     */
    async loadTailwindConfig(configPath: string) {
      const fullPath = path.resolve(process.cwd(), configPath)

      if (await fs.pathExists(fullPath)) {
        // 使用 jiti 动态加载配置
        const jitiModule = await import('jiti')
        const createJiti = typeof jitiModule === 'function' ? jitiModule : (jitiModule as any).default
        const loader = createJiti(process.cwd(), {
          esmResolve: true,
          interopDefault: true
        } as any)
        return loader(fullPath)
      }

      return getDefaultTailwindConfigHelper(content, jit)
    }
  }
}

/**
 * 加载 Tailwind 配置助手函数
 */
async function loadTailwindConfigHelper(
  configPath: string,
  defaultContent: string[],
  defaultJit: boolean
): Promise<any> {
  const fullPath = path.resolve(process.cwd(), configPath)

  if (await fs.pathExists(fullPath)) {
    try {
      const jitiModule = await import('jiti')
      const createJiti = typeof jitiModule === 'function' ? jitiModule : (jitiModule as any).default
      const loader = createJiti(process.cwd(), {
        esmResolve: true,
        interopDefault: true
      } as any)
      return loader(fullPath)
    } catch (error) {
      console.warn(`加载 Tailwind 配置失败: ${error}`)
    }
  }

  return getDefaultTailwindConfigHelper(defaultContent, defaultJit)
}

/**
 * 获取默认 Tailwind 配置助手函数
 */
function getDefaultTailwindConfigHelper(
  contentPaths: string[],
  jitMode: boolean
): any {
  return {
    mode: jitMode ? 'jit' : undefined,
    content: contentPaths,
    theme: {
      extend: {}
    },
    plugins: []
  }
}

