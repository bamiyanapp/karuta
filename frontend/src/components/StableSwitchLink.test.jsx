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

  it("canaryビルドでは/stableへのリンクを表示する", () => {
    vi.stubEnv("MODE", "canary");
    render(<StableSwitchLink />);
    const link = screen.getByRole("link", { name: /安定版への切り替え/ });
    expect(link).toHaveAttribute("href", expect.stringContaining("/stable"));
  });

  it("canaryビルドでは現在のクエリ文字列を維持したまま/stableへ遷移する", () => {
    vi.stubEnv("MODE", "canary");
    vi.stubGlobal("location", { ...window.location, search: "?category=foo" });
    render(<StableSwitchLink />);
    const link = screen.getByRole("link", { name: /安定版への切り替え/ });
    expect(link).toHaveAttribute("href", "/stable?category=foo");
  });
});
