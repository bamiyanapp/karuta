# Implementation Plan: 本番デプロイへのブルーグリーン（カナリア）方式導入

元issue: [bamiyanapp/karuta#1319](https://github.com/bamiyanapp/karuta/issues/1319)
タスクはGitHub Issues（#1319の子issue）で管理する。本ファイルはタスク一覧の索引と設計判断・リスクの記録のみを持つ。

## Overview

karutaの本番デプロイに、パッチ適用の残存リスクを低減するためのブルーグリーン（カナリア）方式を導入する。新バージョンを`canary`ステージへデプロイし、既定10%のトラフィックのみを振り向け、問題が無ければ1週間後に`stable`へ自動昇格する。フロントエンド（GitHub Pages→S3+CloudFront移行）・バックエンド（`osls`の並行stage）の両方が対象。詳細設計は#1319のコメント欄を正本とする。

## Architecture Decisions

- **ルーティングはサーバー側（CloudFront Functions）**。クライアント側抽選案はSPAのバージョン混在リスクのため撤回済み
- **独自ドメインは取得しない**。CloudFrontの既定ドメインのままとし、コストとのトレードオフでCloudFront Functions側にロジックを持たせる
- **IaCは既存のServerless Framework（CloudFormation）に統一**。`backend/serverless.yml`は既に`resources.Resources`でDynamoDB等をCloudFormation管理しているため、S3・CloudFront・CloudFront Functionsも同じ枠組みに追加する（新規IaCツール導入は避ける）
- **ステージ名は役割名（`stable`/`canary`）で固定**。色（blue/green）を毎回交換する管理は行わない
- **DynamoDB等のステートフルリソースは`stable`/`canary`で共有**。デプロイ用stage（`sls:stage`）とは独立した固定の"dataStage"（例: `prod`）でテーブル名を解決する
- **sticky CookieでSPAの整合性を担保**。per-requestの再抽選は行わない
- **「リロードで戻る」は不採用**。ErrorBoundary連動の自動フォールバック＋手動切り替えリンクに置き換え（#1319コメントでユーザー合意済み）

## Task List

GitHub Issuesで管理（#1319の子issue）。

### Phase 0: 基盤（データ層の分離・最小インフラ）
- [ ] Task 1: serverless.ymlのdataStage分離 — [#1320](https://github.com/bamiyanapp/karuta/issues/1320)
- [ ] Task 2: S3+CloudFront最小インフラ（IaC、手動確認） — [#1321](https://github.com/bamiyanapp/karuta/issues/1321)
- [ ] Task 3: CloudFront Functions重み付けルーティング＋KVS — [#1322](https://github.com/bamiyanapp/karuta/issues/1322)

### Checkpoint 0
- [ ] stable/canary2つの静的ビルドを手動配置し、CloudFront経由で意図した比率に振り分けられることを確認

### Phase 1: バックエンド並行スタック
- [ ] Task 4: osls並行stageデプロイ対応 — [#1323](https://github.com/bamiyanapp/karuta/issues/1323)
- [ ] Task 5: フロントエンドビルドへのstage別APIベースURL埋め込み — [#1324](https://github.com/bamiyanapp/karuta/issues/1324)

### Checkpoint 1
- [ ] canaryスタックへ実際にリクエストが届き、stableと独立して動作することを確認

### Phase 2: CI/CDパイプライン統合
- [ ] Task 6: CDワークフローのcanaryデプロイフロー新設 — [#1325](https://github.com/bamiyanapp/karuta/issues/1325)
- [ ] Task 7: カナリア直列化（同時1件・キュー待ち） — [#1326](https://github.com/bamiyanapp/karuta/issues/1326)

### Checkpoint 2
- [ ] 実際のPRマージでcanaryへの自動デプロイが走ることを確認

### Phase 3: ロールバック体験（フロントエンド）
- [ ] Task 8: sticky Cookie動作のフロントエンド側確認 — [#1327](https://github.com/bamiyanapp/karuta/issues/1327)
- [ ] Task 9: ErrorBoundary連動の自動フォールバック — [#1328](https://github.com/bamiyanapp/karuta/issues/1328)
- [ ] Task 10: 手動切り替えリンク — [#1329](https://github.com/bamiyanapp/karuta/issues/1329)

### Checkpoint 3
- [ ] canary版で意図的にエラーを起こし、自動的にstableへ切り替わることを確認

### Phase 4: 運用自動化
- [ ] Task 11: 管理者ロールバック（force_stableフラグ） — [#1330](https://github.com/bamiyanapp/karuta/issues/1330)
- [ ] Task 12: 1週間後の自動昇格スケジュールワークフロー — [#1331](https://github.com/bamiyanapp/karuta/issues/1331)

### Checkpoint 4
- [ ] ロールバック・自動昇格をそれぞれ手動トリガーで動作確認

### Phase 5: 移行・運用規律
- [ ] Task 13: 旧URL（GitHub Pages）の移行ページ — [#1332](https://github.com/bamiyanapp/karuta/issues/1332)
- [ ] Task 14: DynamoDBスキーマ互換性ガイドラインのドキュメント化 — [#1333](https://github.com/bamiyanapp/karuta/issues/1333)

### Checkpoint 5（完了条件）
- [ ] 旧URLアクセス時に新URLへ正しく誘導されることを確認
- [ ] 実際のトラフィックで意図通りのロールアウト・ロールバック・自動昇格が機能することを実環境で確認（#1319完了条件）

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| CloudFront Functionsの実行時間・機能制限により意図したロジックが書けない | High | Task 3で早期に技術検証（Phase 0、他タスクより前倒し） |
| DynamoDB共有によるスキーマ非互換で新旧コードが同時に壊れる | High | Task 14のガイドライン化＋各スキーマ変更時のレビューで担保（本プロジェクトの範囲外、継続的な規律） |
| 既存PWAユーザーのService Worker起因で移行ページが機能しない端末がある | Medium | Task 13で複数ブラウザ・実機検証を行う |
| カナリア直列化のキュー管理が複雑化し通常のデプロイ速度を落とす | Medium | Task 7はシンプルなロック機構から始め、必要に応じて拡張する |
| CloudFront移行によるコスト増（データ転送・リクエスト課金） | Low | 既にユーザーと合意済み。無料利用枠内に収まる見込み |

## Open Questions

- dev-standards側へ切り出せる共通部分があるか（本プロジェクト完了後に別途検討、スコープ外）
