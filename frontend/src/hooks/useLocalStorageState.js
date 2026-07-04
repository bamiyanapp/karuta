import { useEffect, useState } from "react";

// localStorageと同期するstate。parse/formatを省略すると素の文字列として扱う。
export function useLocalStorageState(key, defaultValue, parse = (v) => v, format = (v) => v) {
  const [value, setValue] = useState(() => {
    const stored = localStorage.getItem(key);
    return stored !== null ? parse(stored) : defaultValue;
  });

  useEffect(() => {
    localStorage.setItem(key, format(value));
    // parse/formatは呼び出し側で毎回新しい関数参照になり得るが、
    // 実際に永続化したいのはkey/valueの変化のみであるため依存配列には含めない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, value]);

  return [value, setValue];
}
