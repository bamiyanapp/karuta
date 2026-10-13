# canary運用状態

このファイルは`canary-status.yml`（1時間おきのスケジュール実行）が自動更新する。手動で編集しないこと。

最終更新日時: 2026-10-13 19:23:55 JST。

| 項目 | 値 |
|---|---|
| canary_weight（canaryへ振り分ける割合） | 10% |
| force_stable（管理者ロールバック中か） | false |
| canary_queue_pending（反映待ちのマージがあるか） | true |
| canaryスタックが存在するか | true |
| stableの最終更新 | 2026-10-13 08:47:58 JST |
| stableの配信中バージョン（backend） | 1.108.1 |
| stableの配信中バージョン（frontend） | 1.108.1 |
| canaryの最終更新 | 2026-10-13 08:52:24 JST |
| canaryの配信中バージョン（backend） | 1.108.1 |
| canaryの配信中バージョン（frontend） | 1.108.1 |
| 本番昇格の条件を満たす日時 | 2026-10-14 08:52:24 JST以降 |
| 次回の定期チェック予定 | 2026-10-14 02:37:00 JST |

## canaryに反映済み・stable昇格待ちの変更

stableの最終更新からcanaryの最終更新までの間にmainへマージされたPRの一覧。これらはすでにcanary（canary_weightの割合）には反映済みだが、まだstable（残りの割合）には昇格していない。

（該当するPRが見つからなかった）

## キューイング中の変更

canary最終更新以降にmainへマージされたPRの一覧。canaryにもまだ反映されていない。これらは次回canary更新時にまとめて反映される。

- [#1602 fix(ci): canary-status.ymlのnpm ciをリポジトリルートで1回に統合する](https://github.com/bamiyanapp/karuta/pull/1602)
- [#1600 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1600)
- [#1598 fix(ci): canary-status.ymlの実行頻度を1時間おきから1日1回に減らす](https://github.com/bamiyanapp/karuta/pull/1598)
- [#1599 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1599)
- [#1596 fix(ci): canary-status.ymlのbackendバージョン取得もosls infoから動的解決する](https://github.com/bamiyanapp/karuta/pull/1596)
- [#1594 chore(canary): canary運用状態を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1594)
- [#1593 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1593)
- [#1592 fix(ci): stable/canaryのAPIベースURLをデプロイ時にosls infoから動的解決する](https://github.com/bamiyanapp/karuta/pull/1592)
- [#1590 chore(canary): canary運用状態を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1590)
- [#1589 chore(canary): canary運用状態を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1589)
- [#1587 chore(canary): canary運用状態を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1587)
