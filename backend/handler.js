const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb"); // GetCommand, PutCommandを追加
const { PollyClient, SynthesizeSpeechCommand } = require("@aws-sdk/client-polly");

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const pollyClient = new PollyClient({ region: "ap-northeast-1" });
const crypto = require("crypto");

function normalizeSpeechRate(rate) {
  if (!rate) return "90%";
  const rateStr = String(rate);
  if (/^\d/.test(rateStr)) {
    const num = parseInt(rateStr, 10);
    if (!isNaN(num)) {
      return `${num}%`;
    }
  }
  return rateStr;
}

exports.postComment = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const { phraseId, category, phrase, comment } = body;

    if (!phraseId || !comment) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
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

    // `PutCommand` のインポートは既に行われているため、ここでは不要
    await docClient.send(new PutCommand({
      TableName: process.env.COMMENTS_TABLE_NAME,
      Item: item,
    }));

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ message: "Comment posted successfully" }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
};

exports.getComments = async (event) => {
  try {
    const scanParams = {
      TableName: process.env.COMMENTS_TABLE_NAME,
    };
    const scanResult = await docClient.send(new ScanCommand(scanParams));
    const items = scanResult.Items || [];

    // 作成日時順にソート（降順）
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ comments: items }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
};

exports.getCongratulationAudio = async (event) => {
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
      voiceId = "Ruth"; // 英語(US)の女性の声
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
        "Access-Control-Allow-Origin": "*",
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
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ message: "Internal Server Error", error: error.message }),
    };
  }
};

exports.getPhrase = async (event) => {
  try {
    const params = event.queryStringParameters || {};
    const category = params.category || null;
    const repeatCount = parseInt(params.repeatCount || "2", 10);
    const rawSpeechRate = params.speechRate || "90%";
    const speechRate = normalizeSpeechRate(rawSpeechRate);
    const lang = params.lang || "ja";
    let targetId = params.id || null;
    const pollyCacheTableName = process.env.POLLY_CACHE_TABLE_NAME; // キャッシュテーブル名を取得

    // 1. DynamoDBから取得 (ID指定でもScanしているのは既存ロジック踏襲)
    const scanParams = {
      TableName: process.env.TABLE_NAME,
      ProjectionExpression: "id, category, phrase, #lvl, kana, phrase_en", // phrase_enを追加
      ExpressionAttributeNames: {
        "#lvl": "level",
      },
    };
    
    const scanResult = await docClient.send(new ScanCommand(scanParams));
    let items = scanResult.Items || [];

    let selectedItem = null;

    if (targetId) {
      // ID指定がある場合
      selectedItem = items.find(item => item.id === targetId);
    } else {
      // ID指定がない場合は従来通りカテゴリからランダム選択（後方互換性のため）
      if (category) {
        items = items.filter(item => (item.category || "").trim() === category.trim());
      }
      
      if (items.length > 0) {
        const randomIndex = Math.floor(Math.random() * items.length);
        selectedItem = items[randomIndex];
      }
    }

    if (!selectedItem) {
      return {
        statusCode: 404,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ message: "Phrase not found" }),
      };
    }

    // ランダム選択の場合、IDを確定させる
    targetId = selectedItem.id;

    // 2. キャッシュチェック
    let audioData = null;
    
    // キャッシュキーを生成
    const cacheId = crypto.createHash("sha256").update(
      `${targetId}-${repeatCount}-${speechRate}-${lang}`
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

    // 3. キャッシュになければ Polly で生成
    if (!audioData) {
      const level = selectedItem.level;
      let speechPhrase = selectedItem.phrase;
      let voiceId = "Mizuki";
      let engine = "standard";
      let levelPrefix = "レベル";

      if (lang === "en") {
        speechPhrase = selectedItem.phrase_en || selectedItem.phrase;
        voiceId = "Ruth";
        engine = "neural";
        levelPrefix = "Level";
      }

      const hasLevel = level !== "-" && level !== null && level !== undefined && String(level).trim() !== "";
      const phraseWithLevel = hasLevel ? `${levelPrefix}, ${level}. ${speechPhrase}` : speechPhrase;

      let innerContent = phraseWithLevel;
      if (repeatCount >= 2) {
        innerContent = `${phraseWithLevel}<break time="1500ms"/>${phraseWithLevel}`;
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

      // キャッシュに保存
      if (pollyCacheTableName) {
        await docClient.send(new PutCommand({
          TableName: pollyCacheTableName,
          Item: {
            id: cacheId,
            audioData: audioData, // 生成した音声データを保存
            createdAt: new Date().toISOString(), // キャッシュの作成日時
          },
        }));
      }
    }

    const responseBody = {
      id: selectedItem.id,
      category: selectedItem.category,
      phrase: selectedItem.phrase, // 常に日本語 (originalPhrase)
      level: selectedItem.level,
      kana: selectedItem.kana,
      audioData: audioData,
    };

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify(responseBody),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ message: "Internal Server Error", error: error.message }),
    };
  }
};

exports.getPhrasesList = async (event) => {
  try {
    const category = event.queryStringParameters ? event.queryStringParameters.category : null;
    const scanParams = {
      TableName: process.env.TABLE_NAME,
      ProjectionExpression: "id, category",
    };
    const scanResult = await docClient.send(new ScanCommand(scanParams));
    let items = scanResult.Items || [];
    
    if (category) {
      items = items.filter(item => (item.category || "").trim() === category.trim());
    }

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ phrases: items }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
};

exports.getCategories = async (event) => {
  try {
    const scanParams = {
      TableName: process.env.TABLE_NAME,
      ProjectionExpression: "category",
    };
    const scanResult = await docClient.send(new ScanCommand(scanParams));
    const items = scanResult.Items || [];
    
    let categories = [...new Set(items.map(item => item.category || "大ピンチ図鑑"))];
    categories = categories.filter(cat => !!cat);
    if (categories.length === 0) {
      categories = ["大ピンチ図鑑"];
    }

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({ categories }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
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
