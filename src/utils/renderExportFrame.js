export const EXPORT_WIDTH = 1620;
export const EXPORT_HEIGHT = 2160;

const PREVIEW_WIDTH = 576;
const PREVIEW_HEIGHT = 768;
const EXPORT_SCALE = EXPORT_WIDTH / PREVIEW_WIDTH;

const COLORS = {
  background: '#eceef1',
  title: '#14213d',
  speaker: '#6d7887',
  leftBubble: '#ffffff',
  rightBubble: '#d9ebff',
  rightText: '#0f1723',
};

function roundedRect(ctx, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.arcTo(x + width, y, x + width, y + height, safeRadius);
  ctx.arcTo(x + width, y + height, x, y + height, safeRadius);
  ctx.arcTo(x, y + height, x, y, safeRadius);
  ctx.arcTo(x, y, x + width, y, safeRadius);
  ctx.closePath();
}

function roundedRectWithCorners(ctx, x, y, width, height, radii) {
  const topLeft = Math.min(radii.topLeft, width / 2, height / 2);
  const topRight = Math.min(radii.topRight, width / 2, height / 2);
  const bottomRight = Math.min(radii.bottomRight, width / 2, height / 2);
  const bottomLeft = Math.min(radii.bottomLeft, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + topLeft, y);
  ctx.lineTo(x + width - topRight, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + topRight);
  ctx.lineTo(x + width, y + height - bottomRight);
  ctx.quadraticCurveTo(x + width, y + height, x + width - bottomRight, y + height);
  ctx.lineTo(x + bottomLeft, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - bottomLeft);
  ctx.lineTo(x, y + topLeft);
  ctx.quadraticCurveTo(x, y, x + topLeft, y);
  ctx.closePath();
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let currentLine = '';

  words.forEach((word) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;

    if (ctx.measureText(nextLine).width <= maxWidth) {
      currentLine = nextLine;
      return;
    }

    if (currentLine) {
      lines.push(currentLine);
      currentLine = word;
      return;
    }

    let chunk = '';
    Array.from(word).forEach((char) => {
      const nextChunk = `${chunk}${char}`;
      if (ctx.measureText(nextChunk).width > maxWidth && chunk) {
        lines.push(chunk);
        chunk = char;
        return;
      }
      chunk = nextChunk;
    });
    currentLine = chunk;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function drawTextBlock(ctx, lines, x, y, lineHeight) {
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + lineHeight / 2 + index * lineHeight);
  });
}

function measureMessage(ctx, message, layout) {
  const textMaxWidth = layout.bubbleMaxWidth - layout.bubblePaddingX * 2;
  ctx.font = layout.textFont;
  const textLines = wrapText(ctx, message.text, textMaxWidth);
  const translationLines = [];
  let bubbleHeight = layout.bubblePaddingTop + layout.bubblePaddingBottom + textLines.length * layout.textLineHeight;

  if (message.translation) {
    ctx.font = layout.translationFont;
    translationLines.push(...wrapText(ctx, message.translation, textMaxWidth));
    bubbleHeight += layout.bubbleGap + translationLines.length * layout.translationLineHeight;
  }

  const labelHeight = message.speakerLabel ? layout.speakerLineHeight + layout.speakerGap : 0;

  return {
    bubbleHeight,
    labelHeight,
    textLines,
    translationLines,
    totalHeight: labelHeight + bubbleHeight + layout.messageGap,
  };
}

function getTextWidth(ctx, lines, font) {
  ctx.font = font;
  return Math.max(0, ...lines.map((line) => ctx.measureText(line).width));
}

export function renderExportFrame(canvas, { title, messages, bubbleFontSize }) {
  const ctx = canvas.getContext('2d', { alpha: false });

  if (!ctx) {
    return;
  }

  if (canvas.width !== EXPORT_WIDTH) {
    canvas.width = EXPORT_WIDTH;
  }

  if (canvas.height !== EXPORT_HEIGHT) {
    canvas.height = EXPORT_HEIGHT;
  }

  const layout = {
    framePadding: 26,
    titleMarginBottom: 22,
    titlePaddingX: 29,
    titlePaddingY: 24,
    titleRadius: 26,
    titleFontSize: 25.6,
    titleLineHeight: 31,
    shellPaddingTop: 41,
    shellPaddingX: 31,
    shellPaddingBottom: 31,
    speakerFontSize: 16.96,
    speakerLineHeight: 21,
    speakerGap: 10,
    speakerMarginX: 17,
    textFontSize: bubbleFontSize * 1.2,
    textLineHeight: bubbleFontSize * 1.2 * 1.68,
    translationFontSize: 19.52,
    translationLineHeight: 31,
    bubblePaddingX: 29,
    bubblePaddingTop: 23,
    bubblePaddingBottom: 20,
    bubbleRadius: 36,
    bubbleTuckedRadius: 14,
    bubbleGap: 12,
    messageGap: 24,
  };

  layout.titleFont = `700 ${layout.titleFontSize}px "Avenir Next", "PingFang SC", "Helvetica Neue", sans-serif`;
  layout.speakerFont = `700 ${layout.speakerFontSize}px "Avenir Next", "PingFang SC", "Helvetica Neue", sans-serif`;
  layout.textFont = `500 ${layout.textFontSize}px "Avenir Next", "PingFang SC", "Helvetica Neue", sans-serif`;
  layout.translationFont = `400 ${layout.translationFontSize}px "Avenir Next", "PingFang SC", "Helvetica Neue", sans-serif`;
  layout.contentWidth = PREVIEW_WIDTH - layout.framePadding * 2 - layout.shellPaddingX * 2;
  layout.bubbleMaxWidth = layout.contentWidth * 0.82;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
  ctx.scale(EXPORT_SCALE, EXPORT_SCALE);

  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);

  const titleBarX = layout.framePadding;
  const titleBarY = layout.framePadding;
  const titleBarWidth = PREVIEW_WIDTH - layout.framePadding * 2;
  const titleBarHeight = layout.titlePaddingY * 2 + layout.titleLineHeight;

  roundedRect(ctx, titleBarX, titleBarY, titleBarWidth, titleBarHeight, layout.titleRadius);
  ctx.fillStyle = COLORS.background;
  ctx.fill();

  ctx.fillStyle = COLORS.title;
  ctx.font = layout.titleFont;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title || 'Untitled Session', PREVIEW_WIDTH / 2, titleBarY + titleBarHeight / 2);

  const shellTop = titleBarY + titleBarHeight + layout.titleMarginBottom;
  const shellBottom = PREVIEW_HEIGHT - layout.framePadding;
  const listTop = shellTop + layout.shellPaddingTop;
  const listBottom = shellBottom - layout.shellPaddingBottom;
  const messageLeft = layout.framePadding + layout.shellPaddingX;
  const messageRight = PREVIEW_WIDTH - layout.framePadding - layout.shellPaddingX;
  const measuredMessages = messages.map((message) => ({
    message,
    metrics: measureMessage(ctx, message, layout),
  }));

  const totalHeight = measuredMessages.reduce((sum, item) => sum + item.metrics.totalHeight, 0);

  if (measuredMessages.length === 0) {
    return;
  }

  const visibleListHeight = listBottom - listTop;
  let cursorY = Math.min(listTop, listBottom - totalHeight);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, shellTop, PREVIEW_WIDTH, shellBottom - shellTop);
  ctx.clip();

  measuredMessages.forEach(({ message, metrics }) => {
    const isRight = message.side === 'right';
    const widestText = Math.max(
      getTextWidth(ctx, metrics.textLines, layout.textFont),
      getTextWidth(ctx, metrics.translationLines, layout.translationFont),
    );
    const bubbleWidth = Math.min(
      layout.bubbleMaxWidth,
      Math.max(80, Math.ceil(widestText + layout.bubblePaddingX * 2)),
    );
    const bubbleX = isRight ? messageRight - bubbleWidth : messageLeft;

    if (message.speakerLabel) {
      ctx.font = layout.speakerFont;
      ctx.fillStyle = COLORS.speaker;
      ctx.textAlign = isRight ? 'right' : 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(
        `Speaker ${message.speakerLabel}`,
        isRight ? bubbleX + bubbleWidth - layout.speakerMarginX : bubbleX + layout.speakerMarginX,
        cursorY + layout.speakerLineHeight * 0.8,
      );
      cursorY += metrics.labelHeight;
    }

    roundedRectWithCorners(ctx, bubbleX, cursorY, bubbleWidth, metrics.bubbleHeight, {
      topLeft: isRight ? layout.bubbleRadius : layout.bubbleTuckedRadius,
      topRight: isRight ? layout.bubbleTuckedRadius : layout.bubbleRadius,
      bottomRight: layout.bubbleRadius,
      bottomLeft: layout.bubbleRadius,
    });
    ctx.fillStyle = isRight ? COLORS.rightBubble : COLORS.leftBubble;
    ctx.fill();

    ctx.fillStyle = isRight ? COLORS.rightText : COLORS.title;
    ctx.font = layout.textFont;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    drawTextBlock(
      ctx,
      metrics.textLines,
      bubbleX + layout.bubblePaddingX,
      cursorY + layout.bubblePaddingTop,
      layout.textLineHeight,
    );

    if (metrics.translationLines.length > 0) {
      ctx.globalAlpha = 0.72;
      ctx.font = layout.translationFont;
      ctx.textBaseline = 'middle';
      drawTextBlock(
        ctx,
        metrics.translationLines,
        bubbleX + layout.bubblePaddingX,
        cursorY +
          layout.bubblePaddingTop +
          metrics.textLines.length * layout.textLineHeight +
          layout.bubbleGap,
        layout.translationLineHeight,
      );
      ctx.globalAlpha = 1;
    }

    cursorY += metrics.bubbleHeight + layout.messageGap;
  });

  ctx.restore();

  if (totalHeight > visibleListHeight) {
    const fade = ctx.createLinearGradient(0, shellTop, 0, shellTop + 53);
    fade.addColorStop(0, COLORS.background);
    fade.addColorStop(1, 'rgba(236, 238, 241, 0)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, shellTop, PREVIEW_WIDTH, 53);
  }
}
