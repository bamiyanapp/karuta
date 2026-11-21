import { useEffect, useMemo, useState } from "react";
import { getPhrasesList } from "../api/endpoints";
import { comparePhraseValues } from "../utils/phraseSort";

// 全札一覧画面の取得・ソート設定・種別/区分の絞り込み・テキスト検索と、それらから導出する一覧。
// App.jsxから切り出した（issue #2192）。
//
// viewが"all-phrases"になった時に取得する（issue #2190: 取得失敗は、「読み込み中」「0件」と
// 区別するためfetchErrorで別に持ち、retryFetchで再取得する）。
// categoriesはgetCategories由来のカテゴリ一覧で、groupフィールドを持つ。
// allPhrases（get-phrases-list由来）自体にはgroupが無いため、カテゴリ名で突き合わせる。
// group不明時は既定値である"kids"扱いにする（backend/handler.jsのgetCategoriesの既定値と合わせる）。
export function useAllPhrasesList(view, categories) {
  const [allPhrases, setAllPhrases] = useState([]);
  const [fetchError, setFetchError] = useState(false);
  // 再取得を起動するためだけのstate。値自体に意味はない
  const [retryToken, setRetryToken] = useState(0);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [filterCategory, setFilterCategory] = useState("");
  // 種別ボタンが多すぎて探しづらい問題（issue #730）に対応するため、
  // まず「こども向け/エンジニア向け」で絞り込んでから種別ボタンを表示する
  const [filterDivision, setFilterDivision] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (view !== "all-phrases") return;
    const fetchAllPhrases = async () => {
      setFetchError(false);
      try {
        const data = await getPhrasesList();
        setAllPhrases(data.phrases || []);
      } catch (error) {
        console.error("Error fetching all phrases:", error);
        setFetchError(true);
      }
    };
    fetchAllPhrases();
  }, [view, retryToken]);

  const handleSort = (key) => {
    const direction = sortConfig.key === key && sortConfig.direction === "asc" ? "desc" : "asc";
    setSortConfig({ key, direction });
  };

  const sortedPhrases = useMemo(() => {
    const sortableItems = [...allPhrases];
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => comparePhraseValues(a, b, sortConfig));
    }
    return sortableItems;
  }, [allPhrases, sortConfig]);

  const uniqueCategories = useMemo(
    () => [...new Set(allPhrases.map((p) => p.category))].sort((a, b) => a.localeCompare(b, "ja")),
    [allPhrases]
  );

  const categoryGroupMap = useMemo(() => {
    const map = new Map();
    categories.forEach((cat) => map.set(cat.name, cat.group));
    return map;
  }, [categories]);

  const visibleCategories = useMemo(() => {
    if (!filterDivision) return uniqueCategories;
    return uniqueCategories.filter((name) => (categoryGroupMap.get(name) || "kids") === filterDivision);
  }, [uniqueCategories, filterDivision, categoryGroupMap]);

  const categoryCount = useMemo(() => {
    const counts = {};
    allPhrases.forEach((p) => {
      counts[p.category] = (counts[p.category] || 0) + 1;
    });
    return counts;
  }, [allPhrases]);

  const filteredPhrases = useMemo(() => {
    let items = sortedPhrases;
    if (filterCategory) {
      items = items.filter((p) => p.category === filterCategory);
    }
    const trimmedQuery = searchQuery.trim().toLowerCase();
    if (trimmedQuery) {
      items = items.filter((p) =>
        [p.phrase, p.kana, p.answer].some((field) => (field || "").toLowerCase().includes(trimmedQuery))
      );
    }
    return items;
  }, [sortedPhrases, filterCategory, searchQuery]);

  return {
    allPhrases,
    fetchError,
    retryFetch: () => setRetryToken((token) => token + 1),
    sortConfig,
    handleSort,
    filterCategory,
    setFilterCategory,
    filterDivision,
    setFilterDivision,
    searchQuery,
    setSearchQuery,
    visibleCategories,
    categoryCount,
    filteredPhrases,
  };
}
