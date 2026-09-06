import { Component } from "react";

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
    // 再現条件が未特定のため、発生時のスタックトレースをコンソールへ残す。
    // 本番の集約ログ基盤は無く、これが唯一の手がかりになる
    console.error("ErrorBoundaryが例外を捕捉しました:", error, errorInfo);
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
