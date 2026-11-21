import { useEffect, useState } from "react";
import { getPhrasesList } from "../api/endpoints";
import { useNotify } from "../components/NotificationProvider";

// 選択中のカテゴリの札一覧の取得・取得失敗の状態・再試行。App.jsxから切り出した（issue #2192）。
//
// issue #474: 以前はPromise.allを使っており、選択中の1カテゴリでも取得に失敗すると全体がrejectして、
// 札の一覧が空配列にリセットされていた（カテゴリ数が多い「全カテゴリ選択」ほど、並列リクエスト数が増え、
// 個々の失敗確率も上がるため、発生しやすかった）。Promise.allSettledを使い、失敗したカテゴリがあっても、
// 成功分はそのまま反映しつつ、phrasesFetchErrorで失敗の有無だけ別途知らせる。
// 「まだ読み込んでいない」（札が0件）と、取得失敗を区別するための専用stateである。
//
// 戻り値のretryFetchPhrasesListは、「再試行する」ボタンから、同じカテゴリ構成のまま再取得を起動する。
export function useCategoryPhrases(selectedCategories) {
  const notify = useNotify();
  const [allPhrasesForCategory, setAllPhrasesForCategory] = useState([]);
  const [phrasesFetchError, setPhrasesFetchError] = useState(false);
  // 再取得を起動するためだけのstate。値自体に意味はない
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    const fetchPhrasesList = async () => {
      if (selectedCategories.length === 0) {
        setAllPhrasesForCategory([]);
        setPhrasesFetchError(false);
        return;
      }
      const settled = await Promise.allSettled(
        selectedCategories.map(async (cat) => {
          const data = await getPhrasesList(cat);
          return data.phrases || [];
        })
      );
      const succeeded = settled.filter((r) => r.status === "fulfilled").flatMap((r) => r.value);
      const failedCount = settled.filter((r) => r.status === "rejected").length;
      settled.forEach((r, i) => {
        if (r.status === "rejected") {
          console.error(`Error fetching phrases for category "${selectedCategories[i]}":`, r.reason);
        }
      });
      setAllPhrasesForCategory(succeeded);
      setPhrasesFetchError(failedCount > 0);
      // 選択中の全カテゴリが失敗した場合（部分的な失敗ではなく完全な失敗）のみ、
      // 従来どおり通知で知らせる。1カテゴリの失敗程度では通知を出さない
      if (failedCount > 0 && succeeded.length === 0) {
        notify({ type: "error", message: "かるたデータの取得に失敗しました。もう一度お試しください。" });
      }
    };
    fetchPhrasesList();
  }, [selectedCategories, retryToken, notify]);

  const retryFetchPhrasesList = () => setRetryToken((token) => token + 1);

  return { allPhrasesForCategory, phrasesFetchError, retryFetchPhrasesList };
}
