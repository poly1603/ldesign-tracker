/**
 * 输入事件收集器
 * @description 收集用户输入行为（脱敏处理）
 */

import { TrackEventType } from '../types'
import type { InputData } from '../types'
import { BaseCollector } from './base-collector'

/**
 * 输入收集器配置
 */
export interface InputCollectorOptions {
  /** 敏感字段名（需要脱敏） */
  sensitiveFields?: string[]
  /** 防抖延迟（毫秒） */
  debounceDelay?: number
  /** 忽略的输入类型 */
  ignoreTypes?: string[]
}

/**
 * 输入事件收集器
 */
export class InputCollector extends BaseCollector {
  name = 'input'
  private options: Required<InputCollectorOptions>
  private inputHandler: ((e: Event) => void) | null = null
  private changeHandler: ((e: Event) => void) | null = null
  private debounceTimers = new Map<Element, ReturnType<typeof setTimeout>>()

  constructor(options: InputCollectorOptions = {}) {
    super()
    this.options = {
      sensitiveFields: options.sensitiveFields ?? ['password', 'pwd', 'secret', 'token', 'card', 'cvv'],
      debounceDelay: options.debounceDelay ?? 500,
      ignoreTypes: options.ignoreTypes ?? ['password', 'hidden'],
    }
  }

  /**
   * 安装收集器
   */
  install(): void {
    if (this.installed)
      return

    this.inputHandler = this.handleInput.bind(this)
    this.changeHandler = this.handleChange.bind(this)

    document.addEventListener('input', this.inputHandler, true)
    document.addEventListener('change', this.changeHandler, true)

    this.installed = true
  }

  /**
   * 卸载收集器
   */
  uninstall(): void {
    if (!this.installed)
      return

    if (this.inputHandler) {
      document.removeEventListener('input', this.inputHandler, true)
    }
    if (this.changeHandler) {
      document.removeEventListener('change', this.changeHandler, true)
    }

    // 清理所有定时器
    this.debounceTimers.forEach(timer => clearTimeout(timer))
    this.debounceTimers.clear()

    this.inputHandler = null
    this.changeHandler = null
    this.installed = false
  }

  /**
   * 处理输入事件（防抖）
   * @param event - 输入事件
   */
  private handleInput(event: Event): void {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement
    if (!this.isValidTarget(target))
      return

    // 清除之前的定时器
    const existingTimer = this.debounceTimers.get(target)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // 设置新的定时器
    const timer = setTimeout(() => {
      this.emitInputEvent(target)
      this.debounceTimers.delete(target)
    }, this.options.debounceDelay)

    this.debounceTimers.set(target, timer)
  }

  /**
   * 处理 change 事件
   * @param event - change 事件
   */
  private handleChange(event: Event): void {
    const target = event.target as HTMLInputElement | HTMLSelectElement
    if (!this.isValidTarget(target))
      return

    // 清除可能存在的防抖定时器
    const existingTimer = this.debounceTimers.get(target)
    if (existingTimer) {
      clearTimeout(existingTimer)
      this.debounceTimers.delete(target)
    }

    this.emitInputEvent(target)
  }

  /**
   * 检查是否为有效目标
   * @param target - 目标元素
   * @returns 是否有效
   */
  private isValidTarget(target: EventTarget | null): target is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
    if (!target)
      return false

    const element = target as Element
    const tagName = element.tagName?.toLowerCase()

    if (!['input', 'textarea', 'select'].includes(tagName)) {
      return false
    }

    // 检查是否应该忽略
    if (element.hasAttribute('data-track-ignore')) {
      return false
    }

    // 检查输入类型
    const inputType = (element as HTMLInputElement).type?.toLowerCase()
    if (inputType && this.options.ignoreTypes.includes(inputType)) {
      return false
    }

    return true
  }

  /**
   * 发送输入事件
   * @param target - 目标元素
   */
  private emitInputEvent(target: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): void {
    const fieldName = this.getFieldName(target)
    const isSensitive = this.isSensitiveField(fieldName)
    const value = target.value

    const inputData: InputData = {
      inputType: (target as HTMLInputElement).type || target.tagName.toLowerCase(),
      fieldName: isSensitive ? '[REDACTED]' : fieldName,
      valueLength: value.length,
      isEmpty: value.length === 0,
    }

    this.emit({
      type: TrackEventType.INPUT,
      name: `input_${fieldName || 'unknown'}`,
      target: this.getElementInfo(target),
      data: inputData,
    })
  }

  /**
   * 获取字段名
   * @param element - 表单元素
   * @returns 字段名
   */
  private getFieldName(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string | undefined {
    return element.name || element.id || element.getAttribute('data-track-field') || undefined
  }

  /**
   * 检查是否为敏感字段
   * @param fieldName - 字段名
   * @returns 是否敏感
   */
  private isSensitiveField(fieldName: string | undefined): boolean {
    if (!fieldName)
      return false

    const lowerName = fieldName.toLowerCase()
    return this.options.sensitiveFields.some(sensitive =>
      lowerName.includes(sensitive.toLowerCase()),
    )
  }
}

