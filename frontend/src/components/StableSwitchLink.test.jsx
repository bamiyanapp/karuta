import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import StableSwitchLink from "./StableSwitchLink";

describe("StableSwitchLink（issue #1329）", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("stableビルド（通常ビルド）では何も表示しない", () => {
    vi.stubEnv("MODE", "production");
    const { container } = render(<StableSwitchLink />);
    expect(container).toBeEmptyDOMElement();
  });

  it("canaryビルドでは/stable/へのリンクを表示する", () => {
    vi.stubEnv("MODE", "canary");
    render(<StableSwitchLink />);
    const link = screen.getByRole("link", { name: "画面に問題がある場合はこちら" });
    expect(link).toHaveAttribute("href", expect.stringContaining("/stable/"));
  });

  it("canaryビルドでは現在のクエリ文字列を維持したまま/stable/へ遷移する", () => {
    vi.stubEnv("MODE", "canary");
    vi.stubGlobal("location", { ...window.location, search: "?category=foo" });
    render(<StableSwitchLink />);
    const link = screen.getByRole("link", { name: "画面に問題がある場合はこちら" });
    // issue #1540: 末尾スラッシュ無しだとCloudFront Functions側のindex.html
    // 自動補完が効かずエラーになるため、/stable/の形を維持する
    expect(link).toHaveAttribute("href", "/stable/?category=foo");
  });
});
