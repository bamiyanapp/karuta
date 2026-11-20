import { useEffect, useRef, useState } from "react";
import { getCategories } from "../api/endpoints";
import { useNotify } from "../components/NotificationProvider";

// カテゴリ一覧の取得。App.jsxから切り出した（issue #2192）。
// リトライは、APIクライアント（api/endpoints.jsのCATEGORIES_RETRY、issue #2187）が行う。
// ここでは、アンマウント時の中断と、全リトライが尽きたときの通知だけを扱う。
// 経緯: PWA更新直後やLambdaのコールドスタートで、取得が一過性に失敗しやすい（issue #758・#1798・#1933）。
// そのため、即座に通知せず、リトライを使い切ってから通知する。
//
// onLoaded(categories): 取得が完了した時に、一度呼ぶ（任意）。取得完了時点の画面に依存する
// 処理（ゲーム画面のとき、選択中のカテゴリを、存在するものへ絞り込む等）を、呼び出し側が行う。
// 最新のonLoadedを参照するため、呼び出し側が毎回新しい関数を渡しても、再取得は起きない
export function useCategories({ onLoaded } = {}) {
  const notify = useNotify();
  const [categories, setCategories] = useState([]);
  const onLoadedRef = useRef(onLoaded);
  useEffect(() => {
    onLoadedRef.current = onLoaded;
  }, [onLoaded]);

  useEffect(() => {
    const controller = new AbortController();
    const fetchCategories = async () => {
      try {
        const data = await getCategories({ signal: controller.signal });
        const availableCategories = data.categories || [];
        setCategories(availableCategories);
        onLoadedRef.current?.(availableCategories);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Error fetching categories:", error);
        notify({ type: "error", message: "カテゴリの取得に失敗しました。" });
      }
    };
    fetchCategories();
    return () => controller.abort();
  }, [notify]);

  return categories;
}
