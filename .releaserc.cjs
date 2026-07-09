// CIのmergeジョブが、dev-standardsのrelease-config.cjsをこのファイルと同じ
// ディレクトリへコピーしてから semantic-release を実行する
// （enable_shared_release_config: true。詳細はdev-standards/release-config.cjs参照）。
// ローカルで直接 npx semantic-release を実行する場合は、事前に
// `cp dev-standards/release-config.cjs .` を行うこと。
const { buildReleaseConfig } = require("./release-config.cjs");

module.exports = buildReleaseConfig({
  repositoryUrl: "https://github.com/bamiyanapp/karuta.git",
  gitAssets: ["CHANGELOG.md", "frontend/src/changelog.json", "package.json", "package-lock.json"],
  // 過去のコミット履歴対応（スラッシュ系のtype表記）
  extraReleaseRules: [
    { type: "Feat/fix", release: "patch" },
    { type: "Fix/tech", release: "patch" },
  ],
});
