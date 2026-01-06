import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['__tests__/**/*.{test,spec}.ts'],
    exclude: ['node_modules', 'dist', 'es', 'lib'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/*.d.ts', '**/*.test.ts', '**/*.spec.ts'],
    },
  },
  resolve: {
    alias: {
      '@ldesign/tracker-core': resolve(__dirname, './packages/core/src/index.ts'),
      '@ldesign/tracker-vue': resolve(__dirname, './packages/vue/src/index.ts'),
    },
  },
})

