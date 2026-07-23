import { useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "../config";
import { serializeCategoriesParam } from "../hooks/useUrlQuerySync";
import { setPrintScreenActive } from "../pdfExportStatus";

const getEfudaText = (p) => (p.answer && p.answer !== "-") ? p.answer : p.phrase;

// 裏面カードに敷く和柄（分銅繋ぎ・七宝・亀甲・青海波・立涌）
const BACK_PATTERNS = ["fundou", "shippo", "kikkou", "seigaiha", "tatewaku"];

// 種別名から「ランダムっぽい」優先順の柄indexを決定的に選ぶ
// （同一種別は常に同じ柄になりやすくするための下地。重複解消はbuildBackPatternMapで行う）
const getPreferredPatternIndex = (category) => {
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = (hash * 31 + category.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % BACK_PATTERNS.length;
};

// 今回印刷対象になっている種別一覧に対し、柄が重複しないよう1つずつ割り当てる
// （種別数が5以下なら必ず異なる柄になる。6種別以上は柄の種類数を超えるため一部重複する）
// マップの値は柄の名前（"fundou"等）そのもの。表面・裏面どちらでも同じ名前から
// efuda-color-*（枠線・かな circle等の色）とefuda-pattern-*（裏面の柄背景）の
// 両方のクラス名を導出することで、表裏で同じ色になるようにしている
const buildBackPatternMap = (categories) => {
  const uniqueCategories = [...new Set(categories)].sort();
  const usedIndices = new Set();
  const map = new Map();
  for (const category of uniqueCategories) {
    let index = getPreferredPatternIndex(category);
    while (usedIndices.has(index) && usedIndices.size < BACK_PATTERNS.length) {
      index = (index + 1) % BACK_PATTERNS.length;
    }
    usedIndices.add(index);
    map.set(category, BACK_PATTERNS[index]);
  }
  return map;
};

// PDF生成ジョブのポーリング間隔・最大試行回数（3秒×80回=最大4分でタイムアウトとみなす）
const PDF_POLL_INTERVAL_MS = 3000;
const MAX_PDF_POLL_ATTEMPTS = 80;

// .efuda-gridの列数（App.cssのgrid-template-columns: 91mm 91mmと一致させる）
const EFUDA_GRID_COLUMNS = 2;

// 両面印刷は「表面を印刷した用紙をそのまま裏返してセットし、裏面を印刷する」運用
// （縦の中心線を軸に用紙を裏返す）を想定している。そのため、用紙上の同じ物理的な
// マス目に表面・裏面が重なるようにするには、裏面では各行内の列の並びを左右反転
// させる必要がある（表面で左列にあった札は、用紙を裏返すと右列の位置に来るため）。
// slotIndexは常に「用紙上の物理的なマス目」を表し、printSideが"back"のときだけ、
// そのマス目に対応する表面側の元のインデックス（=読み札データの取り出し位置）を
// 行内で左右反転させて求める
const resolvePhraseIndex = (slotIndex, printSide) => {
  if (printSide !== "back") return slotIndex;
  const row = Math.floor(slotIndex / EFUDA_GRID_COLUMNS);
  const col = slotIndex % EFUDA_GRID_COLUMNS;
  return row * EFUDA_GRID_COLUMNS + (EFUDA_GRID_COLUMNS - 1 - col);
};

function PrintEfudaView({ categoryLabel, onBack, selectedCategories, allPhrasesForCategory, phrasesFetchError, onRetryFetchPhrases, efudaPages, efudaPerPage }) {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // この画面を開いている間、PwaUpdatePromptの「オフラインで利用可能になりました」
  // 表示を抑制する（issue #473）
  useEffect(() => {
    setPrintScreenActive(true);
    return () => setPrintScreenActive(false);
  }, []);
  // 表面（読み札の内容）と裏面（種別・レベル）は用紙を裏返して2回に分けて印刷する運用を想定し、
  // 同じページ構成をどちらの内容で描画するかだけをこのstateで切り替える。
  // バックエンドのrenderEfudaPdfWorkerがヘッドレスブラウザでこの画面をディープリンク
  // （?side=back）から直接開けるよう、URLクエリがあればその値を初期値にする
  const [printSide, setPrintSide] = useState(
    () => (new URLSearchParams(window.location.search).get("side") === "back" ? "back" : "front")
  );
  // サーバーサイドPDF生成（?pdfExport=1、renderEfudaPdfWorkerが付与する）のときだけ、
  // 印刷用CSSの中でefuda-card-categoryを例外的に表示する（App.cssの.efuda-pdf-export参照）
  const isPdfExport = new URLSearchParams(window.location.search).get("pdfExport") === "1";

  const backPatternMap = useMemo(
    () => buildBackPatternMap(allPhrasesForCategory.map((p) => p.category)),
    [allPhrasesForCategory]
  );

  const downloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const categoryParam = serializeCategoriesParam(selectedCategories);
      const startResponse = await fetch(`${API_BASE_URL}/generate-efuda-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryParam, side: printSide }),
      });
      if (!startResponse.ok) {
        const errorBody = await startResponse.json().catch(() => null);
        throw new Error(errorBody?.message || "PDF生成の開始に失敗しました。");
      }
      const { jobId } = await startResponse.json();

      let downloadUrl = null;
      for (let attempt = 0; attempt < MAX_PDF_POLL_ATTEMPTS; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, PDF_POLL_INTERVAL_MS));

        const statusResponse = await fetch(
          `${API_BASE_URL}/generate-efuda-pdf-status?jobId=${encodeURIComponent(jobId)}` +
          `&categoryLabel=${encodeURIComponent(categoryLabel || "karuta")}&side=${printSide}`
        );
        const statusBody = await statusResponse.json();

        if (statusBody.status === "DONE") {
          downloadUrl = statusBody.url;
          break;
        }
        if (statusBody.status === "FAILED") {
          throw new Error(statusBody.message || "PDFの生成に失敗しました。");
        }
        // IN_PROGRESSの場合はポーリングを継続する
      }

      if (!downloadUrl) {
        throw new Error("PDFの生成がタイムアウトしました。時間をおいて再度お試しください。");
      }

      window.location.href = downloadUrl;
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("PDFの生成に失敗しました。");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="container efuda-print-container py-4 mx-auto">
      <header className="text-center mb-4 border-bottom pb-3 no-print">
        <div className="d-flex justify-content-between align-items-center">
          <button onClick={onBack} className="btn btn-sm btn-outline-secondary rounded-pill">← 戻る</button>
          <h1 className="h4 m-0 fw-bold notranslate">{categoryLabel}の絵札印刷</h1>
          <div style={{ width: "60px" }}></div>
        </div>
      </header>

      {selectedCategories.length === 0 ? (
        <p className="text-muted text-center py-5 no-print">カテゴリを選択してください。</p>
      ) : allPhrasesForCategory.length === 0 && phrasesFetchError ? (
        // issue #474: 「読み込み中」と「取得失敗」を区別する。以前はどちらも
        // allPhrasesForCategory.length === 0だけで判定していたため、取得に失敗した
        // 場合も「読み込み中...」の表示のまま進まなくなっていた
        <div className="text-center py-5 no-print">
          <p className="text-danger mb-3">かるたデータの取得に失敗しました。</p>
          <button onClick={onRetryFetchPhrases} className="btn btn-outline-dark rounded-pill px-4">再試行する</button>
        </div>
      ) : allPhrasesForCategory.length === 0 ? (
        <p className="text-muted text-center py-5 no-print">読み込み中...</p>
      ) : (
        <>
          {phrasesFetchError && (
            <div className="alert alert-warning no-print text-center d-flex align-items-center justify-content-center gap-3 flex-wrap">
              <span>一部のかるたデータの取得に失敗したため、表示されていない種別があります。</span>
              <button onClick={onRetryFetchPhrases} className="btn btn-sm btn-outline-dark rounded-pill">再試行する</button>
            </div>
          )}
          <div className="no-print text-center mb-4">
            <p className="text-muted small mb-3">
              用紙（顔料インク用）: <a href="https://www.a-one.co.jp/product/search/detail.php?id=51677" target="_blank" rel="noopener noreferrer">エーワン マルチカード A4・10面用 品番51677</a><br />
              用紙（インクジェット用）: <a href="https://www.a-one.co.jp/product/search/detail.php?id=51604" target="_blank" rel="noopener noreferrer">エーワン マルチカード A4・10面用 品番51604</a><br />
              印刷ダイアログで「用紙サイズ: A4」「余白: なし」「拡大縮小: 実際のサイズ(100%)」「ヘッダーとフッター: オフ」に設定してください。<br />
              両面印刷する場合は、表面を印刷した用紙をそのまま裏返してセットし、裏面を印刷してください。
            </p>
            <div className="btn-group mb-3" role="group" aria-label="印刷する面の切り替え">
              <button
                type="button"
                onClick={() => setPrintSide("front")}
                className={`btn btn-outline-dark ${printSide === "front" ? "active" : ""}`}
              >
                表面
              </button>
              <button
                type="button"
                onClick={() => setPrintSide("back")}
                className={`btn btn-outline-dark ${printSide === "back" ? "active" : ""}`}
              >
                裏面
              </button>
            </div>
            <div className="d-flex gap-3 justify-content-center flex-wrap">
              <button onClick={() => window.print()} className="btn btn-lg px-5 py-2 fw-bold rounded-pill shadow btn-karuta efuda-print-button">
                印刷する
              </button>
              <button onClick={downloadPdf} disabled={isGeneratingPdf} className="btn btn-lg px-5 py-2 fw-bold rounded-pill shadow btn-outline-dark">
                {isGeneratingPdf ? "PDF生成中..." : "PDFをダウンロード"}
              </button>
            </div>
          </div>

          <div className={`efuda-print-area ${isPdfExport ? "efuda-pdf-export" : ""}`}>
            {efudaPages.map((page, pageIndex) => (
              <div className="efuda-page-scaler" key={pageIndex}>
                <div className="efuda-page">
                  <div className="efuda-grid">
                    {Array.from({ length: efudaPerPage }).map((_, slotIndex) => {
                      const p = page.items[resolvePhraseIndex(slotIndex, printSide)];
                      const patternName = p && backPatternMap.get(p.category);
                      return (
                        <div className={`efuda-card ${patternName ? `efuda-color-${patternName}` : ""}`} key={slotIndex}>
                          {p && (printSide === "back" ? (
                            <div className={`efuda-card-back efuda-pattern-${patternName}`}>
                              <div className="efuda-card-back-category">{p.category}</div>
                              {p.level !== "-" && (
                                <div className="efuda-card-back-level">
                                  🏅
                                  <span className="efuda-card-back-level-number">{p.level}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <>
                              <p className="no-print small efuda-card-category">{p.category}</p>
                              <div className="efuda-card-kana">{p.kana}</div>
                              <div className="efuda-card-text">{getEfudaText(p)}</div>
                            </>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default PrintEfudaView;
