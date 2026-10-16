# canary運用状態

このファイルは`canary-status.yml`（1日1回のスケジュール実行、issue #1597）が自動更新する。手動で編集しないこと。

最終更新日時: 2026-10-17 08:26:10 JST。

| 項目 | 値 |
|---|---|
| canary_weight（canaryへ振り分ける割合） | 10% |
| force_stable（管理者ロールバック中か） | false |
| canary_queue_pending（反映待ちのマージがあるか） | true |
| canaryスタックが存在するか | true |
| stableの最終更新 | 2026-10-17 03:44:30 JST |
| stableの配信中バージョン | 1.111.3 |
| canaryの最終更新 | 2026-10-17 03:48:12 JST |
| canaryの配信中バージョン | ⚠️ 不一致（backend: （取得できなかった） / frontend: 1.111.3） |
| 本番昇格の条件を満たす日時（この日時を過ぎたcron発火で初めて昇格する） | 2026-10-17 23:48:12 JST以降 |
| 次回のpromote-canary.yml cron発火予定（発火しても上記条件未達なら何もしない） | 2026-10-18 00:00:00 JST |
| 直近のpromote-canary.yml実行 | [run 38980907927](https://github.com/bamiyanapp/karuta/actions/runs/38980907927)（2026-10-17 08:20:32 JST、結果: success） |

## canaryに反映済み・stable昇格待ちの変更

stableの最終更新からcanaryの最終更新までの間にmainへマージされたPRの一覧。これらはすでにcanary（canary_weightの割合）には反映済みだが、まだstable（残りの割合）には昇格していない。

（該当するPRが見つからなかった）

## キューイング中の変更

canary最終更新以降にmainへマージされたPRの一覧。canaryにもまだ反映されていない。これらは次回canary更新時にまとめて反映される。

- [#1684 fix(ci): promote-canary.ymlの参照タグをv2.82.3へ更新する](https://github.com/bamiyanapp/karuta/pull/1684)
- [#1681 fix(ci): dev-standardsをv2.82.3へ更新し壊れたcanaryスタック自動削除を取り込む](https://github.com/bamiyanapp/karuta/pull/1681)
- [#1678 fix(ci): dev-standardsをv2.82.2へ更新しIAMロール伝播待ちリトライを取り込む](https://github.com/bamiyanapp/karuta/pull/1678)
