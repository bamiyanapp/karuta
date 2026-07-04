const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({ region: "ap-northeast-1" });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "karuta-phrases";

// recordTimeを非アトミックな平均計算からDynamoDBのADDによる合計値（totalTime/totalDifficulty）
// 加算方式に変更したことに伴い、既存アイテムのaverageTime/averageDifficulty（平均値）から
// totalTime/totalDifficulty（合計値）を一度だけ逆算して補完するための移行スクリプト。
//
// 重要: 新しいrecordTime（ADD方式）をデプロイする前、もしくはトラフィックが無い時間帯に
// 一度だけ実行すること。デプロイ後・本番トラフィックがある状態で実行した場合、
// このスクリプトが対象アイテムをScanしてから実際にUpdateするまでの間にrecordTimeの
// ADDが先に走っていると、そのアイテムはtotalTime/totalDifficultyが既に存在するため
// スキップされる（ConditionExpressionにより上書きはしない＝同時書き込みの消失は防ぐが、
// そのアイテムの移行前の履歴はtotalTimeに反映されないまま残る）。
// 使い方: node backfill-total-stats.js
async function backfillTotalStats() {
  let updatedCount = 0;
  let skippedCount = 0;
  let exclusiveStartKey;

  do {
    const scanResult = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME,
      ExclusiveStartKey: exclusiveStartKey,
    }));
    const items = scanResult.Items || [];

    for (const item of items) {
      if (typeof item.totalTime === "number" && typeof item.totalDifficulty === "number") {
        continue;
      }

      const readCount = item.readCount || 0;
      const totalTime = (item.averageTime || 0) * readCount;
      const totalDifficulty = (item.averageDifficulty || 0) * readCount;

      try {
        await docClient.send(new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { category: item.category, id: item.id },
          // Scan時点から実際の更新までの間にrecordTimeのADDが先に走っていた場合、
          // このUpdateで上書きしてライブトラフィックの記録を消してしまわないようにする
          ConditionExpression: "attribute_not_exists(totalTime)",
          UpdateExpression: "set totalTime = :tt, totalDifficulty = :td",
          ExpressionAttributeValues: { ":tt": totalTime, ":td": totalDifficulty },
        }));
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

  console.log(`Backfilled totalTime/totalDifficulty for ${updatedCount} item(s), skipped ${skippedCount} item(s) already updated by live traffic.`);
  return updatedCount;
}

module.exports = { backfillTotalStats };

/* c8 ignore start */
if (require.main === module) {
  backfillTotalStats().catch((error) => {
    console.error("Backfill failed:", error);
    process.exitCode = 1;
  });
}
/* c8 ignore stop */
