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
