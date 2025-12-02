/**
 * 条件判断辅助工具
 * 
 * 提供简化复杂条件判断的工具方法
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

/**
 * 检查值是否存在（非 null、undefined、空字符串）
 */
export function isPresent(value: any): boolean {
  return value !== null && value !== undefined && value !== ''
}

/**
 * 检查值是否为空
 */
export function isEmpty(value: any): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value).length === 0
  return false
}

/**
 * 安全获取嵌套属性
 * 
 * @example
 * ```ts
 * const value = getNestedValue(obj, 'a.b.c', 'default')
 * // 等价于 obj?.a?.b?.c ?? 'default'
 * ```
 */
export function getNestedValue<T = any>(
  obj: any,
  path: string,
  defaultValue?: T
): T | undefined {
  const keys = path.split('.')
  let current = obj

  for (const key of keys) {
    if (current === null || current === undefined) {
      return defaultValue
    }
    current = current[key]
  }

  return current ?? defaultValue
}

/**
 * 条件链式检查器
 * 
 * @example
 * ```ts
 * const result = when(config.output)
 *   .check(o => o.format === 'esm', () => buildESM())
 *   .check(o => o.format === 'cjs', () => buildCJS())
 *   .default(() => buildDefault())
 * ```
 */
export class ConditionalChain<T> {
  private value: T
  private result: any = undefined
  private matched = false

  constructor(value: T) {
    this.value = value
  }

  /**
   * 检查条件
   */
  check(condition: (value: T) => boolean, action: (value: T) => any): this {
    if (!this.matched && condition(this.value)) {
      this.result = action(this.value)
      this.matched = true
    }
    return this
  }

  /**
   * 默认分支
   */
  default(action: (value: T) => any): any {
    if (!this.matched) {
      this.result = action(this.value)
    }
    return this.result
  }

  /**
   * 获取结果
   */
  get(): any {
    return this.result
  }
}

/**
 * 创建条件链
 */
export function when<T>(value: T): ConditionalChain<T> {
  return new ConditionalChain(value)
}

/**
 * 多条件 OR 检查
 * 
 * @example
 * ```ts
 * if (anyOf(a, b, c)) { ... }
 * // 替代 if (a || b || c) { ... }
 * ```
 */
export function anyOf(...conditions: boolean[]): boolean {
  return conditions.some(Boolean)
}

/**
 * 多条件 AND 检查
 * 
 * @example
 * ```ts
 * if (allOf(a, b, c)) { ... }
 * // 替代 if (a && b && c) { ... }
 * ```
 */
export function allOf(...conditions: boolean[]): boolean {
  return conditions.every(Boolean)
}

/**
 * 范围检查
 */
export function inRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max
}

/**
 * 类型检查辅助
 */
export const is = {
  string: (value: any): value is string => typeof value === 'string',
  number: (value: any): value is number => typeof value === 'number',
  boolean: (value: any): value is boolean => typeof value === 'boolean',
  function: (value: any): value is Function => typeof value === 'function',
  array: (value: any): value is any[] => Array.isArray(value),
  object: (value: any): value is object =>
    value !== null && typeof value === 'object' && !Array.isArray(value),
  null: (value: any): value is null => value === null,
  undefined: (value: any): value is undefined => value === undefined,
  nullish: (value: any): value is null | undefined =>
    value === null || value === undefined
}

/**
 * 提前返回模式辅助
 * 
 * @example
 * ```ts
 * // 替代复杂的 if-else 嵌套
 * function process(config: Config) {
 *   if (!config) return handleMissing()
 *   if (!config.valid) return handleInvalid()
 *   return handleValid(config)
 * }
 * 
 * // 使用辅助方法
 * function process(config: Config) {
 *   return guardReturn(!config, () => handleMissing())
 *     || guardReturn(!config.valid, () => handleInvalid())
 *     || handleValid(config)
 * }
 * ```
 */
export function guardReturn<T>(condition: boolean, fn: () => T): T | null {
  return condition ? fn() : null
}

/**
 * 值映射辅助
 * 
 * @example
 * ```ts
 * const format = mapValue(config.format, {
 *   'esm': 'es6',
 *   'cjs': 'commonjs',
 *   'umd': 'umd'
 * }, 'esm')
 * ```
 */
export function mapValue<T, R>(
  value: T,
  map: Record<string, R>,
  defaultValue?: R
): R | undefined {
  const key = String(value)
  return map[key] ?? defaultValue
}

/**
 * 条件默认值
 * 
 * @example
 * ```ts
 * const dir = defaultWhen(!config.output?.dir, 'dist')
 * // 替代 const dir = config.output?.dir || 'dist'
 * ```
 */
export function defaultWhen<T>(condition: boolean, defaultValue: T): T | undefined {
  return condition ? defaultValue : undefined
}

/**
 * 布尔值归一化
 */
export function normalizeBoolean(value: any, defaultValue: boolean = false): boolean {
  if (value === true || value === 'true' || value === 1) return true
  if (value === false || value === 'false' || value === 0) return false
  return defaultValue
}

/**
 * 数组归一化
 */
export function normalizeArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

/**
 * 配置合并辅助（深度合并，但跳过 null/undefined）
 */
export function mergeConfig<T extends object>(
  target: T,
  ...sources: Partial<T>[]
): T {
  const result = { ...target }

  for (const source of sources) {
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        const value = source[key]
        if (value !== null && value !== undefined) {
          if (is.object(value) && is.object(result[key])) {
            result[key] = mergeConfig(result[key] as any, value as any)
          } else {
            result[key] = value as any
          }
        }
      }
    }
  }

  return result
}
