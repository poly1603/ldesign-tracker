/**
 * Tracker 核心类单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createTracker, Tracker, TrackEventType } from '@ldesign/tracker-core'

describe('Tracker', () => {
  let tracker: Tracker

  beforeEach(() => {
    vi.useFakeTimers()
    tracker = createTracker({
      appName: 'TestApp',
      debug: false,
      autoPageView: false,
      autoClick: false,
      autoScroll: false,
      autoInput: false,
      autoError: false,
      autoPerformance: false,
    })
  })

  afterEach(() => {
    tracker.uninstall()
    vi.useRealTimers()
    localStorage.clear()
    sessionStorage.clear()
  })

  describe('initialization', () => {
    it('should create tracker instance', () => {
      expect(tracker).toBeInstanceOf(Tracker)
    })

    it('should not be initialized before install', () => {
      expect(tracker.isInitialized()).toBe(false)
    })

    it('should be initialized after install', () => {
      tracker.install()
      expect(tracker.isInitialized()).toBe(true)
    })

    it('should generate session ID', () => {
      tracker.install()
      expect(tracker.getSessionId()).toBeTruthy()
      expect(typeof tracker.getSessionId()).toBe('string')
    })

    it('should generate page ID', () => {
      tracker.install()
      expect(tracker.getPageId()).toBeTruthy()
      expect(tracker.getPageId()).toMatch(/^page-/)
    })
  })

  describe('tracking', () => {
    beforeEach(() => {
      tracker.install()
    })

    it('should track custom events', () => {
      const onTrack = vi.fn()
      tracker.updateOptions({ onTrack })

      tracker.track('test_event', { key: 'value' })

      expect(onTrack).toHaveBeenCalledTimes(1)
      expect(onTrack).toHaveBeenCalledWith(
        expect.objectContaining({
          type: TrackEventType.CUSTOM,
          name: 'test_event',
          data: { key: 'value' },
        })
      )
    })

    it('should include session ID in events', () => {
      const onTrack = vi.fn()
      tracker.updateOptions({ onTrack })

      tracker.track('test_event')

      expect(onTrack).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: tracker.getSessionId(),
        })
      )
    })

    it('should include page ID in events', () => {
      const onTrack = vi.fn()
      tracker.updateOptions({ onTrack })

      tracker.track('test_event')

      expect(onTrack).toHaveBeenCalledWith(
        expect.objectContaining({
          pageId: tracker.getPageId(),
        })
      )
    })

    it('should track page view', () => {
      const onTrack = vi.fn()
      tracker.updateOptions({ onTrack })

      tracker.trackPageView({ customData: 'test' })

      expect(onTrack).toHaveBeenCalledWith(
        expect.objectContaining({
          type: TrackEventType.PAGE_VIEW,
          name: 'page_view',
        })
      )
    })

    it('should generate new page ID on page view', () => {
      const oldPageId = tracker.getPageId()
      tracker.trackPageView()
      const newPageId = tracker.getPageId()

      expect(newPageId).not.toBe(oldPageId)
    })
  })

  describe('user management', () => {
    beforeEach(() => {
      tracker.install()
    })

    it('should set user ID', () => {
      const onTrack = vi.fn()
      tracker.updateOptions({ onTrack })

      tracker.setUserId('user_123')
      tracker.track('test_event')

      expect(onTrack).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user_123',
        })
      )
    })

    it('should set global properties', () => {
      const onTrack = vi.fn()
      tracker.updateOptions({ onTrack })

      tracker.setGlobalProperties({ platform: 'web', version: '1.0' })
      tracker.track('test_event')

      expect(onTrack).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({
            platform: 'web',
            version: '1.0',
          }),
        })
      )
    })
  })

  describe('event filtering', () => {
    beforeEach(() => {
      tracker.install()
    })

    it('should filter events with beforeTrack', () => {
      const onTrack = vi.fn()
      tracker.updateOptions({
        onTrack,
        beforeTrack: (event) => {
          if (event.name === 'ignore_me') return null
          return event
        },
      })

      tracker.track('ignore_me')
      tracker.track('keep_me')

      expect(onTrack).toHaveBeenCalledTimes(1)
      expect(onTrack).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'keep_me' })
      )
    })

    it('should transform events with transformEvent', () => {
      const onTrack = vi.fn()
      tracker.updateOptions({
        onTrack,
        transformEvent: (event) => ({
          ...event,
          data: { ...event.data, transformed: true },
        }),
      })

      tracker.track('test_event', { original: true })

      expect(onTrack).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { original: true, transformed: true },
        })
      )
    })
  })

  describe('sampling', () => {
    it('should skip events when sampling rate is 0', () => {
      const onTrack = vi.fn()
      tracker = createTracker({
        appName: 'TestApp',
        sampleRate: 0,
        onTrack,
        autoPageView: false,
        autoClick: false,
        autoScroll: false,
        autoInput: false,
        autoError: false,
        autoPerformance: false,
      })
      tracker.install()

      for (let i = 0; i < 100; i++) {
        tracker.track('test_event')
      }

      expect(onTrack).not.toHaveBeenCalled()
    })

    it('should track all events when sampling rate is 1', () => {
      const onTrack = vi.fn()
      tracker = createTracker({
        appName: 'TestApp',
        sampleRate: 1,
        onTrack,
        autoPageView: false,
        autoClick: false,
        autoScroll: false,
        autoInput: false,
        autoError: false,
        autoPerformance: false,
      })
      tracker.install()

      for (let i = 0; i < 10; i++) {
        tracker.track('test_event')
      }

      expect(onTrack).toHaveBeenCalledTimes(10)
    })
  })

  describe('batching', () => {
    beforeEach(() => {
      tracker.install()
    })

    it('should queue events', () => {
      tracker.track('event1')
      tracker.track('event2')
      tracker.track('event3')

      const events = tracker.getEvents()
      expect(events).toHaveLength(3)
    })

    it('should clear queue after flush', async () => {
      tracker.track('event1')
      tracker.track('event2')

      await tracker.flush()

      expect(tracker.getEvents()).toHaveLength(0)
    })
  })

  describe('device info', () => {
    beforeEach(() => {
      tracker.install()
    })

    it('should collect device info', () => {
      const deviceInfo = tracker.getDeviceInfoCached()

      expect(deviceInfo).toBeTruthy()
      expect(deviceInfo?.userAgent).toBeTruthy()
      expect(typeof deviceInfo?.screenWidth).toBe('number')
      expect(typeof deviceInfo?.screenHeight).toBe('number')
      expect(typeof deviceInfo?.viewportWidth).toBe('number')
      expect(typeof deviceInfo?.viewportHeight).toBe('number')
      expect(deviceInfo?.language).toBeTruthy()
    })
  })

  describe('lifecycle', () => {
    it('should handle multiple install calls', () => {
      tracker.install()
      tracker.install()
      tracker.install()

      expect(tracker.isInitialized()).toBe(true)
    })

    it('should handle uninstall before install', () => {
      tracker.uninstall()
      expect(tracker.isInitialized()).toBe(false)
    })

    it('should clean up on uninstall', () => {
      tracker.install()
      tracker.track('event1')

      expect(tracker.getEvents().length).toBeGreaterThan(0)

      tracker.uninstall()
      expect(tracker.isInitialized()).toBe(false)
    })
  })

  describe('options update', () => {
    beforeEach(() => {
      tracker.install()
    })

    it('should update options', () => {
      const newOnTrack = vi.fn()
      tracker.updateOptions({ onTrack: newOnTrack })

      tracker.track('test_event')

      expect(newOnTrack).toHaveBeenCalled()
    })
  })

  describe('disabled tracker', () => {
    it('should not track when disabled', () => {
      const onTrack = vi.fn()
      tracker = createTracker({
        enabled: false,
        onTrack,
        autoPageView: false,
        autoClick: false,
        autoScroll: false,
        autoInput: false,
        autoError: false,
        autoPerformance: false,
      })
      tracker.install()

      tracker.track('test_event')

      expect(tracker.isInitialized()).toBe(false)
    })
  })
})

describe('createTracker', () => {
  it('should create tracker with default options', () => {
    const tracker = createTracker()
    expect(tracker).toBeInstanceOf(Tracker)
    tracker.uninstall()
  })

  it('should create tracker with custom options', () => {
    const tracker = createTracker({
      appName: 'CustomApp',
      debug: true,
    })
    expect(tracker).toBeInstanceOf(Tracker)
    tracker.uninstall()
  })
})
