# canary運用状態

このファイルは`canary-status.yml`（1時間おきのスケジュール実行）が自動更新する。手動で編集しないこと。

最終更新日時: 2026-10-10T01:38:05Z。

| 項目 | 値 |
|---|---|
| canary_weight（canaryへ振り分ける割合） | 10% |
| force_stable（管理者ロールバック中か） | false |
| canary_queue_pending（反映待ちのマージがあるか） | true |
| canaryスタックが存在するか | true |
| 次回promote-canary.ymlのスケジュール実行予定（適用スケジュール） | 2026-10-10T17:37:00Z（毎日 UTC 17:37 / JST 02:37固定） |
| canaryの最終更新 | 2026-10-08T22:26:44.729000+00:00 |
| 次回promote-canary.yml実行時に昇格対象になる日時 | 2026-10-09T22:26:44Z（force_stable=falseかつstableがcanaryより新しくない場合） |

## キューイング中の変更

canary最終更新以降にmainへマージされたPRの一覧。これらは次回canary更新時にまとめて反映される。

- https://github.com/bamiyanapp/karuta/pull/1474
- https://github.com/bamiyanapp/karuta/pull/1473
- https://github.com/bamiyanapp/karuta/pull/1471
- https://github.com/bamiyanapp/karuta/pull/1469
- https://github.com/bamiyanapp/karuta/pull/1470
- https://github.com/bamiyanapp/karuta/pull/1466
- https://github.com/bamiyanapp/karuta/pull/1467
- https://github.com/bamiyanapp/karuta/pull/1465
- https://github.com/bamiyanapp/karuta/pull/1464
- https://github.com/bamiyanapp/karuta/pull/1463
- https://github.com/bamiyanapp/karuta/pull/1461
- https://github.com/bamiyanapp/karuta/pull/1460
- https://github.com/bamiyanapp/karuta/pull/1457
- https://github.com/bamiyanapp/karuta/pull/1456
- https://github.com/bamiyanapp/karuta/pull/1455
- https://github.com/bamiyanapp/karuta/pull/1454
