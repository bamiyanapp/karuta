import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE_URL } from "../config";
import { phraseKey } from "../utils/phraseKey";
import { getMainAudio, unlockAudioPlayback } from "../utils/audioUnlock";

// 未読み札から次に読み上げる1件を選ぶ（プリフェッチと実際の選択で同じロジックを使う）
const pickTargetPhrase = (unreadPhrases, sortOrder) => {
  if (sortOrder === "easy") {
    return [...unreadPhrases].sort((a, b) => (a.averageDifficulty || 0) - (b.averageDifficulty || 0))[0];
  }
  if (sortOrder === "hard") {
    return [...unreadPhrases].sort((a, b) => (b.averageDifficulty || 0) - (a.averageDifficulty || 0))[0];
  }
  // eslint-disable-next-line sonarjs/pseudo-random -- かるたの札をランダムに選ぶだけの用途で暗号学的な強度は不要
  const randomIndex = Math.floor(Math.random() * unreadPhrases.length);
  return unreadPhrases[randomIndex];
};

// 履歴（カテゴリ別）へ既読の札を追加する。同じ札が既に記録済みなら何もしない
const appendToHistory = (historyByCategory, categoryKey, phraseData) => {
  const currentList = historyByCategory[categoryKey] || [];
  const alreadyRecorded = currentList.some(p => p.id === phraseData.id && p.category === phraseData.category);
  if (alreadyRecorded) {
    return historyByCategory;
  }
  return {
    ...historyByCategory,
    [categoryKey]: [phraseData, ...currentList]
  };
};

// 読み上げ・札めくり進行（音声再生・タイマー・フェード演出・結果確定）をまとめた
// カスタムhook（issue #607）。元々はApp.jsx本体に直接展開されていたが、責務単位で
// 切り出した。issue #729（自動読み上げモードの途中停止）の原因調査・修正が完了する
// までは、既存バグとリファクタリング起因の不具合の切り分けが難しくなるため着手を
// 見送っていた（issue #729は最終的に自動読み上げモード自体の廃止で解決したため、
// このhookに自動読み上げ関連の仕組みは含まれない）
export function useKarutaReading({
  selectedCategories,
  allPhrasesForCategory,
  categoryKey,
  currentHistory,
  setHistoryByCategory,
  sortOrder,
  repeatCount,
  speechRate,
  lang,
  voiceId,
  isMultiCategorySelection,
  quizRoomActiveRef,
  cardRevealDelay = 3000,
}) {
  const [currentPhrase, setCurrentPhrase] = useState(null);
  // クイズ大会モード（issue #781）: 参加者への「次の札」ブロードキャストを、管理者自身の
  // 画面演出（イントロ音声＋3秒待ち＋フェード）を待たずに行えるよう、その演出が始まる前の
  // 時点（currentPhraseの更新と同時）で確定する値を別途保持する。displayContentの更新を
  // 待つと、演出時間の分だけ参加者側の表示が管理者より遅れてしまっていた
  const [broadcastPhrase, setBroadcastPhrase] = useState(null);
  const [displayContent, setDisplayContent] = useState({ type: "initial" });
  const [isFadingOut, setIsFadingOut] = useState(false);
  const nextContentRef = useRef(null);
  const animationResolveRef = useRef(null);

  const [audioQueue, setAudioQueue] = useState([]);
  const [isReading, setIsReading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isAllRead, setIsAllRead] = useState(false);

  const flipTimeoutRef = useRef(null);
  const startTimeRef = useRef(null);
  const currentAudioRef = useRef(null);
  const stopRequestedRef = useRef(false);
  const prefetchedNextRef = useRef(null);
  // 「次の札」連打対策（issue #590）: loadingは処理の後半（フェードアウト待ち完了後）に
  // ならないとtrueにならず、押下直後の連打を防げないため、押下と同時に同期的に
  // 立てられる再入防止用のrefを別途持つ
  const playKarutaInFlightRef = useRef(false);

  // 途中の札はaudioQueueが直前の再生完了まで次の音声を溜めておくため、読み上げ中に
  // 「次の札」を押しても現在の再生を止めずに済む。しかし最後の1枚だけは次に読む札が
  // 無いため、押した瞬間にplayKarutaInternalが即座に全札読了（おめでとう画面）へ
  // 進んでしまい、最後の音声が最後まで再生されないまま打ち切られる（issue #721）。
  // この最後の1枚を読み上げている間だけ「次の札」を無効化する
  const isReadingLastPhrase = useMemo(() => {
    if (!isReading) return false;
    const readKeys = new Set(currentHistory.map(phraseKey));
    return allPhrasesForCategory.every(p => readKeys.has(phraseKey(p)));
  }, [isReading, currentHistory, allPhrasesForCategory]);

  useEffect(() => {
    if (isFadingOut) {
      const timer = setTimeout(() => {
        setDisplayContent(nextContentRef.current);
        setIsFadingOut(false);
      }, 500); // CSSのtransition時間と合わせる
      return () => clearTimeout(timer);
    } else {
      // isFadingOut が false になったとき = フェードイン完了
      if (animationResolveRef.current) {
        animationResolveRef.current();
        animationResolveRef.current = null;
      }
    }
  }, [isFadingOut]);

  const playAudio = useCallback((audioData, { useSharedElement = false } = {}) => {
    return new Promise((resolve, reject) => {
      // ブラウザの自動再生ポリシー対策（issue #997）: クイズ大会モードの管理者による
      // 本編読み上げは、「次の札」クリックからplayIntroSound・（クイズ大会モードのみ）
      // 3秒待機・フェード演出を経て非同期にここへ到達する。その都度new Audio()すると、
      // その要素自体はユーザー操作の中で一度も再生されておらず、Safari等の自動再生
      // ポリシーにブロックされ続けてしまう（audioUnlock.jsのコメント参照）。参加者側
      // （QuizRoomView.jsx）と同じ、あらかじめunlockAudioPlayback()で解錠済みの共有
      // <audio>要素（audioUnlock.js）を再利用することで、非同期文脈からの再生でも
      // 許可されるようにする
      const audio = useSharedElement ? getMainAudio() : new Audio(audioData);
      if (useSharedElement) {
        audio.pause();
        audio.src = audioData;
      }
      let settled = false;
      // モバイルブラウザ等の環境によっては、audio.play()のPromiseが拒否も解決も
      // されないまま待機し続けることがある（issue #729）。onended/onerrorの
      // どちらも発火せずハングすると、これを直列でawaitしている読み上げ進行全体
      // （次の札の表示・読み上げ）が永久に止まってしまうため、上限時間で強制的に
      // 諦めて先へ進める。
      // stopReading()がcurrentAudioRef.current.resolve()を直接呼ぶ経路も
      // このsettleResolve経由にし、タイマー解除とsettledフラグを確実に揃える
      const AUDIO_TIMEOUT_MS = 15000;
      const settleResolve = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        if (currentAudioRef.current?.audio === audio) currentAudioRef.current = null;
        resolve();
      };
      currentAudioRef.current = { audio, resolve: settleResolve };
      const timeoutId = setTimeout(() => {
        if (settled) return;
        console.error("Audio playback timed out (issue #729)");
        settleResolve();
      }, AUDIO_TIMEOUT_MS);
      audio.onended = () => {
        settleResolve();
      };
      audio.onerror = (e) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        if (currentAudioRef.current?.audio === audio) currentAudioRef.current = null;
        reject(e);
      };
      audio.play().catch(e => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        if (currentAudioRef.current?.audio === audio) currentAudioRef.current = null;
        reject(e);
      });
    });
  }, []);

  const playIntroSound = useCallback(async () => {
    try {
      await playAudio("wadodon.mp3");
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.error("Intro sound failed:", error);
    }
  }, [playAudio]);

  useEffect(() => {
    const playNextInQueue = async () => {
      if (isReading || audioQueue.length === 0) {
        return;
      }

      setIsReading(true);
      const { phraseData, audioData, playbackSettings } = audioQueue[0];

      if (phraseData) {
        setCurrentPhrase(phraseData);

        setHistoryByCategory(prev => appendToHistory(prev, categoryKey, phraseData));
      }

      await playIntroSound();
      // 停止ボタンが押されていたら、次のフェーズ（本編読み上げ）に進まず打ち切る
      if (stopRequestedRef.current) {
        stopRequestedRef.current = false;
        setIsReading(false);
        return;
      }

      let animationPromise = Promise.resolve();

      if (phraseData) {
        // 読み上げ開始タイミングで計測開始（リピート再生時は計測中の開始点を上書きしない）
        startTimeRef.current = Date.now();

        // クイズ大会モード（issue #781）: 参加者へのブロードキャストはここ（本編読み上げ・
        // 経過時間計測の開始と同時）で確定する。setCurrentPhraseと同時（イントロ音声より前）
        // に確定すると、revealCurrentResult()がstartTimeRef.currentを前提にしている
        // （未設定なら早押し正解の即時結果確定が無視される）ため、参加者がイントロ音声の
        // 再生中に早押しした場合に正解処理が効かなくなってしまう。startTimeRef.currentの
        // 設定と同じタイミングにすることで、ブロードキャストを受け取った時点では常に
        // 経過時間計測が開始済みであることを保証する
        setBroadcastPhrase({ content: phraseData, playbackSettings });

        if (flipTimeoutRef.current) {
          clearTimeout(flipTimeoutRef.current);
          flipTimeoutRef.current = null;
        }

        animationPromise = new Promise(resolve => {
          animationResolveRef.current = resolve;
        });

        // cardRevealDelay（既定3秒、設定画面で変更可能。issue #471）待機してから
        // フェードアニメーションを開始
        flipTimeoutRef.current = setTimeout(() => {
          nextContentRef.current = { type: "phrase", content: phraseData, playbackSettings };
          setIsFadingOut(true);
        }, cardRevealDelay);

        // クイズ大会モード（issue #861）: 参加者側はWebSocketブロードキャストの受信・
        // 画面反映（ネットワーク往復＋バックエンドのpostToConnection処理）に一定の
        // 時間がかかるため、上のsetBroadcastPhraseの直後に管理者自身の本編読み上げを
        // 開始すると、参加者側の札めくりが管理者の読み上げより体感で遅れて見える。
        // ブロードキャスト自体を早める恒久対応は経過時間計測（startTimeRef.current、
        // 上のコメント参照）と絡み合い難しいため、暫定対応として管理者自身の読み上げ
        // 開始だけを3秒遅らせ、参加者側が追いつく猶予を設ける
        if (quizRoomActiveRef?.current) {
          await new Promise(resolve => setTimeout(resolve, 3000));
          if (stopRequestedRef.current) {
            stopRequestedRef.current = false;
            setIsReading(false);
            return;
          }
        }
      }

      await playAudio(audioData, { useSharedElement: true }).catch(e => console.error("Audio playback failed:", e));
      if (stopRequestedRef.current) {
        stopRequestedRef.current = false;
        setIsReading(false);
        return;
      }

      await animationPromise;
      if (stopRequestedRef.current) {
        stopRequestedRef.current = false;
        setIsReading(false);
        return;
      }

      // phraseDataが無い（repeatPhrase由来の音声のみの再生）場合は、表示中の画面
      // （phrase/result/initialいずれの状態でも）を変えずに音声だけ再生する。
      // 以前はここで表示をinitialへ強制的に戻していたが、読み上げ中のカードを
      // クリックして「もう一度」再生しただけで画面が準備完了画面に戻ってしまう
      // 不具合（issue #729の調査で判明）だったため、表示状態の変更自体をやめた

      setAudioQueue(prev => prev.slice(1));
      setIsReading(false);
    };

    playNextInQueue();

    return () => {
      if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current);
    }
  }, [audioQueue, isReading, playAudio, playIntroSound, categoryKey, setHistoryByCategory, quizRoomActiveRef, cardRevealDelay]);

  // 現在の札を読み上げている間に、次に読み上げる予定の札の音声を先読みしておく
  useEffect(() => {
    if (!isReading || selectedCategories.length === 0 || allPhrasesForCategory.length === 0) {
      return;
    }

    const readKeys = new Set(currentHistory.map(phraseKey));
    const unreadPhrases = allPhrasesForCategory.filter(p => !readKeys.has(phraseKey(p)));
    if (unreadPhrases.length === 0) {
      return;
    }

    const announceCategory = isMultiCategorySelection;
    const settingsSignature = JSON.stringify({ repeatCount, speechRate, lang, voiceId, announceCategory, sortOrder });

    const alreadyPrefetched = prefetchedNextRef.current;
    if (
      alreadyPrefetched &&
      alreadyPrefetched.settingsSignature === settingsSignature &&
      unreadPhrases.some(p => p.id === alreadyPrefetched.phrase.id && p.category === alreadyPrefetched.phrase.category)
    ) {
      return;
    }

    const nextTargetPhrase = pickTargetPhrase(unreadPhrases, sortOrder);
    let cancelled = false;

    const apiUrl = `${API_BASE_URL}/get-phrase?id=${nextTargetPhrase.id}&category=${encodeURIComponent(nextTargetPhrase.category)}&repeatCount=${repeatCount}&speechRate=${encodeURIComponent(speechRate)}&lang=${lang}&voiceId=${encodeURIComponent(voiceId)}&announceCategory=${announceCategory}`;

    fetch(apiUrl)
      .then(response => response.json().then(data => ({ ok: response.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled || !ok) return;
        prefetchedNextRef.current = { phrase: nextTargetPhrase, data, settingsSignature };
      })
      .catch(error => {
        console.error("Error prefetching next phrase:", error);
      });

    return () => {
      cancelled = true;
    };
  }, [isReading, selectedCategories, allPhrasesForCategory, currentHistory, sortOrder, repeatCount, speechRate, lang, voiceId, isMultiCategorySelection]);

  const playCongratulationAudio = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/get-congratulation-audio?speechRate=${encodeURIComponent(speechRate)}&lang=${lang}&voiceId=${encodeURIComponent(voiceId)}`);
      const data = await response.json();
      if (response.ok) {
        await playAudio(data.audioData);
      }
    } catch {
      alert("送信に失敗しました。");
    }
  };

  // 現在読み上げ中の札の結果（経過時間・難易度・答え）を確定し、フェードアウト
  // 演出を経て結果画面へ切り替える。通常は「次の札」押下時（playKarutaInternal）に
  // しか呼ばれないが、クイズ大会モードで早押しが正解と判定された時点（issue #600）
  // にも即座に呼ばれる。これにより、経過時間は「正解が出るまで」で確定し、結果画面
  // （答え表示）も「次の札」を待たずに即座に切り替わる。呼び出し後にstartTimeRef.current
  // をnullへ戻すため、後から「次の札」が押されてplayKarutaInternalが実行されても
  // この結果確定処理は再実行されない（二重計測・上書きの防止）
  const revealCurrentResult = async (winner) => {
    const targetPhrase = currentPhrase;
    if (!startTimeRef.current || !targetPhrase) return;

    const elapsedTime = (Date.now() - startTimeRef.current) / 1000;
    startTimeRef.current = null;

    setHistoryByCategory(prev => {
      const newHistory = { ...prev };
      if (newHistory[categoryKey] && newHistory[categoryKey].length > 0) {
        const updatedCategoryHistory = [...newHistory[categoryKey]];
        const lastReadPhrase = updatedCategoryHistory[0];
        if (lastReadPhrase.id === targetPhrase.id && lastReadPhrase.category === targetPhrase.category) {
          // クイズ大会モードの正解者表示（issue #695）: winnerは早押しが正解と
          // 判定された参加者名。クイズ大会モード以外・誰も正解しなかった場合はnull
          updatedCategoryHistory[0] = { ...lastReadPhrase, elapsedTime: elapsedTime.toFixed(2), winner: winner ?? null };
          newHistory[categoryKey] = updatedCategoryHistory;
        }
      }
      return newHistory;
    });

    const totalCount = allPhrasesForCategory.filter(p => p.category === targetPhrase.category).length || 1;
    const historyCount = currentHistory.filter(p => p.category === targetPhrase.category).length || 1;
    const remainingCount = Math.max(1, totalCount - (historyCount - 1));
    let difficulty = elapsedTime / remainingCount;

    if (!isFinite(difficulty) || isNaN(difficulty)) {
      difficulty = 0;
    }

    if (targetPhrase.id && targetPhrase.category && isFinite(elapsedTime) && !isNaN(elapsedTime)) {
      const isFast = targetPhrase.averageTime > 0 && elapsedTime < targetPhrase.averageTime;

      nextContentRef.current = {
        type: "result",
        content: { time: elapsedTime, difficulty, isFast, answer: targetPhrase.answer, explanation: targetPhrase.explanation, winner: winner ?? null },
      };

      // 結果表示のフェード完了を待ってから次の札の取得・再生に進む。
      // 待たずに次の札をすぐキューへ入れると、次の札側のフリップ完了待ち
      // （animationResolveRef）をこの結果表示のフェード完了が誤って解決して
      // しまい、次の札の表示が中断される不具合があったため、明示的に区切る。
      const resultFadePromise = new Promise(resolve => {
        animationResolveRef.current = resolve;
      });
      setIsFadingOut(true);

      fetch(`${API_BASE_URL}/record-time`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: targetPhrase.id,
          category: targetPhrase.category,
          time: elapsedTime,
          difficulty: difficulty,
        }),
      }).catch((error) => {
        console.error("Error recording time:", error);
      });

      await resultFadePromise;
    }
  };

  const playKarutaInternal = async () => {
    await revealCurrentResult();

    if (selectedCategories.length === 0 || allPhrasesForCategory.length === 0) return;

    try {
      const readKeys = new Set(currentHistory.map(phraseKey));
      let unreadPhrases = allPhrasesForCategory.filter(p => !readKeys.has(phraseKey(p)));

      if (unreadPhrases.length === 0) {
        setIsAllRead(true);
        await playCongratulationAudio();
        return;
      }

      const announceCategory = isMultiCategorySelection;
      const settingsSignature = JSON.stringify({ repeatCount, speechRate, lang, voiceId, announceCategory, sortOrder });
      const prefetched = prefetchedNextRef.current;
      let data;

      if (
        prefetched &&
        prefetched.settingsSignature === settingsSignature &&
        unreadPhrases.some(p => p.id === prefetched.phrase.id && p.category === prefetched.phrase.category)
      ) {
        // プリフェッチ済みの音声データをそのまま使い、取得待ちをスキップする
        data = prefetched.data;
        prefetchedNextRef.current = null;
      } else {
        const targetPhrase = pickTargetPhrase(unreadPhrases, sortOrder);

        const apiUrl = `${API_BASE_URL}/get-phrase?id=${targetPhrase.id}&category=${encodeURIComponent(targetPhrase.category)}&repeatCount=${repeatCount}&speechRate=${encodeURIComponent(speechRate)}&lang=${lang}&voiceId=${encodeURIComponent(voiceId)}&announceCategory=${announceCategory}`;
        const response = await fetch(apiUrl);
        data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Fetch failed");
        }
      }

      // クイズ大会モード（issue #498）: このデータの取得に実際に使った設定を音声と一緒に
      // 保持しておき、後で参加者へブロードキャストする際もこの値を使う。読み上げ開始まで
      // 数秒の遅延があり、その間に管理者が設定を変更すると、ブロードキャスト時点の最新設定を
      // 読むと「管理者が実際に聞いている音声」とズレてしまうため
      setAudioQueue(prev => [...prev, {
        phraseData: data,
        audioData: data.audioData,
        playbackSettings: { repeatCount, speechRate, lang, voiceId, announceCategory },
      }]);

    } catch (error) {
      console.error("Error fetching phrase:", error);
      alert("通信エラーが発生しました: " + error.message);
    }
  };

  const playKaruta = async () => {
    if (playKarutaInFlightRef.current) return;
    playKarutaInFlightRef.current = true;
    // ブラウザの自動再生ポリシー対策（issue #997）: 本編読み上げ（playAudioの共有
    // <audio>要素）はこの後の非同期処理（fetch・クイズ大会モードの3秒待機等）を
    // 経てから再生されるため、クリックという実際のユーザー操作の中で同期的に
    // 解錠しておく必要がある
    unlockAudioPlayback();
    setLoading(true);

    try {
      await playKarutaInternal();
    } finally {
      setLoading(false);
      playKarutaInFlightRef.current = false;
    }
  };

  // 「もう一度」ボタン・読み札カードのクリックからの再生依頼を受け取る。呼び出し側
  // （App.jsx）が対象の音声データ（現在読み上げ中の札、または詳細画面で開いている札）を
  // 決定し、このhookはそれをキューへ積んで再生する処理だけを担う
  const queueRepeatAudio = (audioData) => {
    // ブラウザの自動再生ポリシー対策（issue #997）: playAudioが使う共有<audio>要素を、
    // このボタン押下という実際のユーザー操作の中で同期的に解錠しておく
    unlockAudioPlayback();
    setAudioQueue(prev => [...prev, { phraseData: null, audioData }]);
  };

  // keepElapsedTime: クイズ大会モードで早押しが発生した際（issue #788）に
  // useQuizRoomAdminのonBuzzから呼ぶ場合はtrueにする。早押しは読み上げの中断
  // ではなく一時停止（judgeQuizRoomBuzzが正解と判定すればrevealCurrentResultで
  // 経過時間を確定し、不正解ならそのまま「次の札」まで計測を続ける）であり、
  // startTimeRef.currentを消してしまうとどちらの経路でも経過時間が確定できなくなる。
  // 通常の「停止」ボタン（読み上げ自体を打ち切る操作）ではfalseのまま、
  // 中断された計測を次回の記録に持ち越さないようにする
  const stopReading = ({ keepElapsedTime = false } = {}) => {
    if (!isReading) return;

    // playNextInQueue内のawaitチェーンを、次の工程（本編読み上げ・フェード）に
    // 進ませずに打ち切るためのフラグ
    stopRequestedRef.current = true;

    if (currentAudioRef.current) {
      const { audio, resolve } = currentAudioRef.current;
      audio.pause();
      currentAudioRef.current = null;
      resolve();
    }

    if (flipTimeoutRef.current) {
      clearTimeout(flipTimeoutRef.current);
      flipTimeoutRef.current = null;
    }

    if (animationResolveRef.current) {
      animationResolveRef.current();
      animationResolveRef.current = null;
    }

    if (!keepElapsedTime) {
      // 中断された読み上げの計測を、次回の記録に誤って持ち越さないようにする
      startTimeRef.current = null;
    }

    // 停止は音声・タイマーの中断のみを行い、画面表示は変更しない（issue #755）。
    // 以前はここで表示を強制的にinitial（準備完了画面）へ戻していたが、読み上げ中の
    // 画面を見ながら停止したユーザーが、押した瞬間に画面が切り替わってしまうのは
    // 不適切な挙動だった
    setIsFadingOut(false);
    setAudioQueue([]);
    setIsReading(false);
  };

  // かるたの種類選び直し・カテゴリのやり直し（resetGame/restartCategory）で共通して
  // 必要な、このhookが持つ読み上げ進行状態のリセット
  const resetReadingState = () => {
    setCurrentPhrase(null);
    setBroadcastPhrase(null);
    setDisplayContent({ type: "initial" });
    setIsAllRead(false);
    setIsFadingOut(false);
  };

  return {
    currentPhrase,
    broadcastPhrase,
    displayContent,
    isFadingOut,
    isReading,
    loading,
    isAllRead,
    isReadingLastPhrase,
    playKaruta,
    queueRepeatAudio,
    stopReading,
    revealCurrentResult,
    resetReadingState,
  };
}
