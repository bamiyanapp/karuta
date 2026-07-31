"use strict";

const REPO = "bamiyanapp/karuta";

// dev-standardsのenable_mermaid_render機構（issue #824/#837）が生成する事前レンダリング
// 画像を埋め込む共通ヘルパー。```mermaid```ブロックはPR差分ビュー・API経由でのファイル
// 取得等ではテキストのまま表示され図として確認できないため、<details>で折りたたんだ
// ソースの下に、`main`へのマージのたびに再レンダリングされる画像
// （docs-diagramsブランチのlatest/配下）を恒久的に埋め込む。README.mdの既存の
// 埋め込みパターン（System Architecture節等）と同じ構成にする。
//
// imageFileNameは、対象Markdownファイル内のmermaidブロックの出現順・総数から決まる
// （render-mermaid.jsの命名規則: `<basename>.png`。ブロックが複数ある場合のみ
// `<basename>-<出現順の連番、1始まり>.png`になる）。呼び出し側が自分の生成する
// ファイルに含まれるブロック数を把握しているため、ここでは名前をそのまま受け取る。
function renderMermaidWithEmbed({ mermaidSource, imageFileName, altText }) {
  let body = "<details>\n<summary>ソースを表示（mermaid記法）</summary>\n\n";
  body += "```mermaid\n" + mermaidSource.trimEnd() + "\n```\n\n";
  body +=
    "上記の```mermaid```ブロックはPR差分ビュー・API経由でのファイル取得等ではテキストの" +
    "まま表示され図として確認できない（[#824](https://github.com/bamiyanapp/karuta/issues/824)）。" +
    "ソースはこのまま維持しつつ、下記は`enable_mermaid_render` job" +
    "（[docs/cicd-pipeline-specification.md](../cicd-pipeline-specification.md)参照）が" +
    "`main`へのマージのたびに再レンダリングし、`docs-diagrams`ブランチの`latest/`へ" +
    "上書き公開している画像（常に最新版）。\n\n";
  body += "</details>\n\n";
  body += `![${altText}](https://raw.githubusercontent.com/${REPO}/docs-diagrams/latest/${imageFileName})\n`;
  return body;
}

module.exports = { renderMermaidWithEmbed };
