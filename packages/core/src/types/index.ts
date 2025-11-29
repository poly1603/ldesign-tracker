/**
 * 用户行为追踪类型定义
 * @packageDocumentation
 */

/**
 * 追踪事件类型
 */
export enum TrackEventType {
  /** 页面浏览 */
  PAGE_VIEW = 'page_view',
  /** 点击事件 */
  CLICK = 'click',
  /** 滚动事件 */
  SCROLL = 'scroll',
  /** 输入事件 */
  INPUT = 'input',
  /** 表单提交 */
  FORM_SUBMIT = 'form_submit',
  /** 导航事件 */
  NAVIGATION = 'navigation',
  /** 自定义事件 */
  CUSTOM = 'custom',
  /** 曝光事件 */
  EXPOSURE = 'exposure',
  /** 错误事件 */
  ERROR = 'error',
}

/**
 * 追踪事件
 */
export interface TrackEvent {
  /** 事件 ID */
  id: string
  /** 事件类型 */
  type: TrackEventType
  /** 事件名称 */
  name: string
  /** 时间戳 */
  timestamp: number
  /** 页面 URL */
  url: string
  /** 页面标题 */
  pageTitle?: string
  /** 事件数据 */
  data?: Record<string, unknown>
  /** 目标元素信息 */
  target?: ElementInfo
  /** 用户 ID */
  userId?: string
  /** 会话 ID */
  sessionId: string
  /** 设备信息 */
  device?: DeviceInfo
}

/**
 * 元素信息
 */
export interface ElementInfo {
  /** 标签名 */
  tagName: string
  /** 元素 ID */
  id?: string
  /** 类名 */
  className?: string
  /** 文本内容 */
  text?: string
  /** XPath */
  xpath?: string
  /** 元素位置 */
  position?: { x: number, y: number }
  /** 自定义属性 */
  attributes?: Record<string, string>
}

/**
 * 设备信息
 */
export interface DeviceInfo {
  /** 用户代理 */
  userAgent: string
  /** 屏幕宽度 */
  screenWidth: number
  /** 屏幕高度 */
  screenHeight: number
  /** 视口宽度 */
  viewportWidth: number
  /** 视口高度 */
  viewportHeight: number
  /** 语言 */
  language: string
  /** 平台 */
  platform: string
  /** 是否触摸设备 */
  isTouchDevice: boolean
}

/**
 * 追踪器配置
 */
export interface TrackerOptions {
  /** 是否启用 */
  enabled?: boolean
  /** 应用名称 */
  appName?: string
  /** 用户 ID */
  userId?: string
  /** 采样率（0-1） */
  sampleRate?: number
  /** 最大事件缓存数量 */
  maxEvents?: number
  /** 批量发送间隔（毫秒） */
  batchInterval?: number
  /** 批量大小 */
  batchSize?: number
  /** 上报地址 */
  endpoint?: string
  /** 是否自动收集页面浏览 */
  autoPageView?: boolean
  /** 是否自动收集点击 */
  autoClick?: boolean
  /** 是否自动收集滚动 */
  autoScroll?: boolean
  /** 是否自动收集输入 */
  autoInput?: boolean
  /** 敏感字段（需脱敏） */
  sensitiveFields?: string[]
  /** 忽略的元素选择器 */
  ignoreSelectors?: string[]
  /** 事件过滤器 */
  beforeTrack?: (event: TrackEvent) => TrackEvent | null
  /** 事件回调 */
  onTrack?: (event: TrackEvent) => void
}

/**
 * 收集器接口
 */
export interface Collector {
  /** 收集器名称 */
  name: string
  /** 安装收集器 */
  install(): void
  /** 卸载收集器 */
  uninstall(): void
}

/**
 * 页面浏览数据
 */
export interface PageViewData {
  /** 来源页面 */
  referrer?: string
  /** 页面路径 */
  path: string
  /** 查询参数 */
  query?: Record<string, string>
  /** 页面加载时间 */
  loadTime?: number
}

/**
 * 点击数据
 */
export interface ClickData {
  /** 点击坐标 X */
  x: number
  /** 点击坐标 Y */
  y: number
  /** 按钮类型 */
  button: number
}

/**
 * 滚动数据
 */
export interface ScrollData {
  /** 滚动位置 X */
  scrollX: number
  /** 滚动位置 Y */
  scrollY: number
  /** 滚动方向 */
  direction: 'up' | 'down' | 'left' | 'right'
  /** 滚动深度百分比 */
  scrollDepth: number
}

/**
 * 输入数据（已脱敏）
 */
export interface InputData {
  /** 输入类型 */
  inputType: string
  /** 字段名 */
  fieldName?: string
  /** 值长度 */
  valueLength: number
  /** 是否为空 */
  isEmpty: boolean
}

