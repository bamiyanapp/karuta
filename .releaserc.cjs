module.exports = {
  branches: ["main", "release"],
  repositoryUrl: "https://github.com/bamiyanapp/karuta",
  plugins: [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    "@semantic-release/npm",
    [
      "@semantic-release/exec",
      {
        prepareCmd: "node scripts/convert-changelog-to-json.js"
      }
    ],
    "@semantic-release/github",
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
