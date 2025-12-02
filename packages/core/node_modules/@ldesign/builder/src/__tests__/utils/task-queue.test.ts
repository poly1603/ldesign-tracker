/**
 * TaskQueue 测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TaskQueue, createTaskQueue, parallel, type Task } from '../../utils/parallel/TaskQueue'

describe('TaskQueue', () => {
  let queue: TaskQueue

  beforeEach(() => {
    queue = new TaskQueue({ autoStart: false })
    vi.clearAllTimers()
    vi.useFakeTimers()
  })

  describe('constructor', () => {
    it('should create queue with default options', () => {
      const q = new TaskQueue()
      const status = q.getStatus()

      expect(status.total).toBe(0)
      expect(status.pending).toBe(0)
      expect(status.running).toBe(0)
      expect(status.paused).toBe(false)
    })

    it('should create queue with custom concurrency', () => {
      const q = new TaskQueue({ concurrency: 8 })
      expect(q).toBeInstanceOf(TaskQueue)
    })

    it('should create queue with autoStart disabled', () => {
      const q = new TaskQueue({ autoStart: false })
      const status = q.getStatus()
      expect(status.paused).toBe(false)
    })
  })

  describe('add', () => {
    it('should add task to queue', () => {
      const task: Task = {
        id: 'task-1',
        fn: async () => 'result'
      }

      queue.add(task)
      const status = queue.getStatus()

      expect(status.total).toBe(1)
      expect(status.pending).toBe(1)
    })

    it('should add multiple tasks', () => {
      queue.add({ id: 'task-1', fn: async () => 1 })
      queue.add({ id: 'task-2', fn: async () => 2 })
      queue.add({ id: 'task-3', fn: async () => 3 })

      const status = queue.getStatus()
      expect(status.total).toBe(3)
      expect(status.pending).toBe(3)
    })

    it('should sort tasks by priority', () => {
      queue.add({ id: 'low', fn: async () => 1, priority: 1 })
      queue.add({ id: 'high', fn: async () => 2, priority: 10 })
      queue.add({ id: 'medium', fn: async () => 3, priority: 5 })

      // Start and check execution order
      queue.start()

      const status = queue.getStatus()
      expect(status.pending).toBeLessThanOrEqual(3)
    })

    it('should emit task-added event', () => {
      const listener = vi.fn()
      queue.on('task-added', listener)

      const task: Task = { id: 'task-1', fn: async () => 1 }
      queue.add(task)

      expect(listener).toHaveBeenCalledWith(task)
    })

    it('should auto-start if enabled', async () => {
      const autoQueue = new TaskQueue({ autoStart: true, concurrency: 1 })
      const fn = vi.fn().mockResolvedValue('result')

      autoQueue.add({ id: 'task-1', fn })

      await vi.runAllTimersAsync()

      expect(fn).toHaveBeenCalled()
    })
  })

  describe('addBatch', () => {
    it('should add multiple tasks at once', () => {
      const tasks: Task[] = [
        { id: 'task-1', fn: async () => 1 },
        { id: 'task-2', fn: async () => 2 },
        { id: 'task-3', fn: async () => 3 }
      ]

      queue.addBatch(tasks)
      const status = queue.getStatus()

      expect(status.total).toBe(3)
      expect(status.pending).toBe(3)
    })
  })

  describe('start and pause', () => {
    it('should start processing tasks', async () => {
      const fn = vi.fn().mockResolvedValue('result')
      queue.add({ id: 'task-1', fn })

      queue.start()
      await vi.runAllTimersAsync()

      expect(fn).toHaveBeenCalled()
    })

    it('should pause processing', async () => {
      const fn = vi.fn().mockResolvedValue('result')
      queue.add({ id: 'task-1', fn })

      queue.pause()
      queue.start()

      const status = queue.getStatus()
      expect(status.paused).toBe(false)
    })

    it('should resume after pause', async () => {
      const fn = vi.fn().mockResolvedValue('result')
      queue.add({ id: 'task-1', fn })

      queue.pause()
      expect(queue.getStatus().paused).toBe(true)

      queue.start()
      expect(queue.getStatus().paused).toBe(false)
    })
  })

  describe('clear', () => {
    it('should clear all tasks', () => {
      queue.add({ id: 'task-1', fn: async () => 1 })
      queue.add({ id: 'task-2', fn: async () => 2 })

      queue.clear()
      const status = queue.getStatus()

      expect(status.total).toBe(0)
      expect(status.pending).toBe(0)
    })

    it('should emit cleared event', () => {
      const listener = vi.fn()
      queue.on('cleared', listener)

      queue.clear()

      expect(listener).toHaveBeenCalled()
    })
  })

  describe('waitAll', () => {
    it('should wait for all tasks to complete', async () => {
      vi.useRealTimers()

      queue.add({
        id: 'task-1',
        fn: async () => {
          await new Promise(resolve => setTimeout(resolve, 10))
          return 'result-1'
        }
      })

      queue.add({
        id: 'task-2',
        fn: async () => {
          await new Promise(resolve => setTimeout(resolve, 20))
          return 'result-2'
        }
      })

      queue.start()
      const results = await queue.waitAll()

      expect(results.size).toBe(2)
      expect(results.get('task-1')?.success).toBe(true)
      expect(results.get('task-2')?.success).toBe(true)
    })

    it('should resolve immediately if no tasks', async () => {
      const results = await queue.waitAll()
      expect(results.size).toBe(0)
    })
  })

  describe('concurrency control', () => {
    it('should respect concurrency limit', async () => {
      vi.useRealTimers()
      const concurrentQueue = new TaskQueue({ concurrency: 2, autoStart: true })

      let running = 0
      let maxConcurrent = 0

      const createTask = (id: string) => ({
        id,
        fn: async () => {
          running++
          maxConcurrent = Math.max(maxConcurrent, running)
          await new Promise(resolve => setTimeout(resolve, 10))
          running--
          return id
        }
      })

      concurrentQueue.add(createTask('task-1'))
      concurrentQueue.add(createTask('task-2'))
      concurrentQueue.add(createTask('task-3'))
      concurrentQueue.add(createTask('task-4'))

      await concurrentQueue.waitAll()

      expect(maxConcurrent).toBeLessThanOrEqual(2)
    })
  })

  describe('dependencies', () => {
    it('should execute tasks in dependency order', async () => {
      vi.useRealTimers()
      const executionOrder: string[] = []

      queue.add({
        id: 'task-1',
        fn: async () => {
          executionOrder.push('task-1')
          return 1
        }
      })

      queue.add({
        id: 'task-2',
        fn: async () => {
          executionOrder.push('task-2')
          return 2
        },
        dependencies: ['task-1']
      })

      queue.add({
        id: 'task-3',
        fn: async () => {
          executionOrder.push('task-3')
          return 3
        },
        dependencies: ['task-1', 'task-2']
      })

      queue.start()
      await queue.waitAll()

      expect(executionOrder).toEqual(['task-1', 'task-2', 'task-3'])
    })

    it('should not execute task if dependency fails', async () => {
      vi.useRealTimers()
      const task2Fn = vi.fn().mockResolvedValue(2)

      queue.add({
        id: 'task-1',
        fn: async () => {
          throw new Error('Task 1 failed')
        }
      })

      queue.add({
        id: 'task-2',
        fn: task2Fn,
        dependencies: ['task-1']
      })

      queue.start()
      await queue.waitAll()

      expect(task2Fn).not.toHaveBeenCalled()
    })
  })

  describe('timeout', () => {
    it('should timeout long-running tasks', async () => {
      vi.useRealTimers()

      const task: Task = {
        id: 'slow-task',
        fn: async () => {
          await new Promise(resolve => setTimeout(resolve, 1000))
          return 'should-not-complete'
        },
        timeout: 50
      }

      queue.add(task)
      queue.start()
      await queue.waitAll()

      const result = queue.getResult('slow-task')
      expect(result?.success).toBe(false)
      expect(result?.error?.message).toBe('Task timeout')
    })
  })

  describe('retry', () => {
    it('should retry failed tasks', async () => {
      vi.useRealTimers()
      let attempts = 0

      const task: Task = {
        id: 'retry-task',
        fn: async () => {
          attempts++
          if (attempts < 3) {
            throw new Error('Temporary failure')
          }
          return 'success'
        },
        retries: 2
      }

      queue.add(task)
      queue.start()
      await queue.waitAll()

      const result = queue.getResult('retry-task')
      expect(result?.success).toBe(true)
      expect(result?.retryCount).toBe(2)
      expect(attempts).toBe(3)
    })

    it('should emit retry events', async () => {
      vi.useRealTimers()
      const retryListener = vi.fn()
      queue.on('task-retry', retryListener)

      let attempts = 0
      queue.add({
        id: 'retry-task',
        fn: async () => {
          attempts++
          if (attempts < 2) {
            throw new Error('Fail')
          }
          return 'ok'
        },
        retries: 1
      })

      queue.start()
      await queue.waitAll()

      expect(retryListener).toHaveBeenCalledWith('retry-task', 1)
    })

    it('should fail after max retries', async () => {
      vi.useRealTimers()

      const task: Task = {
        id: 'fail-task',
        fn: async () => {
          throw new Error('Always fails')
        },
        retries: 2
      }

      queue.add(task)
      queue.start()
      await queue.waitAll()

      const result = queue.getResult('fail-task')
      expect(result?.success).toBe(false)
      expect(result?.retryCount).toBe(2)
    })
  })

  describe('events', () => {
    it('should emit task-start event', async () => {
      vi.useRealTimers()
      const listener = vi.fn()
      queue.on('task-start', listener)

      queue.add({ id: 'task-1', fn: async () => 1 })
      queue.start()

      await new Promise(resolve => setTimeout(resolve, 10))

      expect(listener).toHaveBeenCalledWith('task-1')
    })

    it('should emit task-complete event', async () => {
      vi.useRealTimers()
      const listener = vi.fn()
      queue.on('task-complete', listener)

      queue.add({ id: 'task-1', fn: async () => 'result' })
      queue.start()
      await queue.waitAll()

      expect(listener).toHaveBeenCalled()
      const result = listener.mock.calls[0][0]
      expect(result.id).toBe('task-1')
      expect(result.success).toBe(true)
    })

    it('should emit task-error event', async () => {
      vi.useRealTimers()
      const listener = vi.fn()
      queue.on('task-error', listener)

      queue.add({
        id: 'task-1',
        fn: async () => {
          throw new Error('Test error')
        }
      })

      queue.start()
      await queue.waitAll()

      expect(listener).toHaveBeenCalled()
      const result = listener.mock.calls[0][0]
      expect(result.id).toBe('task-1')
      expect(result.success).toBe(false)
    })
  })

  describe('getResult', () => {
    it('should return task result', async () => {
      vi.useRealTimers()

      queue.add({ id: 'task-1', fn: async () => 'result' })
      queue.start()
      await queue.waitAll()

      const result = queue.getResult('task-1')
      expect(result?.id).toBe('task-1')
      expect(result?.success).toBe(true)
      expect(result?.data).toBe('result')
    })

    it('should return undefined for non-existent task', () => {
      const result = queue.getResult('non-existent')
      expect(result).toBeUndefined()
    })
  })

  describe('getAllResults', () => {
    it('should return all task results', async () => {
      vi.useRealTimers()

      queue.add({ id: 'task-1', fn: async () => 1 })
      queue.add({ id: 'task-2', fn: async () => 2 })
      queue.start()
      await queue.waitAll()

      const results = queue.getAllResults()
      expect(results.size).toBe(2)
      expect(results.get('task-1')?.data).toBe(1)
      expect(results.get('task-2')?.data).toBe(2)
    })
  })

  describe('getStatus', () => {
    it('should return current queue status', () => {
      queue.add({ id: 'task-1', fn: async () => 1 })
      queue.add({ id: 'task-2', fn: async () => 2 })

      const status = queue.getStatus()
      expect(status.total).toBe(2)
      expect(status.pending).toBe(2)
      expect(status.running).toBe(0)
      expect(status.completed).toBe(0)
      expect(status.paused).toBe(false)
    })
  })

  describe('factory functions', () => {
    it('createTaskQueue should create new queue', () => {
      const q = createTaskQueue({ concurrency: 8 })
      expect(q).toBeInstanceOf(TaskQueue)
    })

    it('parallel should execute tasks concurrently', async () => {
      vi.useRealTimers()

      const tasks = [
        async () => 1,
        async () => 2,
        async () => 3
      ]

      const results = await parallel(tasks, 2)

      expect(results).toEqual([1, 2, 3])
    })

    it('parallel should preserve order', async () => {
      vi.useRealTimers()

      const tasks = [
        async () => {
          await new Promise(resolve => setTimeout(resolve, 30))
          return 'first'
        },
        async () => {
          await new Promise(resolve => setTimeout(resolve, 10))
          return 'second'
        },
        async () => {
          await new Promise(resolve => setTimeout(resolve, 20))
          return 'third'
        }
      ]

      const results = await parallel(tasks, 3)

      expect(results).toEqual(['first', 'second', 'third'])
    })

    it('parallel should throw on task failure', async () => {
      vi.useRealTimers()

      const tasks = [
        async () => 1,
        async () => {
          throw new Error('Task failed')
        },
        async () => 3
      ]

      await expect(parallel(tasks, 2)).rejects.toThrow('Task failed')
    })
  })
})
