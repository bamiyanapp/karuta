## canary運用状態

| 項目 | 値 |
|---|---|
| canary_weight（canaryへ振り分ける割合） | 10% |
| force_stable（管理者ロールバック中か） | false |
| canary_queue_pending（反映待ちのマージがあるか） | true |
| canaryスタックが存在するか | true |
| stableの最終更新 | 2026-10-25 03:01:57 JST |
| canaryの最終更新 | 2026-10-25 03:05:54 JST |
| 本番昇格の条件を満たす日時（この日時を過ぎたら昇格対象） | 2026-10-25 23:05:54 JST以降 |
| stableの配信中バージョン | 1.118.0 |
| canaryの配信中バージョン | 1.118.1 |
| 直近のpromote-canary.yml実行 | [run 40120085468](https://github.com/bamiyanapp/karuta/actions/runs/40120085468)（2026-10-25 03:18:22 JST、結果: success） |

### canaryに反映済み・stable昇格待ちの変更

- [#1903 fix(ci): canary-status.ymlのCD完了トリガーを削除する](https://github.com/bamiyanapp/karuta/pull/1903)
- [#1895 refactor(ci): backend URL解決をdev-standardsの共通actionへ置き換える](https://github.com/bamiyanapp/karuta/pull/1895)

### キューイング中の変更（canaryにも未反映・canary最終更新以降にmainへマージされたPR）

- [#1927 fix(ci): dev-standards参照をv2.114.1へ更新する](https://github.com/bamiyanapp/karuta/pull/1927)
- [#1924 feat(ci): canary-status.ymlをreusable-canary-status.yml呼び出しへ移行する](https://github.com/bamiyanapp/karuta/pull/1924)
- [#1915 fix(ci): README.mdのdev-standardsバージョン表示を自動追従させる](https://github.com/bamiyanapp/karuta/pull/1915)
