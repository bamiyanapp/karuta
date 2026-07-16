export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "https://akmnirkx3m.execute-api.ap-northeast-1.amazonaws.com/dev";

// クイズ大会モード（issue #470）のWebSocket API。#477マージ後のデプロイで払い出された
// 実際のエンドポイント（backend/serverless.ymlのwebsocketイベントから自動生成）
export const WS_BASE_URL =
  import.meta.env.VITE_WS_BASE_URL ||
  "wss://k3egkiofa4.execute-api.ap-northeast-1.amazonaws.com/dev";
