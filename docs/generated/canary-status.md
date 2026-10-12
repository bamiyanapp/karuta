# canary運用状態

このファイルは`canary-status.yml`（1時間おきのスケジュール実行）が自動更新する。手動で編集しないこと。

最終更新日時: 2026-10-12 10:10:34 JST。

| 項目 | 値 |
|---|---|
| canary_weight（canaryへ振り分ける割合） | 10% |
| force_stable（管理者ロールバック中か） | false |
| canary_queue_pending（反映待ちのマージがあるか） | true |
| canaryスタックが存在するか | true |
| stableの最終更新 | 2026-10-11 12:22:42 JST |
| stableの配信中バージョン（backend） | 1.105.0 |
| stableの配信中バージョン（frontend） | （取得できなかった） |
| canaryの最終更新 | 2026-10-12 06:06:28 JST |
| canaryの配信中バージョン（backend） | 1.108.0 |
| canaryの配信中バージョン（frontend） | 1.108.0 |
| 本番昇格の条件を満たす日時 | 2026-10-13 06:06:28 JST以降 |
| 次回の定期チェック予定 | 2026-10-13 02:37:00 JST |

## canaryに反映済み・stable昇格待ちの変更

stableの最終更新からcanaryの最終更新までの間にmainへマージされたPRの一覧。これらはすでにcanary（canary_weightの割合）には反映済みだが、まだstable（残りの割合）には昇格していない。

- [#1575 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1575)
- [#1572 chore(canary): canary運用状態を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1572)
- [#1571 fix(ci): dev-standards submoduleを更新しcommit-via-prのaction.yml読み込み失敗を解消する](https://github.com/bamiyanapp/karuta/pull/1571)
- [#1569 chore(deps): update dependency vite to v8.3.4](https://github.com/bamiyanapp/karuta/pull/1569)
- [#1568 refactor(frontend): version.json書き出しをdev-standards共有ヘルパーへ移行する](https://github.com/bamiyanapp/karuta/pull/1568)
- [#1566 feat(ci): canary-status.mdへフロントエンドの配信中バージョンを追加する](https://github.com/bamiyanapp/karuta/pull/1566)
- [#1564 feat(frontend): トップ画面「みんなで遊ぶ」セクションのラベル・デザインを改善する](https://github.com/bamiyanapp/karuta/pull/1564)
- [#1563 fix(frontend): StableSwitchLinkのタップ時エラー修正・配置改善・表記簡潔化](https://github.com/bamiyanapp/karuta/pull/1563)
- [#1560 fix(deps): package-lock.jsonを実際の依存解決結果と再同期する](https://github.com/bamiyanapp/karuta/pull/1560)
- [#1559 feat(frontend): アプリタイトル表記を「かるた読み上げ」へ統一する](https://github.com/bamiyanapp/karuta/pull/1559)

## キューイング中の変更

canary最終更新以降にmainへマージされたPRの一覧。canaryにもまだ反映されていない。これらは次回canary更新時にまとめて反映される。

- [#1583 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1583)
- [#1582 chore(canary): canary運用状態を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1582)
- [#1580 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1580)
- [#1579 chore(canary): canary運用状態を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1579)
- [#1577 fix(ci): canary-status.ymlのフロントバージョン取得失敗時にHTTPステータス等を診断ログへ出力する](https://github.com/bamiyanapp/karuta/pull/1577)
- [#1578 chore(canary): canary運用状態を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1578)
