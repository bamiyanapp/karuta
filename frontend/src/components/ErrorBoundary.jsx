import { Component } from "react";
import { API_BASE_URL } from "../config";

// issue #1106: 札をめくった後に画面が真っ白になり操作不能になる事象が報告されたが、
// 再現条件が特定できていない。本アプリにはError Boundaryが1つも無く、
// どこか1箇所でレンダリング中の例外が未捕捉のまま投げられると、Reactが
// ツリー全体をアンマウントしてしまい、真っ白な画面のまま何も操作できなくなる
// （実際に報告された症状と一致する）。根本原因が未特定の間の再発防止策として、
// アプリ全体をError Boundaryで包み、例外発生時にリロードで復帰できる
// フォールバック画面を出す。原因調査用にconsole.errorへ詳細も出力する
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // ブラウザのコンソールへも残すが、開発環境がスマートフォンオンリーのため
    // 事後にはほぼ確認できない（issue #1110）。サーバーサイド（CloudWatch Logs）にも
    // 残すため、record-time等と同様のfire-and-forget方式（送信失敗はもみ消し、
    // アプリの他の動作に影響させない）でreport-client-errorへ送信する。
    // プレイ内容（読み上げ中のフレーズ等）は個人情報・利用状況の詳細にあたるため
    // 送信しない
    console.error("ErrorBoundaryが例外を捕捉しました:", error, errorInfo);

    fetch(`${API_BASE_URL}/report-client-error`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error?.message,
        stack: error?.stack,
        componentStack: errorInfo?.componentStack,
        url: window.location.href,
      }),
    }).catch(() => {
      // 送信自体が失敗しても、フォールバック画面の表示（recover手段の提供）を
      // 妨げてはならないため何もしない
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="d-flex flex-column justify-content-center align-items-center text-center vh-100 p-4">
          <p className="fw-bold mb-3">エラーが発生しました</p>
          <p className="text-muted mb-4">
            画面を再読み込みしてください。繰り返し発生する場合はご報告ください。
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            再読み込み
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
