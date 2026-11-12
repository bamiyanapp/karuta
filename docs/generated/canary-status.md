# canary運用状態

このファイルは`promote-canary.yml`のstatus job（1日1回のスケジュール実行、issue #1809）が自動更新する。手動で編集しないこと。

最終更新日時: 2026-11-13 06:55:17 JST。

| 項目 | 値 |
|---|---|
| canary_weight（canaryへ振り分ける割合） | 10% |
| force_stable（管理者ロールバック中か） | false |
| canary_queue_pending（反映待ちのマージがあるか） | false |
| canaryスタックが存在するか | true |
| stableの最終更新 | 2026-11-11 06:17:30 JST |
| stableの配信中バージョン | 1.123.0 |
| canaryの最終更新 | 2026-11-13 06:51:14 JST |
| canaryの配信中バージョン | 1.123.2 |
| 本番昇格の条件を満たす日時（この日時を過ぎたcron発火で初めて昇格する） | 2026-11-14 02:51:14 JST以降 |
| 次回のpromote-canary.yml cron発火予定（発火しても上記条件未達なら何もしない） | 2026-11-14 00:00:00 JST |
| 直近のpromote-canary.yml実行 | [run 43314628459](https://github.com/bamiyanapp/karuta/actions/runs/43314628459)（2026-11-13 06:53:15 JST、結果: （取得できなかった）） |

## canaryに反映済み・stable昇格待ちの変更

stableの最終更新からcanaryの最終更新までの間にmainへマージされたPRの一覧。これらはすでにcanary（canary_weightの割合）には反映済みだが、まだstable（残りの割合）には昇格していない。

- [#2142 fix: iOSビルドjobでdev-standards submoduleを取得する](https://github.com/bamiyanapp/karuta/pull/2142)
- [#2140 fix: useQuizRoomAdminのハンドシェイク中表示アサーションをwaitForに変更する](https://github.com/bamiyanapp/karuta/pull/2140)

## キューイング中の変更

canary最終更新以降にmainへマージされたPRの一覧。canaryにもまだ反映されていない。これらは次回canary更新時にまとめて反映される。

（該当するPRが見つからなかった）
