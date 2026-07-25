import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import sonarjs from 'eslint-plugin-sonarjs'
import { defineConfig, globalIgnores } from 'eslint/config'

// eslint-plugin-sonarjsのrecommended設定は全ルールerror severityだが、
// 既存コードに対して一度に適用すると60件のエラーが発生し（複雑度の高い
// App.jsx/QuizRoomView.jsx等の大規模なリファクタが即座に必須になってしまう）、
// SonarCloud導入検討（issue #806）が意図した「低コストな導入」から外れる。
// warnへ一括ダウングレードして導入し、実際に手を入れる際の指標として使う
// （coverage_threshold・jscpdのduplication_thresholdと同様、既定は非ゲート）
const sonarjsWarnRules = Object.fromEntries(
  Object.entries(sonarjs.configs.recommended.rules).map(([rule, severity]) => [
    rule,
    Array.isArray(severity) ? ['warn', ...severity.slice(1)] : severity === 'error' ? 'warn' : severity,
  ])
)

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
