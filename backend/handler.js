const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { PollyClient, SynthesizeSpeechCommand } = require("@aws-sdk/client-polly");
const pollyPresigner = require("@aws-sdk/polly-request-presigner");

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const pollyClient = new PollyClient({ region: "ap-northeast-1" });

exports.getPhrase = async (event) => {
  console.log("Event:", JSON.stringify(event));
  console.log("Table Name:", process.env.TABLE_NAME);
  try {
    // 1. DynamoDBから全件取得（簡易化のため。本来は件数が多い場合は別の方法を検討）
    const scanParams = {
      TableName: process.env.TABLE_NAME,
    };
    const scanResult = await docClient.send(new ScanCommand(scanParams));
    const items = scanResult.Items;
    console.log("Fetched items count:", items ? items.length : 0);

    if (!items || items.length === 0) {
      console.log("No items found in table.");
      return {
        statusCode: 404,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ message: "No phrases found" }),
      };
    }

    // 2. ランダムに1つ選択
    const randomIndex = Math.floor(Math.random() * items.length);
    const selectedItem = items[randomIndex];
    const text = selectedItem.phrase;

    // 3. Pollyで署名付きURLを生成（フロントエンドで直接再生させるため）
    const pollyParams = {
      Text: text,
      OutputFormat: "mp3",
      VoiceId: "Mizuki", // 日本語女性ボイス
    };

    const command = new SynthesizeSpeechCommand(pollyParams);
    
    // getSignedUrlを確実に取得する
    const getSignedUrlFunc = pollyPresigner.getSignedUrl || pollyPresigner;
    const url = await getSignedUrlFunc(pollyClient, command, { expiresIn: 300 });

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        id: selectedItem.id,
        phrase: text,
        audioUrl: url,
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
