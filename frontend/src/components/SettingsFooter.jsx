function SettingsFooter({
  themeSetting,
  setThemeSetting,
  lang,
  setLang,
  voiceId,
  setVoiceId,
  sortOrder,
  setSortOrder,
  speechRate,
  setSpeechRate,
  repeatCount,
  setRepeatCount,
}) {
  return (
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
      <div className="d-flex align-items-center justify-content-center gap-3">
        <span className="fw-bold text-dark small">回数:</span>
        <div className="btn-group btn-group-sm" role="group">
          <button onClick={() => setRepeatCount(1)} className={`btn ${repeatCount === 1 ? 'btn-dark' : 'btn-outline-dark'}`}>1回</button>
          <button onClick={() => setRepeatCount(2)} className={`btn ${repeatCount === 2 ? 'btn-dark' : 'btn-outline-dark'}`}>2回</button>
        </div>
      </div>
    </section>
  );
}

export default SettingsFooter;
