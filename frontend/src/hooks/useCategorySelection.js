import { useMemo, useState } from "react";

// 指定したカテゴリ名一覧について、対応するcount（枚数）の合計を求める
// （絵札印刷の上限バリデーション用）
function sumCategoryCounts(categoryNames, categories) {
  return categoryNames.reduce((total, name) => {
    const info = categories.find((c) => c.name === name);
    return total + (info?.count || 0);
  }, 0);
}

// かるたの種類（カテゴリ）選択画面の下書き・合計枚数・所持確認の対象・決定/印刷ボタンの処理。
// App.jsxから切り出した（issue #2192）。
//
// divisionとselectedCategoriesはURLと同期する画面遷移の状態（useUrlQuerySync）としてApp.jsxに残すため、
// setterを引数で受け取る。maxPrintCardsは絵札印刷の合計枚数の上限で、追加後の合計が上限を超える
// 選択はブロックする（PDF出力が破綻しない範囲に制限するバリデーション）。
export function useCategorySelection({ division, setDivision, categories, setSelectedCategories, setView, maxPrintCards }) {
  const [draftCategories, setDraftCategories] = useState([]);

  // 印刷対象の合計枚数（PDF出力の上限バリデーション用）。countが未設定の
  // カテゴリ（古いAPIレスポンス等）は0枚として扱い、上限チェックに影響させない
  const draftCardCount = useMemo(
    () => sumCategoryCounts(draftCategories, categories),
    [draftCategories, categories]
  );

  // 答えのデータがある（＝市販品でなくオリジナルの）かるたは所持確認が不要なため、
  // 選択中のかるたのうち実際に所持確認が必要なものだけを抽出する
  const draftCategoriesRequiringPossessionCheck = useMemo(() => {
    return draftCategories.filter((name) => {
      const cat = categories.find((c) => c.name === name);
      // フィールド未設定時は従来どおり所持確認が必要な扱いとする
      return cat ? cat.requiresPossessionCheck !== false : true;
    });
  }, [draftCategories, categories]);

  const clearDraftCategories = () => setDraftCategories([]);

  const selectDivision = (div) => {
    setDivision(div);
    setDraftCategories([]);
  };

  const goBackToDivisionSelect = () => {
    setDivision(null);
    setDraftCategories([]);
  };

  const toggleDraftCategory = (cat) => {
    if (division === "kids") {
      // こども向けは1件しか選べない仕様のため、決定ボタン・確認モーダルを
      // 経由せずワンタップで読み上げ画面に遷移する
      setSelectedCategories([cat]);
      setDraftCategories([]);
      setView("game");
      return;
    }
    setDraftCategories((prev) => {
      if (prev.includes(cat)) return prev.filter((c) => c !== cat);
      // 追加後の合計枚数が上限を超える場合は選択自体をブロックする
      const catInfo = categories.find((c) => c.name === cat);
      if (sumCategoryCounts(prev, categories) + (catInfo?.count || 0) > maxPrintCards) {
        return prev;
      }
      return [...prev, cat];
    });
  };

  const handleDecideClick = () => {
    if (draftCategories.length === 0) return;
    setSelectedCategories(draftCategories);
    setDraftCategories([]);
    setView("game");
  };

  const handlePrintEfudaClick = () => {
    if (draftCategories.length === 0) return;
    setSelectedCategories(draftCategories);
    setView("print-efuda");
  };

  return {
    draftCategories,
    draftCardCount,
    draftCategoriesRequiringPossessionCheck,
    clearDraftCategories,
    selectDivision,
    goBackToDivisionSelect,
    toggleDraftCategory,
    handleDecideClick,
    handlePrintEfudaClick,
  };
}
