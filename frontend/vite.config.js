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
    // setupTests.js で waitFor 系のデフォルトタイムアウトを底上げしているため、
    // 個別に timeout を指定していないテストが vitest 側の既定値(5000ms)で
    // 先に打ち切られないよう、テスト自体のタイムアウトも合わせて底上げする。
    testTimeout: 10000,
  },
})
