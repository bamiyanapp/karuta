const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { parse } = require("csv-parse/sync");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, ScanCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({ region: "ap-northeast-1" });
const docClient = DynamoDBDocumentClient.from(client);

const CSV_FILE_PATH = path.join(__dirname, "phrases.csv");
const TABLE_NAME = "karuta-phrases";

async function seed() {
  try {
    // 1. 既存のデータを全件取得する
    console.log("Cleaning up old data...");
    const scanResult = await docClient.send(new ScanCommand({ TableName: TABLE_NAME }));
    const oldItems = scanResult.Items || [];

    // 2. 既存のデータをすべて削除する
    for (const item of oldItems) {
      await docClient.send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: { id: item.id },
        })
      );
    }
    console.log(`Deleted ${oldItems.length} old records.`);

    // 3. CSVファイルを読み込む
    const fileContent = fs.readFileSync(CSV_FILE_PATH, "utf-8");

    // 4. CSVをパースする
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
    });

    console.log(`Read ${records.length} new records from CSV.`);

    // 5. 新しいデータを投入する
    for (const record of records) {
      await docClient.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            id: crypto.randomUUID(), // UUIDを生成してIDとする
            category: record.category.trim(),
            level: parseInt(record.level.trim(), 10),
            kana: record.kana.trim(),
            phrase: record.phrase.trim(),
          },
        })
      );
      console.log(`Seeded: [${record.category}][Lv${record.level}] ${record.kana} - ${record.phrase}`);
    }

    console.log("Seeding completed successfully (Full Replace).");
  } catch (error) {
    console.error("Seeding failed:", error);
  }
}

seed();
