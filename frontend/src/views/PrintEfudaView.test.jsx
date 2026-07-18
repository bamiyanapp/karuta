import { render } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import PrintEfudaView from "./PrintEfudaView";
import { useIsPrintScreenActive, setPrintScreenActive } from "../pdfExportStatus";

// pdfExportStatusの現在値を画面に出すだけの補助コンポーネント（issue #473）。
// PwaUpdatePromptはmain.jsxでAppの兄弟としてマウントされておりPrintEfudaViewの
// props経由では確認できないため、共有storeの値を直接検証する
function IsPrintScreenActiveProbe() {
  const isActive = useIsPrintScreenActive();
  return <span data-testid="probe">{isActive ? "active" : "inactive"}</span>;
}

afterEach(() => {
  // モジュール単位で状態を共有するため、他テストへ漏れないよう戻す
  setPrintScreenActive(false);
});

describe("PrintEfudaView", () => {
  it("marks the print screen as active while mounted, and inactive again once unmounted (issue #473)", () => {
    const { getByTestId, unmount } = render(
      <>
        <PrintEfudaView
          categoryLabel="テスト"
          onBack={() => {}}
          selectedCategories={[]}
          allPhrasesForCategory={[]}
          efudaPages={[]}
          efudaPerPage={10}
        />
        <IsPrintScreenActiveProbe />
      </>
    );

    expect(getByTestId("probe").textContent).toBe("active");

    unmount();

    const { getByTestId: getByTestIdAfter } = render(<IsPrintScreenActiveProbe />);
    expect(getByTestIdAfter("probe").textContent).toBe("inactive");
  });
});
