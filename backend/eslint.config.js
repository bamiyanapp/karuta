const js = require("@eslint/js");
const globals = require("globals");
const sonarjs = require("eslint-plugin-sonarjs");
const n = require("eslint-plugin-n");

module.exports = [
  {
    ignores: ["coverage/**", "node_modules/**"],
  },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    plugins: { sonarjs, n },
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
      // cognitive-complexityと閾値を揃え、両観点でerrorとする（issue #856。
      // lintスクリプトの`--max-warnings 0`により、warn severityにしても
      // 実質errorと同じ強制力になっていたため、severity自体もerrorへ揃えた）
      complexity: ["error", 15],
      ...sonarjs.configs.recommended.rules,
      ...n.configs["flat/recommended"].rules,
      // n/no-unpublished-*はnpmへpublishするパッケージ（package.jsonの"files"で
      // 配布物を絞り込む想定）向けのルールで、Lambdaへ直接デプロイする非publish
      // パッケージであるbackendには当てはまらない。devDependencies
      // （vitest・eslint関連等）をテスト・設定ファイルからrequire/importする
      // だけで大量に誤検知するため無効化する
      "n/no-unpublished-import": "off",
      "n/no-unpublished-require": "off",
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
