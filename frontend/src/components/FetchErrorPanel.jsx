// 画面の主要な内容を取得できなかったときの、画面内のエラー表示と「再試行する」ボタン（issue #2190）。
// 一時的に出して消える通知（トースト）ではなく、画面の中に出すのは、取得できないと画面が空のまま
// 進めず、利用者が次の操作を選べないため。絵札印刷画面（PrintEfudaView）の取得失敗の表示と同じ形に揃える
function FetchErrorPanel({ message, onRetry }) {
  return (
    <div className="text-center py-5">
      <p className="text-danger mb-3">{message}</p>
      <button type="button" onClick={onRetry} className="btn btn-outline-dark rounded-pill px-4">再試行する</button>
    </div>
  );
}

export default FetchErrorPanel;
