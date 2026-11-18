// 利用者へ見せるエラーの文言（issue #2190）。内部のエラーメッセージ（error.message）は見せず、
// ApiErrorの種別から固定の文言を選ぶ。種別から文言を選ぶ処理は、ここ1箇所にまとめる。
import { messageForApiError } from "./client";

const MESSAGES = {
  network: "通信できませんでした。電波の良い場所でもう一度お試しください。",
  http: "サーバーで問題が発生しました。少し待ってからもう一度お試しください。",
  "http:429": "本日の利用上限に達しました。明日もう一度お試しください。",
};

export const messageForError = (error) => messageForApiError(error, MESSAGES);
