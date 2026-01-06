/**
 * 工具函数单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  generateUUID,
  generateShortId,
  generateSessionId,
  generatePageId,
  throttle,
  debounce,
  retry,
  sleep,
  isBrowser,
  isOnline,
  safeStringify,
  safeParse,
  deepClone,
  merge,
  deepMerge,
  truncate,
  get,
  shouldSample,
  consistentSample,
  createLogger,
  createEventQueue,
} from '@ldesign/tracker-core'

describe('ID Generation', () => {
  describe('generateUUID', () => {
    it('should generate valid UUID v4 format', () => {
      const uuid = generateUUID()
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    })

    it('should generate unique IDs', () => {
      const ids = new Set()
      for (let i = 0; i < 1000; i++) {
        ids.add(generateUUID())
      }
      expect(ids.size).toBe(1000)
    })
  })

  describe('generateShortId', () => {
    it('should generate ID with default length', () => {
      const id = generateShortId()
      expect(id).toHaveLength(8)
    })

    it('should generate ID with custom length', () => {
      const id = generateShortId(12)
      expect(id).toHaveLength(12)
    })

    it('should only contain alphanumeric characters', () => {
      const id = generateShortId(100)
      expect(id).toMatch(/^[A-Za-z0-9]+$/)
    })
  })

  describe('generateSessionId', () => {
    it('should generate valid session ID', () => {
      const sessionId = generateSessionId()
      expect(sessionId).toMatch(/^[a-z0-9]+-[A-Za-z0-9]+$/)
    })
  })

  describe('generatePageId', () => {
    it('should generate valid page ID', () => {
      const pageId = generatePageId()
      expect(pageId).toMatch(/^page-[A-Za-z0-9]+$/)
    })
  })
})

describe('Function Utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('throttle', () => {
    it('should throttle function calls', () => {
      const fn = vi.fn()
      const throttled = throttle(fn, 100)

      throttled()
      throttled()
      throttled()

      expect(fn).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(100)
      throttled()
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('should cancel pending calls', () => {
      const fn = vi.fn()
      const throttled = throttle(fn, 100)

      throttled()
      throttled.cancel()
      vi.advanceTimersByTime(100)

      expect(fn).toHaveBeenCalledTimes(1)
    })
  })

  describe('debounce', () => {
    it('should debounce function calls', () => {
      const fn = vi.fn()
      const debounced = debounce(fn, 100)

      debounced()
      debounced()
      debounced()

      expect(fn).not.toHaveBeenCalled()

      vi.advanceTimersByTime(100)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should support immediate option', () => {
      const fn = vi.fn()
      const debounced = debounce(fn, 100, true)

      debounced()
      expect(fn).toHaveBeenCalledTimes(1)

      debounced()
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should cancel pending calls', () => {
      const fn = vi.fn()
      const debounced = debounce(fn, 100)

      debounced()
      debounced.cancel()
      vi.advanceTimersByTime(100)

      expect(fn).not.toHaveBeenCalled()
    })

    it('should flush pending calls', () => {
      const fn = vi.fn()
      const debounced = debounce(fn, 100)

      debounced()
      debounced.flush()

      expect(fn).toHaveBeenCalledTimes(1)
    })
  })

  describe('retry', () => {
    it('should succeed on first try', async () => {
      vi.useRealTimers()
      const fn = vi.fn().mockResolvedValue('success')

      const result = await retry(fn, { maxRetries: 3 })

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should retry on failure', async () => {
      vi.useRealTimers()
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('success')

      const result = await retry(fn, { maxRetries: 3, baseDelay: 10 })

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('should throw after max retries', async () => {
      vi.useRealTimers()
      const fn = vi.fn().mockRejectedValue(new Error('fail'))

      await expect(retry(fn, { maxRetries: 2, baseDelay: 10 }))
        .rejects.toThrow('fail')
      expect(fn).toHaveBeenCalledTimes(3)
    })
  })

  describe('sleep', () => {
    it('should delay execution', async () => {
      const start = Date.now()
      const promise = sleep(100)
      vi.advanceTimersByTime(100)
      await promise
      // Time should have "advanced" by 100ms in fake timers
    })
  })
})

describe('Browser Utilities', () => {
  describe('isBrowser', () => {
    it('should return true in jsdom environment', () => {
      expect(isBrowser()).toBe(true)
    })
  })

  describe('isOnline', () => {
    it('should return true when online', () => {
      expect(isOnline()).toBe(true)
    })
  })
})

describe('Data Processing', () => {
  describe('safeStringify', () => {
    it('should stringify valid objects', () => {
      const obj = { a: 1, b: 'test' }
      expect(safeStringify(obj)).toBe('{"a":1,"b":"test"}')
    })

    it('should return fallback for circular references', () => {
      const obj: any = { a: 1 }
      obj.self = obj
      expect(safeStringify(obj, 'fallback')).toBe('fallback')
    })
  })

  describe('safeParse', () => {
    it('should parse valid JSON', () => {
      const result = safeParse('{"a":1}', {})
      expect(result).toEqual({ a: 1 })
    })

    it('should return fallback for invalid JSON', () => {
      const result = safeParse('invalid', { default: true })
      expect(result).toEqual({ default: true })
    })
  })

  describe('deepClone', () => {
    it('should deep clone objects', () => {
      const obj = { a: { b: { c: 1 } } }
      const cloned = deepClone(obj)

      expect(cloned).toEqual(obj)
      expect(cloned).not.toBe(obj)
      expect(cloned.a).not.toBe(obj.a)
    })

    it('should handle primitives', () => {
      expect(deepClone(1)).toBe(1)
      expect(deepClone('test')).toBe('test')
      expect(deepClone(null)).toBe(null)
    })
  })

  describe('merge', () => {
    it('should merge objects shallowly', () => {
      const result = merge({ a: 1 }, { b: 2 }, { c: 3 })
      expect(result).toEqual({ a: 1, b: 2, c: 3 })
    })

    it('should override properties', () => {
      const result = merge({ a: 1 }, { a: 2 })
      expect(result).toEqual({ a: 2 })
    })
  })

  describe('deepMerge', () => {
    it('should merge objects deeply', () => {
      const target = { a: { b: 1, c: 2 } }
      const source = { a: { c: 3, d: 4 } }
      const result = deepMerge(target, source)

      expect(result).toEqual({ a: { b: 1, c: 3, d: 4 } })
    })

    it('should not mutate original objects', () => {
      const target = { a: 1 }
      const source = { b: 2 }
      const result = deepMerge(target, source)

      expect(target).toEqual({ a: 1 })
      expect(result).toEqual({ a: 1, b: 2 })
    })
  })

  describe('truncate', () => {
    it('should truncate long strings', () => {
      const result = truncate('Hello World', 8)
      expect(result).toBe('Hello...')
    })

    it('should not truncate short strings', () => {
      const result = truncate('Hi', 10)
      expect(result).toBe('Hi')
    })

    it('should support custom suffix', () => {
      const result = truncate('Hello World', 9, '…')
      expect(result).toBe('Hello Wo…')
    })
  })

  describe('get', () => {
    it('should get nested properties', () => {
      const obj = { a: { b: { c: 1 } } }
      expect(get(obj, 'a.b.c')).toBe(1)
    })

    it('should return undefined for missing properties', () => {
      const obj = { a: 1 }
      expect(get(obj, 'b.c')).toBeUndefined()
    })

    it('should return default value for missing properties', () => {
      const obj = { a: 1 }
      expect(get(obj, 'b.c', 'default')).toBe('default')
    })
  })
})

describe('Sampling', () => {
  describe('shouldSample', () => {
    it('should always return true for rate >= 1', () => {
      for (let i = 0; i < 100; i++) {
        expect(shouldSample(1)).toBe(true)
        expect(shouldSample(1.5)).toBe(true)
      }
    })

    it('should always return false for rate <= 0', () => {
      for (let i = 0; i < 100; i++) {
        expect(shouldSample(0)).toBe(false)
        expect(shouldSample(-1)).toBe(false)
      }
    })

    it('should sample approximately at the given rate', () => {
      let trueCount = 0
      const iterations = 10000

      for (let i = 0; i < iterations; i++) {
        if (shouldSample(0.5)) trueCount++
      }

      // Should be roughly 50% (with some tolerance)
      expect(trueCount / iterations).toBeGreaterThan(0.4)
      expect(trueCount / iterations).toBeLessThan(0.6)
    })
  })

  describe('consistentSample', () => {
    it('should return consistent results for same userId', () => {
      const results = new Set()
      for (let i = 0; i < 100; i++) {
        results.add(consistentSample('user123', 0.5))
      }
      expect(results.size).toBe(1)
    })

    it('should return different results for different userIds', () => {
      const results = new Set()
      for (let i = 0; i < 100; i++) {
        results.add(consistentSample(`user${i}`, 0.5))
      }
      expect(results.size).toBe(2) // true and false
    })
  })
})

describe('Logger', () => {
  describe('createLogger', () => {
    it('should create logger with methods', () => {
      const logger = createLogger()
      expect(typeof logger.debug).toBe('function')
      expect(typeof logger.info).toBe('function')
      expect(typeof logger.warn).toBe('function')
      expect(typeof logger.error).toBe('function')
      expect(typeof logger.setLevel).toBe('function')
    })

    it('should respect log level', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
      const logger = createLogger('[Test]', 'warn')

      logger.debug('test')
      expect(consoleSpy).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })
})

describe('Event Queue', () => {
  describe('createEventQueue', () => {
    it('should enqueue and dequeue items', () => {
      const queue = createEventQueue<number>(10)

      queue.enqueue(1)
      queue.enqueue(2)

      expect(queue.size).toBe(2)
      expect(queue.dequeue()).toBe(1)
      expect(queue.dequeue()).toBe(2)
      expect(queue.isEmpty).toBe(true)
    })

    it('should respect max size', () => {
      const queue = createEventQueue<number>(3)

      expect(queue.enqueue(1)).toBe(true)
      expect(queue.enqueue(2)).toBe(true)
      expect(queue.enqueue(3)).toBe(true)
      expect(queue.enqueue(4)).toBe(false)
      expect(queue.isFull).toBe(true)
    })

    it('should dequeue all items', () => {
      const queue = createEventQueue<number>(10)

      queue.enqueue(1)
      queue.enqueue(2)
      queue.enqueue(3)

      const items = queue.dequeueAll()
      expect(items).toEqual([1, 2, 3])
      expect(queue.isEmpty).toBe(true)
    })

    it('should dequeue specified count', () => {
      const queue = createEventQueue<number>(10)

      queue.enqueue(1)
      queue.enqueue(2)
      queue.enqueue(3)

      const items = queue.dequeueAll(2)
      expect(items).toEqual([1, 2])
      expect(queue.size).toBe(1)
    })

    it('should peek without removing', () => {
      const queue = createEventQueue<number>(10)

      queue.enqueue(1)
      expect(queue.peek()).toBe(1)
      expect(queue.size).toBe(1)
    })

    it('should clear all items', () => {
      const queue = createEventQueue<number>(10)

      queue.enqueue(1)
      queue.enqueue(2)
      queue.clear()

      expect(queue.isEmpty).toBe(true)
    })

    it('should convert to array', () => {
      const queue = createEventQueue<number>(10)

      queue.enqueue(1)
      queue.enqueue(2)

      expect(queue.toArray()).toEqual([1, 2])
      expect(queue.size).toBe(2) // Should not modify queue
    })
  })
})
