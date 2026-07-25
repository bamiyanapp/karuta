const crypto = require("crypto");
const { QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");
const { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { docClient, resolveAllowedOrigin, streamToBuffer } = require("./handler");
const { jsonResponse, badRequest, serverError } = require("./httpResponse");
// @sparticuz/chromium・puppeteer-coreはESM専用パッケージ（"type": "module"）のため、
// このファイル（CommonJS）からはrequire()できず、使用箇所（renderEfudaPdfWorker内）で
// 動的import()する

const lambdaClient = new LambdaClient({ region: "ap-northeast-1" });
const s3Client = new S3Client({ region: "ap-northeast-1" });

// 絵札印刷ページのディープリンク先（?view=print-efuda&category=...&side=...で
// カテゴリ選択UIを経由せず直接印刷内容を再現できる。frontend/src/App.jsxの
// view/selectedCategories初期化ロジックを参照）
const FRONTEND_PRINT_URL = "https://bamiyanapp.github.io/karuta/";

// PDF生成を許可する合計読み札数の上限。renderEfudaPdfWorkerのmemorySize/timeout
// （serverless.yml）と対応させて設定している。frontend/src/App.jsxの
// MAX_EFUDA_PRINT_CARDSと同じ値に保つこと（フロントは選択UI自体をブロックする一次防御、
// こちらはURL直叩き等を弾く二次防御）
const MAX_EFUDA_PRINT_CARDS_SERVER = 500;

const parseCategoryParam = (value) => (value ? value.split(",").filter(Boolean).map(decodeURIComponent) : []);

const pdfObjectKey = (jobId) => `efuda-pdf/${jobId}.pdf`;
const errorObjectKey = (jobId) => `efuda-pdf/${jobId}.error.json`;

const isNotFoundError = (error) =>
  error.name === "NotFound" || error.name === "NoSuchKey" || error.$metadata?.httpStatusCode === 404;

async function countPhrasesInCategory(category) {
  const result = await docClient.send(new QueryCommand({
    TableName: process.env.TABLE_NAME,
    KeyConditionExpression: "category = :cat",
    ExpressionAttributeValues: { ":cat": category },
    Select: "COUNT",
  }));
  return result.Count || 0;
}

// PDF生成ジョブを開始する。実際の描画はrenderEfudaPdfWorkerに非同期委譲する
// （Chromium起動＋大量ページ描画はAPI Gatewayの29秒タイムアウトを超えうるため、
// startSpeechRecognition/getSpeechRecognitionResultと同じ「開始→ポーリング」構成にしている）
exports.generateEfudaPdf = async (event) => {
  const allowedOrigin = resolveAllowedOrigin(event);
  try {
    const body = JSON.parse(event.body || "{}");
    const { categoryParam, side } = body;
    const categories = parseCategoryParam(categoryParam);

    if (categories.length === 0 || (side !== "front" && side !== "back")) {
      return badRequest(allowedOrigin, "Invalid input");
    }

    // クライアント側（App.jsxのMAX_EFUDA_PRINT_CARDS）でも上限チェックしているが、
    // URLを直接叩けばそちらは素通りできてしまう。サーバー側で実際の読み札数を
    // DynamoDBから数え直し、無制限にヘッドレスChromiumジョブを起動できないようにする
    const counts = await Promise.all(categories.map(countPhrasesInCategory));
    const totalCount = counts.reduce((sum, count) => sum + count, 0);

    if (totalCount > MAX_EFUDA_PRINT_CARDS_SERVER) {
      return badRequest(
        allowedOrigin,
        `選択された読み札数（${totalCount}枚）が上限（${MAX_EFUDA_PRINT_CARDS_SERVER}枚）を超えています`
      );
    }

    const jobId = crypto.randomUUID();

    // InvocationType: "Event"は必ずawaitする。awaitしないとこの関数のPromiseが
    // 解決した直後にLambdaの実行環境が凍結され、送信中のSDK呼び出しが破棄される恐れがある
    await lambdaClient.send(new InvokeCommand({
      FunctionName: process.env.RENDER_WORKER_FUNCTION_NAME,
      InvocationType: "Event",
      Payload: JSON.stringify({ jobId, categoryParam, side }),
    }));

    return jsonResponse(allowedOrigin, 200, { jobId });
  } catch (error) {
    return serverError(allowedOrigin, error, { includeMessage: true });
  }
};

// API Gateway経由ではなく、generateEfudaPdfからの非同期Invokeでのみ呼ばれる
// （serverless.ymlでhttpイベントを設定していないため、eventはpayloadそのもの）
exports.renderEfudaPdfWorker = async (event) => {
  const { jobId, categoryParam, side } = event;
  let browser;
  try {
    const [{ default: chromium }, { default: puppeteer }] = await Promise.all([
      import("@sparticuz/chromium"),
      import("puppeteer-core"),
    ]);

    const url = new URL(FRONTEND_PRINT_URL);
    url.searchParams.set("view", "print-efuda");
    // categoryParamはフロントエンドのserializeCategoriesParam()の出力をそのまま
    // 受け取ったものなので、ここではエンコード方式を再実装せずそのまま使う
    url.searchParams.set("category", categoryParam);
    url.searchParams.set("side", side);
    // 実物の紙面には印刷しないが、PDFでは種別を確認できるようにする
    // （既存のhtml2canvas版と同じ挙動。frontend/src/App.cssの.efuda-pdf-export参照）
    url.searchParams.set("pdfExport", "1");

    browser = await puppeteer.launch({
      args: await puppeteer.defaultArgs({ args: chromium.args, headless: "shell" }),
      executablePath: await chromium.executablePath(),
      headless: "shell",
    });

    const page = await browser.newPage();
    await page.goto(url.toString(), { waitUntil: "networkidle0" });
    // .efuda-print-areaはカテゴリ・読み札の取得が完了して初めて描画される要素のため、
    // これの出現をもってデータ準備完了とみなす
    await page.waitForSelector(".efuda-print-area");
    // コールドスタートしたChromiumはブラウザキャッシュを持たず、Google Fontsの
    // スワップが完了する前にキャプチャすると文字寸法がずれるおそれがあるため待つ。
    // このコールバックはNode側ではなくpage.evaluate()経由でブラウザ側で実行される
    // eslint-disable-next-line no-undef
    await page.evaluate(() => document.fonts.ready);
    // page.pdf()は既定で印刷用CSSを適用するが、暗黙の挙動に依存せず明示する
    await page.emulateMediaType("print");

    const pdfBuffer = await page.pdf({ preferCSSPageSize: true, printBackground: true });

    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.EFUDA_PDF_BUCKET_NAME,
      Key: pdfObjectKey(jobId),
      Body: pdfBuffer,
      ContentType: "application/pdf",
    }));
  } catch (error) {
    console.error(error);
    try {
      await s3Client.send(new PutObjectCommand({
        Bucket: process.env.EFUDA_PDF_BUCKET_NAME,
        Key: errorObjectKey(jobId),
        Body: JSON.stringify({ message: error.message }),
        ContentType: "application/json",
      }));
    } catch (writeError) {
      console.error("Failed to write error marker", writeError);
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

// ジョブの状態はDynamoDB等に保存せず、S3上の実際のオブジェクトの有無から都度導出する
// （getSpeechRecognitionResultと同じ「状態を持たずライブに確認する」方針）
exports.getEfudaPdfStatus = async (event) => {
  const allowedOrigin = resolveAllowedOrigin(event);
  try {
    const params = event.queryStringParameters || {};
    const { jobId, categoryLabel, side } = params;

    if (!jobId) {
      return badRequest(allowedOrigin, "Invalid input");
    }

    try {
      await s3Client.send(new HeadObjectCommand({
        Bucket: process.env.EFUDA_PDF_BUCKET_NAME,
        Key: pdfObjectKey(jobId),
      }));

      const sideLabel = side === "back" ? "裏面" : "表面";
      const filename = `${categoryLabel || "karuta"}_絵札_${sideLabel}.pdf`;
      const url = await getSignedUrl(
        s3Client,
        new GetObjectCommand({
          Bucket: process.env.EFUDA_PDF_BUCKET_NAME,
          Key: pdfObjectKey(jobId),
          // カテゴリ名は日本語を含むため、RFC 6266のfilename*形式で指定する
          ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        }),
        { expiresIn: 300 }
      );

      return jsonResponse(allowedOrigin, 200, { status: "DONE", url });
    } catch (headError) {
      if (!isNotFoundError(headError)) {
        throw headError;
      }
    }

    try {
      const errorObject = await s3Client.send(new GetObjectCommand({
        Bucket: process.env.EFUDA_PDF_BUCKET_NAME,
        Key: errorObjectKey(jobId),
      }));
      const errorBuffer = await streamToBuffer(errorObject.Body);
      const parsedError = JSON.parse(errorBuffer.toString("utf-8"));

      return jsonResponse(allowedOrigin, 200, { status: "FAILED", message: parsedError.message });
    } catch (getError) {
      if (!isNotFoundError(getError)) {
        throw getError;
      }
    }

    return jsonResponse(allowedOrigin, 200, { status: "IN_PROGRESS" });
  } catch (error) {
    return serverError(allowedOrigin, error, { includeMessage: true });
  }
};
