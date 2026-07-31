#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { loadServerlessConfig } = require("./serverless-yaml");

const repoRoot = path.resolve(__dirname, "..", "..");
const serverlessPath = path.join(repoRoot, "backend", "serverless.yml");
const outputPath = path.join(repoRoot, "docs", "generated", "external-services.md");

const AWS_SERVICE_LABELS = {
  dynamodb: "Amazon DynamoDB",
  polly: "Amazon Polly",
  lambda: "AWS Lambda",
  s3: "Amazon S3",
  "execute-api": "Amazon API Gateway（Management API、WebSocket接続へのブロードキャスト送信）",
};

// serverless.yml（CloudFormationテンプレートを含む）内の全てのIAMポリシーステートメントは
// `Action: <string|string[]>`という形で書かれる。オブジェクトツリー全体を再帰的に走査し、
// キー名が"Action"の値（配列または単一文字列）を全て集める。IAMステートメント以外に
// "Action"というキーが登場する箇所は本コードベースには無い。ただし
// `AssumeRolePolicyDocument`（Lambda実行ロールの信頼ポリシー、常に`sts:AssumeRole`のみを
// 含む定型文）は、backend自身がSTSを呼び出しているわけではないため対象から除外する
function collectIamActions(node, actions = []) {
  if (Array.isArray(node)) {
    for (const item of node) {
      collectIamActions(item, actions);
    }
    return actions;
  }
  if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      if (key === "AssumeRolePolicyDocument") {
        continue;
      }
      if (key === "Action") {
        const values = Array.isArray(value) ? value : [value];
        for (const action of values) {
          if (typeof action === "string") {
            actions.push(action);
          }
        }
        continue;
      }
      collectIamActions(value, actions);
    }
  }
  return actions;
}

function extractAwsServices(config) {
  const actions = collectIamActions(config);
  const servicesByPrefix = new Map();
  for (const action of actions) {
    const [prefix] = action.split(":");
    if (!servicesByPrefix.has(prefix)) {
      servicesByPrefix.set(prefix, new Set());
    }
    servicesByPrefix.get(prefix).add(action);
  }
  return [...servicesByPrefix.entries()]
    .map(([prefix, actionSet]) => ({
      prefix,
      label: AWS_SERVICE_LABELS[prefix] || prefix,
      actions: [...actionSet].sort(),
    }))
    .sort((a, b) => a.prefix.localeCompare(b.prefix));
}

// AWS以外の外部サービス依存は、AST解析よりもリポジトリ内の設定ファイルの存在・
// package.jsonのスクリプト内容から機械的に検出する（issue #907）
function extractNonAwsServices() {
  const services = [];

  if (fs.existsSync(path.join(repoRoot, ".github", "workflows"))) {
    services.push({ name: "GitHub Actions", detail: ".github/workflows配下のワークフロー（CI/CD）" });
  }
  if (fs.existsSync(path.join(repoRoot, "renovate.json"))) {
    services.push({ name: "Renovate", detail: "renovate.jsonによる依存関係更新PRの自動作成" });
  }

  const rootPackageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf-8"));
  if (rootPackageJson.devDependencies && rootPackageJson.devDependencies["semantic-release"]) {
    services.push({ name: "semantic-release", detail: "CD（reusable-cd.yml）でのバージョニング・リリースノート生成" });
  }

  const frontendPackageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "frontend", "package.json"), "utf-8"));
  if (frontendPackageJson.scripts && Object.values(frontendPackageJson.scripts).some((script) => script.includes("gh-pages"))) {
    services.push({ name: "GitHub Pages", detail: "frontend/package.jsonの`deploy`スクリプト（gh-pages）によるホスティング" });
  }

  return services;
}

function renderMarkdown(awsServices, nonAwsServices) {
  let body = "# 外部サービス一覧（自動生成）\n\n";
  body +=
    "このファイルは`backend/serverless.yml`のIAMポリシーステートメント（`Action`）、" +
    "および設定ファイルの存在・`package.json`のスクリプト内容から" +
    "`scripts/docs/generate-external-services.js`によって自動生成される。手動で編集しない" +
    "こと。再生成するには`node scripts/docs/generate-external-services.js`を実行する" +
    "（[issue #907](https://github.com/bamiyanapp/karuta/issues/907)）。\n\n";

  body += "## AWSサービス（IAM Actionから検出）\n\n";
  body += "| サービス | 使用するAction |\n";
  body += "| :--- | :--- |\n";
  for (const service of awsServices) {
    body += `| ${service.label} | ${service.actions.map((a) => `\`${a}\``).join(", ")} |\n`;
  }

  body += "\n## AWS以外の外部サービス（設定ファイル・スクリプトから検出）\n\n";
  body += "| サービス | 検出内容 |\n";
  body += "| :--- | :--- |\n";
  for (const service of nonAwsServices) {
    body += `| ${service.name} | ${service.detail} |\n`;
  }
  body +=
    "\n図式化については、依存元（どのLambda関数・ワークフローが依存するか）まで対応付けると" +
    "flowchartとして表現できるが、現状のサービス数・依存元数では表形式でも十分把握できるため、" +
    "優先度は低いものとして表形式に留める（issue #907のコメント参照）。\n";
  return body;
}

function main() {
  const config = loadServerlessConfig(serverlessPath);
  const awsServices = extractAwsServices(config);
  const nonAwsServices = extractNonAwsServices();

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, renderMarkdown(awsServices, nonAwsServices), "utf-8");
  console.log(
    `Generated: ${path.relative(repoRoot, outputPath)} (${awsServices.length} AWS services, ${nonAwsServices.length} non-AWS services)`
  );
}

main();
