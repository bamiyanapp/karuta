// 認証なしの公開APIを、送信元IP単位・1日あたりの回数で制限する（issue #2188）。
// 回数のカウント自体は、dev-standardsの共有ロジック（shared/lambda/dailyRateLimit.js、
// dev-standards#1406）に委ねる。ここでは、karutaの上限値とテーブル設定をまとめる。
//
// 上限値の根拠: 通常の利用（家庭・教室で1日遊ぶ）では到達せず、機械的な連続呼び出しは止まる水準にする。
// 学校・イベント会場等では多数の端末が同じIPを共有するため、余裕を持たせる。
//
// 障害時はfail-open: カウンタ用テーブルへのアクセス自体が失敗した場合は、記録した上で
// リクエストを通す（レート制限の障害で、本来の機能を止めないため）。
// RATE_LIMIT_TABLE_NAMEが未設定の環境（ローカル開発・テスト等）では、制限しない。

const { DynamoDBClient, UpdateItemCommand } = require("@aws-sdk/client-dynamodb");
const { rateLimitIdentifier, checkRateLimitFailOpen } = require("./dailyRateLimit.js"); // symlink先（dev-standards#1406）

const ddb = new DynamoDBClient({ region: "ap-northeast-1" });

// 1日あたりの上限。送信元IP単位の上限（`ip`）と、全体の総量の上限（`global`）を区別する
const RATE_LIMITS = Object.freeze({
  // POST /report-client-error。1リクエストごとに運用監視用LINE Botへ通知が飛ぶため低くする
  reportClientError: { name: "report-client-error", ip: 20 },
  // 運用監視用LINE Botへの通知の送信総量。IPを変えながら送られても、LINEの月間送信数の
  // 上限を使い切って本物の障害通知が届かなくならないようにする
  opsAlertLine: { name: "ops-alert-line", global: 30 },
});

async function checkLimit({ identifier, limit }) {
  const tableName = process.env.RATE_LIMIT_TABLE_NAME;
  if (!tableName) return true;
  return checkRateLimitFailOpen({
    ddb,
    UpdateItemCommand,
    tableName,
    keyAttribute: "limitKey",
    identifier,
    limit,
  });
}

// 送信元IP単位の上限内なら true。上限に達していれば false（呼び出し側で429を返す）
async function isWithinIpLimit(event, { name, ip }) {
  return checkLimit({ identifier: rateLimitIdentifier(event, name), limit: ip });
}

// 全体の総量の上限内なら true
async function isWithinGlobalLimit({ name, global }) {
  return checkLimit({ identifier: `${name}#all`, limit: global });
}

module.exports = { RATE_LIMITS, isWithinIpLimit, isWithinGlobalLimit };
