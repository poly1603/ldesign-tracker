/**
 * @ldesign/builder - tsup 构建配置
 *
 * 构建目标：
 * 1. 高性能构建 - 使用 esbuild 快速编译
 * 2. 双格式输出 - 同时支持 ESM 和 CJS
 * 3. 体积优化 - 生产环境压缩，移除无用代码
 * 4. 跨平台兼容 - Node.js 16+ 支持
 *
 * @author LDesign Team
 * @version 1.0.0
 */

import { defineConfig, type Options } from 'tsup'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================
// 构建模式判断
// ============================================================
const isProduction = process.env.NODE_ENV === 'production'
const isDevelopment = !isProduction

// ============================================================
// 获取包信息
// ============================================================
const getPackageInfo = () => {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf-8'))
    return { name: pkg.name, version: pkg.version }
  } catch {
    return { name: '@ldesign/builder', version: '1.0.0' }
  }
}

const { name, version } = getPackageInfo()

// ============================================================
// 外部依赖配置
// 使用正则表达式批量匹配，减少配置冗余
// ============================================================
const externalDependencies: (string | RegExp)[] = [
  // Node.js 内置模块
  /^node:/,
  /^(path|fs|events|crypto|url|os|assert|util|module)$/,
  /^(worker_threads|child_process|stream|buffer|http|https|net|tls)$/,

  // 打包核心
  /^(rollup|rolldown|esbuild)$/,
  /^@rollup\//,
  /^@swc\//,

  // CLI 相关
  /^(chalk|commander|ora)$/,

  // 文件系统工具
  /^(fast-glob|glob|fs-extra|rimraf|chokidar)$/,

  // Vue 生态
  /^(@vitejs|@vue|unplugin-vue)/,
  /^vue$/,

  // React 生态
  /^react(-dom)?$/,

  // 样式处理
  /^(postcss|autoprefixer|less|sass|stylus|clean-css|cssnano)$/,
  /^rollup-plugin-/,
  /^vite-plugin-/,

  // Babel 相关
  /^@babel\//,
  /^babel-preset-/,

  // 其他依赖
  /^(typescript|tslib|zod|semver|jiti|svelte|gzip-size|pretty-bytes|vite)$/,
  /^acorn/,
]

// ============================================================
// esbuild 优化选项
// ============================================================
const esbuildOptions: Options['esbuildOptions'] = (options) => {
  // 外部包处理
  options.packages = 'external'

  // 日志配置 - 静默模式，隐藏所有警告
  options.logLevel = 'silent'
  options.logLimit = 0
  options.logOverride = {
    'empty-import-meta': 'silent',
  }

  // 代码优化
  options.legalComments = 'none' // 移除许可注释
  options.charset = 'utf8'
  options.treeShaking = true

  // 性能优化
  options.keepNames = true // 保留函数名，便于调试
  options.lineLimit = 0 // 不限制行长度
}

// ============================================================
// 输出文件扩展名配置
// ============================================================
const outExtension = ({ format }: { format: string }): { js: string } => ({
  js: format === 'esm' ? '.js' : '.cjs',
})

// ============================================================
// 构建统计
// ============================================================
let buildStartTime: number

// 打印构建开始信息
const printBuildStart = () => {
  buildStartTime = Date.now()
  const mode = isProduction ? '生产' : '开发'
  const modeColor = isProduction ? '\x1b[33m' : '\x1b[36m'
  const reset = '\x1b[0m'
  const blue = '\x1b[34m'
  const dim = '\x1b[2m'
  
  console.log('')
  console.log(`${blue}🚀 开始构建${reset} ${dim}${name}@${version}${reset}`)
  console.log(`${dim}   模式: ${modeColor}${mode}${reset}${dim} | 格式: ESM + CJS${reset}`)
  console.log('')
}

// ============================================================
// 主配置
// ============================================================

// 立即执行：打印构建开始信息
printBuildStart()

export default defineConfig({
  // 入口文件配置
  entry: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**',
    '!src/tests/**',
  ],

  // 输出格式：同时支持 ESM 和 CJS
  format: ['esm', 'cjs'],

  // 输出目录
  outDir: 'dist',

  // 类型声明：使用 tsc 单独生成以避免内存问题
  dts: false,

  // 代码分割：关闭以保持简单的文件结构
  splitting: false,

  // Source Map：仅开发环境生成
  sourcemap: isDevelopment,

  // 清理输出目录：由 npm script 控制
  clean: false,

  // 压缩：仅生产环境
  minify: isProduction,

  // 输出扩展名
  outExtension,

  // 外部依赖
  external: externalDependencies,

  // 构建目标
  target: 'node16',

  // esbuild 选项
  esbuildOptions,

  // 静默模式：始终开启以控制输出
  silent: true,

  // 构建完成回调
  async onSuccess() {
    // 如果还没记录开始时间，现在记录（防止遗漏）
    if (!buildStartTime) {
      buildStartTime = Date.now()
    }
    
    const buildTime = Date.now() - buildStartTime
    const mode = isProduction ? '生产' : '开发'
    const modeColor = isProduction ? '\x1b[33m' : '\x1b[36m'
    const reset = '\x1b[0m'
    const green = '\x1b[32m'
    const blue = '\x1b[34m'
    const dim = '\x1b[2m'
    
    console.log('')
    console.log(`${green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}`)
    console.log(`${green}✓${reset} ${blue}构建成功${reset}`)
    console.log(`${green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}`)
    console.log(`  ${dim}包名称:${reset}  ${name}`)
    console.log(`  ${dim}版本号:${reset}  ${version}`)
    console.log(`  ${dim}构建模式:${reset} ${modeColor}${mode}模式${reset}`)
    console.log(`  ${dim}输出格式:${reset} ESM + CJS`)
    console.log(`  ${dim}输出目录:${reset} dist/`)
    console.log(`  ${dim}构建耗时:${reset} ${buildTime}ms`)
    console.log(`${green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}`)
    console.log('')
  },
})


