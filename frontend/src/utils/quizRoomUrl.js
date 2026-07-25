// issue #800: クイズ大会モードの?roomId=クエリパラメータの読み書きが、
// QuizRoomView.jsx（goBack/retryRoomCode、削除方向）とuseQuizRoomAdmin.js
// （joinQuizRoom、設定方向）にそれぞれ手書きで重複していたため集約する。
// 他のクエリパラメータ（?view=等）は保持したまま操作する

// roomIdを?roomId=として設定する
export function setRoomIdParam(roomId) {
  const params = new URLSearchParams(window.location.search);
  params.set("roomId", roomId);
  window.history.pushState({}, "", `?${params.toString()}`);
}

// ?roomId=を取り除く。他のクエリパラメータが残っていれば維持し、無ければ
// クエリ自体を取り除く
export function clearRoomIdParam() {
  const params = new URLSearchParams(window.location.search);
  params.delete("roomId");
  const query = params.toString();
  window.history.pushState({}, "", query ? `?${query}` : window.location.pathname);
}
