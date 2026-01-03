const fs = require("fs");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({ region: "ap-northeast-1" });
const docClient = DynamoDBDocumentClient.from(client);

const NEW_TABLE_NAME = "karuta-phrases"; // 新しいテーブル名
const BACKUP_FILE_PATH = "backend/karuta-phrases-backup.json";

async function restore() {
  try {
    console.log("Loading data from backup file...");
    const data = fs.readFileSync(BACKUP_FILE_PATH, "utf-8");
    const items = JSON.parse(data);
    console.log(`Found ${items.length} items in backup.`);

    for (const item of items) {
      console.log(`Restoring item: ${item.id} (${item.category})`);
      await docClient.send(new PutCommand({
        TableName: NEW_TABLE_NAME,
        Item: item
      }));
    }

    console.log("Restore complete.");
  } catch (error) {
    console.error("Restore failed:", error);
  }
}

restore();
