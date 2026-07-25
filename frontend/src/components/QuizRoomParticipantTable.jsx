import { mergeParticipantsWithPoints } from "../utils/quizRoomParticipants";

// issue #800: 参加者一覧テーブル（名前・接続・回答数・正答数）が、管理者側
// （QuizRoomInfoView.jsx）と参加者側（QuizRoomView.jsx）にほぼ同一の実装で
// 重複していたため共通化した。
// - highlightName: 自分の名前（参加者側のみ）。一致する行を太字にする
// - className: ラッパーの余白（管理者側は"mt-5"、参加者側は"mt-4"）
// - footer: テーブルの下に続けて表示する内容（管理者側の「ポイントをリセット」ボタン等）
// issue #545/#599: まだ得点していない参加者も0ptとして含めた1つのリストに統合し、
// ポイント降順（同点は名前昇順）で表示する。issue #599/#602: 切断済みでも得点・回答数は
// 保持したまま「切断済み」表示に切り替える。issue #698: 回答数（attempts）・正答数（points）は
// 別カラムで表示する
function QuizRoomParticipantTable({ participantNames, points, answerCounts, highlightName, className = "mt-4", footer }) {
  const participantList = mergeParticipantsWithPoints(participantNames, points, answerCounts);
  if (participantList.length === 0) {
    return null;
  }

  return (
    <div className={`mx-auto text-start ${className}`} style={{ maxWidth: "360px" }}>
      <p className="text-muted small mb-2">参加者一覧</p>
      <table className="table table-sm table-bordered bg-white mb-0">
        <thead>
          <tr>
            <th scope="col">名前</th>
            <th scope="col">接続</th>
            <th scope="col" className="text-end">回答数</th>
            <th scope="col" className="text-end">正答数</th>
          </tr>
        </thead>
        <tbody>
          {participantList.map(({ name, points: pt, attempts, connected }) => (
            <tr key={name}>
              <td className={`notranslate ${name === highlightName ? "fw-bold" : ""}`}>{name}</td>
              <td className={connected ? "text-success" : "text-muted"}>
                {connected ? "接続中" : "切断済み"}
              </td>
              <td className="text-end">{attempts}</td>
              <td className="text-end">{pt}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {footer}
    </div>
  );
}

export default QuizRoomParticipantTable;
