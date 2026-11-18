// エンドポイントごとの関数（issue #2187）。パス文字列・パラメータ名は、このファイルにだけ書く。
// 更新系（postComment等）は、応答を受け取れなかっただけで処理が成功している場合に二重登録に
// なるため、リトライしない（apiClientの既定どおり）。
import { api } from "./client";

// GETのリトライ既定値（issue #2187）。通信失敗・429・5xxだけが対象で、最大4回まで試す
// （初回＋リトライ3回）。呼び出し側のoptions.retryで上書きできる
const GET_RETRY = { count: 3, baseDelayMs: 500, maxDelayMs: 4000 };
// カテゴリ一覧は、画面の最初の表示に必要で、Lambdaのコールドスタートが連続しても耐える必要がある
// （issue #1798・#1933）。間隔を1秒から最大8秒の指数バックオフにし、最大5回まで試す
const CATEGORIES_RETRY = { count: 4, baseDelayMs: 1000, maxDelayMs: 8000 };
// get-phraseは、1回の応答が重く、リトライで負荷が増えるため、リトライしない（再取得は利用者の操作に任せる）
const NO_RETRY = { count: 0 };

const get = (path, options, retry = GET_RETRY) => api.get(path, { retry, ...options });

export const getCategories = (options) => get("get-categories", options, CATEGORIES_RETRY);

// categoryを省略すると全札を返す
export const getPhrasesList = (category, options) =>
  get("get-phrases-list", { ...options, params: { category } });

// 札の詳細と読み上げ音声。パラメータの並びは、従来のURLと同じにしている
export const getPhrase = (
  { id, category, repeatCount, speechRate, lang, voiceId, announceCategory },
  options
) =>
  get("get-phrase", {
    retry: NO_RETRY,
    ...options,
    params: { id, category, repeatCount, speechRate, lang, voiceId, announceCategory },
  });

export const getComments = (options) => get("get-comments", options);

export const postComment = (body, options) => api.post("post-comment", { ...options, body });

export const getVersion = (options) => get("get-version", options);

export const getCongratulationAudio = ({ speechRate, lang, voiceId }, options) =>
  get("get-congratulation-audio", { ...options, params: { speechRate, lang, voiceId } });

// 所要時間・難易度の記録。更新系のためリトライしない
export const recordTime = (body, options) => api.post("record-time", { ...options, body });

// クイズ大会モード
export const getQuizRooms = (options) => get("quiz-rooms", options);
export const getQuizRoom = (roomId, options) => get("quiz-room", { ...options, params: { roomId } });
// ルームの作成。更新系のためリトライしない（二重にルームが作られるのを避ける）
export const createQuizRoom = (body, options) => api.post("quiz-room", { ...options, body });

// 絵札PDFの生成（開始とステータス確認）。開始は更新系のためリトライしない
export const generateEfudaPdf = (body, options) => api.post("generate-efuda-pdf", { ...options, body });
export const getEfudaPdfStatus = ({ jobId, categoryLabel, side }, options) =>
  get("generate-efuda-pdf-status", { ...options, params: { jobId, categoryLabel, side } });
