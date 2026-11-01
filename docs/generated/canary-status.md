# canary運用状態

このファイルは`promote-canary.yml`のstatus job（1日1回のスケジュール実行、issue #1809）が自動更新する。手動で編集しないこと。

最終更新日時: 2026-11-02 04:30:41 JST。

| 項目 | 値 |
|---|---|
| canary_weight（canaryへ振り分ける割合） | 10% |
| force_stable（管理者ロールバック中か） | false |
| canary_queue_pending（反映待ちのマージがあるか） | false |
| canaryスタックが存在するか | false |
| 次回のpromote-canary.yml cron発火予定 | 2026-11-03 00:00:00 JST |
| 直近のpromote-canary.yml実行 | [run 41341639153](https://github.com/bamiyanapp/karuta/actions/runs/41341639153)（2026-11-02 04:25:16 JST、結果: （取得できなかった）） |

canaryスタックは現在存在しない。マージ済みでキュー待ち（canary_queue_pending=true）であれば、次回のpromote-canary.yml実行で最新main HEADがcanaryへデプロイされる。
