function ChatMessage({ message, isActive, showTranslation, onSeek }) {
  const sideClass = `message-row ${message.side || 'left'}`;
  const Element = onSeek ? 'button' : 'div';
  const sharedProps = onSeek
    ? {
        type: 'button',
        onClick: () => onSeek(message.start),
      }
    : {};

  return (
    <Element
      className={`${sideClass} ${isActive ? 'active' : ''}`}
      {...sharedProps}
    >
      {message.speakerLabel ? <span className="speaker-tag">{`Speaker ${message.speakerLabel}`}</span> : null}
      <span className="bubble">
        <span className="message-text">{message.text}</span>
        {showTranslation ? <span className="translation-text">{message.translation}</span> : null}
      </span>
    </Element>
  );
}

export default ChatMessage;
