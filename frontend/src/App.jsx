import { useState, useCallback, useEffect } from "react";
import "./App.css";

function App() {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("category");
  });
  const [currentPhrase, setCurrentPhrase] = useState(null);
  const [loading, setLoading] = useState(false);
  const [historyByCategory, setHistoryByCategory] = useState({});

  const currentHistory = selectedCategory ? (historyByCategory[selectedCategory] || []) : [];

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch("https://zr6f3qp6vg.execute-api.ap-northeast-1.amazonaws.com/dev/get-categories");
        const data = await response.json();
        if (response.ok) {
          const availableCategories = data.categories || [];
          setCategories(availableCategories);

          // URLから取得したカテゴリが存在するかチェック
          if (selectedCategory && availableCategories.length > 0) {
            if (!availableCategories.includes(selectedCategory)) {
              console.warn(`Category "${selectedCategory}" not found. Redirecting to home.`);
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
    if (!selectedCategory) return;
    
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
      const apiUrl = `https://zr6f3qp6vg.execute-api.ap-northeast-1.amazonaws.com/dev/get-phrase?category=${encodeURIComponent(selectedCategory)}`;
      
      let data;
      let isDuplicate = true;
      let retryCount = 0;
      const maxRetries = 10;

      while (isDuplicate && retryCount < maxRetries) {
        const response = await fetch(apiUrl);
        data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || "Fetch failed");
        }

        if (!currentHistory.find(p => p.id === data.id)) {
          isDuplicate = false;
        } else {
          retryCount++;
        }
      }

      if (isDuplicate) {
        alert("新しい札が見つかりませんでした。すべての札を読み上げた可能性があります。");
        return;
      }

      setCurrentPhrase(data);
      setHistoryByCategory(prev => ({
        ...prev,
        [selectedCategory]: [data, ...(prev[selectedCategory] || [])]
      }));
      
      await playAudio(data.audioData);

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

  // ページタイトルを更新
  useEffect(() => {
    if (selectedCategory) {
      document.title = selectedCategory;
    } else {
      document.title = "カルタ読み上げアプリ";
    }
  }, [selectedCategory]);

  const resetGame = () => {
    setSelectedCategory(null);
    setCurrentPhrase(null);
  };

  const handleCategorySelect = (cat) => {
    const isConfirmed = window.confirm(`「${cat}」をお手元に持っていますか？`);
    if (isConfirmed) {
      setSelectedCategory(cat);
    }
  };

  // カテゴリ選択画面
  if (!selectedCategory) {
    return (
      <div className="container py-5 mx-auto">
        <header className="text-center mb-5">
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
                  onClick={() => handleCategorySelect(cat)} 
                  className="btn btn-lg px-4 py-3 fw-bold rounded-pill shadow-sm"
                  style={{ backgroundColor: "#e44d26", color: "white" }}
                >
                  {cat}
                </button>
              ))
            )}
          </div>
        </main>
      </div>
    );
  }

  // カルタプレイ画面
  return (
    <div className="container py-4 mx-auto">
      <header className="text-center mb-4">
        <h1 className="h2 fw-bold">{selectedCategory}</h1>
      </header>
      
      <main className="text-center">
        {currentPhrase && (
          <div className="d-flex justify-content-center mb-4">
            <div className="yomifuda shadow-lg">
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
