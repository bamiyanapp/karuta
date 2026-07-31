#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { loadServerlessConfig, extractProviderEnvironment, extractFunctionEnvironment, listFunctionNames } = require("./serverless-yaml");

const repoRoot = path.resolve(__dirname, "..", "..");
const serverlessPath = path.join(repoRoot, "backend", "serverless.yml");
const configJsPath = path.join(repoRoot, "frontend", "src", "config.js");
const outputPath = path.join(repoRoot, "docs", "generated", "env-vars.md");

// frontend/src/config.jsの`import.meta.env.VITE_XXX`参照を抽出する。フォールバック値
// （`||`の右辺）が同じ行にあれば開発時の既定値として一緒に拾う
function extractFrontendEnvVars() {
  const content = fs.readFileSync(configJsPath, "utf-8");
  const exportBlocks = content.split(/^export const /m).slice(1);
  const results = [];
  for (const block of exportBlocks) {
    const nameMatch = block.match(/^(\w+)/);
    const viteVarMatch = block.match(/import\.meta\.env\.(VITE_\w+)/);
    if (!nameMatch || !viteVarMatch) {
      continue;
    }
    results.push({ constantName: nameMatch[1], envVarName: viteVarMatch[1] });
  }
  return results;
}

function renderBackendSection(providerEnv, functionEnvByName) {
  let body = "## backend（Lambda環境変数、serverless.yml）\n\n";
  body += "### provider.environment（全関数で共有）\n\n";
  body += "| 環境変数名 | 値 |\n";
  body += "| :--- | :--- |\n";
  for (const [name, value] of Object.entries(providerEnv)) {
    body += `| \`${name}\` | \`${value}\` |\n`;
  }

  const functionsWithOverrides = Object.entries(functionEnvByName).filter(([, env]) => Object.keys(env).length > 0);
  if (functionsWithOverrides.length > 0) {
    body += "\n### 関数固有の環境変数（上記に追加・上書き）\n\n";
    body += "| 関数名 | 環境変数名 | 値 |\n";
    body += "| :--- | :--- | :--- |\n";
    for (const [functionName, env] of functionsWithOverrides) {
      for (const [name, value] of Object.entries(env)) {
        const displayValue = typeof value === "object" ? JSON.stringify(value) : value;
        body += `| ${functionName} | \`${name}\` | \`${displayValue}\` |\n`;
      }
    }
  }
  body += "\n";
  return body;
}

function renderFrontendSection(frontendEnvVars) {
  let body = "## frontend（Vite環境変数、frontend/src/config.js）\n\n";
  body += "| 環境変数名 | 参照している定数 |\n";
  body += "| :--- | :--- |\n";
  for (const { constantName, envVarName } of frontendEnvVars) {
    body += `| \`${envVarName}\` | \`${constantName}\`（frontend/src/config.js） |\n`;
  }
  body += "\n";
  return body;
}

function main() {
  const config = loadServerlessConfig(serverlessPath);
  const providerEnv = extractProviderEnvironment(config);
  const functionNames = listFunctionNames(config);
  const functionEnvByName = {};
  for (const functionName of functionNames) {
    functionEnvByName[functionName] = extractFunctionEnvironment(config, functionName);
  }
  const frontendEnvVars = extractFrontendEnvVars();

  let body = "# 環境変数一覧（自動生成）\n\n";
  body +=
    "このファイルは`backend/serverless.yml`の`environment:`定義、および" +
    "`frontend/src/config.js`の`import.meta.env.VITE_*`参照から" +
    "`scripts/docs/generate-env-vars.js`によって自動生成される。手動で編集しないこと。" +
    "再生成するには`node scripts/docs/generate-env-vars.js`を実行する" +
    "（[issue #908](https://github.com/bamiyanapp/karuta/issues/908)）。\n\n" +
    "フラットな一覧であり、自然なグラフ構造を持たないため図式化の対象とはしない。\n\n";
  body += renderFrontendSection(frontendEnvVars);
  body += renderBackendSection(providerEnv, functionEnvByName);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, body, "utf-8");
  console.log(
    `Generated: ${path.relative(repoRoot, outputPath)} (${Object.keys(providerEnv).length} provider env vars, ${frontendEnvVars.length} frontend env vars)`
  );
}

main();
