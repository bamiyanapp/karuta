#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { loadServerlessConfig, extractDynamoDbTables } = require("./serverless-yaml");
const { renderMermaidWithEmbed } = require("./mermaid-embed");

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

const ATTRIBUTE_TYPE_LABEL = { S: "string", N: "number", B: "binary" };

// Mermaidのerディレクトリ図。DynamoDBはORMを介さずAWS SDKを直接呼び出す構成で
// 外部キー制約も無いため、テーブル間の関連（リレーション行）は描かず、各テーブルの
// 属性一覧（パーティションキー/ソートキー/GSIキー）のみをエンティティとして図示する。
// アプリケーションコード上の緩やかな関連（roomId等）は図ではなく後続の文章で補足する。
function renderErDiagram(tables) {
  let mermaidSource = "erDiagram\n";
  for (const table of tables) {
    mermaidSource += `    "${table.tableName}" {\n`;
    const keyTypeByAttribute = new Map(table.keySchema.map((k) => [k.attribute, k.keyType]));
    const gsiAttributeNames = new Set(
      table.globalSecondaryIndexes.flatMap((gsi) => gsi.keySchema.map((k) => k.attribute))
    );
    for (const attr of table.attributeDefinitions) {
      // メインのKeySchemaに属さず、GSIのキーとしてのみ使われる属性は、
      // 下のGSIループ側でまとめて出力するため、ここでは重複を避けてスキップする
      if (!keyTypeByAttribute.has(attr.attribute) && gsiAttributeNames.has(attr.attribute)) {
        continue;
      }
      const type = ATTRIBUTE_TYPE_LABEL[attr.type] || "string";
      const keyType = keyTypeByAttribute.get(attr.attribute);
      // MermaidのerDiagramが認識するキー種別はPK/FK/UKのみで、DynamoDBの
      // ソートキー（RANGE）に対応する"SK"は無効なトークンとしてパースエラーに
      // なる（実際にrender-mermaid-diagrams jobで発生）。ソートキーはPK/FK/UKの
      // いずれにも当たらないため、キー種別は付けずコメント注記のみで示す
      const parts = [type, attr.attribute];
      if (keyType === "HASH") {
        parts.push("PK");
      } else if (keyType === "RANGE") {
        parts.push('"ソートキー"');
      }
      mermaidSource += `        ${parts.join(" ")}\n`;
    }
    for (const gsi of table.globalSecondaryIndexes) {
      for (const k of gsi.keySchema) {
        mermaidSource += `        string ${k.attribute} "GSI: ${gsi.indexName}"\n`;
      }
    }
    mermaidSource += "    }\n";
  }
  return renderMermaidWithEmbed({
    mermaidSource,
    imageFileName: "dynamodb-tables.png",
    altText: "DynamoDBテーブル ER図 (rendered)",
  });
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
  body += "## 属性一覧（ER図）\n\n";
  body += renderErDiagram(tables);
  body +=
    "\nテーブル間に外部キー制約は無いが、アプリケーションコード上は`roomId`が" +
    "`karuta-quiz-rooms`と`karuta-quiz-room-connections`（GSI `roomId-index`）を" +
    "またいで使われており、緩やかな関連を持つ（図には正式なリレーションとして描画しない）。\n";
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
