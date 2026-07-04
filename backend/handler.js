const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, GetCommand, PutCommand, UpdateCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { PollyClient, SynthesizeSpeechCommand } = require("@aws-sdk/client-polly");

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const pollyClient = new PollyClient({ region: "ap-northeast-1" });
const crypto = require("crypto");

// フロントエンド（GitHub Pages）およびローカル開発サーバーのオリジンのみ許可し、
// CORSを介した第三者からの無制限なAPI呼び出し（Amazon Pollyの課金濫用等）を防ぐ
const ALLOWED_ORIGINS = [
  "https://bamiyanapp.github.io",
  "http://localhost:5173", // npm run dev（Vite開発サーバー）
  "http://localhost:4173", // npm run preview（Viteプレビューサーバー）
];

function resolveAllowedOrigin(event) {
  const requestOrigin = event?.headers?.origin || event?.headers?.Origin;
  return ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : ALLOWED_ORIGINS[0];
}

function escapeSsml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// recordTimeがtotalTime/totalDifficulty（合計値）をADDで積み上げる方式のため、
// 表示側で平均値（averageTime/averageDifficulty）を都度計算する。
// totalTime/totalDifficultyが無い（移行前の）アイテムは、既存のaverageTime/averageDifficultyを
// そのまま使う（後方互換）。
function safeAverage(total, readCount, legacyAverage) {
  if (readCount > 0 && typeof total === "number") {
    const average = total / readCount;
    return isNaN(average) || !isFinite(average) ? 0 : average;
  }
  return legacyAverage || 0;
}

function computePhraseStats(item) {
  if (typeof item.totalTime !== "number" && typeof item.totalDifficulty !== "number") {
    return item;
  }
  const { totalTime, totalDifficulty, ...rest } = item;
  const readCount = item.readCount || 0;
  const averageTime = safeAverage(totalTime, readCount, item.averageTime);
  const averageDifficulty = safeAverage(totalDifficulty, readCount, item.averageDifficulty);
  return { ...rest, averageTime, averageDifficulty };
}

// SSMLのprosody rate属性としてPollyが受け付けるキーワード
const ALLOWED_SPEECH_RATE_KEYWORDS = ["x-slow", "slow", "medium", "fast", "x-fast"];
const DEFAULT_SPEECH_RATE = "90%";

function normalizeSpeechRate(rate) {
  if (!rate) return DEFAULT_SPEECH_RATE;
  const rateStr = String(rate);
  if (/^\d/.test(rateStr)) {
    const num = parseInt(rateStr, 10);
    if (!isNaN(num)) {
      return `${num}%`;
    }
  }
  if (ALLOWED_SPEECH_RATE_KEYWORDS.includes(rateStr)) {
    return rateStr;
  }
  // 未知の値をそのままSSML属性に埋め込むとインジェクションの余地があるため、
  // 許可されていない値は既定値にフォールバックする
  return DEFAULT_SPEECH_RATE;
}

// タブを開いたまま放置する等で生じる異常値を統計に混入させないための経過時間の上限（秒）
const MAX_ELAPSED_SECONDS = 300;

// readCount/averageTime/averageDifficultyはGetItemで読んだ値を元にアプリ側で平均を
// 計算してからUpdateItemする方式だと、複数端末からの同時リクエストで競合し値がずれる。
// そのため合計値（totalTime, totalDifficulty）とreadCountをDynamoDBのADDで加算し、
// 表示側（getPhrase/getPhrasesList）で平均を計算する方式にすることでアトミックに更新する。
exports.recordTime = async (event) => {
  const allowedOrigin = resolveAllowedOrigin(event);
  try {
    const body = JSON.parse(event.body);
    const { id, category, time, difficulty } = body; // category, difficultyを追加

    if (
      !id ||
      !category ||
      typeof time !== 'number' ||
      isNaN(time) ||
      !isFinite(time) ||
      time <= 0 ||
      time > MAX_ELAPSED_SECONDS
    ) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": allowedOrigin },
        body: JSON.stringify({ message: "Invalid input" }),
      };
    }

    let updateExpression = "ADD readCount :one, totalTime :time";
    let expressionAttributeValues = {
      ":one": 1,
      ":time": time,
    };

    if (typeof difficulty === 'number' && !isNaN(difficulty) && isFinite(difficulty)) {
      updateExpression += ", totalDifficulty :difficulty";
      expressionAttributeValues[":difficulty"] = difficulty;
    }

    try {
      await docClient.send(new UpdateCommand({
        TableName: process.env.TABLE_NAME,
        Key: { category, id },
        // カテゴリ/IDの入力ミスで存在しない項目を新規作成してしまわないようにする
        ConditionExpression: "attribute_exists(id)",
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues,
      }));
    } catch (error) {
      if (error.name === "ConditionalCheckFailedException") {
        return {
          statusCode: 404,
          headers: { "Access-Control-Allow-Origin": allowedOrigin },
          body: JSON.stringify({ message: "Phrase not found" }),
        };
      }
      throw error;
    }

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": allowedOrigin },
      body: JSON.stringify({ message: "Time recorded successfully" }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": allowedOrigin },
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
}

// コメントの過大な長さによるスパム・ストレージ濫用を防ぐための上限
const MAX_COMMENT_LENGTH = 1000;

exports.postComment = async (event) => {
  const allowedOrigin = resolveAllowedOrigin(event);
  try {
    const body = JSON.parse(event.body);
    const { phraseId, category, phrase, comment } = body;

    if (
      !phraseId ||
      !comment ||
      typeof comment !== 'string' ||
      comment.length > MAX_COMMENT_LENGTH
    ) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": allowedOrigin },
        body: JSON.stringify({ message: "Invalid input" }),
      };
    }

    const item = {
      id: crypto.randomUUID(),
      phraseId,
      category,
      phrase,
      comment,
      createdAt: new Date().toISOString(),
    };

    await docClient.send(new PutCommand({
      TableName: process.env.COMMENTS_TABLE_NAME,
      Item: item,
    }));

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": allowedOrigin },
      body: JSON.stringify({ message: "Comment posted successfully" }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": allowedOrigin },
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
};

exports.getComments = async (event) => {
  const allowedOrigin = resolveAllowedOrigin(event);
  try {
    const scanParams = {
      TableName: process.env.COMMENTS_TABLE_NAME,
    };
    const scanResult = await docClient.send(new ScanCommand(scanParams));
    const items = scanResult.Items || [];

    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": allowedOrigin },
      body: JSON.stringify({ comments: items }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": allowedOrigin },
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
};

exports.getCongratulationAudio = async (event) => {
  const allowedOrigin = resolveAllowedOrigin(event);
  try {
    const params = event.queryStringParameters || {};
    const rawSpeechRate = params.speechRate || "90%";
    const speechRate = normalizeSpeechRate(rawSpeechRate);
    const lang = params.lang || "ja";

    let speechText = "おめでとう、全て読み終わりました";
    let voiceId = "Mizuki";
    let engine = "standard";

    if (lang === "en") {
      speechText = "Congratulations! You have finished all the cards.";
      voiceId = "Ruth";
      engine = "neural";
    }

    const pollyParams = {
      Text: `<speak><prosody rate="${speechRate}">${speechText}</prosody></speak>`,
      TextType: "ssml",
      OutputFormat: "mp3",
      VoiceId: voiceId,
      Engine: engine
    };

    const command = new SynthesizeSpeechCommand(pollyParams);
    const pollyResponse = await pollyClient.send(command);

    const audioBuffer = await streamToBuffer(pollyResponse.AudioStream);
    const base64Audio = audioBuffer.toString("base64");

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        audioData: `data:audio/mp3;base64,${base64Audio}`,
      }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": allowedOrigin },
      body: JSON.stringify({ message: "Internal Server Error", error: error.message }),
    };
  }
};

exports.getPhrase = async (event) => {
  const allowedOrigin = resolveAllowedOrigin(event);
  try {
    const params = event.queryStringParameters || {};
    const category = params.category || null;
    const repeatCount = parseInt(params.repeatCount || "2", 10);
    const rawSpeechRate = params.speechRate || "90%";
    const speechRate = normalizeSpeechRate(rawSpeechRate);
    const lang = params.lang || "ja";
    const announceCategory = params.announceCategory === "true";
    let targetId = params.id || null;
    const pollyCacheTableName = process.env.POLLY_CACHE_TABLE_NAME;

    let selectedItem = null;

    if (targetId && category) {
      // IDとカテゴリ両方ある場合はGetItem
      const getResult = await docClient.send(new GetCommand({
        TableName: process.env.TABLE_NAME,
        Key: { category, id: targetId },
      }));
      selectedItem = getResult.Item;
    } else {
      // それ以外は従来通りScan（またはQueryに最適化可能だが一旦Scan）
      const scanParams = {
        TableName: process.env.TABLE_NAME,
        ProjectionExpression: "id, category, phrase, #lvl, kana, phrase_en, answer, readCount, averageTime, averageDifficulty, totalTime, totalDifficulty",
        ExpressionAttributeNames: {
          "#lvl": "level",
        },
      };

      const scanResult = await docClient.send(new ScanCommand(scanParams));
      let items = scanResult.Items || [];

      if (targetId) {
        selectedItem = items.find(item => item.id === targetId);
      } else {
        if (category) {
          items = items.filter(item => (item.category || "").trim() === category.trim());
        }
        
        if (items.length > 0) {
          const randomIndex = Math.floor(Math.random() * items.length);
          selectedItem = items[randomIndex];
        }
      }
    }

    if (!selectedItem) {
      return {
        statusCode: 404,
        headers: { "Access-Control-Allow-Origin": allowedOrigin },
        body: JSON.stringify({ message: "Phrase not found" }),
      };
    }

    targetId = selectedItem.id;

    let audioData = null;

    const level = selectedItem.level;
    const speechPhrase = lang === "en"
      ? (selectedItem.phrase_en || selectedItem.phrase)
      : selectedItem.phrase;

    const cacheId = crypto.createHash("sha256").update(
      `${targetId}-${repeatCount}-${speechRate}-${lang}-${announceCategory}-${JSON.stringify([level, speechPhrase, selectedItem.category])}`
    ).digest("hex");

    if (pollyCacheTableName) {
      const cachedAudio = await docClient.send(new GetCommand({
        TableName: pollyCacheTableName,
        Key: { id: cacheId },
      }));
      if (cachedAudio.Item) {
        console.log("Serving audio from cache for id:", targetId);
        audioData = cachedAudio.Item.audioData;
      }
    }

    if (!audioData) {
      let voiceId = "Mizuki";
      let engine = "standard";
      let levelPrefix = "レベル";

      if (lang === "en") {
        voiceId = "Ruth";
        engine = "neural";
        levelPrefix = "Level";
      }

      const hasLevel = level !== "-" && level !== null && level !== undefined && String(level).trim() !== "";
      const escapedPhrase = escapeSsml(speechPhrase);
      const phraseWithLevel = hasLevel ? `${levelPrefix}, ${escapeSsml(level)}. ${escapedPhrase}` : escapedPhrase;

      let innerContent = phraseWithLevel;
      if (repeatCount >= 2) {
        innerContent = `${phraseWithLevel}<break time="1500ms"/>${phraseWithLevel}`;
      }

      // 複数種別を選択している場合、読み札がどの種別のものかを最後に1回だけ読み上げる（言語設定によらず日本語で読み上げる）
      if (announceCategory && selectedItem.category) {
        innerContent = `${innerContent}<break time="800ms"/>${escapeSsml(selectedItem.category)}`;
      }

      const ssmlText = `<speak><prosody rate="${speechRate}">${innerContent}</prosody></speak>`;

      const command = new SynthesizeSpeechCommand({
        Text: ssmlText,
        TextType: "ssml",
        OutputFormat: "mp3",
        VoiceId: voiceId,
        Engine: engine
      });
      const pollyResponse = await pollyClient.send(command);

      const audioBuffer = await streamToBuffer(pollyResponse.AudioStream);
      const base64Audio = audioBuffer.toString("base64");
      audioData = `data:audio/mp3;base64,${base64Audio}`;

      if (pollyCacheTableName) {
        await docClient.send(new PutCommand({
          TableName: pollyCacheTableName,
          Item: {
            id: cacheId,
            audioData: audioData,
            createdAt: new Date().toISOString(),
          },
        }));
      }
    }

    const stats = computePhraseStats(selectedItem);
    const responseBody = {
      id: selectedItem.id,
      category: selectedItem.category,
      phrase: selectedItem.phrase,
      phrase_en: selectedItem.phrase_en,
      level: selectedItem.level,
      kana: selectedItem.kana,
      answer: selectedItem.answer,
      audioData: audioData,
      readCount: stats.readCount || 0,
      averageTime: stats.averageTime || 0,
      averageDifficulty: stats.averageDifficulty || 0,
    };

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify(responseBody),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": allowedOrigin },
      body: JSON.stringify({ message: "Internal Server Error", error: error.message }),
    };
  }
};

exports.getPhrasesList = async (event) => {
  const allowedOrigin = resolveAllowedOrigin(event);
  try {
    const category = event.queryStringParameters ? event.queryStringParameters.category : null;
    let items = [];

    if (category) {
      const queryParams = {
        TableName: process.env.TABLE_NAME,
        KeyConditionExpression: "category = :cat",
        ExpressionAttributeValues: {
          ":cat": category,
        },
        ProjectionExpression: "id, category, phrase, #lvl, kana, answer, readCount, averageTime, averageDifficulty, totalTime, totalDifficulty",
        ExpressionAttributeNames: {
          "#lvl": "level",
        },
      };
      const queryResult = await docClient.send(new QueryCommand(queryParams));
      items = queryResult.Items || [];
    } else {
      const scanParams = {
        TableName: process.env.TABLE_NAME,
        ProjectionExpression: "id, category, phrase, #lvl, kana, answer, readCount, averageTime, averageDifficulty, totalTime, totalDifficulty",
        ExpressionAttributeNames: {
          "#lvl": "level",
        },
      };
      const scanResult = await docClient.send(new ScanCommand(scanParams));
      items = scanResult.Items || [];
    }

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": allowedOrigin },
      body: JSON.stringify({ phrases: items.map(computePhraseStats) }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": allowedOrigin },
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
};

exports.getCategories = async (event) => {
  const allowedOrigin = resolveAllowedOrigin(event);
  try {
    const scanParams = {
      TableName: process.env.TABLE_NAME,
      ProjectionExpression: "category, #grp",
      ExpressionAttributeNames: {
        "#grp": "group",
      },
    };
    const scanResult = await docClient.send(new ScanCommand(scanParams));
    const items = scanResult.Items || [];

    const categoryMap = new Map();
    items.forEach(item => {
      const name = item.category || "大ピンチずかん";
      if (!categoryMap.has(name)) {
        categoryMap.set(name, item.group === "engineer" ? "engineer" : "kids");
      }
    });

    let categories = [...categoryMap.entries()].map(([name, group]) => ({ name, group }));
    if (categories.length === 0) {
      categories = [{ name: "大ピンチずかん", group: "kids" }];
    }

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({ categories }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": allowedOrigin },
      body: JSON.stringify({ message: "Internal Server Error", error: error.message }),
    };
  }
};

async function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
}
