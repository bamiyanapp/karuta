// エンドポイントごとの関数（issue #2187）。パス文字列・パラメータ名は、このファイルにだけ書く。
// 更新系（postComment等）は、応答を受け取れなかっただけで処理が成功している場合に二重登録に
// なるため、リトライしない（apiClientの既定どおり）。
import { api } from "./client";

export const getCategories = (options) => api.get("get-categories", options);

// categoryを省略すると全札を返す
export const getPhrasesList = (category, options) =>
  api.get("get-phrases-list", { ...options, params: { category } });

// 札の詳細と読み上げ音声。パラメータの並びは、従来のURLと同じにしている
export const getPhrase = (
  { id, category, repeatCount, speechRate, lang, voiceId, announceCategory },
  options
) =>
  api.get("get-phrase", {
    ...options,
    params: { id, category, repeatCount, speechRate, lang, voiceId, announceCategory },
  });

export const getComments = (options) => api.get("get-comments", options);

export const postComment = (body, options) => api.post("post-comment", { ...options, body });

export const getVersion = (options) => api.get("get-version", options);

export const getCongratulationAudio = ({ speechRate, lang, voiceId }, options) =>
  api.get("get-congratulation-audio", { ...options, params: { speechRate, lang, voiceId } });

// 所要時間・難易度の記録。更新系のためリトライしない
export const recordTime = (body, options) => api.post("record-time", { ...options, body });

// クイズ大会モード
export const getQuizRooms = (options) => api.get("quiz-rooms", options);
export const getQuizRoom = (roomId, options) => api.get("quiz-room", { ...options, params: { roomId } });
// ルームの作成。更新系のためリトライしない（二重にルームが作られるのを避ける）
export const createQuizRoom = (body, options) => api.post("quiz-room", { ...options, body });

// 絵札PDFの生成（開始とステータス確認）。開始は更新系のためリトライしない
export const generateEfudaPdf = (body, options) => api.post("generate-efuda-pdf", { ...options, body });
export const getEfudaPdfStatus = ({ jobId, categoryLabel, side }, options) =>
  api.get("generate-efuda-pdf-status", { ...options, params: { jobId, categoryLabel, side } });
