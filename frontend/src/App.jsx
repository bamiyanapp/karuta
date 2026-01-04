import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import ReactMarkdown from "react-markdown";
import "./App.css";
import karutaImage from "./assets/karuta_inubou.png";
import changelogData from "./changelog.json";

const API_BASE_URL = "https://akmnirkx3m.execute-api.ap-northeast-1.amazonaws.com/dev";

function App() {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("category");
  });
  
  const [detailPhraseId, setDetailPhraseId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("id");
  });
  const [detailPhrase, setDetailPhrase] = useState(null);

  // 指摘一覧表示用の状態
  const [view, setView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("view") || "game";
  });
  const [allComments, setAllComments] = useState([]);

  const [allPhrasesForCategory, setAllPhrasesForCategory] = useState([]); 
  const [allPhrases, setAllPhrases] = useState([]); // 全札一覧用
  const [currentPhrase, setCurrentPhrase] = useState(null);
  const [displayedPhrase, setDisplayedPhrase] = useState(null);
  const [fadeState, setFadeState] = useState("hidden"); // 初期状態をhiddenに変更
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
  const [pendingCategory, setPendingCategory] = useState(null);

  // コメント投稿用の状態
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  const flipTimeoutRef = useRef(null);
  const startTimeRef = useRef(null);

  const currentHistory = useMemo(() => {
    return selectedCategory ? (historyByCategory[selectedCategory] || []) : [];
  }, [selectedCategory, historyByCategory]);

  // カテゴリ一覧を取得
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/get-categories`);
        const data = await response.json();
        if (response.ok) {
          const availableCategories = data.categories || [];
          setCategories(availableCategories);

          if (selectedCategory && availableCategories.length > 0 && view === "game") {
            if (!availableCategories.includes(selectedCategory)) {
              setSelectedCategory(null);
            }
          }
        }
    } catch {
      alert("送信に失敗しました。");
    }
    };
    fetchCategories();
  }, [selectedCategory, view]);

  // カテゴリが選択されたら、そのカテゴリの全札IDリストを取得する
  useEffect(() => {
    if (!selectedCategory) {
      setAllPhrasesForCategory([]);
      return;
    }

    const fetchPhrasesList = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/get-phrases-list?category=${encodeURIComponent(selectedCategory)}`);
        const data = await response.json();
        if (response.ok) {
          setAllPhrasesForCategory(data.phrases || []);
        }
      } catch (error) {
        console.error("Error fetching phrases list:", error);
      }
    };
    fetchPhrasesList();
  }, [selectedCategory]);

  // 詳細データの取得
  useEffect(() => {
    if (detailPhraseId) {
      const fetchDetail = async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/get-phrase?id=${detailPhraseId}&repeatCount=${repeatCount}&speechRate=${encodeURIComponent(speechRate)}&lang=${lang}`);
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
  }, [detailPhraseId, repeatCount, speechRate, lang]);

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
          const currentList = prev[selectedCategory] || [];
          if (currentList.find(p => p.id === phraseData.id)) {
            return prev;
          }
          return {
            ...prev,
            [selectedCategory]: [phraseData, ...currentList]
          };
        });
      }
  
      await playIntroSound();
      
      if (phraseData) {
        // 以前のアニメーションが残っていたらクリア
        if (flipTimeoutRef.current) {
          clearTimeout(flipTimeoutRef.current);
          flipTimeoutRef.current = null;
        }

        // 3秒待機してからフェードアニメーションを開始
        flipTimeoutRef.current = setTimeout(() => {
          // フェードアウト開始（既に何か表示されている場合のみ意味があるが、統一のため）
          setFadeState("fading");
          
          flipTimeoutRef.current = setTimeout(() => {
            // 札を切り替えてフェードイン
            setDisplayedPhrase(phraseData);
            setFadeState("visible");
            startTimeRef.current = Date.now(); // 札が表示されたタイミングから計測開始
            flipTimeoutRef.current = null;
          }, 500); // フェードアウトの時間
        }, 3000); // 待機時間
      }
      
      await playAudio(audioData);
      
      setAudioQueue(prev => prev.slice(1));
      setIsReading(false);
    };
  
    playNextInQueue();

    return () => {
      if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current);
    }
  }, [audioQueue, isReading, playAudio, playIntroSound, selectedCategory, historyByCategory]);

  const playKaruta = async () => {
    if (startTimeRef.current && displayedPhrase) {
      const elapsedTime = (Date.now() - startTimeRef.current) / 1000;
      
      // 難易度計算: 経過時間 / その時の残り枚数
      // 残り枚数 = 全枚数 - (読み上げ済み枚数 - 1)
      // currentHistoryにはdisplayedPhraseが含まれているため、-1する
      const totalCount = allPhrasesForCategory.length || 1;
      const historyCount = currentHistory.length || 1;
      const remainingCount = Math.max(1, totalCount - (historyCount - 1));
      const difficulty = elapsedTime / remainingCount;

      fetch(`${API_BASE_URL}/record-time`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: displayedPhrase.id,
          category: displayedPhrase.category, // categoryも送信
          time: elapsedTime,
          difficulty: difficulty,
        }),
      });
      startTimeRef.current = null;
    }

    if (!selectedCategory || allPhrasesForCategory.length === 0) return;
    
    setLoading(true);
    
    try {
      const readIds = currentHistory.map(p => p.id);
      let unreadPhrases = allPhrasesForCategory.filter(p => !readIds.includes(p.id));

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

      const apiUrl = `${API_BASE_URL}/get-phrase?id=${targetPhrase.id}&repeatCount=${repeatCount}&speechRate=${encodeURIComponent(speechRate)}&lang=${lang}`;
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
          category: selectedCategory,
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
    if (selectedCategory) {
      params.set("category", selectedCategory);
    } else {
      params.delete("category");
    }
    
    if (detailPhraseId) {
      params.set("id", detailPhraseId);
    } else {
      params.delete("id");
    }

    if (view === "comments" || view === "changelog" || view === "all-phrases") {
      params.set("view", view);
    } else {
      params.delete("view");
    }

    const newSearch = params.toString();
    const url = newSearch ? `?${newSearch}` : window.location.pathname;
    window.history.pushState({}, "", url);
  }, [selectedCategory, detailPhraseId, view]);

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      setSelectedCategory(params.get("category"));
      setDetailPhraseId(params.get("id"));
      setView(params.get("view") || "game");
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (view === "comments") {
      document.title = "指摘一覧 | カルタ読み上げアプリ";
    } else if (view === "changelog") {
      document.title = "更新履歴 | カルタ読み上げアプリ";
    } else if (detailPhraseId && detailPhrase) {
      document.title = `${detailPhrase.phrase} | ${selectedCategory}`;
    } else if (selectedCategory) {
      document.title = selectedCategory;
    } else {
      document.title = "かるた読み上げアプリ";
    }
  }, [selectedCategory, detailPhraseId, detailPhrase, view]);

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
    setSelectedCategory(null);
    setCurrentPhrase(null);
    setDetailPhraseId(null);
    setDisplayedPhrase(null);
    setIsAllRead(false);
    setFadeState("hidden"); // リセット時も非表示
  };

  const restartCategory = () => {
    setHistoryByCategory(prev => ({
      ...prev,
      [selectedCategory]: []
    }));
    setCurrentPhrase(null);
    setDisplayedPhrase(null);
    setIsAllRead(false);
    setFadeState("hidden"); // リスタート時も非表示
  };

  const handleCategoryClick = (cat) => {
    setPendingCategory(cat);
    setShowConfirmModal(true);
  };

  const confirmCategory = () => {
    setSelectedCategory(pendingCategory);
    setShowConfirmModal(false);
    setPendingCategory(null);
    setView("game");
  };

  const cancelCategory = () => {
    setShowConfirmModal(false);
    setPendingCategory(null);
  };

  const openDetail = (id, category) => {
    setDetailPhraseId(id);
    if (category) setSelectedCategory(category); // 必要に応じてセット（一覧から遷移時など）
    window.scrollTo(0, 0);
  };

  const closeDetail = () => {
    setDetailPhraseId(null);
  };

  // 詳細表示画面（説明ページ）
  if (detailPhraseId) {
    return (
      <div className="container py-4 mx-auto">
        <header className="text-center mb-4 border-bottom pb-3">
          <div className="d-flex justify-content-between align-items-center">
            <button onClick={closeDetail} className="btn btn-sm btn-outline-secondary rounded-pill">← 戻る</button>
            <h1 className="h4 m-0 fw-bold notranslate">{detailPhrase ? detailPhrase.category : selectedCategory} の詳細</h1>
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

  // 全札一覧画面
  if (view === "all-phrases") {
    return (
      <div className="container py-4 mx-auto">
        <header className="text-center mb-5 border-bottom pb-3">
          <div className="d-flex justify-content-between align-items-center">
            <button onClick={() => { setView("game"); setSelectedCategory(null); }} className="btn btn-sm btn-outline-secondary rounded-pill">← 戻る</button>
            <h1 className="h2 fw-bold m-0 text-dark">全札一覧</h1>
            <div style={{ width: "60px" }}></div>
          </div>
        </header>

        <main className="mx-auto" style={{ maxWidth: "1000px" }}>
          {allPhrases.length === 0 ? (
            <p className="text-muted text-center py-5">読み込み中...</p>
          ) : (
            <div className="table-responsive shadow-sm rounded-4 bg-white">
              <table className="table table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th scope="col" className="ps-4">カテゴリ</th>
                    <th scope="col">読み札</th>
                    <th scope="col">Lv</th>
                    <th scope="col">回数</th>
                    <th scope="col">難易度</th>
                    <th scope="col" className="text-end pe-4">詳細</th>
                  </tr>
                </thead>
                <tbody>
                  {allPhrases.map((p) => (
                    <tr key={p.id} style={{ cursor: "pointer" }} onClick={() => openDetail(p.id, p.category)}>
                      <td className="ps-4 text-muted small">{p.category}</td>
                      <td className="fw-bold">{p.phrase}</td>
                      <td>{p.level !== "-" ? p.level : ""}</td>
                      <td>{p.readCount || 0}</td>
                      <td>{(p.averageDifficulty || 0).toFixed(2)}</td>
                      <td className="text-end pe-4 text-primary">→</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    );
  }

  // 指摘一覧画面
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

  // 更新履歴画面
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

  // カテゴリ選択画面
  if (!selectedCategory) {
    return (
      <div className="container py-5 mx-auto">
      <header className="text-center mb-5">
        <img src="favicon.png" alt="かるたのアイコン" className="mb-4" style={{ width: "120px", height: "auto" }} />
        <h1 className="display-4 fw-bold">かるた読み上げアプリ</h1>
      </header>
        
      <main className="category-selection-container p-4 mx-auto mb-5" style={{ maxWidth: "600px" }}>
        <h2 className="h4 text-center mb-4 text-dark">かるたの種類を選んでね</h2>
        <div className="d-flex flex-wrap gap-3 justify-content-center">
            {categories.length === 0 ? (
              <div className="text-success fw-bold p-3">読み込み中...</div>
            ) : (
              categories.map(cat => (
                <button 
                  key={cat} 
                  onClick={() => handleCategoryClick(cat)} 
                  className="btn btn-lg px-4 py-3 fw-bold rounded-pill shadow-sm notranslate btn-karuta" 
                >
                  {cat}
                </button>
              ))
            )}
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

        {showConfirmModal && (
          <div className="modal fade show d-block modal-overlay" tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content rounded-4 border-0 shadow">
                <div className="modal-body p-5 text-center">
                  <h3 className="h5 mb-4 fw-bold">「{pendingCategory}」をお手元に持っていますか？</h3>
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


  // かるたプレイ画面
  const renderPhrase = (phrase) => {
    if (!phrase) return null;
    return (
        <div className="yomifuda">
            <div className="yomifuda-kana"><span>{phrase.kana || (phrase.phrase && phrase.phrase[0])}</span></div>
            <div className="yomifuda-phrase">{phrase.phrase}</div>
            {phrase.level !== "-" && <div className="yomifuda-level fw-bold">レベル: {phrase.level}</div>}
        </div>
    );
  }

  return (
    <div className="container py-4 mx-auto">
      <header className="text-center mb-4">
        <h1 className="h2 fw-bold text-dark notranslate">{selectedCategory}</h1>
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
            {displayedPhrase ? (
              <div className={`yomifuda-container mb-4 phrase-fade-${fadeState}`} onClick={repeatPhrase} role="button" aria-label="もう一度">
                {renderPhrase(displayedPhrase)}
              </div>
            ) : (
              selectedCategory && (
                <div className="yomifuda-container mb-4 d-flex flex-column justify-content-center align-items-center text-muted">
                  <img src={karutaImage} alt="準備完了" className="mb-3" style={{ width: "120px", opacity: 0.8 }} />
                  <div className="fw-bold">準備完了</div>
                  <small className="mt-2">「次の札を読み上げる」ボタンを押して開始してください<br/>
                  読み上げのオプションは下部から設定してください</small>
                </div>
              )
            )}
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
              <button key={`${p.id}-${currentHistory.length - index}`} onClick={() => openDetail(p.id)} className="list-group-item list-group-item-action d-flex align-items-center justify-content-between">
                <div>
                  {p.level !== "-" && <span className="badge bg-danger me-2">Lv.{p.level}</span>}
                  <span className="text-dark">{p.phrase}</span>
                </div>
                <span className="text-primary small">詳細・報告 →</span>
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
      <button onClick={resetGame} className="btn btn-outline-secondary px-4 rounded-pill">かるたの種類を選び直す</button>
    </footer>
    </div>
  );
}

export default App;
