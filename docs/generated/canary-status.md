# canary運用状態

このファイルは`promote-canary.yml`のstatus job（1日1回のスケジュール実行、issue #1809）が自動更新する。手動で編集しないこと。

最終更新日時: 2026-11-18 07:56:15 JST。

| 項目 | 値 |
|---|---|
| canary_weight（canaryへ振り分ける割合） | 10% |
| force_stable（管理者ロールバック中か） | false |
| canary_queue_pending（反映待ちのマージがあるか） | false |
| canaryスタックが存在するか | true |
| stableの最終更新 | 2026-11-15 04:52:45 JST |
| stableの配信中バージョン | 1.123.5 |
| canaryの最終更新 | 2026-11-18 07:51:31 JST |
| canaryの配信中バージョン | 1.124.0 |
| 本番昇格の条件を満たす日時（この日時を過ぎたcron発火で初めて昇格する） | 2026-11-19 03:51:31 JST以降 |
| 次回のpromote-canary.yml cron発火予定（発火しても上記条件未達なら何もしない） | 2026-11-19 00:00:00 JST |
| 直近のpromote-canary.yml実行 | [run 44193565374](https://github.com/bamiyanapp/karuta/actions/runs/44193565374)（2026-11-18 07:48:17 JST、結果: （取得できなかった）） |

## canaryに反映済み・stable昇格待ちの変更

stableの最終更新からcanaryの最終更新までの間にmainへマージされたPRの一覧。これらはすでにcanary（canary_weightの割合）には反映済みだが、まだstable（残りの割合）には昇格していない。

- [#2227 feat: report-client-errorを送信元IP単位でレート制限し、LINE通知に総量上限を設ける](https://github.com/bamiyanapp/karuta/pull/2227)
- [#2224 fix: get-phraseのrepeatCount・speechRate・langを許可リストで正規化する](https://github.com/bamiyanapp/karuta/pull/2224)

## キューイング中の変更

canary最終更新以降にmainへマージされたPRの一覧。canaryにもまだ反映されていない。これらは次回canary更新時にまとめて反映される。

（該当するPRが見つからなかった）
