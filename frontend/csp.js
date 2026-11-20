// Content-Security-Policyの正本（issue #2189、dev-standards docs/security-headers-pattern.md）。
// 本番（infra/serverless.ymlのレスポンスヘッダーポリシー）とE2E用のプレビューサーバー
// （vite.config.jsのpreview.headers）が、同じ値を読む。1か所にしか書かない
const directives = {
  'default-src': ["'self'"],
  'script-src': ["'self'"],
  // Reactのstyle属性（style={{...}}）が多数あるため、インラインスタイルを許可する
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:', 'blob:'],
  // 読み上げ音声が data:audio/mp3;base64,... 形式でAPIから返るため、data:が必須
  'media-src': ["'self'", 'data:', 'blob:'],
  'font-src': ["'self'", 'data:'],
  // stable・canaryでAPI GatewayのIDが異なるため、リージョン内のワイルドカードで許可する
  'connect-src': [
    "'self'",
    'https://*.execute-api.ap-northeast-1.amazonaws.com',
    'wss://*.execute-api.ap-northeast-1.amazonaws.com',
  ],
  'worker-src': ["'self'"],
  'manifest-src': ["'self'"],
  'frame-ancestors': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
};

export function buildCsp(extra = {}) {
  const merged = { ...directives };
  for (const [name, values] of Object.entries(extra)) {
    merged[name] = [...(merged[name] || []), ...values];
  }
  return Object.entries(merged)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ');
}

export default buildCsp();
