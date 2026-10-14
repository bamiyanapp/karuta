# canary運用状態

このファイルは`canary-status.yml`（1日1回のスケジュール実行、issue #1597）が自動更新する。手動で編集しないこと。

最終更新日時: 2026-10-15 06:01:21 JST。

| 項目 | 値 |
|---|---|
| canary_weight（canaryへ振り分ける割合） | 100% |
| force_stable（管理者ロールバック中か） | false |
| canary_queue_pending（反映待ちのマージがあるか） | false |
| canaryスタックが存在するか | true |
| stableの最終更新 | 2026-10-14 08:52:09 JST |
| stableの配信中バージョン（backend） | 1.108.6 |
| stableの配信中バージョン（frontend） | 1.108.6 |
| canaryの最終更新 | 2026-10-14 08:56:16 JST |
| canaryの配信中バージョン（backend） | 1.108.6 |
| canaryの配信中バージョン（frontend） | 1.108.6 |
| 本番昇格の条件を満たす日時（この日時を過ぎたcron発火で初めて昇格する） | 2026-10-15 08:56:16 JST以降 |
| 次回のpromote-canary.yml cron発火予定（発火しても上記条件未達なら何もしない） | 2026-10-16 02:37:00 JST |
| 直近のpromote-canary.yml実行 | [run 38636158030](https://github.com/bamiyanapp/karuta/actions/runs/38636158030)（2026-10-15 05:55:38 JST、結果: （取得できなかった）） |

## canaryに反映済み・stable昇格待ちの変更

stableの最終更新からcanaryの最終更新までの間にmainへマージされたPRの一覧。これらはすでにcanary（canary_weightの割合）には反映済みだが、まだstable（残りの割合）には昇格していない。

（該当するPRが見つからなかった）

## キューイング中の変更

canary最終更新以降にmainへマージされたPRの一覧。canaryにもまだ反映されていない。これらは次回canary更新時にまとめて反映される。

- [#1620 chore(deps): update bamiyanapp/dev-standards action to v2.77.0](https://github.com/bamiyanapp/karuta/pull/1620)
- [#1619 chore(canary): canary運用状態を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1619)
- [#1618 chore(deps): update bamiyanapp/dev-standards action to v2.76.0](https://github.com/bamiyanapp/karuta/pull/1618)
