#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const {
  loadServerlessConfig,
  extractHttpApiRoutes,
  extractWebsocketRoutes,
  extractDynamoDbTables,
  extractS3Buckets,
  listFunctionNames,
  extractFunctionEnvironment,
  extractProviderEnvironment,
} = require("./serverless-yaml");
const { splitExportsIntoBlocks, splitNamedFunctionsIntoBlocks } = require("./handler-blocks");

const repoRoot = path.resolve(__dirname, "..", "..");
const serverlessPath = path.join(repoRoot, "backend", "serverless.yml");
const outputPath = path.join(repoRoot, "docs", "generated", "serverless-architecture.md");

function sanitizeId(label) {
  return label.replace(/[^a-zA-Z0-9]/g, "_");
}

// !GetAtt <論理ID>.Arn形式の参照から、Serverless Frameworkの命名規則
// （関数名の先頭を大文字にし"LambdaFunction"を付与）を逆算して関数名を復元する。
// 対応する関数がfunctionNamesに存在しなければnullを返す
function resolveGetAttToFunctionName(getAttRef, functionNames) {
  if (!getAttRef || typeof getAttRef !== "object" || !getAttRef["Fn::GetAtt"]) {
    return null;
  }
  const logicalId = String(getAttRef["Fn::GetAtt"]).split(".")[0];
  for (const functionName of functionNames) {
    const expectedLogicalId = `${functionName.charAt(0).toUpperCase()}${functionName.slice(1)}LambdaFunction`;
    if (logicalId === expectedLogicalId) {
      return functionName;
    }
  }
  return null;
}

// exportされた関数のブロックが直接呼び出している、非exportのトップレベル
// ヘルパー関数のブロックを1階層分だけ集める（例: handler.jsのgetPhraseが
// findPhraseItem/synthesizePhraseAudioを呼ぶケース）。ヘルパーの呼び出しチェーンを
// 深く辿るとAIによる意味解釈に近づいてしまうため、1階層のみを対象にする
// （本ファイルの実際のコード構成をカバーするのに必要十分な範囲。issue #904のコメント参照）
function collectCalledHelperBlocks(functionBlock, namedFunctionBlocks) {
  const called = [];
  for (const [helperName, helperBlock] of namedFunctionBlocks) {
    if (new RegExp(`\\b${helperName}\\(`).test(functionBlock)) {
      called.push(helperBlock);
    }
  }
  return called;
}

function usesPolly(functionBlock, calledHelperBlocks) {
  const POLLY_CALL_RE = /pollyClient\.send\(|SynthesizeSpeechCommand\(/;
  return POLLY_CALL_RE.test(functionBlock) || calledHelperBlocks.some((block) => POLLY_CALL_RE.test(block));
}

function collectEnvVarNames(functionBlock, calledHelperBlocks) {
  const text = [functionBlock, ...calledHelperBlocks].join("\n");
  return [...new Set([...text.matchAll(/process\.env\.(\w+)/g)].map((m) => m[1]))];
}

function buildResourceNodesByEnvValue(tables, buckets) {
  const map = new Map();
  for (const table of tables) {
    map.set(table.tableName, { id: `table_${sanitizeId(table.tableName)}`, label: `${table.tableName}<br/>(DynamoDB)` });
  }
  for (const bucket of buckets) {
    map.set(bucket.bucketName, { id: `bucket_${sanitizeId(bucket.bucketName)}`, label: `${bucket.bucketName}<br/>(S3)` });
  }
  return map;
}

function main() {
  const config = loadServerlessConfig(serverlessPath);
  const httpRoutes = extractHttpApiRoutes(config);
  const websocketRoutes = extractWebsocketRoutes(config);
  const tables = extractDynamoDbTables(config);
  const buckets = extractS3Buckets(config);
  const functionNames = listFunctionNames(config);
  const providerEnv = extractProviderEnvironment(config);
  const resourceNodeByEnvValue = buildResourceNodesByEnvValue(tables, buckets);

  const handlerBlockCache = new Map(); // ファイルベース名 -> { exportBlocks, namedBlocks }
  function getHandlerBlocks(fileBaseName) {
    if (!handlerBlockCache.has(fileBaseName)) {
      const filePath = path.join(repoRoot, "backend", `${fileBaseName}.js`);
      handlerBlockCache.set(fileBaseName, {
        exportBlocks: splitExportsIntoBlocks(filePath),
        namedBlocks: splitNamedFunctionsIntoBlocks(filePath),
      });
    }
    return handlerBlockCache.get(fileBaseName);
  }

  const functionHandlerByName = {};
  for (const route of [...httpRoutes, ...websocketRoutes]) {
    functionHandlerByName[route.functionName] = route.handler;
  }
  // httpApi/websocketいずれのイベントも持たない関数（例: renderEfudaPdfWorker）は
  // serverless.ymlのfunctions定義から直接handlerを引く
  for (const functionName of functionNames) {
    if (!functionHandlerByName[functionName]) {
      functionHandlerByName[functionName] = config.functions[functionName].handler;
    }
  }

  const edges = [];
  const usesPollyByFunction = new Set();
  const functionToFunctionInvokes = [];

  for (const functionName of functionNames) {
    const handler = functionHandlerByName[functionName];
    const [fileBaseName, exportName] = handler.split(".");
    const { exportBlocks, namedBlocks } = getHandlerBlocks(fileBaseName);
    const block = exportBlocks.get(exportName);
    if (!block) {
      continue;
    }

    const calledHelperBlocks = collectCalledHelperBlocks(block, namedBlocks);

    if (usesPolly(block, calledHelperBlocks)) {
      usesPollyByFunction.add(functionName);
    }

    const envVarNames = collectEnvVarNames(block, calledHelperBlocks);
    const functionEnv = extractFunctionEnvironment(config, functionName);
    const combinedEnv = { ...providerEnv, ...functionEnv };
    for (const envVarName of envVarNames) {
      const value = combinedEnv[envVarName];
      if (value === undefined) {
        continue;
      }
      const invokedFunctionName = resolveGetAttToFunctionName(value, functionNames);
      if (invokedFunctionName) {
        functionToFunctionInvokes.push({ from: functionName, to: invokedFunctionName });
        continue;
      }
      if (resourceNodeByEnvValue.has(value)) {
        edges.push({ from: functionName, to: value });
      }
    }
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(
    outputPath,
    renderMarkdown({
      httpRoutes,
      websocketRoutes,
      functionNames,
      resourceNodeByEnvValue,
      edges,
      usesPollyByFunction,
      functionToFunctionInvokes,
    }),
    "utf-8"
  );
  console.log(
    `Generated: ${path.relative(repoRoot, outputPath)} (${functionNames.length} functions, ${edges.length} resource edges)`
  );
}

function renderMarkdown({
  httpRoutes,
  websocketRoutes,
  functionNames,
  resourceNodeByEnvValue,
  edges,
  usesPollyByFunction,
  functionToFunctionInvokes,
}) {
  let body = "# サーバレス構成図（自動生成）\n\n";
  body +=
    "このファイルは`backend/serverless.yml`のfunctions/resources定義、および各Lambda関数の" +
    "コード（環境変数参照・Polly呼び出しの検出）から`scripts/docs/generate-serverless-architecture.js`" +
    "によって自動生成される。手動で編集しないこと。再生成するには" +
    "`node scripts/docs/generate-serverless-architecture.js`を実行する" +
    "（[issue #904](https://github.com/bamiyanapp/karuta/issues/904)）。\n\n" +
    "関数からリソースへの依存関係は、関数コード内の`process.env.<変数名>`参照を" +
    "静的に検出して導出している（AIによる意味解釈ではなく正規表現ベース）。" +
    "エクスポートされた関数が直接、または1階層のヘルパー関数（`関数名(...)`という" +
    "直接呼び出し構文）経由で参照している場合のみ検出でき、`array.map(helperFn)`の" +
    "ような関数の参照渡しは検出できない既知の制約がある。\n\n";
  body += "```mermaid\ngraph LR\n";
  body += "    Client[フロントエンド]\n";
  body += "    APIGW[API Gateway<br/>HTTP API]\n";
  body += "    WSGW[API Gateway<br/>WebSocket API]\n";
  body += "    Polly[(AWS Polly)]\n";

  const httpFunctionNames = new Set(httpRoutes.map((r) => r.functionName));
  const websocketFunctionNames = new Set(websocketRoutes.map((r) => r.functionName));

  for (const functionName of functionNames) {
    body += `    ${functionName}["${functionName}"]\n`;
  }
  for (const [, node] of resourceNodeByEnvValue) {
    body += `    ${node.id}[(${node.label})]\n`;
  }

  body += "\n";
  if (httpFunctionNames.size > 0) {
    body += "    Client -->|HTTP| APIGW\n";
  }
  if (websocketFunctionNames.size > 0) {
    body += "    Client -->|WebSocket| WSGW\n";
  }
  for (const functionName of functionNames) {
    if (httpFunctionNames.has(functionName)) {
      body += `    APIGW --> ${functionName}\n`;
    }
    if (websocketFunctionNames.has(functionName)) {
      body += `    WSGW --> ${functionName}\n`;
    }
  }
  for (const edge of edges) {
    const node = resourceNodeByEnvValue.get(edge.to);
    body += `    ${edge.from} --> ${node.id}\n`;
  }
  for (const functionName of usesPollyByFunction) {
    body += `    ${functionName} --> Polly\n`;
  }
  for (const invoke of functionToFunctionInvokes) {
    body += `    ${invoke.from} -->|非同期Invoke| ${invoke.to}\n`;
  }
  body += "```\n";
  return body;
}

main();
