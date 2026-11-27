// CORSの許可オリジンの一覧と判定（issue #2185）。handler.js・quizRoomHandler.js・efudaPdfHandler.jsが共有する。
// フロントエンド（本番CloudFront・移行前のGitHub Pages）およびローカル開発サーバーのオリジンのみ許可し、
// CORSを介した第三者からの無制限なAPI呼び出し（Amazon Pollyの課金濫用等）を防ぐ。
// serverless.ymlのcustom.allowedOrigins（API GatewayのCORS設定）と同じ内容を持つ。
// 片方だけ更新するとCORSが壊れるため、cors.test.jsが一致を検査する
const ALLOWED_ORIGINS = [
  "https://d2o6qgma31ysgl.cloudfront.net", // 本番フロントエンド（issue #1332でGitHub Pagesから移行）
  "https://bamiyanapp.github.io", // 移行ページ（kill switch、issue #1332）。配信中は残す
  "http://localhost:5173", // npm run dev（Vite開発サーバー）
  "http://localhost:4173", // npm run preview（Viteプレビューサーバー）
];

function resolveAllowedOrigin(event) {
  const requestOrigin = event?.headers?.origin || event?.headers?.Origin;
  return ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : ALLOWED_ORIGINS[0];
}

module.exports = { ALLOWED_ORIGINS, resolveAllowedOrigin };
