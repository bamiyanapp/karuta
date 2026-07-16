# CI/CD Pipeline Specification（karuta固有）

本プロジェクトの CI/CD は [dev-standards の共通パイプライン仕様](../dev-standards/docs/cicd-pipeline-specification.md)（`reusable-ci.yml` / `reusable-cd.yml`）をベースに構築されている。

ワークフローの共通ジョブ構成およびリリース運用については上記ドキュメントを参照すること。本ドキュメントには karuta 固有の内容のみを記載する。

## Architecture

```mermaid
graph TD
    A[PR] --> B[CI Workflow];
    B --> C[frontend-test / backend-test];
    C -->|Success| D[merge job: mainへSquash merge];
    D --> E[CD Workflow on main push];
    E --> F[release job: main上でSemantic Release実行];
    F --> G{新バージョンが発行されたか};
    G --> H[Deploy Frontend to GitHub Pages];
    G --> I[Deploy Backend to AWS];
```

semantic-releaseの実行は`main`へのpush後（CD側の`release`ジョブ）で行われる。以前はPRの作業ブランチ上でマージ前に実行する方式だったが、GitHub Actionsの`pull_request`イベントで自動設定される`GITHUB_REF`（ワークフローYAMLの`env:`では上書き不可）により常にリリースが発行されない不具合があったため、`main`への実pushイベント上で実行する方式に修正した（[dev-standards#43](https://github.com/bamiyanapp/dev-standards/pull/43)）。

karutaの`main`は「変更は必ずPR経由」のリポジトリルールで保護されているため、`release`ジョブによる`main`への直接pushはそのままではGH013エラーで拒否される。この問題に対応するため、直接pushが失敗した場合はローカルに作成済みのリリースコミットを新しいブランチへpushし、`main`へのPRを作成してAPI経由でsquash mergeするフォールバックが追加されている（[dev-standards#44](https://github.com/bamiyanapp/dev-standards/pull/44)、タグ名の導出方法の修正が[dev-standards#45](https://github.com/bamiyanapp/dev-standards/pull/45)、GitHub Release作成の冪等化が[dev-standards#46](https://github.com/bamiyanapp/dev-standards/pull/46)）。karuta運用者が意識する必要がある手順の違いはなく、`release`ジョブの結果として`new_release_published`が正しく出力されればデプロイジョブは通常どおり実行される。詳細は[dev-standards側ドキュメント](../dev-standards/docs/cicd-pipeline-specification.md#3-リリース運用)を参照。

## E2Eテスト（`ci.yml` 固有）

`frontend-e2e-test`ジョブ（共通、dev-standardsの`reusable-ci.yml`）は`enable_e2e_test: true`で有効化している（Playwright、`frontend/e2e/`配下）。

このリポジトリにはE2E専用のモックバックエンドが存在しないため、**E2Eテストは実際にデプロイ済みの本番相当AWS環境（`frontend/src/config.js`のAPI_BASE_URL/WS_BASE_URLが指すAPI Gateway・DynamoDB・WebSocket API）に対して実行する**。CI実行のたびに実際のクイズ大会モードのルームが作成されるが、ルームはDynamoDBのTTLにより24時間で自動失効するため、テスト実行のたびに残骸が蓄積し続けることはない。

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
