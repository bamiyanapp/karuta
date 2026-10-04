import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './bootstrap-theme.css'
import App from './App.jsx'
import PwaUpdatePrompt from './PwaUpdatePrompt.jsx'
import AddToHomeScreenPrompt from './AddToHomeScreenPrompt.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { API_BASE_URL } from './config'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary
      reportUrl={`${API_BASE_URL}/report-client-error`}
      // issue #1328（ブルーグリーンデプロイ導入 Task 9）: canary版で例外が発生した
      // 場合、/stable/への遷移を自動フォールバック先とする。infra/serverless.yml
      // のCloudFront Functionsが、/stable/への明示アクセスをきっかけに以後の
      // アクセスもstableへ固定するCookieを発行する（HttpOnlyのためクライアント側
      // JSからは直接書き換えられない）。現在のクエリ文字列（カテゴリ選択等の状態）
      // は維持する
      fallbackUrl={`/stable${window.location.search}`}
    >
      <App />
      <PwaUpdatePrompt />
      <AddToHomeScreenPrompt />
    </ErrorBoundary>
  </StrictMode>,
)
