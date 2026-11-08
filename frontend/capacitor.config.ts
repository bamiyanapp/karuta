import type { CapacitorConfig } from '@capacitor/cli'

// issue #2060: 既存のReact/Vite/PWA資産（frontend/）をそのまま活用し、
// Capacitorでネイティブシェル（iOS WebView）として包む。webDirは既存の
// Viteビルド出力先（dist/、vite.config.jsのbuild.outDir未指定のため既定値）
// をそのまま指す。PWA向けのビルド（Service Worker等）はブラウザ配信用として
// 別途維持し、本設定はそれに影響しない。
const config: CapacitorConfig = {
  appId: 'app.bamiyanapp.karuta',
  appName: 'かるた読み上げ',
  webDir: 'dist',
}

export default config
