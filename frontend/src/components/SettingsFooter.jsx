// ラベル・選択肢一覧・現在値・変更ハンドラを渡すだけで、アクティブ表示
// （btn-dark/btn-outline-dark切り替え）付きのボタン群を描画する。SettingsFooterの
// 各設定項目（テーマ・言語・声・順番・スピード）で同じ構造が繰り返されていたため共通化した
function SettingsButtonGroup({ label, options, value, onChange, wrapClassName }) {
  return (
    <div className={wrapClassName ?? "mb-3 d-flex align-items-center justify-content-center gap-3 border-bottom pb-2"}>
      <span className="fw-bold text-dark small">{label}:</span>
      <div className="btn-group btn-group-sm" role="group">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`btn ${value === opt.value ? 'btn-dark' : 'btn-outline-dark'}`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const THEME_OPTIONS = [
  { value: "system", label: "自動" },
  { value: "light", label: "ライト" },
  { value: "dark", label: "ダーク" },
];
const LANG_OPTIONS = [
  { value: "ja", label: "日本語" },
  { value: "en", label: "English" },
];
const VOICE_OPTIONS = [
  { value: "Mizuki", label: "Mizuki" },
  { value: "Takumi", label: "Takumi" },
  { value: "Kazuha", label: "Kazuha" },
  { value: "Tomoko", label: "Tomoko" },
];
const SORT_ORDER_OPTIONS = [
  { value: "random", label: "ランダム" },
  { value: "easy", label: "簡単" },
  { value: "hard", label: "難しい" },
];
const SPEECH_RATE_OPTIONS = [
  // issue #1001: 「ゆっくり」が遅すぎるとの声を受け、「ふつう」（80%）との
  // 中間の速度（75%）へ引き上げた
  { value: "75%", label: "ゆっくり" },
  { value: "80%", label: "ふつう" },
  { value: "100%", label: "はやい" },
];
const REPEAT_COUNT_OPTIONS = [
  { value: 1, label: "1回" },
  { value: 2, label: "2回" },
];
// 札をめくった際、次の札の内容が確定してから表示（フェードアニメーション開始）
// までの待ち時間（issue #471）。既定の3秒を維持しつつ、短縮・延長できるようにする
const CARD_REVEAL_DELAY_OPTIONS = [
  { value: 1000, label: "1秒" },
  { value: 2000, label: "2秒" },
  { value: 3000, label: "3秒" },
  { value: 4000, label: "4秒" },
  { value: 5000, label: "5秒" },
];

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
  cardRevealDelay,
  setCardRevealDelay,
}) {
  return (
    <section className="settings-container mb-4 p-3 mx-auto shadow-sm rounded-4 bg-light border" style={{ maxWidth: "500px" }}>
      <SettingsButtonGroup label="テーマ" options={THEME_OPTIONS} value={themeSetting} onChange={setThemeSetting} />
      <SettingsButtonGroup label="言語" options={LANG_OPTIONS} value={lang} onChange={setLang} />
      {lang === "ja" && (
        <SettingsButtonGroup
          label="声"
          options={VOICE_OPTIONS}
          value={voiceId}
          onChange={setVoiceId}
          wrapClassName="mb-3 d-flex align-items-center justify-content-center gap-3 border-bottom pb-2 flex-wrap"
        />
      )}
      <SettingsButtonGroup label="順番" options={SORT_ORDER_OPTIONS} value={sortOrder} onChange={setSortOrder} />
      <SettingsButtonGroup label="スピード" options={SPEECH_RATE_OPTIONS} value={speechRate} onChange={setSpeechRate} />
      <SettingsButtonGroup
        label="回数"
        options={REPEAT_COUNT_OPTIONS}
        value={repeatCount}
        onChange={setRepeatCount}
        wrapClassName="mb-3 d-flex align-items-center justify-content-center gap-3 border-bottom pb-2"
      />
      <SettingsButtonGroup
        label="札の表示までの待ち時間"
        options={CARD_REVEAL_DELAY_OPTIONS}
        value={cardRevealDelay}
        onChange={setCardRevealDelay}
        wrapClassName="d-flex align-items-center justify-content-center gap-3 flex-wrap"
      />
    </section>
  );
}

export default SettingsFooter;
