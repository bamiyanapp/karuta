"use strict";

// issue #1320: serverless-data.ymlへCloudFormationのリソースインポートを実行する前の
// 安全確認。実際のAWS上のリソースの現在の構成が、serverless-data.ymlに書いた定義と
// 一致するかを読み取り専用APIのみで検証する（書き込み系の権限は不要）。
// .github/workflows/import-data-resources.ymlの`action: preview`から呼ばれる。
// serverless-data.ymlの定義を変更したら、このファイルのEXPECTED_TABLES等も
// 合わせて更新すること

const {
  DynamoDBClient,
  DescribeTableCommand,
  DescribeTimeToLiveCommand,
  DescribeContinuousBackupsCommand,
} = require("@aws-sdk/client-dynamodb");
const { S3Client, GetPublicAccessBlockCommand, GetBucketLifecycleConfigurationCommand } = require("@aws-sdk/client-s3");

const REGION = "ap-northeast-1";
const dynamoClient = new DynamoDBClient({ region: REGION });
const s3Client = new S3Client({ region: REGION });

// serverless-data.ymlのresources.Resourcesと一致させる
const EXPECTED_TABLES = [
  {
    tableName: "karuta-phrases",
    keySchema: [
      { AttributeName: "category", KeyType: "HASH" },
      { AttributeName: "id", KeyType: "RANGE" },
    ],
    attributeDefinitions: [
      { AttributeName: "category", AttributeType: "S" },
      { AttributeName: "id", AttributeType: "S" },
    ],
    billingMode: "PAY_PER_REQUEST",
    pitrEnabled: true,
    ttlAttribute: null,
    gsi: [],
  },
  {
    tableName: "karuta-comments",
    keySchema: [{ AttributeName: "id", KeyType: "HASH" }],
    attributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
    billingMode: "PAY_PER_REQUEST",
    pitrEnabled: true,
    ttlAttribute: null,
    gsi: [],
  },
  {
    tableName: "karuta-polly-cache",
    keySchema: [{ AttributeName: "id", KeyType: "HASH" }],
    attributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
    billingMode: "PAY_PER_REQUEST",
    pitrEnabled: true,
    ttlAttribute: "ttl",
    gsi: [],
  },
  {
    tableName: "karuta-quiz-rooms",
    keySchema: [{ AttributeName: "roomId", KeyType: "HASH" }],
    attributeDefinitions: [{ AttributeName: "roomId", AttributeType: "S" }],
    billingMode: "PAY_PER_REQUEST",
    // issue #1320コメント参照: TTLによる自動削除を前提とした一時データのみを
    // 保持するため、意図的にPITR対象外（README.md「バックアップと復旧」参照）
    pitrEnabled: false,
    ttlAttribute: "ttl",
    gsi: [],
  },
  {
    tableName: "karuta-quiz-room-connections",
    keySchema: [{ AttributeName: "connectionId", KeyType: "HASH" }],
    attributeDefinitions: [
      { AttributeName: "connectionId", AttributeType: "S" },
      { AttributeName: "roomId", AttributeType: "S" },
    ],
    billingMode: "PAY_PER_REQUEST",
    pitrEnabled: false, // karuta-quiz-roomsと同じ理由
    ttlAttribute: "ttl",
    gsi: [{ IndexName: "roomId-index", KeySchema: [{ AttributeName: "roomId", KeyType: "HASH" }] }],
  },
];

function sortByAttributeName(list) {
  return [...list].sort((a, b) => a.AttributeName.localeCompare(b.AttributeName));
}

// JSON.stringifyによる比較はオブジェクトキーの出現順序に依存してしまい、
// AWS SDKのレスポンスがプロパティを異なる順序で返すだけで誤って不一致と
// 判定してしまう（実際にPublicAccessBlockConfigurationで発生した）。
// キー順序に依存しない再帰的な比較を行う
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }
  if (typeof a === "object") {
    const aKeys = Object.keys(a).sort();
    const bKeys = Object.keys(b).sort();
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key, i) => key === bKeys[i] && deepEqual(a[key], b[key]));
  }
  return a === b;
}

async function verifyTable(expected) {
  const mismatches = [];

  const { Table } = await dynamoClient.send(new DescribeTableCommand({ TableName: expected.tableName }));

  if (
    !deepEqual(sortByAttributeName(Table.AttributeDefinitions), sortByAttributeName(expected.attributeDefinitions))
  ) {
    mismatches.push(`AttributeDefinitionsが一致しない（実際: ${JSON.stringify(Table.AttributeDefinitions)}）`);
  }
  if (!deepEqual(Table.KeySchema, expected.keySchema)) {
    mismatches.push(`KeySchemaが一致しない（実際: ${JSON.stringify(Table.KeySchema)}）`);
  }
  if (Table.BillingModeSummary?.BillingMode !== expected.billingMode) {
    mismatches.push(`BillingModeが一致しない（実際: ${Table.BillingModeSummary?.BillingMode}）`);
  }

  const actualGsi = (Table.GlobalSecondaryIndexes || []).map((g) => ({
    IndexName: g.IndexName,
    KeySchema: g.KeySchema,
  }));
  if (!deepEqual(actualGsi, expected.gsi)) {
    mismatches.push(`GlobalSecondaryIndexesが一致しない（実際: ${JSON.stringify(actualGsi)}）`);
  }

  const { TimeToLiveDescription } = await dynamoClient.send(
    new DescribeTimeToLiveCommand({ TableName: expected.tableName }),
  );
  const actualTtlEnabled = TimeToLiveDescription?.TimeToLiveStatus === "ENABLED";
  const expectedTtlEnabled = expected.ttlAttribute !== null;
  if (actualTtlEnabled !== expectedTtlEnabled) {
    mismatches.push("TimeToLiveSpecification.Enabledが一致しない");
  } else if (expectedTtlEnabled && TimeToLiveDescription.AttributeName !== expected.ttlAttribute) {
    mismatches.push("TimeToLiveSpecification.AttributeNameが一致しない");
  }

  const { ContinuousBackupsDescription } = await dynamoClient.send(
    new DescribeContinuousBackupsCommand({ TableName: expected.tableName }),
  );
  const actualPitr =
    ContinuousBackupsDescription?.PointInTimeRecoveryDescription?.PointInTimeRecoveryStatus === "ENABLED";
  if (actualPitr !== expected.pitrEnabled) {
    mismatches.push(`PointInTimeRecoveryEnabledが一致しない（実際: ${actualPitr}）`);
  }

  return { name: expected.tableName, mismatches };
}

async function verifyBucket(bucketName) {
  const mismatches = [];

  const { PublicAccessBlockConfiguration } = await s3Client.send(
    new GetPublicAccessBlockCommand({ Bucket: bucketName }),
  );
  const expectedPab = {
    BlockPublicAcls: true,
    BlockPublicPolicy: true,
    IgnorePublicAcls: true,
    RestrictPublicBuckets: true,
  };
  if (!deepEqual(PublicAccessBlockConfiguration, expectedPab)) {
    mismatches.push(`PublicAccessBlockConfigurationが一致しない（実際: ${JSON.stringify(PublicAccessBlockConfiguration)}）`);
  }

  const { Rules } = await s3Client.send(new GetBucketLifecycleConfigurationCommand({ Bucket: bucketName }));
  const actualRule = (Rules || [])[0];
  if (
    !actualRule ||
    actualRule.ID !== "ExpireEfudaPdfObjects" ||
    actualRule.Status !== "Enabled" ||
    actualRule.Expiration?.Days !== 1
  ) {
    mismatches.push(`LifecycleConfigurationが一致しない（実際: ${JSON.stringify(Rules)}）`);
  }

  return { name: bucketName, mismatches };
}

async function main() {
  const accountId = process.argv[2];
  if (!accountId) {
    console.error("Usage: node verify-data-resources.js <accountId>");
    process.exitCode = 1;
    return;
  }

  const results = [];
  for (const table of EXPECTED_TABLES) {
    results.push(await verifyTable(table));
  }
  results.push(await verifyBucket(`karuta-efuda-pdf-${accountId}`));

  let hasMismatch = false;
  console.log("| リソース | 結果 |");
  console.log("|---|---|");
  for (const r of results) {
    if (r.mismatches.length > 0) {
      hasMismatch = true;
      console.log(`| ${r.name} | ❌ ${r.mismatches.join(" / ")} |`);
    } else {
      console.log(`| ${r.name} | ✅ 一致 |`);
    }
  }

  if (hasMismatch) {
    process.exitCode = 1;
  }
}

main();
