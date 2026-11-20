// 画面の主要な内容が取得できなかった時の、画面内のエラー表示と「再試行する」ボタン（issue #2190）。
// 「読み込み中」や「0件」と、取得失敗を区別するために使う
function FetchErrorNotice({ message, onRetry }) {
  return (
    <div className="text-center py-5" role="alert">
      <p className="text-danger mb-3">{message}</p>
      <button onClick={onRetry} className="btn btn-outline-dark rounded-pill px-4">再試行する</button>
    </div>
  );
}

export default FetchErrorNotice;
