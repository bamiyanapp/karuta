@dev-standards/CLAUDE.md

## 11. karuta固有ルール

### 対象パッケージ（「1. 開発プロセス」手順6、「4. 静的チェック」関連）

静的チェック（lint / test / build）の対象パッケージは `frontend` と `backend` の両方とする。両方でエラー0件を確認するまで、コミット作成や完了報告に進んではならない。

### CI・自動マージ（「10. PR（MR）承認・マージ禁止」関連）

このリポジトリはCIでのテスト等の通過を条件に自動マージされる仕組みを採用している。この仕組みの有無にかかわらず、共通ルール「10. PR（MR）承認・マージ禁止」を厳守し、PR（MR）の承認・マージは行わないこと。

### dev-standards submodule更新

`dev-standards`は特定コミットに固定したgit submoduleとして参照しているため、dev-standards側の変更は自動反映されない。Renovate（`renovate.json`の`git-submodules`設定）がdev-standards mainの更新を検知し、submodule参照コミットを更新するPRを自動作成する。このPRについても上記のCI・自動マージ規則（承認・マージ禁止）が適用される。
