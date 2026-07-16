import { useCallback, useEffect, useRef, useState } from "react";

const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 5; // 際限ない再接続ループを防ぐための上限
// プッシュ通知（updateStateのブロードキャスト）が何らかの理由で届かなかった場合に備え、
// 一定間隔でsyncを再要求し自己修復させる保険（本来はプッシュのみで完結するはずだが、
// 個別のブロードキャスト送信が届かないケースを完全には排除できないため）
const SYNC_POLL_INTERVAL_MS = 5000;

// クイズ大会モード（issue #470）のWebSocket接続を管理する。adminTokenを渡すと管理者として、
// 渡さなければ参加者（閲覧専用）として接続する。サーバーから状態（{type:"state", state, role}）を
// 受け取るたびonStateを呼ぶ。管理者はbroadcastStateで新しい状態を送信できる
export function useQuizRoomSync({ wsBaseUrl, roomId, adminToken, onState }) {
  const [internalStatus, setInternalStatus] = useState("idle"); // connecting|connected|error（idleはwsBaseUrl/roomId未設定時に導出する）
  const connectionStatus = (!wsBaseUrl || !roomId) ? "idle" : internalStatus;
  const wsRef = useRef(null);
  const onStateRef = useRef(onState);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);
  const closedByCleanupRef = useRef(false);
  const pollTimerRef = useRef(null);
  // broadcastStateに渡された直近の状態。接続確立前（初回接続のLambdaコールド
  // スタート・WSハンドシェイク中）やその後の再接続中にbroadcastStateが呼ばれると、
  // それまではreadyState !== OPENのため送信が黙って失われ、参加者側の画面が
  // 永久に更新されない不具合があった。openのたびにこの値を送り直すことで解消する
  const pendingStateRef = useRef(null);

  useEffect(() => {
    onStateRef.current = onState;
  }, [onState]);

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
          return;
        }
        reconnectAttemptsRef.current += 1;
        setInternalStatus("connecting");
        reconnectTimeoutRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
      };
    };

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

  const broadcastState = useCallback((state) => {
    pendingStateRef.current = state;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: "updateState", state }));
    }
  }, []);

  return { connectionStatus, broadcastState };
}
