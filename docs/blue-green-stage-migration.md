# 単一ステージ運用からstable/canaryへの移行手順

ブルーグリーンデプロイ導入（issue #1319）のTask 4（#1323）として、`backend/serverless.yml`を`stable`/`canary`それぞれ独立したCloudFormationスタックとして並行デプロイできるようにした。本ドキュメントは、現行の単一ステージ運用から新しい構成へ移行する手順を記す。

## 現状

明示的な`--stage`指定無しで`osls deploy`を実行しているため、Serverless Frameworkの既定値であるstage `dev`として稼働している。スタック名は`karuta-app-dev`であり、フロントエンド（`frontend/src/config.js`の`API_BASE_URL`/`WS_BASE_URL`）はこの`dev`ステージのAPI Gateway/WebSocket APIのURLを指している。

## 移行後の構成

`stable`・`canary`という名前のstageで、それぞれ独立したCloudFormationスタック（`karuta-app-stable`・`karuta-app-canary`）を持つ。両スタックとも、DynamoDBテーブル等のステートフルリソース（issue #1320で`serverless-data.yml`へ分離済み）は共有する。`backend/serverless.yml`自体にはコード変更が不要で、`--stage`の値を変えるだけで独立したデプロイ単位になる。

## なぜコード変更が不要か

`backend/serverless.yml`のテーブル名・バケット名（`custom.tableName`等）は固定文字列で、stage名を含まない。IAMポリシー・Lambda関数の環境変数もこれらの固定文字列を直接参照している。そのため、どのstageにデプロイしても同じDynamoDBテーブル・S3バケットを参照する。Lambda関数名・API Gateway自体はServerless Frameworkの既定命名規則（`${service}-${stage}-...`）でstageごとに自動的に分離されるため、`stable`と`canary`は互いに影響しない。

## 移行手順

1. **`stable`・`canary`へ先行デプロイする**（本番トラフィックには影響しない）。`.github/workflows/deploy-backend-stage.yml`を`stage: stable`・`stage: canary`それぞれで手動実行する。
2. **両ステージが独立して動作することを確認する**。各stageの`osls info --stage <stage> --verbose`が出力するAPI Gatewayエンドポイントへ、それぞれ別々にリクエストを送り、正常に応答することを確認する。
3. **両ステージが同一のDynamoDBテーブルを共有していることを確認する**。`.github/workflows/verify-stage-data-sharing.yml`を手動実行する。`stable`経由で投稿したコメントが`canary`経由で読み取れることを確認し、検証用コメントは自動的に削除される。
4. **フロントエンドをstable/canary別のAPIベースURLでビルドできるようにする**（Task 5、issue #1324）。
5. **CDワークフローへ`canary`ステージへの自動デプロイを追加する**（Task 6、issue #1325）。issue本文は「mainへのマージ時はcanaryステージへのみデプロイする」と書かれているが、この時点では`stable`への本番カットオーバー（手順6）がまだ完了していない。既存のdevステージ・GitHub Pagesへの自動デプロイを停止すると、カットオーバーが完了するまで本番がmainの変更を一切受け取れなくなってしまう。この点を実装方針としてユーザーに確認し、既存のdev/GitHub Pagesデプロイはそのまま残し、`canary`ステージへのデプロイを並行して追加する方針を採用した（承認済み）。`stable`ステージは本タスクのデプロイでは一切変更しない。
6. **`stable`への初回切り替え**。フロントエンドの本番ビルド（GitHub Pagesまたは新インフラ、issue #1321参照）が指すAPIエンドポイントを、旧`dev`スタックから新しい`stable`スタックのエンドポイントへ切り替える。この切り替えは本番トラフィックに直接影響するため、実行前に必ずユーザーへ報告し承認を得る。
7. **旧`dev`スタックの削除**。`stable`への切り替えが完全に完了し、問題が無いことを十分な期間確認したのち、`npx osls remove --stage dev`で旧スタックを削除する。DynamoDBテーブル等のステートフルリソースは`serverless-data.yml`側で管理されており、この削除では影響を受けない。

手順6〜7は、それぞれ対応する後続issueが完了してから着手する。現時点（Task 6完了時点）では手順1〜5を実施済みで、`dev`スタックは本番として稼働を継続している。

### 補足: CDワークフローのcanaryデプロイ（Task 6）

`cd.yml`へ、既存の`deploy-backend`（devステージ）・`build-and-deploy-frontend`（GitHub Pages）ジョブと並行して以下のジョブを追加した。

- `deploy-backend-canary`: `npx osls deploy --stage canary`。DynamoDBテーブルは全ステージ共有のため、DBシードは`deploy-backend`ジョブの実行で十分であり重複実行しない
- `build-and-deploy-frontend-canary`: `npm run build:canary`のビルド成果物をS3バケットの`canary/`プレフィックス配下へ`aws s3 sync --delete`する。バケットは`infra/serverless.yml`（スタック名`karuta-infra-shared`）で定義したものを使う。対象パスのみCloudFrontキャッシュを無効化する（`DefaultCacheBehavior`が`CachingOptimized`のため、無効化しないと最大24時間反映が遅れる）。

### 補足: フロントエンドのstage別ビルド（Task 5）

`frontend/src/config.js`はもともと`import.meta.env.VITE_API_BASE_URL`/`VITE_WS_BASE_URL`が未設定の場合に`dev`ステージのURLへフォールバックする実装だった。そのため、Viteのmode別envファイル機能で値を切り替えるだけで対応でき、コード変更は不要だった。

- `frontend/.env.stable`・`frontend/.env.canary`: それぞれのステージのAPIベースURL・WebSocketベースURLを定義
- `npm run build:stable` / `npm run build:canary`（`vite build --mode <stage>`）: 対応するビルドを生成
- 既存の`npm run build`（mode未指定）は従来どおり`dev`ステージを指すため、既存のビルドコマンド・CIには影響しない

### 補足: 管理者ロールバック（Task 11）

`.github/workflows/rollback-to-stable.yml`（`workflow_dispatch`）を手動実行すると、KVSの`force_stable`を`true`に設定し、既存の`canary` Cookie保持者も含めて全アクセスを`stable`へ強制的に切り替える。実行にはリポジトリへの書き込み権限とAWS認証情報（Secrets）が必要なため、誰でも実行できるわけではない。

通常運用への復帰（`force_stable`を`false`へ戻す操作）は、誤toggleを避けるため本workflowの対象外とする。Task 12（自動昇格）経由、または必要に応じて別途手動対応する。

## 関連issue

- #1319（親issue）
- #1320（データ層分離。本移行の前提）
- #1321, #1322（S3+CloudFrontインフラ・CloudFront Functions重み付けルーティング）
- #1324（Task 5、フロントエンドstage別APIベースURL）
- #1325（Task 6、CDワークフローのcanaryデプロイフロー新設）
- #1330（Task 11、管理者ロールバック）
