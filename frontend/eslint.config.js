import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import sonarjs from 'eslint-plugin-sonarjs'
import { defineConfig, globalIgnores } from 'eslint/config'
import { buildSonarjsWarnRules } from '../eslint-sonarjs-warn.cjs'

const sonarjsWarnRules = buildSonarjsWarnRules(sonarjs)

export default defineConfig([
  globalIgnores(['dist', 'src/changelog.json', 'coverage']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    plugins: { sonarjs },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      // ESLint組み込み。循環的複雑度の代替（issue #806）。sonarjsの
      // cognitive-complexityと閾値を揃え、両観点で警告する
      complexity: ['warn', 15],
      ...sonarjsWarnRules,
    },
  },
  {
    // Playwright（設定ファイル・E2Eテスト）はNode上で実行されるため、
    // ブラウザではなくNodeのグローバル（process等）を使う
    files: ['playwright.config.js', 'e2e/**/*.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
