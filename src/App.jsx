import { useEffect, useMemo, useRef, useState } from 'react';
import { fixWebmDuration } from '@fix-webm-duration/fix';
import ChatMessage from './components/ChatMessage';
import PlayerControls from './components/PlayerControls';
import { EXPORT_HEIGHT, EXPORT_WIDTH, renderExportFrame } from './utils/renderExportFrame';
import { buildSrt, buildSubtitleJson } from './utils/subtitleExport';

const DEFAULT_SCRIPT = `A: Hey, are you free tonight?
B: Maybe. Why?
A: There is a small live jazz show downtown.
B: That sounds nice. What time does it start?
A: At seven thirty. We can grab dinner before that.
B: Okay, text me the address later.
A: Perfect. See you tonight.`;

const DEFAULT_AUDIO_SOURCE = `${import.meta.env.BASE_URL}demo-audio.wav`;
const DEFAULT_SPEAKER_MODE = 'two';
const DEFAULT_SESSION_TITLE = 'CET-6-2026-6-1-Conversation 1';
const SESSION_TITLE_STORAGE_KEY = 'bubble-session-title';
const SCRIPT_STORAGE_KEY = 'chatcue-script-text';
const SPEAKER_MODE_STORAGE_KEY = 'chatcue-speaker-mode';
const MEDIA_MODE_STORAGE_KEY = 'chatcue-media-mode';
const BUBBLE_FONT_SIZE_STORAGE_KEY = 'bubble-font-size';
const GITHUB_REPO_URL = 'https://github.com/PrideWood/chatcue';
const DEFAULT_BUBBLE_FONT_SIZE = 22;
const MIN_BUBBLE_FONT_SIZE = 18;
const MAX_BUBBLE_FONT_SIZE = 32;
const BUBBLE_FONT_SIZE_STEP = 2;
const RECORDING_FRAME_RATE = 30;
const RECORDING_VIDEO_BITS_PER_SECOND = 36_000_000;
const RECORDING_AUDIO_BITS_PER_SECOND = 256_000;

function getSupportedVideoMimeType(hasAudio = false) {
  if (typeof MediaRecorder === 'undefined') {
    return '';
  }

  const candidates = hasAudio ? [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp8',
    'video/webm',
  ] : [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];

  return candidates.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) || '';
}

function buildExportFileName(sessionTitle) {
  const safeTitle = (sessionTitle || 'chat-export')
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fa5-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'chat-export';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  return `${safeTitle}-${timestamp}.webm`;
}

function buildDownloadFileName(sessionTitle, extension) {
  const safeTitle = (sessionTitle || 'chat-export')
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fa5-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'chat-export';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  return `${safeTitle}-${timestamp}.${extension}`;
}

function downloadTextFile(content, fileName, type) {
  const blob = new Blob([content], { type });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = downloadUrl;
  link.download = fileName;
  link.click();

  setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
}

function downloadBlob(blob, fileName) {
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = downloadUrl;
  link.download = fileName;
  link.click();

  setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
}

function parseScriptText(scriptText) {
  return scriptText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const matched = line.match(/^([A-Za-z])\s*:\s*(.+)$/);

      if (!matched) {
        return {
          id: `queue-${index + 1}`,
          speakerLabel: null,
          text: line,
        };
      }

      return {
        id: `queue-${index + 1}`,
        speakerLabel: matched[1].toUpperCase(),
        text: matched[2].trim(),
      };
    });
}

function resolveOutgoingSide(requestedSide, speakerMode) {
  if (speakerMode === 'single') {
    return 'left';
  }

  return requestedSide === 'right' ? 'right' : 'left';
}

function getStoredScriptText() {
  if (typeof window === 'undefined') {
    return DEFAULT_SCRIPT;
  }

  const storedScript = localStorage.getItem(SCRIPT_STORAGE_KEY);
  return storedScript === null ? DEFAULT_SCRIPT : storedScript;
}

function getStoredSpeakerMode() {
  if (typeof window === 'undefined') {
    return DEFAULT_SPEAKER_MODE;
  }

  const storedMode = localStorage.getItem(SPEAKER_MODE_STORAGE_KEY);
  return storedMode === 'single' || storedMode === 'two' ? storedMode : DEFAULT_SPEAKER_MODE;
}

function getInitialMediaSource() {
  if (typeof window === 'undefined') {
    return DEFAULT_AUDIO_SOURCE;
  }

  return localStorage.getItem(MEDIA_MODE_STORAGE_KEY) === 'custom' ? '' : DEFAULT_AUDIO_SOURCE;
}

function getInitialMediaFileName() {
  if (typeof window === 'undefined') {
    return 'demo-audio.wav';
  }

  return localStorage.getItem(MEDIA_MODE_STORAGE_KEY) === 'custom'
    ? 'Custom media previously used — reselect required'
    : 'demo-audio.wav';
}

function App() {
  const audioRef = useRef(null);
  const listRef = useRef(null);
  const exportCanvasRef = useRef(null);
  const exportRecorderRef = useRef(null);
  const exportAnimationRef = useRef(null);
  const exportChunksRef = useRef([]);
  const exportFrameStateRef = useRef(null);
  const exportShouldDownloadRef = useRef(false);
  const recordingStartedAtRef = useRef(null);
  const recordingElapsedMsRef = useRef(0);
  const recordingDurationMsRef = useRef(0);
  const uploadedAudioUrlRef = useRef(null);
  const [scriptText, setScriptText] = useState(() => getStoredScriptText());
  const [initialQueue, setInitialQueue] = useState(() => parseScriptText(getStoredScriptText()));
  const [pendingQueue, setPendingQueue] = useState(() => parseScriptText(getStoredScriptText()));
  const [sentMessages, setSentMessages] = useState([]);
  const [activeMessageId, setActiveMessageId] = useState(null);
  const [audioSource, setAudioSource] = useState(() => getInitialMediaSource());
  const [audioFileName, setAudioFileName] = useState(() => getInitialMediaFileName());
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speakerMode, setSpeakerMode] = useState(() => getStoredSpeakerMode());
  const [recordingState, setRecordingState] = useState('idle');
  const [exportStatus, setExportStatus] = useState(`Ready: ${EXPORT_WIDTH}x${EXPORT_HEIGHT} webm`);
  const [bubbleFontSize, setBubbleFontSize] = useState(() => {
    if (typeof window === 'undefined') {
      return DEFAULT_BUBBLE_FONT_SIZE;
    }

    const storedSize = Number(localStorage.getItem(BUBBLE_FONT_SIZE_STORAGE_KEY));
    return Number.isFinite(storedSize)
      ? Math.min(MAX_BUBBLE_FONT_SIZE, Math.max(MIN_BUBBLE_FONT_SIZE, storedSize))
      : DEFAULT_BUBBLE_FONT_SIZE;
  });
  const [sessionTitle, setSessionTitle] = useState(() => {
    if (typeof window === 'undefined') {
      return DEFAULT_SESSION_TITLE;
    }

    return localStorage.getItem(SESSION_TITLE_STORAGE_KEY) || DEFAULT_SESSION_TITLE;
  });

  const queueStarted = sentMessages.length > 0 || pendingQueue.length !== initialQueue.length;
  const nextMessage = pendingQueue[0] || null;
  const isRecordingSessionActive = recordingState !== 'idle';

  const queueSummary = useMemo(
    () => ({
      remaining: pendingQueue.length,
      delivered: sentMessages.length,
      total: initialQueue.length,
    }),
    [initialQueue.length, pendingQueue.length, sentMessages.length],
  );

  const renderedMessages = useMemo(
    () => sentMessages,
    [sentMessages],
  );

  const nextPreview = nextMessage
    ? {
        ...nextMessage,
        side: resolveOutgoingSide('left', speakerMode),
      }
    : null;

  useEffect(() => {
    exportFrameStateRef.current = {
      title: sessionTitle,
      messages: renderedMessages,
      bubbleFontSize,
    };

    if (exportCanvasRef.current) {
      renderExportFrame(exportCanvasRef.current, exportFrameStateRef.current);
    }
  }, [bubbleFontSize, renderedMessages, sessionTitle]);

  useEffect(() => {
    if (!listRef.current) {
      return;
    }

    listRef.current.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [sentMessages.length]);

  useEffect(() => {
    localStorage.setItem(SESSION_TITLE_STORAGE_KEY, sessionTitle);
  }, [sessionTitle]);

  useEffect(() => {
    localStorage.setItem(SCRIPT_STORAGE_KEY, scriptText);
  }, [scriptText]);

  useEffect(() => {
    localStorage.setItem(SPEAKER_MODE_STORAGE_KEY, speakerMode);
  }, [speakerMode]);

  useEffect(() => {
    localStorage.setItem(BUBBLE_FONT_SIZE_STORAGE_KEY, String(bubbleFontSize));
  }, [bubbleFontSize]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      return undefined;
    }

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration || 0);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioSource]);

  const syncQueueFromText = (nextScriptText) => {
    const parsed = parseScriptText(nextScriptText);
    setInitialQueue(parsed);
    setPendingQueue(parsed);
    setSentMessages([]);
    setActiveMessageId(null);
  };

  const handleScriptChange = (event) => {
    const nextValue = event.target.value;
    setScriptText(nextValue);

    if (!queueStarted) {
      const parsed = parseScriptText(nextValue);
      setInitialQueue(parsed);
      setPendingQueue(parsed);
    }
  };

  const handleAudioUpload = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const nextSource = URL.createObjectURL(file);
    const audio = audioRef.current;

    if (audio) {
      audio.pause();
    }

    if (uploadedAudioUrlRef.current) {
      URL.revokeObjectURL(uploadedAudioUrlRef.current);
    }

    uploadedAudioUrlRef.current = nextSource;

    setAudioSource(nextSource);
    setAudioFileName(file.name);
    localStorage.setItem(MEDIA_MODE_STORAGE_KEY, 'custom');
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  };

  const togglePlay = async () => {
    const audio = audioRef.current;

    if (!audio || !(audio.currentSrc || audio.src)) {
      return;
    }

    if (audio.paused) {
      if (recordingState === 'paused') {
        const resumed = resumeExportRecording();

        if (!resumed) {
          return;
        }
      }

      await audio.play();
      return;
    }

    if (recordingState === 'recording') {
      pauseExportRecording();
    }

    audio.pause();
  };

  const seekTo = (time) => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    audio.currentTime = time;
    setCurrentTime(time);
  };

  const sendNextMessage = (requestedSide) => {
    if (pendingQueue.length === 0) {
      return;
    }

    const [nextItem, ...restQueue] = pendingQueue;
    const resolvedSide = resolveOutgoingSide(requestedSide, speakerMode);
    const audio = audioRef.current;
    const startTime = audio ? audio.currentTime : currentTime;
    const deliveredMessage = {
      ...nextItem,
      side: resolvedSide,
      startTime,
    };
    setPendingQueue(restQueue);
    setSentMessages((current) => [...current, deliveredMessage]);
    setActiveMessageId(deliveredMessage.id);
  };

  const undoLastMessage = () => {
    if (sentMessages.length === 0) {
      return;
    }

    const restoredMessage = sentMessages[sentMessages.length - 1];
    const remainingMessages = sentMessages.slice(0, -1);
    setSentMessages(remainingMessages);
    setPendingQueue((current) => [restoredMessage, ...current]);
    setActiveMessageId(remainingMessages.length > 0 ? remainingMessages[remainingMessages.length - 1].id : null);
  };

  const resetSession = () => {
    const parsed = parseScriptText(scriptText);
    const audio = audioRef.current;

    setInitialQueue(parsed);
    setPendingQueue(parsed);
    setSentMessages([]);
    setActiveMessageId(null);

    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }

    setCurrentTime(0);
    setIsPlaying(false);
  };

  const changeBubbleFontSize = (direction) => {
    setBubbleFontSize((current) => {
      const nextSize = current + direction * BUBBLE_FONT_SIZE_STEP;
      return Math.min(MAX_BUBBLE_FONT_SIZE, Math.max(MIN_BUBBLE_FONT_SIZE, nextSize));
    });
  };

  const exportSrt = () => {
    if (sentMessages.length === 0) {
      return;
    }

    downloadTextFile(
      buildSrt(sentMessages, duration),
      buildDownloadFileName(sessionTitle, 'srt'),
      'text/plain;charset=utf-8',
    );
  };

  const exportJson = () => {
    if (sentMessages.length === 0) {
      return;
    }

    downloadTextFile(
      buildSubtitleJson(sentMessages, duration),
      buildDownloadFileName(sessionTitle, 'json'),
      'application/json;charset=utf-8',
    );
  };

  const getActiveRecordingDurationMs = () => {
    const activeSegmentMs = recordingStartedAtRef.current
      ? performance.now() - recordingStartedAtRef.current
      : 0;

    return Math.max(1, Math.round(recordingElapsedMsRef.current + activeSegmentMs));
  };

  const pauseRecordingClock = () => {
    if (!recordingStartedAtRef.current) {
      return;
    }

    recordingElapsedMsRef.current += performance.now() - recordingStartedAtRef.current;
    recordingStartedAtRef.current = null;
  };

  const resumeRecordingClock = () => {
    recordingStartedAtRef.current = performance.now();
  };

  const startExportRecording = () => {
    if (exportRecorderRef.current && exportRecorderRef.current.state !== 'inactive') {
      return false;
    }

    if (typeof MediaRecorder === 'undefined') {
      setExportStatus('Recording is not supported in this browser');
      return false;
    }

    const canvas = exportCanvasRef.current;

    if (!canvas || !canvas.captureStream) {
      setExportStatus('Canvas recording is not supported in this browser');
      return false;
    }

    const audio = audioRef.current;
    const audioStream = audio?.captureStream?.() || audio?.mozCaptureStream?.();
    const mimeType = getSupportedVideoMimeType(Boolean(audioStream));
    const canvasStream = canvas.captureStream(RECORDING_FRAME_RATE);
    const stream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...(audioStream ? audioStream.getAudioTracks() : []),
    ]);
    let recorder;

    const recorderOptions = {
      videoBitsPerSecond: RECORDING_VIDEO_BITS_PER_SECOND,
      audioBitsPerSecond: RECORDING_AUDIO_BITS_PER_SECOND,
    };

    if (mimeType) {
      recorderOptions.mimeType = mimeType;
    }

    try {
      recorder = new MediaRecorder(stream, recorderOptions);
    } catch (error) {
      stream.getTracks().forEach((track) => track.stop());
      setExportStatus('Unable to start recorder');
      return false;
    }

    exportChunksRef.current = [];
    exportShouldDownloadRef.current = false;
    recordingElapsedMsRef.current = 0;
    recordingDurationMsRef.current = 0;
    resumeRecordingClock();

    const drawLoop = () => {
      if (exportFrameStateRef.current) {
        renderExportFrame(canvas, exportFrameStateRef.current);
      }
      exportAnimationRef.current = requestAnimationFrame(drawLoop);
    };

    recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) {
        exportChunksRef.current.push(event.data);
      }
    });

    recorder.addEventListener('stop', async () => {
      if (exportAnimationRef.current) {
        cancelAnimationFrame(exportAnimationRef.current);
        exportAnimationRef.current = null;
      }

      stream.getTracks().forEach((track) => track.stop());

      if (!exportShouldDownloadRef.current) {
        exportRecorderRef.current = null;
        exportChunksRef.current = [];
        recordingElapsedMsRef.current = 0;
        recordingDurationMsRef.current = 0;
        recordingStartedAtRef.current = null;
        setRecordingState('idle');
        setExportStatus(`Ready: ${EXPORT_WIDTH}x${EXPORT_HEIGHT} webm`);
        return;
      }

      const rawBlob = new Blob(exportChunksRef.current, { type: recorder.mimeType || mimeType || 'video/webm' });
      const fileName = buildExportFileName(sessionTitle);
      let finalBlob = rawBlob;

      try {
        setExportStatus('Fixing WebM metadata...');
        finalBlob = await fixWebmDuration(rawBlob, recordingDurationMsRef.current, { logger: false });
      } catch (error) {
        setExportStatus('Metadata fix failed. Downloading raw WebM...');
      }

      downloadBlob(finalBlob, fileName);
      exportRecorderRef.current = null;
      exportChunksRef.current = [];
      exportShouldDownloadRef.current = false;
      recordingElapsedMsRef.current = 0;
      recordingDurationMsRef.current = 0;
      recordingStartedAtRef.current = null;
      setRecordingState('idle');
      setExportStatus(
        finalBlob === rawBlob
          ? `Saved raw ${EXPORT_WIDTH}x${EXPORT_HEIGHT} webm`
          : `Saved fixed ${EXPORT_WIDTH}x${EXPORT_HEIGHT} webm`,
      );
    });

    renderExportFrame(canvas, exportFrameStateRef.current || {
      title: sessionTitle,
      messages: renderedMessages,
      bubbleFontSize,
    });
    drawLoop();
    recorder.start(1000);
    exportRecorderRef.current = recorder;
    setRecordingState('recording');
    const actualVideoBitrate = recorder.videoBitsPerSecond || RECORDING_VIDEO_BITS_PER_SECOND;
    setExportStatus(
      `${audioStream ? 'Recording video + audio' : 'Recording video only'} · ${recorder.mimeType || 'browser webm'} · ${Math.round(actualVideoBitrate / 1_000_000)} Mbps`,
    );
    return true;
  };

  const finishExportRecording = () => {
    if (!exportRecorderRef.current || exportRecorderRef.current.state === 'inactive') {
      return;
    }

    exportShouldDownloadRef.current = true;
    pauseRecordingClock();
    recordingDurationMsRef.current = getActiveRecordingDurationMs();
    exportRecorderRef.current.stop();
    setRecordingState('finalizing');
    setExportStatus('Preparing download...');
  };

  const discardExportRecording = () => {
    const recorder = exportRecorderRef.current;

    if (!recorder || recorder.state === 'inactive' || recordingState === 'finalizing') {
      return;
    }

    exportShouldDownloadRef.current = false;
    exportChunksRef.current = [];
    recordingElapsedMsRef.current = 0;
    recordingDurationMsRef.current = 0;
    recordingStartedAtRef.current = null;
    recorder.stop();
    setRecordingState('idle');
    setExportStatus('Recording discarded. Ready to start again.');

    const audio = audioRef.current;

    if (audio) {
      audio.pause();
    }
  };

  const pauseExportRecording = () => {
    const recorder = exportRecorderRef.current;

    if (!recorder || recorder.state !== 'recording') {
      return;
    }

    if (typeof recorder.pause !== 'function') {
      setExportStatus('Recorder pause is not supported in this browser.');
      return;
    }

    pauseRecordingClock();
    recorder.pause();
    setRecordingState('paused');
    setExportStatus('Recording paused. Press Space to resume, or E / Finish Record to save.');
  };

  const resumeExportRecording = () => {
    const recorder = exportRecorderRef.current;

    if (!recorder || recorder.state !== 'paused') {
      return false;
    }

    if (typeof recorder.resume !== 'function') {
      setExportStatus('Recorder resume is not supported in this browser.');
      return false;
    }

    resumeRecordingClock();
    recorder.resume();
    setRecordingState('recording');
    setExportStatus('Recording resumed...');
    return true;
  };

  const playMedia = async () => {
    const audio = audioRef.current;

    if (!audio || !(audio.currentSrc || audio.src) || !audio.paused) {
      return;
    }

    await audio.play();
  };

  const startRecordAndPlayback = async () => {
    if (recordingState === 'finalizing') {
      return;
    }

    if (recordingState === 'idle') {
      const exportStarted = startExportRecording();

      if (!exportStarted) {
        return;
      }

      try {
        await playMedia();
      } catch (error) {
        setExportStatus('Recording started, but media playback was blocked');
      }
      return;
    }
  };

  const handleRecordButtonClick = () => {
    if (recordingState === 'idle') {
      void startRecordAndPlayback();
      return;
    }

    finishRecordAndPause();
  };

  const finishRecordAndPause = () => {
    if (recordingState === 'idle' || recordingState === 'finalizing') {
      return;
    }

    finishExportRecording();

    const audio = audioRef.current;

    if (audio) {
      audio.pause();
    }
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      const target = event.target;
      const isTypingField =
        target instanceof HTMLElement &&
        (target.tagName === 'TEXTAREA' ||
          target.tagName === 'INPUT' ||
          target.isContentEditable);

      if (isTypingField) {
        return;
      }

      if (!document.hasFocus()) {
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        sendNextMessage('left');
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        sendNextMessage('right');
        return;
      }

      if (event.code === 'Space' || event.key === ' ') {
        event.preventDefault();
        void togglePlay();
        return;
      }

      if (event.key.toLowerCase() === 'r' && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        if (recordingState === 'idle') {
          void startRecordAndPlayback();
        }
        return;
      }

      if (event.key.toLowerCase() === 'e' && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        finishRecordAndPause();
        return;
      }

      if (event.key === 'Backspace' || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z')) {
        event.preventDefault();
        undoLastMessage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    bubbleFontSize,
    audioSource,
    isRecordingSessionActive,
    pendingQueue.length,
    recordingState,
    scriptText,
    sentMessages.length,
    sessionTitle,
    speakerMode,
  ]);

  useEffect(
    () => () => {
      if (uploadedAudioUrlRef.current) {
        URL.revokeObjectURL(uploadedAudioUrlRef.current);
      }

      if (exportAnimationRef.current) {
        cancelAnimationFrame(exportAnimationRef.current);
      }

      if (exportRecorderRef.current && exportRecorderRef.current.state !== 'inactive') {
        exportRecorderRef.current.stop();
      }
    },
    [],
  );

  return (
    <main className="app-shell">
      <section
        className="player-card manual-mode"
        style={{ '--bubble-font-size': `${bubbleFontSize}px` }}
      >
        <div className="workspace-grid">
          <section className="director-panel">
            <div className="control-shell">
              <div className="title-panel title-panel-top">
                <label className="title-label" htmlFor="session-title-input">
                  Session Title
                </label>
                <input
                  id="session-title-input"
                  className="title-input"
                  type="text"
                  value={sessionTitle}
                  onChange={(event) => setSessionTitle(event.target.value)}
                  placeholder="CET-6-2026-6-1-Conversation 1"
                />
              </div>

              <PlayerControls
                isPlaying={isPlaying}
                currentTime={currentTime}
                duration={duration}
                audioFileName={audioFileName}
                speakerMode={speakerMode}
                onTogglePlay={togglePlay}
                onSeek={seekTo}
                onAudioUpload={handleAudioUpload}
                onSendLeft={() => sendNextMessage('left')}
                onSendRight={() => sendNextMessage('right')}
                onUndo={undoLastMessage}
                onReset={resetSession}
                onModeChange={setSpeakerMode}
                onDecreaseBubbleFontSize={() => changeBubbleFontSize(-1)}
                onIncreaseBubbleFontSize={() => changeBubbleFontSize(1)}
                onStartExport={handleRecordButtonClick}
                onStopExport={handleRecordButtonClick}
                onDiscardExport={discardExportRecording}
                onExportSrt={exportSrt}
                onExportJson={exportJson}
                bubbleFontSize={bubbleFontSize}
                bubbleFontSizeMin={MIN_BUBBLE_FONT_SIZE}
                bubbleFontSizeMax={MAX_BUBBLE_FONT_SIZE}
                recordingState={recordingState}
                exportStatus={exportStatus}
                sendDisabled={pendingQueue.length === 0}
                undoDisabled={sentMessages.length === 0}
                subtitleExportDisabled={sentMessages.length === 0}
              />

              <div className="queue-panel">
                <div className="panel-head">
                  <div>
                    <h2>Queue Script</h2>
                    <p>One line = one message. Use prefixes like `A:` or `B:` to label speakers.</p>
                  </div>
                  <button
                    type="button"
                    className="tool-button reload-queue-button"
                    onClick={() => syncQueueFromText(scriptText)}
                  >
                    Reload
                  </button>
                </div>

                <div className="next-preview">
                  <span className="preview-label">Next line</span>
                  <div className="preview-card">
                    {nextPreview ? (
                      <>
                        <strong>
                          {nextPreview.speakerLabel
                            ? `Speaker ${nextPreview.speakerLabel}`
                            : speakerMode === 'single'
                              ? 'Single Speaker'
                              : 'Next queued line'}
                        </strong>
                        <p>{nextPreview.text}</p>
                      </>
                    ) : null}
                  </div>
                </div>

                <textarea
                  className="script-textarea"
                  value={scriptText}
                  onChange={handleScriptChange}
                  placeholder="A: Hello&#10;B: Hi"
                  spellCheck="false"
                />

                <div className="queue-stats">
                  <div className="stat-card">
                    <span className="stat-label">Remaining</span>
                    <strong>{queueSummary.remaining}</strong>
                  </div>
                  <div className="stat-card">
                    <span className="stat-label">Sent</span>
                    <strong>{queueSummary.delivered}</strong>
                  </div>
                  <div className="stat-card">
                    <span className="stat-label">Loaded</span>
                    <strong>{queueSummary.total}</strong>
                  </div>
                </div>

                <div className="shortcut-note">
                  <span>`Left Arrow` Send Left</span>
                  <span>`Right Arrow` Send Right</span>
                  <span>`Space` Play/Pause</span>
                  <span>`R` Start Record</span>
                  <span>`E` Finish Record</span>
                  <span>`Backspace` or `Cmd/Ctrl+Z` Undo</span>
                </div>

              </div>
            </div>
          </section>

          <section className="chat-stage">
            <div className="crop-frame">
              <span className="crop-marker crop-marker-top-left" aria-hidden="true" />
              <span className="crop-marker crop-marker-top-right" aria-hidden="true" />
              <span className="crop-marker crop-marker-bottom-left" aria-hidden="true" />
              <span className="crop-marker crop-marker-bottom-right" aria-hidden="true" />
              {recordingState === 'recording' ? (
                <span className="recording-indicator">·REC</span>
              ) : null}
              {recordingState === 'paused' ? (
                <span className="recording-indicator recording-indicator-paused">·PAUSE</span>
              ) : null}
              <div className="chat-frame">
                <div className="chat-title-bar">
                  <p className="chat-title">{sessionTitle || 'Untitled Session'}</p>
                </div>
                <div className="chat-shell" ref={listRef}>
                  {renderedMessages.map((message) => (
                    <ChatMessage
                      key={message.id}
                      message={message}
                      isActive={activeMessageId === message.id}
                      onSeek={null}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        <video
          key={audioSource || 'no-media'}
          ref={audioRef}
          className="media-source"
          preload="metadata"
          playsInline
          src={audioSource || undefined}
        />
        <canvas
          ref={exportCanvasRef}
          className="export-canvas"
          width={EXPORT_WIDTH}
          height={EXPORT_HEIGHT}
          aria-hidden="true"
        />
      </section>
      <a
        className="github-float"
        href={GITHUB_REPO_URL}
        target="_blank"
        rel="noreferrer"
        aria-label="Open ChatCue repository on GitHub"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            fill="currentColor"
            d="M12 2C6.48 2 2 6.58 2 12.26c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-1.05-.01-1.9-2.78.62-3.37-1.22-3.37-1.22-.45-1.19-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.35 1.12 2.92.86.09-.67.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 6.97c.85 0 1.7.12 2.5.34 1.9-1.33 2.74-1.05 2.74-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.95.68 1.92 0 1.38-.01 2.49-.01 2.83 0 .27.18.59.69.49A10.1 10.1 0 0 0 22 12.26C22 6.58 17.52 2 12 2Z"
          />
        </svg>
      </a>
    </main>
  );
}

export default App;
