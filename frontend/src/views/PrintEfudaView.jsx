import { useState } from "react";

const getEfudaText = (p) => (p.answer && p.answer !== "-") ? p.answer : p.phrase;

// A4サイズ（mm）。efuda-pageのCSS上の実寸と一致させる
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

function PrintEfudaView({ categoryLabel, setView, selectedCategories, allPhrasesForCategory, efudaPages, efudaPerPage }) {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

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

      for (let i = 0; i < pageElements.length; i++) {
        // scale: 2で解像度を上げ、印刷用途でも文字が粗くならないようにする。
        // no-printは@media printでのみ非表示になる（画面上は表示されたまま）ため、
        // html2canvasが画面表示状態をそのまま撮影しないよう、cloneした文書側で明示的に隠す
        const canvas = await html2canvas(pageElements[i], {
          scale: 2,
          useCORS: true,
          onclone: (clonedDoc) => {
            clonedDoc.querySelectorAll(".no-print").forEach((el) => {
              el.style.display = "none";
            });
          },
        });
        const imageData = canvas.toDataURL("image/png");
        if (i > 0) {
          pdf.addPage();
        }
        pdf.addImage(imageData, "PNG", 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM);
      }

      pdf.save(`${categoryLabel || "karuta"}_絵札.pdf`);
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
              用紙: <a href="https://www.a-one.co.jp/product/search/detail.php?id=51677" target="_blank" rel="noopener noreferrer">エーワン マルチカード（マイクロミシン・厚口）A4・10面用</a><br />
              印刷ダイアログで「用紙サイズ: A4」「余白: なし」「拡大縮小: 実際のサイズ(100%)」「ヘッダーとフッター: オフ」に設定してください。
            </p>
            <div className="d-flex gap-3 justify-content-center flex-wrap">
              <button onClick={() => window.print()} className="btn btn-lg px-5 py-2 fw-bold rounded-pill shadow btn-karuta">
                印刷する
              </button>
              <button onClick={downloadPdf} disabled={isGeneratingPdf} className="btn btn-lg px-5 py-2 fw-bold rounded-pill shadow btn-outline-dark">
                {isGeneratingPdf ? "PDF生成中..." : "PDFをダウンロード"}
              </button>
            </div>
          </div>

          <div className="efuda-print-area">
            {efudaPages.map((page, pageIndex) => (
              <div className="efuda-page" key={pageIndex}>
                <div className="efuda-grid">
                  {Array.from({ length: efudaPerPage }).map((_, slotIndex) => {
                    const p = page.items[slotIndex];
                    return (
                      <div className="efuda-card" key={slotIndex}>
                        {p && (
                          <>
                            <p className="no-print text-muted small efuda-card-category">{p.category}</p>
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

export default PrintEfudaView;
