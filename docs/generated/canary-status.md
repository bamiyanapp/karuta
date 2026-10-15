# canary運用状態

このファイルは`canary-status.yml`（1日1回のスケジュール実行、issue #1597）が自動更新する。手動で編集しないこと。

最終更新日時: 2026-10-16 07:14:58 JST。

| 項目 | 値 |
|---|---|
| canary_weight（canaryへ振り分ける割合） | 10% |
| force_stable（管理者ロールバック中か） | true |
| canary_queue_pending（反映待ちのマージがあるか） | false |
| canaryスタックが存在するか | true |
| stableの最終更新 | 2026-10-14 08:52:09 JST |
| stableの配信中バージョン | 1.108.6 |
| canaryの最終更新 | 2026-10-16 07:10:08 JST |
| canaryの配信中バージョン | 1.111.3 |
| 本番昇格の条件を満たす日時（この日時を過ぎたcron発火で初めて昇格する） | 2026-10-17 03:10:08 JST以降 |
| 次回のpromote-canary.yml cron発火予定（発火しても上記条件未達なら何もしない） | 2026-10-17 00:00:00 JST |
| 直近のpromote-canary.yml実行 | [run 38814752717](https://github.com/bamiyanapp/karuta/actions/runs/38814752717)（2026-10-16 07:06:03 JST、結果: success） |

## canaryに反映済み・stable昇格待ちの変更

stableの最終更新からcanaryの最終更新までの間にmainへマージされたPRの一覧。これらはすでにcanary（canary_weightの割合）には反映済みだが、まだstable（残りの割合）には昇格していない。

- [#1653 fix(ci): canary-status.ymlの猶予期間表示を揃え、定期実行時刻を0時JSTへ変更する](https://github.com/bamiyanapp/karuta/pull/1653)
- [#1650 fix(frontend): axe既存違反（region・label・landmark-one-main）を解消する](https://github.com/bamiyanapp/karuta/pull/1650)
- [#1643 feat(ci): Lighthouse CIによるパフォーマンス・アクセシビリティスコア監視を導入する](https://github.com/bamiyanapp/karuta/pull/1643)
- [#1645 fix(frontend): DivisionSelectViewの重複main landmarkを解消する](https://github.com/bamiyanapp/karuta/pull/1645)
- [#1641 feat: トップ画面UI調整(#1581)・E2Eアクセシビリティ検査追加(#1561)](https://github.com/bamiyanapp/karuta/pull/1641)
- [#1637 fix(docs): canary-status.mdのキューイング中の変更から非リリース対象PRを除外する](https://github.com/bamiyanapp/karuta/pull/1637)
- [#1634 feat(ci): canary-status.ymlをpromote-canary.yml完了時に自動実行する](https://github.com/bamiyanapp/karuta/pull/1634)
- [#1629 fix(ci): promote-canary.ymlが参照するdev-standardsタグをv2.78.2へ更新する](https://github.com/bamiyanapp/karuta/pull/1629)
- [#1624 fix(docs): canary-status.mdのバージョン表示をbackend/frontend個別表示から1行に統合する](https://github.com/bamiyanapp/karuta/pull/1624)

## キューイング中の変更

canary最終更新以降にmainへマージされたPRの一覧。canaryにもまだ反映されていない。これらは次回canary更新時にまとめて反映される。

（該当するPRが見つからなかった）
