#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..", "..");
const outputPath = path.join(repoRoot, "docs", "generated", "library-list.md");

const PACKAGES = [
  { label: "frontend", packageJsonPath: path.join(repoRoot, "frontend", "package.json") },
  { label: "backend", packageJsonPath: path.join(repoRoot, "backend", "package.json") },
  { label: "root（commitlint・semantic-release等の開発用）", packageJsonPath: path.join(repoRoot, "package.json") },
];

function loadDependencies(packageJsonPath) {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  const dependencies = Object.entries(pkg.dependencies || {}).map(([name, version]) => ({
    name,
    version,
    kind: "dependencies",
  }));
  const devDependencies = Object.entries(pkg.devDependencies || {}).map(([name, version]) => ({
    name,
    version,
    kind: "devDependencies",
  }));
  return [...dependencies, ...devDependencies].sort((a, b) => a.name.localeCompare(b.name));
}

function renderSection(label, deps) {
  let body = `## ${label}\n\n`;
  body += "| パッケージ | バージョン範囲 | 種別 |\n";
  body += "| :--- | :--- | :--- |\n";
  for (const dep of deps) {
    body += `| \`${dep.name}\` | \`${dep.version}\` | ${dep.kind} |\n`;
  }
  body += "\n";
  return body;
}

function main() {
  let body = "# ライブラリ一覧（自動生成）\n\n";
  body +=
    "このファイルは各パッケージの`package.json`から`scripts/docs/generate-library-list.js`によって" +
    "自動生成される。手動で編集しないこと。再生成するには`node scripts/docs/generate-library-list.js`を" +
    "実行する（[issue #906](https://github.com/bamiyanapp/karuta/issues/906)）。\n\n" +
    "フラットな依存パッケージ一覧であり、自然なグラフ構造を持たないため図式化の対象とはしない" +
    "（Renovateが依存更新PRを作成する運用のため、更新への追従はそちらに委ねる）。\n\n";

  let totalCount = 0;
  for (const { label, packageJsonPath } of PACKAGES) {
    const deps = loadDependencies(packageJsonPath);
    totalCount += deps.length;
    body += renderSection(label, deps);
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, body, "utf-8");
  console.log(`Generated: ${path.relative(repoRoot, outputPath)} (${totalCount} packages)`);
}

main();
