# canary運用状態

このファイルは`canary-status.yml`（1時間おきのスケジュール実行）が自動更新する。手動で編集しないこと。

最終更新日時: 2026-10-10 20:16:47 JST。

| 項目 | 値 |
|---|---|
| canary_weight（canaryへ振り分ける割合） | 10% |
| force_stable（管理者ロールバック中か） | false |
| canary_queue_pending（反映待ちのマージがあるか） | true |
| canaryスタックが存在するか | true |
| stableの最終更新 | 2026-10-06 08:07:12 JST |
| stableの配信中バージョン | （取得できなかった） |
| canaryの最終更新 | 2026-10-10 20:11:52 JST |
| canaryの配信中バージョン | 1.104.0 |
| 本番昇格の条件を満たす日時 | 2026-10-11 20:11:52 JST以降 |
| 次回の定期チェック予定 | 2026-10-11 02:37:00 JST |

## canaryに反映済み・stable昇格待ちの変更

stableの最終更新からcanaryの最終更新までの間にmainへマージされたPRの一覧。これらはすでにcanary（canary_weightの割合）には反映済みだが、まだstable（残りの割合）には昇格していない。

- [#1534 chore(canary): canary運用状態を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1534)
- [#1533 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1533)
- [#1532 feat(ci): canary-status.mdにcanary/stableの配信中バージョンを追記する](https://github.com/bamiyanapp/karuta/pull/1532)
- [#1531 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1531)
- [#1530 docs(ci): canary-status.mdの日時項目の表現を平易にする](https://github.com/bamiyanapp/karuta/pull/1530)
- [#1528 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1528)
- [#1527 chore(ci): dev-standards参照をv2.71.2へ更新する](https://github.com/bamiyanapp/karuta/pull/1527)
- [#1525 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1525)
- [#1524 feat(frontend): トップ画面にcanary/stable相互切り替えボタンを追加する](https://github.com/bamiyanapp/karuta/pull/1524)
- [#1522 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1522)
- [#1521 chore(ci): dev-standards参照をv2.71.0へ更新する](https://github.com/bamiyanapp/karuta/pull/1521)
- [#1520 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1520)
- [#1518 chore(ci): 調査用の一時workflowを削除する](https://github.com/bamiyanapp/karuta/pull/1518)
- [#1517 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1517)
- [#1516 fix(canary): KVSのcanary_existsをtrueへ修正し、/canary/明示アクセスを修復する](https://github.com/bamiyanapp/karuta/pull/1516)
- [#1515 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1515)
- [#1513 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1513)
- [#1510 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1510)
- [#1509 chore(canary): canary運用状態を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1509)
- [#1508 fix(ci): canary-status.ymlのmain pushを新ブランチ+PR squash merge方式に変更する](https://github.com/bamiyanapp/karuta/pull/1508)
- [#1506 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1506)
- [#1504 fix(deps): package-lock.jsonをbackend/package.jsonの依存バージョン宣言に同期させる](https://github.com/bamiyanapp/karuta/pull/1504)
- [#1505 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1505)
- [#1502 fix(ci): canary-status.ymlのpush失敗時にmainを取り込んでリトライする](https://github.com/bamiyanapp/karuta/pull/1502)
- [#1498 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1498)
- [#1497 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1497)
- [#1496 docs: backend/seed.jsの冪等性・データ整合の設計方針をdocs/配下に文書化する](https://github.com/bamiyanapp/karuta/pull/1496)
- [#1495 docs: README.mdのlevel列の仕様記述を実装（文字列許容）に合わせて更新する](https://github.com/bamiyanapp/karuta/pull/1495)
- [#1492 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1492)
- [#1491 fix(canary): canaryスタックが存在しない状態での/canary/明示アクセスをstableへフォールバックする](https://github.com/bamiyanapp/karuta/pull/1491)
- [#1488 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1488)
- [#1490 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1490)
- [#1487 docs: README.mdからdocs/generated/README.mdへのリンクを追加する](https://github.com/bamiyanapp/karuta/pull/1487)
- [#1485 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1485)
- [#1484 docs: README.mdからdocs/generated/canary-status.mdへのリンクを追加する](https://github.com/bamiyanapp/karuta/pull/1484)
- [#1482 feat(canary): canary-status.mdのPRリンクをタイトル付きで表示する](https://github.com/bamiyanapp/karuta/pull/1482)
- [#1480 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1480)
- [#1479 feat(canary): canary反映済み・stable昇格待ちのPR一覧を追加し時刻表示をJSTに統一する](https://github.com/bamiyanapp/karuta/pull/1479)
- [#1477 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1477)
- [#1476 feat(canary): キューイング中の変更をPRリンクで表示する](https://github.com/bamiyanapp/karuta/pull/1476)
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
- [#1451 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1451)
- [#1450 fix(ci): canaryの渋滞を解消し、デプロイを日次バッチ化する](https://github.com/bamiyanapp/karuta/pull/1450)
- [#1446 chore(deps-dev): bump handlebars](https://github.com/bamiyanapp/karuta/pull/1446)
- [#1445 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1445)
- [#1443 fix(ci): 自動昇格の猶予期間を1週間から1日へ短縮する](https://github.com/bamiyanapp/karuta/pull/1443)
- [#1441 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1441)
- [#1439 docs(quiz-room): 管理者セッション断の説明を現状の挙動に合わせて修正する](https://github.com/bamiyanapp/karuta/pull/1439)
- [#1440 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1440)
- [#1438 chore(deps): update dependency @vitejs/plugin-react to v6.1.2](https://github.com/bamiyanapp/karuta/pull/1438)
- [#1437 docs(quiz-room): 正常系・管理者セッション断をmermaid化する](https://github.com/bamiyanapp/karuta/pull/1437)
- [#1435 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1435)
- [#1434 chore(deps): update bamiyanapp/dev-standards action to v2.61.2](https://github.com/bamiyanapp/karuta/pull/1434)
- [#1433 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1433)
- [#1430 feat(frontend): UI改善(共有画面・トップデザイン・リンク移設)](https://github.com/bamiyanapp/karuta/pull/1430)
- [#1432 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1432)
- [#1431 fix(ci): stableがcanaryを追い越している場合は自動昇格をスキップする](https://github.com/bamiyanapp/karuta/pull/1431)
- [#1428 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1428)
- [#1427 chore(deps): update bamiyanapp/dev-standards action to v2.61.1](https://github.com/bamiyanapp/karuta/pull/1427)
- [#1425 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1425)
- [#1424 chore(deps): update bamiyanapp/dev-standards action to v2.60.0](https://github.com/bamiyanapp/karuta/pull/1424)
- [#1422 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1422)
- [#1421 chore(deps): update bamiyanapp/dev-standards action to v2.59.3](https://github.com/bamiyanapp/karuta/pull/1421)
- [#1420 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1420)
- [#1417 chore(deps): update dependency eslint-plugin-n to v18.4.1](https://github.com/bamiyanapp/karuta/pull/1417)
- [#1419 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1419)
- [#1418 chore(deps): update bamiyanapp/dev-standards action to v2.58.1](https://github.com/bamiyanapp/karuta/pull/1418)
- [#1416 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1416)
- [#1415 chore(deps): update bamiyanapp/dev-standards action to v2.57.1](https://github.com/bamiyanapp/karuta/pull/1415)
- [#1414 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1414)
- [#1413 chore(deps): update bamiyanapp/dev-standards action to v2.56.1](https://github.com/bamiyanapp/karuta/pull/1413)
- [#1412 chore(ci): mermaid図のキャッシュバスティング用クエリ文字列を更新する [skip ci]](https://github.com/bamiyanapp/karuta/pull/1412)

## キューイング中の変更

canary最終更新以降にmainへマージされたPRの一覧。canaryにもまだ反映されていない。これらは次回canary更新時にまとめて反映される。

（該当するPRが見つからなかった）
