# @ldesign/builder 日志规范

本文档定义了项目中日志记录的最佳实践和规范。

## 核心原则

1. **统一使用 Logger 类** - 禁止直接使用 `console.log/warn/error`
2. **适当的日志级别** - 根据信息重要性选择正确的级别
3. **有意义的日志消息** - 清晰、简洁、包含上下文
4. **结构化输出** - 使用统一的格式和前缀

## 日志级别使用指南

### `logger.error()` - 错误级别
用于记录导致功能失败的严重问题。

```typescript
logger.error('配置文件解析失败', { file: configPath, error: err.message })
```

### `logger.warn()` - 警告级别
用于记录可能导致问题但不影响程序继续运行的情况。

```typescript
logger.warn('未找到可选配置文件，使用默认配置')
```

### `logger.info()` - 信息级别
用于记录重要的运行时信息，如构建开始/结束。

```typescript
logger.info('开始构建项目...')
logger.info(`构建完成，耗时 ${duration}ms`)
```

### `logger.debug()` - 调试级别
用于记录开发调试信息，生产环境默认不输出。

```typescript
logger.debug('解析入口文件:', entries)
logger.debug('应用插件配置:', pluginConfig)
```

### `logger.success()` - 成功级别
用于标记操作成功完成。

```typescript
logger.success('所有文件编译成功')
```

## 使用示例

### 基础用法

```typescript
import { createLogger, Logger } from '@ldesign/builder/utils/logger'

// 创建日志器
const logger = createLogger({
  prefix: 'ModuleName',  // 模块名称前缀
  level: 'info'          // 日志级别
})

// 基础日志
logger.info('操作开始')
logger.debug('详细信息', { key: 'value' })
logger.success('操作完成')
```

### 在类中使用

```typescript
export class MyModule {
  private logger: Logger

  constructor(logger?: Logger) {
    this.logger = logger || createLogger({ prefix: 'MyModule' })
  }

  async process(): Promise<void> {
    this.logger.info('开始处理...')
    try {
      // 处理逻辑
      this.logger.success('处理完成')
    } catch (error) {
      this.logger.error('处理失败:', error)
      throw error
    }
  }
}
```

### 子日志器

```typescript
const mainLogger = createLogger({ prefix: 'Builder' })
const pluginLogger = mainLogger.child('Plugin')
const cacheLogger = mainLogger.child('Cache')

pluginLogger.info('加载插件')  // 输出: [Builder:Plugin] 加载插件
cacheLogger.debug('缓存命中') // 输出: [Builder:Cache] 缓存命中
```

## 日志格式

### 标准格式
```
[HH:mm:ss] [LEVEL] [Prefix] 消息内容
```

### 示例输出
```
[10:30:45] [INFO] 开始构建项目...
[10:30:45] [DEBUG] 解析入口文件: src/index.ts
[10:30:46] [SUCCESS] ✓ 构建完成，耗时 1200ms
[10:30:46] [WARN] 发现 3 个未使用的依赖
```

## 最佳实践

### ✅ 推荐

```typescript
// 使用 Logger 类
this.logger.info('开始构建')
this.logger.debug('配置详情:', config)

// 包含上下文信息
this.logger.error(`文件处理失败: ${filePath}`, error)

// 使用适当的日志级别
if (process.env.DEBUG) {
  this.logger.debug('详细调试信息')
}
```

### ❌ 避免

```typescript
// 直接使用 console
console.log('开始构建')  // ❌

// 无意义的日志
this.logger.info('test')  // ❌

// 敏感信息
this.logger.info('API Key:', apiKey)  // ❌

// 在热路径中过度日志
for (const file of files) {
  this.logger.debug(`处理文件: ${file}`)  // ❌ 可能产生大量日志
}
```

## 性能考虑

1. **避免在热路径中记录日志** - 高频循环中使用 `debug` 级别
2. **延迟字符串构造** - 使用回调或条件检查
3. **批量日志** - 对于批量操作，记录汇总而非每项详情

```typescript
// 推荐：汇总日志
this.logger.info(`处理了 ${files.length} 个文件`)

// 避免：逐个日志（除非是 debug 级别且必要）
files.forEach(f => this.logger.info(`处理: ${f}`))
```

## 配置

### 环境变量

- `LOG_LEVEL` - 设置全局日志级别 (silent|error|warn|info|debug|verbose)
- `NO_COLOR` - 禁用颜色输出

### 程序化配置

```typescript
import { setLogLevel, setSilent } from '@ldesign/builder/utils/logger'

// 设置日志级别
setLogLevel('debug')

// 静默模式
setSilent(true)
```
