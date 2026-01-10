# CI/CD Pipeline Specification

本プロジェクトでは GitHub Actions を利用して CI/CD パイプラインを構築しています。

## Architecture

```mermaid
graph TD
    A[PR / Push] --> B[CI Workflow];
    B -->|Success| C[Auto Merge to main];
    C --> D[CI Workflow on main];
    D -->|Completed| E[CD Workflow];
    E -->|on release branch| F{Semantic Release};
    F --> G[Deploy Frontend to GitHub Pages];
    F --> H[Deploy Backend to AWS];
```

## 1. CI ワークフロー (`ci.yml`)
- **トリガー**:
  - `main` または `release` ブランチへのプッシュ
  - 全てのプルリクエスト
- **実行内容**:
  - `commitlint`: コミットメッセージが Conventional Commits 形式に従っているか検証
  - `frontend-test`: フロントエンドの Lint、ビルド、および Vitest によるテスト
  - `backend-test`: バックエンドの Vitest によるテスト
  - `merge`: PR の場合、テスト成功後に `main` ブランチへ自動マージ（Squash merge）

## 2. CD ワークフロー (`cd.yml`)
- **トリガー**:
  - `main` または `release` ブランチへのプッシュ
  - CI ワークフローの成功完了（`workflow_run`）
- **実行内容**:
  - `release`: `semantic-release` によるバージョン自動採番、タグ付け、および `CHANGELOG.md` の更新
  - `build-and-deploy-frontend`: フロントエンドをビルドし、GitHub Pages へデプロイ
  - `deploy-backend`: バックエンドを Serverless Framework を使用して AWS Lambda へデプロイ

## 3. リリース運用
- **リリース条件**:
  - `semantic-release` による実際のタグ付けとデプロイは、**`release` ブランチへのマージ（プッシュ）時にのみ**実行されます。
  - `main` ブランチは開発用であり、保護設定による権限エラーを避けるため、自動リリースはスキップされます。
- **リリースの手順**:
  1. 通常の開発は `main` ブランチに対して行い、PR を作成してマージします。
  2. リリースの準備ができたら、`main` ブランチを `release` ブランチにマージします。
  3. `release` ブランチでの CI 成功後、自動的にリリースおよびデプロイが行われます。
