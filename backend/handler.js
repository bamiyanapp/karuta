const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, GetCommand, PutCommand, UpdateCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { PollyClient, SynthesizeSpeechCommand } = require("@aws-sdk/client-polly");
const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { TranscribeClient, StartTranscriptionJobCommand, GetTranscriptionJobCommand } = require("@aws-sdk/client-transcribe");

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const pollyClient = new PollyClient({ region: "ap-northeast-1" });
const s3Client = new S3Client({ region: "ap-northeast-1" });
const transcribeClient = new TranscribeClient({ region: "ap-northeast-1" });
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

// 日本語で選択可能な声の許可リスト（キー: PollyのVoiceId、値: 対応するEngine）。
// 任意の文字列をそのままPollyのVoiceIdへ渡すと存在しない値でのAPI呼び出しやコスト濫用の余地があるため、
// 許可リストに無い値は既定のMizukiにフォールバックする
const JAPANESE_VOICES = {
  Mizuki: "standard",
  Takumi: "standard",
  Kazuha: "neural",
  Tomoko: "neural",
};
const DEFAULT_JAPANESE_VOICE_ID = "Mizuki";

// 英語は現状Ruth固定（声選択の対象外）
function resolveVoice(lang, requestedVoiceId) {
  if (lang === "en") {
    return { voiceId: "Ruth", engine: "neural" };
  }
  if (requestedVoiceId && Object.prototype.hasOwnProperty.call(JAPANESE_VOICES, requestedVoiceId)) {
    return { voiceId: requestedVoiceId, engine: JAPANESE_VOICES[requestedVoiceId] };
  }
  return { voiceId: DEFAULT_JAPANESE_VOICE_ID, engine: JAPANESE_VOICES[DEFAULT_JAPANESE_VOICE_ID] };
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

    const speechText = lang === "en"
      ? "Congratulations! You have finished all the cards."
      : "おめでとう、全て読み終わりました";
    const { voiceId, engine } = resolveVoice(lang, params.voiceId);

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

// キャッシュキーの組み合わせ（読み上げ速度・回数・言語・カテゴリ告知有無等）分だけ
// レコードが際限なく増加しないよう、DynamoDB TTLで一定期間後に自動削除する
const POLLY_CACHE_TTL_SECONDS = 30 * 24 * 60 * 60; // 30日

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
    const { voiceId, engine } = resolveVoice(lang, params.voiceId);

    const cacheId = crypto.createHash("sha256").update(
      `${targetId}-${repeatCount}-${speechRate}-${lang}-${announceCategory}-${voiceId}-${JSON.stringify([level, speechPhrase, selectedItem.category])}`
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
      const levelPrefix = lang === "en" ? "Level" : "レベル";

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
            ttl: Math.floor(Date.now() / 1000) + POLLY_CACHE_TTL_SECONDS,
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
      ProjectionExpression: "category, #grp, answer",
      ExpressionAttributeNames: {
        "#grp": "group",
      },
    };
    const scanResult = await docClient.send(new ScanCommand(scanParams));
    const items = scanResult.Items || [];

    // 全フレーズに答えのデータがあるかるたは市販品ではなくオリジナルのため、
    // 実物の所持確認は不要と判断する（backend/phrases.csvのanswer列が"-"のもののみ市販品扱い）。
    const categoryMap = new Map();
    items.forEach(item => {
      const name = item.category || "大ピンチずかん";
      const hasAnswer = !!item.answer && item.answer !== "-";
      if (!categoryMap.has(name)) {
        categoryMap.set(name, {
          group: item.group === "engineer" ? "engineer" : "kids",
          allHaveAnswer: hasAnswer,
        });
      } else {
        const info = categoryMap.get(name);
        info.allHaveAnswer = info.allHaveAnswer && hasAnswer;
      }
    });

    let categories = [...categoryMap.entries()].map(([name, info]) => ({
      name,
      group: info.group,
      requiresPossessionCheck: !info.allHaveAnswer,
    }));
    if (categories.length === 0) {
      categories = [{ name: "大ピンチずかん", group: "kids", requiresPossessionCheck: true }];
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

// 録音データ（data URI）の許容上限。数秒程度の発話であれば十分な余裕を持たせつつ、
// 悪意あるリクエストによるS3/Transcribeの課金濫用を防ぐ
const MAX_AUDIO_DATA_URI_LENGTH = 3_000_000; // 概ねbase64で3MB（デコード後2MB強）

const AUDIO_DATA_URI_PATTERN = /^data:audio\/([a-zA-Z0-9.+-]+);base64,(.+)$/s;

function decodeAudioDataUri(audioData) {
  const match = typeof audioData === "string" ? audioData.match(AUDIO_DATA_URI_PATTERN) : null;
  if (!match) {
    return null;
  }
  const [, subtype, base64Body] = match;
  return { mediaFormat: subtype.toLowerCase(), buffer: Buffer.from(base64Body, "base64") };
}

// 全角英数・カタカナを半角/ひらがなへ寄せ、記号・空白を除去する。
// AWS Transcribeの認識結果とphrases.csv側の表記揺れ（カタカナ語の送り仮名等）を
// 吸収するための簡易正規化であり、完全な表記統一を保証するものではない
function normalizeJapaneseText(text) {
  return String(text || "")
    .normalize("NFKC")
    .replace(/[ァ-ヶ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60)) // カタカナ→ひらがな
    .replace(/[\s、。！？「」『』・,.!?]/g, "")
    .toLowerCase();
}

// 2文字列の編集距離（レーベンシュタイン距離）。認識結果が短い発話であることを踏まえ、
// 外部ライブラリを追加せず素直なDP実装で十分とした
function levenshteinDistance(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const distances = Array.from({ length: rows }, (_, i) => [i, ...new Array(cols - 1).fill(0)]);
  for (let j = 0; j < cols; j += 1) {
    distances[0][j] = j;
  }
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      distances[i][j] = Math.min(
        distances[i - 1][j] + 1,
        distances[i][j - 1] + 1,
        distances[i - 1][j - 1] + cost
      );
    }
  }
  return distances[rows - 1][cols - 1];
}

// answerが"-"（未設定）のカテゴリでは読み札そのものの聞き取り一致を見る必要があるため、
// kanaへフォールバックする。しきい値は誤認識の揺れを吸収しつつ全くの別語を弾ける程度
// （文字数の3割まで異なっていても許容）に経験的に設定している
const MATCH_DISTANCE_RATIO_THRESHOLD = 0.3;

function isAnswerMatch(transcript, phrase) {
  const rawTarget = phrase?.answer && phrase.answer !== "-" ? phrase.answer : phrase?.kana;
  const normalizedTarget = normalizeJapaneseText(rawTarget);
  const normalizedTranscript = normalizeJapaneseText(transcript);

  if (!normalizedTarget || !normalizedTranscript) {
    return false;
  }
  if (normalizedTranscript.includes(normalizedTarget)) {
    return true;
  }
  const distance = levenshteinDistance(normalizedTarget, normalizedTranscript);
  return distance / normalizedTarget.length <= MATCH_DISTANCE_RATIO_THRESHOLD;
}

// 音声データをS3へアップロードし、AWS Transcribeの非同期ジョブを開始する。
// ジョブ完了までは通常数秒〜十数秒かかるため、Lambda 1回の呼び出し内で待たず、
// クライアントにjobNameを返してgetSpeechRecognitionResultでポーリングさせる方式にした
// （API GatewayのLambda統合タイムアウト内で確実に完了する保証がないため）
exports.startSpeechRecognition = async (event) => {
  const allowedOrigin = resolveAllowedOrigin(event);
  try {
    const body = JSON.parse(event.body);
    const { audioData, id, category, lang } = body;

    if (!id || !category || !audioData || audioData.length > MAX_AUDIO_DATA_URI_LENGTH) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": allowedOrigin },
        body: JSON.stringify({ message: "Invalid input" }),
      };
    }

    const decoded = decodeAudioDataUri(audioData);
    if (!decoded) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": allowedOrigin },
        body: JSON.stringify({ message: "Invalid audio data" }),
      };
    }

    const bucketName = process.env.VOICE_AUDIO_BUCKET_NAME;
    const jobName = crypto.randomUUID();
    const inputKey = `voice-input/${jobName}.${decoded.mediaFormat}`;
    const outputKey = `voice-output/${jobName}.json`;

    await s3Client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: inputKey,
      Body: decoded.buffer,
    }));

    await transcribeClient.send(new StartTranscriptionJobCommand({
      TranscriptionJobName: jobName,
      LanguageCode: lang === "en" ? "en-US" : "ja-JP",
      MediaFormat: decoded.mediaFormat,
      Media: { MediaFileUri: `s3://${bucketName}/${inputKey}` },
      OutputBucketName: bucketName,
      OutputKey: outputKey,
    }));

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": allowedOrigin },
      body: JSON.stringify({ jobName }),
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

exports.getSpeechRecognitionResult = async (event) => {
  const allowedOrigin = resolveAllowedOrigin(event);
  try {
    const params = event.queryStringParameters || {};
    const { jobName, id, category } = params;

    if (!jobName || !id || !category) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": allowedOrigin },
        body: JSON.stringify({ message: "Invalid input" }),
      };
    }

    const jobResult = await transcribeClient.send(new GetTranscriptionJobCommand({
      TranscriptionJobName: jobName,
    }));
    const job = jobResult.TranscriptionJob;

    if (job.TranscriptionJobStatus === "IN_PROGRESS" || job.TranscriptionJobStatus === "QUEUED") {
      return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": allowedOrigin },
        body: JSON.stringify({ status: "IN_PROGRESS" }),
      };
    }

    if (job.TranscriptionJobStatus === "FAILED") {
      return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": allowedOrigin },
        body: JSON.stringify({ status: "FAILED", message: job.FailureReason }),
      };
    }

    const bucketName = process.env.VOICE_AUDIO_BUCKET_NAME;
    const outputKey = `voice-output/${jobName}.json`;
    const outputObject = await s3Client.send(new GetObjectCommand({
      Bucket: bucketName,
      Key: outputKey,
    }));
    const outputBuffer = await streamToBuffer(outputObject.Body);
    const transcriptJson = JSON.parse(outputBuffer.toString("utf-8"));
    const transcript = transcriptJson?.results?.transcripts?.[0]?.transcript || "";

    const getResult = await docClient.send(new GetCommand({
      TableName: process.env.TABLE_NAME,
      Key: { category, id },
    }));

    if (!getResult.Item) {
      return {
        statusCode: 404,
        headers: { "Access-Control-Allow-Origin": allowedOrigin },
        body: JSON.stringify({ message: "Phrase not found" }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": allowedOrigin },
      body: JSON.stringify({
        status: "COMPLETED",
        transcript,
        isCorrect: isAnswerMatch(transcript, getResult.Item),
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

async function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
}
