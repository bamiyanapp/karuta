// ブラウザの自動再生ポリシー対策（issue #497）: ユーザー操作（クリック/タップ）を
// 伴わないaudio.play()は多くのブラウザでブロックされる。無音の音声をユーザー操作の
// 延長として一度再生しておくと、以降のWebSocket通知に応じた自動再生（ユーザー操作を
// 伴わない再生）が許可されやすくなるため、ボタンを出す代わりにこれで解決を図る
const SILENT_AUDIO_DATA_URI = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

export function unlockAudioPlayback() {
  try {
    new Audio(SILENT_AUDIO_DATA_URI).play().catch(() => {});
  } catch {
    // 対応していないブラウザでは何もしない
  }
}
