import { vi, beforeEach } from 'vitest';
import { resetSharedAudioForTests } from '../utils/audioUnlock';

// Mock fetch
window.fetch = vi.fn();

// Mock Audio
// アプリ側は `new Audio(url)` のコンストラクタ引数でsrcを渡すため(後からの代入はしない)、
// コンストラクタ引数を受け取ったらsrcセッターと同じ処理を実行する。
// vitest v4はvi.fn()のモック実装をnewで呼び出す場合、アロー関数を許容しない
// （アロー関数は元々コンストラクタ不可というJS仕様どおりの挙動）ため、通常の関数式を使う
window.Audio = vi.fn().mockImplementation(function (url) {
  const audio = {
    play: vi.fn().mockResolvedValue(),
    pause: vi.fn(),
    load: vi.fn(),
    _src: undefined,
    get src() {
      return this._src;
    },
    // Simulate successful loading
    set src(url) {
      this._src = url;
      setTimeout(() => {
        if (this.oncanplaythrough) this.oncanplaythrough();
        // Simulate audio ending immediately for tests
        if (this.onended) setTimeout(this.onended, 0);
      }, 0);
    },
  };
  if (url) audio.src = url;
  return audio;
});

// Mock window.scrollTo
window.scrollTo = vi.fn();


// App.jsxを描画する各テストファイルが、共通のモックとbeforeEachを使うために呼ぶ。
// モジュールの読み込み時に、fetch・Audio・window.scrollToのモックを差し込む（テストファイルごとに独立）。
export function setupAppTest() {
  beforeEach(() => {
    window.fetch.mockClear();
    vi.clearAllMocks();
    // Reset URL
    window.history.pushState({}, '', '/');
    // 読み上げ履歴の永続化先（sessionStorage）をテスト間で引き継がないようにする
    sessionStorage.clear();
    // 共有<audio>要素（issue #514）はモジュールスコープのシングルトンなので、
    // テスト間で使い回されないようリセットする
    resetSharedAudioForTests();
  });
}
