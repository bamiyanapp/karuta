import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const useRegisterSWMock = vi.fn();

vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: () => useRegisterSWMock(),
}));

import PwaUpdatePrompt from "./PwaUpdatePrompt.jsx";
import { setPrintScreenActive } from "./pdfExportStatus";

describe("PwaUpdatePrompt", () => {
  beforeEach(() => {
    useRegisterSWMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    // pdfExportStatusはモジュール単位で状態を共有するため、他テストへ漏れないよう戻す
    setPrintScreenActive(false);
  });

  it("更新が不要な場合は何も表示しない", () => {
    useRegisterSWMock.mockReturnValue({
      needRefresh: [false, vi.fn()],
      offlineReady: [false, vi.fn()],
      updateServiceWorker: vi.fn(),
    });

    const { container } = render(<PwaUpdatePrompt />);

    expect(container).toBeEmptyDOMElement();
  });

  it("仮想モジュールがない場合はエラーにならず何も表示しない", () => {
    useRegisterSWMock.mockReturnValue(undefined);

    const { container } = render(<PwaUpdatePrompt />);

    expect(container).toBeEmptyDOMElement();
  });

  it("更新が必要な場合はボタンを表示し、クリックでService Workerを更新する", () => {
    const updateServiceWorker = vi.fn();
    useRegisterSWMock.mockReturnValue({
      needRefresh: [true, vi.fn()],
      offlineReady: [false, vi.fn()],
      updateServiceWorker,
    });

    render(<PwaUpdatePrompt />);

    expect(screen.getByText("新しいバージョンがあります")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "更新する" }));

    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it("更新が必要な場合で「閉じる」をクリックすると表示が消える", () => {
    const setNeedRefresh = vi.fn();
    useRegisterSWMock.mockReturnValue({
      needRefresh: [true, setNeedRefresh],
      offlineReady: [false, vi.fn()],
      updateServiceWorker: vi.fn(),
    });

    render(<PwaUpdatePrompt />);

    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));

    expect(setNeedRefresh).toHaveBeenCalledWith(false);
  });

  it("オフライン利用可能な場合はメッセージを表示し、「閉じる」をクリックで消える", () => {
    const setOfflineReady = vi.fn();
    useRegisterSWMock.mockReturnValue({
      needRefresh: [false, vi.fn()],
      offlineReady: [true, setOfflineReady],
      updateServiceWorker: vi.fn(),
    });

    render(<PwaUpdatePrompt />);

    expect(screen.getByText("オフラインで利用可能になりました")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));

    expect(setOfflineReady).toHaveBeenCalledWith(false);
  });

  it("オフライン利用可能な場合、position: fixedで下部の他の要素のクリックを塞ぎ続けないよう、5秒後に自動で消える", () => {
    vi.useFakeTimers();
    const setOfflineReady = vi.fn();
    useRegisterSWMock.mockReturnValue({
      needRefresh: [false, vi.fn()],
      offlineReady: [true, setOfflineReady],
      updateServiceWorker: vi.fn(),
    });

    render(<PwaUpdatePrompt />);

    expect(setOfflineReady).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(setOfflineReady).toHaveBeenCalledWith(false);
    vi.useRealTimers();
  });

  it("絵札PDF印刷画面を開いている間はオフライン利用可能でもメッセージを表示しない（issue #473）", () => {
    setPrintScreenActive(true);
    useRegisterSWMock.mockReturnValue({
      needRefresh: [false, vi.fn()],
      offlineReady: [true, vi.fn()],
      updateServiceWorker: vi.fn(),
    });

    const { container } = render(<PwaUpdatePrompt />);

    expect(screen.queryByText("オフラインで利用可能になりました")).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("絵札PDF印刷画面を開いていなければオフライン利用可能メッセージが表示される（issue #473）", () => {
    setPrintScreenActive(false);
    useRegisterSWMock.mockReturnValue({
      needRefresh: [false, vi.fn()],
      offlineReady: [true, vi.fn()],
      updateServiceWorker: vi.fn(),
    });

    render(<PwaUpdatePrompt />);

    expect(screen.getByText("オフラインで利用可能になりました")).toBeInTheDocument();
  });

  it("更新が必要な場合（ユーザーの判断を要する）は自動では消えない", () => {
    vi.useFakeTimers();
    const setNeedRefresh = vi.fn();
    useRegisterSWMock.mockReturnValue({
      needRefresh: [true, setNeedRefresh],
      offlineReady: [false, vi.fn()],
      updateServiceWorker: vi.fn(),
    });

    render(<PwaUpdatePrompt />);

    act(() => {
      vi.advanceTimersByTime(60000);
    });

    expect(setNeedRefresh).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
