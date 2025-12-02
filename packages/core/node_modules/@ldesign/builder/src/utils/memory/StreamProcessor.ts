/**
 * 流处理器
 * 
 * 提供流式处理功能，优化大数据处理的内存使用
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import { Readable, Transform } from 'stream'
import { Logger } from '../logger'

/**
 * 流式处理选项
 */
export interface StreamProcessOptions {
  /** 块大小 */
  chunkSize?: number
  /** 高水位标记 */
  highWaterMark?: number
  /** 是否自动销毁 */
  autoDestroy?: boolean
}

/**
 * 流处理器类
 */
export class StreamProcessor {
  private logger: Logger

  constructor() {
    this.logger = new Logger({ prefix: 'StreamProcessor' })
  }

  /**
   * 创建转换流
   * 
   * @param transformer - 转换函数
   * @param options - 流处理选项
   * @returns 转换流对象
   */
  createTransformStream<T = any, R = any>(
    transformer: (chunk: T) => R | Promise<R>,
    options: StreamProcessOptions = {},
  ): Transform {
    const { highWaterMark = 16 * 1024, autoDestroy = true } = options

    return new Transform({
      objectMode: true,
      highWaterMark,
      autoDestroy,
      async transform(chunk: T, _encoding, callback) {
        try {
          const result = await transformer(chunk)
          callback(null, result)
        }
        catch (error) {
          callback(error as Error)
        }
      },
    })
  }

  /**
   * 批量流式处理
   * 
   * @param batchSize - 批次大小
   * @param options - 流处理选项
   * @returns 批处理流对象
   */
  createBatchStream<T = any>(
    batchSize: number,
    options: StreamProcessOptions = {},
  ): Transform {
    let batch: T[] = []

    return new Transform({
      objectMode: true,
      highWaterMark: options.highWaterMark || 16,
      autoDestroy: options.autoDestroy !== false,
      transform(chunk: T, _encoding, callback) {
        batch.push(chunk)

        if (batch.length >= batchSize) {
          const currentBatch = batch
          batch = []
          callback(null, currentBatch)
        }
        else {
          callback()
        }
      },
      flush(callback) {
        if (batch.length > 0) {
          callback(null, batch)
        }
        else {
          callback()
        }
      },
    })
  }

  /**
   * 流式处理数组
   * 
   * @param items - 要处理的项数组
   * @param processor - 处理函数
   * @param options - 流处理选项
   * @returns 处理结果数组
   */
  async processStream<T, R>(
    items: T[],
    processor: (item: T) => R | Promise<R>,
    options: StreamProcessOptions = {},
  ): Promise<R[]> {
    const results: R[] = []
    const { chunkSize = 100 } = options

    const readable = Readable.from(items, { objectMode: true })
    const transform = this.createTransformStream(processor, options)

    return new Promise((resolve, reject) => {
      readable
        .pipe(transform)
        .on('data', (result: R) => {
          results.push(result)

          // 定期触发 GC（如果可用）
          if (results.length % chunkSize === 0 && global.gc) {
            global.gc()
          }
        })
        .on('end', () => resolve(results))
        .on('error', reject)
    })
  }
}

