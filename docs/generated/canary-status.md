# canary運用状態

このファイルは`canary-status.yml`（1時間おきのスケジュール実行）が自動更新する。手動で編集しないこと。

最終更新日時: 2026-10-10 10:38:05 JST。

| 項目 | 値 |
|---|---|
| canary_weight（canaryへ振り分ける割合） | 10% |
| force_stable（管理者ロールバック中か） | false |
| canary_queue_pending（反映待ちのマージがあるか） | true |
| canaryスタックが存在するか | true |
| 次回promote-canary.ymlのスケジュール実行予定（適用スケジュール） | 2026-10-11 02:37:00 JST（毎日 JST 02:37固定） |
| canaryの最終更新 | 2026-10-09 07:26:44 JST |
| stableの最終更新 | 2026-10-07 07:26:44 JST |
| 次回promote-canary.yml実行時に昇格対象になる日時 | 2026-10-10 07:26:44 JST（force_stable=falseかつstableがcanaryより新しくない場合） |

## canaryに反映済み・stable昇格待ちの変更

stableの最終更新からcanaryの最終更新までの間にmainへマージされたPRの一覧。これらはすでにcanary（canary_weightの割合）には反映済みだが、まだstable（残りの割合）には昇格していない。

- [#1430 feat(frontend): UI改善(共有画面・トップデザイン・リンク移設)](https://github.com/bamiyanapp/karuta/pull/1430)
- [#1429 feat: UI改善4点を実装](https://github.com/bamiyanapp/karuta/pull/1429)

## キューイング中の変更

canary最終更新以降にmainへマージされたPRの一覧。canaryにもまだ反映されていない。これらは次回canary更新時にまとめて反映される。

- [#1474 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1474)
- [#1473 feat(canary): canary運用状態をGitから可視化できるようにする](https://github.com/bamiyanapp/karuta/pull/1473)
- [#1471 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1471)
- [#1469 chore(ci): dev-standards参照をv2.69.0へ更新する](https://github.com/bamiyanapp/karuta/pull/1469)
- [#1470 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1470)
- [#1466 docs: README.mdの文をsentence-length閾値100で分割する](https://github.com/bamiyanapp/karuta/pull/1466)
- [#1467 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1467)
- [#1465 chore(deps): update aws-sdk-js-v3 monorepo to v3.1147.0](https://github.com/bamiyanapp/karuta/pull/1465)
- [#1464 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1464)
- [#1463 feat(canary): canary/stableの運用可視性を改善する](https://github.com/bamiyanapp/karuta/pull/1463)
- [#1461 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1461)
- [#1460 fix(ci): dependency-risk自動クローズ機能を有効化する](https://github.com/bamiyanapp/karuta/pull/1460)
- [#1457 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1457)
- [#1456 chore(deps): update dependency vite to v8.3.3](https://github.com/bamiyanapp/karuta/pull/1456)
- [#1455 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1455)
- [#1454 fix(data): Git大ピンチのkanaデータ3件を修正し、かな整合チェック対象にする](https://github.com/bamiyanapp/karuta/pull/1454)
