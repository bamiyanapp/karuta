// ブラウザの自動再生ポリシー対策（issue #497, #514）。
//
// Safari（iOS/macOS）は、HTMLAudioElementごとに「ユーザー操作の中で一度でも再生された
// 要素かどうか」を見て、以降の非同期文脈（fetch完了後のコールバック等）でのplay()を
// 許可するかどうかを判断する。参加者側の音声再生は「WebSocketで通知を受けてから
// /get-phraseを取得し、取得できたらplay()する」という非同期処理のため、その都度
// `new Audio(...)`していると、その要素自体は一度もユーザー操作中に再生されておらず
// Safariにブロックされ続けてしまう。
//
// そのため、ページ内で使い回す単一の<audio>要素（シングルトン）を用意し、
// クリック等のユーザー操作の中でこの要素自身を一度再生しておく（unlockAudioPlayback）。
// 以降は同じ要素のsrcを差し替えてplay()し直す（playSharedAudio）ことで、非同期文脈からの
// 再生であってもSafariに許可される。ユーザー操作の発生箇所（トップページのルーム一覧
// クリック等）と、実際に音声を再生する箇所（参加者画面）が別のReactコンポーネントの
// ライフサイクルにまたがるため、コンポーネントのrefではなくモジュールスコープの
// シングルトンとして保持する
const SILENT_AUDIO_DATA_URI = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

let sharedAudio = null;
// issue #613: 早押し関連の効果音（回答ボタン/正解/不正解）は、読み上げ音声
// （sharedAudio）が再生中でも同時に鳴らす必要があるため、sharedAudioとは別に
// 名前ごとの共有<audio>要素を持つ（同じ理由でシングルトン・解錠が必要）。
// "intro"は参加者側のイントロ音（太鼓の音、issue #786）用。sharedAudio（本編音声）とは
// 別の要素が必要な理由は同じ（本編音声の取得と並行して鳴らしたいため、issue #796）
const sharedSfxAudio = {};
// issue #800: 論理名とファイル名の対応を1箇所にまとめる。以前は呼び出し側
// （playQuizSfx(name, ファイル名)）が毎回両方を手書きしており、ファイル名を
// 変える際（issue #679の相対パス修正等）に全呼び出し箇所を漏れなく直す必要が
// あった。
// issue #679: base: "./"（vite.config.js）でサブパス配下にデプロイされるため、
// 絶対パス（先頭スラッシュ）だとドメインルート宛になり音声ファイルが見つからず
// NotSupportedErrorになる。favicon.png等と同じ相対パスにする
const QUIZ_SFX_SOURCES = {
  buzz: "quiz-buzz.mp3",
  correct: "quiz-correct.mp3",
  incorrect: "quiz-incorrect.mp3",
  intro: "wadodon.mp3",
};
const QUIZ_SFX_NAMES = Object.keys(QUIZ_SFX_SOURCES);

function getSharedAudio() {
  if (!sharedAudio) {
    sharedAudio = new Audio();
  }
  return sharedAudio;
}

function getSharedSfxAudio(name) {
  if (!sharedSfxAudio[name]) {
    sharedSfxAudio[name] = new Audio();
  }
  return sharedSfxAudio[name];
}

// ユーザー操作（クリック/タップ）のハンドラ内から同期的に呼び出すことで、共有<audio>要素を
// 解錠する。非同期処理を挟むとSafariでは解錠扱いにならないため、呼び出し側でawaitの前に
// 呼ぶこと
export function unlockAudioPlayback() {
  try {
    const audio = getSharedAudio();
    audio.src = SILENT_AUDIO_DATA_URI;
    audio.play().catch(() => {});
    for (const name of QUIZ_SFX_NAMES) {
      const sfxAudio = getSharedSfxAudio(name);
      sfxAudio.src = SILENT_AUDIO_DATA_URI;
      sfxAudio.play().catch(() => {});
    }
  } catch {
    // 対応していないブラウザでは何もしない
  }
}

// 解錠済みの共有<audio>要素でsrcを再生する。前の再生と重ならないよう、切り替え前に一旦止める
export function playSharedAudio(src) {
  const audio = getSharedAudio();
  audio.pause();
  audio.src = src;
  return audio.play();
}

// issue #696: 読み上げ中に早押しボタンが押された場合、読み上げ音声を中断するために使う。
// sharedAudioが未生成（一度も再生されていない）場合は何もしない
export function stopSharedAudio() {
  if (sharedAudio) {
    sharedAudio.pause();
  }
}

// issue #613: 早押し関連の効果音（回答ボタン/正解/不正解）を再生する。
// nameは"buzz"|"correct"|"incorrect"|"intro"のいずれか。再生するファイルは
// QUIZ_SFX_SOURCESから引く
export function playQuizSfx(name) {
  const audio = getSharedSfxAudio(name);
  audio.pause();
  audio.src = QUIZ_SFX_SOURCES[name];
  return audio.play();
}

// issue #800: 早押し正誤判定の効果音（correct/incorrect）は、管理者側
// （judgeQuizRoomBuzz）・参加者側（handleRoundReset/showCelebration）の
// どちらも「correctかどうかのbooleanから対応する効果音名を選んでplayQuizSfxを
// 呼ぶ」という同型の呼び出しだったため、ヘルパーとしてまとめる
export function playJudgmentSfx(correct) {
  return playQuizSfx(correct ? "correct" : "incorrect");
}

// issue #796: イントロ音（太鼓の音）の再生完了を待てるバージョン。play()が返す
// Promiseは再生「開始」時点で解決されるため（完了を待つには別途onendedの監視が必要、
// useKarutaReading.jsのplayAudioと同じ理由）、参加者側で「太鼓の音の後に読み上げを
// 始める」（管理者側と同じ順序にする）ために使う。onended/onerrorのどちらも発火せず
// ハングする環境向けに、上限時間で強制的に諦めて先へ進める（同じ理由でuseKarutaReading.js
// のplayAudioにも上限時間がある。太鼓の音は短い効果音のため、本編音声用の15秒より
// 短い上限にする）
const INTRO_SFX_TIMEOUT_MS = 5000;
export function playQuizSfxAndWait(name) {
  const audio = getSharedSfxAudio(name);
  audio.pause();
  audio.src = QUIZ_SFX_SOURCES[name];
  return new Promise((resolve) => {
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      resolve();
    };
    const timeoutId = setTimeout(settle, INTRO_SFX_TIMEOUT_MS);
    audio.onended = settle;
    audio.play().catch(settle);
  });
}

// テスト専用: モジュールスコープのシングルトンをテスト間で共有してしまわないようにリセットする
export function resetSharedAudioForTests() {
  sharedAudio = null;
  for (const name of QUIZ_SFX_NAMES) {
    delete sharedSfxAudio[name];
  }
}
