# canary運用状態

このファイルは`promote-canary.yml`のstatus job（1日1回のスケジュール実行、issue #1809）が自動更新する。手動で編集しないこと。

最終更新日時: 2026-10-27 12:05:04 JST。

| 項目 | 値 |
|---|---|
| canary_weight（canaryへ振り分ける割合） | 10% |
| force_stable（管理者ロールバック中か） | false |
| canary_queue_pending（反映待ちのマージがあるか） | false |
| canaryスタックが存在するか | true |
| stableの最終更新 | 2026-10-27 11:56:33 JST |
| stableの配信中バージョン | 1.118.1 |
| canaryの最終更新 | 2026-10-27 12:00:47 JST |
| canaryの配信中バージョン | 1.119.2 |
| 本番昇格の条件を満たす日時（この日時を過ぎたcron発火で初めて昇格する） | 2026-10-28 08:00:47 JST以降 |
| 次回のpromote-canary.yml cron発火予定（発火しても上記条件未達なら何もしない） | 2026-10-28 00:00:00 JST |
| 直近のpromote-canary.yml実行 | [run 40440923419](https://github.com/bamiyanapp/karuta/actions/runs/40440923419)（2026-10-27 11:52:14 JST、結果: （取得できなかった）） |

## canaryに反映済み・stable昇格待ちの変更

stableの最終更新からcanaryの最終更新までの間にmainへマージされたPRの一覧。これらはすでにcanary（canary_weightの割合）には反映済みだが、まだstable（残りの割合）には昇格していない。

- [#1934 fix(frontend): カテゴリ取得リトライを指数バックオフ化し、canaryのコールドスタートに耐えるようにする](https://github.com/bamiyanapp/karuta/pull/1934)
- [#1927 fix(ci): dev-standards参照をv2.114.1へ更新する](https://github.com/bamiyanapp/karuta/pull/1927)
- [#1924 feat(ci): canary-status.ymlをreusable-canary-status.yml呼び出しへ移行する](https://github.com/bamiyanapp/karuta/pull/1924)
- [#1915 fix(ci): README.mdのdev-standardsバージョン表示を自動追従させる](https://github.com/bamiyanapp/karuta/pull/1915)

## キューイング中の変更

canary最終更新以降にmainへマージされたPRの一覧。canaryにもまだ反映されていない。これらは次回canary更新時にまとめて反映される。

（該当するPRが見つからなかった）
