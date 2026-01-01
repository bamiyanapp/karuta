import { useState, useCallback, useEffect } from "react";
import "./App.css";

function App() {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [currentPhrase, setCurrentPhrase] = useState(null);
  const [loading, setLoading] = useState(false);
  const [readPhrases, setReadPhrases] = useState([]);

  // カテゴリ一覧を取得
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        console.log("Fetching categories...");
        const response = await fetch("https://zr6f3qp6vg.execute-api.ap-northeast-1.amazonaws.com/dev/get-categories");
        console.log("Response status:", response.status);
        const data = await response.json();
        console.log("Data received:", data);
        if (response.ok) {
          setCategories(data.categories || []);
        } else {
          console.error("Fetch categories failed:", data.message);
        }
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };
    fetchCategories();
  }, []);

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
    // 0.5秒スリープ
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

        if (!readPhrases.find(p => p.id === data.id)) {
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
      setReadPhrases(prev => [data, ...prev]);
      
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

  const resetGame = () => {
    setSelectedCategory(null);
    setCurrentPhrase(null);
    setReadPhrases([]);
  };

  // カテゴリ選択画面
  if (!selectedCategory) {
    return (
      <div className="App">
        <h1>カルタ読み上げアプリ</h1>
        <div className="category-selection">
          <h2>カルタの種類を選んでね</h2>
          <div className="category-buttons">
            {categories.length === 0 ? (
              <p className="loading-text">読み込み中...</p>
            ) : (
              categories.map(cat => (
                <button key={cat} onClick={() => setSelectedCategory(cat)} className="category-button">
                  {cat}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // カルタプレイ画面
  return (
    <div className="App">
      <div className="header-nav">
        <h1>{selectedCategory}</h1>
      </div>
      
      <div className="card">
        {currentPhrase && (
          <div className="yomifuda-container">
            <div className="yomifuda">
              <div className="yomifuda-kana">
                <span>{currentPhrase.kana || currentPhrase.phrase[0]}</span>
              </div>
              <div className="yomifuda-phrase">
                {currentPhrase.phrase}
              </div>
              {currentPhrase.level !== "-" && (
                <div className="yomifuda-level">
                  レベル: {currentPhrase.level}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="button-group">
          <button onClick={playKaruta} disabled={loading} className="main-button">
            {loading ? "読み込み中..." : "次の札を読み上げる"}
          </button>
          <button onClick={repeatPhrase} disabled={loading || !currentPhrase} className="sub-button">
            もう一度読み上げる
          </button>
        </div>
      </div>

      <div className="history">
        <h2>これまでに読み上げた札</h2>
        {readPhrases.length === 0 ? (
          <p>まだ読み上げた札はありません。</p>
        ) : (
          <ul>
            {readPhrases.map((p, index) => (
              <li key={`${p.id}-${readPhrases.length - index}`}>
                {p.level !== "-" && <span className="history-level">Lv.{p.level}</span>}
                {p.phrase}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="read-the-docs">
        リロードすると履歴はリセットされます。
      </p>

      <div className="footer-nav">
        <button onClick={resetGame} className="back-button">カルタの種類を選び直す</button>
      </div>
    </div>
  );
}

export default App;
