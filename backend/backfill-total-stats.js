const { pagedScanBackfill } = require("./pagedScanBackfill");
const { PHRASES_TABLE_NAME } = require("./dynamoClient");

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
  return pagedScanBackfill({
    tableName: PHRASES_TABLE_NAME,
    shouldSkip: (item) => typeof item.totalTime === "number" && typeof item.totalDifficulty === "number",
    buildUpdate: (item) => {
      const readCount = item.readCount || 0;
      const totalTime = (item.averageTime || 0) * readCount;
      const totalDifficulty = (item.averageDifficulty || 0) * readCount;
      return {
        TableName: PHRASES_TABLE_NAME,
        Key: { category: item.category, id: item.id },
        // Scan時点から実際の更新までの間にrecordTimeのADDが先に走っていた場合、
        // このUpdateで上書きしてライブトラフィックの記録を消してしまわないようにする
        ConditionExpression: "attribute_not_exists(totalTime)",
        UpdateExpression: "set totalTime = :tt, totalDifficulty = :td",
        ExpressionAttributeValues: { ":tt": totalTime, ":td": totalDifficulty },
      };
    },
    logLabel: "Backfilled totalTime/totalDifficulty",
  });
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
