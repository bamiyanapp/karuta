import { useEffect, useMemo, useRef, useState } from "react";
import { getPhrase, getComments, postComment as postCommentApi } from "../api/endpoints";
import { messageForError } from "../api/errorMessages";
import { useNotify } from "../components/NotificationProvider";

// 札の詳細画面・指摘一覧画面のデータ（詳細データ・指摘の取得、指摘の入力・送信、詳細の開閉）。
// App.jsxから切り出した（issue #2192）。
//
// detailPhraseIdは、URLと同期する画面遷移の状態（useUrlQuerySync）としてApp.jsxに残すため、
// 値とsetterを引数で受け取る。取得失敗は、「読み込み中」「0件」と区別するため失敗の有無を別に持ち、
// retry*で再取得する（issue #2190）。
export function usePhraseDetail({
  view,
  detailPhraseId,
  setDetailPhraseId,
  repeatCount,
  speechRate,
  lang,
  voiceId,
  isMultiCategorySelection,
}) {
  const notify = useNotify();
  const [detailPhraseCategory, setDetailPhraseCategory] = useState(null);
  const [detailPhrase, setDetailPhrase] = useState(null);
  const [allComments, setAllComments] = useState([]);
  const [detailFetchError, setDetailFetchError] = useState(false);
  const [commentsFetchError, setCommentsFetchError] = useState(false);
  // 再取得を起動するためだけのstate。値自体に意味はない
  const [detailRetryToken, setDetailRetryToken] = useState(0);
  const [commentsRetryToken, setCommentsRetryToken] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  // 「読み上げる」用の音声。詳細データとは別に、押されたときの読み上げ設定で取得し、同じ設定なら使い回す
  const [detailAudioLoading, setDetailAudioLoading] = useState(false);
  const detailAudioCacheRef = useRef({ key: null, audioData: null });

  // 詳細データの取得
  useEffect(() => {
    const fetchDetail = async () => {
      if (!detailPhraseId) {
        setDetailPhrase(null);
        setDetailFetchError(false);
        return;
      }
      setDetailFetchError(false);
      try {
        // 詳細画面は表示だけで、音声は要らない。音声は「読み上げる」が押されたときに取得する（issue #2191）
        const data = await getPhrase({
          id: detailPhraseId,
          category: detailPhraseCategory || undefined,
          audio: false,
        });
        setDetailPhrase(data);
      } catch (error) {
        console.error("Error fetching phrase detail:", error);
        setDetailFetchError(true);
      }
    };
    fetchDetail();
  }, [detailPhraseId, detailPhraseCategory, detailRetryToken]);

  // 指摘一覧の取得（指摘一覧画面のほか、詳細画面で既存の指摘を表示するためにも使う）
  useEffect(() => {
    const fetchComments = async () => {
      if (view === "comments" || detailPhraseId) {
        setCommentsFetchError(false);
        try {
          // 指摘一覧画面は全件。詳細画面は、その札の指摘だけをGSI経由で取得する（issue #2191）。
          // 画面側の絞り込み（detailPhraseComments）は、旧バックエンドとの組み合わせのために残す
          const data = await getComments(view === "comments" ? {} : { phraseId: detailPhraseId });
          setAllComments(data.comments || []);
        } catch (error) {
          console.error("Error fetching comments:", error);
          setCommentsFetchError(true);
        }
      }
    };
    fetchComments();
  }, [view, detailPhraseId, commentsRetryToken]);

  const detailPhraseComments = useMemo(() => {
    if (!detailPhrase) return [];
    return allComments.filter((c) => c.phraseId === detailPhrase.id);
  }, [allComments, detailPhrase]);


  // 詳細画面の「読み上げる」用の音声を取得する（issue #2191）。失敗時は通知して、nullを返す
  const loadDetailAudio = async () => {
    if (!detailPhrase) return null;
    const key = JSON.stringify([detailPhrase.id, detailPhrase.category, repeatCount, speechRate, lang, voiceId, isMultiCategorySelection]);
    if (detailAudioCacheRef.current.key === key) return detailAudioCacheRef.current.audioData;
    setDetailAudioLoading(true);
    try {
      const data = await getPhrase({
        id: detailPhrase.id,
        category: detailPhrase.category,
        repeatCount,
        speechRate,
        lang,
        voiceId,
        announceCategory: isMultiCategorySelection,
      });
      detailAudioCacheRef.current = { key, audioData: data.audioData || null };
      return data.audioData || null;
    } catch (error) {
      notify({ type: "error", message: messageForError(error) });
      return null;
    } finally {
      setDetailAudioLoading(false);
    }
  };

  const postComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setPostingComment(true);
    try {
      await postCommentApi({
        phraseId: detailPhrase.id,
        category: detailPhrase.category,
        phrase: detailPhrase.phrase,
        comment: commentText,
      });
      notify({ type: "success", message: "指摘内容を送信しました。ありがとうございます。" });
      setCommentText("");
    } catch (error) {
      notify({ type: "error", message: messageForError(error) });
    } finally {
      setPostingComment(false);
    }
  };

  const openDetail = (id, category) => {
    setDetailPhraseId(id);
    setDetailPhraseCategory(category || null);
    window.scrollTo(0, 0);
  };

  const closeDetail = () => {
    setDetailPhraseId(null);
    setDetailPhraseCategory(null);
  };

  return {
    detailPhrase,
    detailPhraseCategory,
    detailPhraseComments,
    allComments,
    detailFetchError,
    commentsFetchError,
    retryFetchDetail: () => setDetailRetryToken((token) => token + 1),
    retryFetchComments: () => setCommentsRetryToken((token) => token + 1),
    commentText,
    setCommentText,
    postingComment,
    postComment,
    detailAudioLoading,
    loadDetailAudio,
    openDetail,
    closeDetail,
  };
}
