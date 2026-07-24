import { useMemo, useState } from "react";
import { useSessionStorageState } from "./useSessionStorageState";

const PLAYERS_STORAGE_KEY = "players";
const SCORES_STORAGE_KEY = "scoresByCategory";
const MAX_PLAYERS = 6;

// 「取った人を記録する」参加者登録・スコア集計（issue #518）をまとめたカスタムhook
// （issue #607でApp.jsxから切り出し）。読み上げ・札めくり進行（useKarutaReading）とは
// 独立した関心事だが、ラウンド（現在読み上げ中の札）が切り替わったタイミングを
// 検知する必要があるため、currentPhraseだけを入力として受け取る
export function usePlayerScores({ categoryKey, currentPhrase, isAllRead, division }) {
  const [players, setPlayers] = useSessionStorageState(PLAYERS_STORAGE_KEY, []);
  const [newPlayerName, setNewPlayerName] = useState("");
  // 「取った人を記録する」参加者登録は、カテゴリ確定時のモーダルではなく読み札画面の
  // ボタンから任意に開閉する（issue #518）
  const [showPlayerRegistration, setShowPlayerRegistration] = useState(false);
  const [scoresByCategory, setScoresByCategory] = useSessionStorageState(SCORES_STORAGE_KEY, {});
  const [currentRoundTakenBy, setCurrentRoundTakenBy] = useState(null);
  // currentRoundTakenByのレンダー中state調整（下記）で、ラウンド切り替えを検知するための
  // 直前値の追跡用
  const [lastPhraseForTakenByReset, setLastPhraseForTakenByReset] = useState(null);

  const currentScores = useMemo(() => {
    return categoryKey ? (scoresByCategory[categoryKey] || {}) : {};
  }, [categoryKey, scoresByCategory]);

  // 読了時のスコア集計（参加者が1人以上登録されている場合のみ表示する）
  const scoreSummary = useMemo(() => {
    if (!isAllRead || division === "kids" || players.length === 0) return null;
    const entries = players.map(name => ({ name, count: currentScores[name] || 0 }));
    const maxCount = Math.max(0, ...entries.map(e => e.count));
    const winners = maxCount > 0 ? entries.filter(e => e.count === maxCount).map(e => e.name) : [];
    return { entries, winners };
  }, [isAllRead, division, players, currentScores]);

  // ラウンドが切り替わったら「取った人」の選択状態をリセットする
  // （もう一度再生（phraseDataなしのキュー投入）ではcurrentPhraseが変わらないため反応しない）。
  // レンダー中のstate調整パターン（react-hooks/set-state-in-effect対策）
  if (currentPhrase !== lastPhraseForTakenByReset) {
    setLastPhraseForTakenByReset(currentPhrase);
    setCurrentRoundTakenBy(null);
  }

  const addPlayer = () => {
    const trimmed = newPlayerName.trim();
    if (!trimmed || players.includes(trimmed) || players.length >= MAX_PLAYERS) return;
    setPlayers(prev => [...prev, trimmed]);
    setNewPlayerName("");
  };

  const removePlayer = (name) => {
    setPlayers(prev => prev.filter(p => p !== name));
    setScoresByCategory(prev => {
      const next = {};
      for (const [catKey, scores] of Object.entries(prev)) {
        const catScores = { ...scores };
        delete catScores[name];
        next[catKey] = catScores;
      }
      return next;
    });
  };

  // 取った人を記録する（同じ人を再度タップした場合は取り消し扱いにする）
  const recordTaken = (name) => {
    if (!currentPhrase) return;
    setScoresByCategory(prev => {
      const catScores = { ...(prev[categoryKey] || {}) };
      if (currentRoundTakenBy) {
        catScores[currentRoundTakenBy] = Math.max(0, (catScores[currentRoundTakenBy] || 0) - 1);
      }
      if (name !== currentRoundTakenBy) {
        catScores[name] = (catScores[name] || 0) + 1;
      }
      return { ...prev, [categoryKey]: catScores };
    });
    setCurrentRoundTakenBy(prev => (prev === name ? null : name));
  };

  // restartCategory（App.jsx）から呼ばれる、現在のカテゴリのスコアのみのリセット
  const resetCategoryScores = () => {
    setScoresByCategory(prev => ({
      ...prev,
      [categoryKey]: {}
    }));
  };

  return {
    players,
    newPlayerName,
    setNewPlayerName,
    showPlayerRegistration,
    setShowPlayerRegistration,
    currentRoundTakenBy,
    scoreSummary,
    addPlayer,
    removePlayer,
    recordTaken,
    resetCategoryScores,
    maxPlayers: MAX_PLAYERS,
  };
}
