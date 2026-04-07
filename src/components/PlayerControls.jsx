import { formatTime } from '../utils/format';

function PlayerControls({
  isPlaying,
  currentTime,
  duration,
  speakerMode,
  onTogglePlay,
  onSeek,
  onAudioUpload,
  onSendLeft,
  onSendRight,
  onUndo,
  onReset,
  onModeChange,
  onDecreaseBubbleFontSize,
  onIncreaseBubbleFontSize,
  audioFileName,
  bubbleFontSize,
  bubbleFontSizeMin,
  bubbleFontSizeMax,
  sendDisabled,
  undoDisabled,
}) {
  return (
    <div className="control-panel">
      <div className="transport-row">
        <button type="button" className="tool-button tool-button-strong" onClick={onTogglePlay}>
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button type="button" className="tool-button tool-button-strong" onClick={onSendLeft} disabled={sendDisabled}>
          Send Left
        </button>
        <button type="button" className="tool-button tool-button-strong" onClick={onSendRight} disabled={sendDisabled}>
          Send Right
        </button>
        <button type="button" className="tool-button" onClick={onUndo} disabled={undoDisabled}>
          Undo Last Message
        </button>
        <button type="button" className="tool-button" onClick={onReset}>
          Reset
        </button>
        <label className="tool-button audio-upload">
          <span>Upload Audio</span>
          <input type="file" accept="audio/*" onChange={onAudioUpload} />
        </label>
      </div>

      <div className="compact-settings-row">
        <div className="mode-row">
          <span className="mode-label">Speaker Mode</span>
          <div className="mode-switch">
            <button
              type="button"
              className={`mode-button ${speakerMode === 'single' ? 'active' : ''}`}
              onClick={() => onModeChange('single')}
            >
              1P
            </button>
            <button
              type="button"
              className={`mode-button ${speakerMode === 'two' ? 'active' : ''}`}
              onClick={() => onModeChange('two')}
            >
              2P
            </button>
          </div>
        </div>

        <div className="bubble-font-row">
          <span className="mode-label">Bubble Text</span>
          <div className="font-size-controls">
            <button
              type="button"
              className="mode-button"
              onClick={onDecreaseBubbleFontSize}
              disabled={bubbleFontSize <= bubbleFontSizeMin}
            >
              A-
            </button>
            <span className="font-size-value">{bubbleFontSize}px</span>
            <button
              type="button"
              className="mode-button"
              onClick={onIncreaseBubbleFontSize}
              disabled={bubbleFontSize >= bubbleFontSizeMax}
            >
              A+
            </button>
          </div>
        </div>
      </div>

      <div className="timeline-row">
        <span>{formatTime(currentTime)}</span>
        <input
          type="range"
          min="0"
          max={duration || 0}
          step="0.1"
          value={Math.min(currentTime, duration || 0)}
          onChange={(event) => onSeek(Number(event.target.value))}
        />
        <span>{formatTime(duration)}</span>
      </div>

      <div className="audio-meta">Current audio: {audioFileName}</div>
    </div>
  );
}

export default PlayerControls;
