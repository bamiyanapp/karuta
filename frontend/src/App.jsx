import { useState, useCallback, useEffect } from "react";
import "./App.css";

function App() {
  const [currentPhrase, setCurrentPhrase] = useState(null);
  const [loading, setLoading] = useState(false);
  const [readPhrases, setReadPhrases] = useState([]);

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
    setLoading(true);
    try {
      const apiUrl = "https://zr6f3qp6vg.execute-api.ap-northeast-1.amazonaws.com/dev/get-phrase";
      
      let data;
      let isDuplicate = true;
      let retryCount = 0;
      const maxRetries = 10; // 連続で重複した場合の制限

      while (isDuplicate && retryCount < maxRetries) {
        const response = await fetch(apiUrl);
        data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || "Fetch failed");
        }

        // すでに読んだ札（ID）に含まれていないかチェック
        if (!readPhrases.find(p => p.id === data.id)) {
          isDuplicate = false;
        } else {
          retryCount++;
          console.log(`Duplicate found: ${data.phrase}, retrying... (${retryCount})`);
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

  return (
    <div className="App">
      <h1>カルタ読み上げアプリ</h1>
      <div className="card">
        <div className="button-group">
          <button onClick={playKaruta} disabled={loading}>
            {loading ? "読み込み中..." : "次の札を読み上げる"}
          </button>
          <button onClick={repeatPhrase} disabled={loading || !currentPhrase}>
            もう一度読み上げる
          </button>
        </div>

        {currentPhrase && (
          <div className="phrase-container">
            <p className="pinch-level">ピンチレベル: {currentPhrase.level}</p>
            <p className="phrase-text">{currentPhrase.phrase}</p>
          </div>
        )}
      </div>

      <div className="history">
        <h2>これまでに読み上げた札</h2>
        {readPhrases.length === 0 ? (
          <p>まだ読み上げた札はありません。</p>
        ) : (
          <ul>
            {readPhrases.map((p, index) => (
              <li key={`${p.id}-${readPhrases.length - index}`}>
                <span className="history-level">Lv.{p.level}</span>: {p.phrase}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="read-the-docs">
        リロードすると履歴はリセットされます。
      </p>
    </div>
  );
}

export default App;
