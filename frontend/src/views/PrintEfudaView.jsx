import { useMemo, useState } from "react";

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
    map.set(category, `efuda-pattern-${BACK_PATTERNS[index]}`);
  }
  return map;
};

// A4サイズ（mm）。efuda-pageのCSS上の実寸と一致させる
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

function PrintEfudaView({ categoryLabel, setView, selectedCategories, allPhrasesForCategory, efudaPages, efudaPerPage }) {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  // 表面（読み札の内容）と裏面（種別・レベル）は用紙を裏返して2回に分けて印刷する運用を想定し、
  // 同じページ構成をどちらの内容で描画するかだけをこのstateで切り替える
  const [printSide, setPrintSide] = useState("front");

  const backPatternMap = useMemo(
    () => buildBackPatternMap(allPhrasesForCategory.map((p) => p.category)),
    [allPhrasesForCategory]
  );

  const downloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      // ゲーム画面など大多数のユーザーには不要な重量級ライブラリのため、
      // メインバンドルには含めずダウンロード実行時にのみ読み込む
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const pageElements = document.querySelectorAll(".efuda-print-area .efuda-page");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      // .efuda-pageは狭い画面での画面プレビュー用にtransform: scale()で縮小表示している
      // （issue #387、#421）ことがある。キャプチャ中だけtransformを無効化し、
      // 「印刷する」（window.print()、@media printでtransform: none）と同じ実寸で
      // 撮影されるようにする
      pageElements.forEach((el) => {
        el.style.transform = "none";
      });

      try {
        for (let i = 0; i < pageElements.length; i++) {
          // scale: 2で解像度を上げ、印刷用途でも文字が粗くならないようにする。
          // no-printは@media printでのみ非表示になる（画面上は表示されたまま）ため、
          // html2canvasが画面表示状態をそのまま撮影しないよう、cloneした文書側で明示的に隠す。
          // ただしefuda-card-category（表面カードのかるた種別ラベル）は、実物の紙面には印刷しないが
          // PDFでは種別を確認できるようにしたいという要望のため、隠さず残す
          const canvas = await html2canvas(pageElements[i], {
            scale: 2,
            useCORS: true,
            onclone: (clonedDoc) => {
              clonedDoc.querySelectorAll(".no-print:not(.efuda-card-category)").forEach((el) => {
                el.style.display = "none";
              });
            },
          });
          const imageData = canvas.toDataURL("image/png");
          if (i > 0) {
            pdf.addPage();
          }
          pdf.addImage(imageData, "PNG", 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM);

          // 大量ページ印刷時（issue #PDF出力エラー）にcanvasの描画バッファが
          // 累積してメモリを圧迫しないよう、使い終えたcanvasは都度サイズを0にして明示的に解放する
          canvas.width = 0;
          canvas.height = 0;
        }
      } finally {
        pageElements.forEach((el) => {
          el.style.transform = "";
        });
      }

      const sideLabel = printSide === "back" ? "裏面" : "表面";
      pdf.save(`${categoryLabel || "karuta"}_絵札_${sideLabel}.pdf`);
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

          <div className="efuda-print-area">
            {efudaPages.map((page, pageIndex) => (
              <div className="efuda-page-scaler" key={pageIndex}>
                <div className="efuda-page">
                  <div className="efuda-grid">
                    {Array.from({ length: efudaPerPage }).map((_, slotIndex) => {
                      const p = page.items[slotIndex];
                      return (
                        <div className="efuda-card" key={slotIndex}>
                          {p && (printSide === "back" ? (
                            <div className={`efuda-card-back ${backPatternMap.get(p.category)}`}>
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
