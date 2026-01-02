const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { PollyClient, SynthesizeSpeechCommand } = require("@aws-sdk/client-polly");

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const pollyClient = new PollyClient({ region: "ap-northeast-1" });
const crypto = require("crypto");

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

    const { PutCommand } = require("@aws-sdk/lib-dynamodb");
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
    const speechText = "おめでとう、全て読み終わりました";
    const params = event.queryStringParameters || {};
    const speechRate = params.speechRate || "90%";

    const pollyParams = {
      Text: `<speak><prosody rate="${speechRate}">${speechText}</prosody></speak>`,
      TextType: "ssml",
      OutputFormat: "mp3",
      VoiceId: "Mizuki",
      Engine: "standard"
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
    const speechRate = params.speechRate || "90%";
    const targetId = params.id || null;

    // 1. DynamoDBから取得
    const scanParams = {
      TableName: process.env.TABLE_NAME,
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

    const level = selectedItem.level;
    const phrase = selectedItem.phrase;

    const hasLevel = level !== "-" && level !== null && level !== undefined && String(level).trim() !== "";
    const phraseWithLevel = hasLevel ? `レベル、${level}。${phrase}` : phrase;

    let innerContent = phraseWithLevel;
    if (repeatCount >= 2) {
      innerContent = `${phraseWithLevel}<break time="1500ms"/>${phraseWithLevel}`;
    }

    const ssmlText = `<speak><prosody rate="${speechRate}">${innerContent}</prosody></speak>`;

    const command = new SynthesizeSpeechCommand({
      Text: ssmlText,
      TextType: "ssml",
      OutputFormat: "mp3",
      VoiceId: "Mizuki",
      Engine: "standard"
    });
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
        id: selectedItem.id,
        category: selectedItem.category,
        phrase: phrase,
        level: level,
        kana: selectedItem.kana,
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
