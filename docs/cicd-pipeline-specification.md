# CI/CD Pipeline Specification（karuta固有）

本プロジェクトの CI/CD は [dev-standards の共通パイプライン仕様](../dev-standards/docs/cicd-pipeline-specification.md)（`reusable-ci.yml` / `reusable-cd.yml`）をベースに構築されている。

ワークフローの共通ジョブ構成およびリリース運用については上記ドキュメントを参照すること。本ドキュメントには karuta 固有の内容のみを記載する。

## Architecture

```mermaid
graph TD
    A[PR] --> B[CI Workflow];
    B --> C[frontend-test / backend-test];
    C -->|Success| D[merge job: 作業ブランチ上でSemantic Release実行];
    D --> E[merge job: mainへSquash merge、タグ付け替え];
    E --> F[CD Workflow on main push];
    F --> G{HEADのタグからリリース検知};
    G --> H[Deploy Frontend to GitHub Pages];
    G --> I[Deploy Backend to AWS];
```

## ⚠️ PRは必ずCIのBot自動マージに任せること（人手でのマージ禁止）

Semantic Releaseの実行は、CI（`reusable-ci.yml`の`merge`ジョブ）がPRの自動マージ処理の中で行う。このジョブは`pull_request`イベントでのみ起動するため、**人がGitHub UI上で直接「Merge pull request」を押してPRをマージすると、`merge`ジョブが実行される機会がなくなりSemantic Releaseが一切走らない**。その結果、リリースタグが作られずCD側の「HEADのタグからリリース検知」が常に空振りし、`build-and-deploy-frontend`・`deploy-backend`（DynamoDBの`seed.js`同期を含む）が黙ってスキップされ続ける。CIの各ジョブ自体は成功扱いになるため、この状態は気づきにくい。

- PRのCIが通過したら、GitHub UI上で自分でマージボタンを押さず、CIのBot（`merge`ジョブ）による自動マージを待つこと。
- 万一、人手マージによりリリースが滞留した場合は、（内容を問わない）任意の新規PRを作成しBot自動マージさせることで、そのマージ時点で未リリースの全コミットがまとめてリリースされ、デプロイが追いつく。

## デプロイジョブ（`cd.yml` 固有）

`release` ジョブ（共通、dev-standards の `reusable-cd.yml`）の成功後、`needs.release.outputs.new_release_published == 'true'` の場合のみ以下を実行する。

- `build-and-deploy-frontend`: frontend をビルドし、GitHub Pages へデプロイ
- `deploy-backend`: backend を Serverless Framework を使用して AWS Lambda へデプロイし、`seed.js` でシードを実行する

## 環境変数（karuta固有）

共通の `GITHUB_TOKEN` / `BOT_TOKEN`（[dev-standards参照](../dev-standards/docs/cicd-pipeline-specification.md#共通の環境変数)）に加え、以下を使用する。

| 変数名 | 説明 | 例 |
|---|---|---|
| `AWS_ACCESS_KEY_ID` | AWSアカウントへのアクセスキーID | `AKI*****************` |
| `AWS_SECRET_ACCESS_KEY` | AWSアカウントへのシークレットアクセスキー | `****************************************` |
