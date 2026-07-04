const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, UpdateCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({ region: "ap-northeast-1" });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "karuta-phrases";

// 放置等で読み上げ統計（readCount/averageTime/averageDifficulty）に異常値が
// 混入してしまったフレーズを、手動でリセットするための保守スクリプト。
// 使い方: node reset-stats.js <category> <id>
async function resetStats(category, id) {
  if (!category || !id) {
    console.error("使い方: node reset-stats.js <category> <id>");
    process.exitCode = 1;
    return;
  }

  console.log(`Resetting stats for category="${category}" id="${id}"...`);
  try {
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { category, id },
      // カテゴリ/IDの入力ミスで存在しない項目を新規作成してしまわないようにする
      ConditionExpression: "attribute_exists(category)",
      UpdateExpression: "set readCount = :zero, averageTime = :zero, averageDifficulty = :zero, totalTime = :zero, totalDifficulty = :zero",
      ExpressionAttributeValues: { ":zero": 0 },
    }));
    console.log("Reset complete.");
  } catch (error) {
    if (error.name === "ConditionalCheckFailedException") {
      console.error(`指定されたフレーズが見つかりません: category="${category}" id="${id}"`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }
}

module.exports = { resetStats };

/* c8 ignore start */
if (require.main === module) {
  const [, , category, id] = process.argv;
  resetStats(category, id).catch((error) => {
    console.error("Reset failed:", error);
    process.exitCode = 1;
  });
}
/* c8 ignore stop */
