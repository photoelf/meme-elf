import type { TextAlign, TextLayer, VerticalAlign } from '../../app/types';

const BOX_PADDING_X = 18;
const BOX_PADDING_Y = 12;
const DEFAULT_LINE_HEIGHT_RATIO = 1.04;
const MIN_RENDER_FONT_SIZE = 8;
let measurementContext: CanvasRenderingContext2D | null = null;

export function getContainedCanvasSize(width: number, height: number, maxWidth: number) {
  if (width <= maxWidth) {
    return { width, height };
  }

  const scale = maxWidth / width;

  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

export function renderPreview(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource | null,
  size: { width: number; height: number },
  layers: TextLayer[],
) {
  context.clearRect(0, 0, size.width, size.height);

  if (image) {
    context.drawImage(image, 0, 0, size.width, size.height);
  }

  for (const layer of [...layers].reverse()) {
    renderTextLayer(context, layer);
  }
}

function renderTextLayer(context: CanvasRenderingContext2D, layer: TextLayer) {
  const text = layer.allCaps ? layer.text.toUpperCase() : layer.text;

  if (!text.trim()) {
    return;
  }

  const textLayout = getTextLayoutForLayer(context, layer, text);

  context.save();
  context.translate(layer.box.x + layer.box.width / 2, layer.box.y + layer.box.height / 2);
  context.rotate(layer.box.rotation);
  context.font = textLayout.fontSpec;
  context.textAlign = mapTextAlign(layer.textAlign);
  context.textBaseline = 'top';
  context.fillStyle = layer.fillStyle;
  context.strokeStyle = layer.strokeStyle;
  context.lineJoin = 'round';
  context.lineWidth = layer.outlineWidth;
  context.globalAlpha = layer.opacity;

  if (layer.effect === 'shadow') {
    context.shadowColor = 'rgba(0, 0, 0, 0.85)';
    context.shadowBlur = Math.max(1, layer.outlineWidth * 2);
    context.shadowOffsetX = Math.max(1, layer.outlineWidth);
    context.shadowOffsetY = Math.max(1, layer.outlineWidth);
  }

  const boxLeft = -layer.box.width / 2;
  const boxTop = -layer.box.height / 2;
  const drawX =
    layer.textAlign === 'left'
      ? boxLeft + BOX_PADDING_X
      : layer.textAlign === 'right'
        ? boxLeft + layer.box.width - BOX_PADDING_X
        : 0;
  const drawY = getAlignedTextY(
    boxTop,
    layer.box.height,
    textLayout.blockHeight,
    layer.verticalAlign,
  );

  for (const [index, line] of textLayout.lines.entries()) {
    const lineY = drawY + index * textLayout.lineHeight;

    context.save();

    if (layer.italic) {
      context.translate(drawX, lineY);
      context.transform(1, 0, -0.2, 1, 0, 0);
    }

    if (layer.effect === 'outline' && layer.outlineWidth > 0) {
      context.strokeText(line, layer.italic ? 0 : drawX, layer.italic ? 0 : lineY);
    }

    context.fillText(line, layer.italic ? 0 : drawX, layer.italic ? 0 : lineY);
    context.restore();
  }

  context.restore();
}

export function getTextLayoutForLayer(
  context: CanvasRenderingContext2D,
  layer: TextLayer,
  text = layer.allCaps ? layer.text.toUpperCase() : layer.text,
) {
  const innerWidth = Math.max(40, layer.box.width - BOX_PADDING_X * 2);
  const innerHeight = Math.max(20, layer.box.height - BOX_PADDING_Y * 2);

  return getTextLayout(context, layer, text, innerWidth, innerHeight);
}

export function getTextLayoutMetrics(layer: TextLayer) {
  if (!measurementContext) {
    const canvas = document.createElement('canvas');
    measurementContext = canvas.getContext('2d');
  }

  if (!measurementContext) {
    return null;
  }

  const text = layer.allCaps ? layer.text.toUpperCase() : layer.text;
  const layout = getTextLayoutForLayer(measurementContext, layer, text);
  const boxTop = -layer.box.height / 2;

  return {
    ...layout,
    drawY: getAlignedTextY(boxTop, layer.box.height, layout.blockHeight, layer.verticalAlign),
    innerWidth: Math.max(40, layer.box.width - BOX_PADDING_X * 2),
    paddingX: BOX_PADDING_X,
    paddingY: BOX_PADDING_Y,
    text,
  };
}

function getTextLayout(
  context: CanvasRenderingContext2D,
  layer: TextLayer,
  text: string,
  innerWidth: number,
  innerHeight: number,
) {
  let nextFontSize = Math.max(MIN_RENDER_FONT_SIZE, Math.round(layer.fontSize));

  while (nextFontSize >= MIN_RENDER_FONT_SIZE) {
    const fontSpec = getFontSpec(layer, nextFontSize);
    const lines = wrapTextToLines(context, text, fontSpec, innerWidth);
    const lineHeight = Math.max(1, Math.round(nextFontSize * DEFAULT_LINE_HEIGHT_RATIO));
    const blockHeight = Math.max(lineHeight, lines.length * lineHeight);
    const widestLine = Math.max(...lines.map((line) => context.measureText(line).width), 0);

    if (blockHeight <= innerHeight && widestLine <= innerWidth) {
      return {
        blockHeight,
        fontSpec,
        fontSize: nextFontSize,
        lineHeight,
        lines,
      };
    }

    nextFontSize -= 1;
  }

  const fallbackFontSpec = getFontSpec(layer, MIN_RENDER_FONT_SIZE);
  const fallbackLineHeight = Math.max(1, Math.round(MIN_RENDER_FONT_SIZE * DEFAULT_LINE_HEIGHT_RATIO));

  return {
    blockHeight: fallbackLineHeight,
    fontSpec: fallbackFontSpec,
    fontSize: MIN_RENDER_FONT_SIZE,
    lineHeight: fallbackLineHeight,
    lines: wrapTextToLines(context, text, fallbackFontSpec, innerWidth),
  };
}

function getFontSpec(layer: TextLayer, fontSize: number) {
  const fontWeight = layer.bold ? '900' : '400';
  const fontStyle = layer.italic ? 'italic ' : '';
  return `${fontStyle}${fontWeight} ${fontSize}px ${layer.fontFamily}`;
}

function getAlignedTextY(
  boxTop: number,
  boxHeight: number,
  blockHeight: number,
  verticalAlign: VerticalAlign,
) {
  if (verticalAlign === 'top') {
    return boxTop + BOX_PADDING_Y;
  }

  if (verticalAlign === 'bottom') {
    return boxTop + boxHeight - BOX_PADDING_Y - blockHeight;
  }

  return boxTop + Math.round((boxHeight - blockHeight) / 2);
}

function mapTextAlign(textAlign: TextAlign): CanvasTextAlign {
  if (textAlign === 'left') {
    return 'left';
  }

  if (textAlign === 'right') {
    return 'right';
  }

  return 'center';
}

function wrapTextToLines(
  context: CanvasRenderingContext2D,
  text: string,
  font: string,
  maxWidth: number,
) {
  context.font = font;
  const explicitLines = text.split(/\r?\n/);
  const wrappedLines: string[] = [];

  for (const explicitLine of explicitLines) {
    if (explicitLine.length === 0) {
      wrappedLines.push('');
      continue;
    }

    const segments = explicitLine.match(/\S+\s*|\s+/g) ?? [explicitLine];
    let currentLine = '';

    for (const segment of segments) {
      const nextLine = currentLine + segment;

      if (!currentLine || context.measureText(nextLine).width <= maxWidth) {
        currentLine = nextLine;
        continue;
      }

      wrappedLines.push(currentLine.replace(/\s+$/u, ''));
      currentLine = segment.replace(/^\s+/u, '');
    }

    wrappedLines.push(currentLine.replace(/\s+$/u, ''));
  }

  return wrappedLines;
}
