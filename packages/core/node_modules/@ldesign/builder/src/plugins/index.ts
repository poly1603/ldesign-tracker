/**
 * 插件统一导出
 */

// 官方插件导出
export { imageOptimizerPlugin } from './image-optimizer'
export { svgOptimizerPlugin } from './svg-optimizer'
export { i18nExtractorPlugin } from './i18n-extractor'

// 新增插件导出
export { fontHandlerPlugin } from './font-handler'
export { enhancedLessPlugin } from './less-processor'
export { vueStyleEntryGenerator } from './vue-style-entry-generator'
export type { VueStyleEntryOptions } from './vue-style-entry-generator'

// 组件库样式处理插件
export { createComponentStylePlugin, detectComponentLibraryStructure } from './ComponentStylePlugin'
export type { ComponentStylePluginOptions } from './ComponentStylePlugin'
