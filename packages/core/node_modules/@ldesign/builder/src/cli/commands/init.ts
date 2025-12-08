/**
 * 初始化命令实现
 * 
 * 提供交互式项目配置初始化功能
 */

import { Command } from 'commander'
import { resolve, join } from 'path'
import { existsSync, writeFileSync, readFileSync, mkdirSync } from 'fs'
import { createInterface } from 'readline'
import { logger } from '../../utils/logger'

// ========== 类型定义 ==========

interface InitOptions {
  type?: string
  yes?: boolean
  template?: string
}

interface ProjectConfig {
  name: string
  type: 'typescript' | 'vue3' | 'vue2' | 'react' | 'svelte' | 'solid' | 'library'
  bundler: 'rollup' | 'rolldown' | 'esbuild' | 'vite'
  formats: string[]
  entry: string
  outDir: string
  dts: boolean
  sourcemap: boolean
  minify: boolean
  external: string[]
}

// ========== 模板定义 ==========

const PROJECT_TEMPLATES: Record<string, Partial<ProjectConfig>> = {
  typescript: {
    type: 'typescript',
    entry: 'src/index.ts',
    formats: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    minify: false
  },
  vue3: {
    type: 'vue3',
    entry: 'src/index.ts',
    formats: ['esm', 'cjs', 'umd'],
    dts: true,
    sourcemap: true,
    minify: true,
    external: ['vue']
  },
  vue2: {
    type: 'vue2',
    entry: 'src/index.ts',
    formats: ['esm', 'cjs', 'umd'],
    dts: true,
    sourcemap: true,
    minify: true,
    external: ['vue']
  },
  react: {
    type: 'react',
    entry: 'src/index.tsx',
    formats: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    minify: true,
    external: ['react', 'react-dom']
  },
  svelte: {
    type: 'svelte',
    entry: 'src/index.ts',
    formats: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    minify: true,
    external: ['svelte']
  },
  solid: {
    type: 'solid',
    entry: 'src/index.tsx',
    formats: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    minify: true,
    external: ['solid-js']
  },
  library: {
    type: 'library',
    entry: 'src/index.ts',
    formats: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    minify: false
  }
}

// ========== 交互式问答 ==========

async function prompt(question: string, defaultValue?: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  })

  return new Promise((resolve) => {
    const q = defaultValue ? `${question} (${defaultValue}): ` : `${question}: `
    rl.question(q, (answer) => {
      rl.close()
      resolve(answer.trim() || defaultValue || '')
    })
  })
}

async function select(question: string, options: string[], defaultIndex = 0): Promise<string> {
  console.log(`\n${question}`)
  options.forEach((opt, i) => {
    const marker = i === defaultIndex ? '>' : ' '
    console.log(`  ${marker} ${i + 1}. ${opt}`)
  })
  
  const answer = await prompt(`请选择 [1-${options.length}]`, String(defaultIndex + 1))
  const index = parseInt(answer) - 1
  return options[Math.max(0, Math.min(index, options.length - 1))]
}

async function confirm(question: string, defaultValue = true): Promise<boolean> {
  const hint = defaultValue ? '[Y/n]' : '[y/N]'
  const answer = await prompt(`${question} ${hint}`)
  if (!answer) return defaultValue
  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes'
}

// ========== 配置生成 ==========

function generateBuilderConfig(config: ProjectConfig): string {
  return `import { defineConfig } from '@ldesign/builder'

export default defineConfig({
  // 项目类型
  libraryType: '${config.type}',
  
  // 入口文件
  input: '${config.entry}',
  
  // 输出配置
  output: {
    format: ${JSON.stringify(config.formats)},
    dir: '${config.outDir}',
  },
  
  // 打包引擎
  bundler: '${config.bundler}',
  
  // TypeScript 类型声明
  dts: ${config.dts},
  
  // Source Map
  sourcemap: ${config.sourcemap},
  
  // 代码压缩
  minify: ${config.minify},
  
  // 外部依赖
  external: ${JSON.stringify(config.external)},
  
  // 清理输出目录
  clean: true,
})
`
}

function generatePackageJson(config: ProjectConfig): object {
  const pkg: any = {
    name: config.name,
    version: '0.0.1',
    description: '',
    type: 'module',
    main: `./${config.outDir}/index.cjs`,
    module: `./${config.outDir}/index.js`,
    types: `./${config.outDir}/index.d.ts`,
    exports: {
      '.': {
        types: `./${config.outDir}/index.d.ts`,
        import: `./${config.outDir}/index.js`,
        require: `./${config.outDir}/index.cjs`
      }
    },
    files: [config.outDir, 'README.md'],
    scripts: {
      build: 'ldesign-builder build',
      'build:watch': 'ldesign-builder watch',
      dev: 'ldesign-builder dev',
      clean: 'ldesign-builder clean',
      analyze: 'ldesign-builder analyze'
    },
    keywords: [],
    author: '',
    license: 'MIT',
    devDependencies: {
      '@ldesign/builder': '^1.0.0',
      typescript: '^5.0.0'
    }
  }

  // 根据类型添加依赖
  if (config.type === 'vue3') {
    pkg.peerDependencies = { vue: '>=3.0.0' }
    pkg.devDependencies.vue = '^3.4.0'
  } else if (config.type === 'vue2') {
    pkg.peerDependencies = { vue: '>=2.6.0 <3.0.0' }
    pkg.devDependencies.vue = '^2.7.0'
  } else if (config.type === 'react') {
    pkg.peerDependencies = { react: '>=16.8.0', 'react-dom': '>=16.8.0' }
    pkg.devDependencies.react = '^18.0.0'
    pkg.devDependencies['react-dom'] = '^18.0.0'
    pkg.devDependencies['@types/react'] = '^18.0.0'
  } else if (config.type === 'svelte') {
    pkg.peerDependencies = { svelte: '>=3.0.0' }
    pkg.devDependencies.svelte = '^4.0.0'
  } else if (config.type === 'solid') {
    pkg.peerDependencies = { 'solid-js': '>=1.0.0' }
    pkg.devDependencies['solid-js'] = '^1.8.0'
  }

  return pkg
}

function generateTsConfig(config: ProjectConfig): object {
  const compilerOptions: any = {
    target: 'ES2020',
    module: 'ESNext',
    moduleResolution: 'bundler',
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    declaration: true,
    declarationDir: `./${config.outDir}`,
    outDir: `./${config.outDir}`,
    rootDir: './src',
    baseUrl: '.',
    paths: {
      '@/*': ['src/*']
    }
  }

  if (config.type === 'react' || config.type === 'solid') {
    compilerOptions.jsx = 'react-jsx'
  }

  return {
    compilerOptions,
    include: ['src/**/*'],
    exclude: ['node_modules', config.outDir]
  }
}

function generateReadme(config: ProjectConfig): string {
  return `# ${config.name}

> 由 @ldesign/builder 构建

## 安装

\`\`\`bash
npm install ${config.name}
\`\`\`

## 使用

\`\`\`typescript
import { } from '${config.name}'
\`\`\`

## 开发

\`\`\`bash
# 安装依赖
npm install

# 开发构建
npm run dev

# 生产构建
npm run build

# 分析产物
npm run analyze
\`\`\`

## 许可证

MIT
`
}

function generateEntryFile(config: ProjectConfig): string {
  switch (config.type) {
    case 'vue3':
      return `import type { App, Plugin } from 'vue'

// 导出组件
export { default as HelloWorld } from './components/HelloWorld.vue'

// 导出类型
export * from './types'

// 插件安装
const install: Plugin = {
  install(app: App) {
    // 注册全局组件
  }
}

export default install
`
    case 'react':
      return `// 导出组件
export { HelloWorld } from './components/HelloWorld'

// 导出类型
export * from './types'

// 导出 hooks
export * from './hooks'
`
    case 'typescript':
    case 'library':
    default:
      return `// 导出主要功能
export * from './core'

// 导出类型
export * from './types'

// 导出工具函数
export * from './utils'
`
  }
}

// ========== 初始化执行 ==========

async function runInit(projectPath: string, options: InitOptions): Promise<void> {
  console.log('')
  console.log('╭─────────────────────────────────────────────────╮')
  console.log('│  🚀 LDesign Builder 项目初始化向导              │')
  console.log('╰─────────────────────────────────────────────────╯')
  console.log('')

  // 检查是否已有配置
  const configFiles = ['builder.config.ts', 'builder.config.js', 'ldesign.config.ts']
  const existingConfig = configFiles.find(f => existsSync(resolve(projectPath, f)))
  
  if (existingConfig) {
    const overwrite = await confirm(`已存在配置文件 ${existingConfig}，是否覆盖？`, false)
    if (!overwrite) {
      logger.info('已取消初始化')
      return
    }
  }

  let config: ProjectConfig

  // 快速模式
  if (options.yes && options.type) {
    const template = PROJECT_TEMPLATES[options.type] || PROJECT_TEMPLATES.typescript
    const pkgPath = resolve(projectPath, 'package.json')
    const pkgName = existsSync(pkgPath) 
      ? JSON.parse(readFileSync(pkgPath, 'utf-8')).name || 'my-library'
      : 'my-library'

    config = {
      name: pkgName,
      type: template.type as any,
      bundler: 'rollup',
      formats: template.formats || ['esm', 'cjs'],
      entry: template.entry || 'src/index.ts',
      outDir: 'dist',
      dts: template.dts !== false,
      sourcemap: template.sourcemap !== false,
      minify: !!template.minify,
      external: template.external || []
    }
  } else {
    // 交互式配置
    const pkgPath = resolve(projectPath, 'package.json')
    const existingPkg = existsSync(pkgPath) ? JSON.parse(readFileSync(pkgPath, 'utf-8')) : {}
    
    const name = await prompt('📦 项目名称', existingPkg.name || 'my-library')
    
    const typeOptions = ['typescript', 'vue3', 'vue2', 'react', 'svelte', 'solid', 'library']
    const type = await select('📁 项目类型', typeOptions, 0) as ProjectConfig['type']
    
    const bundlerOptions = ['rollup', 'rolldown', 'esbuild', 'vite']
    const bundler = await select('⚙️ 打包引擎', bundlerOptions, 0) as ProjectConfig['bundler']
    
    const template = PROJECT_TEMPLATES[type] || PROJECT_TEMPLATES.typescript
    
    const entry = await prompt('📄 入口文件', template.entry || 'src/index.ts')
    const outDir = await prompt('📂 输出目录', 'dist')
    
    const formatOptions = ['esm', 'cjs', 'umd', 'iife']
    console.log('\n📤 输出格式 (多选，用逗号分隔):')
    formatOptions.forEach((f, i) => console.log(`  ${i + 1}. ${f}`))
    const formatAnswer = await prompt('请选择', '1,2')
    const formats = formatAnswer.split(',')
      .map(n => formatOptions[parseInt(n.trim()) - 1])
      .filter(Boolean)
    
    const dts = await confirm('📝 生成类型声明 (.d.ts)?', true)
    const sourcemap = await confirm('🗺️ 生成 Source Map?', true)
    const minify = await confirm('📦 压缩代码?', type !== 'typescript')
    
    const externalAnswer = await prompt('📎 外部依赖 (逗号分隔)', (template.external || []).join(', '))
    const external = externalAnswer ? externalAnswer.split(',').map(s => s.trim()).filter(Boolean) : []

    config = { name, type, bundler, formats, entry, outDir, dts, sourcemap, minify, external }
  }

  // 确认配置
  console.log('\n📋 配置预览:')
  console.log('─'.repeat(40))
  console.log(`  名称: ${config.name}`)
  console.log(`  类型: ${config.type}`)
  console.log(`  引擎: ${config.bundler}`)
  console.log(`  入口: ${config.entry}`)
  console.log(`  输出: ${config.outDir}`)
  console.log(`  格式: ${config.formats.join(', ')}`)
  console.log(`  类型声明: ${config.dts ? '是' : '否'}`)
  console.log(`  Source Map: ${config.sourcemap ? '是' : '否'}`)
  console.log(`  压缩: ${config.minify ? '是' : '否'}`)
  console.log(`  外部依赖: ${config.external.length ? config.external.join(', ') : '无'}`)
  console.log('─'.repeat(40))

  if (!options.yes) {
    const proceed = await confirm('\n确认生成配置文件?', true)
    if (!proceed) {
      logger.info('已取消')
      return
    }
  }

  // 生成文件
  console.log('\n🔧 生成配置文件...\n')

  // 1. builder.config.ts
  const configPath = resolve(projectPath, 'builder.config.ts')
  writeFileSync(configPath, generateBuilderConfig(config))
  logger.success(`✅ ${configPath}`)

  // 2. package.json (如果不存在或需要更新)
  const pkgPath = resolve(projectPath, 'package.json')
  if (!existsSync(pkgPath)) {
    writeFileSync(pkgPath, JSON.stringify(generatePackageJson(config), null, 2))
    logger.success(`✅ ${pkgPath}`)
  } else {
    const existingPkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    const newPkg = generatePackageJson(config)
    // 合并 scripts
    existingPkg.scripts = { ...existingPkg.scripts, ...(newPkg as any).scripts }
    writeFileSync(pkgPath, JSON.stringify(existingPkg, null, 2))
    logger.success(`✅ ${pkgPath} (已更新 scripts)`)
  }

  // 3. tsconfig.json
  const tsconfigPath = resolve(projectPath, 'tsconfig.json')
  if (!existsSync(tsconfigPath)) {
    writeFileSync(tsconfigPath, JSON.stringify(generateTsConfig(config), null, 2))
    logger.success(`✅ ${tsconfigPath}`)
  }

  // 4. README.md
  const readmePath = resolve(projectPath, 'README.md')
  if (!existsSync(readmePath)) {
    writeFileSync(readmePath, generateReadme(config))
    logger.success(`✅ ${readmePath}`)
  }

  // 5. 创建 src 目录和入口文件
  const srcDir = resolve(projectPath, 'src')
  if (!existsSync(srcDir)) {
    mkdirSync(srcDir, { recursive: true })
    
    const entryPath = resolve(projectPath, config.entry)
    const entryDir = resolve(entryPath, '..')
    if (!existsSync(entryDir)) {
      mkdirSync(entryDir, { recursive: true })
    }
    writeFileSync(entryPath, generateEntryFile(config))
    logger.success(`✅ ${entryPath}`)

    // 创建基础目录结构
    const dirs = ['types', 'utils']
    if (config.type === 'vue3' || config.type === 'vue2' || config.type === 'react') {
      dirs.push('components', 'hooks')
    } else {
      dirs.push('core')
    }
    
    for (const dir of dirs) {
      const dirPath = resolve(srcDir, dir)
      if (!existsSync(dirPath)) {
        mkdirSync(dirPath, { recursive: true })
        writeFileSync(resolve(dirPath, 'index.ts'), `// ${dir} exports\n`)
      }
    }
    logger.success(`✅ src/ 目录结构`)
  }

  // 6. .gitignore
  const gitignorePath = resolve(projectPath, '.gitignore')
  if (!existsSync(gitignorePath)) {
    const gitignoreContent = `node_modules/
${config.outDir}/
*.log
.DS_Store
.ldesign/
*.tgz
`
    writeFileSync(gitignorePath, gitignoreContent)
    logger.success(`✅ ${gitignorePath}`)
  }

  console.log('')
  console.log('╭─────────────────────────────────────────────────╮')
  console.log('│  ✨ 初始化完成!                                 │')
  console.log('├─────────────────────────────────────────────────┤')
  console.log('│  下一步:                                        │')
  console.log('│    npm install       # 安装依赖                 │')
  console.log('│    npm run build     # 构建项目                 │')
  console.log('│    npm run dev       # 开发模式                 │')
  console.log('╰─────────────────────────────────────────────────╯')
  console.log('')
}

// ========== 命令定义 ==========

export const initCommand = new Command('init')
  .description('交互式初始化项目配置')
  .option('-t, --type <type>', '项目类型 (typescript|vue3|vue2|react|svelte|solid|library)')
  .option('-y, --yes', '跳过交互，使用默认配置')
  .option('--template <name>', '使用预设模板')
  .action(async (options: InitOptions) => {
    try {
      await runInit(process.cwd(), options)
    } catch (error) {
      logger.error('初始化失败:', error)
      process.exit(1)
    }
  })
