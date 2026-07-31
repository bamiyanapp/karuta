# CI/CD構成図（自動生成）

このファイルはdev-standardsの`reusable-ci.yml`のjob定義と、karuta自身の`.github/workflows/ci.yml`/`cd.yml`から`scripts/docs/generate-cicd-architecture.js`によって自動生成される。手動で編集しないこと。再生成するには`node scripts/docs/generate-cicd-architecture.js`を実行する（[issue #905](https://github.com/bamiyanapp/karuta/issues/905)）。

job間の依存（`needs:`）およびkarutaの実際の設定（`ci.yml`の`with:`）に基づく有効/無効の判定は静的解析で抽出しているが、dev-standards submoduleの参照バージョンが更新されるとjob構成自体が変わりうる点に留意する。

## CIワークフロー（reusable-ci.yml、karuta設定反映）

```mermaid
graph TD
    commitlint["commitlint"]
    frontend-test["frontend-test"]
    backend-test["backend-test"]
    package-test["package-test（karutaでは無効/スキップ）"]
    style package-test stroke-dasharray: 5 5
    frontend-e2e-test["frontend-e2e-test"]
    standards-check["standards-check"]
    duplication-check["duplication-check"]
    render-mermaid-diagrams["render-mermaid-diagrams"]
    merge["merge"]

    commitlint --> frontend-test
    commitlint --> backend-test
    commitlint --> package-test
    commitlint --> frontend-e2e-test
    commitlint --> standards-check
    commitlint --> duplication-check
    commitlint --> render-mermaid-diagrams
    commitlint --> merge
    frontend-test --> merge
    backend-test --> merge
    package-test --> merge
    frontend-e2e-test --> merge
    standards-check --> merge
    duplication-check --> merge
    render-mermaid-diagrams --> merge
```

## CDワークフロー（karuta cd.yml）

```mermaid
graph TD
    release["release"]
    build-and-deploy-frontend["build-and-deploy-frontend"]
    deploy-backend["deploy-backend"]

    release --> build-and-deploy-frontend
    release --> deploy-backend
```
