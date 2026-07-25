"use strict";

// eslint-plugin-sonarjsのrecommended設定は全ルールerror severityだが、既存コードに
// 一度に適用すると大量のエラーが発生し（複雑度の高い関数の即座のリファクタが必須に
// なってしまう）、SonarCloud導入検討（issue #806）が意図した「低コストな導入」から
// 外れる。warnへ一括ダウングレードして導入し、実際に手を入れる際の指標として使う
// （reusable-ci.ymlのcoverage_threshold・jscpdのduplication_thresholdと同様、
// 既定は非ゲート）。frontend/backendのeslint.config.jsに同一のロジックが重複していた
// ため共通化した（issue #815。dev-standardsへは切り出さず、frontend/backend間
// （karuta内部）に閉じた重複としてkaruta直下に置く。理由はeslint-sonarjs-warn.cjs
// 冒頭ではなくissue #815本文を参照）
function buildSonarjsWarnRules(sonarjsPlugin) {
  return Object.fromEntries(
    Object.entries(sonarjsPlugin.configs.recommended.rules).map(([rule, severity]) => [
      rule,
      Array.isArray(severity) ? ["warn", ...severity.slice(1)] : severity === "error" ? "warn" : severity,
    ])
  );
}

module.exports = { buildSonarjsWarnRules };
