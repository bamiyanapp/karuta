#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { loadServerlessConfig, extractDynamoDbTables } = require("./serverless-yaml");

const repoRoot = path.resolve(__dirname, "..", "..");
const serverlessPath = path.join(repoRoot, "backend", "serverless.yml");
const outputPath = path.join(repoRoot, "docs", "generated", "dynamodb-tables.md");

function renderKeySchema(keySchema) {
  return keySchema.map((k) => `${k.attribute} (${k.keyType})`).join(", ");
}

function renderTableSection(table) {
  let section = `## ${table.tableName}\n\n`;
  section += `- リソース名（CloudFormation）: \`${table.resourceName}\`\n`;
  section += `- キースキーマ: ${renderKeySchema(table.keySchema)}\n`;
  if (table.globalSecondaryIndexes.length > 0) {
    for (const gsi of table.globalSecondaryIndexes) {
      section += `- GSI: \`${gsi.indexName}\`（${renderKeySchema(gsi.keySchema)}）\n`;
    }
  }
  if (table.timeToLive) {
    section += `- TTL: \`${table.timeToLive.attribute}\`属性（${table.timeToLive.enabled ? "有効" : "無効"}）\n`;
  }
  section += "\n";
  return section;
}

function renderMarkdown(tables) {
  let body = "# DynamoDBテーブル定義書（自動生成）\n\n";
  body +=
    "このファイルは`backend/serverless.yml`の`AWS::DynamoDB::Table`リソース定義から" +
    "`scripts/docs/generate-dynamodb-tables.js`によって自動生成される。手動で編集しないこと。" +
    "再生成するには`node scripts/docs/generate-dynamodb-tables.js`を実行する" +
    "（[issue #903](https://github.com/bamiyanapp/karuta/issues/903)）。\n\n" +
    "ORM（Prisma/TypeORM等）は使わずAWS SDKを直接呼び出す構成のため、外部キー制約に基づく" +
    "古典的なER図は対象外とし、各テーブルのキー構造のみを一覧化する。\n\n";
  for (const table of tables) {
    body += renderTableSection(table);
  }
  return body;
}

function main() {
  const config = loadServerlessConfig(serverlessPath);
  const tables = extractDynamoDbTables(config).sort((a, b) => a.tableName.localeCompare(b.tableName));

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, renderMarkdown(tables), "utf-8");
  console.log(`Generated: ${path.relative(repoRoot, outputPath)} (${tables.length} tables)`);
}

main();
