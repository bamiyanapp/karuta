# canary運用状態

このファイルは`promote-canary.yml`のstatus job（1日1回のスケジュール実行、issue #1809）が自動更新する。手動で編集しないこと。

最終更新日時: 2026-11-20 07:49:33 JST。

| 項目 | 値 |
|---|---|
| canary_weight（canaryへ振り分ける割合） | 10% |
| force_stable（管理者ロールバック中か） | false |
| canary_queue_pending（反映待ちのマージがあるか） | false |
| canaryスタックが存在するか | true |
| stableの最終更新 | 2026-11-20 07:40:33 JST |
| stableの配信中バージョン | 1.127.0 |
| canaryの最終更新 | 2026-11-20 07:44:40 JST |
| canaryの配信中バージョン | 1.127.1 |
| 本番昇格の条件を満たす日時（この日時を過ぎたcron発火で初めて昇格する） | 2026-11-21 03:44:40 JST以降 |
| 次回のpromote-canary.yml cron発火予定（発火しても上記条件未達なら何もしない） | 2026-11-21 00:00:00 JST |
| 直近のpromote-canary.yml実行 | [run 44631311444](https://github.com/bamiyanapp/karuta/actions/runs/44631311444)（2026-11-20 07:43:44 JST、結果: failure） |

## canaryに反映済み・stable昇格待ちの変更

stableの最終更新からcanaryの最終更新までの間にmainへマージされたPRの一覧。これらはすでにcanary（canary_weightの割合）には反映済みだが、まだstable（残りの割合）には昇格していない。

- [#2274 fix(ci): カナリー定期実行のスキャン2種が毎日失敗する問題の、karuta側を直す (#2273)](https://github.com/bamiyanapp/karuta/pull/2274)
- [#2268 refactor: alert()を共有のトースト通知へ置き換え、no-alertを有効にする (#2190)](https://github.com/bamiyanapp/karuta/pull/2268)
- [#2263 refactor: Playwright設定を共有のbuildPlaywrightConfigへ置き換える (#2244)](https://github.com/bamiyanapp/karuta/pull/2263)
- [#2262 refactor: ルーム一覧の定期取得を共有のuseAutoRefreshへ置き換える (#2243)](https://github.com/bamiyanapp/karuta/pull/2262)

## キューイング中の変更

canary最終更新以降にmainへマージされたPRの一覧。canaryにもまだ反映されていない。これらは次回canary更新時にまとめて反映される。

（該当するPRが見つからなかった）
