#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..", "..");
const frontendSrcDir = path.join(repoRoot, "frontend", "src");
const outputPath = path.join(repoRoot, "docs", "generated", "api-usage.md");

// HTTP APIの呼び出し箇所: `${API_BASE_URL}/<path>` 形式のテンプレートリテラルを検出する
const HTTP_CALL_RE = /\$\{API_BASE_URL\}\/([a-zA-Z0-9_-]+)/g;
// WebSocket APIの呼び出し箇所: `ws.send(JSON.stringify({ action: "<route>" ... }))` 形式を検出する
const WS_ACTION_RE = /\.send\(\s*JSON\.stringify\(\s*\{\s*action:\s*["'](\w+)["']/g;
// 呼び出し箇所付近（次の300文字以内）にあるHTTPメソッド指定を探す。見つからなければGET扱いにする
const METHOD_WINDOW_SIZE = 300;
const METHOD_RE = /method:\s*["'](get|post|put|patch|delete)["']/i;

function listSourceFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listSourceFiles(fullPath));
      continue;
    }
    if (!/\.(js|jsx)$/.test(entry.name) || /\.test\.(js|jsx)$/.test(entry.name)) {
      continue;
    }
    results.push(fullPath);
  }
  return results;
}

function extractHttpUsage(filePath, content) {
  const usages = [];
  let match;
  HTTP_CALL_RE.lastIndex = 0;
  while ((match = HTTP_CALL_RE.exec(content))) {
    const windowText = content.slice(match.index, match.index + METHOD_WINDOW_SIZE);
    const methodMatch = windowText.match(METHOD_RE);
    usages.push({
      file: path.relative(repoRoot, filePath),
      path: match[1],
      method: methodMatch ? methodMatch[1].toUpperCase() : "GET",
    });
  }
  return usages;
}

function extractWebsocketUsage(filePath, content) {
  const usages = [];
  let match;
  WS_ACTION_RE.lastIndex = 0;
  while ((match = WS_ACTION_RE.exec(content))) {
    usages.push({ file: path.relative(repoRoot, filePath), action: match[1] });
  }
  return usages;
}

function groupBy(items, keyFn) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(item);
  }
  return groups;
}

function renderHttpSection(httpUsages) {
  let body = "## HTTP APIの呼び出し箇所\n\n";
  body += "| パス | メソッド | 呼び出し元ファイル |\n";
  body += "| :--- | :--- | :--- |\n";
  const groups = groupBy(httpUsages, (u) => `${u.method} /${u.path}`);
  const sortedKeys = [...groups.keys()].sort();
  for (const key of sortedKeys) {
    const files = [...new Set(groups.get(key).map((u) => u.file))].sort();
    const [method, ...pathParts] = key.split(" ");
    body += `| \`${pathParts.join(" ")}\` | ${method} | ${files.map((f) => `\`${f}\``).join("<br>")} |\n`;
  }
  return body;
}

function renderWebsocketSection(wsUsages) {
  let body = "\n## WebSocket APIの呼び出し箇所\n\n";
  body += "`action`フィールドが、対応する[WebSocket API仕様書](./websocket-api.md)のルート名に対応する。\n\n";
  body += "| action | 呼び出し元ファイル |\n";
  body += "| :--- | :--- |\n";
  const groups = groupBy(wsUsages, (u) => u.action);
  const sortedKeys = [...groups.keys()].sort();
  for (const key of sortedKeys) {
    const files = [...new Set(groups.get(key).map((u) => u.file))].sort();
    body += `| \`${key}\` | ${files.map((f) => `\`${f}\``).join("<br>")} |\n`;
  }
  return body;
}

function renderMarkdown(httpUsages, wsUsages) {
  let body = "# API利用一覧（自動生成）\n\n";
  body +=
    "このファイルはfrontend側のAPI呼び出し箇所（`frontend/src`配下）を" +
    "`scripts/docs/generate-api-usage.js`で正規表現ベースに静的解析して自動生成される。" +
    "手動で編集しないこと。再生成するには`node scripts/docs/generate-api-usage.js`を実行する" +
    "（[issue #909](https://github.com/bamiyanapp/karuta/issues/909)）。\n\n" +
    "HTTPメソッドは呼び出し箇所付近に`method:`指定が見つからない場合はGETとみなす" +
    "（fetchの既定メソッドと同じ扱い）。\n\n";
  body += renderHttpSection(httpUsages);
  body += renderWebsocketSection(wsUsages);
  return body;
}

function main() {
  const files = listSourceFiles(frontendSrcDir);
  const httpUsages = [];
  const wsUsages = [];
  for (const filePath of files) {
    const content = fs.readFileSync(filePath, "utf-8");
    httpUsages.push(...extractHttpUsage(filePath, content));
    wsUsages.push(...extractWebsocketUsage(filePath, content));
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, renderMarkdown(httpUsages, wsUsages), "utf-8");
  console.log(
    `Generated: ${path.relative(repoRoot, outputPath)} (${httpUsages.length} HTTP call sites, ${wsUsages.length} WebSocket action call sites)`
  );
}

main();
