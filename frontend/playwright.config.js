import { defineConfig } from '@playwright/test';

// このE2Eテストはローカルのモックサーバーではなく、実際にデプロイ済みの
// バックエンド（backend/serverless.yml、API_BASE_URL/WS_BASE_URLが指す本番AWS環境）に
// 対して実行する。frontend側にモックできるバックエンドが存在しないため
// （テスト用スタブAPIは用意していない）、フロントエンドのビルド成果物のみを
// ローカルでホストし、その先の通信は本番相当のAPI Gateway/DynamoDB/WebSocket API を
// そのまま使う。クイズ大会モードのルームはTTL（24時間）で自動失効するため、
// テスト実行で作成されるルームが際限なく残り続けることはない
export default defineConfig({
  testDir: './e2e',
  // /get-phraseはPolly音声合成（未キャッシュ時）・Lambdaコールドスタートを伴うことがあり、
  // デフォルトの30秒では稀に不足するため底上げする
  timeout: 60000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    process.env.CI ? ['html', { open: 'never' }] : ['list'],
    // JSカバレッジ算出結果のログ出力（issue #541）。frontend/e2e/coverage.jsの
    // startCoverage/stopCoverageで各ページのカバレッジを収集し、ここで登録した
    // グローバルレポートへ集約する。console-summaryでコンソールへ要約を出力しつつ、
    // json-summaryでfrontend/coverage/coverage-summary.jsonへも出力する
    // （frontend-testジョブのユニットテストカバレッジと同じ形式・パスにすることで、
    // dev-standardsのcheck-coverage-threshold複合アクションをそのまま再利用できる）
    ['monocart-reporter', {
      name: 'karuta E2E Coverage Report',
      outputFile: './coverage/monocart-report/index.html',
      coverage: {
        outputDir: './coverage',
        // vite buildの出力（バンドル・minify済み）のうち、node_modules等の
        // ベンダーコードを除いた自アプリのソースだけをカバレッジ集計対象にする。
        // sourcePathはsourcemap由来の正規化されたパスで、先頭が"src/..."のケースも
        // あるため、区切り文字の有無に関わらず"src/"にマッチさせる（実機検証で、
        // 先頭一致を考慮しないと全件除外されることを確認済み）
        sourceFilter: (sourcePath) => /(^|[/\\])src[/\\]/.test(sourcePath),
        reports: [['console-summary'], ['json-summary']],
      },
    }],
  ],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    // 失敗時のスクリーンショットをHTMLレポートに自動添付し、CIログだけで
    // 状態確認できるようにする（issue #559）。成功時の要所のスクリーンショットは
    // 各テスト内でtestInfo.attach()により明示的に添付する
    screenshot: 'only-on-failure',
    // 環境に応じてPlaywrightバンドルのChromiumダウンロードを避け、
    // 事前インストール済みのバイナリを使う（このリポジトリのCI/開発環境の既定パス）
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
