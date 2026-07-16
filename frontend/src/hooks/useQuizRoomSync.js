import { useCallback, useEffect, useRef, useState } from "react";

const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 5; // 際限ない再接続ループを防ぐための上限
// プッシュ通知（updateStateのブロードキャスト）が何らかの理由で届かなかった場合に備え、
// 一定間隔でsyncを再要求し自己修復させる保険（本来はプッシュのみで完結するはずだが、
// 個別のブロードキャスト送信が届かないケースを完全には排除できないため）
const SYNC_POLL_INTERVAL_MS = 5000;

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
export function useQuizRoomSync({ wsBaseUrl, roomId, adminToken, onState, onBuzz, onPoints, onNameError, onRoundReset }) {
  const [internalStatus, setInternalStatus] = useState("idle"); // connecting|connected|error（idleはwsBaseUrl/roomId未設定時に導出する）
  const connectionStatus = (!wsBaseUrl || !roomId) ? "idle" : internalStatus;
  const wsRef = useRef(null);
  const onStateRef = useRef(onState);
  const onBuzzRef = useRef(onBuzz);
  const onPointsRef = useRef(onPoints);
  const onNameErrorRef = useRef(onNameError);
  const onRoundResetRef = useRef(onRoundReset);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);
  const closedByCleanupRef = useRef(false);
  const pollTimerRef = useRef(null);
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

  return { connectionStatus, broadcastState, setParticipantName, buzz, judgeBuzz };
}
