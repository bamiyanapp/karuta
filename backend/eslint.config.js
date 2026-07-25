const js = require("@eslint/js");
const globals = require("globals");
const sonarjs = require("eslint-plugin-sonarjs");

// eslint-plugin-sonarjsのrecommended設定は全ルールerror severityだが、
// 既存コードに対して一度に適用すると31件のエラーが発生し（複雑度の高い
// handler.js/quizRoomHandler.js/seed.js等の大規模なリファクタが即座に必須に
// なってしまう）、SonarCloud導入検討（issue #806）が意図した「低コストな導入」
// から外れる。warnへ一括ダウングレードして導入し、実際に手を入れる際の指標
// として使う（coverage_threshold・jscpdのduplication_thresholdと同様、
// 既定は非ゲート）
const sonarjsWarnRules = Object.fromEntries(
  Object.entries(sonarjs.configs.recommended.rules).map(([rule, severity]) => [
    rule,
    Array.isArray(severity) ? ["warn", ...severity.slice(1)] : severity === "error" ? "warn" : severity,
  ])
);

module.exports = [
  {
    ignores: ["coverage/**", "node_modules/**"],
  },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    plugins: { sonarjs },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-unused-vars": ["error", { args: "none" }],
      // ESLint組み込み。循環的複雑度の代替（issue #806）。sonarjsの
      // cognitive-complexityと閾値を揃え、両観点で警告する
      complexity: ["warn", 15],
      ...sonarjsWarnRules,
    },
  },
  {
    // vitestのテストファイルはESM構文(import/export)で書かれている
    files: ["**/*.test.js"],
    languageOptions: {
      sourceType: "module",
    },
  },
];
