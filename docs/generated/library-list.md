# ライブラリ一覧（自動生成）

このファイルは各パッケージの`package.json`から`scripts/docs/generate-library-list.js`によって自動生成される。手動で編集しないこと。再生成するには`node scripts/docs/generate-library-list.js`を実行する（[issue #906](https://github.com/bamiyanapp/karuta/issues/906)）。

フラットな依存パッケージ一覧であり、自然なグラフ構造を持たないため図式化の対象とはしない（Renovateが依存更新PRを作成する運用のため、更新への追従はそちらに委ねる）。

## frontend

| パッケージ | バージョン範囲 | 種別 |
| :--- | :--- | :--- |
| `@eslint/js` | `^10.0.0` | devDependencies |
| `@playwright/test` | `^1.61.1` | devDependencies |
| `@testing-library/dom` | `^10.4.1` | devDependencies |
| `@testing-library/jest-dom` | `^7.0.0` | devDependencies |
| `@testing-library/react` | `^16.3.1` | devDependencies |
| `@types/react` | `^19.2.5` | devDependencies |
| `@types/react-dom` | `^19.2.3` | devDependencies |
| `@vitejs/plugin-react` | `^6.0.0` | devDependencies |
| `@vitest/coverage-v8` | `^4.0.0` | devDependencies |
| `eslint` | `^10.0.0` | devDependencies |
| `eslint-plugin-import-x` | `^4.17.1` | devDependencies |
| `eslint-plugin-jsx-a11y-x` | `^0.2.0` | devDependencies |
| `eslint-plugin-react-hooks` | `^7.0.1` | devDependencies |
| `eslint-plugin-react-refresh` | `^0.5.0` | devDependencies |
| `eslint-plugin-sonarjs` | `^4.2.0` | devDependencies |
| `globals` | `^17.0.0` | devDependencies |
| `jsdom` | `^30.0.0` | devDependencies |
| `monocart-reporter` | `^2.12.2` | devDependencies |
| `qrcode` | `^1.5.4` | dependencies |
| `react` | `^19.2.3` | dependencies |
| `react-dom` | `^19.2.3` | dependencies |
| `react-markdown` | `^10.1.0` | dependencies |
| `vite` | `^8.0.0` | devDependencies |
| `vite-plugin-pwa` | `^1.3.0` | devDependencies |
| `vitest` | `^4.0.0` | devDependencies |
| `workbox-window` | `^7.4.1` | devDependencies |

## backend

| パッケージ | バージョン範囲 | 種別 |
| :--- | :--- | :--- |
| `@aws-sdk/client-apigatewaymanagementapi` | `^3.958.0` | dependencies |
| `@aws-sdk/client-dynamodb` | `^3.958.0` | dependencies |
| `@aws-sdk/client-lambda` | `^3.1087.0` | dependencies |
| `@aws-sdk/client-polly` | `^3.958.0` | dependencies |
| `@aws-sdk/client-s3` | `^3.958.0` | dependencies |
| `@aws-sdk/lib-dynamodb` | `^3.958.0` | dependencies |
| `@aws-sdk/polly-request-presigner` | `^3.958.0` | dependencies |
| `@aws-sdk/s3-request-presigner` | `^3.958.0` | dependencies |
| `@eslint/js` | `^10.0.0` | devDependencies |
| `@sparticuz/chromium` | `^149.0.0` | dependencies |
| `@vitest/coverage-v8` | `^4.0.0` | devDependencies |
| `aws-sdk-client-mock` | `^4.1.0` | devDependencies |
| `csv-parse` | `^7.0.0` | dependencies |
| `esbuild` | `^0.28.0` | devDependencies |
| `eslint` | `^10.0.0` | devDependencies |
| `eslint-plugin-n` | `^18.2.2` | devDependencies |
| `eslint-plugin-sonarjs` | `^4.2.0` | devDependencies |
| `globals` | `^17.0.0` | devDependencies |
| `osls` | `^3.0.0` | devDependencies |
| `puppeteer-core` | `^25.0.0` | dependencies |
| `serverless-esbuild` | `^1.57.2` | devDependencies |
| `vitest` | `^4.0.0` | devDependencies |

## root（commitlint・semantic-release等の開発用）

| パッケージ | バージョン範囲 | 種別 |
| :--- | :--- | :--- |
| `@commitlint/cli` | `^21.0.0` | devDependencies |
| `@commitlint/config-conventional` | `^21.0.0` | devDependencies |
| `@semantic-release/changelog` | `^7.0.0` | devDependencies |
| `@semantic-release/commit-analyzer` | `^13.0.0` | devDependencies |
| `@semantic-release/exec` | `^7.0.0` | devDependencies |
| `@semantic-release/git` | `^11.0.0` | devDependencies |
| `@semantic-release/github` | `^12.0.0` | devDependencies |
| `@semantic-release/npm` | `^13.1.3` | devDependencies |
| `@semantic-release/release-notes-generator` | `^14.0.1` | devDependencies |
| `conventional-changelog-conventionalcommits` | `^10.2.1` | devDependencies |
| `js-yaml` | `^5.0.0` | devDependencies |
| `semantic-release` | `^25.0.2` | devDependencies |

