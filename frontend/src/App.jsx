import { useState, useCallback, useEffect, useMemo } from "react";
import "./App.css";

function App() {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("category");
  });
  
  const [allPhrasesForCategory, setAllPhrasesForCategory] = useState([]); // 現在のカテゴリの全IDリスト
  const [currentPhrase, setCurrentPhrase] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isAllRead, setIsAllRead] = useState(false);
  const [repeatCount, setRepeatCount] = useState(() => {
    return parseInt(localStorage.getItem("repeatCount") || "2", 10);
  });
  const [speechRate, setSpeechRate] = useState(() => {
    return localStorage.getItem("speechRate") || "80%";
  });
  const [historyByCategory, setHistoryByCategory] = useState({});
  
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingCategory, setPendingCategory] = useState(null);

  const currentHistory = useMemo(() => {
    return selectedCategory ? (historyByCategory[selectedCategory] || []) : [];
  }, [selectedCategory, historyByCategory]);

  // カテゴリ一覧を取得
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch("https://zr6f3qp6vg.execute-api.ap-northeast-1.amazonaws.com/dev/get-categories");
        const data = await response.json();
        if (response.ok) {
          const availableCategories = data.categories || [];
          setCategories(availableCategories);

          if (selectedCategory && availableCategories.length > 0) {
            if (!availableCategories.includes(selectedCategory)) {
              setSelectedCategory(null);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };
    fetchCategories();
  }, [selectedCategory]);

  // カテゴリが選択されたら、そのカテゴリの全札IDリストを取得する
  useEffect(() => {
    if (!selectedCategory) {
      setAllPhrasesForCategory([]);
      return;
    }

    const fetchPhrasesList = async () => {
      try {
        const response = await fetch(`https://zr6f3qp6vg.execute-api.ap-northeast-1.amazonaws.com/dev/get-phrases-list?category=${encodeURIComponent(selectedCategory)}`);
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

  const playAudio = useCallback((audioData) => {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      audio.src = audioData;
      audio.oncanplaythrough = () => {
        audio.play().catch(e => {
          console.error("Playback failed:", e);
          reject(e);
        });
      };
      audio.onended = () => resolve();
      audio.onerror = (e) => {
        console.error("Audio loading error:", audio.error);
        reject(audio.error);
      };
      audio.load();
    });
  }, []);

  const playKaruta = async () => {
    if (!selectedCategory || allPhrasesForCategory.length === 0) return;
    
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
      // 既読のIDを除外して、未読のIDリストを作成
      const readIds = currentHistory.map(p => p.id);
      const unreadPhrases = allPhrasesForCategory.filter(p => !readIds.includes(p.id));

      if (unreadPhrases.length === 0) {
        setIsAllRead(true);
        await playCongratulationAudio();
        setLoading(false);
        return;
      }

      // 未読リストからランダムに1つ選択
      const randomIndex = Math.floor(Math.random() * unreadPhrases.length);
      const targetPhrase = unreadPhrases[randomIndex];

      // 詳細データを取得
      const apiUrl = `https://zr6f3qp6vg.execute-api.ap-northeast-1.amazonaws.com/dev/get-phrase?id=${targetPhrase.id}&repeatCount=${repeatCount}&speechRate=${encodeURIComponent(speechRate)}`;
      const response = await fetch(apiUrl);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || "Fetch failed");
      }

      setCurrentPhrase(data);
      const newHistory = [data, ...currentHistory];
      setHistoryByCategory(prev => ({
        ...prev,
        [selectedCategory]: newHistory
      }));

      await playAudio(data.audioData);

      // 全て読み終わったかチェック
      if (newHistory.length >= allPhrasesForCategory.length) {
        setIsAllRead(true);
        await new Promise(resolve => setTimeout(resolve, 1500));
        await playCongratulationAudio();
      }

    } catch (error) {
      console.error("Error fetching phrase:", error);
      alert("通信エラーが発生しました: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const repeatPhrase = async () => {
    if (currentPhrase && currentPhrase.audioData) {
      try {
        await playAudio(currentPhrase.audioData);
      } catch (error) {
        alert("再生成に失敗しました。");
      }
    }
  };

  const playCongratulationAudio = async () => {
    try {
      const response = await fetch(`https://zr6f3qp6vg.execute-api.ap-northeast-1.amazonaws.com/dev/get-congratulation-audio?speechRate=${encodeURIComponent(speechRate)}`);
      const data = await response.json();
      if (response.ok) {
        await playAudio(data.audioData);
      }
    } catch (error) {
      console.error("Error playing congratulation audio:", error);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (selectedCategory) {
      params.set("category", selectedCategory);
      window.history.pushState({}, "", `?${params.toString()}`);
    } else {
      params.delete("category");
      window.history.pushState({}, "", window.location.pathname);
    }
  }, [selectedCategory]);

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      setSelectedCategory(params.get("category"));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      document.title = selectedCategory;
    } else {
      document.title = "カルタ読み上げアプリ";
    }
  }, [selectedCategory]);

  useEffect(() => {
    localStorage.setItem("repeatCount", repeatCount.toString());
  }, [repeatCount]);

  useEffect(() => {
    localStorage.setItem("speechRate", speechRate);
  }, [speechRate]);

  const resetGame = () => {
    setSelectedCategory(null);
    setCurrentPhrase(null);
    setIsAllRead(false);
  };

  const restartCategory = () => {
    setHistoryByCategory(prev => ({
      ...prev,
      [selectedCategory]: []
    }));
    setCurrentPhrase(null);
    setIsAllRead(false);
  };

  const handleCategoryClick = (cat) => {
    setPendingCategory(cat);
    setShowConfirmModal(true);
  };

  const confirmCategory = () => {
    setSelectedCategory(pendingCategory);
    setShowConfirmModal(false);
    setPendingCategory(null);
  };

  const cancelCategory = () => {
    setShowConfirmModal(false);
    setPendingCategory(null);
  };

  if (!selectedCategory) {
    return (
      <div className="container py-5 mx-auto">
        <header className="text-center mb-5">
          <img 
            src="favicon.png" 
            alt="カルタのアイコン" 
            className="mb-4" 
            style={{ width: "120px", height: "auto" }}
          />
          <h1 className="display-4 fw-bold">カルタ読み上げアプリ</h1>
        </header>
        
        <main className="category-selection-container p-4 mx-auto" style={{ maxWidth: "600px" }}>
          <h2 className="h4 text-center mb-4 text-dark">カルタの種類を選んでね</h2>
          <div className="d-flex flex-wrap gap-3 justify-content-center">
            {categories.length === 0 ? (
              <div className="text-success fw-bold p-3">読み込み中...</div>
            ) : (
              categories.map(cat => (
                <button 
                  key={cat} 
                  onClick={() => handleCategoryClick(cat)} 
                  className="btn btn-lg px-4 py-3 fw-bold rounded-pill shadow-sm"
                  style={{ backgroundColor: "#e44d26", color: "white" }}
                >
                  {cat}
                </button>
              ))
            )}
          </div>
        </main>

        {showConfirmModal && (
          <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content rounded-4 border-0 shadow">
                <div className="modal-body p-5 text-center">
                  <h3 className="h4 mb-4 fw-bold">「{pendingCategory}」をお手元に持っていますか？</h3>
                  <div className="d-flex gap-3 justify-content-center">
                    <button onClick={confirmCategory} className="btn btn-primary btn-lg px-5 rounded-pill shadow-sm">
                      はい
                    </button>
                    <button onClick={cancelCategory} className="btn btn-outline-secondary btn-lg px-5 rounded-pill">
                      いいえ
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="container py-4 mx-auto">
      <header className="text-center mb-4">
        <h1 className="h2 fw-bold">{selectedCategory}</h1>
      </header>
      
      <main className="text-center">
        {isAllRead ? (
          <div className="alert alert-success py-5 mb-5 shadow-sm rounded-4 border-0">
            <h2 className="display-5 fw-bold mb-3">🎉 おめでとう！ 🎉</h2>
            <p className="lead mb-4">すべての札を読み上げました！</p>
            <button onClick={restartCategory} className="btn btn-primary btn-lg px-5 rounded-pill shadow">
              もう一度最初から遊ぶ
            </button>
          </div>
        ) : (
          <>
        {currentPhrase && (
          <div className="d-flex justify-content-center mb-4">
            <div 
              className="yomifuda shadow-lg" 
              onClick={repeatPhrase}
              role="button"
              aria-label="もう一度読み上げる"
            >
              <div className="yomifuda-kana">
                    <span>{currentPhrase.kana || currentPhrase.phrase[0]}</span>
                  </div>
                  <div className="yomifuda-phrase">
                    {currentPhrase.phrase}
                  </div>
                  {currentPhrase.level !== "-" && (
                    <div className="yomifuda-level fw-bold">
                      レベル: {currentPhrase.level}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="d-flex flex-wrap gap-3 justify-content-center mb-5">
              <button 
                onClick={playKaruta} 
                disabled={loading} 
                className="btn btn-lg px-4 py-3 fw-bold rounded-pill shadow"
                style={{ backgroundColor: "#e44d26", color: "white" }}
              >
                {loading ? (
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                ) : null}
                {loading ? "読み込み中..." : "次の札を読み上げる"}
              </button>
              <button 
                onClick={repeatPhrase} 
                disabled={loading || !currentPhrase} 
                className="btn btn-lg px-4 py-3 fw-bold rounded-pill border-3 border-dark bg-white text-dark shadow-sm"
              >
                もう一度読み上げる
              </button>
            </div>
          </>
        )}
      </main>

      <section className="history mx-auto" style={{ maxWidth: "600px" }}>
        <h2 className="h4 fw-bold mb-3 border-bottom pb-2">これまでに読み上げた札</h2>
        {currentHistory.length === 0 ? (
          <p className="text-muted text-center py-3">まだ読み上げた札はありません。</p>
        ) : (
          <ul className="list-group list-group-flush shadow-sm rounded">
            {currentHistory.map((p, index) => (
              <li key={`${p.id}-${currentHistory.length - index}`} className="list-group-item">
                {p.level !== "-" && <span className="badge bg-danger me-2">Lv.{p.level}</span>}
                <span className="text-dark">{p.phrase}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="text-center mt-5 pt-4 border-top">
        <section className="settings-container mb-4 p-3 mx-auto shadow-sm rounded-4 bg-light border" style={{ maxWidth: "500px" }}>
          <div className="mb-3 d-flex align-items-center justify-content-center gap-3 border-bottom pb-2">
            <span className="fw-bold text-dark small">読み上げスピード:</span>
            <div className="btn-group btn-group-sm" role="group">
              <button 
                onClick={() => setSpeechRate("70%")} 
                className={`btn ${speechRate === "70%" ? 'btn-dark' : 'btn-outline-dark'}`}
              >
                ゆっくり
              </button>
              <button 
                onClick={() => setSpeechRate("80%")} 
                className={`btn ${speechRate === "80%" ? 'btn-dark' : 'btn-outline-dark'}`}
              >
                ふつう
              </button>
              <button 
                onClick={() => setSpeechRate("100%")} 
                className={`btn ${speechRate === "100%" ? 'btn-dark' : 'btn-outline-dark'}`}
              >
                はやい
              </button>
            </div>
          </div>
          <div className="d-flex align-items-center justify-content-center gap-3">
            <span className="fw-bold text-dark small">読み上げ回数:</span>
            <div className="btn-group btn-group-sm" role="group">
              <button 
                onClick={() => setRepeatCount(1)} 
                className={`btn ${repeatCount === 1 ? 'btn-dark' : 'btn-outline-dark'}`}
              >
                1回
              </button>
              <button 
                onClick={() => setRepeatCount(2)} 
                className={`btn ${repeatCount === 2 ? 'btn-dark' : 'btn-outline-dark'}`}
              >
                2回
              </button>
            </div>
          </div>
        </section>

        <p className="text-muted small mb-4">
          リロードすると履歴はリセットされます。
        </p>
        <button onClick={resetGame} className="btn btn-outline-secondary px-4 rounded-pill">
          カルタの種類を選び直す
        </button>
      </footer>
    </div>
  );
}

export default App;
