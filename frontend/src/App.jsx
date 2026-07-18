import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import "./App.css";
import karutaImage from "./assets/karuta_inubou.png";
import { API_BASE_URL, WS_BASE_URL } from "./config";
import { useLocalStorageState } from "./hooks/useLocalStorageState";
import { useSessionStorageState } from "./hooks/useSessionStorageState";
import { useUrlQuerySync, parseCategoriesParam } from "./hooks/useUrlQuerySync";
import { useWakeLock } from "./hooks/useWakeLock";
import { useQuizRoomAdmin } from "./hooks/useQuizRoomAdmin";
import { CONNECTION_STATUS_LABEL } from "./hooks/useQuizRoomSync";
import DetailView from "./views/DetailView";
import PrintEfudaView from "./views/PrintEfudaView";
import AllPhrasesView from "./views/AllPhrasesView";
import CommentsView from "./views/CommentsView";
import ChangelogView from "./views/ChangelogView";
import QuizRoomView from "./views/QuizRoomView";
import QuizRoomInfoView from "./views/QuizRoomInfoView";
import QuizRoomBuzzJudgmentModal from "./components/QuizRoomBuzzJudgmentModal";

const HISTORY_STORAGE_KEY = "historyByCategory";
const PLAYERS_STORAGE_KEY = "players";
const SCORES_STORAGE_KEY = "scoresByCategory";
const MAX_PLAYERS = 6;

// 絵札印刷時に選択できる合計読み札数の上限。PDF生成はバックエンド（renderEfudaPdfWorker、
// ヘッドレスChromiumのpage.pdf()）で行うため、クライアント端末のメモリには依存しなくなった。
// ただし無制限にすると認証なしのAPIに巨大なジョブを投げ放題になってしまうため、
// バックエンド側（backend/efudaPdfHandler.jsのMAX_EFUDA_PRINT_CARDS_SERVER）と
// 同じ値の上限を維持する。こちらは選択UI自体をブロックする一次防御、
// バックエンド側はURL直叩き等を弾く二次防御
const MAX_EFUDA_PRINT_CARDS = 500;

// 未読み札から次に読み上げる1件を選ぶ（プリフェッチと実際の選択で同じロジックを使う）
const pickTargetPhrase = (unreadPhrases, sortOrder) => {
  if (sortOrder === "easy") {
    return [...unreadPhrases].sort((a, b) => (a.averageDifficulty || 0) - (b.averageDifficulty || 0))[0];
  }
  if (sortOrder === "hard") {
    return [...unreadPhrases].sort((a, b) => (b.averageDifficulty || 0) - (a.averageDifficulty || 0))[0];
  }
  const randomIndex = Math.floor(Math.random() * unreadPhrases.length);
  return unreadPhrases[randomIndex];
};

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
  const [allPhrases, setAllPhrases] = useState([]); // 全札一覧用
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' }); // ソート設定
  const [filterCategory, setFilterCategory] = useState(''); // 全札一覧フィルタ
  const [searchQuery, setSearchQuery] = useState(''); // 全札一覧テキスト検索
  const [currentPhrase, setCurrentPhrase] = useState(null);
  
  const [displayContent, setDisplayContent] = useState({ type: "initial" });
  const [isFadingOut, setIsFadingOut] = useState(false);
  const nextContentRef = useRef(null);
  const animationResolveRef = useRef(null);

  const [audioQueue, setAudioQueue] = useState([]);
  const [isReading, setIsReading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isAllRead, setIsAllRead] = useState(false);
  const [repeatCount, setRepeatCount] = useLocalStorageState("repeatCount", 2, (v) => parseInt(v, 10));
  const [speechRate, setSpeechRate] = useLocalStorageState("speechRate", "80%");
  const [lang, setLang] = useLocalStorageState("lang", "ja");
  const [voiceId, setVoiceId] = useLocalStorageState("voiceId", "Mizuki");
  const [sortOrder, setSortOrder] = useLocalStorageState("sortOrder", "random");
  const [autoAdvance, setAutoAdvance] = useLocalStorageState("autoAdvance", false, (v) => v === "true");
  const [autoAdvanceInterval, setAutoAdvanceInterval] = useLocalStorageState("autoAdvanceInterval", 10, (v) => parseInt(v, 10));
  const [themeSetting, setThemeSetting] = useLocalStorageState("theme", "system");
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => {
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  });
  const [historyByCategory, setHistoryByCategory] = useSessionStorageState(HISTORY_STORAGE_KEY, {});
  const [players, setPlayers] = useSessionStorageState(PLAYERS_STORAGE_KEY, []);
  const [newPlayerName, setNewPlayerName] = useState("");
  // 「取った人を記録する」参加者登録は、カテゴリ確定時のモーダルではなく読み札画面の
  // ボタンから任意に開閉する（issue #518）
  const [showPlayerRegistration, setShowPlayerRegistration] = useState(false);
  // 「これまでに読み上げた札」一覧は、件数が増えると画面が長くなるためデフォルト非表示にし、
  // ボタンを押したときだけ開く（issue #548）
  const [showHistory, setShowHistory] = useState(false);
  const [scoresByCategory, setScoresByCategory] = useSessionStorageState(SCORES_STORAGE_KEY, {});
  const [currentRoundTakenBy, setCurrentRoundTakenBy] = useState(null);
  // currentRoundTakenByのレンダー中state調整（下記）で、ラウンド切り替えを検知するための
  // 直前値の追跡用
  const [lastPhraseForTakenByReset, setLastPhraseForTakenByReset] = useState(null);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [draftCategories, setDraftCategories] = useState([]);

  // コメント投稿用の状態
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  const flipTimeoutRef = useRef(null);
  const startTimeRef = useRef(null);
  const currentAudioRef = useRef(null);
  const stopRequestedRef = useRef(false);
  const prefetchedNextRef = useRef(null);
  const autoAdvanceTimeoutRef = useRef(null);
  // 「次の札」連打対策（issue #590）: loadingは処理の後半（フェードアウト待ち完了後）に
  // ならないとtrueにならず、押下直後の連打を防げないため、押下と同時に同期的に
  // 立てられる再入防止用のrefを別途持つ
  const playKarutaInFlightRef = useRef(false);

  const resolvedTheme = useMemo(() => {
    return themeSetting === "system" ? (systemPrefersDark ? "dark" : "light") : themeSetting;
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

  const currentScores = useMemo(() => {
    return categoryKey ? (scoresByCategory[categoryKey] || {}) : {};
  }, [categoryKey, scoresByCategory]);

  // 読了時のスコア集計（参加者が1人以上登録されている場合のみ表示する）
  const scoreSummary = useMemo(() => {
    if (!isAllRead || division === "kids" || players.length === 0) return null;
    const entries = players.map(name => ({ name, count: currentScores[name] || 0 }));
    const maxCount = Math.max(0, ...entries.map(e => e.count));
    const winners = maxCount > 0 ? entries.filter(e => e.count === maxCount).map(e => e.name) : [];
    return { entries, winners };
  }, [isAllRead, division, players, currentScores]);

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

  // 読了時の紙吹雪演出（isAllReadになった時点の1回だけ生成し、以降の再レンダーでは揺れ動かさない）。
  // Math.random()はレンダー中（useMemoのファクトリ関数を含む）に呼び出すと
  // react-hooks/purityに抵触するため、iから決定的に導出する疑似乱数を使う
  // （見た目のランダムさだけが目的で、実際の乱雑さの品質は問わない演出のため）
  const confettiPieces = useMemo(() => {
    if (!isAllRead) return [];
    const emojis = ["🎉", "✨", "🎊", "⭐"];
    const pseudoRandom = (seed) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };
    return Array.from({ length: 24 }, (_, i) => ({
      id: i,
      emoji: emojis[i % emojis.length],
      left: pseudoRandom(i) * 100,
      delay: pseudoRandom(i + 100) * 0.6,
      duration: 2.2 + pseudoRandom(i + 200) * 1.2,
    }));
  }, [isAllRead]);

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
      sortableItems.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];
        
        if (sortConfig.key === 'level') {
            if (aValue === '-' && bValue !== '-') return 1;
            if (aValue !== '-' && bValue === '-') return -1;
            if (aValue === '-' && bValue === '-') return 0;
            // 初級=1000000、上級=1000001 として数値化し一貫したソートを保証
            const toLevelNum = (v) => {
              if (v === '初級') return 1_000_000;
              if (v === '上級') return 1_000_001;
              const n = parseInt(v, 10);
              return isNaN(n) ? 1_000_002 : n;
            };
            aValue = toLevelNum(aValue);
            bValue = toLevelNum(bValue);
        } else if (sortConfig.key === 'readCount' || sortConfig.key === 'averageDifficulty' || sortConfig.key === 'averageTime') {
            aValue = aValue || 0;
            bValue = bValue || 0;
        } else if (sortConfig.key === 'answer') {
            const aMissing = !aValue || aValue === '-';
            const bMissing = !bValue || bValue === '-';
            if (aMissing && !bMissing) return 1;
            if (!aMissing && bMissing) return -1;
            if (aMissing && bMissing) return 0;
            aValue = aValue.toLowerCase();
            bValue = bValue.toLowerCase();
        } else if (typeof aValue === 'string') {
            aValue = aValue.toLowerCase();
            bValue = bValue.toLowerCase();
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [allPhrases, sortConfig]);

  const uniqueCategories = useMemo(() => {
    return [...new Set(allPhrases.map(p => p.category))].sort((a, b) => a.localeCompare(b, 'ja'));
  }, [allPhrases]);

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

  // カテゴリ一覧を取得
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/get-categories`);
        const data = await response.json();
        if (response.ok) {
          const availableCategories = data.categories || [];
          setCategories(availableCategories);

          if (availableCategories.length > 0 && viewRef.current === "game") {
            const availableNames = availableCategories.map(cat => cat.name);
            setSelectedCategories(prev => {
              if (prev.length === 0) return prev;
              const stillValid = prev.filter(cat => availableNames.includes(cat));
              return stillValid.length !== prev.length ? stillValid : prev;
            });
          }
        }
    } catch {
      alert("カテゴリの取得に失敗しました。");
    }
    };
    fetchCategories();
  }, []);

  // カテゴリが選択されたら、選択中の全カテゴリの札IDリストを取得して結合する
  useEffect(() => {
    const fetchPhrasesList = async () => {
      if (selectedCategories.length === 0) {
        setAllPhrasesForCategory([]);
        return;
      }
      try {
        const results = await Promise.all(
          selectedCategories.map(async (cat) => {
            const response = await fetch(`${API_BASE_URL}/get-phrases-list?category=${encodeURIComponent(cat)}`);
            if (!response.ok) {
              throw new Error(`Failed to fetch phrases for category: ${cat}`);
            }
            const data = await response.json();
            return data.phrases || [];
          })
        );
        setAllPhrasesForCategory(results.flat());
      } catch (error) {
        console.error("Error fetching phrases list:", error);
        alert("かるたデータの取得に失敗したカテゴリがあります。もう一度選び直してください。");
        setAllPhrasesForCategory([]);
      }
    };
    fetchPhrasesList();
  }, [selectedCategories]);

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

  useEffect(() => {
    if (isFadingOut) {
      const timer = setTimeout(() => {
        setDisplayContent(nextContentRef.current);
        setIsFadingOut(false);
      }, 500); // CSSのtransition時間と合わせる
      return () => clearTimeout(timer);
    } else {
      // isFadingOut が false になったとき = フェードイン完了
      if (animationResolveRef.current) {
        animationResolveRef.current();
        animationResolveRef.current = null;
      }
    }
  }, [isFadingOut]);

  const playAudio = useCallback((audioData) => {
    return new Promise((resolve, reject) => {
      const audio = new Audio(audioData);
      currentAudioRef.current = { audio, resolve };
      audio.onended = () => {
        if (currentAudioRef.current?.audio === audio) currentAudioRef.current = null;
        resolve();
      };
      audio.onerror = (e) => {
        if (currentAudioRef.current?.audio === audio) currentAudioRef.current = null;
        reject(e);
      };
      audio.play().catch(e => reject(e));
    });
  }, []);

  const playIntroSound = useCallback(async () => {
    try {
      await playAudio("wadodon.mp3");
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.error("Intro sound failed:", error);
    }
  }, [playAudio]);
  
  useEffect(() => {
    const playNextInQueue = async () => {
      if (isReading || audioQueue.length === 0) {
        return;
      }

      setIsReading(true);
      const { phraseData, audioData, playbackSettings } = audioQueue[0];

      if (phraseData) {
        setCurrentPhrase(phraseData);

        setHistoryByCategory(prev => {
          const currentList = prev[categoryKey] || [];
          if (currentList.find(p => p.id === phraseData.id && p.category === phraseData.category)) {
            return prev;
          }
          return {
            ...prev,
            [categoryKey]: [phraseData, ...currentList]
          };
        });
      }

      await playIntroSound();
      // 停止ボタンが押されていたら、次のフェーズ（本編読み上げ）に進まず打ち切る
      if (stopRequestedRef.current) {
        stopRequestedRef.current = false;
        setIsReading(false);
        return;
      }

      let animationPromise = Promise.resolve();

      if (phraseData) {
        // 読み上げ開始タイミングで計測開始（リピート再生時は計測中の開始点を上書きしない）
        startTimeRef.current = Date.now();

        if (flipTimeoutRef.current) {
          clearTimeout(flipTimeoutRef.current);
          flipTimeoutRef.current = null;
        }

        animationPromise = new Promise(resolve => {
          animationResolveRef.current = resolve;
        });

        // 3秒待機してからフェードアニメーションを開始
        flipTimeoutRef.current = setTimeout(() => {
          nextContentRef.current = { type: "phrase", content: phraseData, playbackSettings };
          setIsFadingOut(true);
        }, 3000); // 待機時間
      }

      await playAudio(audioData).catch(e => console.error("Audio playback failed:", e));
      if (stopRequestedRef.current) {
        stopRequestedRef.current = false;
        setIsReading(false);
        return;
      }

      await animationPromise;
      if (stopRequestedRef.current) {
        stopRequestedRef.current = false;
        setIsReading(false);
        return;
      }

      if (!phraseData) {
        nextContentRef.current = { type: 'initial' };
        setIsFadingOut(true);
      }

      setAudioQueue(prev => prev.slice(1));
      setIsReading(false);
    };
  
    playNextInQueue();

    return () => {
      if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current);
    }
  }, [audioQueue, isReading, playAudio, playIntroSound, categoryKey, historyByCategory, setHistoryByCategory]);

  // 現在の札を読み上げている間に、次に読み上げる予定の札の音声を先読みしておく
  useEffect(() => {
    if (!isReading || selectedCategories.length === 0 || allPhrasesForCategory.length === 0) {
      return;
    }

    const readKeys = new Set(currentHistory.map(p => `${p.category}:${p.id}`));
    const unreadPhrases = allPhrasesForCategory.filter(p => !readKeys.has(`${p.category}:${p.id}`));
    if (unreadPhrases.length === 0) {
      return;
    }

    const announceCategory = isMultiCategorySelection;
    const settingsSignature = JSON.stringify({ repeatCount, speechRate, lang, voiceId, announceCategory, sortOrder });

    const alreadyPrefetched = prefetchedNextRef.current;
    if (
      alreadyPrefetched &&
      alreadyPrefetched.settingsSignature === settingsSignature &&
      unreadPhrases.some(p => p.id === alreadyPrefetched.phrase.id && p.category === alreadyPrefetched.phrase.category)
    ) {
      return;
    }

    const nextTargetPhrase = pickTargetPhrase(unreadPhrases, sortOrder);
    let cancelled = false;

    const apiUrl = `${API_BASE_URL}/get-phrase?id=${nextTargetPhrase.id}&category=${encodeURIComponent(nextTargetPhrase.category)}&repeatCount=${repeatCount}&speechRate=${encodeURIComponent(speechRate)}&lang=${lang}&voiceId=${encodeURIComponent(voiceId)}&announceCategory=${announceCategory}`;

    fetch(apiUrl)
      .then(response => response.json().then(data => ({ ok: response.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled || !ok) return;
        prefetchedNextRef.current = { phrase: nextTargetPhrase, data, settingsSignature };
      })
      .catch(error => {
        console.error("Error prefetching next phrase:", error);
      });

    return () => {
      cancelled = true;
    };
  }, [isReading, selectedCategories, allPhrasesForCategory, currentHistory, sortOrder, repeatCount, speechRate, lang, voiceId, isMultiCategorySelection]);

  const playCongratulationAudio = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/get-congratulation-audio?speechRate=${encodeURIComponent(speechRate)}&lang=${lang}&voiceId=${encodeURIComponent(voiceId)}`);
      const data = await response.json();
      if (response.ok) {
        await playAudio(data.audioData);
      }
    } catch {
      alert("送信に失敗しました。");
    }
  };


  // 現在読み上げ中の札の結果（経過時間・難易度・答え）を確定し、フェードアウト
  // 演出を経て結果画面へ切り替える。通常は「次の札」押下時（playKarutaInternal）に
  // しか呼ばれないが、クイズ大会モードで早押しが正解と判定された時点（issue #600）
  // にも即座に呼ばれる。これにより、経過時間は「正解が出るまで」で確定し、結果画面
  // （答え表示）も「次の札」を待たずに即座に切り替わる。呼び出し後にstartTimeRef.current
  // をnullへ戻すため、後から「次の札」が押されてplayKarutaInternalが実行されても
  // この結果確定処理は再実行されない（二重計測・上書きの防止）
  const revealCurrentResult = async (winner) => {
    const targetPhrase = currentPhrase;
    if (!startTimeRef.current || !targetPhrase) return;

    const elapsedTime = (Date.now() - startTimeRef.current) / 1000;
    startTimeRef.current = null;

    setHistoryByCategory(prev => {
      const newHistory = { ...prev };
      if (newHistory[categoryKey] && newHistory[categoryKey].length > 0) {
        const updatedCategoryHistory = [...newHistory[categoryKey]];
        const lastReadPhrase = updatedCategoryHistory[0];
        if (lastReadPhrase.id === targetPhrase.id && lastReadPhrase.category === targetPhrase.category) {
          updatedCategoryHistory[0] = { ...lastReadPhrase, elapsedTime: elapsedTime.toFixed(2) };
          newHistory[categoryKey] = updatedCategoryHistory;
        }
      }
      return newHistory;
    });

    const totalCount = allPhrasesForCategory.filter(p => p.category === targetPhrase.category).length || 1;
    const historyCount = currentHistory.filter(p => p.category === targetPhrase.category).length || 1;
    const remainingCount = Math.max(1, totalCount - (historyCount - 1));
    let difficulty = elapsedTime / remainingCount;

    if (!isFinite(difficulty) || isNaN(difficulty)) {
      difficulty = 0;
    }

    if (targetPhrase.id && targetPhrase.category && isFinite(elapsedTime) && !isNaN(elapsedTime)) {
      const isFast = targetPhrase.averageTime > 0 && elapsedTime < targetPhrase.averageTime;

      nextContentRef.current = {
        type: "result",
        content: { time: elapsedTime, difficulty, isFast, answer: targetPhrase.answer, winner: winner ?? null },
      };

      // 結果表示のフェード完了を待ってから次の札の取得・再生に進む。
      // 待たずに次の札をすぐキューへ入れると、次の札側のフリップ完了待ち
      // （animationResolveRef）をこの結果表示のフェード完了が誤って解決して
      // しまい、次の札の表示が中断される不具合があったため、明示的に区切る。
      const resultFadePromise = new Promise(resolve => {
        animationResolveRef.current = resolve;
      });
      setIsFadingOut(true);

      fetch(`${API_BASE_URL}/record-time`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: targetPhrase.id,
          category: targetPhrase.category,
          time: elapsedTime,
          difficulty: difficulty,
        }),
      }).catch((error) => {
        console.error("Error recording time:", error);
      });

      await resultFadePromise;
    }
  };

  const playKarutaInternal = async () => {
    await revealCurrentResult();

    if (selectedCategories.length === 0 || allPhrasesForCategory.length === 0) return;

    try {
      const readKeys = new Set(currentHistory.map(p => `${p.category}:${p.id}`));
      let unreadPhrases = allPhrasesForCategory.filter(p => !readKeys.has(`${p.category}:${p.id}`));

      if (unreadPhrases.length === 0) {
        setIsAllRead(true);
        await playCongratulationAudio();
        return;
      }

      const announceCategory = isMultiCategorySelection;
      const settingsSignature = JSON.stringify({ repeatCount, speechRate, lang, voiceId, announceCategory, sortOrder });
      const prefetched = prefetchedNextRef.current;
      let targetPhrase;
      let data;

      if (
        prefetched &&
        prefetched.settingsSignature === settingsSignature &&
        unreadPhrases.some(p => p.id === prefetched.phrase.id && p.category === prefetched.phrase.category)
      ) {
        // プリフェッチ済みの音声データをそのまま使い、取得待ちをスキップする
        targetPhrase = prefetched.phrase;
        data = prefetched.data;
        prefetchedNextRef.current = null;
      } else {
        targetPhrase = pickTargetPhrase(unreadPhrases, sortOrder);

        const apiUrl = `${API_BASE_URL}/get-phrase?id=${targetPhrase.id}&category=${encodeURIComponent(targetPhrase.category)}&repeatCount=${repeatCount}&speechRate=${encodeURIComponent(speechRate)}&lang=${lang}&voiceId=${encodeURIComponent(voiceId)}&announceCategory=${announceCategory}`;
        const response = await fetch(apiUrl);
        data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Fetch failed");
        }
      }

      // クイズ大会モード（issue #498）: このデータの取得に実際に使った設定を音声と一緒に
      // 保持しておき、後で参加者へブロードキャストする際もこの値を使う。読み上げ開始まで
      // 数秒の遅延があり、その間に管理者が設定を変更すると、ブロードキャスト時点の最新設定を
      // 読むと「管理者が実際に聞いている音声」とズレてしまうため
      setAudioQueue(prev => [...prev, {
        phraseData: data,
        audioData: data.audioData,
        playbackSettings: { repeatCount, speechRate, lang, voiceId, announceCategory },
      }]);

    } catch (error) {
      console.error("Error fetching phrase:", error);
      alert("通信エラーが発生しました: " + error.message);
    }
  };

  const playKaruta = async () => {
    if (playKarutaInFlightRef.current) return;
    playKarutaInFlightRef.current = true;
    setLoading(true);

    try {
      await playKarutaInternal();
    } finally {
      setLoading(false);
      playKarutaInFlightRef.current = false;
    }
  };

  // 自動読み上げモード：札の読み上げが完了し「次の札」を待っている状態
  // （手動なら次の札ボタンを押すタイミング）で一定時間経過したら自動で次へ進む。
  // このアプリでは「次の札」への1回の操作が、直前の札の結果表示と次の札の
  // 読み上げ開始を両方まとめて行う設計になっているため、result表示中ではなく
  // 直前の札のphrase表示中（読み上げ完了後の待機状態）を起点にする。
  useEffect(() => {
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }

    if (!autoAdvance || isAllRead || isReading || loading || displayContent.type !== "phrase") {
      return;
    }

    autoAdvanceTimeoutRef.current = setTimeout(() => {
      autoAdvanceTimeoutRef.current = null;
      playKaruta();
    }, autoAdvanceInterval * 1000);

    return () => {
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
        autoAdvanceTimeoutRef.current = null;
      }
    };
    // playKarutaは毎レンダーで再生成される関数であり、選択カテゴリや読み上げ設定
    // （sortOrder/repeatCount/speechRate/lang等）をクロージャで参照している。
    // playKaruta自体を依存配列に含めると無関係な再レンダーでもタイマーが
    // 再設定されてしまうため、代わりにplayKarutaが参照する状態を依存配列に
    // 列挙する（プリフェッチ用useEffectと同じ考え方）。これにより待機中に
    // 設定が変わった場合も最新の設定でタイマーが張り直される
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    autoAdvance,
    autoAdvanceInterval,
    displayContent,
    isReading,
    loading,
    isAllRead,
    selectedCategories,
    allPhrasesForCategory,
    currentHistory,
    sortOrder,
    repeatCount,
    speechRate,
    lang,
    isMultiCategorySelection,
  ]);

  const repeatPhrase = async () => {
    const target = detailPhrase || currentPhrase;
    if (target && target.audioData) {
        setAudioQueue(prev => [...prev, { phraseData: null, audioData: target.audioData }]);
    }
  };

  const stopReading = () => {
    if (!isReading) return;

    // playNextInQueue内のawaitチェーンを、次の工程（本編読み上げ・フェード）に
    // 進ませずに打ち切るためのフラグ
    stopRequestedRef.current = true;

    if (currentAudioRef.current) {
      const { audio, resolve } = currentAudioRef.current;
      audio.pause();
      currentAudioRef.current = null;
      resolve();
    }

    if (flipTimeoutRef.current) {
      clearTimeout(flipTimeoutRef.current);
      flipTimeoutRef.current = null;
    }

    if (animationResolveRef.current) {
      animationResolveRef.current();
      animationResolveRef.current = null;
    }

    // 中断された読み上げの計測を、次回の記録に誤って持ち越さないようにする
    startTimeRef.current = null;

    setIsFadingOut(false);
    nextContentRef.current = { type: "initial" };
    setDisplayContent({ type: "initial" });
    setAudioQueue([]);
    setIsReading(false);
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
    quizRoomParticipants,
    quizRoomConnectionStatus,
    reconnectQuizRoom,
    resetQuizRoomPoints,
    createQuizRoom,
    joinQuizRoom,
    judgeQuizRoomBuzz,
  } = useQuizRoomAdmin({
    view,
    selectedCategories,
    displayContent,
    repeatCount,
    speechRate,
    lang,
    voiceId,
    isMultiCategorySelection,
    setView,
    revealCurrentResult,
  });

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

  // ラウンドが切り替わったら「取った人」の選択状態をリセットする
  // （もう一度再生（phraseDataなしのキュー投入）ではcurrentPhraseが変わらないため反応しない）。
  // レンダー中のstate調整パターン（react-hooks/set-state-in-effect対策）
  if (currentPhrase !== lastPhraseForTakenByReset) {
    setLastPhraseForTakenByReset(currentPhrase);
    setCurrentRoundTakenBy(null);
  }

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
    setCurrentPhrase(null);
    setDetailPhraseId(null);
    setDisplayContent({ type: "initial" });
    setIsAllRead(false);
    setIsFadingOut(false);
  };

  const restartCategory = () => {
    setHistoryByCategory(prev => ({
      ...prev,
      [categoryKey]: []
    }));
    setScoresByCategory(prev => ({
      ...prev,
      [categoryKey]: {}
    }));
    setCurrentPhrase(null);
    setDisplayContent({ type: "initial" });
    setIsAllRead(false);
    setIsFadingOut(false);
  };

  const addPlayer = () => {
    const trimmed = newPlayerName.trim();
    if (!trimmed || players.includes(trimmed) || players.length >= MAX_PLAYERS) return;
    setPlayers(prev => [...prev, trimmed]);
    setNewPlayerName("");
  };

  const removePlayer = (name) => {
    setPlayers(prev => prev.filter(p => p !== name));
    setScoresByCategory(prev => {
      const next = {};
      for (const [catKey, scores] of Object.entries(prev)) {
        const catScores = { ...scores };
        delete catScores[name];
        next[catKey] = catScores;
      }
      return next;
    });
  };

  // 取った人を記録する（同じ人を再度タップした場合は取り消し扱いにする）
  const recordTaken = (name) => {
    if (!currentPhrase) return;
    setScoresByCategory(prev => {
      const catScores = { ...(prev[categoryKey] || {}) };
      if (currentRoundTakenBy) {
        catScores[currentRoundTakenBy] = Math.max(0, (catScores[currentRoundTakenBy] || 0) - 1);
      }
      if (name !== currentRoundTakenBy) {
        catScores[name] = (catScores[name] || 0) + 1;
      }
      return { ...prev, [categoryKey]: catScores };
    });
    setCurrentRoundTakenBy(prev => (prev === name ? null : name));
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
      const currentCount = prev.reduce((total, name) => {
        const info = categories.find(c => c.name === name);
        return total + (info?.count || 0);
      }, 0);
      if (currentCount + (catInfo?.count || 0) > MAX_EFUDA_PRINT_CARDS) {
        return prev;
      }
      return [...prev, cat];
    });
  };

  const handleDecideClick = () => {
    if (draftCategories.length === 0) return;
    setShowConfirmModal(true);
  };

  const confirmCategory = () => {
    setSelectedCategories(draftCategories);
    setDraftCategories([]);
    setShowConfirmModal(false);
    setView("game");
  };

  const cancelCategory = () => {
    setShowConfirmModal(false);
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
        setView={setView}
        selectedCategories={selectedCategories}
        allPhrasesForCategory={allPhrasesForCategory}
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
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        uniqueCategories={uniqueCategories}
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
    return <QuizRoomView setView={setView} wsBaseUrl={WS_BASE_URL} />;
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
          resetQuizRoomPoints={resetQuizRoomPoints}
        />
        {/* issue #613: 早押し判定モーダルはこの画面を開いている間も表示する
            （以前はゲーム画面のレンダー内にしか存在せず、この画面滞在中は
            参加者が早押ししても管理者が気づけなかった） */}
        <QuizRoomBuzzJudgmentModal
          buzzedBy={quizRoomBuzzedBy}
          answer={currentPhrase?.answer}
          onJudge={judgeQuizRoomBuzz}
        />
      </>
    );
  }

  if (selectedCategories.length === 0 && !division) {
    return (
      <div className="container py-5 mx-auto">
        <header className="text-center mb-5">
          <img src="favicon.png" alt="かるたのアイコン" className="mb-4" style={{ width: "120px", height: "auto" }} />
          <h1 className="display-4 fw-bold">かるた読み上げアプリ</h1>
        </header>

        <main className="category-selection-container p-4 mx-auto mb-5" style={{ maxWidth: "600px" }}>
          <h2 className="h4 text-center mb-4 text-dark">どなた向けに遊びますか？</h2>
          <div className="d-flex flex-wrap gap-3 justify-content-center">
            <button
              onClick={() => selectDivision("kids")}
              className="btn btn-lg px-4 py-3 fw-bold rounded-pill shadow-sm btn-karuta"
            >
              こども向け
            </button>
            <button
              onClick={() => selectDivision("engineer")}
              className="btn btn-lg px-4 py-3 fw-bold rounded-pill shadow-sm btn-karuta"
            >
              エンジニア向け
            </button>
          </div>
        </main>

        <div className="text-center d-flex flex-column gap-2">
          <button onClick={() => setView("all-phrases")} className="btn btn-link text-decoration-none text-muted">
            全札一覧を見る →
          </button>
          <button onClick={() => setView("comments")} className="btn btn-link text-decoration-none text-muted small">
            指摘された内容を確認する
          </button>
          <button onClick={() => setView("changelog")} className="btn btn-link text-decoration-none text-muted small">
            更新履歴を見る
          </button>
          <button onClick={() => setView("quiz-room")} className="btn btn-link text-decoration-none text-muted small">
            クイズ大会に参加する
          </button>
        </div>

        {openQuizRooms.length > 0 && (
          <div className="mx-auto mt-4" style={{ maxWidth: "400px" }}>
            <p className="text-muted small text-center mb-2">開設中のクイズ大会ルーム</p>
            <div className="list-group shadow-sm rounded">
              {openQuizRooms.map((room) => (
                <button
                  key={room.roomId}
                  onClick={() => joinQuizRoom(room.roomId)}
                  className="list-group-item list-group-item-action d-flex align-items-center justify-content-between"
                >
                  <span className="fw-bold notranslate">{room.roomId}</span>
                  <span className="text-muted small">{room.category || "開始前"}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (selectedCategories.length === 0) {
    return (
      <div className="container py-5 mx-auto">
      <header className="text-center mb-5">
        <img src="favicon.png" alt="かるたのアイコン" className="mb-4" style={{ width: "120px", height: "auto" }} />
        <h1 className="display-4 fw-bold">かるた読み上げアプリ</h1>
      </header>

      <main className="category-selection-container p-4 mx-auto mb-5" style={{ maxWidth: "600px" }}>
        <div className="d-flex justify-content-start mb-3">
          <button onClick={goBackToDivisionSelect} className="btn btn-sm btn-outline-secondary rounded-pill">← 戻る</button>
        </div>
        <h2 className="h4 text-center mb-4 text-dark">
          かるたの種類を選んでね{division === "engineer" ? "（複数選択可）" : ""}
        </h2>
        <div className="d-flex flex-wrap gap-3 justify-content-center">
            {categories.length === 0 ? (
              <div className="text-success fw-bold p-3">読み込み中...</div>
            ) : categoriesForDivision.length === 0 ? (
              <div className="text-muted p-3">このかるたはまだありません。</div>
            ) : (
              categoriesForDivision.map(cat => {
                const isSelected = draftCategories.includes(cat.name);
                // 選択済みの解除は常に可能。未選択のものだけ、追加すると上限を超える場合に無効化する
                const wouldExceedCap = !isSelected && draftCardCount + (cat.count || 0) > MAX_EFUDA_PRINT_CARDS;
                return (
                  <button
                    key={cat.name}
                    onClick={() => toggleDraftCategory(cat.name)}
                    disabled={wouldExceedCap}
                    title={wouldExceedCap ? `印刷できる上限（${MAX_EFUDA_PRINT_CARDS}枚）を超えるため選択できません` : undefined}
                    className={`btn btn-lg px-4 py-3 fw-bold rounded-pill shadow-sm notranslate btn-karuta ${isSelected ? 'selected' : ''}`}
                    aria-pressed={isSelected}
                  >
                    {isSelected ? '✓ ' : ''}{cat.name}
                  </button>
                );
              })
            )}
          </div>
          {division === "engineer" && categoriesForDivision.length > 0 && (
            <div className="text-center mt-4">
              {draftCardCount > 0 && (
                <p className="text-muted small mb-2">
                  選択中の合計: {draftCardCount}枚 / 印刷可能な上限: {MAX_EFUDA_PRINT_CARDS}枚
                  {draftCardCount >= MAX_EFUDA_PRINT_CARDS && "（上限に達しました）"}
                </p>
              )}
              <button
                onClick={handleDecideClick}
                disabled={draftCategories.length === 0}
                className="btn btn-success btn-lg px-5 py-2 fw-bold rounded-pill shadow"
              >
                決定（{draftCategories.length}件選択中）
              </button>
            </div>
          )}
        </main>

        <div className="text-center d-flex flex-column gap-2">
          <button onClick={() => setView("all-phrases")} className="btn btn-link text-decoration-none text-muted">
            全札一覧を見る →
          </button>
          <button onClick={() => setView("comments")} className="btn btn-link text-decoration-none text-muted small">
            指摘された内容を確認する
          </button>
          <button onClick={() => setView("changelog")} className="btn btn-link text-decoration-none text-muted small">
            更新履歴を見る
          </button>
        </div>

        {showConfirmModal && (
          <div className="modal fade show d-block modal-overlay" tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content rounded-4 border-0 shadow">
                <div className="modal-body p-5 text-center">
                  <h3 className="h5 mb-4 fw-bold">
                    {draftCategoriesRequiringPossessionCheck.length > 0
                      ? `${draftCategoriesRequiringPossessionCheck.map(cat => `「${cat}」`).join("")}をお手元に持っていますか？`
                      : "ゲームを開始しますか？"}
                  </h3>

                  <div className="d-flex gap-2 justify-content-center">
                    <button onClick={confirmCategory} className="btn btn-primary btn-lg px-4 rounded-pill shadow-sm fs-6">はい</button>
                    <button onClick={cancelCategory} className="btn btn-outline-secondary btn-lg px-4 rounded-pill fs-6">いいえ</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

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

  const renderResult = (result) => {
    if (!result) return null;
    return (
      <div className="yomifuda shadow-lg">
        <div className="d-flex flex-column justify-content-center align-items-center h-100">
          <div className="text-muted mb-2">所要時間</div>
          <div className="display-4 fw-bold text-dark mb-2">{result.time.toFixed(2)}<span className="fs-4">秒</span></div>
          
          {result.isFast && (
            <div className="badge bg-warning text-dark fs-6 mb-4 px-3 py-2 rounded-pill shadow-sm">
              🎉 平均より速い！
            </div>
          )}

          {division !== "kids" && (
            <>
              <div className="text-muted mb-2">難易度レベル</div>
              <div className="h3 fw-bold text-danger">{result.difficulty.toFixed(2)}</div>
            </>
          )}

          {result.answer && result.answer !== "-" && (
            <>
              <div className="text-muted mt-4 mb-2">答え</div>
              <div className="h4 fw-bold text-dark">{result.answer}</div>
            </>
          )}
        </div>
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
        {isAllRead ? (
          <>
            {confettiPieces.length > 0 && (
              <div className="confetti-container" aria-hidden="true">
                {confettiPieces.map(c => (
                  <span
                    key={c.id}
                    className="confetti-piece"
                    style={{ left: `${c.left}%`, animationDelay: `${c.delay}s`, animationDuration: `${c.duration}s` }}
                  >
                    {c.emoji}
                  </span>
                ))}
              </div>
            )}
            <div className="alert alert-success py-5 mb-5 shadow-sm rounded-4 border-0">
              <h2 className="display-5 fw-bold mb-3">🎉 おめでとう！ 🎉</h2>
              <p className="lead mb-4">すべての札を読み上げました！</p>
              {sessionSummary && (
                <div className="row justify-content-center g-3 mb-4 text-dark">
                  <div className="col-6 col-md-4">
                    <div className="bg-white rounded-3 shadow-sm p-3 h-100">
                      <div className="text-muted small">合計所要時間</div>
                      <div className="h4 fw-bold mb-0">{sessionSummary.totalTime.toFixed(2)}秒</div>
                    </div>
                  </div>
                  <div className="col-6 col-md-4">
                    <div className="bg-white rounded-3 shadow-sm p-3 h-100">
                      <div className="text-muted small">最速の札</div>
                      <div className="fw-bold text-truncate">{sessionSummary.fastest.phrase}</div>
                      <div className="small text-muted">{sessionSummary.fastest.elapsedTime}秒</div>
                    </div>
                  </div>
                  <div className="col-6 col-md-4">
                    <div className="bg-white rounded-3 shadow-sm p-3 h-100">
                      <div className="text-muted small">最も時間がかかった札</div>
                      <div className="fw-bold text-truncate">{sessionSummary.slowest.phrase}</div>
                      <div className="small text-muted">{sessionSummary.slowest.elapsedTime}秒</div>
                    </div>
                  </div>
                </div>
              )}
              {scoreSummary && (
                <div className="mb-4 text-dark">
                  <h3 className="h5 fw-bold mb-3">
                    {scoreSummary.winners.length === 1
                      ? `🏆 優勝: ${scoreSummary.winners[0]}`
                      : scoreSummary.winners.length > 1
                      ? `🏆 優勝: ${scoreSummary.winners.join('・')}（同点）`
                      : "取った札の記録はありません"}
                  </h3>
                  <div className="d-flex flex-wrap gap-2 justify-content-center">
                    {scoreSummary.entries.map(e => (
                      <div key={e.name} className="bg-white rounded-3 shadow-sm px-3 py-2">
                        <span className="fw-bold">{e.name}</span>: {e.count}枚
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <button onClick={restartCategory} className="btn btn-primary btn-lg px-5 rounded-pill shadow">もう一度最初から遊ぶ</button>
            </div>
          </>
        ) : (
          <>
            <div className={`yomifuda-container mb-4 ${isFadingOut ? 'fade-out' : 'fade-in'}`}>
              {displayContent.type === 'phrase' && renderPhrase(displayContent.content)}
              {displayContent.type === 'result' && renderResult(displayContent.content)}
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
              <button onClick={playKaruta} disabled={loading} className="btn btn-lg px-4 py-3 fw-bold rounded-pill shadow btn-karuta">
                {loading && <span className="spinner-border spinner-border-sm me-2"></span>}
                {loading ? "読み込み中..." : "次の札"}
              </button>
              <button onClick={repeatPhrase} disabled={isReading || !currentPhrase} className="btn btn-lg px-4 py-3 fw-bold rounded-pill border-3 border-dark bg-white text-dark shadow-sm">もう一度</button>
              <button onClick={stopReading} disabled={!isReading} className="btn btn-lg px-4 py-3 fw-bold rounded-pill border-3 border-danger bg-white text-danger shadow-sm">停止</button>
            </div>
          </>
        )}
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
        <section className="settings-container mb-4 p-3 mx-auto shadow-sm rounded-4 bg-light border" style={{ maxWidth: "500px" }}>
          <div className="mb-3 d-flex align-items-center justify-content-center gap-3 border-bottom pb-2">
            <span className="fw-bold text-dark small">テーマ:</span>
            <div className="btn-group btn-group-sm" role="group">
              <button onClick={() => setThemeSetting("system")} className={`btn ${themeSetting === "system" ? 'btn-dark' : 'btn-outline-dark'}`}>自動</button>
              <button onClick={() => setThemeSetting("light")} className={`btn ${themeSetting === "light" ? 'btn-dark' : 'btn-outline-dark'}`}>ライト</button>
              <button onClick={() => setThemeSetting("dark")} className={`btn ${themeSetting === "dark" ? 'btn-dark' : 'btn-outline-dark'}`}>ダーク</button>
            </div>
          </div>
          <div className="mb-3 d-flex align-items-center justify-content-center gap-3 border-bottom pb-2">
            <span className="fw-bold text-dark small">言語:</span>
            <div className="btn-group btn-group-sm" role="group">
              <button onClick={() => setLang("ja")} className={`btn ${lang === "ja" ? 'btn-dark' : 'btn-outline-dark'}`}>日本語</button>
              <button onClick={() => setLang("en")} className={`btn ${lang === "en" ? 'btn-dark' : 'btn-outline-dark'}`}>English</button>
            </div>
          </div>
          {lang === "ja" && (
            <div className="mb-3 d-flex align-items-center justify-content-center gap-3 border-bottom pb-2 flex-wrap">
              <span className="fw-bold text-dark small">声:</span>
              <div className="btn-group btn-group-sm" role="group">
                <button onClick={() => setVoiceId("Mizuki")} className={`btn ${voiceId === "Mizuki" ? 'btn-dark' : 'btn-outline-dark'}`}>Mizuki</button>
                <button onClick={() => setVoiceId("Takumi")} className={`btn ${voiceId === "Takumi" ? 'btn-dark' : 'btn-outline-dark'}`}>Takumi</button>
                <button onClick={() => setVoiceId("Kazuha")} className={`btn ${voiceId === "Kazuha" ? 'btn-dark' : 'btn-outline-dark'}`}>Kazuha</button>
                <button onClick={() => setVoiceId("Tomoko")} className={`btn ${voiceId === "Tomoko" ? 'btn-dark' : 'btn-outline-dark'}`}>Tomoko</button>
              </div>
            </div>
          )}
          <div className="mb-3 d-flex align-items-center justify-content-center gap-3 border-bottom pb-2">
            <span className="fw-bold text-dark small">順番:</span>
            <div className="btn-group btn-group-sm" role="group">
              <button onClick={() => setSortOrder("random")} className={`btn ${sortOrder === "random" ? 'btn-dark' : 'btn-outline-dark'}`}>ランダム</button>
              <button onClick={() => setSortOrder("easy")} className={`btn ${sortOrder === "easy" ? 'btn-dark' : 'btn-outline-dark'}`}>簡単</button>
              <button onClick={() => setSortOrder("hard")} className={`btn ${sortOrder === "hard" ? 'btn-dark' : 'btn-outline-dark'}`}>難しい</button>
            </div>
          </div>
          <div className="mb-3 d-flex align-items-center justify-content-center gap-3 border-bottom pb-2">
            <span className="fw-bold text-dark small">スピード:</span>
            <div className="btn-group btn-group-sm" role="group">
              <button onClick={() => setSpeechRate("70%")} className={`btn ${speechRate === "70%" ? 'btn-dark' : 'btn-outline-dark'}`}>ゆっくり</button>
              <button onClick={() => setSpeechRate("80%")} className={`btn ${speechRate === "80%" ? 'btn-dark' : 'btn-outline-dark'}`}>ふつう</button>
              <button onClick={() => setSpeechRate("100%")} className={`btn ${speechRate === "100%" ? 'btn-dark' : 'btn-outline-dark'}`}>はやい</button>
            </div>
          </div>
          <div className="mb-3 d-flex align-items-center justify-content-center gap-3 border-bottom pb-2">
            <span className="fw-bold text-dark small">回数:</span>
            <div className="btn-group btn-group-sm" role="group">
              <button onClick={() => setRepeatCount(1)} className={`btn ${repeatCount === 1 ? 'btn-dark' : 'btn-outline-dark'}`}>1回</button>
              <button onClick={() => setRepeatCount(2)} className={`btn ${repeatCount === 2 ? 'btn-dark' : 'btn-outline-dark'}`}>2回</button>
            </div>
          </div>
          <div className="d-flex align-items-center justify-content-center gap-3 flex-wrap">
            <span className="fw-bold text-dark small">自動で次へ:</span>
            <div className="btn-group btn-group-sm" role="group">
              <button onClick={() => setAutoAdvance(false)} className={`btn ${!autoAdvance ? 'btn-dark' : 'btn-outline-dark'}`}>オフ</button>
              <button onClick={() => setAutoAdvance(true)} className={`btn ${autoAdvance ? 'btn-dark' : 'btn-outline-dark'}`}>オン</button>
            </div>
            {autoAdvance && (
              <div className="btn-group btn-group-sm" role="group">
                <button onClick={() => setAutoAdvanceInterval(10)} className={`btn ${autoAdvanceInterval === 10 ? 'btn-dark' : 'btn-outline-dark'}`}>10秒</button>
                <button onClick={() => setAutoAdvanceInterval(20)} className={`btn ${autoAdvanceInterval === 20 ? 'btn-dark' : 'btn-outline-dark'}`}>20秒</button>
                <button onClick={() => setAutoAdvanceInterval(30)} className={`btn ${autoAdvanceInterval === 30 ? 'btn-dark' : 'btn-outline-dark'}`}>30秒</button>
              </div>
            )}
          </div>
        </section>
      <p className="text-muted small mb-4">履歴はこのタブを閉じるまで保持されます（リロードしても消えません）。</p>
      <div className="d-flex flex-wrap gap-2 justify-content-center mb-4">
        <button onClick={() => setView("print-efuda")} className="btn btn-outline-dark px-4 rounded-pill">絵札を印刷する</button>
        <button onClick={resetGame} className="btn btn-outline-dark px-4 rounded-pill">かるたの種類を選び直す</button>
      </div>
      {quizRoom ? (
        <div className="mb-4">
          {/* issue #614: 管理者側は従来connectionStatusを受け取ってすらおらず、
              切断されたことが画面のどこにも表示されなかった（切断に気づかず
              読み上げを進めると参加者に札が配信されない不具合があった）。
              接続状態が悪い場合のみ警告として表示し、平常時は表示を増やさない */}
          {quizRoomConnectionStatus !== "connected" && (
            <p className="text-danger small mb-2">
              <span>
                クイズ大会の接続状態: {CONNECTION_STATUS_LABEL[quizRoomConnectionStatus] || quizRoomConnectionStatus}
                （参加者に札が届いていない可能性があります）
              </span>
              {quizRoomConnectionStatus === "error" && (
                <button
                  type="button"
                  onClick={reconnectQuizRoom}
                  className="btn btn-sm btn-outline-danger rounded-pill ms-2"
                >
                  再接続
                </button>
              )}
            </p>
          )}
          <button
            type="button"
            onClick={() => setView("quiz-room-info")}
            className="btn btn-outline-dark px-4 rounded-pill mb-4"
          >
            ルーム情報を表示（クイズ大会モード）
          </button>
          <QuizRoomBuzzJudgmentModal
            buzzedBy={quizRoomBuzzedBy}
            answer={currentPhrase?.answer}
            onJudge={judgeQuizRoomBuzz}
          />
        </div>
      ) : (
        <div className="mb-4 d-flex flex-wrap gap-3 justify-content-center align-items-start">
          <div>
            <button
              type="button"
              onClick={createQuizRoom}
              disabled={creatingQuizRoom}
              className="btn btn-outline-dark px-4 rounded-pill"
            >
              {creatingQuizRoom ? "作成中..." : "クイズ大会のルームを作成する"}
            </button>
            {quizRoomCreateError && <p className="text-danger small">{quizRoomCreateError}</p>}
          </div>
          {division !== "kids" && (
            <div>
              <button
                type="button"
                onClick={() => setShowPlayerRegistration(prev => !prev)}
                className="btn btn-sm btn-outline-secondary rounded-pill px-3"
              >
                {showPlayerRegistration ? "参加者登録を閉じる" : players.length > 0 ? "参加者を編集する" : "取った人を記録する参加者を登録する"}
              </button>
              {showPlayerRegistration && (
                <div className="mt-3 mx-auto text-start" style={{ maxWidth: "360px" }}>
                  {players.length > 0 && (
                    <div className="d-flex flex-wrap gap-2 mb-2">
                      {players.map(name => (
                        <span key={name} className="badge bg-secondary d-flex align-items-center gap-1 py-2 px-3 fs-6">
                          {name}
                          <button
                            type="button"
                            onClick={() => removePlayer(name)}
                            className="btn-close btn-close-white"
                            style={{ fontSize: "0.6rem" }}
                            aria-label={`${name}を削除`}
                          ></button>
                        </span>
                      ))}
                    </div>
                  )}
                  {players.length < MAX_PLAYERS && (
                    <div className="d-flex gap-2">
                      <input
                        type="text"
                        value={newPlayerName}
                        onChange={(e) => setNewPlayerName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPlayer(); } }}
                        placeholder="名前を入力"
                        className="form-control"
                        maxLength={20}
                      />
                      <button type="button" onClick={addPlayer} disabled={!newPlayerName.trim()} className="btn btn-outline-primary">追加</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </footer>
    </div>
  );
}

export default App;
