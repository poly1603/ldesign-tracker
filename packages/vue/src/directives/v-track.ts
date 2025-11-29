/**
 * v-track 指令
 * @description 声明式追踪用户行为
 */

import type { Directive, DirectiveBinding } from 'vue'
import type { Tracker, TrackEventType } from '@ldesign/tracker-core'

/** 指令绑定值 */
export interface TrackDirectiveValue {
  /** 事件名称 */
  name: string
  /** 事件类型 */
  type?: TrackEventType
  /** 事件数据 */
  data?: Record<string, unknown>
  /** 触发事件（默认 click） */
  trigger?: 'click' | 'mouseenter' | 'mouseleave' | 'focus' | 'blur'
}

/** 元素扩展属性 */
interface TrackElement extends HTMLElement {
  __trackHandler__?: (e: Event) => void
  __trackTrigger__?: string
}

/** 追踪器实例（由插件注入） */
let trackerInstance: Tracker | null = null

/**
 * 设置追踪器实例
 * @param tracker - 追踪器实例
 */
export function setTrackerInstance(tracker: Tracker): void {
  trackerInstance = tracker
}

/**
 * 获取追踪器实例
 * @returns 追踪器实例
 */
export function getTrackerInstance(): Tracker | null {
  return trackerInstance
}

/**
 * 创建 v-track 指令
 * @returns Vue 指令
 */
export function createTrackDirective(): Directive<TrackElement, TrackDirectiveValue | string> {
  return {
    mounted(el, binding) {
      bindTrackEvent(el, binding)
    },

    updated(el, binding) {
      // 如果绑定值变化，重新绑定
      if (binding.value !== binding.oldValue) {
        unbindTrackEvent(el)
        bindTrackEvent(el, binding)
      }
    },

    unmounted(el) {
      unbindTrackEvent(el)
    },
  }
}

/**
 * 绑定追踪事件
 * @param el - 元素
 * @param binding - 指令绑定
 */
function bindTrackEvent(
  el: TrackElement,
  binding: DirectiveBinding<TrackDirectiveValue | string>,
): void {
  if (!trackerInstance) {
    console.warn('[v-track] 追踪器未初始化')
    return
  }

  // 解析绑定值
  const value = parseBindingValue(binding)
  const trigger = value.trigger || 'click'

  // 创建事件处理器
  const handler = () => {
    trackerInstance?.track(value.name, {
      ...value.data,
      elementId: el.id,
      elementClass: el.className,
      elementText: el.textContent?.slice(0, 50),
    })
  }

  // 绑定事件
  el.addEventListener(trigger, handler)
  el.__trackHandler__ = handler
  el.__trackTrigger__ = trigger
}

/**
 * 解绑追踪事件
 * @param el - 元素
 */
function unbindTrackEvent(el: TrackElement): void {
  if (el.__trackHandler__ && el.__trackTrigger__) {
    el.removeEventListener(el.__trackTrigger__, el.__trackHandler__)
    delete el.__trackHandler__
    delete el.__trackTrigger__
  }
}

/**
 * 解析绑定值
 * @param binding - 指令绑定
 * @returns 解析后的值
 */
function parseBindingValue(
  binding: DirectiveBinding<TrackDirectiveValue | string>,
): TrackDirectiveValue {
  const { value, arg, modifiers } = binding

  // 字符串形式：v-track="'button_click'"
  if (typeof value === 'string') {
    return {
      name: value,
      trigger: (arg as TrackDirectiveValue['trigger']) || 'click',
    }
  }

  // 对象形式：v-track="{ name: 'button_click', data: { ... } }"
  return {
    name: value.name,
    type: value.type,
    data: value.data,
    trigger: value.trigger || (arg as TrackDirectiveValue['trigger']) || 'click',
  }
}

/** 导出指令 */
export const vTrack = createTrackDirective()

