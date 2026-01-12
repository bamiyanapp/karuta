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

## 環境変数
CI/CDパイプラインで使用される環境変数を以下に示します。

| 変数名 | 説明 | 例 |
|---|---|---|
| `AWS_ACCESS_KEY_ID` | AWSアカウントへのアクセスキーID | `AKI*****************` |
| `AWS_SECRET_ACCESS_KEY` | AWSアカウントへのシークレットアクセスキー | `****************************************` |
| `GITHUB_TOKEN` | GitHub APIへのアクセスに使用されるトークン | `ghp_**********************************` |
| `GEMINI_API_KEY` | 自動コーディングに用いるGeminiのトークン | `*********************************` |


# Release → Main 自動同期 PR（CI スキップ運用）について

このリポジトリでは、`release` ブランチと `main` ブランチの差分を  
**GitHub Actions により自動で Pull Request 作成 → 自動マージ** しています。

この PR は **コードレビューや CI を目的としない「同期専用 PR」** です。

そのため、通常の開発 PR とは異なるブランチ保護ルールが必要になります。

---

## 目的

- `release` ブランチでのリリース作業を `main` に安全に反映する
- semantic-release によるタグ管理を壊さない
- CI を走らせずに即時マージする
- Bot による完全自動運用を可能にする

---

## 前提

- `release` → `main` の PR は **GitHub Actions（Bot）** が作成
- 人間によるレビュー・修正は想定しない
- CI が不要、または `[skip ci]` が付与される

---

## 1. Auto-merge を有効化

**Settings → General → Pull Requests**

- ✅ Allow auto-merge

---
## GitHub Branch Protection Rules (`main` ブランチ)

**Settings → Rules → Rulesets**

`main` ブランチに対して、以下のルールを設定してください。

---

### 1. Pull Request マージの必須化

✅ **ON**

> main への直接 push を防ぎ、必ず PR 経由にする

---

### 2. レビュー関連（すべて OFF）

| 項目 | 設定 |
|---|---|
| Required approvals | **0** |
| Dismiss stale pull request approvals | OFF |
| Require review from specific teams | OFF |
| Require review from Code Owners | OFF |
| Require approval of the most recent reviewable push | OFF |
| Require conversation resolution before merging | OFF |

#### 理由

- Bot PR に人間レビューを要求すると **自動マージ不能**
- 同期目的のためレビュー自体が不要

---

### 3. ステータスチェック（CI）

❌ **Require status checks to pass** → OFF

#### 理由

- 同期 PR は CI を目的としない
- CI が存在しない / skip されるケースを許容するため

---

### 4. マージ方法の許可

✅ **Allow squash merging（推奨）**

❌ Allow merge commits  
❌ Allow rebase merging  

#### 理由

- `main` に不要な履歴を残さない
- 「同期」という意図が 1 コミットで明確になる
- semantic-release の解析が安定する

---

### 5. バイパスリスト（重要）

#### 推奨設定

以下のいずれかを **Bypass list** に追加してください。

- `github-actions[bot]`
- または 使用している GitHub App / Bot

#### 理由

- ブランチ制限を Bot が回避できないと PR 作成・マージに失敗する
