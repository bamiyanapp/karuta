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
    // 1. CSVファイルを読み込んでパース
    const fileContent = fs.readFileSync(CSV_FILE_PATH, "utf-8");
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
    });
    console.log(`Read ${records.length} records from CSV.`);

    // 2. CSVデータから現在の有効なIDリストを作成
    const newItemsMap = new Map();
    for (const record of records) {
      const category = record.category ? record.category.trim() : "大ピンチ図鑑";
      const phrase = record.phrase ? record.phrase.trim() : "";
      const id = crypto.createHash("md5").update(`${category}:${phrase}`).digest("hex");
      
      const levelRaw = record.level ? record.level.trim() : "-";
      let level;
      if (levelRaw !== "-" && !isNaN(parseInt(levelRaw, 10)) && /^\d+$/.test(levelRaw)) {
        level = parseInt(levelRaw, 10);
      } else {
        level = levelRaw;
      }

      newItemsMap.set(id, {
        id,
        category,
        level,
        kana: record.kana ? record.kana.trim() : "-",
        phrase,
        phrase_en: record.phrase_en ? record.phrase_en.trim() : ""
      });
    }

    // 3. DBの既存データを取得
    console.log("Checking existing data in DB...");
    const scanResult = await docClient.send(new ScanCommand({ TableName: TABLE_NAME }));
    const oldItems = scanResult.Items || [];
    const oldIds = new Set(oldItems.map(item => item.id));

    // 4. 不要なデータを削除（CSVに存在しないIDのみ）
    let deleteCount = 0;
    for (const oldId of oldIds) {
      if (!newItemsMap.has(oldId)) {
        await docClient.send(new DeleteCommand({
          TableName: TABLE_NAME,
          Key: { id: oldId },
        }));
        deleteCount++;
      }
    }
    if (deleteCount > 0) console.log(`Deleted ${deleteCount} obsolete records.`);

    // 5. 新しいデータを投入・更新（Upsert方式）
    let upsertCount = 0;
    for (const item of newItemsMap.values()) {
      await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
      }));
      upsertCount++;
    }
    console.log(`Upserted ${upsertCount} records.`);

    console.log("Seeding completed successfully (Incremental Sync with phrase_en).");
  } catch (error) {
    console.error("Seeding failed:", error);
  }
}

seed();
