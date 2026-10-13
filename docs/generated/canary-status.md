# canary運用状態

このファイルは`canary-status.yml`（1日1回のスケジュール実行、issue #1597）が自動更新する。手動で編集しないこと。

最終更新日時: 2026-10-14 08:00:25 JST。

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
| 本番昇格の条件を満たす日時（この日時を過ぎたcron発火で初めて昇格する） | 2026-10-14 08:52:24 JST以降 |
| 次回のpromote-canary.yml cron発火予定（発火しても上記条件未達なら何もしない） | 2026-10-15 02:37:00 JST |
| 直近のpromote-canary.yml実行 | [run 38474279746](https://github.com/bamiyanapp/karuta/actions/runs/38474279746)（2026-10-14 06:56:31 JST、結果: success） |

## canaryに反映済み・stable昇格待ちの変更

stableの最終更新からcanaryの最終更新までの間にmainへマージされたPRの一覧。これらはすでにcanary（canary_weightの割合）には反映済みだが、まだstable（残りの割合）には昇格していない。

（該当するPRが見つからなかった）

## キューイング中の変更

canary最終更新以降にmainへマージされたPRの一覧。canaryにもまだ反映されていない。これらは次回canary更新時にまとめて反映される。

- [#1612 fix(docs): canary-status.mdに直近のpromote-canary.yml実行への参照を追加する](https://github.com/bamiyanapp/karuta/pull/1612)
- [#1613 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1613)
- [#1611 fix(ci): canary昇格の猶予期間を1日(24時間)から20時間に変更する](https://github.com/bamiyanapp/karuta/pull/1611)
- [#1608 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1608)
- [#1606 docs(readme): Tech Stack・運用をREADME.mdから別ドキュメントへ分割する](https://github.com/bamiyanapp/karuta/pull/1606)
- [#1607 chore(canary): canary運用状態を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1607)
- [#1604 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1604)
- [#1603 chore(canary): canary運用状態を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1603)
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
