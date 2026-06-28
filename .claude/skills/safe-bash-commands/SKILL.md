---
name: safe-bash-commands
description: Bashツールでコマンドを実行する直前、特に git diff/log/show/branch/blame、man、less/more、cp/rm の対話確認、npm init、AWS CLI など「ページャー起動」「対話プロンプト」で入力待ちになり得る操作を行う前に使う。非対話フラグやページャー無効化の具体的な回避策と、ハングからの復帰手順を提供する。
---

# Bashコマンドのハング・対話プロンプト回避

Bashツールでのコマンド実行が入力待ちで停止する事象を避けるため、以下を遵守する。

1. **長大なコミットコマンドの分割**: 長いメッセージを含む `git commit` はヒアドキュメントを使う。`&&` で繋いだ長いワンライナーが停止した場合は、次回は分割して実行する。
2. **状態確認による再開**: 前回のコマンドが成功したか不明な場合は、必ず `git status` や `git --no-pager log` で現状を確認する。すでにコミット済みなら二重実行せず次のステップへ進む。
3. **非対話実行の徹底**: 常に非対話フラグを使用する。

## よく停止するコマンドと回避策

### Git（ページャー起動の回避）

| コマンド | 回避策 |
|---|---|
| `git diff` | `git --no-pager diff`、または `git diff \| cat` |
| `git log` | `git --no-pager log`、必要なら `-n 5` 等で件数制限 |
| `git show` | `git --no-pager show HEAD`、または `\| cat` |
| `git branch` | `git --no-pager branch -a`、または `\| cat` |
| `git blame` | `git blame filepath \| cat` |

共通の回避策として `PAGER=cat git log` のように環境変数で無効化してもよい。

### ファイル閲覧・検索

`less` / `more` / `view` / 裸の `man` は絶対に使用しない。代わりに `Read` ツール、または非対話の `cat` / `head -n` / `tail -n` を使う（`man` は `man git | cat` のようにパイプする）。

### パッケージ管理

- `npm init` は `npm init -y`。
- 依存インストールは対話を避けるため `npm ci` を優先する。
- `npm publish` 等、認証や2FAプロンプトが想定される操作は事前に確認する。

### ファイル操作

- 削除は `rm -f` / `rm -rf`。
- コピー・移動でエイリアスの `-i`（対話確認）が効く環境では `\cp -f src dest` のようにバックスラッシュでエイリアスを回避する。
- ただし、これらの破壊的操作はシステムの Git Safety Protocol（force push、`reset --hard`、未コミット変更の上書き等）に従い、必要な場面では事前にユーザー確認を行う。本節はあくまで「意図した操作が対話プロンプトで止まらないようにする」ためのものであり、確認手順を省略する許可ではない。

### その他CLI（AWS, Serverless, Docker等）

- AWS CLI v2 はデフォルトでページャーが起動するため `AWS_PAGER="" aws s3 ls` のように呼び出す。
