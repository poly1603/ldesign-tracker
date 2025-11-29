import antfu from '@antfu/eslint-config'

export default antfu({
  typescript: true,
  vue: true,
  ignores: [
    'node_modules',
    'dist',
    'es',
    'lib',
    'coverage',
    '**/*.d.ts',
  ],
})

