/**
 * 构建 Worker
 *
 * 在独立线程中执行构建任务
 *
 * @author LDesign Team
 * @version 1.0.0
 */

import { parentPort, workerData } from 'worker_threads'

if (!parentPort) {
  throw new Error('This script must be run as a worker')
}

/**
 * Worker 状态追踪
 */
let isShuttingDown = false
let activeTaskCount = 0

/**
 * 处理父进程消息
 */
const messageHandler = async (message: any) => {
  // 如果正在关闭，拒绝新任务
  if (isShuttingDown) {
    parentPort!.postMessage({
      id: message.task?.id || 'unknown',
      success: false,
      error: 'Worker is shutting down',
      duration: 0
    })
    return
  }

  const startTime = Date.now()
  activeTaskCount++

  try {
    const { type, task } = message

    if (type === 'shutdown') {
      // 处理关闭信号
      isShuttingDown = true
      parentPort!.postMessage({
        type: 'shutdown-ack',
        activeTaskCount
      })
      return
    }

    if (type !== 'task') {
      throw new Error(`Unknown message type: ${type}`)
    }

    // 执行任务
    const result = await executeTask(task)

    // 发送结果
    parentPort!.postMessage({
      id: task.id,
      success: true,
      data: result,
      duration: Date.now() - startTime
    })
  } catch (error: any) {
    // 发送错误，确保包含完整的错误信息
    parentPort!.postMessage({
      id: message.task?.id || 'unknown',
      success: false,
      error: error.message || String(error),
      stack: error.stack,
      duration: Date.now() - startTime
    })
  } finally {
    activeTaskCount--
    
    // 如果正在关闭且没有活动任务，通知可以安全退出
    if (isShuttingDown && activeTaskCount === 0) {
      parentPort!.postMessage({
        type: 'ready-to-exit'
      })
    }
  }
}

parentPort.on('message', messageHandler)

/**
 * 处理进程退出信号
 */
process.on('SIGTERM', () => {
  isShuttingDown = true
  if (activeTaskCount === 0) {
    process.exit(0)
  }
})

process.on('SIGINT', () => {
  isShuttingDown = true
  if (activeTaskCount === 0) {
    process.exit(0)
  }
})

/**
 * 执行任务（带Promise rejection保护）
 */
async function executeTask(task: any): Promise<any> {
  // 验证任务对象
  if (!task || typeof task !== 'object') {
    throw new Error('Invalid task: task must be an object')
  }

  if (!task.type) {
    throw new Error('Invalid task: missing task.type')
  }

  try {
    switch (task.type) {
      case 'build':
        return await buildPackage(task.data)

      case 'transform':
        return await transformCode(task.data)

      case 'minify':
        return await minifyCode(task.data)

      case 'analyze':
        return await analyzeBundle(task.data)

      case 'dts':
        return await generateDts(task.data)

      default:
        throw new Error(`Unknown task type: ${task.type}`)
    }
  } catch (error) {
    // 确保错误被正确包装和传播
    if (error instanceof Error) {
      throw error
    }
    // 处理非Error对象的rejection
    throw new Error(`Task execution failed: ${String(error)}`)
  }
}

/**
 * 构建包（带错误处理）
 */
async function buildPackage(data: any): Promise<any> {
  try {
    if (!data || !data.config) {
      throw new Error('Invalid build data: missing config')
    }

    // 动态导入 LibraryBuilder
    const { LibraryBuilder } = await import('../core/LibraryBuilder')

    const builder = new LibraryBuilder(data.options)
    const result = await builder.build(data.config)

    return result
  } catch (error) {
    // 增强错误信息
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new Error(`Build package failed: ${errorMessage}`)
  }
}

/**
 * 转换代码（带验证）
 */
async function transformCode(data: any): Promise<any> {
  try {
    if (!data || typeof data.code !== 'string') {
      throw new Error('Invalid transform data: code must be a string')
    }

    const { code, options } = data

    // 根据选项选择转换器
    if (options?.typescript) {
      const ts = await import('typescript')
      const result = ts.transpileModule(code, options.typescript)
      return { code: result.outputText, map: result.sourceMapText }
    }

    if (options?.babel) {
      const babel = await import('@babel/core')
      const result = await babel.transformAsync(code, options.babel)
      
      if (!result) {
        throw new Error('Babel transform returned null')
      }
      
      return { code: result.code, map: result.map }
    }

    return { code }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new Error(`Transform code failed: ${errorMessage}`)
  }
}

/**
 * 压缩代码（带验证）
 */
async function minifyCode(data: any): Promise<any> {
  try {
    if (!data || typeof data.code !== 'string') {
      throw new Error('Invalid minify data: code must be a string')
    }

    const { code, options } = data

    const { minify } = await import('terser')
    const result = await minify(code, options)

    if (!result) {
      throw new Error('Minify returned null result')
    }

    return {
      code: result.code,
      map: result.map
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new Error(`Minify code failed: ${errorMessage}`)
  }
}

/**
 * 分析打包结果（带验证）
 */
async function analyzeBundle(data: any): Promise<any> {
  try {
    if (!data || !data.bundle) {
      throw new Error('Invalid analyze data: missing bundle')
    }

    const { bundle, options } = data

    // 分析包大小、依赖关系等
    const analysis = {
      size: calculateSize(bundle),
      modules: analyzeModules(bundle),
      dependencies: analyzeDependencies(bundle)
    }

    return analysis
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new Error(`Analyze bundle failed: ${errorMessage}`)
  }
}

/**
 * 生成 DTS（带验证）
 */
async function generateDts(data: any): Promise<any> {
  try {
    if (!data || !data.files || !Array.isArray(data.files)) {
      throw new Error('Invalid DTS data: files must be an array')
    }

    if (!data.options) {
      throw new Error('Invalid DTS data: missing options')
    }

    const { files, options } = data

    const ts = await import('typescript')

    // 创建编译器主机
    const host = ts.createCompilerHost(options)

    // 创建程序
    const program = ts.createProgram(files, options, host)

    // 生成声明文件
    const emitResult = program.emit(
      undefined,
      undefined,
      undefined,
      true // 只生成声明文件
    )

    return {
      success: !emitResult.emitSkipped,
      diagnostics: emitResult.diagnostics.map(d => ({
        message: ts.flattenDiagnosticMessageText(d.messageText, '\n'),
        category: d.category
      }))
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new Error(`Generate DTS failed: ${errorMessage}`)
  }
}

/**
 * 计算大小
 */
function calculateSize(bundle: any): number {
  if (typeof bundle === 'string') {
    return Buffer.byteLength(bundle, 'utf8')
  }

  if (Buffer.isBuffer(bundle)) {
    return bundle.length
  }

  return 0
}

/**
 * 分析模块
 */
function analyzeModules(bundle: any): any[] {
  // 简化实现
  return []
}

/**
 * 分析依赖
 */
function analyzeDependencies(bundle: any): any[] {
  // 简化实现
  return []
}
