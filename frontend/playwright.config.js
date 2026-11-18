import { defineConfig, devices } from '@playwright/test';
import { buildPlaywrightConfig } from './playwright.config.base.js'; // dev-standardsの共有設定（symlink、issue #2244）

// このE2Eテストはローカルのモックサーバーではなく、実際にデプロイ済みの
// バックエンド（backend/serverless.yml、API_BASE_URL/WS_BASE_URLが指す本番AWS環境）に
// 対して実行する。frontend側にモックできるバックエンドが存在しないため
// （テスト用スタブAPIは用意していない）、フロントエンドのビルド成果物のみを
// ローカルでホストし、その先の通信は本番相当のAPI Gateway/DynamoDB/WebSocket API を
// そのまま使う。クイズ大会モードのルームはTTL（24時間）で自動失効するため、
// テスト実行で作成されるルームが際限なく残り続けることはない
//
// reporter（html・json・monocart-reporter）とカバレッジの収集対象（entryFilter・sourceFilter）は、
// 共有の土台（buildPlaywrightConfig）に任せる。reporterを上書きすると、失敗理由の出力
// （results.json）やカバレッジの検知が効かなくなるため、ここでは渡さない。
// basePath: vite.config.jsのbaseは"./"（相対）で、ビルド成果物はルート直下（/assets/）から
// 配信されるため、土台には'/'を渡す
export default buildPlaywrightConfig({
  defineConfig,
  devices,
  reportName: 'karuta E2E Coverage Report',
  basePath: '/',
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    timeout: 30000,
  },
  overrides: {
    // /get-phraseはPolly音声合成（未キャッシュ時）・Lambdaコールドスタートを伴うことがあり、
    // デフォルトの30秒では稀に不足するため底上げする
    timeout: 60000,
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    // issue #820: Pollyコールドキャッシュ起因で稀に発生するタイムアウトが、1回のリトライでも
    // 解消しないことが複数回観測されたため、CI実行時のリトライ回数を2にする
    retries: process.env.CI ? 2 : 0,
    // useを渡すと土台のuseが置き換わるため、baseURLも渡す
    use: {
      baseURL: 'http://localhost:4173',
      trace: 'on-first-retry',
      // 失敗時のスクリーンショットをレポートへ自動添付し、CIログだけで状態確認できるようにする
      // （issue #559）。成功時の要所のスクリーンショットは、各テスト内でtestInfo.attach()により添付する
      screenshot: 'only-on-failure',
    },
  },
});
