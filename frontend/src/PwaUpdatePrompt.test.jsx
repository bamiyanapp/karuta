import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const useRegisterSWMock = vi.fn();

vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: () => useRegisterSWMock(),
}));

import PwaUpdatePrompt from "./PwaUpdatePrompt.jsx";

describe("PwaUpdatePrompt", () => {
  beforeEach(() => {
    useRegisterSWMock.mockReset();
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
});
