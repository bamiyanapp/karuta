import { useState, useEffect, useMemo } from "react";
import { useLocalStorageState } from "./useLocalStorageState";

// テーマ設定（ライト/ダーク/システム）の保持、OSの配色設定の監視、<html>のdata-bs-themeへの反映。
// App.jsxから切り出した（issue #2192）
export function useThemeSetting() {
  const [themeSetting, setThemeSetting] = useLocalStorageState("theme", "system");
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => {
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  });

  const resolvedTheme = useMemo(() => {
    if (themeSetting !== "system") return themeSetting;
    return systemPrefersDark ? "dark" : "light";
  }, [themeSetting, systemPrefersDark]);

  useEffect(() => {
    document.documentElement.setAttribute("data-bs-theme", resolvedTheme);
  }, [resolvedTheme]);

  // OSの配色設定(ダーク/ライト)の変更をリアルタイムに反映する
  useEffect(() => {
    const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mediaQuery) return;
    const handleChange = (e) => setSystemPrefersDark(e.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return { themeSetting, setThemeSetting, resolvedTheme };
}
