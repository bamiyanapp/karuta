const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({ region: "ap-northeast-1" });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "karuta-polly-cache";
const POLLY_CACHE_TTL_SECONDS = 30 * 24 * 60 * 60; // 30日

// getPhraseのPollyキャッシュ書き込みにTTLを設定するようにした際、この変更より前に
// 書き込まれたキャッシュ項目にはttl属性が無く、DynamoDB TTLはttl属性が無いアイテムを
// 削除できないため、そのままだと際限なく残り続けてしまう。
// このスクリプトは、ttl属性が無い既存アイテムに一度だけttl（30日後のUnix秒）を補完する。
// 使い方: node backfill-polly-cache-ttl.js
async function backfillPollyCacheTtl() {
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
      if (typeof item.ttl === "number") {
        continue;
      }

      const ttl = Math.floor(Date.now() / 1000) + POLLY_CACHE_TTL_SECONDS;

      try {
        await docClient.send(new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { id: item.id },
          // Scan時点から実際の更新までの間に、同じキャッシュキーへの書き込みが
          // 先に走っていた場合、そちらのttlを上書きしないようにする
          ConditionExpression: "attribute_not_exists(#ttl)",
          UpdateExpression: "set #ttl = :ttl",
          ExpressionAttributeNames: { "#ttl": "ttl" },
          ExpressionAttributeValues: { ":ttl": ttl },
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

  console.log(`Backfilled ttl for ${updatedCount} item(s), skipped ${skippedCount} item(s) already updated by live traffic.`);
  return updatedCount;
}

module.exports = { backfillPollyCacheTtl };

/* c8 ignore start */
if (require.main === module) {
  backfillPollyCacheTtl().catch((error) => {
    console.error("Backfill failed:", error);
    process.exitCode = 1;
  });
}
/* c8 ignore stop */
