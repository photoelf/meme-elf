import { isDrawLayer, isImageLayer } from '../../app/types';
import type {
  DrawLayer,
  EditorLayer,
  ImageLayer,
  RasterSurface,
  SceneEffectStackItem,
  SceneImageAdjustments,
  SceneWatermark,
  TextAlign,
  TextLayer,
  VerticalAlign,
} from '../../app/types';
import {
  applySceneEffectToImageData,
  applySceneImageAdjustmentsToImageData,
  createDefaultSceneEffectStack,
  createDefaultSceneImageAdjustments,
  hasActiveSceneEffectStack,
  hasActiveSceneImageAdjustments,
  isRasterSceneEffectKind,
  normalizeSceneEffectStack,
} from '../image/image-effects';
import {
  buildWatermarkLayout,
  createDefaultSceneWatermark,
  normalizeSceneWatermark,
} from '../image/watermark-utils';
import { createInactivePreviewGuardrails, type PreviewGuardrails } from './mobile-preview-guardrails';

const BOX_PADDING_X = 18;
const BOX_PADDING_Y = 12;
const DEFAULT_LINE_HEIGHT_RATIO = 1.04;
const MIN_RENDER_FONT_SIZE = 8;
let measurementContext: CanvasRenderingContext2D | null = null;
let filteredPreviewSurface: HTMLCanvasElement | null = null;
let filteredPreviewContext: CanvasRenderingContext2D | null = null;
let sourcePreviewSurface: HTMLCanvasElement | null = null;
let sourcePreviewContext: CanvasRenderingContext2D | null = null;
let drawLayerSurface: HTMLCanvasElement | null = null;
let drawLayerContext: CanvasRenderingContext2D | null = null;

export function resetPreviewRenderSurfacesForTests() {
  filteredPreviewSurface = null;
  filteredPreviewContext = null;
  sourcePreviewSurface = null;
  sourcePreviewContext = null;
  drawLayerSurface = null;
  drawLayerContext = null;
}

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
  layers: EditorLayer[],
  sceneImageAdjustments: SceneImageAdjustments = createDefaultSceneImageAdjustments(),
  sceneEffectStack: SceneEffectStackItem[] = createDefaultSceneEffectStack(),
  sceneWatermark: SceneWatermark = createDefaultSceneWatermark(),
  previewGuardrails: PreviewGuardrails = createInactivePreviewGuardrails(),
) {
  context.clearRect(0, 0, size.width, size.height);

  if (
    hasActiveSceneImageAdjustments(sceneImageAdjustments) ||
    hasActiveSceneEffectStack(sceneEffectStack)
  ) {
    const sourceSurface = getSourcePreviewSurface(size);
    const effectPassSize = previewGuardrails.guardedRenderSize ?? size;
    const filteredSurface = getFilteredPreviewSurface(effectPassSize);

    if (sourceSurface && filteredSurface) {
      sourceSurface.context.clearRect(0, 0, size.width, size.height);
      filteredSurface.context.clearRect(0, 0, effectPassSize.width, effectPassSize.height);
      if (sceneImageAdjustments.includeText) {
        renderSceneContent(sourceSurface.context, image, size, layers);
        drawSceneEffectsPass(
          filteredSurface.context,
          sourceSurface.canvas,
          effectPassSize,
          sceneImageAdjustments,
          sceneEffectStack,
        );
        context.drawImage(filteredSurface.canvas, 0, 0, size.width, size.height);
        renderSceneWatermark(context, size, sceneWatermark);
        return;
      }

      renderSceneLayers(sourceSurface.context, image, size, layers, {
        includeNonText: true,
        includeText: false,
      });
      drawSceneEffectsPass(
        filteredSurface.context,
        sourceSurface.canvas,
        effectPassSize,
        sceneImageAdjustments,
        sceneEffectStack,
      );
      context.drawImage(filteredSurface.canvas, 0, 0, size.width, size.height);
      renderSceneLayers(context, null, size, layers, {
        includeNonText: false,
        includeText: true,
      });
      renderSceneWatermark(context, size, sceneWatermark);
      return;
    }
  }

  renderSceneContent(context, image, size, layers);
  renderSceneWatermark(context, size, sceneWatermark);
}

function renderSceneContent(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource | null,
  size: { width: number; height: number },
  layers: EditorLayer[],
) {
  context.clearRect(0, 0, size.width, size.height);
  renderSceneLayers(context, image, size, layers, {
    includeNonText: true,
    includeText: true,
  });
}

function renderSceneLayers(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource | null,
  size: { width: number; height: number },
  layers: EditorLayer[],
  options: {
    includeNonText: boolean;
    includeText: boolean;
  },
) {
  if (options.includeNonText && image) {
    context.drawImage(image, 0, 0, size.width, size.height);
  }

  for (const layer of [...layers].reverse()) {
    if (isImageLayer(layer)) {
      if (options.includeNonText) {
        renderImageLayer(context, layer);
      }
      continue;
    }

    if (isDrawLayer(layer)) {
      if (options.includeNonText) {
        renderDrawLayer(context, layer);
      }
      continue;
    }

    if (options.includeText) {
      renderTextLayer(context, layer);
    }
  }
}

function getFilteredPreviewSurface(size: { width: number; height: number }) {
  return getPreviewSurface('filtered', size);
}

function getSourcePreviewSurface(size: { width: number; height: number }) {
  return getPreviewSurface('source', size);
}

function getPreviewSurface(kind: 'filtered' | 'source', size: { width: number; height: number }) {
  if (kind === 'filtered' && !filteredPreviewSurface) {
    filteredPreviewSurface = document.createElement('canvas');
    filteredPreviewContext = filteredPreviewSurface.getContext('2d');
  }

  if (kind === 'source' && !sourcePreviewSurface) {
    sourcePreviewSurface = document.createElement('canvas');
    sourcePreviewContext = sourcePreviewSurface.getContext('2d');
  }

  const canvas = kind === 'filtered' ? filteredPreviewSurface : sourcePreviewSurface;
  let context = kind === 'filtered' ? filteredPreviewContext : sourcePreviewContext;

  if (!canvas || !context) {
    return null;
  }

  if (canvas.width !== size.width || canvas.height !== size.height) {
    canvas.width = size.width;
    canvas.height = size.height;
    context = canvas.getContext('2d');
    if (kind === 'filtered') {
      filteredPreviewContext = context;
    } else {
      sourcePreviewContext = context;
    }
  }

  if (!context) {
    return null;
  }

  return {
    canvas,
    context,
  };
}

function drawSceneEffectsPass(
  context: CanvasRenderingContext2D,
  sourceCanvas: HTMLCanvasElement,
  size: { width: number; height: number },
  sceneImageAdjustments: SceneImageAdjustments,
  sceneEffectStack: SceneEffectStackItem[],
) {
  context.clearRect(0, 0, size.width, size.height);
  context.drawImage(sourceCanvas, 0, 0, size.width, size.height);

  if (hasActiveSceneImageAdjustments(sceneImageAdjustments)) {
    const imageData = context.getImageData(0, 0, size.width, size.height);
    applySceneImageAdjustmentsToImageData(imageData, sceneImageAdjustments);
    context.putImageData(imageData, 0, 0);
  }

  for (const effect of normalizeSceneEffectStack(sceneEffectStack)) {
    if (effect.value <= 0) {
      continue;
    }

    if (isRasterSceneEffectKind(effect.kind)) {
      const imageData = context.getImageData(0, 0, size.width, size.height);
      applySceneEffectToImageData(imageData, effect);
      context.putImageData(imageData, 0, 0);
    }
  }
}

function renderImageLayer(context: CanvasRenderingContext2D, layer: ImageLayer) {
  if (!layer.image) {
    return;
  }

  const scaleX = layer.skew.x < 0 ? -1 : 1;
  const scaleY = layer.skew.y < 0 ? -1 : 1;

  context.save();
  context.translate(layer.box.x + layer.box.width / 2, layer.box.y + layer.box.height / 2);
  context.rotate(layer.box.rotation);
  context.scale(scaleX, scaleY);
  context.globalAlpha = layer.opacity;
  context.drawImage(
    layer.image,
    -layer.box.width / 2,
    -layer.box.height / 2,
    layer.box.width,
    layer.box.height,
  );
  context.restore();
}

function renderDrawLayer(context: CanvasRenderingContext2D, layer: DrawLayer) {
  const surface = getDrawLayerSurface(layer.raster);

  if (!surface) {
    return;
  }

  context.save();
  context.translate(layer.box.x + layer.box.width / 2, layer.box.y + layer.box.height / 2);
  context.rotate(layer.box.rotation);
  context.globalAlpha = layer.opacity;
  context.drawImage(
    surface.canvas,
    -layer.box.width / 2,
    -layer.box.height / 2,
    layer.box.width,
    layer.box.height,
  );
  context.restore();
}

function getDrawLayerSurface(raster: RasterSurface) {
  if (!drawLayerSurface) {
    drawLayerSurface = document.createElement('canvas');
    drawLayerContext = drawLayerSurface.getContext('2d');
  }

  if (!drawLayerSurface || !drawLayerContext) {
    return null;
  }

  if (drawLayerSurface.width !== raster.width || drawLayerSurface.height !== raster.height) {
    drawLayerSurface.width = raster.width;
    drawLayerSurface.height = raster.height;
    drawLayerContext = drawLayerSurface.getContext('2d');
  }

  if (!drawLayerContext) {
    return null;
  }

  drawLayerContext.clearRect(0, 0, raster.width, raster.height);
  drawLayerContext.putImageData(toImageData(raster), 0, 0);

  return {
    canvas: drawLayerSurface,
    context: drawLayerContext,
  };
}

function toImageData(raster: RasterSurface): ImageData {
  if (typeof ImageData === 'function') {
    return new ImageData(Uint8ClampedArray.from(raster.data), raster.width, raster.height);
  }

  return {
    data: Uint8ClampedArray.from(raster.data),
    height: raster.height,
    width: raster.width,
    colorSpace: 'srgb',
  } as ImageData;
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

function renderSceneWatermark(
  context: CanvasRenderingContext2D,
  size: { width: number; height: number },
  watermark: SceneWatermark,
) {
  const normalized = normalizeSceneWatermark(watermark);

  if (!normalized.enabled || !normalized.text.trim()) {
    return;
  }

  const layout = buildWatermarkLayout({
    canvasSize: size,
    color: normalized.color,
    corner: normalized.corner,
    mode: normalized.mode,
    opacity: normalized.opacity,
    rotation: normalized.rotation,
    size: normalized.size,
    text: normalized.text,
  });

  for (const item of layout) {
    context.save();
    context.translate(item.x, item.y);
    context.rotate(item.rotation);
    context.font = `400 ${normalized.size}px Arial`;
    context.fillStyle = item.color;
    context.globalAlpha = item.opacity;
    context.textAlign = item.textAlign;
    context.textBaseline = item.textBaseline;
    context.fillText(item.text, 0, 0);
    context.restore();
  }
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
