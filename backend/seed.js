const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, ScanCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({ region: "ap-northeast-1" });
const docClient = DynamoDBDocumentClient.from(client);

const CSV_FILE_PATH = path.join(__dirname, "phrases.csv");
const TABLE_NAME = "karuta-phrases";

// カテゴリ名を変更した際、readCount等の統計をリセットさせず引き継ぐためのリネームマップ。
// key: 変更後（CSV上の現在の）カテゴリ名, value: 過去に使っていたカテゴリ名の配列
// （categoryはDynamoDBのキーの一部のため、名前を変えると別レコード扱いになってしまう）
const CATEGORY_RENAMES = {
  "モダン開発大ピンチ": ["モダン開発かるた", "モダンソフトウェア開発かるた"],
  "大ピンチ法則かるた": ["法則と効果かるた"],
};

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

      const existingItem = existingItemsMap.get(`${category}-${id}`)
        ?? (CATEGORY_RENAMES[category] || [])
          .map((oldCategory) => existingItemsMap.get(`${oldCategory}-${id}`))
          .find((item) => item !== undefined);
      const groupRaw = record.group ? record.group.trim() : "";
      const group = groupRaw === "engineer" ? "engineer" : "kids";

      newItemsMap.set(`${category}-${id}`, {
        id,
        category,
        group,
        level,
        kana: record.kana ? record.kana.trim() : "-",
        phrase: record.phrase ? record.phrase.trim() : "",
        phrase_en: record.phrase_en ? record.phrase_en.trim() : "",
        answer: record.answer ? record.answer.trim() : "-",
        explanation: record.explanation ? record.explanation.trim() : "-",
        readCount: existingItem ? existingItem.readCount : 0,
        averageTime: existingItem ? existingItem.averageTime : 0,
        averageDifficulty: existingItem ? (existingItem.averageDifficulty || 0) : 0,
        totalTime: existingItem ? (existingItem.totalTime || 0) : 0,
        totalDifficulty: existingItem ? (existingItem.totalDifficulty || 0) : 0
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
    throw error;
  }
}

module.exports = { seed };

/* c8 ignore start */
if (require.main === module) {
  seed().catch(() => {
    process.exitCode = 1;
  });
}
/* c8 ignore stop */
