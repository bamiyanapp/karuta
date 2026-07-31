#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { loadServerlessConfig, extractWebsocketRoutes } = require("./serverless-yaml");
const { extractHandlerBehavior } = require("./handler-behavior");
const { renderMermaidWithEmbed } = require("./mermaid-embed");

const repoRoot = path.resolve(__dirname, "..", "..");
const serverlessPath = path.join(repoRoot, "backend", "serverless.yml");
const outputPath = path.join(repoRoot, "docs", "generated", "websocket-api.md");

const ROLE_LABEL = { admin: "管理者のみ", participant: "参加者のみ" };

function renderTable(routes, behavior) {
  let body = "| ルート | 関数名 | ハンドラー | 実行権限 | ブロードキャスト |\n";
  body += "| :--- | :--- | :--- | :--- | :--- |\n";
  for (const route of routes) {
    const b = behavior[route.functionName] || {};
    const role = ROLE_LABEL[b.role] || "制限なし";
    const broadcast = b.broadcasts ? "あり（ルーム内の全接続へ）" : "なし（呼び出し元のみ）";
    body += `| \`${route.route}\` | ${route.functionName} | \`${route.handler}\` | ${role} | ${broadcast} |\n`;
  }
  return body;
}

// クイズ大会モードの代表的な1ラウンド分の通信フロー。ルート一覧・実行権限・
// ブロードキャスト有無は静的解析（extractHandlerBehavior）で抽出できるが、
// 「どの順序で呼ばれるか」というライフサイクル全体の流れはコードの意味的な
// 理解が必要なため、quizRoomHandler.js・useQuizRoomSync.js（frontend側）の
// 読解に基づき手動で構成した（issue #902のコメントで留意点として明記済み）。
// ルート名・型自体が変わった場合はこのテンプレートも追従して更新が必要になる。
function renderSequenceDiagram() {
  // 別名"Participant"はMermaidのsequenceDiagram構文における予約語"participant"と
  // 衝突し、`Participant->>...`のようなメッセージ行がパースエラーになるため
  // （実際にrender-mermaid-diagrams jobで"Expecting 'ACTOR', got 'INVALID'"エラーが
  // 発生した）、予約語と衝突しない別名"Player"を使う
  const mermaidSource = `sequenceDiagram
    participant Admin as クライアント（管理者）
    participant Player as クライアント（参加者）
    participant GW as API Gateway (WebSocket)
    participant L as Lambda（quizRoomHandler）
    participant Room as ルーム内の全接続

    Admin->>GW: $connect（roomId・adminToken）
    GW->>L: connectQuizRoom
    Player->>GW: $connect（roomId）
    GW->>L: connectQuizRoom
    Player->>L: sync
    L-->>Player: 現在の状態（sync）
    Player->>L: setName
    L->>Room: participants（ブロードキャスト）
    Admin->>L: updateState（読み札の表示等）
    L->>Room: state（ブロードキャスト）
    Player->>L: buzz
    L->>Room: buzz（ブロードキャスト）
    Admin->>L: judgeBuzz
    alt 正解
        L->>Room: points（ブロードキャスト）
    else 不正解
        L->>Room: roundReset（ブロードキャスト）
    end
    Admin->>L: resetPoints
    L->>Room: points（リセット後、ブロードキャスト）
    Admin->>L: closeRoom
    L->>Room: roomClosed（ブロードキャスト）
    Player--)GW: $disconnect
    GW--)L: disconnectQuizRoom
    L->>Room: participants（ブロードキャスト）`;
  return renderMermaidWithEmbed({
    mermaidSource,
    imageFileName: "websocket-api.png",
    altText: "WebSocket API 通信フロー (rendered)",
  });
}

function renderMarkdown(routes, behavior) {
  let body = "# WebSocket API仕様書（自動生成）\n\n";
  body +=
    "このファイルは`backend/serverless.yml`のwebsocketイベント定義から" +
    "`scripts/docs/generate-websocket-api.js`によって自動生成される。手動で編集しないこと。" +
    "再生成するには`node scripts/docs/generate-websocket-api.js`を実行する" +
    "（[issue #902](https://github.com/bamiyanapp/karuta/issues/902)）。\n\n";
  body += "クイズ大会モードのリアルタイム通信（読み札・結果画面の同期、早押し判定等）に使う" +
    "API Gateway WebSocket API（`backend/quizRoomHandler.js`）のルート一覧。\n\n";
  body += renderTable(routes, behavior);
  body += "\n## 代表的な通信フロー（シーケンス図）\n\n";
  body +=
    "実行権限・ブロードキャスト有無は静的解析（`withRoleGuard`/`broadcastToRoom`呼び出しの検出）で" +
    "機械的に抽出しているが、下記の呼び出し順序自体はコードの意味的な理解に基づき構成したもので、" +
    "厳密な自動生成ではない点に留意する。\n\n";
  body += renderSequenceDiagram();
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

  // handlerは"quizRoomHandler.connectQuizRoom"形式（ファイル名.関数名）。
  // ファイルごとにグルーピングし、実行権限・ブロードキャスト有無を抽出する
  const functionNamesByFile = new Map();
  for (const route of routes) {
    const [fileBaseName, exportName] = route.handler.split(".");
    if (!functionNamesByFile.has(fileBaseName)) {
      functionNamesByFile.set(fileBaseName, []);
    }
    functionNamesByFile.get(fileBaseName).push(exportName);
  }
  const behavior = {};
  for (const [fileBaseName, exportNames] of functionNamesByFile) {
    const handlerSourcePath = path.join(repoRoot, "backend", `${fileBaseName}.js`);
    Object.assign(behavior, extractHandlerBehavior(handlerSourcePath, exportNames));
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, renderMarkdown(routes, behavior), "utf-8");
  console.log(`Generated: ${path.relative(repoRoot, outputPath)} (${routes.length} routes)`);
}

main();
