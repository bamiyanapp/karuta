"use strict";

const { splitExportsIntoBlocks } = require("./handler-blocks");

// backend/quizRoomHandler.js等のハンドラーファイルの各関数ブロックから、
// 振る舞い（権限ガード・ブロードキャスト有無）を正規表現で検出する。AIによる
// コード意味解釈ではなく、withRoleGuard()・broadcastToRoom()という既存の共通
// ヘルパー呼び出しパターンの有無を機械的に検出するだけの静的解析であり、
// これらのヘルパー名が変わった場合は追従が必要になる（issue #902）。
function extractHandlerBehavior(handlerSourcePath, functionNames) {
  const blocks = splitExportsIntoBlocks(handlerSourcePath);
  const behavior = {};
  for (const name of functionNames) {
    const block = blocks.get(name);
    if (!block) {
      continue;
    }
    const roleMatch = block.match(/withRoleGuard\(\s*["'](admin|participant)["']/);
    behavior[name] = {
      role: roleMatch ? roleMatch[1] : null,
      broadcasts: /broadcastToRoom\s*\(/.test(block),
    };
  }
  return behavior;
}

module.exports = { extractHandlerBehavior };
