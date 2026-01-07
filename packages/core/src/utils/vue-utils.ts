/**
 * Vue 组件信息收集工具
 * @description 从 DOM 元素获取 Vue 组件相关信息
 * @packageDocumentation
 */

import type { ComponentInfo, RouteInfo, ComponentContext, RegionInfo, PageContext } from '../types'

// Vue 3 内部属性名
const VUE_INSTANCE_KEY = '__vueParentComponent'
const VUE_APP_KEY = '__vue_app__'

/**
 * Vue 组件实例类型 (简化)
 */
interface VueComponentInstance {
  type?: {
    name?: string
    __name?: string
    __file?: string
    __hmrId?: string
  }
  uid?: number
  parent?: VueComponentInstance | null
  proxy?: Record<string, unknown>
  props?: Record<string, unknown>
  $options?: {
    name?: string
    __file?: string
  }
}

/**
 * Vue Router 实例类型 (简化)
 */
interface VueRouterInstance {
  currentRoute?: {
    value?: RouteInfo & {
      matched?: Array<{
        name?: string
        path?: string
        components?: {
          default?: {
            name?: string
            __name?: string
            __file?: string
          }
        }
      }>
    }
  }
}

/**
 * 从 DOM 元素获取 Vue 组件实例
 * @param element - DOM 元素
 * @returns Vue 组件实例或 null
 */
export function getVueInstance(element: Element): VueComponentInstance | null {
  // Vue 3
  const vue3Instance = (element as any)[VUE_INSTANCE_KEY]
  if (vue3Instance) {
    return vue3Instance
  }

  // 尝试向上查找
  let current: Element | null = element
  while (current) {
    const instance = (current as any)[VUE_INSTANCE_KEY]
    if (instance) {
      return instance
    }
    current = current.parentElement
  }

  return null
}

/**
 * 获取组件名称
 * @param instance - Vue 组件实例
 * @returns 组件名称
 */
export function getComponentName(instance: VueComponentInstance | null): string | undefined {
  if (!instance) return undefined

  // Vue 3 组件名称
  const type = instance.type
  if (type) {
    // 优先使用 __name (setup 语法糖自动生成)
    if (type.__name) return type.__name
    // 其次使用 name 属性
    if (type.name) return type.name
    // 从文件名提取
    if (type.__file) {
      return extractComponentNameFromFile(type.__file)
    }
  }

  // Vue 2 兼容
  if (instance.$options?.name) {
    return instance.$options.name
  }

  return undefined
}

/**
 * 从文件路径提取组件名称
 * @param filePath - 文件路径
 * @returns 组件名称
 */
export function extractComponentNameFromFile(filePath: string): string | undefined {
  if (!filePath) return undefined

  // 提取文件名
  const match = filePath.match(/([^/\\]+)\.vue$/i)
  if (match) {
    return match[1]
  }

  return undefined
}

/**
 * 获取组件文件路径
 * @param instance - Vue 组件实例
 * @returns 文件路径
 */
export function getComponentFile(instance: VueComponentInstance | null): string | undefined {
  if (!instance) return undefined

  // Vue 3
  if (instance.type?.__file) {
    return instance.type.__file
  }

  // Vue 2
  if (instance.$options?.__file) {
    return instance.$options.__file
  }

  return undefined
}

/**
 * 获取组件链路 (从根组件到当前组件)
 * @param instance - Vue 组件实例
 * @param maxDepth - 最大深度
 * @returns 组件名称数组
 */
export function getComponentChain(instance: VueComponentInstance | null, maxDepth = 10): string[] {
  const chain: string[] = []
  let current = instance
  let depth = 0

  while (current && depth < maxDepth) {
    const name = getComponentName(current)
    if (name) {
      chain.unshift(name)
    }
    current = current.parent ?? null
    depth++
  }

  return chain
}

/**
 * 从 DOM 元素获取完整的 Vue 组件信息
 * @param element - DOM 元素
 * @returns 组件信息
 */
export function getVueComponentInfo(element: Element): ComponentInfo | undefined {
  const instance = getVueInstance(element)
  if (!instance) return undefined

  const name = getComponentName(instance)
  const file = getComponentFile(instance)
  const chain = getComponentChain(instance)
  const parentName = instance.parent ? getComponentName(instance.parent) : undefined

  // 提取部分关键 props (排除敏感数据和函数)
  const props = extractSafeProps(instance.props)

  // 如果没有任何有效信息，返回 undefined
  if (!name && !file && chain.length === 0) {
    return undefined
  }

  return {
    name,
    file,
    uid: instance.uid,
    parentName,
    chain: chain.length > 0 ? chain : undefined,
    props: Object.keys(props).length > 0 ? props : undefined,
  }
}

/**
 * 提取安全的 props (排除敏感数据和函数)
 * @param props - 组件 props
 * @returns 安全的 props
 */
function extractSafeProps(props: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!props) return {}

  const safeProps: Record<string, unknown> = {}
  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth', 'credential']
  const allowedTypes = ['string', 'number', 'boolean']

  for (const [key, value] of Object.entries(props)) {
    // 跳过敏感字段
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      continue
    }

    // 跳过函数
    if (typeof value === 'function') {
      continue
    }

    // 只保留基础类型
    if (allowedTypes.includes(typeof value)) {
      // 字符串长度限制
      if (typeof value === 'string' && value.length > 50) {
        safeProps[key] = value.slice(0, 50) + '...'
      } else {
        safeProps[key] = value
      }
    }
  }

  return safeProps
}

/**
 * 获取 Vue Router 实例
 * @returns Vue Router 实例或 null
 */
export function getVueRouter(): VueRouterInstance | null {
  // 尝试从根元素获取 Vue app
  const appRoot = document.querySelector('#app') || document.querySelector('[data-v-app]')
  if (!appRoot) return null

  const app = (appRoot as any)[VUE_APP_KEY]
  if (!app) return null

  // 获取 router 实例
  const router = app._context?.config?.globalProperties?.$router
  return router || null
}

/**
 * 获取当前路由信息
 * @returns 路由信息
 */
export function getCurrentRouteInfo(): RouteInfo | undefined {
  const router = getVueRouter()
  if (!router?.currentRoute?.value) return undefined

  const route = router.currentRoute.value

  // 获取匹配的组件文件
  const matched = route.matched?.map((m: any) => m.name || m.path).filter(Boolean) as string[] | undefined
  const lastMatched = route.matched?.[route.matched.length - 1]
  const componentFile = (lastMatched as any)?.components?.default?.__file

  return {
    path: route.path,
    name: route.name as string | undefined,
    params: route.params as Record<string, string>,
    query: route.query as Record<string, string>,
    hash: route.hash,
    fullPath: route.fullPath,
    meta: route.meta as Record<string, unknown>,
    matched: matched && matched.length > 0 ? matched : undefined,
    componentFile,
  }
}

/**
 * 获取匹配的路由组件详细信息
 * @returns 匹配的组件列表
 */
export function getMatchedComponents(): Array<{ name?: string; file?: string }> | undefined {
  const router = getVueRouter()
  if (!router?.currentRoute?.value?.matched) return undefined

  const components: Array<{ name?: string; file?: string }> = []

  for (const match of router.currentRoute.value.matched) {
    const component = (match as any)?.components?.default
    if (component) {
      components.push({
        name: component.__name || component.name || extractComponentNameFromFile(component.__file),
        file: component.__file,
      })
    }
  }

  return components.length > 0 ? components : undefined
}

/**
 * 获取当前页面的主组件信息 (路由匹配的最后一个组件)
 * @returns 页面组件信息
 */
export function getPageComponent(): { name?: string; file?: string } | undefined {
  const router = getVueRouter()
  if (!router?.currentRoute?.value?.matched) return undefined

  const matched = router.currentRoute.value.matched
  const lastMatched = matched[matched.length - 1]
  const component = (lastMatched as any)?.components?.default

  if (!component) return undefined

  return {
    name: component.__name || component.name || extractComponentNameFromFile(component.__file),
    file: component.__file,
  }
}

/**
 * 获取完整的页面上下文
 * @returns 页面上下文信息
 */
export function getPageContext(): PageContext {
  const routeInfo = getCurrentRouteInfo()
  const pageComponent = getPageComponent()
  const matchedComponents = getMatchedComponents()

  // 解析查询参数
  const query: Record<string, string> = {}
  const searchParams = new URLSearchParams(window.location.search)
  searchParams.forEach((value, key) => {
    query[key] = value
  })

  return {
    url: window.location.href,
    path: window.location.pathname,
    title: document.title,
    routeName: routeInfo?.name,
    componentName: pageComponent?.name,
    componentFile: pageComponent?.file,
    matchedComponents,
    query: Object.keys(query).length > 0 ? query : routeInfo?.query,
    params: routeInfo?.params,
    hash: window.location.hash || routeInfo?.hash || undefined,
    meta: routeInfo?.meta,
    referrer: document.referrer || undefined,
  }
}

/**
 * 获取组件上下文信息
 * @param element - DOM 元素
 * @returns 组件上下文
 */
export function getComponentContext(element: Element): ComponentContext | undefined {
  const instance = getVueInstance(element)
  if (!instance) return undefined

  const name = getComponentName(instance)
  const file = getComponentFile(instance)
  const chain = getComponentChain(instance)
  const parent = instance.parent ? getComponentName(instance.parent) : undefined

  // 查找页面组件 (通常是 route.matched 中的最后一个组件)
  const routeInfo = getCurrentRouteInfo()
  const pageComponent = routeInfo?.matched?.[routeInfo.matched.length - 1]

  if (!name && !file && chain.length === 0) {
    return undefined
  }

  return {
    name,
    file,
    chain: chain.length > 0 ? chain : undefined,
    parent,
    pageComponent,
  }
}

/**
 * 获取元素所属区域信息
 * @param element - DOM 元素
 * @returns 区域信息
 */
export function getRegionInfo(element: Element): RegionInfo | undefined {
  // 语义化标签映射
  const semanticTags: Record<string, string> = {
    header: 'header',
    footer: 'footer',
    nav: 'navigation',
    main: 'main',
    aside: 'sidebar',
    section: 'section',
    article: 'article',
  }

  // 向上查找语义化标签或 data-region 属性
  let current: Element | null = element
  let depth = 0
  const maxDepth = 15

  while (current && depth < maxDepth) {
    // 检查 data-region 属性
    const regionName = current.getAttribute('data-region')
    if (regionName) {
      const componentInfo = getVueComponentInfo(current)
      return {
        name: regionName,
        type: 'custom',
        id: current.id || undefined,
        component: componentInfo?.name,
      }
    }

    // 检查 role 属性
    const role = current.getAttribute('role')
    if (role && ['banner', 'navigation', 'main', 'contentinfo', 'complementary'].includes(role)) {
      const componentInfo = getVueComponentInfo(current)
      return {
        name: role,
        type: role,
        id: current.id || undefined,
        component: componentInfo?.name,
      }
    }

    // 检查语义化标签
    const tagName = current.tagName.toLowerCase()
    if (semanticTags[tagName]) {
      const componentInfo = getVueComponentInfo(current)
      return {
        name: semanticTags[tagName],
        type: tagName,
        id: current.id || undefined,
        component: componentInfo?.name,
      }
    }

    current = current.parentElement
    depth++
  }

  return undefined
}

/**
 * 计算元素的层级深度
 * @param element - DOM 元素
 * @returns 深度
 */
export function getElementDepth(element: Element): number {
  let depth = 0
  let current: Element | null = element

  while (current && current !== document.body) {
    depth++
    current = current.parentElement
  }

  return depth
}

/**
 * 检测元素的交互类型
 * @param element - DOM 元素
 * @returns 交互类型
 */
export function getInteractionType(element: Element): string {
  const tagName = element.tagName.toLowerCase()

  // 按标签名判断
  switch (tagName) {
    case 'a':
      return 'link'
    case 'button':
      return 'button'
    case 'input': {
      const type = (element as HTMLInputElement).type
      if (type === 'submit' || type === 'button') return 'button'
      if (type === 'checkbox') return 'checkbox'
      if (type === 'radio') return 'radio'
      return 'input'
    }
    case 'select':
      return 'select'
    case 'textarea':
      return 'textarea'
    case 'img':
      return 'image'
    case 'video':
      return 'video'
    case 'audio':
      return 'audio'
  }

  // 检查 role 属性
  const role = element.getAttribute('role')
  if (role) {
    if (['button', 'link', 'checkbox', 'radio', 'tab', 'menuitem'].includes(role)) {
      return role
    }
  }

  // 检查是否有点击相关的类名或属性
  if (element.hasAttribute('onclick') || element.hasAttribute('@click') || element.hasAttribute('v-on:click')) {
    return 'clickable'
  }

  // 检查常见的可交互类名
  const className = typeof element.className === 'string' ? element.className : ''
  if (/\b(btn|button|link|clickable)\b/i.test(className)) {
    return 'button'
  }

  return 'element'
}
