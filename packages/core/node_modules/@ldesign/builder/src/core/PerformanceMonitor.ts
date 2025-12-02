/**
 * 性能监控器
 * 
 * 负责监控构建过程的性能指标
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import { EventEmitter } from 'events'
import os from 'os'
import type {
  PerformanceMetrics,
  PerformanceReport,
  MemoryUsage,
  CacheStats,
  FileProcessingStats,
  SystemResourceUsage
} from '../types/performance'
import { Logger } from '../utils/logger'

/**
 * 性能监控器选项
 */
export interface PerformanceMonitorOptions {
  logger?: Logger
  enabled?: boolean
  sampleInterval?: number
  maxSamples?: number
}

/**
 * 构建会话
 */
interface BuildSession {
  buildId: string
  startTime: number
  endTime?: number
  memorySnapshots: MemoryUsage[]
  fileStats: FileProcessingStats
  errors: Error[]
  config?: any
  phases: Array<{ name: string; duration: number }>
}

/**
 * 性能监控器类
 */
export class PerformanceMonitor extends EventEmitter {
  private logger: Logger
  private options: PerformanceMonitorOptions
  private sessions: Map<string, BuildSession> = new Map()
  private globalStats: {
    totalBuilds: number
    totalTime: number
    averageTime: number
    buildCount: number
    cacheStats: CacheStats
  }

  private activeSessions: Map<string, BuildSession> = new Map()
  private completedSessions: BuildSession[] = []
  // 追踪内存监控的interval，防止泄漏
  private monitoringIntervals = new Map<string, NodeJS.Timeout>()

  constructor(options: PerformanceMonitorOptions = {}) {
    super()

    this.options = {
      enabled: true,
      sampleInterval: 1000,
      maxSamples: 100,
      ...options
    }

    this.logger = options.logger || new Logger()

    this.globalStats = {
      totalBuilds: 0,
      totalTime: 0,
      averageTime: 0,
      buildCount: 0,
      cacheStats: {
        hits: 0,
        misses: 0,
        hitRate: 0,
        size: 0,
        entries: 0,
        timeSaved: 0
      }
    }
  }

  /**
   * 开始会话监控（别名）
   */
  startSession(sessionId: string): string {
    this.startBuild(sessionId)
    return sessionId
  }

  /**
   * 结束会话监控（别名）
   */
  endSession(sessionId: string): PerformanceMetrics & { duration: number, cpuUsage?: number } {
    const metrics = this.endBuild(sessionId)
    return {
      ...metrics,
      duration: metrics.buildTime,
      cpuUsage: metrics.systemResources.cpuUsage
    }
  }

  /**
   * 获取全局统计信息
   */
  getGlobalStats() {
    return this.globalStats
  }

  /**
   * 开始构建监控
   */
  startBuild(buildId: string): void {
    if (!this.options.enabled) return

    const session: BuildSession = {
      buildId,
      startTime: Date.now(),
      memorySnapshots: [],
      fileStats: {
        totalFiles: 0,
        filesByType: {},
        averageProcessingTime: 0,
        slowestFiles: [],
        processingRate: 0
      },
      errors: [],
      phases: []
    }

    this.sessions.set(buildId, session)
    this.activeSessions.set(buildId, session)

    // 开始内存监控
    this.startMemoryMonitoring(buildId)

    this.logger.debug(`开始监控构建: ${buildId}`)
    this.emit('build:start', { buildId, timestamp: session.startTime })
  }

  /**
   * 结束构建监控
   */
  endBuild(buildId: string): PerformanceMetrics {
    if (!this.options.enabled) {
      return this.createEmptyMetrics()
    }

    const session = this.sessions.get(buildId)
    if (!session) {
      this.logger.warn(`构建会话不存在: ${buildId}`)
      return this.createEmptyMetrics()
    }

    session.endTime = Date.now()
    const buildTime = session.endTime - session.startTime

    // 更新全局统计
    this.globalStats.totalBuilds++
    this.globalStats.totalTime += buildTime
    this.globalStats.averageTime = this.globalStats.totalTime / this.globalStats.totalBuilds

    // 生成性能指标
    const metrics = this.generateMetrics(session, buildTime)

    this.logger.info(`构建监控完成: ${buildId} (${buildTime}ms)`)
    this.emit('build:end', { buildId, metrics, timestamp: session.endTime })

    // 停止内存监控
    this.stopMemoryMonitoring(buildId)

    // 清理会话
    this.sessions.delete(buildId)
    this.activeSessions.delete(buildId)

    return metrics
  }

  /**
   * 清理所有资源
   */
  cleanup(): void {
    this.logger.debug('清理 PerformanceMonitor 资源...')

    // 清理所有内存监控interval
    for (const [buildId, interval] of this.monitoringIntervals) {
      clearInterval(interval)
      this.logger.debug(`✓ 停止内存监控: ${buildId}`)
    }
    this.monitoringIntervals.clear()

    // 清理所有会话
    this.sessions.clear()
    this.activeSessions.clear()
    this.completedSessions = []

    // 移除所有事件监听器
    this.removeAllListeners()

    this.logger.debug('PerformanceMonitor 清理完成')
  }

  /**
   * 记录错误
   */
  recordError(buildId: string, error: Error): void {
    const session = this.sessions.get(buildId)
    if (session) {
      session.errors.push(error)
    }
  }

  /**
   * 记录文件处理
   */
  recordFileProcessing(buildId: string, filePath: string, processingTime: number): void {
    const session = this.sessions.get(buildId)
    if (!session) return

    session.fileStats.totalFiles++

    // 按类型统计
    const ext = this.getFileExtension(filePath)
    session.fileStats.filesByType[ext] = (session.fileStats.filesByType[ext] || 0) + 1

    // 记录慢文件
    if (session.fileStats.slowestFiles.length < 10) {
      session.fileStats.slowestFiles.push({
        path: filePath,
        processingTime,
        size: this.getFileSize(filePath),
        phases: []
      })
    } else {
      // 替换最快的文件
      const slowest = session.fileStats.slowestFiles
      const minIndex = slowest.findIndex(f => f.processingTime === Math.min(...slowest.map(f => f.processingTime)))
      if (processingTime > slowest[minIndex].processingTime) {
        slowest[minIndex] = {
          path: filePath,
          processingTime,
          size: this.getFileSize(filePath),
          phases: []
        }
      }
    }
  }

  /**
   * 记录缓存命中
   */
  recordCacheHit(saved: boolean, timeSaved: number = 0): void {
    if (saved) {
      this.globalStats.cacheStats.hits++
      this.globalStats.cacheStats.timeSaved += timeSaved
    } else {
      this.globalStats.cacheStats.misses++
    }

    const total = this.globalStats.cacheStats.hits + this.globalStats.cacheStats.misses
    this.globalStats.cacheStats.hitRate = this.globalStats.cacheStats.hits / total
  }

  /**
   * 获取性能报告
   */
  getPerformanceReport(): PerformanceReport {
    const timestamp = Date.now()
    const lastSession = this.activeSessions.values().next().value || this.completedSessions[this.completedSessions.length - 1]

    return {
      timestamp,
      buildSummary: {
        bundler: lastSession?.config?.bundler || 'rollup',
        mode: lastSession?.config?.mode || 'production',
        entryCount: 1,
        outputCount: 1,
        totalSize: 0,
        buildTime: this.globalStats.averageTime
      },
      metrics: lastSession ? this.generateMetrics(lastSession, lastSession.endTime! - lastSession.startTime) : this.createEmptyMetrics(),
      recommendations: this.generateRecommendations(),
      analysis: {
        bottlenecks: this.identifyBottlenecks(),
        resourceAnalysis: {
          cpuEfficiency: 0.8,
          memoryEfficiency: 0.7,
          ioEfficiency: 0.9,
          wastePoints: []
        },
        cacheAnalysis: {
          overallEfficiency: this.globalStats.cacheStats.hitRate,
          strategyRecommendations: this.generateCacheRecommendations(),
          configOptimizations: {}
        },
        parallelizationOpportunities: []
      }
    }
  }

  /**
   * 开始内存监控（带清理追踪）
   */
  private startMemoryMonitoring(buildId: string): void {
    const session = this.sessions.get(buildId)
    if (!session) return

    // 清理已存在的监控（防止重复）
    this.stopMemoryMonitoring(buildId)

    const interval = setInterval(() => {
      const currentSession = this.sessions.get(buildId)
      if (!currentSession) {
        this.stopMemoryMonitoring(buildId)
        return
      }

      try {
        const memoryUsage = this.getCurrentMemoryUsage()
        currentSession.memorySnapshots.push(memoryUsage)

        // 限制快照数量
        if (currentSession.memorySnapshots.length > (this.options.maxSamples || 100)) {
          currentSession.memorySnapshots.shift()
        }
      } catch (error) {
        this.logger.warn(`内存监控出错 [${buildId}]:`, error)
        this.stopMemoryMonitoring(buildId)
      }
    }, this.options.sampleInterval)

    // 追踪interval以便后续清理
    this.monitoringIntervals.set(buildId, interval)
  }

  /**
   * 停止内存监控
   */
  private stopMemoryMonitoring(buildId: string): void {
    const interval = this.monitoringIntervals.get(buildId)
    if (interval) {
      clearInterval(interval)
      this.monitoringIntervals.delete(buildId)
    }
  }

  /**
   * 获取当前内存使用情况
   */
  private getCurrentMemoryUsage(): MemoryUsage {
    const usage = process.memoryUsage()

    return {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      rss: usage.rss,
      peak: Math.max(usage.heapUsed, usage.heapTotal),
      trend: []
    }
  }

  /**
   * 生成性能指标
   */
  private generateMetrics(session: BuildSession, buildTime: number): PerformanceMetrics {
    const memoryUsage = this.calculateMemoryUsage(session.memorySnapshots)

    return {
      buildTime,
      memoryUsage,
      cacheStats: this.globalStats.cacheStats,
      fileStats: session.fileStats,
      pluginPerformance: this.collectPluginPerformance(session),
      systemResources: this.getSystemResources()
    }
  }

  /**
   * 计算内存使用情况
   */
  private calculateMemoryUsage(snapshots: MemoryUsage[]): MemoryUsage {
    if (snapshots.length === 0) {
      return this.getCurrentMemoryUsage()
    }

    const latest = snapshots[snapshots.length - 1]
    const peak = Math.max(...snapshots.map(s => s.heapUsed))

    return {
      ...latest,
      peak,
      trend: snapshots.map((snapshot, index) => ({
        timestamp: Date.now() - (snapshots.length - index) * (this.options.sampleInterval || 1000),
        usage: snapshot.heapUsed,
        phase: 'building'
      }))
    }
  }

  /**
   * 获取系统资源使用情况
   */
  private getSystemResources(): SystemResourceUsage {
    // os is already imported at the top
    const totalMemory = os.totalmem()
    const freeMemory = os.freemem()

    return {
      cpuUsage: this.getCPUUsage(),
      availableMemory: freeMemory,
      diskUsage: {
        total: totalMemory,
        used: totalMemory - freeMemory,
        available: freeMemory,
        usagePercent: 0
      }
    }
  }

  /**
   * 获取文件扩展名
   */
  private getFileExtension(filePath: string): string {
    const ext = filePath.split('.').pop()
    return ext ? `.${ext}` : 'unknown'
  }

  /**
   * 创建空的性能指标
   */
  private createEmptyMetrics(): PerformanceMetrics {
    return {
      buildTime: 0,
      memoryUsage: this.getCurrentMemoryUsage(),
      cacheStats: this.globalStats.cacheStats,
      fileStats: {
        totalFiles: 0,
        filesByType: {},
        averageProcessingTime: 0,
        slowestFiles: [],
        processingRate: 0
      },
      pluginPerformance: [],
      systemResources: this.getSystemResources()
    }
  }

  /**
   * 获取文件大小
   *
   * @param filePath - 文件路径
   * @returns 文件大小（字节），如果文件不存在返回 0
   */
  private getFileSize(filePath: string): number {
    try {
      const fs = require('fs') as typeof import('fs')
      const stats = fs.statSync(filePath)
      return stats.size
    }
    catch {
      return 0
    }
  }

  /**
   * 收集插件性能数据
   */
  private collectPluginPerformance(session: BuildSession): any[] {
    // 从会话中提取插件性能数据
    // 这需要在构建过程中收集，目前返回空数组
    return []
  }

  /**
   * 生成优化建议
   */
  private generateRecommendations(): any[] {
    const recommendations: any[] = []

    // 基于缓存命中率的建议
    if (this.globalStats.cacheStats.hitRate < 0.5 && this.globalStats.buildCount > 3) {
      recommendations.push({
        type: 'cache',
        severity: 'medium',
        title: '缓存命中率较低',
        description: `当前缓存命中率为 ${(this.globalStats.cacheStats.hitRate * 100).toFixed(1)}%`,
        solution: '考虑启用更激进的缓存策略或检查缓存配置'
      })
    }

    // 基于构建时间的建议
    if (this.globalStats.averageTime > 30000) {
      recommendations.push({
        type: 'performance',
        severity: 'high',
        title: '构建时间较长',
        description: `平均构建时间为 ${(this.globalStats.averageTime / 1000).toFixed(1)} 秒`,
        solution: '考虑启用增量构建、并行构建或使用更快的打包器（如 esbuild）'
      })
    }

    return recommendations
  }

  /**
   * 识别性能瓶颈
   */
  private identifyBottlenecks(): any[] {
    const bottlenecks: any[] = []

    // 找出最慢的阶段
    this.completedSessions.forEach((session: BuildSession) => {
      if (session.phases && session.phases.length > 0) {
        const slowestPhase = session.phases.reduce((prev: any, curr: any) =>
          curr.duration > prev.duration ? curr : prev
        )

        if (slowestPhase.duration > 5000) {
          bottlenecks.push({
            type: 'phase',
            name: slowestPhase.name,
            duration: slowestPhase.duration,
            impact: 'high'
          })
        }
      }
    })

    return bottlenecks
  }

  /**
   * 生成缓存建议
   */
  private generateCacheRecommendations(): string[] {
    const recommendations: string[] = []

    if (this.globalStats.cacheStats.hitRate < 0.3) {
      recommendations.push('启用持久化缓存以提升重复构建速度')
    }

    if (this.globalStats.cacheStats.size > 500 * 1024 * 1024) {
      recommendations.push('缓存大小超过 500MB，考虑清理过期缓存')
    }

    return recommendations
  }

  /**
   * 获取 CPU 使用率
   */
  private getCPUUsage(): number {
    // os is already imported at the top
    const cpus = os.cpus()

    let totalIdle = 0
    let totalTick = 0

    cpus.forEach((cpu: any) => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type]
      }
      totalIdle += cpu.times.idle
    })

    const idle = totalIdle / cpus.length
    const total = totalTick / cpus.length
    const usage = 100 - ~~(100 * idle / total)

    return usage
  }
}
