import { useEffect, useState } from "react";
import { API_BASE_URL } from "../config";

// issue #1462: フロントエンドの表示バージョンと、実際に応答しているバックエンドの
// バージョンが一致しているかをユーザー自身が確認できるようにする。canaryの
// 自己修復処理（#1448）はbackend→frontendを順番にデプロイするため、途中で
// 失敗すると一時的にフロント・バックエンドのバージョンがズレる可能性がある。
// 取得に失敗しても画面表示自体には影響させず、静かにnullのままにする
export default function useBackendVersion() {
  const [backendVersion, setBackendVersion] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE_URL}/get-version`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          setBackendVersion(data);
        }
      })
      .catch(() => {
        // バージョン不一致の検知は付加的な情報であり、取得失敗時に
        // エラー表示をするとノイズになるため何もしない
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return backendVersion;
}
