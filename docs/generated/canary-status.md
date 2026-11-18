# canary運用状態

このファイルは`promote-canary.yml`のstatus job（1日1回のスケジュール実行、issue #1809）が自動更新する。手動で編集しないこと。

最終更新日時: 2026-11-19 07:46:53 JST。

| 項目 | 値 |
|---|---|
| canary_weight（canaryへ振り分ける割合） | 10% |
| force_stable（管理者ロールバック中か） | false |
| canary_queue_pending（反映待ちのマージがあるか） | false |
| canaryスタックが存在するか | true |
| stableの最終更新 | 2026-11-19 07:38:22 JST |
| stableの配信中バージョン | 1.124.0 |
| canaryの最終更新 | 2026-11-19 07:42:23 JST |
| canaryの配信中バージョン | 1.127.0 |
| 本番昇格の条件を満たす日時（この日時を過ぎたcron発火で初めて昇格する） | 2026-11-20 03:42:23 JST以降 |
| 次回のpromote-canary.yml cron発火予定（発火しても上記条件未達なら何もしない） | 2026-11-20 00:00:00 JST |
| 直近のpromote-canary.yml実行 | [run 44413713407](https://github.com/bamiyanapp/karuta/actions/runs/44413713407)（2026-11-19 07:39:51 JST、結果: failure） |

## canaryに反映済み・stable昇格待ちの変更

stableの最終更新からcanaryの最終更新までの間にmainへマージされたPRの一覧。これらはすでにcanary（canary_weightの割合）には反映済みだが、まだstable（残りの割合）には昇格していない。

- [#2261 feat: window.confirmを共有のConfirmDialogへ置き換える (#2242)](https://github.com/bamiyanapp/karuta/pull/2261)
- [#2259 refactor: APIのリトライ既定値を共通のAPIクライアントで適用する (#2187)](https://github.com/bamiyanapp/karuta/pull/2259)
- [#2256 fix(renovate): self_refをタグ全体で抽出しusesと同時に更新させる (#2240)](https://github.com/bamiyanapp/karuta/pull/2256)
- [#2239 refactor: hook・viewのAPI呼び出しも共通のAPIクライアント経由にする (#2187)](https://github.com/bamiyanapp/karuta/pull/2239)
- [#2234 refactor: App.jsxのAPI呼び出しを共通のAPIクライアント経由にする (#2187)](https://github.com/bamiyanapp/karuta/pull/2234)
- [#2230 feat: get-congratulation-audioの音声をPollyキャッシュの対象にする](https://github.com/bamiyanapp/karuta/pull/2230)
- [#2229 feat: 残りの公開APIにも送信元IP単位のレート制限を入れる](https://github.com/bamiyanapp/karuta/pull/2229)

## キューイング中の変更

canary最終更新以降にmainへマージされたPRの一覧。canaryにもまだ反映されていない。これらは次回canary更新時にまとめて反映される。

（該当するPRが見つからなかった）
