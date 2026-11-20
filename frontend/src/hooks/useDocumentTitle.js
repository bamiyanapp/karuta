import { useEffect } from "react";

const APP_TITLE = "かるた読み上げ";

// 現在の画面に応じて、タブのタイトル（document.title）を更新する。
// 優先順位は、画面（指摘一覧・更新履歴・全札一覧・共有・絵札印刷）、札の詳細、カテゴリ名、アプリ名の順。
// App.jsxから切り出した（issue #2192）
export function resolveDocumentTitle({ view, categoryLabel, detailPhraseId, detailPhrase }) {
  if (view === "comments") return `指摘一覧 | ${APP_TITLE}`;
  if (view === "changelog") return `更新履歴 | ${APP_TITLE}`;
  if (view === "all-phrases") return `全札一覧 | ${APP_TITLE}`;
  if (view === "share") return `アプリを共有 | ${APP_TITLE}`;
  if (view === "print-efuda") return `${categoryLabel}の絵札印刷 | ${APP_TITLE}`;
  if (detailPhraseId && detailPhrase) return `${detailPhrase.phrase} | ${detailPhrase.category}`;
  if (categoryLabel) return categoryLabel;
  return APP_TITLE;
}

export function useDocumentTitle({ view, categoryLabel, detailPhraseId, detailPhrase }) {
  useEffect(() => {
    document.title = resolveDocumentTitle({ view, categoryLabel, detailPhraseId, detailPhrase });
  }, [view, categoryLabel, detailPhraseId, detailPhrase]);
}
