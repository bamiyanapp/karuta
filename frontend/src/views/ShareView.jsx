import ViewHeader from "../components/ViewHeader";
import AppVersionInfo from "../components/AppVersionInfo";
import ShareUrlCard from "../components/ShareUrlCard";

// アプリ共有画面（issue #1429）。QuizRoomInfoViewの招待URL共有（issue #547）と同じ
// QRコード・URLコピーのUI（ShareUrlCard）を使い、アプリのトップURLを共有できるようにする
function ShareView({ setView }) {
  const appUrl = `${window.location.origin}${window.location.pathname}`;

  return (
    <div className="container py-4 mx-auto">
      <ViewHeader onBack={() => setView("game")} title="このアプリを共有する" />
      <main className="mx-auto text-center" style={{ maxWidth: "600px" }}>
        <ShareUrlCard url={appUrl} />
      </main>
      <div className="text-center mt-4">
        <AppVersionInfo />
      </div>
    </div>
  );
}

export default ShareView;
