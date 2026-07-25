const js = require("@eslint/js");
const globals = require("globals");
const sonarjs = require("eslint-plugin-sonarjs");
const { buildSonarjsWarnRules } = require("../eslint-sonarjs-warn.cjs");

const sonarjsWarnRules = buildSonarjsWarnRules(sonarjs);

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
