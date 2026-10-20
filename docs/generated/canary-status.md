# canary運用状態

このファイルは`canary-status.yml`（1日1回のスケジュール実行、issue #1597）が自動更新する。手動で編集しないこと。

最終更新日時: 2026-10-20 11:28:14 JST。

| 項目 | 値 |
|---|---|
| canary_weight（canaryへ振り分ける割合） | 10% |
| force_stable（管理者ロールバック中か） | false |
| canary_queue_pending（反映待ちのマージがあるか） | false |
| canaryスタックが存在するか | true |
| stableの最終更新 | 2026-10-20 05:31:16 JST |
| stableの配信中バージョン | 1.116.3 |
| canaryの最終更新 | 2026-10-20 05:35:13 JST |
| canaryの配信中バージョン | 1.116.6 |
| 本番昇格の条件を満たす日時（この日時を過ぎたcron発火で初めて昇格する） | 2026-10-21 01:35:13 JST以降 |
| 次回のpromote-canary.yml cron発火予定（発火しても上記条件未達なら何もしない） | 2026-10-21 00:00:00 JST |
| 直近のpromote-canary.yml実行 | [run 39319310464](https://github.com/bamiyanapp/karuta/actions/runs/39319310464)（2026-10-20 05:26:22 JST、結果: success） |

## canaryに反映済み・stable昇格待ちの変更

stableの最終更新からcanaryの最終更新までの間にmainへマージされたPRの一覧。これらはすでにcanary（canary_weightの割合）には反映済みだが、まだstable（残りの割合）には昇格していない。

- [#1799 fix(frontend): カテゴリ取得の一過性失敗によるfalse positiveエラーを解消](https://github.com/bamiyanapp/karuta/pull/1799)
- [#1794 fix(ci): canary-status.mdの反映済みPR一覧をバージョンタグベースで算出する](https://github.com/bamiyanapp/karuta/pull/1794)
- [#1786 fix(ci): canary-status.ymlをCD完了時にも再生成するようにする](https://github.com/bamiyanapp/karuta/pull/1786)

## キューイング中の変更

canary最終更新以降にmainへマージされたPRの一覧。canaryにもまだ反映されていない。これらは次回canary更新時にまとめて反映される。

（該当するPRが見つからなかった）
