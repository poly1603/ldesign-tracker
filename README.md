# @ldesign/tracker

轻量级、高性能的用户行为追踪 SDK，支持自动收集页面浏览、点击、滚动、输入、错误、性能指标和元素曝光等事件。

## 特性

- 🚀 **高性能** - 事件批量上报、节流防抖、智能采样
- 📦 **开箱即用** - 自动收集常见用户行为
- 📊 **Web Vitals** - 自动收集 FCP, LCP, FID, CLS, INP 等核心指标
- 🔍 **曝光追踪** - 基于 IntersectionObserver 的元素曝光检测
- 🛡️ **错误监控** - 自动捕获 JS 错误、Promise 拒绝、资源加载错误
- 📱 **离线支持** - 离线事件缓存，网络恢复后自动上报
- 🔄 **重试机制** - 指数退避重试，确保数据可靠上报
- 🎯 **Vue 集成** - 提供 Vue 3 Composables 和指令
- 📝 **TypeScript** - 完整的类型定义

## 安装

```bash
# 安装核心库
pnpm add @ldesign/tracker-core

# 安装 Vue 集成
pnpm add @ldesign/tracker-vue
```

## 快速开始

### 基础使用

```typescript
import { createTracker } from '@ldesign/tracker-core'

// 创建追踪器实例
const tracker = createTracker({
  appName: 'MyApp',
  endpoint: '/api/track',
  // 自动收集配置
  autoPageView: true,
  autoClick: true,
  autoScroll: true,
  autoError: true,
  autoPerformance: true,
})

// 初始化
tracker.install()

// 手动追踪事件
tracker.track('button_click', {
  buttonId: 'submit',
  buttonText: '提交',
})

// 设置用户 ID
tracker.setUserId('user_123')

// 设置全局属性
tracker.setGlobalProperties({
  platform: 'web',
  version: '1.0.0',
})
```

### Vue 3 集成

```vue
<!-- App.vue -->
<script setup>
import { provideTracker } from '@ldesign/tracker-vue'

// 在根组件提供 Tracker
provideTracker({
  appName: 'MyVueApp',
  endpoint: '/api/track',
})
</script>
```

```vue
<!-- Button.vue -->
<script setup>
import { useTracker } from '@ldesign/tracker-vue'

const { track, isReady } = useTracker()

function handleClick() {
  track('button_click', { action: 'submit' })
}
</script>

<template>
  <button @click="handleClick">提交</button>
</template>
```

### 曝光追踪

```vue
<script setup>
import { ref } from 'vue'
import { useExposure } from '@ldesign/tracker-vue'

const cardRef = ref(null)
const { isExposed, exposureCount } = useExposure(cardRef, 'product-card', {
  threshold: 0.5,      // 可见 50% 触发
  minDuration: 1000,   // 最少曝光 1 秒
  once: true,          // 只触发一次
  onExposure: (data) => {
    console.log('卡片曝光:', data)
  }
})
</script>

<template>
  <div ref="cardRef" class="product-card">
    商品卡片
  </div>
</template>
```

### 使用指令

```vue
<template>
  <!-- 点击追踪 -->
  <button v-track="{ event: 'click', data: { action: 'buy' } }">
    购买
  </button>

  <!-- 曝光追踪 -->
  <div v-track="{ trigger: 'exposure', data: { productId: '123' } }">
    商品详情
  </div>
</template>
```

## API 参考

### TrackerOptions

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | `boolean` | `true` | 是否启用追踪 |
| `appName` | `string` | `'LDesignApp'` | 应用名称 |
| `appVersion` | `string` | `'1.0.0'` | 应用版本 |
| `endpoint` | `string` | `''` | 数据上报地址 |
| `userId` | `string` | `''` | 用户 ID |
| `sessionId` | `string` | 自动生成 | 会话 ID |
| `sampleRate` | `number` | `1` | 采样率 (0-1) |
| `batchSize` | `number` | `10` | 批量上报数量 |
| `batchInterval` | `number` | `5000` | 批量上报间隔 (ms) |
| `maxEvents` | `number` | `100` | 最大缓存事件数 |
| `autoPageView` | `boolean` | `true` | 自动收集页面浏览 |
| `autoClick` | `boolean` | `true` | 自动收集点击 |
| `autoScroll` | `boolean` | `true` | 自动收集滚动 |
| `autoInput` | `boolean` | `false` | 自动收集输入 |
| `autoError` | `boolean` | `true` | 自动收集错误 |
| `autoPerformance` | `boolean` | `true` | 自动收集性能 |
| `debug` | `boolean` | `false` | 调试模式 |

### 重试配置

```typescript
{
  retry: {
    maxRetries: 3,           // 最大重试次数
    baseDelay: 1000,         // 基础延迟 (ms)
    maxDelay: 30000,         // 最大延迟 (ms)
    useExponentialBackoff: true  // 使用指数退避
  }
}
```

### 离线存储配置

```typescript
{
  offline: {
    enabled: true,           // 启用离线存储
    storage: 'localStorage', // 存储方式
    maxEvents: 500,          // 最大存储数量
    expireTime: 86400000     // 过期时间 (24h)
  }
}
```

### Tracker 方法

| 方法 | 说明 |
|------|------|
| `install()` | 初始化追踪器 |
| `uninstall()` | 卸载追踪器 |
| `track(name, data?, options?)` | 追踪自定义事件 |
| `trackPageView(data?)` | 追踪页面浏览 |
| `trackPageLeave()` | 追踪页面离开 |
| `setUserId(userId)` | 设置用户 ID |
| `setGlobalProperties(props)` | 设置全局属性 |
| `flush()` | 立即上报缓存事件 |
| `getSessionId()` | 获取会话 ID |
| `getPageId()` | 获取页面 ID |

## 事件类型

| 类型 | 说明 | 收集器 |
|------|------|--------|
| `page_view` | 页面浏览 | NavigationCollector |
| `page_leave` | 页面离开 | NavigationCollector |
| `click` | 点击事件 | ClickCollector |
| `scroll` | 滚动事件 | ScrollCollector |
| `input` | 输入事件 | InputCollector |
| `error` | 错误事件 | ErrorCollector |
| `performance` | 性能事件 | PerformanceCollector |
| `exposure` | 曝光事件 | ExposureCollector |
| `custom` | 自定义事件 | - |

## 性能指标

PerformanceCollector 自动收集以下 Web Vitals 指标：

- **FCP** (First Contentful Paint) - 首次内容绘制
- **LCP** (Largest Contentful Paint) - 最大内容绘制
- **FID** (First Input Delay) - 首次输入延迟
- **CLS** (Cumulative Layout Shift) - 累计布局偏移
- **INP** (Interaction to Next Paint) - 交互响应时间
- **TTFB** (Time to First Byte) - 首字节时间

## 错误监控

ErrorCollector 自动捕获：

- JavaScript 运行时错误
- 未处理的 Promise 拒绝
- 资源加载错误（图片、脚本等）

```typescript
// 手动上报错误
const errorCollector = tracker.getCollector('error')
errorCollector?.captureException(new Error('自定义错误'), {
  level: 'error',
  componentName: 'MyComponent',
})
```

## 数据结构

### TrackEvent

```typescript
interface TrackEvent {
  id: string              // 事件 ID
  type: string            // 事件类型
  name: string            // 事件名称
  timestamp: number       // 时间戳
  url: string             // 页面 URL
  pageTitle: string       // 页面标题
  sessionId: string       // 会话 ID
  pageId: string          // 页面 ID
  userId?: string         // 用户 ID
  device?: DeviceInfo     // 设备信息
  data?: object           // 事件数据
  target?: ElementInfo    // 目标元素
  properties?: object     // 全局属性
}
```

## 回调函数

```typescript
const tracker = createTracker({
  // 事件过滤器 - 返回 null 可过滤事件
  beforeTrack: (event) => {
    if (event.name === 'ignore_event') {
      return null
    }
    return event
  },
  
  // 事件转换器
  transformEvent: (event) => {
    return {
      ...event,
      data: {
        ...event.data,
        customField: 'value',
      },
    }
  },
  
  // 事件跟踪回调
  onTrack: (event) => {
    console.log('Event tracked:', event)
  },
  
  // 上报成功回调
  onSuccess: (events) => {
    console.log('Events sent:', events.length)
  },
  
  // 上报失败回调
  onError: (error, events) => {
    console.error('Failed to send events:', error)
  },
})
```

## Vue Composables

### useTracker

```typescript
const {
  events,           // Ref<TrackEvent[]> - 事件列表
  tracker,          // Tracker - Tracker 实例
  isReady,          // Ref<boolean> - 是否已初始化
  sessionId,        // Ref<string> - 会话 ID
  pageId,           // Ref<string> - 页面 ID
  track,            // 追踪事件
  trackPageView,    // 追踪页面浏览
  setUserId,        // 设置用户 ID
  setGlobalProperties, // 设置全局属性
  flush,            // 立即上报
  clearEvents,      // 清空事件列表
} = useTracker(options?)
```

### useExposure

```typescript
const {
  isExposed,        // Ref<boolean> - 是否已曝光
  exposureCount,    // Ref<number> - 曝光次数
  exposureDuration, // Ref<number> - 曝光时长
  observe,          // 开始观察
  unobserve,        // 停止观察
  trackExposure,    // 手动触发曝光
} = useExposure(elementRef, exposureId, options?)
```

## 最佳实践

### 1. 合理配置采样率

```typescript
const tracker = createTracker({
  sampling: {
    enabled: true,
    rate: 0.1,  // 10% 采样
    rateByType: {
      error: 1,       // 错误 100% 采样
      performance: 1,  // 性能 100% 采样
      scroll: 0.05,    // 滚动 5% 采样
    },
  },
})
```

### 2. 敏感数据处理

```typescript
const tracker = createTracker({
  // 敏感字段自动脱敏
  sensitiveFields: ['password', 'token', 'credit_card'],
  
  // 忽略特定元素
  ignoreSelectors: ['.password-input', '[data-sensitive]'],
})
```

### 3. SPA 页面追踪

```typescript
// 在路由切换时手动追踪
router.afterEach((to) => {
  tracker.trackPageView({
    route: to.path,
    routeName: to.name,
  })
})
```

## 包结构

```
@ldesign/tracker
├── packages/core          # 核心库
│   ├── types/            # 类型定义
│   ├── utils/            # 工具函数
│   ├── collectors/       # 收集器
│   └── tracker/          # 核心 Tracker
└── packages/vue           # Vue 集成
    ├── composables/      # Composables
    ├── directives/       # 指令
    └── plugin/           # Vue 插件
```

## License

MIT
