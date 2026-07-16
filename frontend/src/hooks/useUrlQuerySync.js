import { useEffect } from "react";

export const parseCategoriesParam = (value) => (value ? value.split(",").filter(Boolean).map(decodeURIComponent) : []);
export const serializeCategoriesParam = (categories) => categories.map(encodeURIComponent).join(",");

const URL_SYNCED_VIEWS = ["comments", "changelog", "all-phrases", "print-efuda", "quiz-room"];

// selectedCategories/division/detailPhraseId/viewをURLクエリパラメータと双方向に同期する。
// (state→URL、およびブラウザの戻る/進む操作によるURL→stateの両方向)
export function useUrlQuerySync({
  selectedCategories,
  division,
  detailPhraseId,
  view,
  setSelectedCategories,
  setDivision,
  setDetailPhraseId,
  setView,
}) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (selectedCategories.length > 0) {
      params.set("category", serializeCategoriesParam(selectedCategories));
    } else {
      params.delete("category");
    }

    if (division) {
      params.set("division", division);
    } else {
      params.delete("division");
    }

    if (detailPhraseId) {
      params.set("id", detailPhraseId);
    } else {
      params.delete("id");
    }

    if (URL_SYNCED_VIEWS.includes(view)) {
      params.set("view", view);
    } else {
      params.delete("view");
    }

    const newSearch = params.toString();
    const url = newSearch ? `?${newSearch}` : window.location.pathname;
    window.history.pushState({}, "", url);
  }, [selectedCategories, division, detailPhraseId, view]);

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const category = params.get("category");
      setSelectedCategories(parseCategoriesParam(category));
      setDivision(params.get("division") || null);
      setDetailPhraseId(params.get("id"));
      setView(params.get("view") || "game");
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [setSelectedCategories, setDivision, setDetailPhraseId, setView]);
}
