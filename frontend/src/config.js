export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "https://akmnirkx3m.execute-api.ap-northeast-1.amazonaws.com/dev";

// クイズ大会モード（issue #470）のWebSocket API。REST APIと異なりAPI Gateway ID・エンドポイントが
// 新規に払い出されるため、初回デプロイ完了までは確定した既定値を置けない。デプロイ後、
// `npx serverless deploy`出力のWebSocket endpointをVITE_WS_BASE_URLとして設定するか、
// この既定値（null）を実際の"wss://..."エンドポイントに書き換える
export const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || null;
