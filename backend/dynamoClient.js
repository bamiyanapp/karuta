// karuta#1960: backend/の一回限り保守スクリプト群（migrate.js・seed.js・
// reset-stats.js・backfill-*.js）で、DynamoDBクライアント初期化とテーブル名が
// 個別に重複していた。リージョン変更時等の修正漏れを避けるため共通化する。
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({ region: "ap-northeast-1" });
const docClient = DynamoDBDocumentClient.from(client);

const PHRASES_TABLE_NAME = "karuta-phrases";
const POLLY_CACHE_TABLE_NAME = "karuta-polly-cache";

module.exports = { docClient, PHRASES_TABLE_NAME, POLLY_CACHE_TABLE_NAME };
