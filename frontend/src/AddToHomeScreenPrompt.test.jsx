import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import AddToHomeScreenPrompt from "./AddToHomeScreenPrompt.jsx";

const IOS_SAFARI_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/604.1";
const IOS_CHROME_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME_UA = "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";
const DESKTOP_CHROME_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const setUserAgent = (ua) => {
  Object.defineProperty(window.navigator, "userAgent", { value: ua, configurable: true });
};

const setStandalone = (matches) => {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: query === "(display-mode: standalone)" ? matches : false,
    media: query,
  }));
};

describe("AddToHomeScreenPrompt", () => {
  const originalUA = window.navigator.userAgent;

  beforeEach(() => {
    localStorage.clear();
    setStandalone(false);
  });

  afterEach(() => {
    setUserAgent(originalUA);
  });

  it("すでにホーム画面に追加済み（standalone）の場合は何も表示しない", () => {
    setUserAgent(IOS_SAFARI_UA);
    setStandalone(true);

    const { container } = render(<AddToHomeScreenPrompt />);

    expect(container).toBeEmptyDOMElement();
  });

  it("iOS Safariの場合はホーム画面追加の案内を表示する", () => {
    setUserAgent(IOS_SAFARI_UA);

    render(<AddToHomeScreenPrompt />);

    expect(screen.getByText(/ホーム画面に追加」を選ぶ/)).toBeInTheDocument();
  });

  it("iOSでもSafari以外（CriOSを含むUA）の場合は案内を表示しない", () => {
    setUserAgent(IOS_CHROME_UA);

    const { container } = render(<AddToHomeScreenPrompt />);

    expect(container).toBeEmptyDOMElement();
  });

  it("Android/iOSどちらの条件にも当てはまらない場合は何も表示しない", () => {
    setUserAgent(DESKTOP_CHROME_UA);

    const { container } = render(<AddToHomeScreenPrompt />);

    expect(container).toBeEmptyDOMElement();
  });

  it("iOSの案内を閉じると非表示になり、localStorageに保存されて再訪時も表示されない", () => {
    setUserAgent(IOS_SAFARI_UA);

    render(<AddToHomeScreenPrompt />);
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));

    expect(screen.queryByText(/ホーム画面に追加」を選ぶ/)).not.toBeInTheDocument();
    expect(localStorage.getItem("a2hsPromptDismissed")).toBe("true");

    const { container } = render(<AddToHomeScreenPrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it("beforeinstallpromptイベントを受け取ると独自の追加ボタンを表示し、クリックでprompt()を呼ぶ", async () => {
    setUserAgent(ANDROID_CHROME_UA);
    render(<AddToHomeScreenPrompt />);

    const promptFn = vi.fn();
    const event = new Event("beforeinstallprompt", { cancelable: true });
    event.prompt = promptFn;
    event.userChoice = Promise.resolve({ outcome: "accepted" });

    await act(async () => {
      window.dispatchEvent(event);
    });

    expect(screen.getByText("ホーム画面に追加できます")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "追加する" }));
      await event.userChoice;
    });

    expect(promptFn).toHaveBeenCalled();
    expect(localStorage.getItem("a2hsPromptDismissed")).toBe("true");
  });

  it("appinstalledイベントを受け取ると案内を非表示にする", async () => {
    setUserAgent(ANDROID_CHROME_UA);
    render(<AddToHomeScreenPrompt />);

    const event = new Event("beforeinstallprompt", { cancelable: true });
    event.prompt = vi.fn();
    event.userChoice = Promise.resolve({ outcome: "accepted" });
    await act(async () => {
      window.dispatchEvent(event);
    });
    expect(screen.getByText("ホーム画面に追加できます")).toBeInTheDocument();

    await act(async () => {
      window.dispatchEvent(new Event("appinstalled"));
    });

    expect(screen.queryByText("ホーム画面に追加できます")).not.toBeInTheDocument();
  });
});
