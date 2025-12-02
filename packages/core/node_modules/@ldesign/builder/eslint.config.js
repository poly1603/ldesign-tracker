import antfu from '@antfu/eslint-config'

export default antfu({
  typescript: true,
  vue: false,
  jsonc: true,
  markdown: true,
  formatters: {
    css: true,
    html: true,
    markdown: 'prettier',
  },
  rules: {
    // 基础规则
    'no-console': 'off', // 允许 console，这是 CLI 工具
    'no-debugger': 'warn',
    'no-alert': 'error',
    'no-eval': 'error',
    'no-implied-eval': 'error',

    // TypeScript 规则
    '@typescript-eslint/explicit-function-return-type': 'off', // 允许类型推断
    '@typescript-eslint/no-explicit-any': 'warn', // 警告使用 any
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    }],
    '@typescript-eslint/no-non-null-assertion': 'warn',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    // 以下规则需要类型信息，暂时禁用以避免配置复杂性
    '@typescript-eslint/no-floating-promises': 'off',
    '@typescript-eslint/await-thenable': 'off',
    '@typescript-eslint/no-misused-promises': 'off',
    '@typescript-eslint/prefer-nullish-coalescing': 'off',
    '@typescript-eslint/prefer-optional-chain': 'off',
    '@typescript-eslint/consistent-type-imports': ['error', {
      prefer: 'type-imports',
      fixStyle: 'inline-type-imports',
    }],

    // 代码质量
    'complexity': ['warn', 20], // 圈复杂度
    'max-depth': ['warn', 4], // 最大嵌套深度
    'max-lines-per-function': ['warn', {
      max: 150,
      skipBlankLines: true,
      skipComments: true,
    }],
    'max-params': ['warn', 5], // 最多 5 个参数
    'no-magic-numbers': 'off', // 允许魔术数字

    // 最佳实践
    'eqeqeq': ['error', 'always'],
    'no-throw-literal': 'error',
    'prefer-promise-reject-errors': 'error',
    'require-await': 'error',
    'no-return-await': 'error',

    // 风格
    'curly': ['error', 'all'], // 始终使用大括号
    'brace-style': ['error', '1tbs', { allowSingleLine: true }],
    'quotes': ['error', 'single', { avoidEscape: true }],
    'semi': ['error', 'never'], // 不使用分号（与 antfu 一致）

    // Import 顺序 - 使用 antfu 内置的排序规则
    'sort-imports': 'off', // 禁用默认的排序规则
    'perfectionist/sort-imports': 'off', // 使用 antfu 的默认配置

    // 注释
    'spaced-comment': ['error', 'always', {
      markers: ['/'],
    }],

    // 错误处理
    'no-empty': ['error', { allowEmptyCatch: false }],
    'no-empty-function': 'warn',
  },
})
