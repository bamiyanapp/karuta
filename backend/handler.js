const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { PollyClient, SynthesizeSpeechCommand } = require("@aws-sdk/client-polly");

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const pollyClient = new PollyClient({ region: "ap-northeast-1" });

exports.getPhrase = async (event) => {
  try {
    // 1. DynamoDBから全件取得
    const scanParams = {
      TableName: process.env.TABLE_NAME,
    };
    const scanResult = await docClient.send(new ScanCommand(scanParams));
    const items = scanResult.Items;

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
    const speechText = `ピンチレベル、${level}。${phrase}`;

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
        phrase: phrase,
        level: level,
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

// ヘルパー関数: Readable Stream を Buffer に変換する
async function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
}
