import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import sonarjs from 'eslint-plugin-sonarjs'
import jsxA11y from 'eslint-plugin-jsx-a11y-x'
import importX, { createNodeResolver } from 'eslint-plugin-import-x'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'src/changelog.json', 'coverage']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      // issue #857: アクセシビリティ・import衛生の検知を追加する。本家の
      // eslint-plugin-jsx-a11y・eslint-plugin-importはESLint v10未対応
      // （peerDependenciesがv9まで）のため、同等のルールセットをESLint最新版
      // 対応で維持しているフォーク（-x）を採用する
      jsxA11y.configs.recommended,
      importX.configs['flat/recommended'],
    ],
    plugins: { sonarjs },
    languageOptions: {
      // ecmaVersionは'latest'（最新構文を許可する）のみを指定する。以前は
      // languageOptions.ecmaVersion（2020）とparserOptions.ecmaVersion
      // （'latest'）が同居していたが、パース時には後者が優先されるため
      // 前者は実質無効な設定だった（issue #859）
      ecmaVersion: 'latest',
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: {
      // import-x/no-unresolvedの既定拡張子（.mjs/.cjs/.js/.json/.node）には
      // .jsxが含まれておらず、拡張子省略の相対import（例: './views/DetailView'）
      // が軒並み未解決として誤検知されていたため追加する（issue #857）
      'import-x/resolver-next': [createNodeResolver({
        extensions: ['.mjs', '.cjs', '.js', '.jsx', '.json', '.node'],
      })],
      // vite-plugin-pwaが提供する仮想モジュール（ビルド時にVite自身が解決する
      // ため、ファイルシステム上には存在しない）を未解決として誤検知しない
      // ようにする
      'import-x/core-modules': ['virtual:pwa-register/react'],
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      // ESLint組み込み。循環的複雑度の代替（issue #806）。sonarjsの
      // cognitive-complexityと閾値を揃え、両観点でerrorとする（issue #856。
      // lintスクリプトの`--max-warnings 0`により、warn severityにしても
      // 実質errorと同じ強制力になっていたため、severity自体もerrorへ揃えた）
      complexity: ['error', 15],
      ...sonarjs.configs.recommended.rules,
    },
  },
  {
    // このファイル自身（プラグインをdefault importで受け取りconfigs等の
    // プロパティへアクセスするESLint flat config特有の書き方）に対し、
    // import-x/no-named-as-default・no-named-as-default-memberが
    // 「defaultではなく同名のnamed exportの方を意図していないか」と
    // 警告する。プラグインオブジェクトをdefault importで受け取るのは
    // flat config設定ファイルの標準的な書き方であり、実際の誤りではないため
    // このファイル限定で無効化する
    files: ['eslint.config.js'],
    rules: {
      'import-x/no-named-as-default': 'off',
      'import-x/no-named-as-default-member': 'off',
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
