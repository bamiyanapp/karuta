const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { PollyClient, SynthesizeSpeechCommand } = require("@aws-sdk/client-polly");

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const pollyClient = new PollyClient({ region: "ap-northeast-1" });

exports.getPhrase = async (event) => {
  try {
    const category = event.queryStringParameters ? event.queryStringParameters.category : null;

    // 1. DynamoDBから取得
    const scanParams = {
      TableName: process.env.TABLE_NAME,
    };
    
    // 全件取得してからメモリ上でフィルタリングする（確実性の向上とデバッグのため）
    const scanResult = await docClient.send(new ScanCommand(scanParams));
    let items = scanResult.Items || [];

    console.log(`Total items in DB: ${items.length}`);
    if (items.length > 0) {
      console.log(`First item category sample: '${items[0].category}'`);
    }
    console.log(`Requested category: '${category}'`);

    if (category) {
      const filteredItems = items.filter(item => item.category === category);
      console.log(`Filtered items count: ${filteredItems.length}`);
      
      // もしフィルタリングで0件になったが、全件にはデータがある場合、カテゴリ名の不一致を疑う
      if (filteredItems.length === 0 && items.length > 0) {
        console.warn("Category mismatch detected. Attempting loose matching...");
        items = items.filter(item => (item.category || "").trim() === category.trim());
      } else {
        items = filteredItems;
      }
    }

    if (!items || items.length === 0) {
      return {
        statusCode: 404,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ message: "No phrases found" }),
      };
    }

    // 2. ランダムに1つ選択
    const randomIndex = Math.floor(Math.random() * items.length);
    const selectedItem = items[randomIndex];
    const level = selectedItem.level;
    const phrase = selectedItem.phrase;

    // レベルが "-" または数値以外の場合は読み上げない
    const isLevelValid = level !== "-" && level !== null && level !== undefined && !isNaN(Number(level));
    const speechText = isLevelValid ? `レベル、${level}。${phrase}` : phrase;

    // 3. Pollyで音声を生成し、バイナリを直接取得する
    const pollyParams = {
      Text: speechText,
      OutputFormat: "mp3",
      VoiceId: "Mizuki",
      Engine: "standard"
    };

    const command = new SynthesizeSpeechCommand(pollyParams);
    const pollyResponse = await pollyClient.send(command);

    // StreamをBufferに変換し、Base64文字列にする
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

exports.getCategories = async (event) => {
  try {
    const scanParams = {
      TableName: process.env.TABLE_NAME,
      ProjectionExpression: "category",
    };
    const scanResult = await docClient.send(new ScanCommand(scanParams));
    const items = scanResult.Items || [];
    
    // 重複を排除してカテゴリ名のリストを作成
    let categories = [...new Set(items.map(item => item.category || "大ピンチ図鑑"))];
    
    // 空文字やnullを除外
    categories = categories.filter(cat => !!cat);
    
    // それでも空ならデフォルトを返す
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

// ヘルパー関数: Readable Stream を Buffer に変換する
async function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
}
