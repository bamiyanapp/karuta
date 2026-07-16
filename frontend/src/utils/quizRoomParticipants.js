// クイズ大会モード（issue #545）: 参加者一覧とポイント集計（issue #519）を1つのリストへ
// 統合する。まだ得点していない参加者も0ptとして含め、管理者・参加者どちらの画面でも
// 同じ並び順（ポイント降順、同点は名前の昇順）で表示できるようにする
export function mergeParticipantsWithPoints(participantNames, points) {
  const names = new Set(participantNames);
  Object.keys(points).forEach((name) => names.add(name));
  return Array.from(names)
    .map((name) => ({ name, points: points[name] || 0 }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
}
