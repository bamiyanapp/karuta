import { useCallback, useEffect, useRef, useState } from "react";

const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 5; // 際限ない再接続ループを防ぐための上限
// issue #614: 通常の再接続上限（5回・3秒間隔、約15秒）を使い切って"error"状態に
// 達した後も、画面がフォアグラウンド（visible）である間は完全には諦めず、この
// 緩い間隔で再試行を続ける。バックグラウンド中の無駄な再試行はせず、フォアグラウンド
// 復帰時（下記のvisibilitychangeハンドラ）に即座に再接続を試みる方に任せる
const ERROR_RETRY_INTERVAL_MS = 15000;
// プッシュ通知（updateStateのブロードキャスト）が何らかの理由で届かなかった場合に備え、
// 一定間隔でsyncを再要求し自己修復させる保険（本来はプッシュのみで完結するはずだが、
// 個別のブロードキャスト送信が届かないケースを完全には排除できないため）
const SYNC_POLL_INTERVAL_MS = 5000;

// connectionStatusの値ごとの表示ラベル。参加者画面（QuizRoomView.jsx）・
// 管理者画面（App.jsx、issue #614で追加）の両方で同じ表記を使うため共有する
export const CONNECTION_STATUS_LABEL = {
  idle: "未接続",
  connecting: "接続中...",
  connected: "接続済み",
  error: "接続できませんでした",
};

// クイズ大会モード（issue #470）のWebSocket接続を管理する。adminTokenを渡すと管理者として、
// 渡さなければ参加者（閲覧専用）として接続する。サーバーから状態（{type:"state", state, role}）を
// 受け取るたびonStateを呼ぶ。管理者はbroadcastStateで新しい状態を送信できる。
// 早押し機能（issue #510）: サーバーから{type:"buzz", name, connectionId}を受け取るたび
// onBuzzを呼ぶ。参加者はsetParticipantNameで表示名を、buzzで早押しを送信できる
// ポイント制（issue #519）: サーバーから{type:"points", points}（名前→累計ポイントの
// マップ）を受け取るたびonPointsを呼ぶ。名前が同一ルーム内で重複していた場合は
// {type:"nameError", message}が返るのでonNameErrorを呼ぶ
// 早押し正誤判定（issue #546）: 管理者はjudgeBuzzで正誤を送信できる。不正解と判定
// されたときはサーバーから{type:"roundReset", excludedName}が返るのでonRoundResetを呼ぶ
// 参加者一覧（issue #545）: サーバーから{type:"participants", names}（名前確定済みの
// 参加者名一覧）を受け取るたびonParticipantsを呼ぶ
export function useQuizRoomSync({ wsBaseUrl, roomId, adminToken, onState, onBuzz, onPoints, onNameError, onRoundReset, onParticipants }) {
  const [internalStatus, setInternalStatus] = useState("idle"); // connecting|connected|error（idleはwsBaseUrl/roomId未設定時に導出する）
  const connectionStatus = (!wsBaseUrl || !roomId) ? "idle" : internalStatus;
  const wsRef = useRef(null);
  const onStateRef = useRef(onState);
  const onBuzzRef = useRef(onBuzz);
  const onPointsRef = useRef(onPoints);
  const onNameErrorRef = useRef(onNameError);
  const onRoundResetRef = useRef(onRoundReset);
  const onParticipantsRef = useRef(onParticipants);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);
  const closedByCleanupRef = useRef(false);
  const pollTimerRef = useRef(null);
  // issue #614: connect自体はwsBaseUrl/roomId/adminTokenが変わるたびに再生成される
  // 別のuseEffect内で定義されるため、フォアグラウンド復帰・手動再接続（下記の
  // forceReconnect）から常に最新のconnectを呼べるようrefに保持する
  const connectRef = useRef(() => {});
  // broadcastStateに渡された直近の状態。接続確立前（初回接続のLambdaコールド
  // スタート・WSハンドシェイク中）やその後の再接続中にbroadcastStateが呼ばれると、
  // それまではreadyState !== OPENのため送信が黙って失われ、参加者側の画面が
  // 永久に更新されない不具合があった。openのたびにこの値を送り直すことで解消する
  const pendingStateRef = useRef(null);
  // setParticipantNameも同様に、接続確立前に呼ばれた場合に備えて再送する（issue #510）
  const pendingNameRef = useRef(null);

  useEffect(() => {
    onStateRef.current = onState;
  }, [onState]);

  useEffect(() => {
    onBuzzRef.current = onBuzz;
  }, [onBuzz]);

  useEffect(() => {
    onPointsRef.current = onPoints;
  }, [onPoints]);

  useEffect(() => {
    onNameErrorRef.current = onNameError;
  }, [onNameError]);

  useEffect(() => {
    onRoundResetRef.current = onRoundReset;
  }, [onRoundReset]);

  useEffect(() => {
    onParticipantsRef.current = onParticipants;
  }, [onParticipants]);

  useEffect(() => {
    if (!wsBaseUrl || !roomId) {
      return undefined;
    }
    closedByCleanupRef.current = false;
    reconnectAttemptsRef.current = 0;
    pendingStateRef.current = null;

    const connect = () => {
      setInternalStatus("connecting");

      const url = new URL(wsBaseUrl);
      url.searchParams.set("roomId", roomId);
      if (adminToken) {
        url.searchParams.set("adminToken", adminToken);
      }

      const ws = new WebSocket(url.toString());
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptsRef.current = 0;
        setInternalStatus("connected");
        ws.send(JSON.stringify({ action: "sync" }));
        // 接続確立前にbroadcastStateが呼ばれていた場合（初回接続のタイミング競合・
        // 再接続時など）に備え、直近の状態を送り直す
        if (pendingStateRef.current !== null) {
          ws.send(JSON.stringify({ action: "updateState", state: pendingStateRef.current }));
        }
        if (pendingNameRef.current !== null) {
          ws.send(JSON.stringify({ action: "setName", name: pendingNameRef.current }));
        }
        pollTimerRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ action: "sync" }));
          }
        }, SYNC_POLL_INTERVAL_MS);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data?.type === "state") {
            onStateRef.current?.(data.state, data.role);
          } else if (data?.type === "buzz") {
            onBuzzRef.current?.({ name: data.name, connectionId: data.connectionId });
          } else if (data?.type === "points") {
            onPointsRef.current?.(data.points);
          } else if (data?.type === "nameError") {
            onNameErrorRef.current?.(data.message);
          } else if (data?.type === "roundReset") {
            onRoundResetRef.current?.({ excludedName: data.excludedName });
          } else if (data?.type === "participants") {
            onParticipantsRef.current?.(data.names);
          }
        } catch (error) {
          console.error("Failed to parse quiz room message:", error);
        }
      };

      ws.onerror = () => {
        setInternalStatus("error");
      };

      ws.onclose = () => {
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        if (closedByCleanupRef.current) {
          return;
        }
        if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
          setInternalStatus("error");
          // issue #614: フォアグラウンドである間は、緩い間隔で再試行を続ける
          if (typeof document !== "undefined" && document.visibilityState === "visible") {
            reconnectTimeoutRef.current = setTimeout(connect, ERROR_RETRY_INTERVAL_MS);
          }
          return;
        }
        reconnectAttemptsRef.current += 1;
        setInternalStatus("connecting");
        reconnectTimeoutRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
      };
    };

    connectRef.current = connect;
    connect();

    return () => {
      closedByCleanupRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
      wsRef.current?.close();
    };
  }, [wsBaseUrl, roomId, adminToken]);

  // issue #614: スマホの画面ロック・バックグラウンド復帰後、WebSocketが切断された
  // ままになり自動再接続されないことがある（バックグラウンド中はブラウザが
  // タイマーをスロットリングするため、復帰前に再接続試行の上限を使い切って
  // しまうケースがある）。現在の接続が生きていなければ（readyState !== OPEN）、
  // 試行回数をリセットして即座に再接続する。フォアグラウンド復帰
  // （visibilitychange）・オンライン復帰（online）、および手動再接続ボタン
  // （戻り値のreconnect）の両方から使う共通の関数
  const forceReconnect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      // 古い接続のonclose/onerrorが、これから行う再接続と二重に反応しないよう、
      // 明示的に閉じる前にハンドラを外す
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
    }
    reconnectAttemptsRef.current = 0;
    connectRef.current();
  }, []);

  useEffect(() => {
    if (!wsBaseUrl || !roomId) {
      return undefined;
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        forceReconnect();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", forceReconnect);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", forceReconnect);
    };
  }, [wsBaseUrl, roomId, forceReconnect]);

  const broadcastState = useCallback((state) => {
    pendingStateRef.current = state;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: "updateState", state }));
    }
  }, []);

  // 早押し機能（issue #510）: 参加者が自分の表示名をサーバーへ保存する
  const setParticipantName = useCallback((name) => {
    pendingNameRef.current = name;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: "setName", name }));
    }
  }, []);

  // 早押し機能（issue #510）: 参加者が早押しボタンを押したことをサーバーへ送信する
  const buzz = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: "buzz" }));
    }
  }, []);

  // 早押し正誤判定（issue #546）: 管理者が早押しの正誤を判定してサーバーへ送信する
  const judgeBuzz = useCallback((correct) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: "judgeBuzz", correct }));
    }
  }, []);

  return { connectionStatus, broadcastState, setParticipantName, buzz, judgeBuzz, reconnect: forceReconnect };
}
