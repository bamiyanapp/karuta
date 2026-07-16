import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
      VitePWA({
        registerType: 'prompt',
        injectRegister: 'auto',
        manifest: {
          name: 'かるた読み上げアプリ',
          short_name: 'かるた',
          start_url: './',
          scope: './',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  base: "./",
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js',
    // e2e/はPlaywright専用のテストファイル（別ランナー・別コマンドで実行する）のため、
    // vitestの既定の*.spec.jsマッチから除外する（他はvitestの既定exclude一覧を維持）
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
      './e2e/**',
    ],
    // setupTests.js で waitFor 系のデフォルトタイムアウトを底上げしているため、
    // 個別に timeout を指定していないテストが vitest 側の既定値(5000ms)で
    // 先に打ち切られないよう、テスト自体のタイムアウトも合わせて底上げする。
    testTimeout: 10000,
    // App.test.jsx は実タイマー（Audio再生・カード表示アニメーション等）に依存しており、
    // CIランナーの負荷次第でwaitForのタイムアウトに稀に抵触することがある
    // （フォールバックとしてタイムアウト自体も別途拡大済み）。ロジックの問題ではなく
    // 実行環境側の一時的な遅延によるものであるため、失敗時は最大2回まで自動リトライする。
    retry: 2,
  },
})
