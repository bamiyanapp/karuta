// karuta#1960: backfill-total-stats.js・backfill-polly-cache-ttl.jsが、
// ExclusiveStartKeyによるページング付きScan＋
// ConditionExpression: "attribute_not_exists(...)" での上書き防止という
// ほぼ同じ構造のバックフィルループを個別に持っていたため共通化する。
const { ScanCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient } = require("./dynamoClient");

// tableName: スキャン対象テーブル名
// shouldSkip(item): trueを返すとそのアイテムは更新しない（既に補完済み等）
// buildUpdate(item): UpdateCommandへ渡す入力オブジェクトを返す。Scan時点から
//   実際のUpdateまでの間にライブトラフィックが先に書き込んでいた場合に
//   備え、呼び出し元でConditionExpressionによる上書き防止を指定すること
// logLabel: 完了ログの先頭に出す文言（例: "Backfilled ttl"）
async function pagedScanBackfill({ tableName, shouldSkip, buildUpdate, logLabel }) {
  let updatedCount = 0;
  let skippedCount = 0;
  let exclusiveStartKey;

  do {
    const scanResult = await docClient.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: exclusiveStartKey,
      }),
    );
    const items = scanResult.Items || [];

    for (const item of items) {
      if (shouldSkip(item)) continue;

      try {
        await docClient.send(new UpdateCommand(buildUpdate(item)));
        updatedCount++;
      } catch (error) {
        if (error.name === "ConditionalCheckFailedException") {
          skippedCount++;
          continue;
        }
        throw error;
      }
    }

    exclusiveStartKey = scanResult.LastEvaluatedKey;
  } while (exclusiveStartKey);

  console.log(`${logLabel} for ${updatedCount} item(s), skipped ${skippedCount} item(s) already updated by live traffic.`);
  return updatedCount;
}

module.exports = { pagedScanBackfill };
