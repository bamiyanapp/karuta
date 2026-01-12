module.exports = {
  branches: ["release"],
  repositoryUrl: "https://github.com/bamiyanapp/karuta.git",
  plugins: [
    [
      "@semantic-release/commit-analyzer",
      {
        preset: "conventionalcommits",
        releaseRules: [
          // 小文字（正規）
          { type: "feat", release: "minor" },
          { type: "fix", release: "patch" },

          // 大文字対応
          { type: "Feat", release: "minor" },
          { type: "Fix", release: "patch" },
          { type: "Refactor", release: "patch" },

          // スラッシュ系（今ある履歴対応）
          { type: "Feat/fix", release: "patch" },
          { type: "Fix/tech", release: "patch" },

          // 明示的にリリースしない
          { type: "Docs", release: false },
          { type: "Chore", release: false }
        ],
        defaultReleaseType: "patch"
      }
    ],
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    [
      "@semantic-release/npm",
      {
        "npmPublish": false
      }
    ],
    [
      "@semantic-release/exec",
      {
        prepareCmd: "node scripts/convert-changelog-to-json.js"
      }
    ],
    [
      "@semantic-release/github",
      {
        "successComment": false,
        "failCommentCondition": false,
        "releasedLabels": false
      }
    ],
    [
      "@semantic-release/git",
      {
        assets: [
          "CHANGELOG.md",
          "frontend/src/changelog.json",
          "package.json",
          "package-lock.json"
        ],
        message:
          "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}"
      }
    ]
  ]
};
