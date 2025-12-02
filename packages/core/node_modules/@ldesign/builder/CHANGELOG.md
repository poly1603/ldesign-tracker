# 更新日志

本文档记录 `@ldesign/builder` 的所有重要变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [1.0.0] - 2024-01-15

### 🎉 首次发布

`@ldesign/builder` 正式发布！这是一个为现代前端库开发设计的智能打包工具。

### ✨ 新增功能

#### 核心功能

- **零配置构建**：自动检测项目类型，无需手动配置
- **多框架支持**：支持 Vue 2/3、React、Svelte、Solid、Preact、Lit、Angular、Qwik 等 11 种框架
- **多引擎支持**：支持 Rollup、Rolldown、esbuild、SWC 四种打包引擎
- **智能类型生成**：内置增强型 DTS 生成器，自动生成完整的类型声明文件
- **多格式输出**：支持 ESM、CJS、UMD 三种输出格式

#### 配置系统

- **defineConfig**：类型安全的配置定义函数
- **预设配置**：内置 7 种预设（node-library、web-library、universal-library、vue-library、react-library、cli-tool、monorepo-package）
- **autoConfig**：零配置自动生成构建配置
- **Zod Schema 验证**：配置验证和类型推断

#### 性能优化

- **三级缓存系统**：L1 内存缓存 + L2 磁盘缓存 + L3 远程缓存
- **并行构建**：利用多核 CPU 加速构建
- **增量构建**：只重新构建变更的文件
- **性能监控**：内置 PerformanceMonitor 跟踪构建性能

#### 插件系统

- **内置插件**：
  - `lessProcessorPlugin` - Less 样式处理
  - `cssModulesPlugin` - CSS Modules 支持
  - `imageOptimizerPlugin` - 图片优化
  - `svgOptimizerPlugin` - SVG 优化
  - `i18nExtractorPlugin` - 国际化文本提取
  - `vueStyleEntryGenerator` - Vue 样式入口生成
- **插件扩展**：支持自定义 Rollup 插件和 Builder 插件

#### CLI 工具

- `ldesign-builder build` - 构建项目
- `ldesign-builder dev` - 开发模式
- `ldesign-builder init` - 初始化配置
- `ldesign-builder analyze` - 依赖分析

#### 开发体验

- **完整的 TypeScript 支持**：所有 API 都有完整的类型定义
- **详细的错误提示**：友好的错误信息和修复建议
- **构建报告**：详细的构建结果报告
- **Watch 模式**：文件变更自动重新构建

### 📚 文档

- 完整的 README 文档
- API 参考文档
- 使用指南
- 配置迁移指南
- 使用示例集合

### 🧪 测试

- 单元测试覆盖率 90%+
- 集成测试
- E2E 测试
- 性能基准测试

---

## [未发布]

### 计划功能

- [ ] 分布式缓存支持
- [ ] 插件市场
- [ ] 可视化构建分析
- [ ] 更多框架支持（Astro、Nuxt3、Remix 等）
- [ ] 构建性能优化建议

---

## 版本说明

### 版本号规则

- **主版本号**：不兼容的 API 变更
- **次版本号**：向下兼容的功能新增
- **修订号**：向下兼容的问题修复

### 变更类型

- ✨ **新增**：新功能
- 🐛 **修复**：Bug 修复
- 📝 **文档**：文档更新
- 🔧 **配置**：配置变更
- ⚡️ **性能**：性能优化
- 🔒 **安全**：安全更新
- 💥 **破坏性变更**：不兼容的变更

---

## 贡献者

感谢所有为 `@ldesign/builder` 做出贡献的开发者！

---

## 相关链接

- [GitHub 仓库](https://github.com/ldesign/builder)
- [问题反馈](https://github.com/ldesign/builder/issues)
- [讨论区](https://github.com/ldesign/builder/discussions)

