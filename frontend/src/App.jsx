import { useState, useEffect, useMemo, useRef } from "react";
import "./App.css";
import karutaImage from "./assets/karuta_inubou.png";
import { API_BASE_URL, WS_BASE_URL } from "./config";
import { useLocalStorageState } from "./hooks/useLocalStorageState";
import { useSessionStorageState } from "./hooks/useSessionStorageState";
import { useUrlQuerySync, parseCategoriesParam } from "./hooks/useUrlQuerySync";
import { useWakeLock } from "./hooks/useWakeLock";
import { useKarutaReading } from "./hooks/useKarutaReading";
import { usePlayerScores } from "./hooks/usePlayerScores";
import { useQuizRoomAdmin } from "./hooks/useQuizRoomAdmin";
import DetailView from "./views/DetailView";
import DivisionSelectView from "./views/DivisionSelectView";
import CategorySelectView from "./views/CategorySelectView";
import PrintEfudaView from "./views/PrintEfudaView";
import AllPhrasesView from "./views/AllPhrasesView";
import CommentsView from "./views/CommentsView";
import ChangelogView from "./views/ChangelogView";
import QuizRoomView from "./views/QuizRoomView";
import QuizRoomInfoView from "./views/QuizRoomInfoView";
import QuizRoomBuzzJudgmentModal from "./components/QuizRoomBuzzJudgmentModal";
import ResultCard from "./components/ResultCard";
import QuizCompletionScreen from "./components/QuizCompletionScreen";
import SettingsFooter from "./components/SettingsFooter";
import QuizRoomActionsPanel from "./components/QuizRoomActionsPanel";

const HISTORY_STORAGE_KEY = "historyByCategory";

// 絵札印刷時に選択できる合計読み札数の上限。PDF生成はバックエンド（renderEfudaPdfWorker、
// ヘッドレスChromiumのpage.pdf()）で行うため、クライアント端末のメモリには依存しなくなった。
// ただし無制限にすると認証なしのAPIに巨大なジョブを投げ放題になってしまうため、
// バックエンド側（backend/efudaPdfHandler.jsのMAX_EFUDA_PRINT_CARDS_SERVER）と
// 同じ値の上限を維持する。こちらは選択UI自体をブロックする一次防御、
// バックエンド側はURL直叩き等を弾く二次防御
const MAX_EFUDA_PRINT_CARDS = 500;

// カテゴリ一覧の再取得後、選択中のカテゴリのうち引き続き存在するものだけへ絞り込む
function filterStillValidCategories(prev, availableNames) {
  if (prev.length === 0) return prev;
  const stillValid = prev.filter(cat => availableNames.includes(cat));
  return stillValid.length !== prev.length ? stillValid : prev;
}

// 指定したカテゴリ名一覧について、対応するcount（枚数）の合計を求める
// （絵札印刷の上限バリデーション用）
function sumCategoryCounts(categoryNames, categories) {
  return categoryNames.reduce((total, name) => {
    const info = categories.find(c => c.name === name);
    return total + (info?.count || 0);
  }, 0);
}

// 初級=1000000、上級=1000001 として数値化し一貫したソートを保証
function toLevelNum(v) {
  if (v === '初級') return 1_000_000;
  if (v === '上級') return 1_000_001;
  const n = parseInt(v, 10);
  return isNaN(n) ? 1_000_002 : n;
}

// レベル列は未設定('-')を常に末尾へ固定するため、direction に関わらない順序を
// 早期に返す。該当しない場合はnullを返し、呼び出し側の通常比較へフォールバックする
function compareByLevelPresence(aValue, bValue) {
  if (aValue === '-' && bValue !== '-') return 1;
  if (aValue !== '-' && bValue === '-') return -1;
  if (aValue === '-' && bValue === '-') return 0;
  return null;
}

// answer列は未設定（市販品で答えデータが無い）を常に末尾へ固定する
function compareByAnswerPresence(aValue, bValue) {
  const aMissing = !aValue || aValue === '-';
  const bMissing = !bValue || bValue === '-';
  if (aMissing && !bMissing) return 1;
  if (!aMissing && bMissing) return -1;
  if (aMissing && bMissing) return 0;
  return null;
}

const NUMERIC_FALLBACK_ZERO_KEYS = new Set(['readCount', 'averageDifficulty', 'averageTime']);

function normalizeSortValues(sortKey, aValue, bValue) {
  if (sortKey === 'level') return [toLevelNum(aValue), toLevelNum(bValue)];
  if (NUMERIC_FALLBACK_ZERO_KEYS.has(sortKey)) return [aValue || 0, bValue || 0];
  if (sortKey === 'answer' || typeof aValue === 'string') {
    return [(aValue || '').toLowerCase(), (bValue || '').toLowerCase()];
  }
  return [aValue, bValue];
}

function comparePhraseValues(a, b, sortConfig) {
  const sortKey = sortConfig.key;
  let aValue = a[sortKey];
  let bValue = b[sortKey];

  if (sortKey === 'level') {
    const presenceResult = compareByLevelPresence(aValue, bValue);
    if (presenceResult !== null) return presenceResult;
  } else if (sortKey === 'answer') {
    const presenceResult = compareByAnswerPresence(aValue, bValue);
    if (presenceResult !== null) return presenceResult;
  }

  [aValue, bValue] = normalizeSortValues(sortKey, aValue, bValue);

  if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
  if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
  return 0;
}

function App() {
  const [categories, setCategories] = useState([]);
  const [division, setDivision] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("division") || null;
  });
  const [selectedCategories, setSelectedCategories] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return parseCategoriesParam(params.get("category"));
  });

  const [detailPhraseId, setDetailPhraseId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("id");
  });
  const [detailPhraseCategory, setDetailPhraseCategory] = useState(null);
  const [detailPhrase, setDetailPhrase] = useState(null);

  // 指摘一覧表示用の状態
  const [view, setView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("view") || "game";
  });
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);
  const [allComments, setAllComments] = useState([]);

  const [allPhrasesForCategory, setAllPhrasesForCategory] = useState([]);
  // issue #474: 選択中のカテゴリのうち1件でも取得に失敗したかどうか。
  // 「まだ読み込んでいない」(allPhrasesForCategory.length === 0)と区別するための専用state
  const [phrasesFetchError, setPhrasesFetchError] = useState(false);
  const [allPhrases, setAllPhrases] = useState([]); // 全札一覧用
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' }); // ソート設定
  const [filterCategory, setFilterCategory] = useState(''); // 全札一覧フィルタ
  // 全札一覧の種別ボタンが多すぎて探しづらい問題（issue #730）に対応するため、
  // まず「こども向け/エンジニア向け」で絞り込んでから種別ボタンを表示する
  const [filterDivision, setFilterDivision] = useState('');
  const [searchQuery, setSearchQuery] = useState(''); // 全札一覧テキスト検索
  const [repeatCount, setRepeatCount] = useLocalStorageState("repeatCount", 2, (v) => parseInt(v, 10));
  const [speechRate, setSpeechRate] = useLocalStorageState("speechRate", "80%");
  const [lang, setLang] = useLocalStorageState("lang", "ja");
  const [voiceId, setVoiceId] = useLocalStorageState("voiceId", "Mizuki");
  const [sortOrder, setSortOrder] = useLocalStorageState("sortOrder", "random");
  const [themeSetting, setThemeSetting] = useLocalStorageState("theme", "system");
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => {
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  });
  const [historyByCategory, setHistoryByCategory] = useSessionStorageState(HISTORY_STORAGE_KEY, {});
  // 「これまでに読み上げた札」一覧は、件数が増えると画面が長くなるためデフォルト非表示にし、
  // ボタンを押したときだけ開く（issue #548）
  const [showHistory, setShowHistory] = useState(false);

  const [draftCategories, setDraftCategories] = useState([]);

  // コメント投稿用の状態
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  const resolvedTheme = useMemo(() => {
    if (themeSetting !== "system") return themeSetting;
    return systemPrefersDark ? "dark" : "light";
  }, [themeSetting, systemPrefersDark]);

  const categoryKey = useMemo(() => {
    return JSON.stringify(selectedCategories.slice().sort());
  }, [selectedCategories]);

  const categoryLabel = useMemo(() => {
    return selectedCategories.join("・");
  }, [selectedCategories]);

  const isMultiCategorySelection = useMemo(() => {
    return selectedCategories.length > 1;
  }, [selectedCategories]);

  const categoriesForDivision = useMemo(() => {
    if (division !== "kids" && division !== "engineer") return [];
    return categories.filter(cat => cat.group === division);
  }, [categories, division]);

  // 印刷対象の合計枚数（PDF出力の上限バリデーション用）。countが未設定の
  // カテゴリ（古いAPIレスポンス等）は0枚として扱い、上限チェックに影響させない
  const draftCardCount = useMemo(() => {
    return draftCategories.reduce((total, name) => {
      const cat = categories.find(c => c.name === name);
      return total + (cat?.count || 0);
    }, 0);
  }, [draftCategories, categories]);

  // 答えのデータがある（＝市販品でなくオリジナルの）かるたは所持確認が不要なため、
  // 選択中のかるたのうち実際に所持確認が必要なものだけを抽出する
  const draftCategoriesRequiringPossessionCheck = useMemo(() => {
    return draftCategories.filter(name => {
      const cat = categories.find(c => c.name === name);
      // フィールド未設定時は従来どおり所持確認が必要な扱いとする
      return cat ? cat.requiresPossessionCheck !== false : true;
    });
  }, [draftCategories, categories]);

  const currentHistory = useMemo(() => {
    return categoryKey ? (historyByCategory[categoryKey] || []) : [];
  }, [categoryKey, historyByCategory]);

  // クイズ大会モードかどうかを、useKarutaReading（useQuizRoomAdminより前に呼ぶ
  // 必要があり、quizRoomをまだ参照できない）へrefで伝える（issue #861）。
  // useQuizRoomAdmin呼び出し後にこのrefへ書き込む
  const quizRoomActiveRef = useRef(false);

  // 読み上げ・札めくり進行（音声再生・タイマー・フェード演出・結果確定）は
  // useKarutaReadingへ切り出した（issue #607）
  const {
    currentPhrase,
    broadcastPhrase,
    displayContent,
    isFadingOut,
    isReading,
    loading,
    isAllRead,
    isReadingLastPhrase,
    playKaruta,
    queueRepeatAudio,
    stopReading,
    revealCurrentResult,
    resetReadingState,
  } = useKarutaReading({
    selectedCategories,
    allPhrasesForCategory,
    categoryKey,
    currentHistory,
    setHistoryByCategory,
    sortOrder,
    repeatCount,
    speechRate,
    lang,
    voiceId,
    isMultiCategorySelection,
    quizRoomActiveRef,
  });

  // 「取った人を記録する」参加者登録・スコア集計（issue #518）はusePlayerScoresへ
  // 切り出した（issue #607）
  const {
    players,
    newPlayerName,
    setNewPlayerName,
    showPlayerRegistration,
    setShowPlayerRegistration,
    currentRoundTakenBy,
    scoreSummary,
    addPlayer,
    removePlayer,
    recordTaken,
    resetCategoryScores,
    maxPlayers,
  } = usePlayerScores({ categoryKey, currentPhrase, isAllRead, division });

  // 読了時のセッションサマリー（合計所要時間・最速/最遅の札）
  const sessionSummary = useMemo(() => {
    if (!isAllRead) return null;
    const timedEntries = currentHistory.filter(p => p.elapsedTime && isFinite(parseFloat(p.elapsedTime)));
    if (timedEntries.length === 0) return null;

    const totalTime = timedEntries.reduce((sum, p) => sum + parseFloat(p.elapsedTime), 0);
    const fastest = timedEntries.reduce((a, b) => (parseFloat(b.elapsedTime) < parseFloat(a.elapsedTime) ? b : a));
    const slowest = timedEntries.reduce((a, b) => (parseFloat(b.elapsedTime) > parseFloat(a.elapsedTime) ? b : a));

    return { totalTime, fastest, slowest };
  }, [isAllRead, currentHistory]);

  const EFUDA_PER_PAGE = 10;
  const efudaPages = useMemo(() => {
    const pages = [];
    for (let i = 0; i < allPhrasesForCategory.length; i += EFUDA_PER_PAGE) {
      pages.push({ items: allPhrasesForCategory.slice(i, i + EFUDA_PER_PAGE) });
    }
    if (pages.length === 0) pages.push({ items: [] });
    return pages;
  }, [allPhrasesForCategory]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedPhrases = useMemo(() => {
    let sortableItems = [...allPhrases];
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => comparePhraseValues(a, b, sortConfig));
    }
    return sortableItems;
  }, [allPhrases, sortConfig]);

  const uniqueCategories = useMemo(() => {
    return [...new Set(allPhrases.map(p => p.category))].sort((a, b) => a.localeCompare(b, 'ja'));
  }, [allPhrases]);

  // allPhrases（get-phrases-list由来）自体にはgroupフィールドが無いため、
  // getCategories由来のcategories（division選択でも使っているgroup情報を持つ）と
  // カテゴリ名で突き合わせる。group不明時は既定値である"kids"扱いにする
  // （backend/handler.jsのgetCategoriesの既定値と合わせる）
  const categoryGroupMap = useMemo(() => {
    const map = new Map();
    categories.forEach(cat => map.set(cat.name, cat.group));
    return map;
  }, [categories]);

  const visibleCategories = useMemo(() => {
    if (!filterDivision) return uniqueCategories;
    return uniqueCategories.filter(name => (categoryGroupMap.get(name) || "kids") === filterDivision);
  }, [uniqueCategories, filterDivision, categoryGroupMap]);

  const categoryCount = useMemo(() => {
    const counts = {};
    allPhrases.forEach(p => {
      counts[p.category] = (counts[p.category] || 0) + 1;
    });
    return counts;
  }, [allPhrases]);

  const filteredPhrases = useMemo(() => {
    let items = sortedPhrases;
    if (filterCategory) {
      items = items.filter(p => p.category === filterCategory);
    }
    const trimmedQuery = searchQuery.trim().toLowerCase();
    if (trimmedQuery) {
      items = items.filter(p =>
        [p.phrase, p.kana, p.answer].some(field => (field || '').toLowerCase().includes(trimmedQuery))
      );
    }
    return items;
  }, [sortedPhrases, filterCategory, searchQuery]);

  const renderSortArrow = (key) => {
      if (sortConfig.key === key) {
          return sortConfig.direction === 'asc' ? ' ▲' : ' ▼';
      }
      return <span style={{ opacity: 0.3 }}> ⇅</span>;
  };

  // カテゴリ一覧を取得。PWA更新直後（Service Workerがclients.claim()で制御を握った
  // 直後のページリロード等）はfetch自体が一過性で失敗しやすいため（issue #758）、
  // 例外発生時は即座にアラートを出さず、1秒後に1回だけ自動で再試行する
  useEffect(() => {
    let cancelled = false;
    const fetchCategories = async (isRetry = false) => {
      try {
        const response = await fetch(`${API_BASE_URL}/get-categories`);
        const data = await response.json();
        if (response.ok) {
          const availableCategories = data.categories || [];
          setCategories(availableCategories);

          if (availableCategories.length > 0 && viewRef.current === "game") {
            const availableNames = availableCategories.map(cat => cat.name);
            setSelectedCategories(prev => filterStillValidCategories(prev, availableNames));
          }
        }
    } catch (error) {
      if (cancelled) return;
      if (!isRetry) {
        console.error("Error fetching categories, retrying once:", error);
        setTimeout(() => {
          if (!cancelled) fetchCategories(true);
        }, 1000);
        return;
      }
      alert("カテゴリの取得に失敗しました。");
    }
    };
    fetchCategories();
    return () => {
      cancelled = true;
    };
  }, []);

  // カテゴリが選択されたら、選択中の全カテゴリの札IDリストを取得して結合する。
  // issue #474: 以前はPromise.allを使っており、選択中の1カテゴリでも取得に失敗すると
  // 全体がrejectしてallPhrasesForCategoryが空配列にリセットされていた（カテゴリ数が
  // 多い「全カテゴリ選択」ほど並列リクエスト数が増え、個々の失敗確率も上がるため
  // 発生しやすかった）。Promise.allSettledに変更し、失敗したカテゴリがあっても
  // 成功分はそのまま反映しつつ、phrasesFetchErrorで失敗の有無だけ別途知らせる。
  // phrasesFetchRetryTokenは「再試行する」ボタンから同じカテゴリ構成のまま
  // 再フェッチを起動するためだけのstateで、値自体に意味はない
  const [phrasesFetchRetryToken, setPhrasesFetchRetryToken] = useState(0);
  useEffect(() => {
    const fetchPhrasesList = async () => {
      if (selectedCategories.length === 0) {
        setAllPhrasesForCategory([]);
        setPhrasesFetchError(false);
        return;
      }
      const settled = await Promise.allSettled(
        selectedCategories.map(async (cat) => {
          const response = await fetch(`${API_BASE_URL}/get-phrases-list?category=${encodeURIComponent(cat)}`);
          if (!response.ok) {
            throw new Error(`Failed to fetch phrases for category: ${cat}`);
          }
          const data = await response.json();
          return data.phrases || [];
        })
      );
      const succeeded = settled.filter((r) => r.status === "fulfilled").flatMap((r) => r.value);
      const failedCount = settled.filter((r) => r.status === "rejected").length;
      settled.forEach((r, i) => {
        if (r.status === "rejected") {
          console.error(`Error fetching phrases for category "${selectedCategories[i]}":`, r.reason);
        }
      });
      setAllPhrasesForCategory(succeeded);
      setPhrasesFetchError(failedCount > 0);
      // 選択中の全カテゴリが失敗した場合（部分的な失敗ではなく完全な失敗）のみ、
      // 従来どおりアラートで知らせる。1カテゴリの失敗程度ではアラートを出さない
      if (failedCount > 0 && succeeded.length === 0) {
        alert("かるたデータの取得に失敗しました。もう一度お試しください。");
      }
    };
    fetchPhrasesList();
  }, [selectedCategories, phrasesFetchRetryToken]);
  const retryFetchPhrasesList = () => setPhrasesFetchRetryToken((token) => token + 1);

  // 詳細データの取得
  useEffect(() => {
    const fetchDetail = async () => {
      if (!detailPhraseId) {
        setDetailPhrase(null);
        return;
      }
      try {
        const categoryParam = detailPhraseCategory ? `&category=${encodeURIComponent(detailPhraseCategory)}` : "";
        const response = await fetch(`${API_BASE_URL}/get-phrase?id=${detailPhraseId}${categoryParam}&repeatCount=${repeatCount}&speechRate=${encodeURIComponent(speechRate)}&lang=${lang}&voiceId=${encodeURIComponent(voiceId)}&announceCategory=${isMultiCategorySelection}`);
        const data = await response.json();
        if (response.ok) {
          setDetailPhrase(data);
        }
      } catch (error) {
        console.error("Error fetching phrase detail:", error);
      }
    };
    fetchDetail();
  }, [detailPhraseId, detailPhraseCategory, repeatCount, speechRate, lang, voiceId, isMultiCategorySelection]);

  // 指摘一覧の取得（指摘一覧画面のほか、詳細画面で既存の指摘を表示するためにも使う）
  useEffect(() => {
    const fetchComments = async () => {
      if (view === "comments" || detailPhraseId) {
        try {
          const response = await fetch(`${API_BASE_URL}/get-comments`);
          const data = await response.json();
          if (response.ok) {
            setAllComments(data.comments || []);
          }
        } catch (error) {
          console.error("Error fetching comments:", error);
        }
      }
    };
    fetchComments();
  }, [view, detailPhraseId]);

  const detailPhraseComments = useMemo(() => {
    if (!detailPhrase) return [];
    return allComments.filter(c => c.phraseId === detailPhrase.id);
  }, [allComments, detailPhrase]);

  // 全札一覧の取得
  useEffect(() => {
    if (view === "all-phrases") {
      const fetchAllPhrases = async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/get-phrases-list`);
          const data = await response.json();
          if (response.ok) {
            setAllPhrases(data.phrases || []);
          }
        } catch (error) {
          console.error("Error fetching all phrases:", error);
        }
      };
      fetchAllPhrases();
    }
  }, [view]);

  // 「もう一度」ボタン・読み札カードのクリック: 詳細画面で開いている札があれば
  // それを、無ければ現在読み上げ中の札を対象にする。実際にキューへ積んで再生する
  // 処理自体はuseKarutaReading側が持つ（issue #607）
  const repeatPhrase = async () => {
    const target = detailPhrase || currentPhrase;
    if (target && target.audioData) {
      queueRepeatAudio(target.audioData);
    }
  };

  const postComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setPostingComment(true);
    try {
      const response = await fetch(`${API_BASE_URL}/post-comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phraseId: detailPhrase.id,
          category: detailPhrase.category,
          phrase: detailPhrase.phrase,
          comment: commentText,
        }),
      });

      if (response.ok) {
        alert("指摘内容を送信しました。ありがとうございます。");
        setCommentText("");
      } else {
        throw new Error("Failed to post comment");
      }
    } catch {
      alert("送信に失敗しました。");
    } finally {
      setPostingComment(false);
    }
  };

  useUrlQuerySync({
    selectedCategories,
    division,
    detailPhraseId,
    view,
    setSelectedCategories,
    setDivision,
    setDetailPhraseId,
    setView,
  });

  useWakeLock(view === "game" && selectedCategories.length > 0);

  // クイズ大会モード（issue #470）の管理者側ロジック（ルーム作成・一覧取得・
  // WebSocket接続・早押し判定・状態ブロードキャスト）はuseQuizRoomAdminへ切り出した
  // （issue #607）。参加者側の状態同期・カテゴリ選択・札めくり自体は通常のゲーム画面
  // （このApp.jsx）をそのまま使う
  const {
    quizRoom,
    creatingQuizRoom,
    quizRoomCreateError,
    openQuizRooms,
    quizRoomBuzzedBy,
    quizRoomPoints,
    quizRoomAnswerCounts,
    quizRoomParticipants,
    quizRoomConnectionStatus,
    reconnectQuizRoom,
    resetQuizRoomPoints,
    closeQuizRoom,
    createQuizRoom,
    joinQuizRoom,
    judgeQuizRoomBuzz,
    adminSessionRoomId,
    adminSessionRestoreError,
    isRestoringAdminSession,
    switchToAdminMode,
  } = useQuizRoomAdmin({
    view,
    selectedCategories,
    displayContent,
    broadcastPhrase,
    isAllRead,
    repeatCount,
    speechRate,
    lang,
    voiceId,
    isMultiCategorySelection,
    setView,
    revealCurrentResult,
    stopReading,
  });

  // useKarutaReading（quizRoomActiveRef、issue #861）へ最新のクイズ大会モード状態を
  // 伝える。useKarutaReadingはuseQuizRoomAdminより前に呼ぶ必要があり（useQuizRoomAdmin
  // はuseKarutaReadingの戻り値に依存するため）quizRoomを直接propsとして渡せない
  useEffect(() => {
    quizRoomActiveRef.current = !!quizRoom;
  }, [quizRoom]);

  useEffect(() => {
    if (view === "comments") {
      document.title = "指摘一覧 | かるた読み上げアプリ";
    } else if (view === "changelog") {
      document.title = "更新履歴 | かるた読み上げアプリ";
    } else if (view === "all-phrases") {
      document.title = "全札一覧 | かるた読み上げアプリ";
    } else if (view === "print-efuda") {
      document.title = `${categoryLabel}の絵札印刷 | かるた読み上げアプリ`;
    } else if (detailPhraseId && detailPhrase) {
      document.title = `${detailPhrase.phrase} | ${detailPhrase.category}`;
    } else if (categoryLabel) {
      document.title = categoryLabel;
    } else {
      document.title = "かるた読み上げアプリ";
    }
  }, [categoryLabel, detailPhraseId, detailPhrase, view]);

  useEffect(() => {
    document.documentElement.setAttribute("data-bs-theme", resolvedTheme);
  }, [resolvedTheme]);

  // OSの配色設定(ダーク/ライト)の変更をリアルタイムに反映する
  useEffect(() => {
    const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mediaQuery) return;
    const handleChange = (e) => setSystemPrefersDark(e.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const resetGame = () => {
    setSelectedCategories([]);
    setDraftCategories([]);
    setDetailPhraseId(null);
    resetReadingState();
  };

  const restartCategory = () => {
    setHistoryByCategory(prev => ({
      ...prev,
      [categoryKey]: []
    }));
    resetCategoryScores();
    resetReadingState();
  };

  const selectDivision = (div) => {
    setDivision(div);
    setDraftCategories([]);
  };

  const goBackToDivisionSelect = () => {
    setDivision(null);
    setDraftCategories([]);
  };

  const toggleDraftCategory = (cat) => {
    if (division === "kids") {
      // こども向けは1件しか選べない仕様のため、決定ボタン・確認モーダルを
      // 経由せずワンタップで読み上げ画面に遷移する
      setSelectedCategories([cat]);
      setDraftCategories([]);
      setView("game");
      return;
    }
    setDraftCategories(prev => {
      if (prev.includes(cat)) return prev.filter(c => c !== cat);
      // 追加後の合計枚数が上限を超える場合は選択自体をブロックする
      // （PDF出力が破綻しない範囲に選択可能な種別を制限するバリデーション）
      const catInfo = categories.find(c => c.name === cat);
      const currentCount = sumCategoryCounts(prev, categories);
      if (currentCount + (catInfo?.count || 0) > MAX_EFUDA_PRINT_CARDS) {
        return prev;
      }
      return [...prev, cat];
    });
  };

  const handleDecideClick = () => {
    if (draftCategories.length === 0) return;
    setSelectedCategories(draftCategories);
    setDraftCategories([]);
    setView("game");
  };

  const handlePrintEfudaClick = () => {
    if (draftCategories.length === 0) return;
    setSelectedCategories(draftCategories);
    setView("print-efuda");
  };

  // かるた選択画面から印刷画面へ直接遷移した場合（issue #636）はカテゴリを
  // まだ「決定」していないため、戻る際はselectedCategoriesを空へ戻し
  // かるた選択画面へ戻す。こども向け（issue #636の検討事項により、ゲーム画面
  // フッターの印刷ボタンを引き続き使う）はゲーム画面から遷移しているため、
  // selectedCategoriesはそのままゲーム画面へ戻す
  const handlePrintEfudaBack = () => {
    if (division === "engineer") {
      setSelectedCategories([]);
    }
    setView("game");
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

  // ゲーム画面以外の各画面（詳細・絵札印刷・全札一覧・指摘一覧・更新履歴・クイズ大会・
  // division/カテゴリ選択）へのルーティング。Appコンポーネント本体の複雑度を抑えるため、
  // 該当する画面が無ければnullを返すだけの即時実行関数へ分岐をまとめている
  const routedView = (() => {
  if (detailPhraseId) {
    return (
      <DetailView
        detailPhrase={detailPhrase}
        detailPhraseCategory={detailPhraseCategory}
        categoryLabel={categoryLabel}
        closeDetail={closeDetail}
        repeatPhrase={repeatPhrase}
        commentText={commentText}
        setCommentText={setCommentText}
        postComment={postComment}
        postingComment={postingComment}
        detailPhraseComments={detailPhraseComments}
      />
    );
  }

  if (view === "print-efuda") {
    return (
      <PrintEfudaView
        categoryLabel={categoryLabel}
        onBack={handlePrintEfudaBack}
        selectedCategories={selectedCategories}
        allPhrasesForCategory={allPhrasesForCategory}
        phrasesFetchError={phrasesFetchError}
        onRetryFetchPhrases={retryFetchPhrasesList}
        efudaPages={efudaPages}
        efudaPerPage={EFUDA_PER_PAGE}
      />
    );
  }

  if (view === "all-phrases") {
    return (
      <AllPhrasesView
        allPhrases={allPhrases}
        filterCategory={filterCategory}
        setFilterCategory={setFilterCategory}
        filterDivision={filterDivision}
        setFilterDivision={setFilterDivision}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        uniqueCategories={visibleCategories}
        categoryCount={categoryCount}
        filteredPhrases={filteredPhrases}
        renderSortArrow={renderSortArrow}
        handleSort={handleSort}
        sortConfig={sortConfig}
        openDetail={openDetail}
        setView={setView}
        setSelectedCategories={setSelectedCategories}
      />
    );
  }

  if (view === "comments") {
    return <CommentsView allComments={allComments} setView={setView} />;
  }

  if (view === "changelog") {
    return <ChangelogView setView={setView} />;
  }

  if (view === "quiz-room") {
    return (
      <QuizRoomView
        setView={setView}
        wsBaseUrl={WS_BASE_URL}
        adminSessionRoomId={adminSessionRoomId}
        adminSessionRestoreError={adminSessionRestoreError}
        switchToAdminMode={switchToAdminMode}
      />
    );
  }

  // ルーム情報（ルームコード・QRコード・招待URL）表示は、以前は通常のゲーム画面内の
  // インラインパネルだったが、別画面への遷移に変更した（issue #547）。quizRoomが
  // 未設定（ページリロード等でstateが失われ、URLにこのviewだけが残っている場合）は
  // 通常のゲーム画面へフォールスルーする
  if (view === "quiz-room-info" && quizRoom) {
    return (
      <>
        <QuizRoomInfoView
          setView={setView}
          roomId={quizRoom.roomId}
          quizRoomParticipants={quizRoomParticipants}
          quizRoomPoints={quizRoomPoints}
          quizRoomAnswerCounts={quizRoomAnswerCounts}
          resetQuizRoomPoints={resetQuizRoomPoints}
          closeQuizRoom={closeQuizRoom}
        />
        {/* issue #613: 早押し判定モーダルはこの画面を開いている間も表示する
            （以前はゲーム画面のレンダー内にしか存在せず、この画面滞在中は
            参加者が早押ししても管理者が気づけなかった） */}
        <QuizRoomBuzzJudgmentModal
          buzzedBy={quizRoomBuzzedBy}
          answer={currentPhrase?.answer}
          explanation={currentPhrase?.explanation}
          onJudge={judgeQuizRoomBuzz}
        />
      </>
    );
  }

  if (selectedCategories.length === 0 && !division) {
    return (
      <DivisionSelectView
        openQuizRooms={openQuizRooms}
        joinQuizRoom={joinQuizRoom}
        selectDivision={selectDivision}
        setView={setView}
      />
    );
  }

  if (selectedCategories.length === 0) {
    return (
      <CategorySelectView
        division={division}
        categories={categories}
        categoriesForDivision={categoriesForDivision}
        draftCategories={draftCategories}
        draftCardCount={draftCardCount}
        draftCategoriesRequiringPossessionCheck={draftCategoriesRequiringPossessionCheck}
        maxEfudaPrintCards={MAX_EFUDA_PRINT_CARDS}
        goBackToDivisionSelect={goBackToDivisionSelect}
        toggleDraftCategory={toggleDraftCategory}
        handleDecideClick={handleDecideClick}
        handlePrintEfudaClick={handlePrintEfudaClick}
        setView={setView}
      />
    );
  }

  return null;
  })();
  if (routedView) return routedView;

  const renderPhrase = (phrase) => {
    if (!phrase) return null;
    return (
        <div className={`yomifuda ${division === "kids" ? "yomifuda-kids" : ""}`} onClick={repeatPhrase} role="button" aria-label="もう一度">
            <div className="yomifuda-kana"><span>{phrase.kana || (phrase.phrase && phrase.phrase[0])}</span></div>
            <div className="yomifuda-phrase">{phrase.phrase}</div>
            {division !== "kids" && phrase.level !== "-" && <div className="yomifuda-level fw-bold">レベル: {phrase.level}</div>}
        </div>
    );
  }

  const renderInitial = () => {
    return (
      <div className="d-flex flex-column justify-content-center align-items-center text-muted h-100">
        <img src={karutaImage} alt="準備完了" className="mb-3" style={{ width: "120px", opacity: 0.8 }} />
        <div className="fw-bold">準備完了</div>
        <small className="mt-2">「次の札を読み上げる」ボタンを押して開始してください<br/>
        読み上げのオプションは下部から設定してください</small>
      </div>
    )
  }

  // ゲーム画面本体（読了後のお祝い画面 or 読み札カード＋操作ボタン）。
  // Appコンポーネント本体の複雑度を抑えるため、別関数として切り出している
  const renderGameMain = () => {
    if (isAllRead) {
      return (
        <QuizCompletionScreen
          sessionSummary={sessionSummary}
          scoreSummary={scoreSummary}
          restartCategory={restartCategory}
        />
      );
    }
    return (
      <>
        <div className={`yomifuda-container mb-4 ${isFadingOut ? 'fade-out' : 'fade-in'}`}>
          {displayContent.type === 'phrase' && renderPhrase(displayContent.content)}
          {displayContent.type === 'result' && <ResultCard result={displayContent.content} division={division} />}
          {displayContent.type === 'initial' && renderInitial()}
        </div>

        {displayContent.type === 'phrase' && division !== "kids" && players.length > 0 && (
          <div className="mb-4">
            <div className="text-muted small mb-2">取った人:</div>
            <div className="d-flex flex-wrap gap-2 justify-content-center">
              {players.map(name => (
                <button
                  key={name}
                  onClick={() => recordTaken(name)}
                  className={`btn btn-sm rounded-pill px-3 ${currentRoundTakenBy === name ? 'btn-dark' : 'btn-outline-dark'}`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="d-flex flex-wrap gap-3 justify-content-center mb-5">
          <button onClick={playKaruta} disabled={loading || isReadingLastPhrase} className="btn btn-lg px-4 py-3 fw-bold rounded-pill shadow btn-karuta">
            {loading && <span className="spinner-border spinner-border-sm me-2"></span>}
            {loading ? "読み込み中..." : "次の札"}
          </button>
          <button onClick={repeatPhrase} disabled={isReading || !currentPhrase} className="btn btn-lg px-4 py-3 fw-bold rounded-pill border-3 border-dark bg-white text-dark shadow-sm">もう一度</button>
          <button onClick={stopReading} disabled={!isReading} className="btn btn-lg px-4 py-3 fw-bold rounded-pill border-3 border-danger bg-white text-danger shadow-sm">停止</button>
        </div>
      </>
    );
  };

  return (
    <div className="container py-4 mx-auto">
      <header className="text-center mb-4">
        <h1 className="h2 fw-bold text-dark notranslate">{categoryLabel}</h1>
        {!isAllRead && allPhrasesForCategory.length > 0 && (() => {
          const readCount = Math.min(currentHistory.length, allPhrasesForCategory.length);
          return (
            <div className="mt-2 mx-auto" style={{ maxWidth: "300px" }}>
              <div className="text-muted small mb-1">
                読み上げ済み {readCount} / 全{allPhrasesForCategory.length}枚
              </div>
              <div
                className="progress"
                style={{ height: "8px" }}
                role="progressbar"
                aria-label="読み上げ進捗"
                aria-valuenow={readCount}
                aria-valuemin={0}
                aria-valuemax={allPhrasesForCategory.length}
              >
                <div
                  className="progress-bar progress-bar-karuta"
                  style={{ width: `${(readCount / allPhrasesForCategory.length) * 100}%` }}
                ></div>
              </div>
            </div>
          );
        })()}
      </header>

      <main className="text-center">
        {renderGameMain()}
      </main>

      {currentHistory.length > 0 && (
        <section className="history mx-auto text-center" style={{ maxWidth: "600px" }}>
          <button
            type="button"
            onClick={() => setShowHistory(prev => !prev)}
            className="btn btn-sm btn-outline-secondary rounded-pill px-3 mb-3"
          >
            {showHistory ? "これまでに読み上げた札を閉じる" : `これまでに読み上げた札を表示する（${currentHistory.length}枚）`}
          </button>
          {showHistory && (
            <div className="text-start">
              <h2 className="h4 fw-bold mb-3 border-bottom pb-2 text-dark">これまでに読み上げた札</h2>
              <div className="list-group shadow-sm rounded">
                {currentHistory.map((p, index) => (
                  <button key={`${p.category}-${p.id}-${currentHistory.length - index}`} onClick={() => openDetail(p.id, p.category)} className="list-group-item list-group-item-action d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center">
                      {p.level !== "-" && <span className="badge bg-danger me-2">Lv.{p.level}</span>}
                      <span className="text-dark">{p.phrase}</span>
                    </div>
                    <div className="d-flex align-items-center">
                      {/* クイズ大会モードの正解者表示（issue #695）: winnerは早押しが
                          正解と判定された参加者名。クイズ大会モード以外・誰も正解
                          しなかった場合は表示しない */}
                      {p.winner && <span className="text-success small me-3 notranslate">🎉 {p.winner}さん正解</span>}
                      {p.elapsedTime && <span className="text-muted small me-3">{p.elapsedTime}秒</span>}
                      <span className="text-primary small">詳細・報告 →</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <footer className="text-center mt-5 pt-4 border-top">
        <SettingsFooter
          themeSetting={themeSetting}
          setThemeSetting={setThemeSetting}
          lang={lang}
          setLang={setLang}
          voiceId={voiceId}
          setVoiceId={setVoiceId}
          sortOrder={sortOrder}
          setSortOrder={setSortOrder}
          speechRate={speechRate}
          setSpeechRate={setSpeechRate}
          repeatCount={repeatCount}
          setRepeatCount={setRepeatCount}
        />
      <div className="d-flex flex-wrap gap-2 justify-content-center mb-4">
        {division === "kids" && (
          // こども向け（issue #636）はかるた選択画面に「決定」ボタンが無く印刷ボタンを
          // 置けないため、従来どおりゲーム画面からの導線を残す。エンジニア向けは
          // かるた選択画面の「かるたを始める」ボタン下に一本化したためここには置かない
          <button onClick={() => setView("print-efuda")} className="btn btn-outline-dark px-4 rounded-pill">絵札を印刷する</button>
        )}
        <button onClick={resetGame} className="btn btn-outline-dark px-4 rounded-pill">かるたの種類を選び直す</button>
      </div>
      <QuizRoomActionsPanel
        quizRoom={quizRoom}
        quizRoomConnectionStatus={quizRoomConnectionStatus}
        reconnectQuizRoom={reconnectQuizRoom}
        setView={setView}
        quizRoomBuzzedBy={quizRoomBuzzedBy}
        currentPhrase={currentPhrase}
        judgeQuizRoomBuzz={judgeQuizRoomBuzz}
        division={division}
        adminSessionRoomId={adminSessionRoomId}
        isRestoringAdminSession={isRestoringAdminSession}
        switchToAdminMode={switchToAdminMode}
        createQuizRoom={createQuizRoom}
        creatingQuizRoom={creatingQuizRoom}
        quizRoomCreateError={quizRoomCreateError}
        adminSessionRestoreError={adminSessionRestoreError}
        showPlayerRegistration={showPlayerRegistration}
        setShowPlayerRegistration={setShowPlayerRegistration}
        players={players}
        removePlayer={removePlayer}
        newPlayerName={newPlayerName}
        setNewPlayerName={setNewPlayerName}
        addPlayer={addPlayer}
        maxPlayers={maxPlayers}
      />
    </footer>
    </div>
  );
}

export default App;
