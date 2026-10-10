# canary運用状態

このファイルは`canary-status.yml`（1時間おきのスケジュール実行）が自動更新する。手動で編集しないこと。

最終更新日時: 2026-10-10T01:38:05Z。

| 項目 | 値 |
|---|---|
| canary_weight（canaryへ振り分ける割合） | 10% |
| force_stable（管理者ロールバック中か） | false |
| canary_queue_pending（反映待ちのマージがあるか） | true |
| canaryスタックが存在するか | true |
| 次回promote-canary.ymlのスケジュール実行予定（適用スケジュール） | 2026-10-10T17:37:00Z（毎日 UTC 17:37 / JST 02:37固定） |
| canaryの最終更新 | 2026-10-08T22:26:44.729000+00:00 |
| 次回promote-canary.yml実行時に昇格対象になる日時 | 2026-10-09T22:26:44Z（force_stable=falseかつstableがcanaryより新しくない場合） |
