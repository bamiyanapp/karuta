## [1.48.3](https://github.com/bamiyanapp/karuta/compare/v1.48.2...v1.48.3) (2026-07-18)


### Bug Fixes

* **frontend:** クイズ大会効果音の絶対パスをbase設定に合わせ相対化する ([#683](https://github.com/bamiyanapp/karuta/issues/683)) ([8468afa](https://github.com/bamiyanapp/karuta/commit/8468afabfdbae07e5b1b791ca91a7125f7c51a78))

## [1.48.2](https://github.com/bamiyanapp/karuta/compare/v1.48.1...v1.48.2) (2026-07-18)


### Bug Fixes

* **frontend:** クイズ大会モードの効果音再生エラーを診断表示する ([#681](https://github.com/bamiyanapp/karuta/issues/681)) ([9e1e3ea](https://github.com/bamiyanapp/karuta/commit/9e1e3ea07c7acd12e0ad62b404d2b4b785f489b0))

## [1.48.1](https://github.com/bamiyanapp/karuta/compare/v1.48.0...v1.48.1) (2026-07-18)


### Bug Fixes

* **ci:** RenovateによるNode.jsバージョンの巻き戻しを修正し再発を防止する ([#676](https://github.com/bamiyanapp/karuta/issues/676)) ([9a6fce9](https://github.com/bamiyanapp/karuta/commit/9a6fce9f921b3d8e07a3c359093cb0bcd4196b43))

# [1.48.0](https://github.com/bamiyanapp/karuta/compare/v1.47.4...v1.48.0) (2026-07-18)


### Features

* **frontend:** カテゴリ確定と絵札印刷の導線を統合する ([#675](https://github.com/bamiyanapp/karuta/issues/675)) ([0c9a911](https://github.com/bamiyanapp/karuta/commit/0c9a91179cd72433b7349b7673079960f48bfb9a)), closes [#642](https://github.com/bamiyanapp/karuta/issues/642)

## [1.47.4](https://github.com/bamiyanapp/karuta/compare/v1.47.3...v1.47.4) (2026-07-18)


### Bug Fixes

* **ci:** CI/CDのNode.jsバージョンをbackend Lambdaランタイムに合わせて統一する ([#672](https://github.com/bamiyanapp/karuta/issues/672)) ([8ae035f](https://github.com/bamiyanapp/karuta/commit/8ae035fd1f1e79945b7730b8dc7da29105836338))

## [1.47.3](https://github.com/bamiyanapp/karuta/compare/v1.47.2...v1.47.3) (2026-07-18)


### Bug Fixes

* **backend:** Lambda関数をesbuildでバンドルしEMFILEを解消 ([#670](https://github.com/bamiyanapp/karuta/issues/670)) ([6e0db77](https://github.com/bamiyanapp/karuta/commit/6e0db77d4a779eebfe6e57e2b27f9413ab3c7e19))

## [1.47.2](https://github.com/bamiyanapp/karuta/compare/v1.47.1...v1.47.2) (2026-07-18)


### Bug Fixes

* **ci:** backendデプロイのファイルディスクリプタ上限をハードリミットまで引き上げる ([#667](https://github.com/bamiyanapp/karuta/issues/667)) ([f0265ce](https://github.com/bamiyanapp/karuta/commit/f0265ce2b95cfe77e07d0438519fabccd0baf220))

## [1.47.1](https://github.com/bamiyanapp/karuta/compare/v1.47.0...v1.47.1) (2026-07-18)


### Bug Fixes

* **ci:** backendデプロイのEMFILE(too many open files)エラーを回避する ([#663](https://github.com/bamiyanapp/karuta/issues/663)) ([5d73d76](https://github.com/bamiyanapp/karuta/commit/5d73d76eda72480149428e051d9fbfe9c6bdecfa)), closes [#661](https://github.com/bamiyanapp/karuta/issues/661)

# [1.47.0](https://github.com/bamiyanapp/karuta/compare/v1.46.2...v1.47.0) (2026-07-18)


### Bug Fixes

* **deps:** CD releaseジョブがsemantic-releaseのプリセット解決で失敗する問題を修正する ([#661](https://github.com/bamiyanapp/karuta/issues/661)) ([01d2138](https://github.com/bamiyanapp/karuta/commit/01d2138910e411ead4b964d5ffb7da4b6f3bb69c)), closes [#654](https://github.com/bamiyanapp/karuta/issues/654)


### Features

* **deps:** npm workspaces構成へ移行し、lockfile・依存インストールを一元化する ([#654](https://github.com/bamiyanapp/karuta/issues/654)) ([b32841a](https://github.com/bamiyanapp/karuta/commit/b32841aa990074f06559374db08975e3dae95eee))
* **e2e:** captureScreenshot()とspec-source-map.jsonをテストケース単位に対応させる ([#660](https://github.com/bamiyanapp/karuta/issues/660)) ([343e3d4](https://github.com/bamiyanapp/karuta/commit/343e3d4da5194250840e722ae896602c4c627d29)), closes [#651](https://github.com/bamiyanapp/karuta/issues/651)

## [1.46.2](https://github.com/bamiyanapp/karuta/compare/v1.46.1...v1.46.2) (2026-07-18)


### Bug Fixes

* **quiz-room:** 誤ったルームコードの即時エラー表示と開設中ルーム一覧の絞り込みを実装する ([#653](https://github.com/bamiyanapp/karuta/issues/653)) ([901be7c](https://github.com/bamiyanapp/karuta/commit/901be7cd94f1bb05ecd734807ed93ee610907954))

## [1.46.1](https://github.com/bamiyanapp/karuta/compare/v1.46.0...v1.46.1) (2026-07-18)


### Bug Fixes

* **quiz-room:** ルーム情報画面でも早押し判定モーダルを表示し、効果音を追加する ([#647](https://github.com/bamiyanapp/karuta/issues/647)) ([9cc178d](https://github.com/bamiyanapp/karuta/commit/9cc178d440a4f1aefd348f65fe5627d7ccefbc28)), closes [#613](https://github.com/bamiyanapp/karuta/issues/613)

# [1.46.0](https://github.com/bamiyanapp/karuta/compare/v1.45.0...v1.46.0) (2026-07-18)


### Bug Fixes

* **deps:** ルート直下のpackage-lock.jsonの不整合を解消する ([#645](https://github.com/bamiyanapp/karuta/issues/645)) ([618a425](https://github.com/bamiyanapp/karuta/commit/618a425c8b326f38574095fa608aadaa99ee42a8)), closes [#340](https://github.com/bamiyanapp/karuta/issues/340)
* **quiz-room:** 画面ロック・バックグラウンド復帰後にWebSocketを再接続する ([#637](https://github.com/bamiyanapp/karuta/issues/637)) ([539c77d](https://github.com/bamiyanapp/karuta/commit/539c77dc730172745aefe26f52575c129815537a)), closes [#614](https://github.com/bamiyanapp/karuta/issues/614) [#614](https://github.com/bamiyanapp/karuta/issues/614)


### Features

* **quiz-room:** 管理者がポイントを明示的にリセットできるようにする ([#644](https://github.com/bamiyanapp/karuta/issues/644)) ([20c9a9c](https://github.com/bamiyanapp/karuta/commit/20c9a9ca5b759ea35629e092533ea0c25dd5dd4b)), closes [#615](https://github.com/bamiyanapp/karuta/issues/615)

# [1.45.0](https://github.com/bamiyanapp/karuta/compare/v1.44.1...v1.45.0) (2026-07-17)


### Features

* **e2e:** PRの変更と無関係なE2Eスクリーンショットを折りたたむ ([#634](https://github.com/bamiyanapp/karuta/issues/634)) ([60c3132](https://github.com/bamiyanapp/karuta/commit/60c31324cbfadf6efd09a730ab26370f0270caeb)), closes [#628](https://github.com/bamiyanapp/karuta/issues/628)

## [1.44.1](https://github.com/bamiyanapp/karuta/compare/v1.44.0...v1.44.1) (2026-07-17)


### Bug Fixes

* **deps:** update dependency puppeteer-core to v25 ([#632](https://github.com/bamiyanapp/karuta/issues/632)) ([3ff8805](https://github.com/bamiyanapp/karuta/commit/3ff8805517150bd400b85b13c3b42a777fd782ff))

# [1.44.0](https://github.com/bamiyanapp/karuta/compare/v1.43.0...v1.44.0) (2026-07-17)


### Features

* **quiz-room:** 参加者画面の参加者一覧を表形式にし、接続ステータスを表示する ([#629](https://github.com/bamiyanapp/karuta/issues/629)) ([17e5fb0](https://github.com/bamiyanapp/karuta/commit/17e5fb043493ff0c9b20aec153c472e7467c7dc5)), closes [#599](https://github.com/bamiyanapp/karuta/issues/599)

# [1.43.0](https://github.com/bamiyanapp/karuta/compare/v1.42.1...v1.43.0) (2026-07-17)


### Features

* **quiz-room:** 早押し正解時に即座に結果画面へ切り替え、参加者に紙吹雪演出を出す ([#625](https://github.com/bamiyanapp/karuta/issues/625)) ([04e7441](https://github.com/bamiyanapp/karuta/commit/04e74413331524c2d0e159e25d5a19b8ee8523b3)), closes [#600](https://github.com/bamiyanapp/karuta/issues/600)

## [1.42.1](https://github.com/bamiyanapp/karuta/compare/v1.42.0...v1.42.1) (2026-07-17)


### Bug Fixes

* **e2e:** スクリーンショットに日本語キャプションを付けられるようにする ([#603](https://github.com/bamiyanapp/karuta/issues/603)) ([e9c149d](https://github.com/bamiyanapp/karuta/commit/e9c149d1d18b9232f2169c18317e6186fa9cc201)), closes [#601](https://github.com/bamiyanapp/karuta/issues/601)

# [1.42.0](https://github.com/bamiyanapp/karuta/compare/v1.41.2...v1.42.0) (2026-07-17)


### Features

* **quiz-room:** 参加者一覧をルーム情報画面の下部に表形式で表示する ([#597](https://github.com/bamiyanapp/karuta/issues/597)) ([89fc5e4](https://github.com/bamiyanapp/karuta/commit/89fc5e4d7d8cd56f9f180de20572f9d00ed7cf66)), closes [#587](https://github.com/bamiyanapp/karuta/issues/587)

## [1.41.2](https://github.com/bamiyanapp/karuta/compare/v1.41.1...v1.41.2) (2026-07-17)


### Bug Fixes

* **quiz-room:** 早押し判定の正解表示・回答ボタン非活性化・連打対策を修正する ([#595](https://github.com/bamiyanapp/karuta/issues/595)) ([be3dbec](https://github.com/bamiyanapp/karuta/commit/be3dbec65817f85fe818b4d242da98e236e03099)), closes [#586](https://github.com/bamiyanapp/karuta/issues/586) [#588](https://github.com/bamiyanapp/karuta/issues/588) [#589](https://github.com/bamiyanapp/karuta/issues/589) [#590](https://github.com/bamiyanapp/karuta/issues/590)

## [1.41.1](https://github.com/bamiyanapp/karuta/compare/v1.41.0...v1.41.1) (2026-07-17)


### Bug Fixes

* **ci:** dev-standardsの参照バージョンをv1.2.3へ更新する ([#591](https://github.com/bamiyanapp/karuta/issues/591)) ([93fb4de](https://github.com/bamiyanapp/karuta/commit/93fb4de22f5d067835606fff948147ddbd833192)), closes [bamiyanapp/karuta#583](https://github.com/bamiyanapp/karuta/issues/583)

# [1.41.0](https://github.com/bamiyanapp/karuta/compare/v1.40.0...v1.41.0) (2026-07-17)


### Features

* **quiz-room:** 管理者のルーム情報表示をインラインパネルから別画面への遷移に変更する ([#580](https://github.com/bamiyanapp/karuta/issues/580)) ([53b8ee0](https://github.com/bamiyanapp/karuta/commit/53b8ee0e855d46f37179b4880fcb5173e8594e49)), closes [#547](https://github.com/bamiyanapp/karuta/issues/547) [#558](https://github.com/bamiyanapp/karuta/issues/558)

# [1.40.0](https://github.com/bamiyanapp/karuta/compare/v1.39.1...v1.40.0) (2026-07-17)


### Features

* **quiz-room:** これまでに読み上げた札一覧を開閉式にし、参加者画面にも表示する ([#578](https://github.com/bamiyanapp/karuta/issues/578)) ([908de83](https://github.com/bamiyanapp/karuta/commit/908de838ab7e6918fd5f2f157e3225c65ee0491a)), closes [#state](https://github.com/bamiyanapp/karuta/issues/state) [#548](https://github.com/bamiyanapp/karuta/issues/548)

## [1.39.1](https://github.com/bamiyanapp/karuta/compare/v1.39.0...v1.39.1) (2026-07-17)


### Bug Fixes

* **ci:** CI実行一覧でPR時点とpush-to-main時点の実行を判別できるようにする ([#572](https://github.com/bamiyanapp/karuta/issues/572)) ([7a80cd7](https://github.com/bamiyanapp/karuta/commit/7a80cd7452edbbce0162576d862d5050876e66a4)), closes [bamiyanapp/dev-standards#66](https://github.com/bamiyanapp/dev-standards/issues/66) [#558](https://github.com/bamiyanapp/karuta/issues/558)

# [1.39.0](https://github.com/bamiyanapp/karuta/compare/v1.38.0...v1.39.0) (2026-07-17)


### Features

* **e2e:** E2Eスクリーンショットを専用ブランチへ公開し確認しやすくする ([#570](https://github.com/bamiyanapp/karuta/issues/570)) ([46a82ac](https://github.com/bamiyanapp/karuta/commit/46a82ac2f1969261a4e95c52259222e5e118edf9)), closes [peaceiris/actions-#pages](https://github.com/peaceiris/actions-/issues/pages) [#541](https://github.com/bamiyanapp/karuta/issues/541) [#568](https://github.com/bamiyanapp/karuta/issues/568)

# [1.38.0](https://github.com/bamiyanapp/karuta/compare/v1.37.1...v1.38.0) (2026-07-17)


### Features

* **e2e:** PlaywrightのJSカバレッジ算出結果をログへ出力する ([#566](https://github.com/bamiyanapp/karuta/issues/566)) ([f0face1](https://github.com/bamiyanapp/karuta/commit/f0face11f57dfc6d2f6c2b61fbfbd79595897107)), closes [#541](https://github.com/bamiyanapp/karuta/issues/541)

## [1.37.1](https://github.com/bamiyanapp/karuta/compare/v1.37.0...v1.37.1) (2026-07-17)


### Bug Fixes

* **ci:** dev-standardsの参照バージョンをv1.0.2へ更新する ([#562](https://github.com/bamiyanapp/karuta/issues/562)) ([f9a99b0](https://github.com/bamiyanapp/karuta/commit/f9a99b0ae7f3b18fc47952df8b94e122136ba166)), closes [#556](https://github.com/bamiyanapp/karuta/issues/556)

# [1.37.0](https://github.com/bamiyanapp/karuta/compare/v1.36.0...v1.37.0) (2026-07-17)


### Bug Fixes

* **deps:** ルート直下のpackage-lock.json同期 + E2Eテストのロール別拡充 ([#557](https://github.com/bamiyanapp/karuta/issues/557)) ([77e4b73](https://github.com/bamiyanapp/karuta/commit/77e4b730bbca0a2771b4d79605a6cffcc456e7e1)), closes [#559](https://github.com/bamiyanapp/karuta/issues/559)


### Features

* **quiz-room:** move player-registration button next to the room button ([#556](https://github.com/bamiyanapp/karuta/issues/556)) ([d2eff4d](https://github.com/bamiyanapp/karuta/commit/d2eff4d111e1f0ae43cb330305210027001672ec)), closes [#549](https://github.com/bamiyanapp/karuta/issues/549)

# [1.36.0](https://github.com/bamiyanapp/karuta/compare/v1.35.0...v1.36.0) (2026-07-16)


### Features

* **quiz-room:** add real-time participant roster for admin and participant screens ([#553](https://github.com/bamiyanapp/karuta/issues/553)) ([2fca8e1](https://github.com/bamiyanapp/karuta/commit/2fca8e1ccd211199731f7029947d416173a86765)), closes [#545](https://github.com/bamiyanapp/karuta/issues/545)

# [1.35.0](https://github.com/bamiyanapp/karuta/compare/v1.34.5...v1.35.0) (2026-07-16)


### Features

* **quiz-room:** add admin buzz judgment modal with point award and retry exclusion ([#550](https://github.com/bamiyanapp/karuta/issues/550)) ([81dc809](https://github.com/bamiyanapp/karuta/commit/81dc8098d3d40bf23a0ae5bbe285f6f80f32bcb2)), closes [#546](https://github.com/bamiyanapp/karuta/issues/546)

## [1.34.5](https://github.com/bamiyanapp/karuta/compare/v1.34.4...v1.34.5) (2026-07-16)


### Bug Fixes

* **app:** fetchOpenQuizRoomsでresponse.okを確認してからjsonを読む ([#542](https://github.com/bamiyanapp/karuta/issues/542)) ([cee750b](https://github.com/bamiyanapp/karuta/commit/cee750b5ae5491971f520b438255b9e3ca945c01))

## [1.34.4](https://github.com/bamiyanapp/karuta/compare/v1.34.3...v1.34.4) (2026-07-16)


### Bug Fixes

* **quiz-room:** 「戻る」で離脱時にURLの?roomId=を除去する ([#539](https://github.com/bamiyanapp/karuta/issues/539)) ([cb07fac](https://github.com/bamiyanapp/karuta/commit/cb07fac27dfb9b065e2c2161509d64d7b3148f26)), closes [#532](https://github.com/bamiyanapp/karuta/issues/532)

## [1.34.3](https://github.com/bamiyanapp/karuta/compare/v1.34.2...v1.34.3) (2026-07-16)


### Bug Fixes

* **quiz-room:** 名前入力画面の間は参加者に読み上げ音声を再生しない ([#537](https://github.com/bamiyanapp/karuta/issues/537)) ([107090d](https://github.com/bamiyanapp/karuta/commit/107090d8a37bdf0600365344b673602d5138446b)), closes [#530](https://github.com/bamiyanapp/karuta/issues/530)

## [1.34.2](https://github.com/bamiyanapp/karuta/compare/v1.34.1...v1.34.2) (2026-07-16)


### Bug Fixes

* **quiz-room:** トップページに戻るたび開設中ルーム一覧を再取得する ([#535](https://github.com/bamiyanapp/karuta/issues/535)) ([302f893](https://github.com/bamiyanapp/karuta/commit/302f8931d0f93597b5c5f0f4cb63f4eabeb1378e)), closes [#531](https://github.com/bamiyanapp/karuta/issues/531)

## [1.34.1](https://github.com/bamiyanapp/karuta/compare/v1.34.0...v1.34.1) (2026-07-16)


### Bug Fixes

* **pwa:** 絵札PDF印刷画面を開いている間はオフライン利用可能メッセージを抑制する ([#529](https://github.com/bamiyanapp/karuta/issues/529)) ([90a6ca8](https://github.com/bamiyanapp/karuta/commit/90a6ca89fb15e628ab00b0e94dfe623e2d604154)), closes [#473](https://github.com/bamiyanapp/karuta/issues/473)

# [1.34.0](https://github.com/bamiyanapp/karuta/compare/v1.33.2...v1.34.0) (2026-07-16)


### Features

* **quiz-room:** 早押し機能にポイント制を追加する ([#527](https://github.com/bamiyanapp/karuta/issues/527)) ([54da304](https://github.com/bamiyanapp/karuta/commit/54da304004967ee3e0fe8186212a67cdda08ceeb)), closes [#519](https://github.com/bamiyanapp/karuta/issues/519)

## [1.33.2](https://github.com/bamiyanapp/karuta/compare/v1.33.1...v1.33.2) (2026-07-16)


### Bug Fixes

* **pwa:** PDF生成中はオフライン利用可能メッセージを抑制する ([#524](https://github.com/bamiyanapp/karuta/issues/524)) ([bd0094a](https://github.com/bamiyanapp/karuta/commit/bd0094a0cd28d43d51a2757194388de981a89115)), closes [#473](https://github.com/bamiyanapp/karuta/issues/473)

## [1.33.1](https://github.com/bamiyanapp/karuta/compare/v1.33.0...v1.33.1) (2026-07-16)


### Bug Fixes

* **quiz-room:** 開設中ルーム一覧を最新5件に制限する ([#522](https://github.com/bamiyanapp/karuta/issues/522)) ([9acf581](https://github.com/bamiyanapp/karuta/commit/9acf5811bda7429d5ba358c79842154301f9206c)), closes [#500](https://github.com/bamiyanapp/karuta/issues/500)

# [1.33.0](https://github.com/bamiyanapp/karuta/compare/v1.32.0...v1.33.0) (2026-07-16)


### Features

* **ui:** 参加者登録UIを確定モーダルから読み札画面の任意ボタンへ移動する ([#520](https://github.com/bamiyanapp/karuta/issues/520)) ([1b32b33](https://github.com/bamiyanapp/karuta/commit/1b32b33dcc9c68ac3e636723963ba7d9d99469e4)), closes [#518](https://github.com/bamiyanapp/karuta/issues/518)

# [1.32.0](https://github.com/bamiyanapp/karuta/compare/v1.31.0...v1.32.0) (2026-07-16)


### Features

* **content:** 新規カテゴリ「法則と効果かるた」を追加する ([#516](https://github.com/bamiyanapp/karuta/issues/516)) ([ee39388](https://github.com/bamiyanapp/karuta/commit/ee393880a67a32cc6966b7339863f429bea4579d))

# [1.31.0](https://github.com/bamiyanapp/karuta/compare/v1.30.2...v1.31.0) (2026-07-16)


### Features

* **quiz-room:** 早押し機能を追加する ([#511](https://github.com/bamiyanapp/karuta/issues/511)) ([863812a](https://github.com/bamiyanapp/karuta/commit/863812a19ed1c5f408c095af0cf0582949b81493))

## [1.30.2](https://github.com/bamiyanapp/karuta/compare/v1.30.1...v1.30.2) (2026-07-16)


### Bug Fixes

* **quiz-room:** 参加者側の「音声を有効にする」ボタンを廃止し、自動再生の解錠で対応する ([#508](https://github.com/bamiyanapp/karuta/issues/508)) ([a0cd206](https://github.com/bamiyanapp/karuta/commit/a0cd206b270d125f1c1781f84ade834badef3c23))

## [1.30.1](https://github.com/bamiyanapp/karuta/compare/v1.30.0...v1.30.1) (2026-07-16)


### Bug Fixes

* **quiz-room:** 管理者の設定変更が読み上げ中の音声配信とズレる競合状態を修正する ([#506](https://github.com/bamiyanapp/karuta/issues/506)) ([f0022f8](https://github.com/bamiyanapp/karuta/commit/f0022f8855dcca9ba614442a293ac701d44440c8))

# [1.30.0](https://github.com/bamiyanapp/karuta/compare/v1.29.0...v1.30.0) (2026-07-16)


### Features

* **quiz-room:** 参加者側の音声を常時オンにし、管理者の読み上げ設定に合わせる ([#504](https://github.com/bamiyanapp/karuta/issues/504)) ([866150e](https://github.com/bamiyanapp/karuta/commit/866150ecdbf067ae33d72071168b4c3aa95fe4ac))

# [1.29.0](https://github.com/bamiyanapp/karuta/compare/v1.28.0...v1.29.0) (2026-07-16)


### Features

* **quiz-room:** 参加者側でも読み上げ音声を再生できるようにする ([#495](https://github.com/bamiyanapp/karuta/issues/495)) ([dcfd304](https://github.com/bamiyanapp/karuta/commit/dcfd304e5dae0aaa5a0f5899cd75e825b539329a))

# [1.28.0](https://github.com/bamiyanapp/karuta/compare/v1.27.1...v1.28.0) (2026-07-16)


### Features

* **quiz-room:** トップページに開設中のクイズ大会ルーム一覧を表示する ([#493](https://github.com/bamiyanapp/karuta/issues/493)) ([8e6332b](https://github.com/bamiyanapp/karuta/commit/8e6332b2b7279ff75a7db619f2214781300f8719))

## [1.27.1](https://github.com/bamiyanapp/karuta/compare/v1.27.0...v1.27.1) (2026-07-16)


### Bug Fixes

* **quiz-room:** 参加者モードに「戻る」ボタンを追加する ([#491](https://github.com/bamiyanapp/karuta/issues/491)) ([015e986](https://github.com/bamiyanapp/karuta/commit/015e986bdd8fb8a8ba2729d27283a9c0641a9699))

# [1.27.0](https://github.com/bamiyanapp/karuta/compare/v1.26.2...v1.27.0) (2026-07-16)


### Features

* **e2e:** Playwright E2Eテストを導入し、CIで有効化する ([#487](https://github.com/bamiyanapp/karuta/issues/487)) ([6c668b8](https://github.com/bamiyanapp/karuta/commit/6c668b8edd046844d49998dbfb875a4cbf3cc1f6)), closes [#483](https://github.com/bamiyanapp/karuta/issues/483)

## [1.26.2](https://github.com/bamiyanapp/karuta/compare/v1.26.1...v1.26.2) (2026-07-16)


### Bug Fixes

* **quiz-room:** 参加者側の自己修復ポーリングと動線の見直し ([#485](https://github.com/bamiyanapp/karuta/issues/485)) ([7a61dfe](https://github.com/bamiyanapp/karuta/commit/7a61dfe2a843c74f085bd7e592e9cb2a95f47e38)), closes [#483](https://github.com/bamiyanapp/karuta/issues/483)

## [1.26.1](https://github.com/bamiyanapp/karuta/compare/v1.26.0...v1.26.1) (2026-07-16)


### Bug Fixes

* **quiz-room:** 接続確立前後のbroadcastStateが失われないようにする ([#483](https://github.com/bamiyanapp/karuta/issues/483)) ([b567386](https://github.com/bamiyanapp/karuta/commit/b5673865d519988fa20e621b55cb61b1ff593190))

# [1.26.0](https://github.com/bamiyanapp/karuta/compare/v1.25.1...v1.26.0) (2026-07-16)


### Features

* **quiz-room:** 通常のゲーム画面を流用し、招待URL・コピー機能を追加する ([#481](https://github.com/bamiyanapp/karuta/issues/481)) ([a174046](https://github.com/bamiyanapp/karuta/commit/a174046ccf4f512f2b508b1234a9fa1e097b8e0c))

## [1.25.1](https://github.com/bamiyanapp/karuta/compare/v1.25.0...v1.25.1) (2026-07-16)


### Bug Fixes

* **frontend:** クイズ大会モードのWebSocketエンドポイントを設定する ([#479](https://github.com/bamiyanapp/karuta/issues/479)) ([d4295bc](https://github.com/bamiyanapp/karuta/commit/d4295bc318c1a3efee5b66f7e283b45d214031f7))

# [1.25.0](https://github.com/bamiyanapp/karuta/compare/v1.24.0...v1.25.0) (2026-07-16)


### Features

* クイズ大会モード（最小構成）を追加する ([#477](https://github.com/bamiyanapp/karuta/issues/477)) ([ed95417](https://github.com/bamiyanapp/karuta/commit/ed9541796ae3058a7eb58763df7ff0a4f2764088))

# [1.24.0](https://github.com/bamiyanapp/karuta/compare/v1.23.2...v1.24.0) (2026-07-16)


### Features

* **voice:** 試験的な音声認識機能を撤去する ([#475](https://github.com/bamiyanapp/karuta/issues/475)) ([ae5142b](https://github.com/bamiyanapp/karuta/commit/ae5142b1cc6a362ca9f3f81d9b0a59e6d1a456f7))

## [1.23.2](https://github.com/bamiyanapp/karuta/compare/v1.23.1...v1.23.2) (2026-07-15)


### Bug Fixes

* **backend:** CloudFormationの循環依存でbackendデプロイが失敗するのを修正する ([#465](https://github.com/bamiyanapp/karuta/issues/465)) ([2b6ed07](https://github.com/bamiyanapp/karuta/commit/2b6ed073a46ab3b2e201f796c9946050a01443e3)), closes [#463](https://github.com/bamiyanapp/karuta/issues/463)

## [1.23.1](https://github.com/bamiyanapp/karuta/compare/v1.23.0...v1.23.1) (2026-07-14)


### Bug Fixes

* **deps:** update dependency puppeteer-core to v25 ([#463](https://github.com/bamiyanapp/karuta/issues/463)) ([8f12bdb](https://github.com/bamiyanapp/karuta/commit/8f12bdb258165a1b848cdf144fe65ab6e9b5104b))

# [1.23.0](https://github.com/bamiyanapp/karuta/compare/v1.22.9...v1.23.0) (2026-07-14)


### Features

* 絵札PDF生成をバックエンド（ヘッドレスChromium）に移行する ([#458](https://github.com/bamiyanapp/karuta/issues/458)) ([7e5fa4e](https://github.com/bamiyanapp/karuta/commit/7e5fa4e47efd30a207353996ade74e0ac9c60889))

## [1.22.9](https://github.com/bamiyanapp/karuta/compare/v1.22.8...v1.22.9) (2026-07-14)


### Bug Fixes

* **frontend:** 両面印刷時に裏面が表面と左右反転した位置になるようにする ([#455](https://github.com/bamiyanapp/karuta/issues/455)) ([2440366](https://github.com/bamiyanapp/karuta/commit/2440366e1e65081f2c58d2fefaa4b79be493fbd8))

## [1.22.8](https://github.com/bamiyanapp/karuta/compare/v1.22.7...v1.22.8) (2026-07-14)


### Bug Fixes

* **frontend:** 絵札の種別カラーを表裏・枠線を含めて統一する ([#453](https://github.com/bamiyanapp/karuta/issues/453)) ([7053828](https://github.com/bamiyanapp/karuta/commit/7053828dc257ca00c73366613ccea6d47ebcecbe)), closes [#e44d26](https://github.com/bamiyanapp/karuta/issues/e44d26)

## [1.22.7](https://github.com/bamiyanapp/karuta/compare/v1.22.6...v1.22.7) (2026-07-13)


### Bug Fixes

* **frontend:** スマートフォンでは絵札の印刷ボタンを表示しないようにする ([#449](https://github.com/bamiyanapp/karuta/issues/449)) ([2c3dbc3](https://github.com/bamiyanapp/karuta/commit/2c3dbc36dc1a49a4bed88102afda348dec84b54f))

## [1.22.6](https://github.com/bamiyanapp/karuta/compare/v1.22.5...v1.22.6) (2026-07-13)


### Bug Fixes

* **frontend:** 印刷ボタンで1ページ目しか印刷されない不具合と、PDF出力エラーの再発を修正する ([#447](https://github.com/bamiyanapp/karuta/issues/447)) ([6adc852](https://github.com/bamiyanapp/karuta/commit/6adc852978c7baee3a4c4ec830a1273c0e94820f)), closes [#442](https://github.com/bamiyanapp/karuta/issues/442) [#443](https://github.com/bamiyanapp/karuta/issues/443) [#442](https://github.com/bamiyanapp/karuta/issues/442) [#443](https://github.com/bamiyanapp/karuta/issues/443)

## [1.22.5](https://github.com/bamiyanapp/karuta/compare/v1.22.4...v1.22.5) (2026-07-13)


### Bug Fixes

* **frontend:** 絵札裏面の種別バッジの枠線を柄の色に統一する ([#439](https://github.com/bamiyanapp/karuta/issues/439)) ([efed10c](https://github.com/bamiyanapp/karuta/commit/efed10c5c6c71578275983eb1189024a4ed2c855))

## [1.22.4](https://github.com/bamiyanapp/karuta/compare/v1.22.3...v1.22.4) (2026-07-13)


### Bug Fixes

* **frontend:** 複数種別選択時に絵札裏面の柄が重複しないようにする ([#437](https://github.com/bamiyanapp/karuta/issues/437)) ([687636b](https://github.com/bamiyanapp/karuta/commit/687636b60b378d5b7753fa7b818116cfb2ef183a))

## [1.22.3](https://github.com/bamiyanapp/karuta/compare/v1.22.2...v1.22.3) (2026-07-13)


### Bug Fixes

* **frontend:** 絵札表面の読み札テキストが単語の途中で改行されるのを防ぐ ([#435](https://github.com/bamiyanapp/karuta/issues/435)) ([59894cd](https://github.com/bamiyanapp/karuta/commit/59894cdd143a0575d6ca94682aa7d1c5ae36bd8d))

## [1.22.2](https://github.com/bamiyanapp/karuta/compare/v1.22.1...v1.22.2) (2026-07-13)


### Bug Fixes

* **frontend:** 絵札裏面のレベル数値をさらに下へ・フォントを大きくする ([#433](https://github.com/bamiyanapp/karuta/issues/433)) ([c3f0764](https://github.com/bamiyanapp/karuta/commit/c3f07646486cd081a6dae2444559c9128075f904))

## [1.22.1](https://github.com/bamiyanapp/karuta/compare/v1.22.0...v1.22.1) (2026-07-13)


### Bug Fixes

* **frontend:** 絵札裏面のレベル数値をメダルの円中央寄りに大きく表示する ([#431](https://github.com/bamiyanapp/karuta/issues/431)) ([3e993b0](https://github.com/bamiyanapp/karuta/commit/3e993b0450a47afe902313d5ac1e8babf088142c))

# [1.22.0](https://github.com/bamiyanapp/karuta/compare/v1.21.0...v1.22.0) (2026-07-13)


### Features

* **frontend:** 絵札裏面のレベルバッジを🏅絵文字＋オーバーラップ数値表示に変更する ([#429](https://github.com/bamiyanapp/karuta/issues/429)) ([4bbfaa1](https://github.com/bamiyanapp/karuta/commit/4bbfaa11bfc1159d51f41baad5b0e4ffea484970))

# [1.21.0](https://github.com/bamiyanapp/karuta/compare/v1.20.8...v1.21.0) (2026-07-13)


### Features

* **frontend:** 絵札裏面のレベルバッジをコイン風デザインに変更する ([#427](https://github.com/bamiyanapp/karuta/issues/427)) ([a920774](https://github.com/bamiyanapp/karuta/commit/a9207742faea088aba936aa875db740dc6088f5d))

## [1.20.8](https://github.com/bamiyanapp/karuta/compare/v1.20.7...v1.20.8) (2026-07-13)


### Bug Fixes

* **frontend:** 絵札印刷画面の画面プレビュー縮小をzoomからtransform: scale()方式に変更する ([#423](https://github.com/bamiyanapp/karuta/issues/423)) ([e65a373](https://github.com/bamiyanapp/karuta/commit/e65a37348f9c69bc3ff86e7b3409d837568dc4ec)), closes [#414](https://github.com/bamiyanapp/karuta/issues/414) [#416](https://github.com/bamiyanapp/karuta/issues/416)

## [1.20.7](https://github.com/bamiyanapp/karuta/compare/v1.20.6...v1.20.7) (2026-07-13)


### Bug Fixes

* **frontend:** 絵札印刷画面の文字サイズをpx指定にし、画面プレビューの縮小に確実に追従させる ([#421](https://github.com/bamiyanapp/karuta/issues/421)) ([8ac7b69](https://github.com/bamiyanapp/karuta/commit/8ac7b69619c4f47b1f74fce7ebb0aff84e74e90c))

## [1.20.6](https://github.com/bamiyanapp/karuta/compare/v1.20.5...v1.20.6) (2026-07-13)


### Bug Fixes

* **frontend:** ゲーム画面の読み札で、かな丸・レベル表示の文字サイズも画面幅に応じて縮小する ([#419](https://github.com/bamiyanapp/karuta/issues/419)) ([7f02a58](https://github.com/bamiyanapp/karuta/commit/7f02a58849a4b75da32ddef1307ba98c4959f5be))

## [1.20.5](https://github.com/bamiyanapp/karuta/compare/v1.20.4...v1.20.5) (2026-07-13)


### Bug Fixes

* **frontend:** スマートフォンでの文字自動拡大を無効化する ([#416](https://github.com/bamiyanapp/karuta/issues/416)) ([2bb24c7](https://github.com/bamiyanapp/karuta/commit/2bb24c785d7ad3d319cfebf91cbb240cb9c9b74b))

## [1.20.4](https://github.com/bamiyanapp/karuta/compare/v1.20.3...v1.20.4) (2026-07-12)


### Bug Fixes

* **frontend:** 絵札印刷画面の画面プレビュー（表面）の文字サイズを抑える ([#414](https://github.com/bamiyanapp/karuta/issues/414)) ([7ff6c1e](https://github.com/bamiyanapp/karuta/commit/7ff6c1e6a3fc8f9f4870be9948b636aa80de95e7))

## [1.20.3](https://github.com/bamiyanapp/karuta/compare/v1.20.2...v1.20.3) (2026-07-12)


### Bug Fixes

* **backend:** 「モダンソフトウェア開発かるた」を「モダン開発かるた」に短縮する ([#412](https://github.com/bamiyanapp/karuta/issues/412)) ([0c50c30](https://github.com/bamiyanapp/karuta/commit/0c50c30e46a93ccdafdf9f31066a8a1cbda220d6))

## [1.20.2](https://github.com/bamiyanapp/karuta/compare/v1.20.1...v1.20.2) (2026-07-12)


### Bug Fixes

* **frontend:** 裏面の柄と外枠の間の隙間をなくす ([#410](https://github.com/bamiyanapp/karuta/issues/410)) ([a8f2da0](https://github.com/bamiyanapp/karuta/commit/a8f2da0bc300109fea46c0ec7cf3bae00b891795))

## [1.20.1](https://github.com/bamiyanapp/karuta/compare/v1.20.0...v1.20.1) (2026-07-12)


### Bug Fixes

* **frontend:** 裏面の和柄をPDFキャプチャ対応の画像方式に変更し、種別単位のランダム選択・二重枠線を修正する ([#408](https://github.com/bamiyanapp/karuta/issues/408)) ([e5b89d3](https://github.com/bamiyanapp/karuta/commit/e5b89d31687b397d9d083632ab557d7af1ea662b))

# [1.20.0](https://github.com/bamiyanapp/karuta/compare/v1.19.0...v1.20.0) (2026-07-12)


### Features

* **frontend:** 絵札裏面の和柄を5種のランダム柄に差し替え、フォントを一回り小さくする ([#406](https://github.com/bamiyanapp/karuta/issues/406)) ([ca47b1e](https://github.com/bamiyanapp/karuta/commit/ca47b1e48f402106f78a2d357784d4220231e3d6))

# [1.19.0](https://github.com/bamiyanapp/karuta/compare/v1.18.5...v1.19.0) (2026-07-12)


### Features

* **frontend:** 絵札裏面に和柄背景とメダル風レベルバッジを追加する ([#404](https://github.com/bamiyanapp/karuta/issues/404)) ([e5ccf84](https://github.com/bamiyanapp/karuta/commit/e5ccf84d11ff6830c50e61519cbfc61cd7c234b8))

## [1.18.5](https://github.com/bamiyanapp/karuta/compare/v1.18.4...v1.18.5) (2026-07-12)


### Bug Fixes

* **frontend:** 絵札PDF表面のかるた種別の文字色を黒にする ([#402](https://github.com/bamiyanapp/karuta/issues/402)) ([33243e9](https://github.com/bamiyanapp/karuta/commit/33243e9733f8517a54f796abfef61ee7eed21c65))

## [1.18.4](https://github.com/bamiyanapp/karuta/compare/v1.18.3...v1.18.4) (2026-07-12)


### Bug Fixes

* 絵札PDFダウンロードにかるた種別を表示し、Renovate PRのstale化を防ぐ ([#400](https://github.com/bamiyanapp/karuta/issues/400)) ([663eb24](https://github.com/bamiyanapp/karuta/commit/663eb24edd8c1b96494a5a4027b8667c2d965b84)), closes [#300](https://github.com/bamiyanapp/karuta/issues/300) [#303](https://github.com/bamiyanapp/karuta/issues/303) [#313](https://github.com/bamiyanapp/karuta/issues/313) [#318](https://github.com/bamiyanapp/karuta/issues/318) [#319](https://github.com/bamiyanapp/karuta/issues/319) [#322](https://github.com/bamiyanapp/karuta/issues/322) [#345](https://github.com/bamiyanapp/karuta/issues/345)

## [1.18.3](https://github.com/bamiyanapp/karuta/compare/v1.18.2...v1.18.3) (2026-07-12)


### Bug Fixes

* **cd:** dev-standards参照をタグ固定([@v1](https://github.com/v1).0.0)に変更する ([#395](https://github.com/bamiyanapp/karuta/issues/395)) ([8053116](https://github.com/bamiyanapp/karuta/commit/805311638ad3d796e9d81dc21d5ccb3907a5e1a5))

## [1.18.2](https://github.com/bamiyanapp/karuta/compare/v1.18.1...v1.18.2) (2026-07-11)


### Bug Fixes

* **frontend:** PDFダウンロード時に文字サイズが崩れる不具合を修正する ([#393](https://github.com/bamiyanapp/karuta/issues/393)) ([c2bf9ef](https://github.com/bamiyanapp/karuta/commit/c2bf9efc59769a237356c600de12a62a5b650ab5)), closes [#392](https://github.com/bamiyanapp/karuta/issues/392)

## [1.18.1](https://github.com/bamiyanapp/karuta/compare/v1.18.0...v1.18.1) (2026-07-11)


### Bug Fixes

* **frontend:** 絵札印刷プレビューが狭い画面で左側フレームアウトする問題を修正する ([#389](https://github.com/bamiyanapp/karuta/issues/389)) ([4aa45d6](https://github.com/bamiyanapp/karuta/commit/4aa45d6c3d77310d0a2844e4087bc3e177e6315b)), closes [#387](https://github.com/bamiyanapp/karuta/issues/387)

# [1.18.0](https://github.com/bamiyanapp/karuta/compare/v1.17.4...v1.18.0) (2026-07-11)


### Features

* **voice:** 音声認識で回答を判定する機能を追加する ([#386](https://github.com/bamiyanapp/karuta/issues/386)) ([e2bb53b](https://github.com/bamiyanapp/karuta/commit/e2bb53b19c910a9d29919918ef3e5b506ba8fe78)), closes [#382](https://github.com/bamiyanapp/karuta/issues/382)

## [1.17.4](https://github.com/bamiyanapp/karuta/compare/v1.17.3...v1.17.4) (2026-07-11)


### Bug Fixes

* **backend:** Renovateが再度serverlessをv4へ更新しないようにする ([#379](https://github.com/bamiyanapp/karuta/issues/379)) ([5f77862](https://github.com/bamiyanapp/karuta/commit/5f778627e8060f29f39c2a0e043692bd95d1a786)), closes [#378](https://github.com/bamiyanapp/karuta/issues/378)

## [1.17.3](https://github.com/bamiyanapp/karuta/compare/v1.17.2...v1.17.3) (2026-07-11)


### Bug Fixes

* **backend:** serverlessパッケージ自体をサインイン不要なv3系に固定する ([#376](https://github.com/bamiyanapp/karuta/issues/376)) ([c34f877](https://github.com/bamiyanapp/karuta/commit/c34f877a2e829345004ca7dbeb619ccf20e521d7)), closes [#371](https://github.com/bamiyanapp/karuta/issues/371)

## [1.17.2](https://github.com/bamiyanapp/karuta/compare/v1.17.1...v1.17.2) (2026-07-11)


### Bug Fixes

* **backend:** frameworkVersionの指定形式をバージョン解決エラーから修正する ([#374](https://github.com/bamiyanapp/karuta/issues/374)) ([ac0c7ae](https://github.com/bamiyanapp/karuta/commit/ac0c7ae47bbef96f37170ae671ab446b005290f5))

## [1.17.1](https://github.com/bamiyanapp/karuta/compare/v1.17.0...v1.17.1) (2026-07-11)


### Bug Fixes

* **backend:** Serverless FrameworkをCIでサインイン不要なv3系に固定する ([#371](https://github.com/bamiyanapp/karuta/issues/371)) ([a4fa721](https://github.com/bamiyanapp/karuta/commit/a4fa721dbddef8c31554d8f16ed3a31160f95563))

# [1.17.0](https://github.com/bamiyanapp/karuta/compare/v1.16.0...v1.17.0) (2026-07-11)


### Features

* **print:** 絵札印刷画面に裏面印刷を追加する ([#370](https://github.com/bamiyanapp/karuta/issues/370)) ([57010e6](https://github.com/bamiyanapp/karuta/commit/57010e61d4f4a0ba31a2605e790cc69da60b1f71))

# [1.16.0](https://github.com/bamiyanapp/karuta/compare/v1.15.0...v1.16.0) (2026-07-11)


### Features

* **print:** 絵札の文字サイズをさらに拡大する ([#367](https://github.com/bamiyanapp/karuta/issues/367)) ([02afa1a](https://github.com/bamiyanapp/karuta/commit/02afa1a0c91446413e35e5bd5b0ec61810343a08))

# [1.15.0](https://github.com/bamiyanapp/karuta/compare/v1.14.0...v1.15.0) (2026-07-11)


### Features

* **print:** 用紙案内にインクジェット用品番を追記する ([#366](https://github.com/bamiyanapp/karuta/issues/366)) ([347a7ad](https://github.com/bamiyanapp/karuta/commit/347a7ad9d7f2fbe780948094e370ada7c776ca84))

# [1.14.0](https://github.com/bamiyanapp/karuta/compare/v1.13.0...v1.14.0) (2026-07-11)


### Bug Fixes

* **all-phrases:** 種別フィルタも表と一緒にスクロールさせヘッダのみ固定 ([#170](https://github.com/bamiyanapp/karuta/issues/170)) ([093a1df](https://github.com/bamiyanapp/karuta/commit/093a1df279990a31cc782550b8547d3c15b385c5))
* **app:** record-time送信失敗時にエラーハンドリングを追加 ([#224](https://github.com/bamiyanapp/karuta/issues/224)) ([a897469](https://github.com/bamiyanapp/karuta/commit/a89746963b8d0aa663d919a6157aabf13bed474c))
* **backend:** かるた札のかな表記を修正 ([#150](https://github.com/bamiyanapp/karuta/issues/150)) ([e95a97a](https://github.com/bamiyanapp/karuta/commit/e95a97a4f2b7133318118cfff5557a6e02f09037))
* **backend:** 読み札変更時にPolly音声キャッシュを自動再生成する ([#156](https://github.com/bamiyanapp/karuta/issues/156)) ([31dec24](https://github.com/bamiyanapp/karuta/commit/31dec2422c8f668a5fbb3c7476871de4f71ed796))
* **cd:** changelog変換のsubmodule依存解消 ([#286](https://github.com/bamiyanapp/karuta/issues/286)) ([652fe6c](https://github.com/bamiyanapp/karuta/commit/652fe6c052982209eb9a76c392cd5e2a2203f0f0))
* **cd:** semantic-release関連inputをci.ymlからcd.ymlへ移す ([#353](https://github.com/bamiyanapp/karuta/issues/353)) ([6f4da56](https://github.com/bamiyanapp/karuta/commit/6f4da56e35af2f169ceb916117724425fe1bfc8e))
* **ci:** CDジョブの冗長ステップを削減しリリース競合を解消 ([#160](https://github.com/bamiyanapp/karuta/issues/160)) ([3a292f2](https://github.com/bamiyanapp/karuta/commit/3a292f2976400521297a6ddd4014d236de9df114)), closes [#157](https://github.com/bamiyanapp/karuta/issues/157) [#157](https://github.com/bamiyanapp/karuta/issues/157)
* **ci:** releaseブランチへのpushでCIジョブを起動しないように変更 ([#158](https://github.com/bamiyanapp/karuta/issues/158)) ([409e78d](https://github.com/bamiyanapp/karuta/commit/409e78ddc69c8828fdb865e0315cc9da451baeee))
* **ci:** releaseブランチ同期とバージョン自動リリースの不具合を修正 ([#157](https://github.com/bamiyanapp/karuta/issues/157)) ([fea6cd0](https://github.com/bamiyanapp/karuta/commit/fea6cd04fb4d6a68e6de26c7ca8b0cf01dc1f0bf)), closes [#130](https://github.com/bamiyanapp/karuta/issues/130)
* **ci:** release同期時の無駄なCI再実行と無条件デプロイを解消 ([#272](https://github.com/bamiyanapp/karuta/issues/272)) ([97c76c0](https://github.com/bamiyanapp/karuta/commit/97c76c0e881fb78a6bb46ff181e39505e2a04c6e))
* **ci:** sync-releaseジョブのchangelog.jsonマージコンフリクトを解消 ([#211](https://github.com/bamiyanapp/karuta/issues/211)) ([38bd921](https://github.com/bamiyanapp/karuta/commit/38bd9211855d6f5965d89a09df6888b1a57cf3b2))
* **deploy:** LambdaランタイムをEOL間近のnodejs18.xからnodejs20.xへ更新 ([#255](https://github.com/bamiyanapp/karuta/issues/255)) ([1703855](https://github.com/bamiyanapp/karuta/commit/1703855b915ecd2568c1db120c53d29c61660a7c))
* **deps:** update dependency csv-parse to v7 ([#323](https://github.com/bamiyanapp/karuta/issues/323)) ([28552dc](https://github.com/bamiyanapp/karuta/commit/28552dcef949a1169cf9a4fe9d08323b910d4f4c))
* **efuda:** 選択が1種別のみでも絵札印刷画面に種別名を表示 ([#179](https://github.com/bamiyanapp/karuta/issues/179)) ([b141ab5](https://github.com/bamiyanapp/karuta/commit/b141ab552a36759014ae3896706685d0f6d14648))
* **frontend:** frontend-testの慢性的なタイムアウトFlakinessを緩和 ([#268](https://github.com/bamiyanapp/karuta/issues/268)) ([3c02c8c](https://github.com/bamiyanapp/karuta/commit/3c02c8c0128b51e84d2fa5a125622bb42fd64e99)), closes [#264](https://github.com/bamiyanapp/karuta/issues/264)
* **frontend:** 低優先度issue5件をまとめて解消 ([#331](https://github.com/bamiyanapp/karuta/issues/331)) ([ca389f6](https://github.com/bamiyanapp/karuta/commit/ca389f69992553bfd1a675b02b5b2ca6ec10ad02))
* **frontend:** 停止操作後にisReadingが固定され読み上げ不能になる不具合を修正 ([#270](https://github.com/bamiyanapp/karuta/issues/270)) ([0fb6c47](https://github.com/bamiyanapp/karuta/commit/0fb6c47cea038998888a82f0c71a3482ca3f581c))
* **frontend:** 絵札印刷カードの角丸を拡大し内側の角も丸くする ([#149](https://github.com/bamiyanapp/karuta/issues/149)) ([297ae14](https://github.com/bamiyanapp/karuta/commit/297ae143ba6ece910094b7bb75aa17628b0c66d2))
* **frontend:** 絵札印刷のページ詰めとテストかるた削除 ([#148](https://github.com/bamiyanapp/karuta/issues/148)) ([5b6f584](https://github.com/bamiyanapp/karuta/commit/5b6f584c9b6b7b631234c6ed16df63bd9173d10f))
* **frontend:** 絵札印刷の用紙寸法を実測値に修正 ([#142](https://github.com/bamiyanapp/karuta/issues/142)) ([0397fab](https://github.com/bamiyanapp/karuta/commit/0397fab7113df7a3e990457bc101286fbbb813ec))
* **frontend:** 読み札カードのiOS Safariでの下端見切れを修正 ([#181](https://github.com/bamiyanapp/karuta/issues/181)) ([108c6cd](https://github.com/bamiyanapp/karuta/commit/108c6cde671d654f370b0eb1133eb9e73ae61864))
* gitぴんちかるたに変更 ([#152](https://github.com/bamiyanapp/karuta/issues/152)) ([ac2f82a](https://github.com/bamiyanapp/karuta/commit/ac2f82af8faadf7b9cf19f1c4abbcbf571bd1840))
* **handler:** CORSをフロントエンドオリジンに制限しコメント長を検証 ([#209](https://github.com/bamiyanapp/karuta/issues/209)) ([7677335](https://github.com/bamiyanapp/karuta/commit/7677335bf7d74eb9c2a67d98c39f7994753e3e63)), closes [#184](https://github.com/bamiyanapp/karuta/issues/184)
* **handler:** PollyキャッシュテーブルにTTLを追加し無限増加を防止 ([#228](https://github.com/bamiyanapp/karuta/issues/228)) ([28fb82c](https://github.com/bamiyanapp/karuta/commit/28fb82c8daba27652a4e2a0b6030e30a67dee362))
* **handler:** recordTimeの読み書きを非アトミックな平均計算からADD加算方式に修正 ([#226](https://github.com/bamiyanapp/karuta/issues/226)) ([944bcb6](https://github.com/bamiyanapp/karuta/commit/944bcb6373c4a239f1387b3ba88a0542d0f64ad8))
* **handler:** 読み札本文のSSML未エスケープとspeechRateの検証不足を修正 ([#208](https://github.com/bamiyanapp/karuta/issues/208)) ([8593858](https://github.com/bamiyanapp/karuta/commit/85938582bda2a99649fd3052f71a9d7077d70309)), closes [#183](https://github.com/bamiyanapp/karuta/issues/183)
* JavaとHTTPのかるたを大ピンチ仕様に修正 ([#155](https://github.com/bamiyanapp/karuta/issues/155)) ([6877e5f](https://github.com/bamiyanapp/karuta/commit/6877e5f263dfa1fd1aff95ee5158507df41fbf60)), closes [#152](https://github.com/bamiyanapp/karuta/issues/152)
* **phrases:** 大ピンチずかんの読み札表現を著作権配慮で変更 ([#182](https://github.com/bamiyanapp/karuta/issues/182)) ([3a3d7f9](https://github.com/bamiyanapp/karuta/commit/3a3d7f95ff2f934a917c6269f2c4886129bd897f))
* **phrases:** 百人一首の下の句をanswerに設定 ([#174](https://github.com/bamiyanapp/karuta/issues/174)) ([d78960c](https://github.com/bamiyanapp/karuta/commit/d78960ca35e28d1c8c96543c24625fc1fe2f7894))
* **print:** 絵札印刷カードの文字色を黒固定にする ([#337](https://github.com/bamiyanapp/karuta/issues/337)) ([e576741](https://github.com/bamiyanapp/karuta/commit/e5767411f03b78679abe2b9aa242fbc7753455b9)), closes [#000](https://github.com/bamiyanapp/karuta/issues/000) [#000](https://github.com/bamiyanapp/karuta/issues/000) [#000](https://github.com/bamiyanapp/karuta/issues/000)
* **reading:** リピート再生で読み上げ計測の開始点がリセットされる不具合を修正 ([#206](https://github.com/bamiyanapp/karuta/issues/206)) ([c3701a5](https://github.com/bamiyanapp/karuta/commit/c3701a535b30ac0f2210ac07dbff459aabadd9a7)), closes [#132](https://github.com/bamiyanapp/karuta/issues/132) [#131](https://github.com/bamiyanapp/karuta/issues/131)
* **record-time:** 読み上げ経過時間の異常値が統計を汚染しないよう上限チェックを追加 ([#207](https://github.com/bamiyanapp/karuta/issues/207)) ([6afc7b3](https://github.com/bamiyanapp/karuta/commit/6afc7b3e63db4f555ba02232e343e68023d5f6d1)), closes [#132](https://github.com/bamiyanapp/karuta/issues/132)
* settings更新 ([#164](https://github.com/bamiyanapp/karuta/issues/164)) ([f2932a2](https://github.com/bamiyanapp/karuta/commit/f2932a23ae34e0062e5add82f3d4e253327ca60a))
* update cd.yml ([#138](https://github.com/bamiyanapp/karuta/issues/138)) ([5e37f6c](https://github.com/bamiyanapp/karuta/commit/5e37f6cd98d36671777005356fe232fe1c53df7a))
* update phrases.csv ([#135](https://github.com/bamiyanapp/karuta/issues/135)) ([72af825](https://github.com/bamiyanapp/karuta/commit/72af825a59977e8b9c169d2dd1d5d46d0d678806))
* オリジナルかるたは所持確認を不要にする ([899b8c3](https://github.com/bamiyanapp/karuta/commit/899b8c30319e21898df6d89d712e5000042f6629))
* バージョン重複エラーの対応 ([#136](https://github.com/bamiyanapp/karuta/issues/136)) ([761614e](https://github.com/bamiyanapp/karuta/commit/761614e04de7860a8977dc69a92c04dd972433a6))
* 低優先度バグ3件（[#191](https://github.com/bamiyanapp/karuta/issues/191), [#229](https://github.com/bamiyanapp/karuta/issues/229), [#230](https://github.com/bamiyanapp/karuta/issues/230)）を修正 ([#232](https://github.com/bamiyanapp/karuta/issues/232)) ([dab199e](https://github.com/bamiyanapp/karuta/commit/dab199ecb31546e203b2234e907451ec61f61cba))
* 空コミット ([#134](https://github.com/bamiyanapp/karuta/issues/134)) ([3aacb43](https://github.com/bamiyanapp/karuta/commit/3aacb43d57cb76dd9186e94d80adf30924fedbe8))
* 読み札の誤りを修正 ([#129](https://github.com/bamiyanapp/karuta/issues/129)) ([ce53f25](https://github.com/bamiyanapp/karuta/commit/ce53f2577ac836a88a4966aa2d3c6e010dceb273))


### Features

* **all-phrases:** 全札一覧にテキスト検索機能を追加する ([#340](https://github.com/bamiyanapp/karuta/issues/340)) ([5c6a779](https://github.com/bamiyanapp/karuta/commit/5c6a7792fdbf96f22b7b36ac521f96ef18b24788))
* **all-phrases:** 種別フィルタ追加とヘッダ固定表示 ([#168](https://github.com/bamiyanapp/karuta/issues/168)) ([bf3860d](https://github.com/bamiyanapp/karuta/commit/bf3860d2b5dcd4accd950e8ac734823250ff3aa3))
* **auto-advance:** 自動読み上げモード（ハンズフリー進行）を追加 ([#247](https://github.com/bamiyanapp/karuta/issues/247)) ([a2b0ee5](https://github.com/bamiyanapp/karuta/commit/a2b0ee565f35d40b22ebc72595acbcdc28ecd495))
* **backend:** おばけ・いろはかるたの答えデータを追加 ([#143](https://github.com/bamiyanapp/karuta/issues/143)) ([69cde86](https://github.com/bamiyanapp/karuta/commit/69cde8617d3665fe135cf1e805fc9775435921ee))
* **backend:** セキュリティ・Webアプリ・Windowsショートカットかるたを追加 ([#145](https://github.com/bamiyanapp/karuta/issues/145)) ([1ca8f1e](https://github.com/bamiyanapp/karuta/commit/1ca8f1e0cb6e9455bb5c01c00d5169e16a8ccb50))
* **category:** こども向け選択をワンタップで読み上げ画面へ遷移 ([#237](https://github.com/bamiyanapp/karuta/issues/237)) ([be53413](https://github.com/bamiyanapp/karuta/commit/be53413d91d9054c75080441611d95f19fae2dfa))
* **cd:** releaseジョブをdev-standardsのreusable workflowに置換 ([#282](https://github.com/bamiyanapp/karuta/issues/282)) ([d1a2f22](https://github.com/bamiyanapp/karuta/commit/d1a2f221fdeb90eb411f11aecb26b8714d9f5e2d))
* ci.ymlをdev-standardsのreusable workflow呼び出しに縮小 ([#280](https://github.com/bamiyanapp/karuta/issues/280)) ([1b4e0db](https://github.com/bamiyanapp/karuta/commit/1b4e0db4c04d732e3e3df9374f5cf99efa635eff))
* **ci:** CI自動マージを無効化し人手マージ運用に変更 ([b392dfc](https://github.com/bamiyanapp/karuta/commit/b392dfc6ad514784de4d7d73883785cf85773b5d))
* **ci:** マージ前バージョン更新方式への追従 ([#294](https://github.com/bamiyanapp/karuta/issues/294)) ([225e990](https://github.com/bamiyanapp/karuta/commit/225e990538908abde1d54541449b4aac6afeca73))
* **claude:** dev-standardsの残り9スキルをシンボリックリンクで同期 ([#330](https://github.com/bamiyanapp/karuta/issues/330)) ([644caec](https://github.com/bamiyanapp/karuta/commit/644caec74daa9b8bb3761429dedabea62e32b7f6))
* **detail:** 詳細画面にその札への既存の指摘一覧を表示する ([#341](https://github.com/bamiyanapp/karuta/issues/341)) ([7cfa188](https://github.com/bamiyanapp/karuta/commit/7cfa18864663e8fc60906f83814c329cb84bf0f0))
* **frontend:** PWAの更新検知とプロンプトUIの追加 ([#162](https://github.com/bamiyanapp/karuta/issues/162)) ([dd45840](https://github.com/bamiyanapp/karuta/commit/dd458402cb8051d104ac7f389ae69e2545e11dbc))
* **frontend:** かるた選択画面を複数選択対応に変更 ([#146](https://github.com/bamiyanapp/karuta/issues/146)) ([391bc1f](https://github.com/bamiyanapp/karuta/commit/391bc1f10df77e60ae01a8c9352f246fee3e9f88))
* **frontend:** 結果画面と全札一覧に答えを表示 ([#144](https://github.com/bamiyanapp/karuta/issues/144)) ([e7a202c](https://github.com/bamiyanapp/karuta/commit/e7a202c5c58bb1e6408689cd46314bf2214c9159))
* **frontend:** 絵札印刷の枠線を太く・角丸にし用紙情報にリンクを追加 ([#147](https://github.com/bamiyanapp/karuta/issues/147)) ([1c549e4](https://github.com/bamiyanapp/karuta/commit/1c549e45f120b56cd74ef3bea1d14c95f9a3d440))
* **frontend:** 絵札印刷画面を追加 ([#141](https://github.com/bamiyanapp/karuta/issues/141)) ([d4d09f8](https://github.com/bamiyanapp/karuta/commit/d4d09f8bfaa219d1a4656befd1e4595f2e9f65ee))
* **frontend:** 詳細・報告画面に答えを表示する ([#159](https://github.com/bamiyanapp/karuta/issues/159)) ([314cdf0](https://github.com/bamiyanapp/karuta/commit/314cdf011f65ae045f1984df8bd4c861c3cb25c2))
* **game:** ゲーム画面に残り札数・進捗表示を追加 ([#234](https://github.com/bamiyanapp/karuta/issues/234)) ([33618e1](https://github.com/bamiyanapp/karuta/commit/33618e137d18b316198472465098b7e4f5ad9760))
* **game:** ゲーム画面表示中はWake Lock APIで画面スリープを防止する ([#339](https://github.com/bamiyanapp/karuta/issues/339)) ([36a9875](https://github.com/bamiyanapp/karuta/commit/36a9875c9f9b5785a14381d84a97423851306158))
* **game:** こども向けモードの読み札表示を最適化 ([#239](https://github.com/bamiyanapp/karuta/issues/239)) ([59a47a0](https://github.com/bamiyanapp/karuta/commit/59a47a08f7e820ef68a2da5ef8f38285755aa492))
* **history:** 読み上げ履歴をsessionStorageに永続化 ([#241](https://github.com/bamiyanapp/karuta/issues/241)) ([e48a146](https://github.com/bamiyanapp/karuta/commit/e48a146182b752a10d3d24b8fa81e50f38ac8831))
* IT技術かるた7テーマを追加(HTTP/Linux/Git/SQL/AWS/Java/コードレビュー) ([#140](https://github.com/bamiyanapp/karuta/issues/140)) ([f213b98](https://github.com/bamiyanapp/karuta/commit/f213b9891d8181e230ec197e7b2fe618724a2af0))
* **karuta:** モダンソフトウェア開発かるたを項番2001から追加 ([#288](https://github.com/bamiyanapp/karuta/issues/288)) ([2e6a963](https://github.com/bamiyanapp/karuta/commit/2e6a963481a5488b5d89f52218155e437275bc14))
* **print:** 絵札の文字サイズをさらに拡大する ([#359](https://github.com/bamiyanapp/karuta/issues/359)) ([f41bbc2](https://github.com/bamiyanapp/karuta/commit/f41bbc205345749efc84a337de1af3b92bee3781))
* **print:** 絵札印刷画面にPDFダウンロード機能を追加する ([#343](https://github.com/bamiyanapp/karuta/issues/343)) ([1cdcc9f](https://github.com/bamiyanapp/karuta/commit/1cdcc9fd3db380eb5e207a918b8956e8494d2cdf))
* **pwa:** ホーム画面追加導線をSafari/Android向けに追加 ([#253](https://github.com/bamiyanapp/karuta/issues/253)) ([80c78e6](https://github.com/bamiyanapp/karuta/commit/80c78e6c84ca6bf5d20686f98c297e878ba32612))
* **reading:** 次の札の音声をプリフェッチして待ち時間を削減 ([#245](https://github.com/bamiyanapp/karuta/issues/245)) ([f80c86d](https://github.com/bamiyanapp/karuta/commit/f80c86d726b846cf83b48666fa7c4a095b306d50))
* **reading:** 複数種別選択時に読み上げ末尾でかるた種別を読み上げる ([#172](https://github.com/bamiyanapp/karuta/issues/172)) ([c15a729](https://github.com/bamiyanapp/karuta/commit/c15a729879b165e862ca25ac6001b3a5ca8edca4))
* **reading:** 読み上げ中に停止できる機能を追加 ([#243](https://github.com/bamiyanapp/karuta/issues/243)) ([2159ff0](https://github.com/bamiyanapp/karuta/commit/2159ff0d5a25545bf7caafd5471103c55a48f563))
* **result:** 読了時のリザルト画面にセッションサマリーと紙吹雪演出を追加 ([#249](https://github.com/bamiyanapp/karuta/issues/249)) ([ed6771c](https://github.com/bamiyanapp/karuta/commit/ed6771ce256ccc091e695e2606992552bc8793fa))
* **score:** プレイヤー別の取り札スコア記録機能を追加 ([#251](https://github.com/bamiyanapp/karuta/issues/251)) ([627c875](https://github.com/bamiyanapp/karuta/commit/627c875c4f81947375539425cda73478cda58449))
* **test:** phrases.csvデータ整合性・かな整合・レベルユニーク性テストの追加とCSVデータ修正 ([#166](https://github.com/bamiyanapp/karuta/issues/166)) ([bd566f1](https://github.com/bamiyanapp/karuta/commit/bd566f1bc1a011041060ae7454b12fe477afaac2))
* **ui:** OS設定に自動追従するダークモードを追加 ([#176](https://github.com/bamiyanapp/karuta/issues/176)) ([ba5f084](https://github.com/bamiyanapp/karuta/commit/ba5f08473a36d648671d87044f7fa1e0030d608e))
* **voice:** 読み上げボイスを選択できるようにする ([#342](https://github.com/bamiyanapp/karuta/issues/342)) ([0502b1d](https://github.com/bamiyanapp/karuta/commit/0502b1dda74a2882f37b21323b12638ec024318b))
* こども向け/エンジニア向けの区分選択機能を追加 ([#151](https://github.com/bamiyanapp/karuta/issues/151)) ([819475d](https://github.com/bamiyanapp/karuta/commit/819475da6b93c250aca8795fd4970d6d9383fcdb))
* 開発ルールをdev-standardsに共通化しsubmoduleで参照 ([#278](https://github.com/bamiyanapp/karuta/issues/278)) ([7457832](https://github.com/bamiyanapp/karuta/commit/745783203e484df27a3301d478d10aaf762acdb2))


### Reverts

* **ci:** CI自動マージ無効化を取り消し元の自動マージ運用に戻す ([#329](https://github.com/bamiyanapp/karuta/issues/329)) ([f1a371f](https://github.com/bamiyanapp/karuta/commit/f1a371f4b5937a7a8080e407eae9596761bf5a83))

# [1.14.0](https://github.com/bamiyanapp/karuta/compare/v1.13.0...v1.14.0) (2026-07-11)


### Bug Fixes

* **all-phrases:** 種別フィルタも表と一緒にスクロールさせヘッダのみ固定 ([#170](https://github.com/bamiyanapp/karuta/issues/170)) ([093a1df](https://github.com/bamiyanapp/karuta/commit/093a1df279990a31cc782550b8547d3c15b385c5))
* **app:** record-time送信失敗時にエラーハンドリングを追加 ([#224](https://github.com/bamiyanapp/karuta/issues/224)) ([a897469](https://github.com/bamiyanapp/karuta/commit/a89746963b8d0aa663d919a6157aabf13bed474c))
* **backend:** かるた札のかな表記を修正 ([#150](https://github.com/bamiyanapp/karuta/issues/150)) ([e95a97a](https://github.com/bamiyanapp/karuta/commit/e95a97a4f2b7133318118cfff5557a6e02f09037))
* **backend:** 読み札変更時にPolly音声キャッシュを自動再生成する ([#156](https://github.com/bamiyanapp/karuta/issues/156)) ([31dec24](https://github.com/bamiyanapp/karuta/commit/31dec2422c8f668a5fbb3c7476871de4f71ed796))
* **cd:** changelog変換のsubmodule依存解消 ([#286](https://github.com/bamiyanapp/karuta/issues/286)) ([652fe6c](https://github.com/bamiyanapp/karuta/commit/652fe6c052982209eb9a76c392cd5e2a2203f0f0))
* **cd:** semantic-release関連inputをci.ymlからcd.ymlへ移す ([#353](https://github.com/bamiyanapp/karuta/issues/353)) ([6f4da56](https://github.com/bamiyanapp/karuta/commit/6f4da56e35af2f169ceb916117724425fe1bfc8e))
* **ci:** CDジョブの冗長ステップを削減しリリース競合を解消 ([#160](https://github.com/bamiyanapp/karuta/issues/160)) ([3a292f2](https://github.com/bamiyanapp/karuta/commit/3a292f2976400521297a6ddd4014d236de9df114)), closes [#157](https://github.com/bamiyanapp/karuta/issues/157) [#157](https://github.com/bamiyanapp/karuta/issues/157)
* **ci:** releaseブランチへのpushでCIジョブを起動しないように変更 ([#158](https://github.com/bamiyanapp/karuta/issues/158)) ([409e78d](https://github.com/bamiyanapp/karuta/commit/409e78ddc69c8828fdb865e0315cc9da451baeee))
* **ci:** releaseブランチ同期とバージョン自動リリースの不具合を修正 ([#157](https://github.com/bamiyanapp/karuta/issues/157)) ([fea6cd0](https://github.com/bamiyanapp/karuta/commit/fea6cd04fb4d6a68e6de26c7ca8b0cf01dc1f0bf)), closes [#130](https://github.com/bamiyanapp/karuta/issues/130)
* **ci:** release同期時の無駄なCI再実行と無条件デプロイを解消 ([#272](https://github.com/bamiyanapp/karuta/issues/272)) ([97c76c0](https://github.com/bamiyanapp/karuta/commit/97c76c0e881fb78a6bb46ff181e39505e2a04c6e))
* **ci:** sync-releaseジョブのchangelog.jsonマージコンフリクトを解消 ([#211](https://github.com/bamiyanapp/karuta/issues/211)) ([38bd921](https://github.com/bamiyanapp/karuta/commit/38bd9211855d6f5965d89a09df6888b1a57cf3b2))
* **deploy:** LambdaランタイムをEOL間近のnodejs18.xからnodejs20.xへ更新 ([#255](https://github.com/bamiyanapp/karuta/issues/255)) ([1703855](https://github.com/bamiyanapp/karuta/commit/1703855b915ecd2568c1db120c53d29c61660a7c))
* **deps:** update dependency csv-parse to v7 ([#323](https://github.com/bamiyanapp/karuta/issues/323)) ([28552dc](https://github.com/bamiyanapp/karuta/commit/28552dcef949a1169cf9a4fe9d08323b910d4f4c))
* **efuda:** 選択が1種別のみでも絵札印刷画面に種別名を表示 ([#179](https://github.com/bamiyanapp/karuta/issues/179)) ([b141ab5](https://github.com/bamiyanapp/karuta/commit/b141ab552a36759014ae3896706685d0f6d14648))
* **frontend:** frontend-testの慢性的なタイムアウトFlakinessを緩和 ([#268](https://github.com/bamiyanapp/karuta/issues/268)) ([3c02c8c](https://github.com/bamiyanapp/karuta/commit/3c02c8c0128b51e84d2fa5a125622bb42fd64e99)), closes [#264](https://github.com/bamiyanapp/karuta/issues/264)
* **frontend:** 低優先度issue5件をまとめて解消 ([#331](https://github.com/bamiyanapp/karuta/issues/331)) ([ca389f6](https://github.com/bamiyanapp/karuta/commit/ca389f69992553bfd1a675b02b5b2ca6ec10ad02))
* **frontend:** 停止操作後にisReadingが固定され読み上げ不能になる不具合を修正 ([#270](https://github.com/bamiyanapp/karuta/issues/270)) ([0fb6c47](https://github.com/bamiyanapp/karuta/commit/0fb6c47cea038998888a82f0c71a3482ca3f581c))
* **frontend:** 絵札印刷カードの角丸を拡大し内側の角も丸くする ([#149](https://github.com/bamiyanapp/karuta/issues/149)) ([297ae14](https://github.com/bamiyanapp/karuta/commit/297ae143ba6ece910094b7bb75aa17628b0c66d2))
* **frontend:** 絵札印刷のページ詰めとテストかるた削除 ([#148](https://github.com/bamiyanapp/karuta/issues/148)) ([5b6f584](https://github.com/bamiyanapp/karuta/commit/5b6f584c9b6b7b631234c6ed16df63bd9173d10f))
* **frontend:** 絵札印刷の用紙寸法を実測値に修正 ([#142](https://github.com/bamiyanapp/karuta/issues/142)) ([0397fab](https://github.com/bamiyanapp/karuta/commit/0397fab7113df7a3e990457bc101286fbbb813ec))
* **frontend:** 読み札カードのiOS Safariでの下端見切れを修正 ([#181](https://github.com/bamiyanapp/karuta/issues/181)) ([108c6cd](https://github.com/bamiyanapp/karuta/commit/108c6cde671d654f370b0eb1133eb9e73ae61864))
* gitぴんちかるたに変更 ([#152](https://github.com/bamiyanapp/karuta/issues/152)) ([ac2f82a](https://github.com/bamiyanapp/karuta/commit/ac2f82af8faadf7b9cf19f1c4abbcbf571bd1840))
* **handler:** CORSをフロントエンドオリジンに制限しコメント長を検証 ([#209](https://github.com/bamiyanapp/karuta/issues/209)) ([7677335](https://github.com/bamiyanapp/karuta/commit/7677335bf7d74eb9c2a67d98c39f7994753e3e63)), closes [#184](https://github.com/bamiyanapp/karuta/issues/184)
* **handler:** PollyキャッシュテーブルにTTLを追加し無限増加を防止 ([#228](https://github.com/bamiyanapp/karuta/issues/228)) ([28fb82c](https://github.com/bamiyanapp/karuta/commit/28fb82c8daba27652a4e2a0b6030e30a67dee362))
* **handler:** recordTimeの読み書きを非アトミックな平均計算からADD加算方式に修正 ([#226](https://github.com/bamiyanapp/karuta/issues/226)) ([944bcb6](https://github.com/bamiyanapp/karuta/commit/944bcb6373c4a239f1387b3ba88a0542d0f64ad8))
* **handler:** 読み札本文のSSML未エスケープとspeechRateの検証不足を修正 ([#208](https://github.com/bamiyanapp/karuta/issues/208)) ([8593858](https://github.com/bamiyanapp/karuta/commit/85938582bda2a99649fd3052f71a9d7077d70309)), closes [#183](https://github.com/bamiyanapp/karuta/issues/183)
* JavaとHTTPのかるたを大ピンチ仕様に修正 ([#155](https://github.com/bamiyanapp/karuta/issues/155)) ([6877e5f](https://github.com/bamiyanapp/karuta/commit/6877e5f263dfa1fd1aff95ee5158507df41fbf60)), closes [#152](https://github.com/bamiyanapp/karuta/issues/152)
* **phrases:** 大ピンチずかんの読み札表現を著作権配慮で変更 ([#182](https://github.com/bamiyanapp/karuta/issues/182)) ([3a3d7f9](https://github.com/bamiyanapp/karuta/commit/3a3d7f95ff2f934a917c6269f2c4886129bd897f))
* **phrases:** 百人一首の下の句をanswerに設定 ([#174](https://github.com/bamiyanapp/karuta/issues/174)) ([d78960c](https://github.com/bamiyanapp/karuta/commit/d78960ca35e28d1c8c96543c24625fc1fe2f7894))
* **print:** 絵札印刷カードの文字色を黒固定にする ([#337](https://github.com/bamiyanapp/karuta/issues/337)) ([e576741](https://github.com/bamiyanapp/karuta/commit/e5767411f03b78679abe2b9aa242fbc7753455b9)), closes [#000](https://github.com/bamiyanapp/karuta/issues/000) [#000](https://github.com/bamiyanapp/karuta/issues/000) [#000](https://github.com/bamiyanapp/karuta/issues/000)
* **reading:** リピート再生で読み上げ計測の開始点がリセットされる不具合を修正 ([#206](https://github.com/bamiyanapp/karuta/issues/206)) ([c3701a5](https://github.com/bamiyanapp/karuta/commit/c3701a535b30ac0f2210ac07dbff459aabadd9a7)), closes [#132](https://github.com/bamiyanapp/karuta/issues/132) [#131](https://github.com/bamiyanapp/karuta/issues/131)
* **record-time:** 読み上げ経過時間の異常値が統計を汚染しないよう上限チェックを追加 ([#207](https://github.com/bamiyanapp/karuta/issues/207)) ([6afc7b3](https://github.com/bamiyanapp/karuta/commit/6afc7b3e63db4f555ba02232e343e68023d5f6d1)), closes [#132](https://github.com/bamiyanapp/karuta/issues/132)
* settings更新 ([#164](https://github.com/bamiyanapp/karuta/issues/164)) ([f2932a2](https://github.com/bamiyanapp/karuta/commit/f2932a23ae34e0062e5add82f3d4e253327ca60a))
* update cd.yml ([#138](https://github.com/bamiyanapp/karuta/issues/138)) ([5e37f6c](https://github.com/bamiyanapp/karuta/commit/5e37f6cd98d36671777005356fe232fe1c53df7a))
* update phrases.csv ([#135](https://github.com/bamiyanapp/karuta/issues/135)) ([72af825](https://github.com/bamiyanapp/karuta/commit/72af825a59977e8b9c169d2dd1d5d46d0d678806))
* オリジナルかるたは所持確認を不要にする ([899b8c3](https://github.com/bamiyanapp/karuta/commit/899b8c30319e21898df6d89d712e5000042f6629))
* バージョン重複エラーの対応 ([#136](https://github.com/bamiyanapp/karuta/issues/136)) ([761614e](https://github.com/bamiyanapp/karuta/commit/761614e04de7860a8977dc69a92c04dd972433a6))
* 低優先度バグ3件（[#191](https://github.com/bamiyanapp/karuta/issues/191), [#229](https://github.com/bamiyanapp/karuta/issues/229), [#230](https://github.com/bamiyanapp/karuta/issues/230)）を修正 ([#232](https://github.com/bamiyanapp/karuta/issues/232)) ([dab199e](https://github.com/bamiyanapp/karuta/commit/dab199ecb31546e203b2234e907451ec61f61cba))
* 空コミット ([#134](https://github.com/bamiyanapp/karuta/issues/134)) ([3aacb43](https://github.com/bamiyanapp/karuta/commit/3aacb43d57cb76dd9186e94d80adf30924fedbe8))
* 読み札の誤りを修正 ([#129](https://github.com/bamiyanapp/karuta/issues/129)) ([ce53f25](https://github.com/bamiyanapp/karuta/commit/ce53f2577ac836a88a4966aa2d3c6e010dceb273))


### Features

* **all-phrases:** 全札一覧にテキスト検索機能を追加する ([#340](https://github.com/bamiyanapp/karuta/issues/340)) ([5c6a779](https://github.com/bamiyanapp/karuta/commit/5c6a7792fdbf96f22b7b36ac521f96ef18b24788))
* **all-phrases:** 種別フィルタ追加とヘッダ固定表示 ([#168](https://github.com/bamiyanapp/karuta/issues/168)) ([bf3860d](https://github.com/bamiyanapp/karuta/commit/bf3860d2b5dcd4accd950e8ac734823250ff3aa3))
* **auto-advance:** 自動読み上げモード（ハンズフリー進行）を追加 ([#247](https://github.com/bamiyanapp/karuta/issues/247)) ([a2b0ee5](https://github.com/bamiyanapp/karuta/commit/a2b0ee565f35d40b22ebc72595acbcdc28ecd495))
* **backend:** おばけ・いろはかるたの答えデータを追加 ([#143](https://github.com/bamiyanapp/karuta/issues/143)) ([69cde86](https://github.com/bamiyanapp/karuta/commit/69cde8617d3665fe135cf1e805fc9775435921ee))
* **backend:** セキュリティ・Webアプリ・Windowsショートカットかるたを追加 ([#145](https://github.com/bamiyanapp/karuta/issues/145)) ([1ca8f1e](https://github.com/bamiyanapp/karuta/commit/1ca8f1e0cb6e9455bb5c01c00d5169e16a8ccb50))
* **category:** こども向け選択をワンタップで読み上げ画面へ遷移 ([#237](https://github.com/bamiyanapp/karuta/issues/237)) ([be53413](https://github.com/bamiyanapp/karuta/commit/be53413d91d9054c75080441611d95f19fae2dfa))
* **cd:** releaseジョブをdev-standardsのreusable workflowに置換 ([#282](https://github.com/bamiyanapp/karuta/issues/282)) ([d1a2f22](https://github.com/bamiyanapp/karuta/commit/d1a2f221fdeb90eb411f11aecb26b8714d9f5e2d))
* ci.ymlをdev-standardsのreusable workflow呼び出しに縮小 ([#280](https://github.com/bamiyanapp/karuta/issues/280)) ([1b4e0db](https://github.com/bamiyanapp/karuta/commit/1b4e0db4c04d732e3e3df9374f5cf99efa635eff))
* **ci:** CI自動マージを無効化し人手マージ運用に変更 ([b392dfc](https://github.com/bamiyanapp/karuta/commit/b392dfc6ad514784de4d7d73883785cf85773b5d))
* **ci:** マージ前バージョン更新方式への追従 ([#294](https://github.com/bamiyanapp/karuta/issues/294)) ([225e990](https://github.com/bamiyanapp/karuta/commit/225e990538908abde1d54541449b4aac6afeca73))
* **claude:** dev-standardsの残り9スキルをシンボリックリンクで同期 ([#330](https://github.com/bamiyanapp/karuta/issues/330)) ([644caec](https://github.com/bamiyanapp/karuta/commit/644caec74daa9b8bb3761429dedabea62e32b7f6))
* **detail:** 詳細画面にその札への既存の指摘一覧を表示する ([#341](https://github.com/bamiyanapp/karuta/issues/341)) ([7cfa188](https://github.com/bamiyanapp/karuta/commit/7cfa18864663e8fc60906f83814c329cb84bf0f0))
* **frontend:** PWAの更新検知とプロンプトUIの追加 ([#162](https://github.com/bamiyanapp/karuta/issues/162)) ([dd45840](https://github.com/bamiyanapp/karuta/commit/dd458402cb8051d104ac7f389ae69e2545e11dbc))
* **frontend:** かるた選択画面を複数選択対応に変更 ([#146](https://github.com/bamiyanapp/karuta/issues/146)) ([391bc1f](https://github.com/bamiyanapp/karuta/commit/391bc1f10df77e60ae01a8c9352f246fee3e9f88))
* **frontend:** 結果画面と全札一覧に答えを表示 ([#144](https://github.com/bamiyanapp/karuta/issues/144)) ([e7a202c](https://github.com/bamiyanapp/karuta/commit/e7a202c5c58bb1e6408689cd46314bf2214c9159))
* **frontend:** 絵札印刷の枠線を太く・角丸にし用紙情報にリンクを追加 ([#147](https://github.com/bamiyanapp/karuta/issues/147)) ([1c549e4](https://github.com/bamiyanapp/karuta/commit/1c549e45f120b56cd74ef3bea1d14c95f9a3d440))
* **frontend:** 絵札印刷画面を追加 ([#141](https://github.com/bamiyanapp/karuta/issues/141)) ([d4d09f8](https://github.com/bamiyanapp/karuta/commit/d4d09f8bfaa219d1a4656befd1e4595f2e9f65ee))
* **frontend:** 詳細・報告画面に答えを表示する ([#159](https://github.com/bamiyanapp/karuta/issues/159)) ([314cdf0](https://github.com/bamiyanapp/karuta/commit/314cdf011f65ae045f1984df8bd4c861c3cb25c2))
* **game:** ゲーム画面に残り札数・進捗表示を追加 ([#234](https://github.com/bamiyanapp/karuta/issues/234)) ([33618e1](https://github.com/bamiyanapp/karuta/commit/33618e137d18b316198472465098b7e4f5ad9760))
* **game:** ゲーム画面表示中はWake Lock APIで画面スリープを防止する ([#339](https://github.com/bamiyanapp/karuta/issues/339)) ([36a9875](https://github.com/bamiyanapp/karuta/commit/36a9875c9f9b5785a14381d84a97423851306158))
* **game:** こども向けモードの読み札表示を最適化 ([#239](https://github.com/bamiyanapp/karuta/issues/239)) ([59a47a0](https://github.com/bamiyanapp/karuta/commit/59a47a08f7e820ef68a2da5ef8f38285755aa492))
* **history:** 読み上げ履歴をsessionStorageに永続化 ([#241](https://github.com/bamiyanapp/karuta/issues/241)) ([e48a146](https://github.com/bamiyanapp/karuta/commit/e48a146182b752a10d3d24b8fa81e50f38ac8831))
* IT技術かるた7テーマを追加(HTTP/Linux/Git/SQL/AWS/Java/コードレビュー) ([#140](https://github.com/bamiyanapp/karuta/issues/140)) ([f213b98](https://github.com/bamiyanapp/karuta/commit/f213b9891d8181e230ec197e7b2fe618724a2af0))
* **karuta:** モダンソフトウェア開発かるたを項番2001から追加 ([#288](https://github.com/bamiyanapp/karuta/issues/288)) ([2e6a963](https://github.com/bamiyanapp/karuta/commit/2e6a963481a5488b5d89f52218155e437275bc14))
* **print:** 絵札印刷画面にPDFダウンロード機能を追加する ([#343](https://github.com/bamiyanapp/karuta/issues/343)) ([1cdcc9f](https://github.com/bamiyanapp/karuta/commit/1cdcc9fd3db380eb5e207a918b8956e8494d2cdf))
* **pwa:** ホーム画面追加導線をSafari/Android向けに追加 ([#253](https://github.com/bamiyanapp/karuta/issues/253)) ([80c78e6](https://github.com/bamiyanapp/karuta/commit/80c78e6c84ca6bf5d20686f98c297e878ba32612))
* **reading:** 次の札の音声をプリフェッチして待ち時間を削減 ([#245](https://github.com/bamiyanapp/karuta/issues/245)) ([f80c86d](https://github.com/bamiyanapp/karuta/commit/f80c86d726b846cf83b48666fa7c4a095b306d50))
* **reading:** 複数種別選択時に読み上げ末尾でかるた種別を読み上げる ([#172](https://github.com/bamiyanapp/karuta/issues/172)) ([c15a729](https://github.com/bamiyanapp/karuta/commit/c15a729879b165e862ca25ac6001b3a5ca8edca4))
* **reading:** 読み上げ中に停止できる機能を追加 ([#243](https://github.com/bamiyanapp/karuta/issues/243)) ([2159ff0](https://github.com/bamiyanapp/karuta/commit/2159ff0d5a25545bf7caafd5471103c55a48f563))
* **result:** 読了時のリザルト画面にセッションサマリーと紙吹雪演出を追加 ([#249](https://github.com/bamiyanapp/karuta/issues/249)) ([ed6771c](https://github.com/bamiyanapp/karuta/commit/ed6771ce256ccc091e695e2606992552bc8793fa))
* **score:** プレイヤー別の取り札スコア記録機能を追加 ([#251](https://github.com/bamiyanapp/karuta/issues/251)) ([627c875](https://github.com/bamiyanapp/karuta/commit/627c875c4f81947375539425cda73478cda58449))
* **test:** phrases.csvデータ整合性・かな整合・レベルユニーク性テストの追加とCSVデータ修正 ([#166](https://github.com/bamiyanapp/karuta/issues/166)) ([bd566f1](https://github.com/bamiyanapp/karuta/commit/bd566f1bc1a011041060ae7454b12fe477afaac2))
* **ui:** OS設定に自動追従するダークモードを追加 ([#176](https://github.com/bamiyanapp/karuta/issues/176)) ([ba5f084](https://github.com/bamiyanapp/karuta/commit/ba5f08473a36d648671d87044f7fa1e0030d608e))
* **voice:** 読み上げボイスを選択できるようにする ([#342](https://github.com/bamiyanapp/karuta/issues/342)) ([0502b1d](https://github.com/bamiyanapp/karuta/commit/0502b1dda74a2882f37b21323b12638ec024318b))
* こども向け/エンジニア向けの区分選択機能を追加 ([#151](https://github.com/bamiyanapp/karuta/issues/151)) ([819475d](https://github.com/bamiyanapp/karuta/commit/819475da6b93c250aca8795fd4970d6d9383fcdb))
* 開発ルールをdev-standardsに共通化しsubmoduleで参照 ([#278](https://github.com/bamiyanapp/karuta/issues/278)) ([7457832](https://github.com/bamiyanapp/karuta/commit/745783203e484df27a3301d478d10aaf762acdb2))


### Reverts

* **ci:** CI自動マージ無効化を取り消し元の自動マージ運用に戻す ([#329](https://github.com/bamiyanapp/karuta/issues/329)) ([f1a371f](https://github.com/bamiyanapp/karuta/commit/f1a371f4b5937a7a8080e407eae9596761bf5a83))

# [1.30.0](https://github.com/bamiyanapp/karuta/compare/v1.29.4...v1.30.0) (2026-07-04)


### Features

* 開発ルールをdev-standardsに共通化しsubmoduleで参照 ([#278](https://github.com/bamiyanapp/karuta/issues/278)) ([7457832](https://github.com/bamiyanapp/karuta/commit/745783203e484df27a3301d478d10aaf762acdb2))

## [1.29.4](https://github.com/bamiyanapp/karuta/compare/v1.29.3...v1.29.4) (2026-07-04)


### Bug Fixes

* **ci:** release同期時の無駄なCI再実行と無条件デプロイを解消 ([#272](https://github.com/bamiyanapp/karuta/issues/272)) ([97c76c0](https://github.com/bamiyanapp/karuta/commit/97c76c0e881fb78a6bb46ff181e39505e2a04c6e))

## [1.29.3](https://github.com/bamiyanapp/karuta/compare/v1.29.2...v1.29.3) (2026-07-04)


### Bug Fixes

* **frontend:** 停止操作後にisReadingが固定され読み上げ不能になる不具合を修正 ([#270](https://github.com/bamiyanapp/karuta/issues/270)) ([0fb6c47](https://github.com/bamiyanapp/karuta/commit/0fb6c47cea038998888a82f0c71a3482ca3f581c))

## [1.29.2](https://github.com/bamiyanapp/karuta/compare/v1.29.1...v1.29.2) (2026-07-04)


### Bug Fixes

* **frontend:** frontend-testの慢性的なタイムアウトFlakinessを緩和 ([#268](https://github.com/bamiyanapp/karuta/issues/268)) ([3c02c8c](https://github.com/bamiyanapp/karuta/commit/3c02c8c0128b51e84d2fa5a125622bb42fd64e99)), closes [#264](https://github.com/bamiyanapp/karuta/issues/264)

## [1.29.1](https://github.com/bamiyanapp/karuta/compare/v1.29.0...v1.29.1) (2026-07-04)


### Bug Fixes

* **deploy:** LambdaランタイムをEOL間近のnodejs18.xからnodejs20.xへ更新 ([#255](https://github.com/bamiyanapp/karuta/issues/255)) ([1703855](https://github.com/bamiyanapp/karuta/commit/1703855b915ecd2568c1db120c53d29c61660a7c))

# [1.29.0](https://github.com/bamiyanapp/karuta/compare/v1.28.0...v1.29.0) (2026-07-04)


### Features

* **pwa:** ホーム画面追加導線をSafari/Android向けに追加 ([#253](https://github.com/bamiyanapp/karuta/issues/253)) ([80c78e6](https://github.com/bamiyanapp/karuta/commit/80c78e6c84ca6bf5d20686f98c297e878ba32612))

# [1.28.0](https://github.com/bamiyanapp/karuta/compare/v1.27.0...v1.28.0) (2026-07-04)


### Features

* **score:** プレイヤー別の取り札スコア記録機能を追加 ([#251](https://github.com/bamiyanapp/karuta/issues/251)) ([627c875](https://github.com/bamiyanapp/karuta/commit/627c875c4f81947375539425cda73478cda58449))

# [1.27.0](https://github.com/bamiyanapp/karuta/compare/v1.26.0...v1.27.0) (2026-07-04)


### Features

* **result:** 読了時のリザルト画面にセッションサマリーと紙吹雪演出を追加 ([#249](https://github.com/bamiyanapp/karuta/issues/249)) ([ed6771c](https://github.com/bamiyanapp/karuta/commit/ed6771ce256ccc091e695e2606992552bc8793fa))

# [1.26.0](https://github.com/bamiyanapp/karuta/compare/v1.25.0...v1.26.0) (2026-07-04)


### Features

* **auto-advance:** 自動読み上げモード（ハンズフリー進行）を追加 ([#247](https://github.com/bamiyanapp/karuta/issues/247)) ([a2b0ee5](https://github.com/bamiyanapp/karuta/commit/a2b0ee565f35d40b22ebc72595acbcdc28ecd495))

# [1.25.0](https://github.com/bamiyanapp/karuta/compare/v1.24.0...v1.25.0) (2026-07-04)


### Features

* **reading:** 次の札の音声をプリフェッチして待ち時間を削減 ([#245](https://github.com/bamiyanapp/karuta/issues/245)) ([f80c86d](https://github.com/bamiyanapp/karuta/commit/f80c86d726b846cf83b48666fa7c4a095b306d50))

# [1.24.0](https://github.com/bamiyanapp/karuta/compare/v1.23.0...v1.24.0) (2026-07-04)


### Features

* **reading:** 読み上げ中に停止できる機能を追加 ([#243](https://github.com/bamiyanapp/karuta/issues/243)) ([2159ff0](https://github.com/bamiyanapp/karuta/commit/2159ff0d5a25545bf7caafd5471103c55a48f563))

# [1.23.0](https://github.com/bamiyanapp/karuta/compare/v1.22.0...v1.23.0) (2026-07-04)


### Features

* **history:** 読み上げ履歴をsessionStorageに永続化 ([#241](https://github.com/bamiyanapp/karuta/issues/241)) ([e48a146](https://github.com/bamiyanapp/karuta/commit/e48a146182b752a10d3d24b8fa81e50f38ac8831))

# [1.22.0](https://github.com/bamiyanapp/karuta/compare/v1.21.0...v1.22.0) (2026-07-04)


### Features

* **game:** こども向けモードの読み札表示を最適化 ([#239](https://github.com/bamiyanapp/karuta/issues/239)) ([59a47a0](https://github.com/bamiyanapp/karuta/commit/59a47a08f7e820ef68a2da5ef8f38285755aa492))

# [1.21.0](https://github.com/bamiyanapp/karuta/compare/v1.20.0...v1.21.0) (2026-07-04)


### Features

* **category:** こども向け選択をワンタップで読み上げ画面へ遷移 ([#237](https://github.com/bamiyanapp/karuta/issues/237)) ([be53413](https://github.com/bamiyanapp/karuta/commit/be53413d91d9054c75080441611d95f19fae2dfa))

# [1.20.0](https://github.com/bamiyanapp/karuta/compare/v1.19.5...v1.20.0) (2026-07-04)


### Features

* **game:** ゲーム画面に残り札数・進捗表示を追加 ([#234](https://github.com/bamiyanapp/karuta/issues/234)) ([33618e1](https://github.com/bamiyanapp/karuta/commit/33618e137d18b316198472465098b7e4f5ad9760))

## [1.19.5](https://github.com/bamiyanapp/karuta/compare/v1.19.4...v1.19.5) (2026-07-04)


### Bug Fixes

* 低優先度バグ3件（[#191](https://github.com/bamiyanapp/karuta/issues/191), [#229](https://github.com/bamiyanapp/karuta/issues/229), [#230](https://github.com/bamiyanapp/karuta/issues/230)）を修正 ([#232](https://github.com/bamiyanapp/karuta/issues/232)) ([dab199e](https://github.com/bamiyanapp/karuta/commit/dab199ecb31546e203b2234e907451ec61f61cba))

## [1.19.4](https://github.com/bamiyanapp/karuta/compare/v1.19.3...v1.19.4) (2026-07-04)


### Bug Fixes

* **handler:** PollyキャッシュテーブルにTTLを追加し無限増加を防止 ([#228](https://github.com/bamiyanapp/karuta/issues/228)) ([28fb82c](https://github.com/bamiyanapp/karuta/commit/28fb82c8daba27652a4e2a0b6030e30a67dee362))

## [1.19.3](https://github.com/bamiyanapp/karuta/compare/v1.19.2...v1.19.3) (2026-07-04)


### Bug Fixes

* **handler:** recordTimeの読み書きを非アトミックな平均計算からADD加算方式に修正 ([#226](https://github.com/bamiyanapp/karuta/issues/226)) ([944bcb6](https://github.com/bamiyanapp/karuta/commit/944bcb6373c4a239f1387b3ba88a0542d0f64ad8))

## [1.19.2](https://github.com/bamiyanapp/karuta/compare/v1.19.1...v1.19.2) (2026-07-03)


### Bug Fixes

* **app:** record-time送信失敗時にエラーハンドリングを追加 ([#224](https://github.com/bamiyanapp/karuta/issues/224)) ([a897469](https://github.com/bamiyanapp/karuta/commit/a89746963b8d0aa663d919a6157aabf13bed474c))

## [1.19.1](https://github.com/bamiyanapp/karuta/compare/v1.19.0...v1.19.1) (2026-07-03)


### Bug Fixes

* **ci:** sync-releaseジョブのchangelog.jsonマージコンフリクトを解消 ([#211](https://github.com/bamiyanapp/karuta/issues/211)) ([38bd921](https://github.com/bamiyanapp/karuta/commit/38bd9211855d6f5965d89a09df6888b1a57cf3b2))
* **efuda:** 選択が1種別のみでも絵札印刷画面に種別名を表示 ([#179](https://github.com/bamiyanapp/karuta/issues/179)) ([b141ab5](https://github.com/bamiyanapp/karuta/commit/b141ab552a36759014ae3896706685d0f6d14648))
* **frontend:** 読み札カードのiOS Safariでの下端見切れを修正 ([#181](https://github.com/bamiyanapp/karuta/issues/181)) ([108c6cd](https://github.com/bamiyanapp/karuta/commit/108c6cde671d654f370b0eb1133eb9e73ae61864))
* **handler:** CORSをフロントエンドオリジンに制限しコメント長を検証 ([#209](https://github.com/bamiyanapp/karuta/issues/209)) ([7677335](https://github.com/bamiyanapp/karuta/commit/7677335bf7d74eb9c2a67d98c39f7994753e3e63)), closes [#184](https://github.com/bamiyanapp/karuta/issues/184)
* **handler:** 読み札本文のSSML未エスケープとspeechRateの検証不足を修正 ([#208](https://github.com/bamiyanapp/karuta/issues/208)) ([8593858](https://github.com/bamiyanapp/karuta/commit/85938582bda2a99649fd3052f71a9d7077d70309)), closes [#183](https://github.com/bamiyanapp/karuta/issues/183)
* **phrases:** 大ピンチずかんの読み札表現を著作権配慮で変更 ([#182](https://github.com/bamiyanapp/karuta/issues/182)) ([3a3d7f9](https://github.com/bamiyanapp/karuta/commit/3a3d7f95ff2f934a917c6269f2c4886129bd897f))
* **reading:** リピート再生で読み上げ計測の開始点がリセットされる不具合を修正 ([#206](https://github.com/bamiyanapp/karuta/issues/206)) ([c3701a5](https://github.com/bamiyanapp/karuta/commit/c3701a535b30ac0f2210ac07dbff459aabadd9a7)), closes [#132](https://github.com/bamiyanapp/karuta/issues/132) [#131](https://github.com/bamiyanapp/karuta/issues/131)
* **record-time:** 読み上げ経過時間の異常値が統計を汚染しないよう上限チェックを追加 ([#207](https://github.com/bamiyanapp/karuta/issues/207)) ([6afc7b3](https://github.com/bamiyanapp/karuta/commit/6afc7b3e63db4f555ba02232e343e68023d5f6d1)), closes [#132](https://github.com/bamiyanapp/karuta/issues/132)

# [1.19.0](https://github.com/bamiyanapp/karuta/compare/v1.18.1...v1.19.0) (2026-07-02)


### Features

* **ui:** OS設定に自動追従するダークモードを追加 ([#176](https://github.com/bamiyanapp/karuta/issues/176)) ([ba5f084](https://github.com/bamiyanapp/karuta/commit/ba5f08473a36d648671d87044f7fa1e0030d608e))

## [1.18.1](https://github.com/bamiyanapp/karuta/compare/v1.18.0...v1.18.1) (2026-07-02)


### Bug Fixes

* **phrases:** 百人一首の下の句をanswerに設定 ([#174](https://github.com/bamiyanapp/karuta/issues/174)) ([d78960c](https://github.com/bamiyanapp/karuta/commit/d78960ca35e28d1c8c96543c24625fc1fe2f7894))

# [1.18.0](https://github.com/bamiyanapp/karuta/compare/v1.17.1...v1.18.0) (2026-07-02)


### Features

* **reading:** 複数種別選択時に読み上げ末尾でかるた種別を読み上げる ([#172](https://github.com/bamiyanapp/karuta/issues/172)) ([c15a729](https://github.com/bamiyanapp/karuta/commit/c15a729879b165e862ca25ac6001b3a5ca8edca4))

## [1.17.1](https://github.com/bamiyanapp/karuta/compare/v1.17.0...v1.17.1) (2026-07-01)


### Bug Fixes

* **all-phrases:** 種別フィルタも表と一緒にスクロールさせヘッダのみ固定 ([#170](https://github.com/bamiyanapp/karuta/issues/170)) ([093a1df](https://github.com/bamiyanapp/karuta/commit/093a1df279990a31cc782550b8547d3c15b385c5))

# [1.17.0](https://github.com/bamiyanapp/karuta/compare/v1.16.0...v1.17.0) (2026-06-30)


### Features

* **all-phrases:** 種別フィルタ追加とヘッダ固定表示 ([#168](https://github.com/bamiyanapp/karuta/issues/168)) ([bf3860d](https://github.com/bamiyanapp/karuta/commit/bf3860d2b5dcd4accd950e8ac734823250ff3aa3))

# [1.16.0](https://github.com/bamiyanapp/karuta/compare/v1.15.1...v1.16.0) (2026-06-30)


### Features

* **test:** phrases.csvデータ整合性・かな整合・レベルユニーク性テストの追加とCSVデータ修正 ([#166](https://github.com/bamiyanapp/karuta/issues/166)) ([bd566f1](https://github.com/bamiyanapp/karuta/commit/bd566f1bc1a011041060ae7454b12fe477afaac2))

## [1.15.1](https://github.com/bamiyanapp/karuta/compare/v1.15.0...v1.15.1) (2026-06-29)


### Bug Fixes

* settings更新 ([#164](https://github.com/bamiyanapp/karuta/issues/164)) ([f2932a2](https://github.com/bamiyanapp/karuta/commit/f2932a23ae34e0062e5add82f3d4e253327ca60a))

# [1.15.0](https://github.com/bamiyanapp/karuta/compare/v1.14.0...v1.15.0) (2026-06-29)


### Features

* **frontend:** PWAの更新検知とプロンプトUIの追加 ([#162](https://github.com/bamiyanapp/karuta/issues/162)) ([dd45840](https://github.com/bamiyanapp/karuta/commit/dd458402cb8051d104ac7f389ae69e2545e11dbc))

# [1.14.0](https://github.com/bamiyanapp/karuta/compare/v1.13.0...v1.14.0) (2026-06-29)


### Bug Fixes

* **backend:** かるた札のかな表記を修正 ([#150](https://github.com/bamiyanapp/karuta/issues/150)) ([e95a97a](https://github.com/bamiyanapp/karuta/commit/e95a97a4f2b7133318118cfff5557a6e02f09037))
* **backend:** 読み札変更時にPolly音声キャッシュを自動再生成する ([#156](https://github.com/bamiyanapp/karuta/issues/156)) ([31dec24](https://github.com/bamiyanapp/karuta/commit/31dec2422c8f668a5fbb3c7476871de4f71ed796))
* **ci:** CDジョブの冗長ステップを削減しリリース競合を解消 ([#160](https://github.com/bamiyanapp/karuta/issues/160)) ([3a292f2](https://github.com/bamiyanapp/karuta/commit/3a292f2976400521297a6ddd4014d236de9df114)), closes [#157](https://github.com/bamiyanapp/karuta/issues/157) [#157](https://github.com/bamiyanapp/karuta/issues/157)
* **ci:** releaseブランチへのpushでCIジョブを起動しないように変更 ([#158](https://github.com/bamiyanapp/karuta/issues/158)) ([409e78d](https://github.com/bamiyanapp/karuta/commit/409e78ddc69c8828fdb865e0315cc9da451baeee))
* **ci:** releaseブランチ同期とバージョン自動リリースの不具合を修正 ([#157](https://github.com/bamiyanapp/karuta/issues/157)) ([fea6cd0](https://github.com/bamiyanapp/karuta/commit/fea6cd04fb4d6a68e6de26c7ca8b0cf01dc1f0bf)), closes [#130](https://github.com/bamiyanapp/karuta/issues/130)
* **frontend:** 絵札印刷カードの角丸を拡大し内側の角も丸くする ([#149](https://github.com/bamiyanapp/karuta/issues/149)) ([297ae14](https://github.com/bamiyanapp/karuta/commit/297ae143ba6ece910094b7bb75aa17628b0c66d2))
* **frontend:** 絵札印刷のページ詰めとテストかるた削除 ([#148](https://github.com/bamiyanapp/karuta/issues/148)) ([5b6f584](https://github.com/bamiyanapp/karuta/commit/5b6f584c9b6b7b631234c6ed16df63bd9173d10f))
* **frontend:** 絵札印刷の用紙寸法を実測値に修正 ([#142](https://github.com/bamiyanapp/karuta/issues/142)) ([0397fab](https://github.com/bamiyanapp/karuta/commit/0397fab7113df7a3e990457bc101286fbbb813ec))
* gitぴんちかるたに変更 ([#152](https://github.com/bamiyanapp/karuta/issues/152)) ([ac2f82a](https://github.com/bamiyanapp/karuta/commit/ac2f82af8faadf7b9cf19f1c4abbcbf571bd1840))
* JavaとHTTPのかるたを大ピンチ仕様に修正 ([#155](https://github.com/bamiyanapp/karuta/issues/155)) ([6877e5f](https://github.com/bamiyanapp/karuta/commit/6877e5f263dfa1fd1aff95ee5158507df41fbf60)), closes [#152](https://github.com/bamiyanapp/karuta/issues/152)
* update cd.yml ([#138](https://github.com/bamiyanapp/karuta/issues/138)) ([5e37f6c](https://github.com/bamiyanapp/karuta/commit/5e37f6cd98d36671777005356fe232fe1c53df7a))
* update phrases.csv ([#135](https://github.com/bamiyanapp/karuta/issues/135)) ([72af825](https://github.com/bamiyanapp/karuta/commit/72af825a59977e8b9c169d2dd1d5d46d0d678806))
* バージョン重複エラーの対応 ([#136](https://github.com/bamiyanapp/karuta/issues/136)) ([761614e](https://github.com/bamiyanapp/karuta/commit/761614e04de7860a8977dc69a92c04dd972433a6))
* 空コミット ([#134](https://github.com/bamiyanapp/karuta/issues/134)) ([3aacb43](https://github.com/bamiyanapp/karuta/commit/3aacb43d57cb76dd9186e94d80adf30924fedbe8))
* 読み札の誤りを修正 ([#129](https://github.com/bamiyanapp/karuta/issues/129)) ([ce53f25](https://github.com/bamiyanapp/karuta/commit/ce53f2577ac836a88a4966aa2d3c6e010dceb273))


### Features

* **backend:** おばけ・いろはかるたの答えデータを追加 ([#143](https://github.com/bamiyanapp/karuta/issues/143)) ([69cde86](https://github.com/bamiyanapp/karuta/commit/69cde8617d3665fe135cf1e805fc9775435921ee))
* **backend:** セキュリティ・Webアプリ・Windowsショートカットかるたを追加 ([#145](https://github.com/bamiyanapp/karuta/issues/145)) ([1ca8f1e](https://github.com/bamiyanapp/karuta/commit/1ca8f1e0cb6e9455bb5c01c00d5169e16a8ccb50))
* **frontend:** かるた選択画面を複数選択対応に変更 ([#146](https://github.com/bamiyanapp/karuta/issues/146)) ([391bc1f](https://github.com/bamiyanapp/karuta/commit/391bc1f10df77e60ae01a8c9352f246fee3e9f88))
* **frontend:** 結果画面と全札一覧に答えを表示 ([#144](https://github.com/bamiyanapp/karuta/issues/144)) ([e7a202c](https://github.com/bamiyanapp/karuta/commit/e7a202c5c58bb1e6408689cd46314bf2214c9159))
* **frontend:** 絵札印刷の枠線を太く・角丸にし用紙情報にリンクを追加 ([#147](https://github.com/bamiyanapp/karuta/issues/147)) ([1c549e4](https://github.com/bamiyanapp/karuta/commit/1c549e45f120b56cd74ef3bea1d14c95f9a3d440))
* **frontend:** 絵札印刷画面を追加 ([#141](https://github.com/bamiyanapp/karuta/issues/141)) ([d4d09f8](https://github.com/bamiyanapp/karuta/commit/d4d09f8bfaa219d1a4656befd1e4595f2e9f65ee))
* **frontend:** 詳細・報告画面に答えを表示する ([#159](https://github.com/bamiyanapp/karuta/issues/159)) ([314cdf0](https://github.com/bamiyanapp/karuta/commit/314cdf011f65ae045f1984df8bd4c861c3cb25c2))
* IT技術かるた7テーマを追加(HTTP/Linux/Git/SQL/AWS/Java/コードレビュー) ([#140](https://github.com/bamiyanapp/karuta/issues/140)) ([f213b98](https://github.com/bamiyanapp/karuta/commit/f213b9891d8181e230ec197e7b2fe618724a2af0))
* こども向け/エンジニア向けの区分選択機能を追加 ([#151](https://github.com/bamiyanapp/karuta/issues/151)) ([819475d](https://github.com/bamiyanapp/karuta/commit/819475da6b93c250aca8795fd4970d6d9383fcdb))

# [1.13.0](https://github.com/bamiyanapp/karuta/compare/v1.12.1...v1.13.0) (2026-01-12)


### Bug Fixes

* **agent:** change gemini model to gemini-1.5-flash to fix 404 error ([0b477db](https://github.com/bamiyanapp/karuta/commit/0b477db9baccdf2d4b1d75e8601545629bcd52ec))
* **agent:** trigger runner when issue title contains [agent] ([19d3c15](https://github.com/bamiyanapp/karuta/commit/19d3c1510dbc8451ebf7486a7c84a74e4fc562a1))
* **changelog:** 更新履歴の最新バージョンで時刻が表示されない問題を修正 ([#85](https://github.com/bamiyanapp/karuta/issues/85)) ([2dbbc9b](https://github.com/bamiyanapp/karuta/commit/2dbbc9b29a7acd26fd78e5dbc79e594d40fb6314))
* **ci:** cd.yml および ci.yml をコミット b2b221f の状態に戻す ([#80](https://github.com/bamiyanapp/karuta/issues/80)) ([dcddd5a](https://github.com/bamiyanapp/karuta/commit/dcddd5a42b20adffcfcb5992333af8c0af5c66df))
* **ci:** cd.ymlの構文エラーを修正 ([#37](https://github.com/bamiyanapp/karuta/issues/37)) ([44a0a29](https://github.com/bamiyanapp/karuta/commit/44a0a299b79800f453e1e4d0497bfbd1c744ec35))
* **ci:** CDパイプラインの実行条件とチェックアウト処理を改善 ([#52](https://github.com/bamiyanapp/karuta/issues/52)) ([bca7fd5](https://github.com/bamiyanapp/karuta/commit/bca7fd506a84d66984f3b9ba0a993ddd56521838))
* **ci:** CDワークフローでのチェックアウトエラーを修正 ([#34](https://github.com/bamiyanapp/karuta/issues/34)) ([03224e3](https://github.com/bamiyanapp/karuta/commit/03224e36fccd3abdef67b4c60b63d8655e3d98de))
* **ci:** CDワークフローのトリガーとチェックアウト処理を改善 ([#53](https://github.com/bamiyanapp/karuta/issues/53)) ([385d719](https://github.com/bamiyanapp/karuta/commit/385d7194d19d056582ef9bfb11446d9375fc207c))
* **ci:** CDワークフローの重複実行と不適切なタイミングでの実行を解消 ([#42](https://github.com/bamiyanapp/karuta/issues/42)) ([d4a49a9](https://github.com/bamiyanapp/karuta/commit/d4a49a9d28511acee2af4ef9d7a941fc33ac76e8))
* **ci:** fix permission error in auto-merge workflow ([7084fae](https://github.com/bamiyanapp/karuta/commit/7084fae9b1da5ce23c6cf263903c134598772234))
* **ci:** fix permission issue in auto-merge and ignore coverage in lint ([b21f9bb](https://github.com/bamiyanapp/karuta/commit/b21f9bb7223e0696ab74da298a16ac42b2c2f9cd))
* **ci:** fix semantic-release failures by explicitly setting repository info and git author ([45897bd](https://github.com/bamiyanapp/karuta/commit/45897bd97550b56c7d15b0a12971caef217badf3))
* **ci:** mainブランチをリリース対象に再追加 ([#27](https://github.com/bamiyanapp/karuta/issues/27)) ([66a25da](https://github.com/bamiyanapp/karuta/commit/66a25da7e9608d4a135ea8db6841deaef0971c35))
* **ci:** mainブランチをリリース対象に再追加 ([#28](https://github.com/bamiyanapp/karuta/issues/28)) ([2e7cbd3](https://github.com/bamiyanapp/karuta/commit/2e7cbd38411a4e24535453163febeecec15f2910))
* **ci:** restore main as release branch and update deploy workflow ([#20](https://github.com/bamiyanapp/karuta/issues/20)) ([2953910](https://github.com/bamiyanapp/karuta/commit/29539100612f742b7033deeca1b473893562e89e))
* **ci:** restore main as release branch and update deploy workflow ([#22](https://github.com/bamiyanapp/karuta/issues/22)) ([66dd489](https://github.com/bamiyanapp/karuta/commit/66dd489846d1110a01c9673534176faabae16adf))
* **ci:** semantic-releaseの設定改善と権限エラーの解消 ([#32](https://github.com/bamiyanapp/karuta/issues/32)) ([276caa7](https://github.com/bamiyanapp/karuta/commit/276caa71f88211169c9cf8215d1905d9df020982))
* **ci:** use github.ref for reliable branch detection in deploy workflow ([#23](https://github.com/bamiyanapp/karuta/issues/23)) ([563a515](https://github.com/bamiyanapp/karuta/commit/563a5158ef9110288898d46dbdb31b3e58d7fb80))
* **ci:** マージ権限エラーの解消とCDトリガーの改善 ([#31](https://github.com/bamiyanapp/karuta/issues/31)) ([80ae7c2](https://github.com/bamiyanapp/karuta/commit/80ae7c2c8197d17481f7e2fe7410cd550954bbe3))
* **ci:** リリースジョブのスキップを解消 ([#38](https://github.com/bamiyanapp/karuta/issues/38)) ([2a6643c](https://github.com/bamiyanapp/karuta/commit/2a6643c0d142d1739a48891d8902e1e38e3700eb))
* **ci:** リリースジョブの失敗を修正し、リリースフローをreleaseブランチに限定 ([#25](https://github.com/bamiyanapp/karuta/issues/25)) ([fdc5cea](https://github.com/bamiyanapp/karuta/commit/fdc5cea41cb10887a22a978195eb322ab5750a6d))
* **ci:** リリースパイプラインの最終調整と安定化 ([#36](https://github.com/bamiyanapp/karuta/issues/36)) ([bd9c4aa](https://github.com/bamiyanapp/karuta/commit/bd9c4aa34ccd0b767441db0c78e0f1063255d853))
* **ci:** リリース対象をreleaseブランチに限定し権限エラーを回避 ([#33](https://github.com/bamiyanapp/karuta/issues/33)) ([7a4d378](https://github.com/bamiyanapp/karuta/commit/7a4d378309777c5096b2e90a51985d121bd5d346))
* ci失敗を修正 ([#64](https://github.com/bamiyanapp/karuta/issues/64)) ([2f53c91](https://github.com/bamiyanapp/karuta/commit/2f53c91d6e69b2a0741b3845c62f3ced6fb92e6a))
* fetchの追加 ([#60](https://github.com/bamiyanapp/karuta/issues/60)) ([6bd2b38](https://github.com/bamiyanapp/karuta/commit/6bd2b388b637ada19be482f677a64e3dafb1e6c2))
* **frontend:** 全札一覧のページタイトル修正と表記の統一 ([#40](https://github.com/bamiyanapp/karuta/issues/40)) ([f5c747b](https://github.com/bamiyanapp/karuta/commit/f5c747bcb3e84f084a98157d7b43b8ab729e3702))
* **release:** use BOT_TOKEN for checkout and release steps ([9ba56d7](https://github.com/bamiyanapp/karuta/commit/9ba56d78b079306dba78c4a35fa5e96750b3c5eb))
* **release:** use BOT_TOKEN to bypass branch protection ([563f496](https://github.com/bamiyanapp/karuta/commit/563f496d07ed5ef1a043052c173d1fa5ff2b35bd))
* semanticリリース対応 ([28c211a](https://github.com/bamiyanapp/karuta/commit/28c211aa2e08c0f4c37fed633367fc1c0209e990))
* trigger pipeline with valid message ([4c660f9](https://github.com/bamiyanapp/karuta/commit/4c660f98b54469e4da3b5b5f3252e6ececc83bda))
* update .releaserc.cjs ([#67](https://github.com/bamiyanapp/karuta/issues/67)) ([#68](https://github.com/bamiyanapp/karuta/issues/68)) ([679f582](https://github.com/bamiyanapp/karuta/commit/679f58281e636eec4f312b4128725e2106079797))
* update .releaserc.cjs ([#71](https://github.com/bamiyanapp/karuta/issues/71)) ([3027254](https://github.com/bamiyanapp/karuta/commit/3027254b743cc8cf1676eefa375ce6aad16be4c7))
* update cd.yml ([#102](https://github.com/bamiyanapp/karuta/issues/102)) ([8644dd9](https://github.com/bamiyanapp/karuta/commit/8644dd9cb9c9bd83a85af6ac7f6fa71a4dc990dc))
* update cd.yml ([#103](https://github.com/bamiyanapp/karuta/issues/103)) ([571b873](https://github.com/bamiyanapp/karuta/commit/571b873f4c3ea8d1ffb02230aecfb048e161f718))
* update cd.yml ([#104](https://github.com/bamiyanapp/karuta/issues/104)) ([76bb29a](https://github.com/bamiyanapp/karuta/commit/76bb29a725aeccbf2831dfa62f6eaf038687b436))
* update cd.yml ([#105](https://github.com/bamiyanapp/karuta/issues/105)) ([dec7baf](https://github.com/bamiyanapp/karuta/commit/dec7baf86593abf4bd26794a022b734fb26f888c))
* update cd.yml ([#106](https://github.com/bamiyanapp/karuta/issues/106)) ([ea41387](https://github.com/bamiyanapp/karuta/commit/ea4138779c3e3ecf0d1c0e16283d61b3f97f44d0))
* update cd.yml ([#107](https://github.com/bamiyanapp/karuta/issues/107)) ([e8950c1](https://github.com/bamiyanapp/karuta/commit/e8950c1f5e98675625320b4174ca8abc2e63d160))
* update cd.yml ([#108](https://github.com/bamiyanapp/karuta/issues/108)) ([3c85a37](https://github.com/bamiyanapp/karuta/commit/3c85a3799092a4f51393db9263cc9a2b8b91f6f5))
* update cd.yml ([#111](https://github.com/bamiyanapp/karuta/issues/111)) ([c9bd2b4](https://github.com/bamiyanapp/karuta/commit/c9bd2b440683a4a34a811a23c8e0f1126935ac02))
* update cd.yml ([#112](https://github.com/bamiyanapp/karuta/issues/112)) ([0f2e2f8](https://github.com/bamiyanapp/karuta/commit/0f2e2f8109f6849033e935e663d2b58ae2d1f7b9))
* update cd.yml ([#114](https://github.com/bamiyanapp/karuta/issues/114)) ([c9a268b](https://github.com/bamiyanapp/karuta/commit/c9a268bafbd7eef8c8c73d201c8a16262074eb34))
* update cd.yml ([#115](https://github.com/bamiyanapp/karuta/issues/115)) ([a1e9657](https://github.com/bamiyanapp/karuta/commit/a1e965764f06c49d05c2801aa0091fae983ce1a1))
* update cd.yml ([#117](https://github.com/bamiyanapp/karuta/issues/117)) ([3d3b472](https://github.com/bamiyanapp/karuta/commit/3d3b472c4141141ecfc89415d9d71a09b33b4791))
* update cd.yml ([#120](https://github.com/bamiyanapp/karuta/issues/120)) ([c9fe02a](https://github.com/bamiyanapp/karuta/commit/c9fe02ae935609c567fad158603cf847a6d75651))
* update cd.yml ([#65](https://github.com/bamiyanapp/karuta/issues/65)) ([9e37b1b](https://github.com/bamiyanapp/karuta/commit/9e37b1b42d7f90c52460492f97de517470c70d06))
* update cd.yml ([#66](https://github.com/bamiyanapp/karuta/issues/66)) ([20b05da](https://github.com/bamiyanapp/karuta/commit/20b05daddb70fcb0980b17706ec71115560aad72))
* update cd.yml ([#70](https://github.com/bamiyanapp/karuta/issues/70)) ([20e6f0a](https://github.com/bamiyanapp/karuta/commit/20e6f0a90a4ba2b1f26e709e23d5a9ac9be19248))
* update cd.yml ([#72](https://github.com/bamiyanapp/karuta/issues/72)) ([ff3a3ff](https://github.com/bamiyanapp/karuta/commit/ff3a3ff10bbe4f1575994d29059680e0e712fddb))
* update cd.yml ([#73](https://github.com/bamiyanapp/karuta/issues/73)) ([f68e7fd](https://github.com/bamiyanapp/karuta/commit/f68e7fd721b3ca701821437dbfe0bdeaf4a0886e))
* update cd.yml ([#74](https://github.com/bamiyanapp/karuta/issues/74)) ([b2b221f](https://github.com/bamiyanapp/karuta/commit/b2b221f6bb680718d156037c629d984e876715e8))
* update cd.yml ([#89](https://github.com/bamiyanapp/karuta/issues/89)) ([1ef81f4](https://github.com/bamiyanapp/karuta/commit/1ef81f413172865afe1f5a03e7a6929d3fdbe94a))
* update cd.yml ([#90](https://github.com/bamiyanapp/karuta/issues/90)) ([4248ad0](https://github.com/bamiyanapp/karuta/commit/4248ad0f849d2349b09a30c7c6fc5067b057e5bb))
* update cd.yml ([#91](https://github.com/bamiyanapp/karuta/issues/91)) ([3183dfa](https://github.com/bamiyanapp/karuta/commit/3183dfa1645aad2af9f7c1e85d144e85929828d0))
* update cd.yml ([#92](https://github.com/bamiyanapp/karuta/issues/92)) ([6abeb79](https://github.com/bamiyanapp/karuta/commit/6abeb79ad95f17887c95832e55164cbc89694aad))
* update cd.yml ([#94](https://github.com/bamiyanapp/karuta/issues/94)) ([f58ce70](https://github.com/bamiyanapp/karuta/commit/f58ce708457860ec2377c8879a14944ca7fe922f))
* update ci.yml ([#100](https://github.com/bamiyanapp/karuta/issues/100)) ([a348f4b](https://github.com/bamiyanapp/karuta/commit/a348f4b72211764fa29ded69e0be5ff7829dbd58))
* update ci.yml ([#101](https://github.com/bamiyanapp/karuta/issues/101)) ([f324fa9](https://github.com/bamiyanapp/karuta/commit/f324fa9c6a3b7483394c828eaf89572106c00dc4))
* update ci.yml ([#109](https://github.com/bamiyanapp/karuta/issues/109)) ([3801e6d](https://github.com/bamiyanapp/karuta/commit/3801e6db7bec73497eae08c9397609776fec97f3))
* update ci.yml ([#110](https://github.com/bamiyanapp/karuta/issues/110)) ([55c81ed](https://github.com/bamiyanapp/karuta/commit/55c81ed287409427150297c71a1eab86a0923c54))
* update ci.yml ([#63](https://github.com/bamiyanapp/karuta/issues/63)) ([e040950](https://github.com/bamiyanapp/karuta/commit/e0409509a1de3ec8942a39ae35d94dd7b87cf2c8))
* update ci.yml ([#69](https://github.com/bamiyanapp/karuta/issues/69)) ([90aafb5](https://github.com/bamiyanapp/karuta/commit/90aafb5d62da62294d3424689db493c6dd860aab))
* update ci.yml ([#77](https://github.com/bamiyanapp/karuta/issues/77)) ([10cd89f](https://github.com/bamiyanapp/karuta/commit/10cd89ff435b6acc25d27aa684b80c6d262807e9))
* update ci.yml ([#78](https://github.com/bamiyanapp/karuta/issues/78)) ([0447ca6](https://github.com/bamiyanapp/karuta/commit/0447ca6ab04d80b41f6765b73c3b7349d08a86c9))
* update ci.yml ([#79](https://github.com/bamiyanapp/karuta/issues/79)) ([9130dfe](https://github.com/bamiyanapp/karuta/commit/9130dfe37e82bbab5fc57102bc6ac048494fd896))
* update ci.yml ([#82](https://github.com/bamiyanapp/karuta/issues/82)) ([b35ff9d](https://github.com/bamiyanapp/karuta/commit/b35ff9d9e10ba6664323781aba01674299dc3012))
* update ci.yml ([#83](https://github.com/bamiyanapp/karuta/issues/83)) ([5ff89b3](https://github.com/bamiyanapp/karuta/commit/5ff89b30e31176b7999474bb82990496e29d71c9))
* update ci.yml ([#84](https://github.com/bamiyanapp/karuta/issues/84)) ([60aca66](https://github.com/bamiyanapp/karuta/commit/60aca666e13c5dbd3ac861810e5dc58d04e1a9b1))
* update ci.yml ([#86](https://github.com/bamiyanapp/karuta/issues/86)) ([1c741dc](https://github.com/bamiyanapp/karuta/commit/1c741dce55e58494ce88dfeeba966a96816ce0e5))
* update ci.yml ([#93](https://github.com/bamiyanapp/karuta/issues/93)) ([2862fa2](https://github.com/bamiyanapp/karuta/commit/2862fa2f091875e796262264965fe30cf7cdde02))
* update ci.yml ([#95](https://github.com/bamiyanapp/karuta/issues/95)) ([f15d4eb](https://github.com/bamiyanapp/karuta/commit/f15d4eb0afdf9567329454602940aef64b554699))
* update ci.yml ([#96](https://github.com/bamiyanapp/karuta/issues/96)) ([0025698](https://github.com/bamiyanapp/karuta/commit/002569883a51c82595e55181a7848281ca3ea2d9))
* update cicd-pipeline-specification.md ([#118](https://github.com/bamiyanapp/karuta/issues/118)) ([730db51](https://github.com/bamiyanapp/karuta/commit/730db51a5be4276ff27773934472688d92096fe6))
* コード生成をエージェントパイプライン化する ([5720177](https://github.com/bamiyanapp/karuta/commit/5720177272d627f33313fc4f1489b9980ac8e77c))
* コミットリントのルール修正 ([60ed0be](https://github.com/bamiyanapp/karuta/commit/60ed0be661fb84faa7e640fd528c034960f72bc3))
* 全札一覧のページタイトル修正とAgentパイプラインの復旧 ([#19](https://github.com/bamiyanapp/karuta/issues/19)) ([f0f0429](https://github.com/bamiyanapp/karuta/commit/f0f0429550f13062bf622afb6e9e09ff08ea6242))
* 稼働条件を変更 ([#59](https://github.com/bamiyanapp/karuta/issues/59)) ([bf4a06f](https://github.com/bamiyanapp/karuta/commit/bf4a06feff683bdcc709ca377b36bf1a86832370))


### Features

* **agent:** enhance agent prompt and logic for autonomous lifecycle ([7b4099f](https://github.com/bamiyanapp/karuta/commit/7b4099fcc97de104d08d3842fa1c61329d7195be))
* **agent:** restrict runner to authorized users and allow title trigger ([03e7a8d](https://github.com/bamiyanapp/karuta/commit/03e7a8dd2cb4babab85af36bf06d0e3387be25cb))
* **backup:** DynamoDB PITRの有効化と運用仕様の追記 ([#50](https://github.com/bamiyanapp/karuta/issues/50)) ([4194dc7](https://github.com/bamiyanapp/karuta/commit/4194dc73dd816ec27eb4176fca7ccc4792037b1c))
* **ci:** delete branch after successful auto-merge ([#15](https://github.com/bamiyanapp/karuta/issues/15)) ([2e19ff6](https://github.com/bamiyanapp/karuta/commit/2e19ff61f617708c5f7a243ab87754b1a8d32e73))
* **ci:** integrate auto-merge into CI workflow for better reliability ([#26](https://github.com/bamiyanapp/karuta/issues/26)) ([49af638](https://github.com/bamiyanapp/karuta/commit/49af63851ca062af9f52766ce91a0b81226d50ef))
* **ci:** restructure pipeline into CI and CD for better reliability and visibility ([4b72d8a](https://github.com/bamiyanapp/karuta/commit/4b72d8a25f39bdeb57505069ae0e16e170434342))
* improve agent pipeline reliability ([02a2472](https://github.com/bamiyanapp/karuta/commit/02a2472f9400ab8f8c3256822ff151db9247fbd6))
* **readme:** ローカルのAWSアイコンを使用するように更新 ([#49](https://github.com/bamiyanapp/karuta/issues/49)) ([d059989](https://github.com/bamiyanapp/karuta/commit/d059989f2e5ac9d37e172911ddfdf4e82a1c89f2))


## [1.12.1](https://github.com/bamiyanapp/karuta/compare/v1.12.0...v1.12.1) (2026-01-06)


### Bug Fixes

* clineのシステムプロンプトを追加 ([9282355](https://github.com/bamiyanapp/karuta/commit/928235585f3f24885f3cf9b6221b59d717182248))

# [1.12.0](https://github.com/bamiyanapp/karuta/compare/v1.11.0...v1.12.0) (2026-01-04)


### Features

* display elapsed time in history ([966231c](https://github.com/bamiyanapp/karuta/commit/966231c24d3f11a502fc1c3d0ecde14f0b41c31f))

# [1.11.0](https://github.com/bamiyanapp/karuta/compare/v1.10.0...v1.11.0) (2026-01-04)


### Features

* フェードで札と結果を切り替える ([21b0f12](https://github.com/bamiyanapp/karuta/commit/21b0f12e3c6b27003e1d14696234b46362ada1a8))

# [1.10.0](https://github.com/bamiyanapp/karuta/compare/v1.9.3...v1.10.0) (2026-01-04)


### Bug Fixes

* card not displaying on read ([169d5c5](https://github.com/bamiyanapp/karuta/commit/169d5c50f12d9a9a41a1f67ac30113a13a50280f))
* ensure next card is displayed correctly ([58c1f9f](https://github.com/bamiyanapp/karuta/commit/58c1f9f29486284bae32af9920a4f7e38e67678b))
* trigger semantic-release ([f019679](https://github.com/bamiyanapp/karuta/commit/f01967921f8d020f15118769a18b22bb5cbab389))


### Features

* Merge main with bug fixes into v1.8.0 ([ef26ce7](https://github.com/bamiyanapp/karuta/commit/ef26ce7e8d7fa792b8a67a6c91a11c46921fe648))
* Merge main with bug fixes into v1.9.3 ([1b72b99](https://github.com/bamiyanapp/karuta/commit/1b72b990452637504401a52b7acce8f0482ae383))

# [1.9.4](https://github.com/bamiyanapp/karuta/compare/v1.9.3...v1.9.4) (2026-01-04)


### Bug Fixes

* card not displaying on read ([169d5c5](https://github.com/bamiyanapp/karuta/commit/169d5c50f12d9a9a41a1f67ac30113a13a50280f))
* ensure next card is displayed correctly ([58c1f9f](https://github.com/bamiyanapp/karuta/commit/58c1f9f29486284bae32af9920a4f7e38e67678b))


## [1.9.3](https://github.com/bamiyanapp/karuta/compare/v1.9.2...v1.9.3) (2026-01-04)


### Bug Fixes

* preserve averageDifficulty during seed ([8037593](https://github.com/bamiyanapp/karuta/commit/80375939c355a8ffded749fcc364b99844a03385))


### Reverts

* restore setTimeout based implementation to fix playback issues ([aa65809](https://github.com/bamiyanapp/karuta/commit/aa658099f5ae105a2f36b40fbea3a0a1da3edea6))

## [1.9.2](https://github.com/bamiyanapp/karuta/compare/v1.9.1...v1.9.2) (2026-01-04)


### Bug Fixes

* continue animation even if audio playback fails ([95b6fb6](https://github.com/bamiyanapp/karuta/commit/95b6fb671099f2062e6f0ec86c88329bd928a182))

## [1.9.1](https://github.com/bamiyanapp/karuta/compare/v1.9.0...v1.9.1) (2026-01-04)


### Bug Fixes

* ensure phrase transition even if audio is short ([c04ede8](https://github.com/bamiyanapp/karuta/commit/c04ede8d801fa4e6b38c6d3253d7ca9468df5544))

# [1.9.0](https://github.com/bamiyanapp/karuta/compare/v1.8.0...v1.9.0) (2026-01-04)


### Features

* praise when time is faster than average ([d9abd2b](https://github.com/bamiyanapp/karuta/commit/d9abd2bad5585e1c22cb71bafd0662a684dc133d))

# [1.8.0](https://github.com/bamiyanapp/karuta/compare/v1.7.2...v1.8.0) (2026-01-04)


### Features

* show result (time and difficulty) after pressing next button ([6bd8d21](https://github.com/bamiyanapp/karuta/commit/6bd8d21eb7f41a035592791d64ebb7b10f73746e))

## [1.7.2](https://github.com/bamiyanapp/karuta/compare/v1.7.1...v1.7.2) (2026-01-04)


### Bug Fixes

* record time correctly when skipping card animation ([9e52986](https://github.com/bamiyanapp/karuta/commit/9e5298606359e55f7992e8354b5923043e502cb5))

## [1.7.1](https://github.com/bamiyanapp/karuta/compare/v1.7.0...v1.7.1) (2026-01-04)


### Bug Fixes

* 読み上げ回数がカウントアップしない問題を修正 ([871ad6c](https://github.com/bamiyanapp/karuta/commit/871ad6c4246babf06732cf2afcfc7cb45f69fc1a))

# [1.7.0](https://github.com/bamiyanapp/karuta/compare/v1.6.0...v1.7.0) (2026-01-04)


### Features

* add averageTime to all-phrases list and increase list width ([99b62e2](https://github.com/bamiyanapp/karuta/commit/99b62e226c936ad56d98344697c5511e23207fc6))

# [1.6.0](https://github.com/bamiyanapp/karuta/compare/v1.5.0...v1.6.0) (2026-01-04)


### Features

* implement sort functionality for all-phrases list ([30ff588](https://github.com/bamiyanapp/karuta/commit/30ff588b97b17da6e703f178879bcd083f0919da))

# [1.5.0](https://github.com/bamiyanapp/karuta/compare/v1.4.2...v1.5.0) (2026-01-04)


### Bug Fixes

* clear selectedCategory when navigating back from all-phrases view ([488b6c5](https://github.com/bamiyanapp/karuta/commit/488b6c5d7f9ec504601ba63fe9a71ea9f77438c0))


### Features

* add readCount to all-phrases list ([ba48feb](https://github.com/bamiyanapp/karuta/commit/ba48feb12ea181fa2a6baf5f12bc400bd6e24536))

## [1.4.2](https://github.com/bamiyanapp/karuta/compare/v1.4.1...v1.4.2) (2026-01-04)


### Bug Fixes

* remove duplicate changelog entry and format dates ([294edca](https://github.com/bamiyanapp/karuta/commit/294edcae66ab075906e9c07423bb0704d8b4720a))

## [1.4.1](https://github.com/bamiyanapp/karuta/compare/v1.4.0...v1.4.1) (2026-01-04)


### Bug Fixes

* prioritize detail view rendering over other views ([1948f48](https://github.com/bamiyanapp/karuta/commit/1948f480ed95f527d2cb2117bb89284ccba5854d))

# [1.4.0](https://github.com/bamiyanapp/karuta/compare/v1.3.0...v1.4.0) (2026-01-04)


### Features

* add all-phrases view page and update backend to return necessary data ([5d83132](https://github.com/bamiyanapp/karuta/commit/5d831323741332e788c0d2c0f4ee5f5933648355))

# [1.3.0](https://github.com/bamiyanapp/karuta/compare/v1.2.0...v1.3.0) (2026-01-04)


### Features

* use averageDifficulty for sorting easy/hard order ([b3b5f9d](https://github.com/bamiyanapp/karuta/commit/b3b5f9df53f063f2583c627bd32f061a24b2c12f))

# [1.2.0](https://github.com/bamiyanapp/karuta/compare/v1.1.1...v1.2.0) (2026-01-04)


### Features

* implement difficulty estimation logic and display ([10164e0](https://github.com/bamiyanapp/karuta/commit/10164e0f52fd26bab43a0ea727f33a4e32aaf531))

## [1.1.1](https://github.com/bamiyanapp/karuta/compare/v1.1.0...v1.1.1) (2026-01-04)


### Bug Fixes

* render changelog as markdown using react-markdown ([13a7f74](https://github.com/bamiyanapp/karuta/commit/13a7f74e6b6f1135e1a19aa8f51eb72ccd1b27bf))

# 1.0.0 (2026-01-04)


### Bug Fixes

* 1枚目の札の表示を3秒遅延させるように修正 ([3355845](https://github.com/bamiyanapp/karuta/commit/3355845f88ce789eace55bfd1ce4dcee4c3c2bd3))
* 1枚目の札の表示遅延を確実に適用 ([3612870](https://github.com/bamiyanapp/karuta/commit/361287003924b15a8331d6a09bbb68c9b77727c9))
* 1枚目の読み上げ表示を3秒遅延させ、詳細ページのスタイルと統計表示を修正 ([f31ceae](https://github.com/bamiyanapp/karuta/commit/f31ceae15b90cbfc9ce5fe6f0c326f97dae01cbd))
* Ensure latest Lambda code is deployed and fix import ([5aa35d8](https://github.com/bamiyanapp/karuta/commit/5aa35d873940965f065de4e6b8525f6ed58e3ac4))
* Fix Lambda getSignedUrl import and redeploy ([0ab104d](https://github.com/bamiyanapp/karuta/commit/0ab104de3bce06021e20ef13525af8ba0f57129c))
* Fix Polly presigned URL parameters manually ([05ff81f](https://github.com/bamiyanapp/karuta/commit/05ff81f5b42137305809bbeed3eb442cf6bfc0a7))
* Fix: Backend errors (DynamoDB keyword, speechRate, Polly engine) and Frontend undefined phrase error ([6247877](https://github.com/bamiyanapp/karuta/commit/6247877ee9b13ce5b664a04170d0725d389a1f7a))
* Fix: Replace 'カルタ' with 'かるた' in UI text ([111a669](https://github.com/bamiyanapp/karuta/commit/111a66926c48998951d651de2af4a74aa68f955c))
* lint errors ([f236ddd](https://github.com/bamiyanapp/karuta/commit/f236ddd8ca5107d9ec8a0d07798f4a7fa5d35164))
* UI: Adjust English font size in detail view and fix modal button layout for mobile ([d194f3a](https://github.com/bamiyanapp/karuta/commit/d194f3a8a59b98ebfbad2997bcbd563855961f85))
* アイコンのリンク切れ修正と読み上げスピードの基準調整 ([ed33f97](https://github.com/bamiyanapp/karuta/commit/ed33f97ec2399390a5c6ff25e8340a50322f1558))
* アニメーションのタイミングを3秒に修正し、繰り返し処理される不具合を解消 ([217edad](https://github.com/bamiyanapp/karuta/commit/217edad693bf0c76f491f3bb39c31f976a396140))
* アニメーションの不具合を修正し、タイミングを調整 ([d061022](https://github.com/bamiyanapp/karuta/commit/d061022850e974ddfb9b68cd43f94da1fdf50f11))
* アニメーション切り替え不具合と最初の札の表示遅延を修正 ([3a41c58](https://github.com/bamiyanapp/karuta/commit/3a41c58acef5ed883509caa0850f7af21fbe8cad))
* カードめくりアニメーションが2回実行される不具合を修正 ([2560eca](https://github.com/bamiyanapp/karuta/commit/2560eca6c39d949f45ca2947efa4d3eed7e20f9f))
* カードめくりアニメーションの重複実行を防止 ([a80dc84](https://github.com/bamiyanapp/karuta/commit/a80dc842bfe6f8162156b0847232704039227c52))
* カルタの札データの修正 (phrases.csv) ([5f43c46](https://github.com/bamiyanapp/karuta/commit/5f43c462741cd77dec17e94b3a50e3300d99d2ec))
* カルタ名称の表示化け対策 (notranslate追加) ([78210d9](https://github.com/bamiyanapp/karuta/commit/78210d975009bceff3e17c03ff802e9ce6356744))
* カルタ札データの復元と英語翻訳の追加 (phrases.csv) ([b74280c](https://github.com/bamiyanapp/karuta/commit/b74280cd2f16d26e258371fa9a58c2fce4a65bed))
* トップ画面のアイコン表示を修正 ([51ab226](https://github.com/bamiyanapp/karuta/commit/51ab2261a9fd3f5ce4ffbf5a685c1031c2c6c8c6))
* 詳細ページのカルタ表示スタイルを修正し、統計情報の表示を改善 ([46b0601](https://github.com/bamiyanapp/karuta/commit/46b0601361a3fcb07383b1b441084c1c0a4168d9))


### Features

* Add files via upload ([a2fbcad](https://github.com/bamiyanapp/karuta/commit/a2fbcad7bb1f93bb8a49124f7cbaa890cebdbf7e))
* CSV更新時にDynamoDBの統計情報を引き継ぐようにseed.jsを修正し、csvから統計列を削除 ([7f24486](https://github.com/bamiyanapp/karuta/commit/7f244868898510e9b9ef35fc4f900c9752c52d83))
* DynamoDBのキー構造変更（categoryをパーティションキーに変更）への対応 ([dcd5647](https://github.com/bamiyanapp/karuta/commit/dcd56476e694d3c04b3994b51c814a4ae3cec21a))
* DynamoDBのキー構造変更への対応と移行スクリプトの追加、およびgitignoreの更新 ([46efd92](https://github.com/bamiyanapp/karuta/commit/46efd9289057529e24fb84e8ccd85161ba26f499))
* Feat: Add English phrase display in detail view while keeping Japanese display in game mode ([344c895](https://github.com/bamiyanapp/karuta/commit/344c8953f050340b62aa449ed7c54bffb37a8ae1))
* JSON形式での更新履歴生成とアプリ内表示の追加 ([8c69bf7](https://github.com/bamiyanapp/karuta/commit/8c69bf7450497d891651781b1e3a58779ea65cc9))
* semantic-releaseの導入とリリースノートへのリンク追加 ([798cade](https://github.com/bamiyanapp/karuta/commit/798cadeb43ed9f3f3d6b13d7837d7bd198aea6c6))
* カルタの所要時間を計測・記録する機能を追加 ([e2734d3](https://github.com/bamiyanapp/karuta/commit/e2734d3cc744fd5a83e1f8f48f3a3527d3a0e2d3))
* カルタ説明ページ（詳細画面）の追加 ([60fef9b](https://github.com/bamiyanapp/karuta/commit/60fef9b35e144323c297b64891858fb9ac528f9d))
* コメント投稿機能と指摘一覧ページの追加 ([06af063](https://github.com/bamiyanapp/karuta/commit/06af0635bad7711b7829547e9c33d9421aad0bc3))
* めくりアニメーションをフェードイン・アウトに修正し、最初の札も遅延表示されるように修正 ([fc38466](https://github.com/bamiyanapp/karuta/commit/fc38466455fa9cbf07c848c9141479722e664751))
* めくりアニメーションをフェードイン・アウトに修正し、札の表示遅延を確実に適用 ([49816fd](https://github.com/bamiyanapp/karuta/commit/49816fd6609e6ae6e562e5cb8d1eaef643b272b0))
* 主キーを連番に変更し、CSV更新時にIDが変更されないように修正 ([bf0206e](https://github.com/bamiyanapp/karuta/commit/bf0206e2f99199124df4f673353882ca2a93b4c5))
* 全読了時の音声追加、読み上げ設定の強化、およびシステム安定性の向上 ([612be9a](https://github.com/bamiyanapp/karuta/commit/612be9a424514e285967c99e2de2d599e6c85289))
* 複数カルタ対応、UI/UXの改善、および読み上げ機能の強化 ([b595658](https://github.com/bamiyanapp/karuta/commit/b59565848a55eea601965f7d8abbd872b6bea589))
* 読み上げ5秒後にカードがめくれるアニメーションを追加 ([615b051](https://github.com/bamiyanapp/karuta/commit/615b051a185bccc919fba54f024ab0217f4fe569))
* 読み上げ中に次の札を予約できるようにUIを改善 ([f7fffd0](https://github.com/bamiyanapp/karuta/commit/f7fffd0842ce10b2decfaba59233e0ded7b90579))
* 読み上げ開始前に wadodon 音声を再生するように変更 ([cfa226d](https://github.com/bamiyanapp/karuta/commit/cfa226d7dba7c0d2affc3fe41cb2d1e57eaffe33))
* 読み上げ順のオプション（ランダム、簡単、難しい）を追加 ([e293675](https://github.com/bamiyanapp/karuta/commit/e2936757327c39292b154046a399b50b9336761f))


### BREAKING CHANGES

* Major update introduced by feat: DynamoDBのキー構造変更（categoryをパーティションキーに変更）への対応
* Major update introduced by feat: 読み上げ順のオプション（ランダム、簡単、難しい）を追加
* Major update introduced by feat: カルタの所要時間を計測・記録する機能を追加
* Major update introduced by feat: コメント投稿機能と指摘一覧ページの追加
* Major update introduced by feat: 複数カルタ対応、UI/UXの改善、および読み上げ機能の強化
