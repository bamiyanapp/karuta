# DynamoDBオンデマンドバックアップ・復旧手順

常時有効なPITR（README.md「バックアップと復旧」参照、過去35日間の任意の時点に復旧可能）に加えて、本ドキュメントでは「特定のタイミングの状態を明示的に残す」ための手動バックアップと、その復旧手順を扱う。主な用途は、ブルーグリーンデプロイ導入（issue #1319、子issue #1320）のようなデータ層の構成変更作業の直前に、安全網として明示的なバックアップを取得することである。

## バックアップの取得

`.github/workflows/backup-dynamodb.yml`（`workflow_dispatch`）をGitHubのActionsタブから手動実行する。スマートフォンのGitHub Web/モバイルアプリから実行可能（開発環境の制約「スマホオンリー」参照）。

- 対象は5つのDynamoDBテーブル（`karuta-phrases`, `karuta-comments`, `karuta-polly-cache`, `karuta-quiz-rooms`, `karuta-quiz-room-connections`）
- 結果（各テーブルの成功/失敗・Backup ARN）はJob Summaryにテーブル形式で表示される
- 一部のテーブルで失敗した場合もJobはそれを明示して異常終了するが、成功したテーブルのバックアップはそのまま残る

## オンデマンドバックアップの保管・削除

PITRの継続的バックアップとは異なり、`aws dynamodb create-backup`で作成したオンデマンドバックアップは**自動削除されない**。不要になったバックアップは、ストレージコストが積み上がらないよう手動で削除する。

```
aws dynamodb delete-backup --backup-arn <Job Summaryに表示されたARN>
```

## 復旧手順（人間の判断が必要なため非自動化）

復旧（restore）は影響範囲が大きく、状況に応じた判断が必要なため、本リポジトリでは自動化していない。必要になった際は以下の手順で行う。

1. バックアップから**新しいテーブル**を作成する（既存テーブルの直接上書きはできない）。

   ```
   aws dynamodb restore-table-from-backup \
     --backup-arn <復旧したいバックアップのARN> \
     --target-table-name <一時的な新テーブル名（例: karuta-phrases-restored）>
   ```

2. 復旧した新テーブルの内容を確認する。

3. 本番テーブルへの切り替え方法は、状況（データ破損の範囲、`backend/serverless.yml`のCloudFormation管理との整合）に応じて以下のいずれかを選ぶ。いずれの方法も本番トラフィックに影響するため、実行前に必ず状況をユーザーへ報告し、承認を得る。
   - 影響範囲が限定的な場合: 破損したレコードのみを新テーブルから本番テーブルへ個別に書き戻す
   - 全面的な復旧が必要な場合: `backend/serverless.yml`のテーブル名を一時的に差し替えてデプロイするか、CloudFormationのリソースインポート手順（issue #1320のデータ層移管で使う仕組みと同様）でテーブルを入れ替える

## 関連issue

- #1320（ブルーグリーンデプロイ導入のデータ層分離。本バックアップ機構は、その移管作業前の安全網として整備した）
