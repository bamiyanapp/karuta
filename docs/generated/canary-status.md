# canary運用状態

このファイルは`canary-status.yml`（1日1回のスケジュール実行、issue #1597）が自動更新する。手動で編集しないこと。

最終更新日時: 2026-10-24 13:33:22 JST。

| 項目 | 値 |
|---|---|
| canary_weight（canaryへ振り分ける割合） | 10% |
| force_stable（管理者ロールバック中か） | false |
| canary_queue_pending（反映待ちのマージがあるか） | false |
| canaryスタックが存在するか | true |
| stableの最終更新 | 2026-10-24 03:59:48 JST |
| stableの配信中バージョン | 1.116.11 |
| canaryの最終更新 | 2026-10-24 04:03:49 JST |
| canaryの配信中バージョン | 1.118.0 |
| 本番昇格の条件を満たす日時（この日時を過ぎたcron発火で初めて昇格する） | 2026-10-25 00:03:49 JST以降 |
| 次回のpromote-canary.yml cron発火予定（発火しても上記条件未達なら何もしない） | 2026-10-25 00:00:00 JST |
| 直近のpromote-canary.yml実行 | [run 40014839389](https://github.com/bamiyanapp/karuta/actions/runs/40014839389)（2026-10-24 04:52:34 JST、結果: success） |

## canaryに反映済み・stable昇格待ちの変更

stableの最終更新からcanaryの最終更新までの間にmainへマージされたPRの一覧。これらはすでにcanary（canary_weightの割合）には反映済みだが、まだstable（残りの割合）には昇格していない。

- [#1884 feat(ci): canary/stableのNode.jsランタイム遅延を定期検知する](https://github.com/bamiyanapp/karuta/pull/1884)
- [#1881 feat(backend): /get-versionでNode.jsの実行パッチバージョンを返す](https://github.com/bamiyanapp/karuta/pull/1881)

## キューイング中の変更

canary最終更新以降にmainへマージされたPRの一覧。canaryにもまだ反映されていない。これらは次回canary更新時にまとめて反映される。

- [#1895 refactor(ci): backend URL解決をdev-standardsの共通actionへ置き換える](https://github.com/bamiyanapp/karuta/pull/1895)
