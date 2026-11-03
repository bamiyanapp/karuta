# canary運用状態

このファイルは`promote-canary.yml`のstatus job（1日1回のスケジュール実行、issue #1809）が自動更新する。手動で編集しないこと。

最終更新日時: 2026-11-03 16:48:04 JST。

| 項目 | 値 |
|---|---|
| canary_weight（canaryへ振り分ける割合） | 10% |
| force_stable（管理者ロールバック中か） | false |
| canary_queue_pending（反映待ちのマージがあるか） | false |
| canaryスタックが存在するか | true |
| stableの最終更新 | 2026-10-31 04:56:47 JST |
| stableの配信中バージョン | 1.119.4 |
| canaryの最終更新 | 2026-11-03 16:43:27 JST |
| canaryの配信中バージョン | 1.119.5 |
| 本番昇格の条件を満たす日時（この日時を過ぎたcron発火で初めて昇格する） | 2026-11-04 12:43:27 JST以降 |
| 次回のpromote-canary.yml cron発火予定（発火しても上記条件未達なら何もしない） | 2026-11-04 00:00:00 JST |
| 直近のpromote-canary.yml実行 | [run 41597706331](https://github.com/bamiyanapp/karuta/actions/runs/41597706331)（2026-11-03 16:38:55 JST、結果: （取得できなかった）） |

## canaryに反映済み・stable昇格待ちの変更

stableの最終更新からcanaryの最終更新までの間にmainへマージされたPRの一覧。これらはすでにcanary（canary_weightの割合）には反映済みだが、まだstable（残りの割合）には昇格していない。

- [#2002 fix: self_refの取り残しを解消しdev-standards参照をv2.115.6へ統一する](https://github.com/bamiyanapp/karuta/pull/2002)
- [#1963 refactor: gameplayActivity.js/pdfExportStatus.jsのuseSyncExternalStoreパターンを共通ファクトリへ切り出す](https://github.com/bamiyanapp/karuta/pull/1963)
- [#1962 refactor: backend保守スクリプト群のDynamoDBクライアント初期化・ページング付きバックフィルを共通化](https://github.com/bamiyanapp/karuta/pull/1962)

## キューイング中の変更

canary最終更新以降にmainへマージされたPRの一覧。canaryにもまだ反映されていない。これらは次回canary更新時にまとめて反映される。

（該当するPRが見つからなかった）
