// 全札一覧のソート比較ロジック（純粋関数）。App.jsxから切り出した（issue #2192）

// 初級=1000000、上級=1000001 として数値化し一貫したソートを保証
export function toLevelNum(v) {
  if (v === '初級') return 1_000_000;
  if (v === '上級') return 1_000_001;
  const n = parseInt(v, 10);
  return isNaN(n) ? 1_000_002 : n;
}

// レベル列は未設定('-')を常に末尾へ固定するため、direction に関わらない順序を
// 早期に返す。該当しない場合はnullを返し、呼び出し側の通常比較へフォールバックする
function compareByLevelPresence(aValue, bValue) {
  if (aValue === '-' && bValue !== '-') return 1;
  if (aValue !== '-' && bValue === '-') return -1;
  if (aValue === '-' && bValue === '-') return 0;
  return null;
}

// answer列は未設定（市販品で答えデータが無い）を常に末尾へ固定する
function compareByAnswerPresence(aValue, bValue) {
  const aMissing = !aValue || aValue === '-';
  const bMissing = !bValue || bValue === '-';
  if (aMissing && !bMissing) return 1;
  if (!aMissing && bMissing) return -1;
  if (aMissing && bMissing) return 0;
  return null;
}

const NUMERIC_FALLBACK_ZERO_KEYS = new Set(['readCount', 'averageDifficulty', 'averageTime']);

function normalizeSortValues(sortKey, aValue, bValue) {
  if (sortKey === 'level') return [toLevelNum(aValue), toLevelNum(bValue)];
  if (NUMERIC_FALLBACK_ZERO_KEYS.has(sortKey)) return [aValue || 0, bValue || 0];
  if (sortKey === 'answer' || typeof aValue === 'string') {
    return [(aValue || '').toLowerCase(), (bValue || '').toLowerCase()];
  }
  return [aValue, bValue];
}

export function comparePhraseValues(a, b, sortConfig) {
  const sortKey = sortConfig.key;
  let aValue = a[sortKey];
  let bValue = b[sortKey];

  if (sortKey === 'level') {
    const presenceResult = compareByLevelPresence(aValue, bValue);
    if (presenceResult !== null) return presenceResult;
  } else if (sortKey === 'answer') {
    const presenceResult = compareByAnswerPresence(aValue, bValue);
    if (presenceResult !== null) return presenceResult;
  }

  [aValue, bValue] = normalizeSortValues(sortKey, aValue, bValue);

  if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
  if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
  return 0;
}
