#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..", "..");
const workflowsDir = path.join(repoRoot, ".github", "workflows");
const readmePath = path.join(repoRoot, "README.md");

const START_MARKER = "<!-- dev-standards-version:start -->";
const END_MARKER = "<!-- dev-standards-version:end -->";

// issue #1898。dev-standardsのバージョンは`.github/workflows/*.yml`各ファイルの
// `uses: bamiyanapp/dev-standards/...@vX.Y.Z`参照に分散しており、一覧できる場所が
// 無かった。全workflowファイルを走査し、参照されているバージョンを収集する
function collectDevStandardsVersions() {
  const versions = new Set();
  const files = fs.readdirSync(workflowsDir).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));
  for (const file of files) {
    const content = fs.readFileSync(path.join(workflowsDir, file), "utf-8");
    const matches = content.matchAll(/bamiyanapp\/dev-standards\/[^@\s]+@(v[0-9]+\.[0-9]+\.[0-9]+)/g);
    for (const match of matches) {
      versions.add(match[1]);
    }
  }
  return [...versions].sort();
}

// dev-standards#1144と同種の問題（バージョン不一致）をここでも検知する。
// 全ファイルで同一バージョンに揃っていることが前提の運用のため、
// 不一致を検知した場合はその旨を明示し、特定のバージョンに丸めない
function renderSection(versions) {
  if (versions.length === 0) {
    return "現在、`.github/workflows/`にdev-standards参照が見つかりませんでした。";
  }
  if (versions.length === 1) {
    return `現在採用しているdev-standardsのバージョンは**${versions[0]}**です。`;
  }
  return [
    "⚠️ `.github/workflows/`内でdev-standards参照バージョンが不一致です。以下のいずれかに揃える対応が必要です。",
    "",
    ...versions.map((v) => `- ${v}`),
  ].join("\n");
}

function updateReadme(sectionBody) {
  const readme = fs.readFileSync(readmePath, "utf-8");
  const startIndex = readme.indexOf(START_MARKER);
  const endIndex = readme.indexOf(END_MARKER);
  if (startIndex === -1 || endIndex === -1) {
    throw new Error(`README.mdに${START_MARKER}〜${END_MARKER}のマーカーが見つかりませんでした。`);
  }
  const before = readme.slice(0, startIndex + START_MARKER.length);
  const after = readme.slice(endIndex);
  const updated = `${before}\n${sectionBody}\n${after}`;
  fs.writeFileSync(readmePath, updated, "utf-8");
}

function main() {
  const versions = collectDevStandardsVersions();
  const sectionBody = renderSection(versions);
  updateReadme(sectionBody);
  console.log(`Updated README.md (dev-standards version: ${versions.length === 1 ? versions[0] : versions.join(", ") || "不明"})`);
}

if (require.main === module) {
  main();
}

module.exports = {
  collectDevStandardsVersions,
  renderSection,
};
