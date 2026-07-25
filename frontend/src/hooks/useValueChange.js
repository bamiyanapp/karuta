import { useState } from "react";

// issue #800: 「前回レンダー時の値と比較し、変わっていれば副作用の無いstate更新を
// 同期的に行う」という「レンダー中のstate調整」パターン（useEffect内での
// 無条件setStateがreact-hooks/set-state-in-effectに抵触するのを避けるため、
// Reactが推奨する代替手段）が、早押しラウンドキーの判定・接続状態の監視・
// roomId変更の検知などに同型で繰り返し現れていたため共通化した。
// onChangeは副作用を伴わない同期的なstate更新のみを行うこと（レンダー中に
// 呼ばれるため、fetch等の非同期処理やDOM操作はuseEffectに書くこと）。
// value自体の導出ロジック（前回値への依存を含む複雑な分岐等）はこのhookの
// 対象外とし、呼び出し側に委ねる
export function useValueChange(value, onChange) {
  const [previous, setPrevious] = useState(value);
  if (value !== previous) {
    setPrevious(value);
    onChange(value, previous);
  }
}
