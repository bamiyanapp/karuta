// クイズ大会モード（issue #545）: 参加者一覧とポイント集計（issue #519）を1つのリストへ
// 統合する。まだ得点していない参加者も0ptとして含め、管理者・参加者どちらの画面でも
// 同じ並び順（ポイント降順、同点は名前の昇順）で表示できるようにする。
// connected（issue #599/#602）: participantNamesは現在接続中の参加者名一覧
// （backend/quizRoomHandler.jsのdisconnectQuizRoom等がブロードキャストする
// "participants"メッセージ由来）なので、その一覧に含まれるかどうかで
// 接続ステータスを判定できる。得点記録（points）は切断後も残り続けるため、
// 切断済みでも一覧には引き続き表示されるが、connectedはfalseになる。
// 回答数（issue #698）: answerCountsは名前→{attempts, correct}のマップ
// （backend/quizRoomHandler.jsのjudgeQuizRoomBuzzが正解・不正解いずれの判定でも
// 累計する）。pointsと同じく切断・退室後も保持され続ける。correctはpoints（正答数、
// 1問正解＝1pt）と実質同じ値のため、返り値には持たせずattempts（回答数）のみ追加する
export function mergeParticipantsWithPoints(participantNames, points, answerCounts = {}) {
  const connectedNames = new Set(participantNames);
  const names = new Set(participantNames);
  Object.keys(points).forEach((name) => names.add(name));
  Object.keys(answerCounts).forEach((name) => names.add(name));
  return Array.from(names)
    .map((name) => ({
      name,
      points: points[name] || 0,
      attempts: answerCounts[name]?.attempts || 0,
      connected: connectedNames.has(name),
    }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
}
