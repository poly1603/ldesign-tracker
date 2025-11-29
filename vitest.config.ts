import { defineConfig } from 'vitest/config'

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
      '@ldesign/tracker-core': './packages/core/src/index.ts',
      '@ldesign/tracker-vue': './packages/vue/src/index.ts',
    },
  },
})

