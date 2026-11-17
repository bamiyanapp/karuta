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
