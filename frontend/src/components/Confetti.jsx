// piecesの再生成タイミング（マウント時1回 vs ラウンドごと）は呼び出し側の
// useMemo(() => buildConfettiPieces(), [...])の依存配列に委ねるため、
// このコンポーネント自身は受け取ったpiecesを描画するだけにする（issue #804）
function Confetti({ pieces }) {
  if (!pieces || pieces.length === 0) return null;
  return (
    <div className="confetti-container" aria-hidden="true">
      {pieces.map((c) => (
        <span
          key={c.id}
          className="confetti-piece"
          style={{ left: `${c.left}%`, animationDelay: `${c.delay}s`, animationDuration: `${c.duration}s` }}
        >
          {c.emoji}
        </span>
      ))}
    </div>
  );
}

export default Confetti;
