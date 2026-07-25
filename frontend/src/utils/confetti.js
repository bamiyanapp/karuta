// 全札読了時（QuizCompletionScreen）・早押し正解時（QuizRoomView）の紙吹雪演出（issue #804）の
// 生成ロジック。Math.random()はレンダー中（呼び出し側のuseMemoファクトリ関数を含む）に
// 呼び出すとreact-hooks/purityに抵触するため、iから決定的に導出する疑似乱数を使う
// （見た目のランダムさだけが目的で、実際の乱雑さの品質は問わない演出のため）
export function buildConfettiPieces() {
  const emojis = ["🎉", "✨", "🎊", "⭐"];
  const pseudoRandom = (seed) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };
  return Array.from({ length: 24 }, (_, i) => ({
    id: i,
    emoji: emojis[i % emojis.length],
    left: pseudoRandom(i) * 100,
    delay: pseudoRandom(i + 100) * 0.6,
    duration: 2.2 + pseudoRandom(i + 200) * 1.2,
  }));
}
