# canary運用状態

このファイルは`canary-status.yml`（1日1回のスケジュール実行、issue #1597）が自動更新する。手動で編集しないこと。

最終更新日時: 2026-10-19 20:12:18 JST。

| 項目 | 値 |
|---|---|
| canary_weight（canaryへ振り分ける割合） | 10% |
| force_stable（管理者ロールバック中か） | false |
| canary_queue_pending（反映待ちのマージがあるか） | true |
| canaryスタックが存在するか | true |
| stableの最終更新 | 2026-10-19 02:57:49 JST |
| stableの配信中バージョン | 1.113.4 |
| canaryの最終更新 | 2026-10-19 03:01:44 JST |
| canaryの配信中バージョン | 1.116.3 |
| 本番昇格の条件を満たす日時（この日時を過ぎたcron発火で初めて昇格する） | 2026-10-19 23:01:44 JST以降 |
| 次回のpromote-canary.yml cron発火予定（発火しても上記条件未達なら何もしない） | 2026-10-20 00:00:00 JST |
| 直近のpromote-canary.yml実行 | [run 39151651652](https://github.com/bamiyanapp/karuta/actions/runs/39151651652)（2026-10-19 02:53:34 JST、結果: success） |

## canaryに反映済み・stable昇格待ちの変更

stableの最終更新からcanaryの最終更新までの間にmainへマージされたPRの一覧。これらはすでにcanary（canary_weightの割合）には反映済みだが、まだstable（残りの割合）には昇格していない。

- [#1770 fix(ci): Lighthouse CIの閾値を70点から65点へ引き下げる](https://github.com/bamiyanapp/karuta/pull/1770)
- [#1759 feat(ci): Lighthouse CIでPWAカテゴリも計測対象にする](https://github.com/bamiyanapp/karuta/pull/1759)
- [#1748 fix(ci): dev-standards参照をv2.97.3からv2.97.4へ更新する](https://github.com/bamiyanapp/karuta/pull/1748)
- [#1745 fix(ci): dev-standards参照をv2.97.2からv2.97.3へ更新する](https://github.com/bamiyanapp/karuta/pull/1745)
- [#1739 fix(ci): dev-standards参照をv2.97.0からv2.97.2へ更新する](https://github.com/bamiyanapp/karuta/pull/1739)
- [#1728 fix(docs): dev-standards submoduleへの相対リンクを絶対URLへ修正する](https://github.com/bamiyanapp/karuta/pull/1728)
- [#1724 fix(ci): startServerReadyPatternをANSIエスケープで分断されない形に修正する](https://github.com/bamiyanapp/karuta/pull/1724)
- [#1720 fix(ci): cd.ymlのdev-standards参照をv2.78.1→v2.97.0へ更新する](https://github.com/bamiyanapp/karuta/pull/1720)
- [#1718 feat(ci): karuta自身のworkflowのジョブ名・ステップ名を日本語化する](https://github.com/bamiyanapp/karuta/pull/1718)
- [#1708 fix(ci): reusable-ci.ymlの参照をv2.87.0→v2.97.0へ更新する](https://github.com/bamiyanapp/karuta/pull/1708)
- [#1698 fix(ci): 依存deprecated定期スキャンの不具合を修正する](https://github.com/bamiyanapp/karuta/pull/1698)
- [#1696 feat(ci): 依存パッケージのdeprecated定期スキャンを導入する](https://github.com/bamiyanapp/karuta/pull/1696)
- [#1690 fix(ci): promote-canary.ymlの参照タグをv2.82.4へ更新する](https://github.com/bamiyanapp/karuta/pull/1690)

## キューイング中の変更

canary最終更新以降にmainへマージされたPRの一覧。canaryにもまだ反映されていない。これらは次回canary更新時にまとめて反映される。

- [#1799 fix(frontend): カテゴリ取得の一過性失敗によるfalse positiveエラーを解消](https://github.com/bamiyanapp/karuta/pull/1799)
- [#1794 fix(ci): canary-status.mdの反映済みPR一覧をバージョンタグベースで算出する](https://github.com/bamiyanapp/karuta/pull/1794)
- [#1786 fix(ci): canary-status.ymlをCD完了時にも再生成するようにする](https://github.com/bamiyanapp/karuta/pull/1786)
