"use strict";

const fs = require("fs");
const yaml = require("js-yaml");

// serverless.ymlはCloudFormationテンプレートのresourcesを含み、!GetAtt・!Subのような
// CloudFormation組み込み関数の短縮タグを使う。js-yamlの既定スキーマはこれらのタグを
// 知らずパースエラーになるため、値をそのまま`{ "Fn::<Tag>": <値> }`として保持するだけの
// 最小限のカスタムスキーマを用意する（本パーサーは静的なルート・テーブル定義の抽出が
// 目的で、組み込み関数の値解決自体は行わない。参照: issue #901/#902/#903）。
const INTRINSIC_TAGS = [
  "GetAtt",
  "Sub",
  "Ref",
  "Join",
  "Select",
  "Split",
  "FindInMap",
  "ImportValue",
  "If",
  "Equals",
  "Not",
  "And",
  "Or",
  "Condition",
];

const CLOUDFORMATION_SCHEMA = yaml.DEFAULT_SCHEMA.extend(
  INTRINSIC_TAGS.flatMap((tag) =>
    ["scalar", "sequence", "mapping"].map(
      (kind) =>
        new yaml.Type(`!${tag}`, {
          kind,
          construct: (data) => ({ [`Fn::${tag}`]: data }),
        })
    )
  )
);

function loadServerlessConfig(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  return yaml.load(raw, { schema: CLOUDFORMATION_SCHEMA });
}

const SELF_CUSTOM_VAR_RE = /\$\{self:custom\.([\w.]+)\}/g;

// serverless.ymlの`${self:custom.xxx}`変数参照（Serverless Framework独自の変数構文で
// CloudFormationの組み込み関数ではないため上記スキーマでは解決されない）を、
// customセクションの実際の値に置き換える。customの値自体が文字列でない場合や
// キーが見つからない場合は元の文字列のまま返す（値解決の失敗を静かに握りつぶさない）。
function resolveSelfCustomVariables(value, config) {
  if (typeof value !== "string") {
    return value;
  }
  return value.replace(SELF_CUSTOM_VAR_RE, (whole, keyPath) => {
    const resolved = keyPath
      .split(".")
      .reduce((acc, key) => (acc && typeof acc === "object" ? acc[key] : undefined), config.custom || {});
    return typeof resolved === "string" ? resolved : whole;
  });
}

// functions.<name>.eventsのうちhttp/websocketイベントを持つものを抽出する共通ロジック
function extractFunctionEvents(config, eventKey) {
  const functions = config.functions || {};
  const results = [];
  for (const [functionName, def] of Object.entries(functions)) {
    for (const event of def.events || []) {
      if (event[eventKey]) {
        results.push({ functionName, handler: def.handler, ...event[eventKey] });
      }
    }
  }
  return results;
}

function extractHttpApiRoutes(config) {
  return extractFunctionEvents(config, "http").map((entry) => ({
    functionName: entry.functionName,
    handler: entry.handler,
    path: entry.path,
    method: String(entry.method || "").toUpperCase(),
  }));
}

function extractWebsocketRoutes(config) {
  return extractFunctionEvents(config, "websocket").map((entry) => ({
    functionName: entry.functionName,
    handler: entry.handler,
    route: entry.route,
  }));
}

function extractDynamoDbTables(config) {
  const resources = (config.resources && config.resources.Resources) || {};
  const tables = [];
  for (const [resourceName, def] of Object.entries(resources)) {
    if (!def || def.Type !== "AWS::DynamoDB::Table") {
      continue;
    }
    const props = def.Properties || {};
    tables.push({
      resourceName,
      tableName: resolveSelfCustomVariables(props.TableName, config),
      attributeDefinitions: (props.AttributeDefinitions || []).map((a) => ({
        attribute: a.AttributeName,
        type: a.AttributeType,
      })),
      keySchema: (props.KeySchema || []).map((k) => ({
        attribute: k.AttributeName,
        keyType: k.KeyType,
      })),
      globalSecondaryIndexes: (props.GlobalSecondaryIndexes || []).map((gsi) => ({
        indexName: gsi.IndexName,
        keySchema: (gsi.KeySchema || []).map((k) => ({
          attribute: k.AttributeName,
          keyType: k.KeyType,
        })),
      })),
      timeToLive: props.TimeToLiveSpecification
        ? {
            attribute: props.TimeToLiveSpecification.AttributeName,
            enabled: !!props.TimeToLiveSpecification.Enabled,
          }
        : null,
    });
  }
  return tables;
}

function extractS3Buckets(config) {
  const resources = (config.resources && config.resources.Resources) || {};
  const buckets = [];
  for (const [resourceName, def] of Object.entries(resources)) {
    if (!def || def.Type !== "AWS::S3::Bucket") {
      continue;
    }
    const props = def.Properties || {};
    buckets.push({
      resourceName,
      bucketName: resolveSelfCustomVariables(props.BucketName, config),
    });
  }
  return buckets;
}

function listFunctionNames(config) {
  return Object.keys(config.functions || {});
}

// provider.environment（全関数で共有される環境変数）を、${self:custom.xxx}解決込みで返す
function extractProviderEnvironment(config) {
  const environment = (config.provider && config.provider.environment) || {};
  const resolved = {};
  for (const [key, value] of Object.entries(environment)) {
    resolved[key] = resolveSelfCustomVariables(value, config);
  }
  return resolved;
}

// functions.<name>.environment（関数固有の環境変数上書き）を返す。文字列値は
// ${self:custom.xxx}を解決し、CloudFormation組み込み関数（!GetAtt等）はそのまま
// `{ "Fn::GetAtt": "<論理ID>.<属性>" }`形式で返す（値解決はしない）
function extractFunctionEnvironment(config, functionName) {
  const def = (config.functions || {})[functionName] || {};
  const environment = def.environment || {};
  const resolved = {};
  for (const [key, value] of Object.entries(environment)) {
    resolved[key] = resolveSelfCustomVariables(value, config);
  }
  return resolved;
}

module.exports = {
  loadServerlessConfig,
  resolveSelfCustomVariables,
  extractHttpApiRoutes,
  extractWebsocketRoutes,
  extractDynamoDbTables,
  extractS3Buckets,
  listFunctionNames,
  extractFunctionEnvironment,
  extractProviderEnvironment,
};
