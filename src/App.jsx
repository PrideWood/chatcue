import { useEffect, useMemo, useRef, useState } from 'react';
import ChatMessage from './components/ChatMessage';
import PlayerControls from './components/PlayerControls';

const DEFAULT_SCRIPT = `A: Hey, are you free tonight?
B: Maybe. Why?
A: There is a small live jazz show downtown.
B: That sounds nice. What time does it start?
A: At seven thirty. We can grab dinner before that.
B: Okay, text me the address later.
A: Perfect. See you tonight.`;

const DEFAULT_AUDIO_SOURCE = '/demo-audio.wav';
const DEFAULT_SPEAKER_MODE = 'two';
const DEFAULT_SESSION_TITLE = 'CET-6-2026-6-1-Conversation 1';
const SESSION_TITLE_STORAGE_KEY = 'bubble-session-title';
const BUBBLE_FONT_SIZE_STORAGE_KEY = 'bubble-font-size';
const DEFAULT_BUBBLE_FONT_SIZE = 22;
const MIN_BUBBLE_FONT_SIZE = 18;
const MAX_BUBBLE_FONT_SIZE = 32;
const BUBBLE_FONT_SIZE_STEP = 2;

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

function App() {
  const audioRef = useRef(null);
  const listRef = useRef(null);
  const uploadedAudioUrlRef = useRef(null);
  const [scriptText, setScriptText] = useState(DEFAULT_SCRIPT);
  const [initialQueue, setInitialQueue] = useState(() => parseScriptText(DEFAULT_SCRIPT));
  const [pendingQueue, setPendingQueue] = useState(() => parseScriptText(DEFAULT_SCRIPT));
  const [sentMessages, setSentMessages] = useState([]);
  const [activeMessageId, setActiveMessageId] = useState(null);
  const [audioSource, setAudioSource] = useState(DEFAULT_AUDIO_SOURCE);
  const [audioFileName, setAudioFileName] = useState('demo-audio.wav');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speakerMode, setSpeakerMode] = useState(DEFAULT_SPEAKER_MODE);
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
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  };

  const togglePlay = async () => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    if (audio.paused) {
      await audio.play();
      return;
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
    const deliveredMessage = {
      ...nextItem,
      side: resolvedSide,
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

      if (event.code === 'Space') {
        event.preventDefault();
        void togglePlay();
        return;
      }

      if (event.key === 'Backspace' || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z')) {
        event.preventDefault();
        undoLastMessage();
        return;
      }

      if (event.key.toLowerCase() === 'r' && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        resetSession();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingQueue.length, scriptText, sentMessages.length, speakerMode]);

  useEffect(
    () => () => {
      if (uploadedAudioUrlRef.current) {
        URL.revokeObjectURL(uploadedAudioUrlRef.current);
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
                bubbleFontSize={bubbleFontSize}
                bubbleFontSizeMin={MIN_BUBBLE_FONT_SIZE}
                bubbleFontSizeMax={MAX_BUBBLE_FONT_SIZE}
                sendDisabled={pendingQueue.length === 0}
                undoDisabled={sentMessages.length === 0}
              />

              <div className="queue-panel">
                <div className="panel-head">
                  <div>
                    <h2>Queue Script</h2>
                    <p>One line = one message. Use `A:` or `B:` to clean speaker labels.</p>
                  </div>
                  <button
                    type="button"
                    className="tool-button"
                    onClick={() => syncQueueFromText(scriptText)}
                  >
                    Reload Queue
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
                  <span>`Backspace` or `Cmd/Ctrl+Z` Undo</span>
                  <span>`R` Reset</span>
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

        <audio key={audioSource} ref={audioRef} preload="metadata" src={audioSource} />
      </section>
    </main>
  );
}

export default App;
