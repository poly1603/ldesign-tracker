/**
 * 内存泄漏检测器
 * 
 * 监控内存使用，检测潜在的内存泄漏
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import { EventEmitter } from 'events'
import { Logger } from '../logger'

/**
 * 内存快照
 */
export interface MemorySnapshot {
  timestamp: number
  heapUsed: number
  heapTotal: number
  external: number
  rss: number
  arrayBuffers: number
}

/**
 * 内存泄漏检测结果
 */
export interface MemoryLeakDetection {
  detected: boolean
  severity: 'low' | 'medium' | 'high' | 'critical'
  trend: 'stable' | 'growing' | 'declining'
  growthRate: number // bytes/second
  suspiciousObjects: Array<{
    type: string
    count: number
    totalSize: number
  }>
  recommendations: string[]
}

/**
 * 检测器配置
 */
export interface MemoryLeakDetectorOptions {
  /** 采样间隔（毫秒） */
  sampleInterval?: number
  /** 快照保留数量 */
  maxSnapshots?: number
  /** 增长阈值（MB/s） */
  growthThreshold?: number
  /** 是否启用堆分析 */
  enableHeapProfiling?: boolean
  logger?: Logger
}

/**
 * 内存泄漏检测器
 */
export class MemoryLeakDetector extends EventEmitter {
  private snapshots: MemorySnapshot[] = []
  private options: Required<Omit<MemoryLeakDetectorOptions, 'logger'>> & { logger: Logger }
  private timer?: NodeJS.Timeout
  private running = false

  constructor(options: MemoryLeakDetectorOptions = {}) {
    super()

    this.options = {
      sampleInterval: options.sampleInterval || 1000,
      maxSnapshots: options.maxSnapshots || 100,
      growthThreshold: options.growthThreshold || 1, // 1MB/s
      enableHeapProfiling: options.enableHeapProfiling || false,
      logger: options.logger || new Logger({ prefix: 'MemoryLeak' })
    }
  }

  /**
   * 开始监控
   */
  start(): void {
    if (this.running) {
      return
    }

    this.running = true
    this.timer = setInterval(() => {
      this.takeSnapshot()
    }, this.options.sampleInterval)

    this.options.logger.debug('内存泄漏检测器已启动')
    this.emit('started')
  }

  /**
   * 停止监控
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = undefined
    }

    this.running = false
    this.options.logger.debug('内存泄漏检测器已停止')
    this.emit('stopped')
  }

  /**
   * 获取快照
   */
  private takeSnapshot(): void {
    const mem = process.memoryUsage()

    const snapshot: MemorySnapshot = {
      timestamp: Date.now(),
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
      rss: mem.rss,
      arrayBuffers: mem.arrayBuffers || 0
    }

    this.snapshots.push(snapshot)

    // 保持快照数量限制
    if (this.snapshots.length > this.options.maxSnapshots) {
      this.snapshots.shift()
    }

    this.emit('snapshot', snapshot)

    // 定期检测
    if (this.snapshots.length >= 10) {
      const detection = this.detect()
      if (detection.detected) {
        this.emit('leak:detected', detection)

        if (detection.severity === 'critical') {
          this.options.logger.error('检测到严重内存泄漏！')
        } else if (detection.severity === 'high') {
          this.options.logger.warn('检测到可能的内存泄漏')
        }
      }
    }
  }

  /**
   * 检测内存泄漏
   */
  detect(): MemoryLeakDetection {
    if (this.snapshots.length < 5) {
      return {
        detected: false,
        severity: 'low',
        trend: 'stable',
        growthRate: 0,
        suspiciousObjects: [],
        recommendations: []
      }
    }

    // 计算增长趋势
    const recentSnapshots = this.snapshots.slice(-10)
    const growthRate = this.calculateGrowthRate(recentSnapshots)
    const trend = this.determineTrend(recentSnapshots)

    // 判断是否泄漏
    const thresholdMBPerS = this.options.growthThreshold
    const detected = growthRate > thresholdMBPerS * 1024 * 1024

    // 判断严重程度
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low'
    if (growthRate > thresholdMBPerS * 5 * 1024 * 1024) {
      severity = 'critical'
    } else if (growthRate > thresholdMBPerS * 3 * 1024 * 1024) {
      severity = 'high'
    } else if (growthRate > thresholdMBPerS * 1024 * 1024) {
      severity = 'medium'
    }

    // 生成建议
    const recommendations = this.generateRecommendations(growthRate, trend)

    return {
      detected,
      severity,
      trend,
      growthRate,
      suspiciousObjects: [], // 需要堆分析支持
      recommendations
    }
  }

  /**
   * 计算增长率（bytes/second）
   */
  private calculateGrowthRate(snapshots: MemorySnapshot[]): number {
    if (snapshots.length < 2) {
      return 0
    }

    const first = snapshots[0]
    const last = snapshots[snapshots.length - 1]

    const timeDiff = (last.timestamp - first.timestamp) / 1000 // 秒
    const memDiff = last.heapUsed - first.heapUsed

    return timeDiff > 0 ? memDiff / timeDiff : 0
  }

  /**
   * 确定趋势
   */
  private determineTrend(snapshots: MemorySnapshot[]): 'stable' | 'growing' | 'declining' {
    if (snapshots.length < 3) {
      return 'stable'
    }

    // 线性回归
    const n = snapshots.length
    let sumX = 0
    let sumY = 0
    let sumXY = 0
    let sumX2 = 0

    snapshots.forEach((snapshot, i) => {
      sumX += i
      sumY += snapshot.heapUsed
      sumXY += i * snapshot.heapUsed
      sumX2 += i * i
    })

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)

    if (slope > 100000) { // 增长超过 100KB/样本
      return 'growing'
    } else if (slope < -100000) {
      return 'declining'
    }

    return 'stable'
  }

  /**
   * 生成建议
   */
  private generateRecommendations(growthRate: number, trend: string): string[] {
    const recommendations: string[] = []

    if (trend === 'growing') {
      recommendations.push('检测到内存持续增长，可能存在内存泄漏')
      recommendations.push('检查是否有未清理的事件监听器')
      recommendations.push('检查是否有未关闭的文件句柄或流')
      recommendations.push('检查全局变量和缓存是否无限增长')

      if (growthRate > 5 * 1024 * 1024) { // > 5MB/s
        recommendations.push('⚠️ 严重泄漏：立即检查代码中的循环引用')
        recommendations.push('使用 --max-old-space-size 增加堆内存作为临时措施')
        recommendations.push('启用增量构建减少内存压力')
      }
    }

    if (this.snapshots.length > 0) {
      const latest = this.snapshots[this.snapshots.length - 1]
      const heapUsedMB = latest.heapUsed / 1024 / 1024

      if (heapUsedMB > 1024) { // > 1GB
        recommendations.push('当前堆内存使用超过 1GB，考虑优化')
        recommendations.push('使用流式处理代替一次性加载大文件')
        recommendations.push('减少并发任务数量')
      }
    }

    return recommendations
  }

  /**
   * 获取快照
   */
  getSnapshots(): MemorySnapshot[] {
    return [...this.snapshots]
  }

  /**
   * 获取最新快照
   */
  getLatestSnapshot(): MemorySnapshot | null {
    return this.snapshots.length > 0
      ? this.snapshots[this.snapshots.length - 1]
      : null
  }

  /**
   * 强制 GC（如果可用）
   */
  forceGC(): boolean {
    if (global.gc) {
      global.gc()
      this.options.logger.debug('已触发垃圾回收')
      return true
    }

    this.options.logger.warn('GC 不可用，请使用 --expose-gc 标志启动 Node.js')
    return false
  }

  /**
   * 清空历史
   */
  clearSnapshots(): void {
    this.snapshots = []
  }

  /**
   * 生成报告
   */
  generateReport(): {
    detection: MemoryLeakDetection
    snapshots: MemorySnapshot[]
    summary: {
      startTime: number
      endTime: number
      duration: number
      peakMemory: number
      avgMemory: number
      minMemory: number
    }
  } {
    const detection = this.detect()

    let peakMemory = 0
    let totalMemory = 0
    let minMemory = Infinity

    for (const snapshot of this.snapshots) {
      peakMemory = Math.max(peakMemory, snapshot.heapUsed)
      minMemory = Math.min(minMemory, snapshot.heapUsed)
      totalMemory += snapshot.heapUsed
    }

    const avgMemory = this.snapshots.length > 0
      ? totalMemory / this.snapshots.length
      : 0

    return {
      detection,
      snapshots: this.getSnapshots(),
      summary: {
        startTime: this.snapshots[0]?.timestamp || 0,
        endTime: this.snapshots[this.snapshots.length - 1]?.timestamp || 0,
        duration: this.snapshots.length > 0
          ? this.snapshots[this.snapshots.length - 1].timestamp - this.snapshots[0].timestamp
          : 0,
        peakMemory,
        avgMemory,
        minMemory: minMemory === Infinity ? 0 : minMemory
      }
    }
  }
}

/**
 * 创建内存泄漏检测器
 */
export function createMemoryLeakDetector(
  options?: MemoryLeakDetectorOptions
): MemoryLeakDetector {
  return new MemoryLeakDetector(options)
}


