# canary運用状態

このファイルは`promote-canary.yml`のstatus job（1日1回のスケジュール実行、issue #1809）が自動更新する。手動で編集しないこと。

最終更新日時: 2026-11-28 08:29:19 JST。

| 項目 | 値 |
|---|---|
| canary_weight（canaryへ振り分ける割合） | 10% |
| force_stable（管理者ロールバック中か） | false |
| canary_queue_pending（反映待ちのマージがあるか） | false |
| canaryスタックが存在するか | true |
| stableの最終更新 | 2026-11-28 08:20:45 JST |
| stableの配信中バージョン | 1.131.1 |
| canaryの最終更新 | 2026-11-28 08:24:37 JST |
| canaryの配信中バージョン | 1.134.1 |
| 本番昇格の条件を満たす日時（この日時を過ぎたcron発火で初めて昇格する） | 2026-11-29 04:24:37 JST以降 |
| 次回のpromote-canary.yml cron発火予定（発火しても上記条件未達なら何もしない） | 2026-11-29 00:00:00 JST |
| 直近のpromote-canary.yml実行 | [run 46081647724](https://github.com/bamiyanapp/karuta/actions/runs/46081647724)（2026-11-28 08:17:25 JST、結果: （取得できなかった）） |

## canaryに反映済み・stable昇格待ちの変更

stableの最終更新からcanaryの最終更新までの間にmainへマージされたPRの一覧。これらはすでにcanary（canary_weightの割合）には反映済みだが、まだstable（残りの割合）には昇格していない。

- [#2421 fix(backend): stop returning internal error messages in 500 responses](https://github.com/bamiyanapp/karuta/pull/2421)
- [#2412 feat(frontend): enable max-lines and add meta description](https://github.com/bamiyanapp/karuta/pull/2412)
- [#2411 feat(infra): enable DynamoDB deletion protection and add data-stack update workflow](https://github.com/bamiyanapp/karuta/pull/2411)
- [#2404 feat(infra): add security headers (HSTS, nosniff, Referrer-Policy, X-Frame-Options) to CloudFront](https://github.com/bamiyanapp/karuta/pull/2404)

## キューイング中の変更

canary最終更新以降にmainへマージされたPRの一覧。canaryにもまだ反映されていない。これらは次回canary更新時にまとめて反映される。

（該当するPRが見つからなかった）
## canary運用状態

| 項目 | 値 |
|---|---|
| canary_weight（canaryへ振り分ける割合） | 10% |
| force_stable（管理者ロールバック中か） | false |
| canary_queue_pending（反映待ちのマージがあるか） | true |
| canaryスタックが存在するか | true |
| stableの最終更新 | 2026-11-28 08:20:45 JST |
| canaryの最終更新 | 2026-11-28 08:24:37 JST |
| 本番昇格の条件を満たす日時（この日時を過ぎたら昇格対象） | 2026-11-29 04:24:37 JST以降 |
| stableの配信中バージョン | 1.131.1 |
| canaryの配信中バージョン | 1.134.1 |
| 直近のpromote-canary.yml実行 | [run 46083650287](https://github.com/bamiyanapp/karuta/actions/runs/46083650287)（2026-11-28 08:38:53 JST、結果: success） |

### canaryに反映済み・stable昇格待ちの変更

- [#2421 fix(backend): stop returning internal error messages in 500 responses](https://github.com/bamiyanapp/karuta/pull/2421)
- [#2412 feat(frontend): enable max-lines and add meta description](https://github.com/bamiyanapp/karuta/pull/2412)
- [#2411 feat(infra): enable DynamoDB deletion protection and add data-stack update workflow](https://github.com/bamiyanapp/karuta/pull/2411)
- [#2404 feat(infra): add security headers (HSTS, nosniff, Referrer-Policy, X-Frame-Options) to CloudFront](https://github.com/bamiyanapp/karuta/pull/2404)

### キューイング中の変更（canaryにも未反映・canary最終更新以降にmainへマージされたPR）

- [#2429 refactor(backend): split cors and streamToBuffer out of handler.js](https://github.com/bamiyanapp/karuta/pull/2429)
- [#2426 feat(backend): add phraseId GSI query and audio=false for the detail screen](https://github.com/bamiyanapp/karuta/pull/2426)
