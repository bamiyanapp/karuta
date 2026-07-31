"use strict";

const fs = require("fs");

// 指定した開始位置（`{`の位置）から、波括弧の対応（ネスト深度カウント）で
// ブロックの終端位置を探す。文字列・テンプレートリテラル内の波括弧は現状の
// コードベースでは常に対応が取れている（単体の`{`や`}`を含む文字列リテラルが
// 無いことを確認済み）ため、字句解析（トークナイズ）までは行わない素朴な
// カウントで実用上十分と判断した。
function findMatchingBraceEnd(content, firstBraceIndex) {
  let depth = 0;
  for (let i = firstBraceIndex; i < content.length; i++) {
    if (content[i] === "{") {
      depth++;
    } else if (content[i] === "}") {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }
  return -1;
}

// 開き括弧の位置から、括弧の対応（ネスト深度カウント）で引数リストの終端
// （対応する`)`）位置を探す。分割引数（例: `function f({ a, b }) {`）のように
// 引数リスト自体が`{`を含む場合、本体の開始位置（`{`）を引数リストの外側の
// `{`と取り違えないようにするため、まず引数リストの終端を確定させてから
// 関数本体の`{`を探す必要がある
function findMatchingParenEnd(content, openParenIndex) {
  let depth = 0;
  for (let i = openParenIndex; i < content.length; i++) {
    if (content[i] === "(") {
      depth++;
    } else if (content[i] === ")") {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }
  return -1;
}

// ハンドラーファイル（backend/handler.js等）を`exports.<name> = <関数>`の代入から
// 関数本体の終端を特定し、トップレベルの関数ブロックへ分割する。
// `exports.docClient = docClient;`のような単純な再エクスポート（代入直後に`{`が
// 続かない）は関数ではないため対象外とする。
//
// 単純な行ベースの「次のexports.行までを1ブロックとする」実装では、
// handler.jsのようにexportされた関数の間に非exportのヘルパー関数（例:
// synthesizePhraseAudio）が挟まる構成で、そのヘルパー部分を直前の関数の
// 本体だと誤認識してしまう問題があったため、波括弧の対応を実際に数える方式にした。
function splitExportsIntoBlocks(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const exportAssignmentRe = /^exports\.(\w+)\s*=\s*/gm;

  const blocks = new Map();
  let match;
  while ((match = exportAssignmentRe.exec(content))) {
    const name = match[1];
    const assignStart = match.index;
    const afterAssign = match.index + match[0].length;
    const firstBraceIndex = content.indexOf("{", afterAssign);
    // 代入値と`{`の間にセミコロンが挟まる場合（`{`が現れる前に文が終わっている）は、
    // 関数ではなく単純な値の再エクスポート（例: exports.docClient = docClient;）と
    // みなしスキップする
    if (firstBraceIndex === -1 || content.slice(afterAssign, firstBraceIndex).includes(";")) {
      continue;
    }

    const endIndex = findMatchingBraceEnd(content, firstBraceIndex);
    if (endIndex === -1) {
      continue;
    }
    blocks.set(name, content.slice(assignStart, endIndex + 1));
  }
  return blocks;
}

// `function <name>(...) { ... }` / `async function <name>(...) { ... }`形式の
// 非export（ファイル内限定）のトップレベル関数を抽出する。exportされた関数から
// 呼び出される内部ヘルパー（例: handler.jsのsynthesizePhraseAudio）を辿って
// 間接的な外部サービス呼び出し（Polly等）を検出する用途（issue #904）で使う。
function splitNamedFunctionsIntoBlocks(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const functionDeclarationRe = /^(?:async\s+)?function\s+(\w+)\s*\(/gm;

  const blocks = new Map();
  let match;
  while ((match = functionDeclarationRe.exec(content))) {
    const name = match[1];
    const declarationStart = match.index;
    // マッチの末尾（引数リストの開き括弧`(`自体）から、対応する`)`を探し、
    // 引数リストが分割引数（`{...}`）を含んでいてもその中の`{`を本体の
    // 開始位置と誤認識しないようにする
    const openParenIndex = match.index + match[0].length - 1;
    const closeParenIndex = findMatchingParenEnd(content, openParenIndex);
    if (closeParenIndex === -1) {
      continue;
    }
    const firstBraceIndex = content.indexOf("{", closeParenIndex);
    if (firstBraceIndex === -1) {
      continue;
    }
    const endIndex = findMatchingBraceEnd(content, firstBraceIndex);
    if (endIndex === -1) {
      continue;
    }
    blocks.set(name, content.slice(declarationStart, endIndex + 1));
  }
  return blocks;
}

module.exports = { splitExportsIntoBlocks, splitNamedFunctionsIntoBlocks };
