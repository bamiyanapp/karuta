#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { loadServerlessConfig, extractWebsocketRoutes } = require("./serverless-yaml");

const repoRoot = path.resolve(__dirname, "..", "..");
const serverlessPath = path.join(repoRoot, "backend", "serverless.yml");
const outputPath = path.join(repoRoot, "docs", "generated", "websocket-api.md");

function renderMarkdown(routes) {
  let body = "# WebSocket API仕様書（自動生成）\n\n";
  body +=
    "このファイルは`backend/serverless.yml`のwebsocketイベント定義から" +
    "`scripts/docs/generate-websocket-api.js`によって自動生成される。手動で編集しないこと。" +
    "再生成するには`node scripts/docs/generate-websocket-api.js`を実行する" +
    "（[issue #902](https://github.com/bamiyanapp/karuta/issues/902)）。\n\n";
  body += "クイズ大会モードのリアルタイム通信（読み札・結果画面の同期、早押し判定等）に使う" +
    "API Gateway WebSocket API（`backend/quizRoomHandler.js`）のルート一覧。\n\n";
  body += "| ルート | 関数名 | ハンドラー |\n";
  body += "| :--- | :--- | :--- |\n";
  for (const route of routes) {
    body += `| \`${route.route}\` | ${route.functionName} | \`${route.handler}\` |\n`;
  }
  return body;
}

function main() {
  const config = loadServerlessConfig(serverlessPath);
  const routes = extractWebsocketRoutes(config);
  // $connect/$disconnectを先頭に、それ以外はルート名でソートする
  const specialRouteOrder = ["$connect", "$disconnect"];
  routes.sort((a, b) => {
    const aIndex = specialRouteOrder.indexOf(a.route);
    const bIndex = specialRouteOrder.indexOf(b.route);
    if (aIndex !== -1 || bIndex !== -1) {
      return (aIndex === -1 ? specialRouteOrder.length : aIndex) - (bIndex === -1 ? specialRouteOrder.length : bIndex);
    }
    return a.route.localeCompare(b.route);
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, renderMarkdown(routes), "utf-8");
  console.log(`Generated: ${path.relative(repoRoot, outputPath)} (${routes.length} routes)`);
}

main();
