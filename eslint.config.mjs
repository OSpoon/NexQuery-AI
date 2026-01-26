import antfu from '@antfu/eslint-config'

export default antfu({
  // Enable Stylistic formatting (Prettier-like)
  stylistic: {
    indent: 2,
    quotes: 'single',
    semi: false, // Antfu style: No semicolons
  },

  // Enable Frameworks
  vue: true,
  typescript: true,
  jsonc: true,
  yaml: true,

  // Global Ignores
  ignores: [
    '**/dist',
    '**/build',
    '**/node_modules',
    '**/coverage',
    '**/.output',
    '**/temp',
    '**/*.min.js',
    '**/*.d.ts',
    '**/cdk.out',
    'backend/build/**',
    'backend/ace', // Adonis Ace binary
  ],
},
// Backend (AdonisJS) Specific Rules
{
  files: ['backend/**/*.ts'],
  rules: {
    'ts/explicit-function-return-type': 'off',
    'ts/consistent-type-definitions': 'off',
    'node/prefer-global/process': 'off',
    'antfu/top-level-function': 'off',
    'perfectionist/sort-imports': 'off', // Adonis has specific import order sometimes
    'style/brace-style': ['error', '1tbs'], // Adonis often uses 1tbs
    'unused-imports/no-unused-vars': 'off', // Handled by typescript
    'ts/consistent-type-imports': 'off', //
  },
},
// Mini Program (Uni-app) Specific Globals
{
  files: ['miniprogram/**/*.ts', 'miniprogram/**/*.vue', 'miniprogram/**/*.js'],
  languageOptions: {
    globals: {
      uni: 'readonly',
      wx: 'readonly',
      getCurrentPages: 'readonly',
      getApp: 'readonly',
      Page: 'readonly',
      Component: 'readonly',
      App: 'readonly',
    },
  },
})
