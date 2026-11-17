// APIサーバーへの通信の共通処理（issue #2187）。実装はdev-standardsの共有ロジック
// （shared/api/apiClient.js、dev-standards#1408）で、ここでは接続先（API_BASE_URL）を注入する。
// エンドポイントごとの関数は`endpoints.js`に集約する。画面への通知（alert等）は行わず、
// 失敗をどう見せるかは呼び出し側の責務とする。
import { createApiClient } from "./apiClient.js";
import { API_BASE_URL } from "../config";

// fetchは呼び出し時にグローバルから解決する。モジュール読み込み時の参照を保持すると、
// テストで`window.fetch`を差し替えても反映されないため
export const api = createApiClient({
  baseUrl: API_BASE_URL,
  fetch: (...args) => globalThis.fetch(...args),
});

export { ApiError, messageForApiError } from "./apiClient.js";
