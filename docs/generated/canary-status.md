# canary運用状態

このファイルは`promote-canary.yml`のstatus job（1日1回のスケジュール実行、issue #1809）が自動更新する。手動で編集しないこと。

最終更新日時: 2026-11-22 06:01:24 JST。

| 項目 | 値 |
|---|---|
| canary_weight（canaryへ振り分ける割合） | 10% |
| force_stable（管理者ロールバック中か） | false |
| canary_queue_pending（反映待ちのマージがあるか） | false |
| canaryスタックが存在するか | true |
| stableの最終更新 | 2026-11-22 05:52:22 JST |
| stableの配信中バージョン | 1.127.2 |
| canaryの最終更新 | 2026-11-22 05:56:00 JST |
| canaryの配信中バージョン | 1.130.0 |
| 本番昇格の条件を満たす日時（この日時を過ぎたcron発火で初めて昇格する） | 2026-11-23 01:56:00 JST以降 |
| 次回のpromote-canary.yml cron発火予定（発火しても上記条件未達なら何もしない） | 2026-11-23 00:00:00 JST |
| 直近のpromote-canary.yml実行 | [run 44949174297](https://github.com/bamiyanapp/karuta/actions/runs/44949174297)（2026-11-22 05:59:50 JST、結果: （取得できなかった）） |

## canaryに反映済み・stable昇格待ちの変更

stableの最終更新からcanaryの最終更新までの間にmainへマージされたPRの一覧。これらはすでにcanary（canary_weightの割合）には反映済みだが、まだstable（残りの割合）には昇格していない。

- [#2332 feat(infra): GitHub Actions用のOIDCプロバイダとデプロイ用ロールを追加する](https://github.com/bamiyanapp/karuta/pull/2332)
- [#2329 refactor(frontend): renderSortArrowをApp.jsxからAllPhrasesView.jsxへ移す](https://github.com/bamiyanapp/karuta/pull/2329)
- [#2327 refactor(frontend): ゲーム画面のJSXをviews/GameView.jsxへ切り出す](https://github.com/bamiyanapp/karuta/pull/2327)
- [#2326 refactor(frontend): かるた選択の下書き・決定/印刷の処理をhooks/useCategorySelection.jsへ切り出す](https://github.com/bamiyanapp/karuta/pull/2326)
- [#2325 refactor(frontend): 札の詳細・指摘のデータをhooks/usePhraseDetail.jsへ切り出す](https://github.com/bamiyanapp/karuta/pull/2325)
- [#2323 refactor(frontend): 全札一覧の取得・ソート・絞り込みをhooks/useAllPhrasesList.jsへ切り出す](https://github.com/bamiyanapp/karuta/pull/2323)
- [#2318 refactor(frontend): 選択中カテゴリの札一覧の取得をhooks/useCategoryPhrases.jsへ切り出す](https://github.com/bamiyanapp/karuta/pull/2318)
- [#2316 refactor(frontend): カテゴリ一覧の取得をhooks/useCategories.jsへ切り出す](https://github.com/bamiyanapp/karuta/pull/2316)
- [#2314 refactor(frontend): タブタイトルの更新をhooks/useDocumentTitle.jsへ切り出す](https://github.com/bamiyanapp/karuta/pull/2314)
- [#2313 refactor(frontend): テーマ設定をhooks/useThemeSetting.jsへ切り出す](https://github.com/bamiyanapp/karuta/pull/2313)
- [#2309 refactor(frontend): 全札一覧のソート比較ロジックをutils/phraseSort.jsへ切り出す](https://github.com/bamiyanapp/karuta/pull/2309)
- [#2307 feat(frontend): 取得失敗時に、画面内のエラー表示と再試行ボタンを出す](https://github.com/bamiyanapp/karuta/pull/2307)
- [#2306 feat(frontend): CSP対応の準備として、インラインスクリプトの外部化とE2Eの違反検知を入れる](https://github.com/bamiyanapp/karuta/pull/2306)
- [#2300 fix(backend): Pollyキャッシュの障害耐性・入力検証・クイズ大会の整合性を直す](https://github.com/bamiyanapp/karuta/pull/2300)
- [#2296 fix(backend): DynamoDBのScan・Queryを全ページ取得し、1MB超でのデータ欠落を防ぐ](https://github.com/bamiyanapp/karuta/pull/2296)

## キューイング中の変更

canary最終更新以降にmainへマージされたPRの一覧。canaryにもまだ反映されていない。これらは次回canary更新時にまとめて反映される。

（該当するPRが見つからなかった）
