// issue #800: 札を一意に識別するキー（`${category}:${id}`）の生成が、既読判定
// （useKarutaReading.js）・早押しラウンドキーの判定（useQuizRoomAdmin.js、
// QuizRoomView.jsx）に散在していた。フォーマットの暗黙の一致（片方だけ変えると
// 既読判定や早押しリセットが壊れる）を1箇所へ集約する
export function phraseKey(phrase) {
  return `${phrase.category}:${phrase.id}`;
}
