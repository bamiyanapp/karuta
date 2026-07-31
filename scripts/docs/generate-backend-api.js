#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { loadServerlessConfig, extractHttpApiRoutes } = require("./serverless-yaml");

const repoRoot = path.resolve(__dirname, "..", "..");
const serverlessPath = path.join(repoRoot, "backend", "serverless.yml");
const outputPath = path.join(repoRoot, "docs", "generated", "backend-api.md");

function renderMarkdown(routes) {
  let body = "# Backend API仕様書（自動生成）\n\n";
  body +=
    "このファイルは`backend/serverless.yml`のhttpApiイベント定義から" +
    "`scripts/docs/generate-backend-api.js`によって自動生成される。手動で編集しないこと。" +
    "再生成するには`node scripts/docs/generate-backend-api.js`を実行する" +
    "（[issue #901](https://github.com/bamiyanapp/karuta/issues/901)）。\n\n";
  body += "| 関数名 | パス | メソッド | ハンドラー |\n";
  body += "| :--- | :--- | :--- | :--- |\n";
  for (const route of routes) {
    body += `| ${route.functionName} | \`/${route.path}\` | ${route.method} | \`${route.handler}\` |\n`;
  }
  return body;
}

function main() {
  const config = loadServerlessConfig(serverlessPath);
  const routes = extractHttpApiRoutes(config).sort(
    (a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method)
  );

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, renderMarkdown(routes), "utf-8");
  console.log(`Generated: ${path.relative(repoRoot, outputPath)} (${routes.length} routes)`);
}

main();
