@dev-standards/CLAUDE.md

## 11. karuta固有ルール

### 対象パッケージ（「1. 開発プロセス」手順6、「4. 静的チェック」関連）

静的チェック（lint / test / build）の対象パッケージは `frontend` と `backend` の両方とする。両方でエラー0件を確認するまで、コミット作成や完了報告に進んではならない。

### CI・自動マージ（「10. PR（MR）承認・マージ禁止」関連）

このリポジトリはCIでのテスト等の通過を条件に自動マージされる仕組みを採用している。この仕組みの有無にかかわらず、共通ルール「10. PR（MR）承認・マージ禁止」を厳守し、PR（MR）の承認・マージは行わないこと。

### PR（MR）自動作成

git-workflow Skillの定めるとおり、作業ブランチの変更をpushした後のPR作成はユーザーへ都度確認せず自動で行う。「PRを作成してよいか」を尋ねる必要はない。既に同一の作業ブランチに対応するPRが存在する場合は新規作成せずpushのみで更新する。PR作成後の承認・マージは「10. PR（MR）承認・マージ禁止」のとおり行わない。

### dev-standards submodule更新

`dev-standards`は特定コミットに固定したgit submoduleとして参照しているため、dev-standards側の変更は自動反映されない。Renovate（`renovate.json`の`git-submodules`設定）がdev-standards mainの更新を検知し、submodule参照コミットを更新するPRを自動作成する。このPRについても上記のCI・自動マージ規則（承認・マージ禁止）が適用される。
