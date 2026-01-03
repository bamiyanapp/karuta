const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, ScanCommand, DeleteCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");

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

    // 2. CSVデータと既存のDynamoDBデータをマージして新しいアイテムマップを作成
    const newItemsMap = new Map(); // key: `${category}-${id}`

    // 既存の全アイテムを一度取得 (readCountとaverageTimeを保持するため)
    console.log("Fetching existing data from DynamoDB...");
    const existingItemsScan = await docClient.send(new ScanCommand({ TableName: TABLE_NAME }));
    const existingItemsMap = new Map(); // key: `${category}-${id}`
    (existingItemsScan.Items || []).forEach(item => {
        existingItemsMap.set(`${item.category}-${item.id}`, item);
    });
    console.log(`Found ${existingItemsMap.size} existing items in DB.`);

    for (const record of records) {
      const category = record.category ? record.category.trim() : "大ピンチずかん";
      const id = record.id;
      
      const levelRaw = record.level ? record.level.trim() : "-";
      let level;
      if (levelRaw !== "-" && !isNaN(parseInt(levelRaw, 10)) && /^\d+$/.test(levelRaw)) {
        level = parseInt(levelRaw, 10);
      } else {
        level = levelRaw;
      }

      const existingItem = existingItemsMap.get(`${category}-${id}`);

      newItemsMap.set(`${category}-${id}`, {
        id,
        category,
        level,
        kana: record.kana ? record.kana.trim() : "-",
        phrase: record.phrase ? record.phrase.trim() : "",
        phrase_en: record.phrase_en ? record.phrase_en.trim() : "",
        readCount: existingItem ? existingItem.readCount : 0,
        averageTime: existingItem ? existingItem.averageTime : 0
      });
    }

    // 3. 不要なデータを削除
    let deleteCount = 0;
    for (const existingItem of existingItemsMap.values()) {
      if (!newItemsMap.has(`${existingItem.category}-${existingItem.id}`)) {
        await docClient.send(new DeleteCommand({
          TableName: TABLE_NAME,
          Key: { category: existingItem.category, id: existingItem.id },
        }));
        deleteCount++;
      }
    }
    if (deleteCount > 0) console.log(`Deleted ${deleteCount} obsolete records.`);

    // 4. 新しいデータを投入・更新（Upsert方式）
    let upsertCount = 0;
    for (const item of newItemsMap.values()) {
      await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
      }));
      upsertCount++;
    }
    console.log(`Upserted ${upsertCount} records.`);

    console.log("Seeding completed successfully (Incremental Sync with statistics).");
  } catch (error) {
    console.error("Seeding failed:", error);
  }
}

seed();
