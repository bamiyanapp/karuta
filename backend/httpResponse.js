// API Gateway REST（HTTP）ハンドラ向けの共通CORSレスポンス生成ヘルパー。
// WebSocketハンドラ（quizRoomHandlerの$connect/$disconnect/カスタムルート群）は
// プレーンテキストのbody・CORSヘッダー無しで別形状のため対象外（issue #804 2で別途対応）。
//
// 500応答のbodyにerror.messageを含めるかはハンドラごとに元々揺れており（issue #804 1）、
// 統一するとレスポンス本文が変わりテストが落ちる可能性があるため、この移行では
// 既存の揺れをそのまま維持する（serverErrorのincludeMessageオプションで呼び出し側が選ぶ）。

function jsonResponse(origin, statusCode, body, { credentials = false } = {}) {
  const headers = { "Access-Control-Allow-Origin": origin };
  if (credentials) {
    headers["Access-Control-Allow-Credentials"] = true;
  }
  return {
    statusCode,
    headers,
    body: JSON.stringify(body),
  };
}

function badRequest(origin, message) {
  return jsonResponse(origin, 400, { message });
}

function notFound(origin, message) {
  return jsonResponse(origin, 404, { message });
}

function serverError(origin, error, { includeMessage = false } = {}) {
  console.error(error);
  const body = includeMessage
    ? { message: "Internal Server Error", error: error.message }
    : { message: "Internal Server Error" };
  return jsonResponse(origin, 500, body);
}

module.exports = { jsonResponse, badRequest, notFound, serverError };
