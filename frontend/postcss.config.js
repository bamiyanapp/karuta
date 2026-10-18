// karuta#1772: Bootstrap CSS（186KB中183KB・98.3%が未使用、Lighthouse
// unused-css-rules/render-blocking-resources対応）を、実際に使用している
// クラスのみへ絞り込む。Bootstrap JS（data-bs-*によるモーダル・ドロップダウン
// 等）は未使用のため、Bootstrap JSが実行時に動的付与するstate classは
// safelistで保険として残す
import { purgeCSSPlugin as purgecss } from "@fullhuman/postcss-purgecss";

export default {
  plugins: [
    purgecss({
      content: ["./index.html", "./src/**/*.jsx", "./src/**/*.js"],
      defaultExtractor: (content) => content.match(/[\w-/:]+(?<!:)/g) || [],
      safelist: {
        standard: [
          /^show$/,
          /^fade$/,
          /^collapsing$/,
          /^collapse$/,
          /^active$/,
          /^disabled$/,
          /^focus-visible$/,
          /^was-validated$/,
          /^is-invalid$/,
          /^is-valid$/,
          /^backdrop$/,
          /^modal-backdrop$/,
          /^offcanvas-backdrop$/,
          /^dropdown-menu$/,
          /^dropdown-toggle$/,
        ],
      },
    }),
  ],
};
