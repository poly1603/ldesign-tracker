/**
 * 用户行为追踪类型定义
 * @packageDocumentation
 * @module @ldesign/tracker-core
 */

// ============================================================================
// 常量定义
// ============================================================================

/**
 * 追踪事件类型
 * @description 定义所有支持的事件类型
 */
export enum TrackEventType {
  /** 页面浏览 */
  PAGE_VIEW = 'page_view',
  /** 页面离开 */
  PAGE_LEAVE = 'page_leave',
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
  /** 性能事件 */
  PERFORMANCE = 'performance',
  /** 网络请求 */
  NETWORK = 'network',
}

/**
 * 事件优先级
 * @description 用于控制事件上报顺序
 */
export enum EventPriority {
  /** 低优先级 - 可延迟上报 */
  LOW = 0,
  /** 普通优先级 - 正常上报 */
  NORMAL = 1,
  /** 高优先级 - 优先上报 */
  HIGH = 2,
  /** 紧急 - 立即上报 */
  IMMEDIATE = 3,
}

/**
 * 收集器状态
 */
export enum CollectorStatus {
  /** 空闲 */
  IDLE = 'idle',
  /** 运行中 */
  RUNNING = 'running',
  /** 已暂停 */
  PAUSED = 'paused',
  /** 已停止 */
  STOPPED = 'stopped',
}

/**
 * 上报方式
 */
export enum ReportMethod {
  /** Navigator.sendBeacon */
  BEACON = 'beacon',
  /** Fetch API */
  FETCH = 'fetch',
  /** XMLHttpRequest */
  XHR = 'xhr',
  /** Image 像素点 */
  IMAGE = 'image',
}

/**
 * 存储方式
 */
export enum StorageType {
  /** 内存存储 */
  MEMORY = 'memory',
  /** LocalStorage */
  LOCAL_STORAGE = 'localStorage',
  /** IndexedDB */
  INDEXED_DB = 'indexedDB',
}

// ============================================================================
// 基础类型
// ============================================================================

/**
 * 追踪事件
 * @template T 事件数据类型
 */
export interface TrackEvent<T = unknown> {
  /** 事件唯一 ID */
  id: string
  /** 事件类型 */
  type: TrackEventType | string
  /** 事件名称 */
  name: string
  /** 时间戳 (ms) */
  timestamp: number
  /** 页面 URL */
  url: string
  /** 页面标题 */
  pageTitle?: string
  /** 事件数据 */
  data?: T
  /** 目标元素信息 */
  target?: ElementInfo
  /** 用户 ID */
  userId?: string
  /** 会话 ID */
  sessionId: string
  /** 页面 ID */
  pageId?: string
  /** 设备信息 */
  device?: DeviceInfo
  /** 事件优先级 */
  priority?: EventPriority
  /** 重试次数 */
  retryCount?: number
  /** 全局属性 */
  properties?: Record<string, unknown>
  /** 路由信息 */
  route?: RouteInfo
  /** 组件上下文 */
  componentContext?: ComponentContext
  /** 页面上下文 */
  page?: PageContext
}

/**
 * 页面上下文
 * @description 记录当前页面的详细信息
 */
export interface PageContext {
  /** 页面 URL */
  url: string
  /** 页面路径 */
  path: string
  /** 页面标题 */
  title: string
  /** 路由名称 (Vue Router) */
  routeName?: string
  /** 页面组件名称 */
  componentName?: string
  /** 页面组件 Vue 文件路径 */
  componentFile?: string
  /** 匹配的路由组件链 */
  matchedComponents?: Array<{
    name?: string
    file?: string
  }>
  /** 查询参数 */
  query?: Record<string, string>
  /** 路由参数 */
  params?: Record<string, string>
  /** hash */
  hash?: string
  /** 路由元信息 */
  meta?: Record<string, unknown>
  /** 来源页面 */
  referrer?: string
}

/**
 * 路由信息
 * @description 记录当前页面的路由信息
 */
export interface RouteInfo {
  /** 路由路径 */
  path: string
  /** 路由名称 */
  name?: string
  /** 路由参数 */
  params?: Record<string, string>
  /** 查询参数 */
  query?: Record<string, string>
  /** hash */
  hash?: string
  /** 完整路径 */
  fullPath?: string
  /** 路由元信息 */
  meta?: Record<string, unknown>
  /** 匹配的路由组件 */
  matched?: string[]
  /** 路由对应的 Vue 文件 */
  componentFile?: string
}

/**
 * 组件上下文
 * @description 记录事件发生时的组件上下文
 */
export interface ComponentContext {
  /** 当前组件名称 */
  name?: string
  /** 组件文件路径 */
  file?: string
  /** 组件链路 (从根组件到当前组件) */
  chain?: string[]
  /** 父组件名称 */
  parent?: string
  /** 所属页面组件 */
  pageComponent?: string
  /** 所属页面组件文件 */
  pageComponentFile?: string
}

// ============================================================================
// 元素与设备信息
// ============================================================================

/**
 * 元素信息
 * @description 记录 DOM 元素的详细信息
 */
export interface ElementInfo {
  /** 标签名 */
  tagName: string
  /** 元素 ID */
  id?: string
  /** 类名 */
  className?: string
  /** 文本内容(截断) */
  text?: string
  /** XPath 路径 */
  xpath?: string
  /** CSS 选择器路径 */
  cssPath?: string
  /** 元素位置 */
  position?: { x: number; y: number }
  /** 元素尺寸 */
  rect?: { width: number; height: number; top: number; left: number }
  /** 自定义属性 */
  attributes?: Record<string, string>
  /** data-track-* 属性 */
  trackData?: Record<string, string>
  /** 父元素信息 */
  parent?: Pick<ElementInfo, 'tagName' | 'id' | 'className'>
  /** Vue 组件信息 */
  component?: ComponentInfo
  /** 链接信息 (a 标签) */
  link?: LinkInfo
  /** 表单元素信息 */
  form?: FormElementInfo
  /** 交互角色 (button, link, input 等) */
  role?: string
  /** aria 标签 */
  ariaLabel?: string
  /** 元素层级深度 */
  depth?: number
  /** 所属区域/容器信息 */
  region?: RegionInfo
}

/**
 * Vue 组件信息
 * @description 记录 Vue 组件的详细信息
 */
export interface ComponentInfo {
  /** 组件名称 */
  name?: string
  /** 组件文件路径 (开发环境) */
  file?: string
  /** 组件 UID */
  uid?: number
  /** 父组件名称 */
  parentName?: string
  /** 组件链路 (从根组件到当前组件的路径) */
  chain?: string[]
  /** 组件 props (部分关键 props) */
  props?: Record<string, unknown>
}

/**
 * 链接信息
 */
export interface LinkInfo {
  /** 链接地址 */
  href?: string
  /** 链接目标 */
  target?: string
  /** 是否外部链接 */
  isExternal?: boolean
  /** 链接类型 (anchor, download, mailto, tel 等) */
  type?: string
}

/**
 * 表单元素信息
 */
export interface FormElementInfo {
  /** 表单名称 */
  formName?: string
  /** 表单 ID */
  formId?: string
  /** 表单 action */
  formAction?: string
  /** 字段名 */
  fieldName?: string
  /** 字段类型 */
  fieldType?: string
  /** placeholder */
  placeholder?: string
  /** 是否必填 */
  required?: boolean
  /** 是否禁用 */
  disabled?: boolean
}

/**
 * 区域/容器信息
 */
export interface RegionInfo {
  /** 区域名称 (data-region 或语义化标签) */
  name?: string
  /** 区域类型 (header, footer, sidebar, main, nav, section 等) */
  type?: string
  /** 区域 ID */
  id?: string
  /** 区域对应的组件名 */
  component?: string
}

/**
 * 设备信息
 * @description 记录用户设备的详细信息
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
  /** 设备像素比 */
  devicePixelRatio?: number
  /** 语言 */
  language: string
  /** 时区 */
  timezone?: string
  /** 平台 */
  platform: string
  /** 是否触摸设备 */
  isTouchDevice: boolean
  /** 是否移动设备 */
  isMobile?: boolean
  /** 网络类型 */
  connectionType?: string
  /** 内存大小(GB) */
  deviceMemory?: number
  /** CPU 核心数 */
  hardwareConcurrency?: number
}

// ============================================================================
// 配置接口
// ============================================================================

/**
 * 重试策略配置
 */
export interface RetryOptions {
  /** 最大重试次数 */
  maxRetries?: number
  /** 基础延迟时间(ms) */
  baseDelay?: number
  /** 最大延迟时间(ms) */
  maxDelay?: number
  /** 是否使用指数退避 */
  useExponentialBackoff?: boolean
}

/**
 * 离线存储配置
 */
export interface OfflineOptions {
  /** 是否启用离线存储 */
  enabled?: boolean
  /** 存储方式 */
  storage?: StorageType
  /** 最大存储事件数 */
  maxEvents?: number
  /** 事件过期时间(ms) */
  expireTime?: number
}

/**
 * 采样配置
 */
export interface SamplingOptions {
  /** 是否启用采样 */
  enabled?: boolean
  /** 采样率(0-1) */
  rate?: number
  /** 按事件类型的采样率 */
  rateByType?: Partial<Record<TrackEventType, number>>
}

/**
 * 追踪器配置
 * @description Tracker 实例的完整配置
 */
export interface TrackerOptions {
  /** 是否启用 */
  enabled?: boolean
  /** 应用名称 */
  appName?: string
  /** 应用版本 */
  appVersion?: string
  /** 用户 ID */
  userId?: string
  /** 会话 ID */
  sessionId?: string
  /** 采样率（0-1）- 简化配置 */
  sampleRate?: number
  /** 采样配置 - 高级配置 */
  sampling?: SamplingOptions
  /** 最大事件缓存数量 */
  maxEvents?: number
  /** 批量发送间隔（毫秒） */
  batchInterval?: number
  /** 批量大小 */
  batchSize?: number
  /** 上报地址 */
  endpoint?: string
  /** 上报方式 */
  reportMethod?: ReportMethod
  /** 自定义请求头 */
  headers?: Record<string, string>
  /** 是否自动收集页面浏览 */
  autoPageView?: boolean
  /** 是否自动收集点击 */
  autoClick?: boolean
  /** 是否自动收集滚动 */
  autoScroll?: boolean
  /** 是否自动收集输入 */
  autoInput?: boolean
  /** 是否自动收集错误 */
  autoError?: boolean
  /** 是否自动收集性能 */
  autoPerformance?: boolean
  /** 敏感字段（需脱敏） */
  sensitiveFields?: string[]
  /** 忽略的元素选择器 */
  ignoreSelectors?: string[]
  /** 重试配置 */
  retry?: RetryOptions
  /** 离线存储配置 */
  offline?: OfflineOptions
  /** 全局属性 */
  globalProperties?: Record<string, unknown>
  /** 是否开启调试模式 */
  debug?: boolean
  /** 事件过滤器 */
  beforeTrack?: (event: TrackEvent) => TrackEvent | null
  /** 事件转换器 */
  transformEvent?: (event: TrackEvent) => TrackEvent
  /** 事件回调 */
  onTrack?: (event: TrackEvent) => void
  /** 上报成功回调 */
  onSuccess?: (events: TrackEvent[]) => void
  /** 上报失败回调 */
  onError?: (error: Error, events: TrackEvent[]) => void
}

// ============================================================================
// 收集器接口
// ============================================================================

/**
 * 收集器基础配置
 */
export interface BaseCollectorOptions {
  /** 是否自动启动 */
  autoStart?: boolean
  /** 调试模式 */
  debug?: boolean
}

/**
 * 收集器接口
 * @description 所有收集器必须实现的接口
 */
export interface Collector {
  /** 收集器唯一名称 */
  readonly name: string
  /** 安装收集器 */
  install(): void
  /** 卸载收集器 */
  uninstall(): void
  /** 暂停收集 */
  pause?(): void
  /** 恢复收集 */
  resume?(): void
  /** 设置事件回调 */
  setEventCallback?(callback: (event: Partial<TrackEvent>) => void): void
}

// 注意：具体收集器的配置接口定义在各收集器文件中
// ClickCollectorOptions, ScrollCollectorOptions, InputCollectorOptions, NavigationCollectorOptions
// 分别在 click-collector.ts, scroll-collector.ts, input-collector.ts, navigation-collector.ts 中定义

/**
 * 错误收集器配置
 */
export interface ErrorCollectorOptions extends BaseCollectorOptions {
  /** 是否捕获 JS 错误 */
  captureJsErrors?: boolean
  /** 是否捕获 Promise 拒绝 */
  capturePromiseRejections?: boolean
  /** 是否捕获资源加载错误 */
  captureResourceErrors?: boolean
  /** 错误采样率 */
  sampleRate?: number
  /** 忽略的错误消息模式 */
  ignorePatterns?: (string | RegExp)[]
}

/**
 * 性能收集器配置
 */
export interface PerformanceCollectorOptions extends BaseCollectorOptions {
  /** 是否收集 Web Vitals */
  collectWebVitals?: boolean
  /** 是否收集资源时序 */
  collectResourceTiming?: boolean
  /** 资源时序最大数量 */
  maxResourceEntries?: number
  /** 是否收集长任务 */
  collectLongTasks?: boolean
  /** 长任务阈值(ms) */
  longTaskThreshold?: number
}

/**
 * 曝光收集器配置
 */
export interface ExposureCollectorOptions extends BaseCollectorOptions {
  /** 曝光阈值(0-1) */
  threshold?: number | number[]
  /** 最小曝光时间(ms) */
  minDuration?: number
  /** 是否只触发一次 */
  triggerOnce?: boolean
  /** 监听的元素选择器 */
  selectors?: string[]
  /** 监听的 data 属性名 */
  dataAttribute?: string
}

// ============================================================================
// 事件数据接口
// ============================================================================

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
  /** URL hash */
  hash?: string
  /** 页面加载时间(ms) */
  loadTime?: number
}

/**
 * 页面离开数据
 */
export interface PageLeaveData {
  /** 页面 URL */
  url: string
  /** 页面停留时间(ms) */
  duration: number
  /** 最大滚动深度(%) */
  maxScrollDepth?: number
  /** 点击次数 */
  clickCount?: number
}

/**
 * 点击数据
 */
export interface ClickData {
  /** 点击坐标 X (相对视口) */
  x: number
  /** 点击坐标 Y (相对视口) */
  y: number
  /** 点击坐标 X (相对页面) */
  pageX?: number
  /** 点击坐标 Y (相对页面) */
  pageY?: number
  /** 点击坐标 X (相对元素) */
  offsetX?: number
  /** 点击坐标 Y (相对元素) */
  offsetY?: number
  /** 按钮类型: 0-主键 1-中键 2-右键 */
  button: number
  /** 按钮类型名称 */
  buttonName?: 'left' | 'middle' | 'right'
  /** 页面宽度 */
  pageWidth?: number
  /** 页面高度 */
  pageHeight?: number
  /** 视口宽度 */
  viewportWidth?: number
  /** 视口高度 */
  viewportHeight?: number
  /** 点击类型 */
  clickType?: 'single' | 'double' | 'context'
  /** 交互类型 (button, link, input, select 等) */
  interactionType?: string
  /** 按钮/链接文本 */
  actionText?: string
  /** 是否有修饰键 */
  modifiers?: {
    ctrl?: boolean
    alt?: boolean
    shift?: boolean
    meta?: boolean
  }
  /** 距离上次点击的时间间隔 (ms) */
  timeSinceLastClick?: number
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
  /** 页面总高度 */
  pageHeight?: number
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
  /** 是否敏感字段 */
  isSensitive?: boolean
}

/**
 * 错误数据
 */
export interface ErrorData {
  /** 错误类型 */
  errorType: 'js' | 'promise' | 'resource' | 'network' | 'custom'
  /** 错误消息 */
  message: string
  /** 错误堆栈 */
  stack?: string
  /** 发生错误的文件 */
  filename?: string
  /** 行号 */
  lineno?: number
  /** 列号 */
  colno?: number
  /** 错误级别 */
  level?: 'error' | 'warn' | 'info'
  /** 错误来源 */
  source?: string
  /** 组件名(Vue/React) */
  componentName?: string
}

/**
 * 性能数据
 */
export interface PerformanceData {
  /** First Contentful Paint (ms) */
  fcp?: number
  /** Largest Contentful Paint (ms) */
  lcp?: number
  /** First Input Delay (ms) */
  fid?: number
  /** Cumulative Layout Shift */
  cls?: number
  /** Time to First Byte (ms) */
  ttfb?: number
  /** Interaction to Next Paint (ms) */
  inp?: number
  /** DOM 加载时间 (ms) */
  domLoad?: number
  /** 页面完全加载时间 (ms) */
  pageLoad?: number
  /** DNS 查询时间 (ms) */
  dnsTime?: number
  /** TCP 连接时间 (ms) */
  tcpTime?: number
  /** 资源性能数据 */
  resources?: ResourceTiming[]
}

/**
 * 资源加载时间数据
 */
export interface ResourceTiming {
  /** 资源名称 */
  name: string
  /** 资源类型 */
  type: string
  /** 加载时间 (ms) */
  duration: number
  /** 传输大小 (bytes) */
  transferSize?: number
  /** 开始时间 (ms) */
  startTime?: number
}

/**
 * 曝光数据
 */
export interface ExposureData {
  /** 曝光的元素信息 */
  element: ElementInfo
  /** 曝光比例(0-1) */
  intersectionRatio: number
  /** 曝光时长(ms) */
  duration?: number
  /** 是否首次曝光 */
  isFirstExposure?: boolean
  /** 曝光标识(用于去重) */
  exposureId?: string
}

/**
 * 自定义事件数据
 */
export interface CustomEventData {
  /** 自定义事件名称 */
  eventName: string
  /** 自定义事件分类 */
  category?: string
  /** 自定义事件标签 */
  label?: string
  /** 自定义事件值 */
  value?: number
  /** 额外数据 */
  extra?: Record<string, unknown>
}

// ============================================================================
// 工具类型
// ============================================================================

/**
 * 日志级别
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent'

/**
 * 日志器接口
 */
export interface Logger {
  debug: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
  setLevel: (level: LogLevel) => void
}

/**
 * 存储接口
 */
export interface TrackerStorage {
  get: <T>(key: string) => Promise<T | null>
  set: <T>(key: string, value: T) => Promise<void>
  remove: (key: string) => Promise<void>
  clear: () => Promise<void>
  keys: () => Promise<string[]>
}

/**
 * 上报结果
 */
export interface ReportResult {
  /** 是否成功 */
  success: boolean
  /** 错误信息 */
  error?: string
  /** 重试次数 */
  retryCount?: number
  /** 上报时间 */
  sentAt?: number
}

/**
 * 节流函数类型
 */
export interface ThrottledFunction<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): ReturnType<T> | undefined
  cancel: () => void
}

/**
 * 防抖函数类型
 */
export interface DebouncedFunction<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): void
  cancel: () => void
  flush: () => void
}

// ============================================================================
// Vue 集成类型
// ============================================================================

/**
 * Vue 指令绑定值
 */
export interface TrackDirectiveValue {
  /** 事件类型 */
  type?: TrackEventType | string
  /** 事件名称 */
  event?: string
  /** 自定义数据 */
  data?: Record<string, unknown>
  /** 触发事件 */
  trigger?: 'click' | 'exposure' | 'hover'
  /** 曝光配置 */
  exposure?: {
    threshold?: number
    once?: boolean
  }
}

/**
 * Vue 插件配置
 */
export interface TrackerPluginOptions extends TrackerOptions {
  /** 是否注册全局属性 $tracker */
  globalProperty?: boolean
  /** 是否注册全局指令 v-track */
  directive?: boolean
  /** 默认启用的收集器 */
  collectors?: string[]
}

