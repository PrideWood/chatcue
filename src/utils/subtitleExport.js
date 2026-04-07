const DEFAULT_LAST_CAPTION_DURATION = 3;
const MIN_CAPTION_DURATION = 0.5;

function clampEndTime(startTime, preferredEndTime) {
  if (Number.isFinite(preferredEndTime) && preferredEndTime > startTime) {
    return preferredEndTime;
  }

  return startTime + MIN_CAPTION_DURATION;
}

export function formatSrtTimestamp(timeInSeconds) {
  const safeTime = Math.max(0, Number.isFinite(timeInSeconds) ? timeInSeconds : 0);
  const totalMilliseconds = Math.round(safeTime * 1000);
  const milliseconds = totalMilliseconds % 1000;
  const totalSeconds = Math.floor(totalMilliseconds / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
}

export function buildTimedMessages(messages, duration) {
  return messages.map((message, index) => {
    const startTime = Number.isFinite(message.startTime) ? message.startTime : 0;
    const nextStartTime = messages[index + 1]?.startTime;
    const preferredEndTime =
      Number.isFinite(nextStartTime)
        ? nextStartTime
        : Number.isFinite(duration) && duration > startTime
          ? duration
          : startTime + DEFAULT_LAST_CAPTION_DURATION;

    return {
      index: index + 1,
      id: message.id,
      text: message.text,
      speaker: message.speakerLabel,
      side: message.side,
      startTime,
      endTime: clampEndTime(startTime, preferredEndTime),
    };
  });
}

export function buildSrt(messages, duration) {
  return buildTimedMessages(messages, duration)
    .map((message) => [
      message.index,
      `${formatSrtTimestamp(message.startTime)} --> ${formatSrtTimestamp(message.endTime)}`,
      message.text,
    ].join('\n'))
    .join('\n\n');
}

export function buildSubtitleJson(messages, duration) {
  return JSON.stringify(buildTimedMessages(messages, duration), null, 2);
}
