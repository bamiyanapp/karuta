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

function trimOrDefault(value, defaultValue) {
  return value ? value.trim() : defaultValue;
}

// 既存アイテムが無い（=新規レコード）場合は各統計を0で初期化する
function extractStats(existingItem) {
  if (!existingItem) {
    return { readCount: 0, averageTime: 0, averageDifficulty: 0, totalTime: 0, totalDifficulty: 0 };
  }
  return {
    readCount: existingItem.readCount,
    averageTime: existingItem.averageTime,
    averageDifficulty: existingItem.averageDifficulty || 0,
    totalTime: existingItem.totalTime || 0,
    totalDifficulty: existingItem.totalDifficulty || 0,
  };
}

// CSVのlevel列を、数字文字列なら数値に、それ以外（初級/上級/"-"等）はそのまま文字列で扱う
function parseLevel(levelRaw) {
  if (levelRaw !== "-" && !isNaN(parseInt(levelRaw, 10)) && /^\d+$/.test(levelRaw)) {
    return parseInt(levelRaw, 10);
  }
  return levelRaw;
}

// カテゴリ名が変更されていても、CATEGORY_RENAMESを辿って過去の統計（readCount等）を引き継ぐ
function findExistingItem(existingItemsMap, category, id) {
  const direct = existingItemsMap.get(`${category}-${id}`);
  if (direct) return direct;
  return (CATEGORY_RENAMES[category] || [])
    .map((oldCategory) => existingItemsMap.get(`${oldCategory}-${id}`))
    .find((item) => item !== undefined);
}

// CSVの1レコードと既存データ（統計の引き継ぎ元）から、新しいアイテムを組み立てる。
// seed本体の複雑度を抑えるため分離している
function buildMergedItem(record, existingItemsMap) {
  const category = trimOrDefault(record.category, "大ピンチずかん");
  const id = record.id;
  const level = parseLevel(trimOrDefault(record.level, "-"));
  const existingItem = findExistingItem(existingItemsMap, category, id);
  const group = trimOrDefault(record.group, "") === "engineer" ? "engineer" : "kids";

  return {
    key: `${category}-${id}`,
    item: {
      id,
      category,
      group,
      level,
      kana: trimOrDefault(record.kana, "-"),
      phrase: trimOrDefault(record.phrase, ""),
      phrase_en: trimOrDefault(record.phrase_en, ""),
      answer: trimOrDefault(record.answer, "-"),
      explanation: trimOrDefault(record.explanation, "-"),
      ...extractStats(existingItem),
    },
  };
}

// CSVデータと既存のDynamoDBデータをマージして新しいアイテムマップを作成する
function buildNewItemsMap(records, existingItemsMap) {
  const newItemsMap = new Map(); // key: `${category}-${id}`
  for (const record of records) {
    const { key, item } = buildMergedItem(record, existingItemsMap);
    newItemsMap.set(key, item);
  }
  return newItemsMap;
}

// 新しいCSVに存在しなくなったレコードを削除する
async function deleteObsoleteItems(existingItemsMap, newItemsMap) {
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
}

// 新しいデータを投入・更新する（Upsert方式）
async function upsertItems(newItemsMap) {
  let upsertCount = 0;
  for (const item of newItemsMap.values()) {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    }));
    upsertCount++;
  }
  console.log(`Upserted ${upsertCount} records.`);
}

async function seed() {
  try {
    // 1. CSVファイルを読み込んでパース
    const fileContent = fs.readFileSync(CSV_FILE_PATH, "utf-8");
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
    });
    console.log(`Read ${records.length} records from CSV.`);

    // 既存の全アイテムを一度取得 (readCountとaverageTimeを保持するため)
    console.log("Fetching existing data from DynamoDB...");
    const existingItemsScan = await docClient.send(new ScanCommand({ TableName: TABLE_NAME }));
    const existingItemsMap = new Map(); // key: `${category}-${id}`
    (existingItemsScan.Items || []).forEach(item => {
        existingItemsMap.set(`${item.category}-${item.id}`, item);
    });
    console.log(`Found ${existingItemsMap.size} existing items in DB.`);

    // 2. CSVデータと既存のDynamoDBデータをマージして新しいアイテムマップを作成
    const newItemsMap = buildNewItemsMap(records, existingItemsMap);

    // 3. 不要なデータを削除
    await deleteObsoleteItems(existingItemsMap, newItemsMap);

    // 4. 新しいデータを投入・更新（Upsert方式）
    await upsertItems(newItemsMap);

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
