import { useEffect, useRef, useState } from "react";

// 録音の最大長（これ以上待たずに認識へ回す）。長すぎる録音はTranscribeの
// 課金・レイテンシが増えるため、短い発話であるkarutaの回答に十分な範囲で区切る
const MAX_RECORDING_MS = 8000;
const POLL_INTERVAL_MS = 1500;
const MAX_POLL_ATTEMPTS = 10; // 15秒（POLL_INTERVAL_MS×MAX_POLL_ATTEMPTS）待っても完了しない場合はタイムアウト扱いにする

function blobToDataUri(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// listeningがtrueの間、マイクから音声を録音し、dev-standards側と同様のAWS構成
// （S3アップロード→Transcribeジョブ）で解析する。結果（正誤・認識テキスト）は
// onResultへコールバックする。MediaRecorder/getUserMedia未対応環境では
// status: "unsupported" を返し、録音自体を行わない（フィーチャーディテクション）。
//
// phraseId/categoryは呼び出し側の再レンダーごとに新しいオブジェクトが渡されがちな
// `phrase`をそのまま依存配列に使うと録音が意図せず再開してしまうため、
// プリミティブ値として個別に受け取る。onResultは同様の理由でrefに退避し、
// 依存配列には含めない（useWakeLockのactiveと同じ考え方）。
export function useVoiceAnswerRecognition({ listening, phraseId, category, apiBaseUrl, lang, onResult }) {
  const [status, setStatus] = useState("idle");
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    if (!listening || !phraseId || !category) {
      return undefined;
    }
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      return undefined;
    }

    let cancelled = false;
    let stopTimeout = null;
    let mediaRecorder = null;
    let mediaStream = null;

    const stopStream = () => {
      mediaStream?.getTracks().forEach((track) => track.stop());
    };

    const run = async () => {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stopStream();
          return;
        }

        const chunks = [];
        mediaRecorder = new MediaRecorder(mediaStream);
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunks.push(e.data);
          }
        };
        const stopped = new Promise((resolve) => {
          mediaRecorder.onstop = resolve;
        });

        setStatus("recording");
        mediaRecorder.start();
        stopTimeout = setTimeout(() => {
          if (mediaRecorder.state !== "inactive") {
            mediaRecorder.stop();
          }
        }, MAX_RECORDING_MS);

        await stopped;
        stopStream();
        if (cancelled) {
          return;
        }

        setStatus("uploading");
        const blob = new Blob(chunks, { type: mediaRecorder.mimeType || "audio/webm" });
        const audioData = await blobToDataUri(blob);

        const startResponse = await fetch(`${apiBaseUrl}/start-speech-recognition`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audioData, id: phraseId, category, lang }),
        });
        if (!startResponse.ok) {
          throw new Error(`start-speech-recognition failed: ${startResponse.status}`);
        }
        const { jobName } = await startResponse.json();
        if (cancelled) {
          return;
        }

        setStatus("processing");
        for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
          await sleep(POLL_INTERVAL_MS);
          if (cancelled) {
            return;
          }
          const resultResponse = await fetch(
            `${apiBaseUrl}/get-speech-recognition-result?jobName=${encodeURIComponent(jobName)}` +
              `&id=${encodeURIComponent(phraseId)}&category=${encodeURIComponent(category)}`
          );
          if (!resultResponse.ok) {
            throw new Error(`get-speech-recognition-result failed: ${resultResponse.status}`);
          }
          const result = await resultResponse.json();
          if (cancelled) {
            return;
          }
          if (result.status === "COMPLETED") {
            setStatus("idle");
            onResultRef.current?.({ isCorrect: result.isCorrect, transcript: result.transcript });
            return;
          }
          if (result.status === "FAILED") {
            setStatus("idle");
            onResultRef.current?.({ error: result.message || "recognition failed" });
            return;
          }
        }
        setStatus("idle");
        onResultRef.current?.({ error: "timeout" });
      } catch (error) {
        stopStream();
        if (!cancelled) {
          setStatus("idle");
          onResultRef.current?.({ error: error.message });
        }
      }
    };

    run();

    return () => {
      cancelled = true;
      if (stopTimeout) {
        clearTimeout(stopTimeout);
      }
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
      }
      stopStream();
    };
  }, [listening, phraseId, category, apiBaseUrl, lang]);

  return { status };
}
