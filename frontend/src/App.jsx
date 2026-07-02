import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import ReactMarkdown from "react-markdown";
import "./App.css";
import karutaImage from "./assets/karuta_inubou.png";
import changelogData from "./changelog.json";

const API_BASE_URL = "https://akmnirkx3m.execute-api.ap-northeast-1.amazonaws.com/dev";

const parseCategoriesParam = (value) => (value ? value.split(",").filter(Boolean).map(decodeURIComponent) : []);
const serializeCategoriesParam = (categories) => categories.map(encodeURIComponent).join(",");

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
  const [allComments, setAllComments] = useState([]);

  const [allPhrasesForCategory, setAllPhrasesForCategory] = useState([]);
  const [allPhrases, setAllPhrases] = useState([]); // 全札一覧用
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' }); // ソート設定
  const [filterCategory, setFilterCategory] = useState(''); // 全札一覧フィルタ
  const [currentPhrase, setCurrentPhrase] = useState(null);
  
  const [displayContent, setDisplayContent] = useState({ type: "initial" });
  const [isFadingOut, setIsFadingOut] = useState(false);
  const nextContentRef = useRef(null);
  const animationResolveRef = useRef(null);

  const [audioQueue, setAudioQueue] = useState([]);
  const [isReading, setIsReading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isAllRead, setIsAllRead] = useState(false);
  const [repeatCount, setRepeatCount] = useState(() => {
    return parseInt(localStorage.getItem("repeatCount") || "2", 10);
  });
  const [speechRate, setSpeechRate] = useState(() => {
    return localStorage.getItem("speechRate") || "80%";
  });
  const [lang, setLang] = useState(() => {
    return localStorage.getItem("lang") || "ja";
  });
  const [sortOrder, setSortOrder] = useState(() => {
    return localStorage.getItem("sortOrder") || "random";
  });
  const [historyByCategory, setHistoryByCategory] = useState({});
  
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [draftCategories, setDraftCategories] = useState([]);

  // コメント投稿用の状態
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  const flipTimeoutRef = useRef(null);
  const startTimeRef = useRef(null);

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

  const currentHistory = useMemo(() => {
    return categoryKey ? (historyByCategory[categoryKey] || []) : [];
  }, [categoryKey, historyByCategory]);

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
    if (!filterCategory) return sortedPhrases;
    return sortedPhrases.filter(p => p.category === filterCategory);
  }, [sortedPhrases, filterCategory]);

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

          if (selectedCategories.length > 0 && availableCategories.length > 0 && view === "game") {
            const availableNames = availableCategories.map(cat => cat.name);
            const stillValid = selectedCategories.filter(cat => availableNames.includes(cat));
            if (stillValid.length !== selectedCategories.length) {
              setSelectedCategories(stillValid);
            }
          }
        }
    } catch {
      alert("送信に失敗しました。");
    }
    };
    fetchCategories();
  }, [selectedCategories, view]);

  // カテゴリが選択されたら、選択中の全カテゴリの札IDリストを取得して結合する
  useEffect(() => {
    if (selectedCategories.length === 0) {
      setAllPhrasesForCategory([]);
      return;
    }

    const fetchPhrasesList = async () => {
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
    if (detailPhraseId) {
      const fetchDetail = async () => {
        try {
          const categoryParam = detailPhraseCategory ? `&category=${encodeURIComponent(detailPhraseCategory)}` : "";
          const response = await fetch(`${API_BASE_URL}/get-phrase?id=${detailPhraseId}${categoryParam}&repeatCount=${repeatCount}&speechRate=${encodeURIComponent(speechRate)}&lang=${lang}&announceCategory=${isMultiCategorySelection}`);
          const data = await response.json();
          if (response.ok) {
            setDetailPhrase(data);
          }
        } catch (error) {
          console.error("Error fetching phrase detail:", error);
        }
      };
      fetchDetail();
    } else {
      setDetailPhrase(null);
    }
  }, [detailPhraseId, detailPhraseCategory, repeatCount, speechRate, lang, isMultiCategorySelection]);

  // 指摘一覧の取得
  useEffect(() => {
    const fetchComments = async () => {
      if (view === "comments") {
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
  }, [view]);

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
      audio.onended = () => resolve();
      audio.onerror = (e) => reject(e);
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
      const { phraseData, audioData } = audioQueue[0];
  
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
      
      // 読み上げ開始タイミングで計測開始
      startTimeRef.current = Date.now();

      let animationPromise = Promise.resolve();

      if (phraseData) {
        if (flipTimeoutRef.current) {
          clearTimeout(flipTimeoutRef.current);
          flipTimeoutRef.current = null;
        }

        animationPromise = new Promise(resolve => {
          animationResolveRef.current = resolve;
        });

        // 3秒待機してからフェードアニメーションを開始
        flipTimeoutRef.current = setTimeout(() => {
          nextContentRef.current = { type: "phrase", content: phraseData };
          setIsFadingOut(true);
        }, 3000); // 待機時間
      }
      
      await playAudio(audioData).catch(e => console.error("Audio playback failed:", e));
      
      await animationPromise;

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
  }, [audioQueue, isReading, playAudio, playIntroSound, categoryKey, historyByCategory]);

  const playKaruta = async () => {
    const targetPhrase = currentPhrase;
    
    if (startTimeRef.current && targetPhrase) {
      const elapsedTime = (Date.now() - startTimeRef.current) / 1000;
      
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
          content: { time: elapsedTime, difficulty, isFast, answer: targetPhrase.answer },
        };
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
        });
      }
      startTimeRef.current = null;
    }

    if (selectedCategories.length === 0 || allPhrasesForCategory.length === 0) return;
    
    setLoading(true);
    
    try {
      const readKeys = new Set(currentHistory.map(p => `${p.category}:${p.id}`));
      let unreadPhrases = allPhrasesForCategory.filter(p => !readKeys.has(`${p.category}:${p.id}`));

      if (unreadPhrases.length === 0) {
        setIsAllRead(true);
        await playCongratulationAudio();
        return;
      }

      let targetPhrase;
      if (sortOrder === "easy") {
        unreadPhrases.sort((a, b) => (a.averageDifficulty || 0) - (b.averageDifficulty || 0));
        targetPhrase = unreadPhrases[0];
      } else if (sortOrder === "hard") {
        unreadPhrases.sort((a, b) => (b.averageDifficulty || 0) - (a.averageDifficulty || 0));
        targetPhrase = unreadPhrases[0];
      } else {
        const randomIndex = Math.floor(Math.random() * unreadPhrases.length);
        targetPhrase = unreadPhrases[randomIndex];
      }

      const announceCategory = isMultiCategorySelection;
      const apiUrl = `${API_BASE_URL}/get-phrase?id=${targetPhrase.id}&category=${encodeURIComponent(targetPhrase.category)}&repeatCount=${repeatCount}&speechRate=${encodeURIComponent(speechRate)}&lang=${lang}&announceCategory=${announceCategory}`;
      const response = await fetch(apiUrl);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || "Fetch failed");
      }
      
      setAudioQueue(prev => [...prev, { phraseData: data, audioData: data.audioData }]);

    } catch (error) {
      console.error("Error fetching phrase:", error);
      alert("通信エラーが発生しました: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const repeatPhrase = async () => {
    const target = detailPhrase || currentPhrase;
    if (target && target.audioData) {
        setAudioQueue(prev => [...prev, { phraseData: null, audioData: target.audioData }]);
    }
  };

  const playCongratulationAudio = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/get-congratulation-audio?speechRate=${encodeURIComponent(speechRate)}&lang=${lang}`);
      const data = await response.json();
      if (response.ok) {
        await playAudio(data.audioData);
      }
    } catch {
      alert("送信に失敗しました。");
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (selectedCategories.length > 0) {
      params.set("category", serializeCategoriesParam(selectedCategories));
    } else {
      params.delete("category");
    }

    if (division) {
      params.set("division", division);
    } else {
      params.delete("division");
    }

    if (detailPhraseId) {
      params.set("id", detailPhraseId);
    } else {
      params.delete("id");
    }

    if (view === "comments" || view === "changelog" || view === "all-phrases" || view === "print-efuda") {
      params.set("view", view);
    } else {
      params.delete("view");
    }

    const newSearch = params.toString();
    const url = newSearch ? `?${newSearch}` : window.location.pathname;
    window.history.pushState({}, "", url);
  }, [selectedCategories, division, detailPhraseId, view]);

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const category = params.get("category");
      setSelectedCategories(parseCategoriesParam(category));
      setDivision(params.get("division") || null);
      setDetailPhraseId(params.get("id"));
      setView(params.get("view") || "game");
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

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
    localStorage.setItem("repeatCount", repeatCount.toString());
  }, [repeatCount]);

  useEffect(() => {
    localStorage.setItem("speechRate", speechRate);
  }, [speechRate]);

  useEffect(() => {
    localStorage.setItem("lang", lang);
  }, [lang]);

  useEffect(() => {
    localStorage.setItem("sortOrder", sortOrder);
  }, [sortOrder]);

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
    setCurrentPhrase(null);
    setDisplayContent({ type: "initial" });
    setIsAllRead(false);
    setIsFadingOut(false);
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
      setDraftCategories(prev => (prev.includes(cat) ? [] : [cat]));
      return;
    }
    setDraftCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
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
      <div className="container py-4 mx-auto">
        <header className="text-center mb-4 border-bottom pb-3">
          <div className="d-flex justify-content-between align-items-center">
            <button onClick={closeDetail} className="btn btn-sm btn-outline-secondary rounded-pill">← 戻る</button>
            <h1 className="h4 m-0 fw-bold notranslate">{detailPhrase ? detailPhrase.category : (detailPhraseCategory || categoryLabel)} の詳細</h1>
            <div style={{ width: "60px" }}></div>
          </div>
        </header>

        <main className="text-center py-4">
          {!detailPhrase ? (
            <div className="p-5 text-muted">読み込み中...</div>
          ) : (
            <div className="mx-auto" style={{ maxWidth: "600px" }}>
              <div className="d-flex justify-content-center mb-4">
                <div className="yomifuda-container mb-4" onClick={repeatPhrase} role="button">
                  <div className="yomifuda shadow-lg">
                    <div className="yomifuda-kana"><span>{detailPhrase.kana || (detailPhrase.phrase && detailPhrase.phrase[0])}</span></div>
                    <div className="yomifuda-phrase">{detailPhrase.phrase}</div>
                    {detailPhrase.phrase_en && <div className="yomifuda-phrase-en">{detailPhrase.phrase_en}</div>}
                    {detailPhrase.level !== "-" && <div className="yomifuda-level fw-bold">レベル: {detailPhrase.level}</div>}
                  </div>
                </div>
              </div>
              <div className="mb-4 text-muted">
                <p>読み上げ回数: {detailPhrase.readCount || 0}回</p>
                <p>平均時間: {(detailPhrase.averageTime || 0).toFixed(2)}秒</p>
                <p>難易度レベル: {(detailPhrase.averageDifficulty || 0).toFixed(2)}</p>
              </div>

              {detailPhrase.answer && detailPhrase.answer !== "-" && (
                <div className="mb-4">
                  <div className="text-muted mb-2">答え</div>
                  <div className="h4 fw-bold text-dark">{detailPhrase.answer}</div>
                </div>
              )}
              <div className="mb-5">
                <button 
                  onClick={repeatPhrase} 
                  className="btn btn-lg px-5 py-3 fw-bold rounded-pill shadow btn-karuta"
                >
                  読み上げる
                </button>
              </div>

            <section className="comment-form-container text-start p-4 bg-light rounded-4 shadow-sm border">
              <h2 className="h5 fw-bold mb-3 text-dark">かるたの誤りを指摘する</h2>
              <form onSubmit={postComment}>
                  <div className="mb-3">
                    <textarea 
                      className="form-control rounded-3" 
                      rows="3" 
                      placeholder="例：かなが間違っている、フレーズが違うなど"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      required
                    ></textarea>
                  </div>
                  <button type="submit" disabled={postingComment} className="btn btn-danger w-100 rounded-pill py-2 fw-bold shadow-sm">
                    {postingComment ? "送信中..." : "指摘内容を送信する"}
                  </button>
                </form>
              </section>
            </div>
          )}
        </main>
      </div>
    );
  }

  if (view === "print-efuda") {
    const getEfudaText = (p) => (p.answer && p.answer !== "-") ? p.answer : p.phrase;

    return (
      <div className="container efuda-print-container py-4 mx-auto">
        <header className="text-center mb-4 border-bottom pb-3 no-print">
          <div className="d-flex justify-content-between align-items-center">
            <button onClick={() => setView("game")} className="btn btn-sm btn-outline-secondary rounded-pill">← 戻る</button>
            <h1 className="h4 m-0 fw-bold notranslate">{categoryLabel}の絵札印刷</h1>
            <div style={{ width: "60px" }}></div>
          </div>
        </header>

        {selectedCategories.length === 0 ? (
          <p className="text-muted text-center py-5 no-print">カテゴリを選択してください。</p>
        ) : allPhrasesForCategory.length === 0 ? (
          <p className="text-muted text-center py-5 no-print">読み込み中...</p>
        ) : (
          <>
            <div className="no-print text-center mb-4">
              <p className="text-muted small mb-3">
                用紙: <a href="https://www.a-one.co.jp/product/search/detail.php?id=51677" target="_blank" rel="noopener noreferrer">エーワン マルチカード（マイクロミシン・厚口）A4・10面用</a><br />
                印刷ダイアログで「用紙サイズ: A4」「余白: なし」「拡大縮小: 実際のサイズ(100%)」「ヘッダーとフッター: オフ」に設定してください。
              </p>
              <button onClick={() => window.print()} className="btn btn-lg px-5 py-2 fw-bold rounded-pill shadow btn-karuta">
                印刷する
              </button>
            </div>

            <div className="efuda-print-area">
              {efudaPages.map((page, pageIndex) => (
                <div className="efuda-page" key={pageIndex}>
                  <div className="efuda-grid">
                    {Array.from({ length: EFUDA_PER_PAGE }).map((_, slotIndex) => {
                      const p = page.items[slotIndex];
                      return (
                        <div className="efuda-card" key={slotIndex}>
                          {p && (
                            <>
                              {isMultiCategorySelection && (
                                <p className="no-print text-muted small efuda-card-category">{p.category}</p>
                              )}
                              <div className="efuda-card-kana">{p.kana}</div>
                              <div className="efuda-card-text">{getEfudaText(p)}</div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  if (view === "all-phrases") {
    return (
      <div className="container py-4 mx-auto">
        <header className="text-center mb-4 border-bottom pb-3">
          <div className="d-flex justify-content-between align-items-center">
            <button onClick={() => { setView("game"); setSelectedCategories([]); setFilterCategory(''); }} className="btn btn-sm btn-outline-secondary rounded-pill">← 戻る</button>
            <h1 className="h2 fw-bold m-0 text-dark">全札一覧</h1>
            <div style={{ width: "60px" }}></div>
          </div>
        </header>

        <main className="mx-auto" style={{ maxWidth: "1200px" }}>
          {allPhrases.length === 0 ? (
            <p className="text-muted text-center py-5">読み込み中...</p>
          ) : (
            <div className="all-phrases-scroll-container">
              <div className="mb-3 d-flex flex-wrap align-items-center gap-2">
                <span className="text-muted small fw-bold me-1">種別:</span>
                <button
                  className={`btn btn-sm rounded-pill ${filterCategory === '' ? 'btn-dark' : 'btn-outline-secondary'}`}
                  onClick={() => setFilterCategory('')}
                >
                  すべて ({allPhrases.length})
                </button>
                {uniqueCategories.map(cat => (
                  <button
                    key={cat}
                    className={`btn btn-sm rounded-pill notranslate ${filterCategory === cat ? 'btn-karuta' : 'btn-outline-secondary'}`}
                    onClick={() => setFilterCategory(cat)}
                  >
                    {cat} ({categoryCount[cat] || 0})
                  </button>
                ))}
              </div>
              <div className="all-phrases-table-container shadow-sm rounded-4 bg-white">
                <table className="table table-hover mb-0">
                  <thead className="table-light">
                    <tr>
                      <th scope="col" className="ps-4" style={{ cursor: "pointer" }} onClick={() => handleSort('category')}>
                        カテゴリ{renderSortArrow('category')}
                      </th>
                      <th scope="col" style={{ cursor: "pointer" }} onClick={() => handleSort('phrase')}>
                        読み札{renderSortArrow('phrase')}
                      </th>
                      <th scope="col" style={{ cursor: "pointer" }} onClick={() => handleSort('answer')}>
                        答え{renderSortArrow('answer')}
                      </th>
                      <th scope="col" style={{ cursor: "pointer" }} onClick={() => handleSort('level')}>
                        Lv{renderSortArrow('level')}
                      </th>
                      <th scope="col" style={{ cursor: "pointer" }} onClick={() => handleSort('readCount')}>
                        回数{renderSortArrow('readCount')}
                      </th>
                      <th scope="col" style={{ cursor: "pointer" }} onClick={() => handleSort('averageTime')}>
                        平均時間{renderSortArrow('averageTime')}
                      </th>
                      <th scope="col" style={{ cursor: "pointer" }} onClick={() => handleSort('averageDifficulty')}>
                        難易度{renderSortArrow('averageDifficulty')}
                      </th>
                      <th scope="col" className="text-end pe-4">詳細</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPhrases.map((p) => (
                      <tr key={`${p.category}-${p.id}`} style={{ cursor: "pointer" }} onClick={() => openDetail(p.id, p.category)}>
                        <td className="ps-4 text-muted small">{p.category}</td>
                        <td className="fw-bold">{p.phrase}</td>
                        <td>{p.answer && p.answer !== "-" ? p.answer : ""}</td>
                        <td>{p.level !== "-" ? p.level : ""}</td>
                        <td>{p.readCount || 0}</td>
                        <td>{(p.averageTime || 0).toFixed(2)}s</td>
                        <td>{(p.averageDifficulty || 0).toFixed(2)}</td>
                        <td className="text-end pe-4 text-primary">→</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  if (view === "comments") {
    return (
      <div className="container py-4 mx-auto">
        <header className="text-center mb-5 border-bottom pb-3">
          <div className="d-flex justify-content-between align-items-center">
            <button onClick={() => setView("game")} className="btn btn-sm btn-outline-secondary rounded-pill">← 戻る</button>
            <h1 className="h2 fw-bold m-0 text-dark">指摘された内容一覧</h1>
            <div style={{ width: "60px" }}></div>
          </div>
        </header>

        <main className="mx-auto" style={{ maxWidth: "800px" }}>
          {allComments.length === 0 ? (
            <p className="text-muted text-center py-5">まだ指摘はありません。</p>
          ) : (
            <div className="row g-4">
              {allComments.map(c => (
                <div key={c.id} className="col-12">
                  <div className="card border-0 shadow-sm rounded-4 h-100 bg-white">
                    <div className="card-body p-4">
                      <div className="d-flex justify-content-between align-items-start mb-3">
                        <span className="badge bg-secondary rounded-pill">{c.category}</span>
                        <small className="text-muted">{new Date(c.createdAt).toLocaleString()}</small>
                      </div>
                      <h5 className="card-title fw-bold text-dark mb-3">「{c.phrase}」</h5>
                      <div className="p-3 bg-light rounded-3 border-start border-4 border-danger">
                        <p className="card-text mb-0 text-dark">{c.comment}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    );
  }

  if (view === "changelog") {
    return (
      <div className="container py-4 mx-auto">
        <header className="text-center mb-5 border-bottom pb-3">
            <div className="d-flex justify-content-between align-items-center">
            <button onClick={() => setView("game")} className="btn btn-sm btn-outline-secondary rounded-pill">← 戻る</button>
            <h1 className="h2 fw-bold m-0 text-dark">更新履歴</h1>
            <div style={{ width: "60px" }}></div>
            </div>
        </header>
        <main className="mx-auto" style={{ maxWidth: "800px" }}>
            {changelogData.length === 0 ? (
                <p className="text-muted text-center py-5">履歴はありません。</p>
            ) : (
                <div className="d-flex flex-column gap-4">
                    {changelogData.map((entry, index) => (
                        <div key={index} className="card border-0 shadow-sm rounded-4 bg-white">
                            <div className="card-header bg-transparent border-0 pt-4 px-4 pb-0 d-flex justify-content-between align-items-center">
                                <h2 className="h5 fw-bold m-0">v{entry.version}</h2>
                                <small className="text-muted">{entry.date}</small>
                            </div>
                            <div className="card-body p-4">
                                <ReactMarkdown>{entry.body}</ReactMarkdown>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </main>
      </div>
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
        </div>
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
              categoriesForDivision.map(cat => (
                <button
                  key={cat.name}
                  onClick={() => toggleDraftCategory(cat.name)}
                  className={`btn btn-lg px-4 py-3 fw-bold rounded-pill shadow-sm notranslate btn-karuta ${draftCategories.includes(cat.name) ? 'selected' : ''}`}
                  aria-pressed={draftCategories.includes(cat.name)}
                >
                  {draftCategories.includes(cat.name) ? '✓ ' : ''}{cat.name}
                </button>
              ))
            )}
          </div>
          {categoriesForDivision.length > 0 && (
            <div className="text-center mt-4">
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
                    {draftCategories.map(cat => `「${cat}」`).join("")}をお手元に持っていますか？
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
        <div className="yomifuda" onClick={repeatPhrase} role="button" aria-label="もう一度">
            <div className="yomifuda-kana"><span>{phrase.kana || (phrase.phrase && phrase.phrase[0])}</span></div>
            <div className="yomifuda-phrase">{phrase.phrase}</div>
            {phrase.level !== "-" && <div className="yomifuda-level fw-bold">レベル: {phrase.level}</div>}
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
          
          <div className="text-muted mb-2">難易度レベル</div>
          <div className="h3 fw-bold text-danger">{result.difficulty.toFixed(2)}</div>

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
      </header>
      
      <main className="text-center">
        {isAllRead ? (
          <div className="alert alert-success py-5 mb-5 shadow-sm rounded-4 border-0">
            <h2 className="display-5 fw-bold mb-3">🎉 おめでとう！ 🎉</h2>
            <p className="lead mb-4">すべての札を読み上げました！</p>
            <button onClick={restartCategory} className="btn btn-primary btn-lg px-5 rounded-pill shadow">もう一度最初から遊ぶ</button>
          </div>
        ) : (
          <>     
            <div className={`yomifuda-container mb-4 ${isFadingOut ? 'fade-out' : 'fade-in'}`}>
              {displayContent.type === 'phrase' && renderPhrase(displayContent.content)}
              {displayContent.type === 'result' && renderResult(displayContent.content)}
              {displayContent.type === 'initial' && renderInitial()}
            </div>
            
            <div className="d-flex flex-wrap gap-3 justify-content-center mb-5">
              <button onClick={playKaruta} disabled={loading} className="btn btn-lg px-4 py-3 fw-bold rounded-pill shadow btn-karuta">
                {loading && <span className="spinner-border spinner-border-sm me-2"></span>}
                {loading ? "読み込み中..." : "次の札"}
              </button>
              <button onClick={repeatPhrase} disabled={isReading || !currentPhrase} className="btn btn-lg px-4 py-3 fw-bold rounded-pill border-3 border-dark bg-white text-dark shadow-sm">もう一度</button>
            </div>
          </>
        )}
      </main>

      {currentHistory.length > 0 && (
        <section className="history mx-auto" style={{ maxWidth: "600px" }}>
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
        </section>
      )}

      <footer className="text-center mt-5 pt-4 border-top">
        <section className="settings-container mb-4 p-3 mx-auto shadow-sm rounded-4 bg-light border" style={{ maxWidth: "500px" }}>
          <div className="mb-3 d-flex align-items-center justify-content-center gap-3 border-bottom pb-2">
            <span className="fw-bold text-dark small">言語:</span>
            <div className="btn-group btn-group-sm" role="group">
              <button onClick={() => setLang("ja")} className={`btn ${lang === "ja" ? 'btn-dark' : 'btn-outline-dark'}`}>日本語</button>
              <button onClick={() => setLang("en")} className={`btn ${lang === "en" ? 'btn-dark' : 'btn-outline-dark'}`}>English</button>
            </div>
          </div>
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
          <div className="d-flex align-items-center justify-content-center gap-3">
            <span className="fw-bold text-dark small">回数:</span>
            <div className="btn-group btn-group-sm" role="group">
              <button onClick={() => setRepeatCount(1)} className={`btn ${repeatCount === 1 ? 'btn-dark' : 'btn-outline-dark'}`}>1回</button>
              <button onClick={() => setRepeatCount(2)} className={`btn ${repeatCount === 2 ? 'btn-dark' : 'btn-outline-dark'}`}>2回</button>
            </div>
          </div>
        </section>
      <p className="text-muted small mb-4">リロードすると履歴はリセットされます。</p>
      <div className="d-flex flex-wrap gap-2 justify-content-center">
        <button onClick={() => setView("print-efuda")} className="btn btn-outline-dark px-4 rounded-pill">絵札を印刷する</button>
        <button onClick={resetGame} className="btn btn-outline-secondary px-4 rounded-pill">かるたの種類を選び直す</button>
      </div>
    </footer>
    </div>
  );
}

export default App;
