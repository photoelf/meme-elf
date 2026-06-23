import {
  createTextLayer,
  DEFAULT_CANVAS_SIZE,
  DEFAULT_FILL,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  DEFAULT_OUTLINE_WIDTH,
  DEFAULT_STROKE,
} from '../../app/default-state';
import type {
  ImageLayer,
  ImageSkew,
  SceneEffectStackItem,
  SceneImageAdjustments,
  SceneWatermark,
  TextAlign,
  TextBox,
  TextEffect,
  TextLayer,
  VerticalAlign,
} from '../../app/types';
import {
  createDefaultSceneEffectStack,
  normalizeSceneEffectStack,
  normalizeSceneImageAdjustments,
} from '../image/image-effects';
import { createDefaultSceneWatermark, normalizeSceneWatermark } from '../image/watermark-utils';
import { MELF_DOCUMENT_VERSION, MELF_EXTENSION, MELF_MIME_TYPE } from './melf-template';

export { MELF_EXTENSION, MELF_MIME_TYPE };

export type MelfEmbeddedImageAsset = {
  mimeType: string;
  dataUrl: string;
  width: number;
  height: number;
};

export type MelfSceneTextLayer = TextLayer;

export type MelfSceneImageLayer = Omit<ImageLayer, 'image'> & {
  kind: 'image';
  imageAsset: MelfEmbeddedImageAsset | null;
};

export type MelfSceneDrawLayer = {
  kind: 'draw';
  id: string;
  name: string;
  box: TextBox;
  opacity: number;
  sourceSize: {
    width: number;
    height: number;
  };
  rasterAsset: MelfEmbeddedImageAsset | null;
};

export type MelfSceneLayer = MelfSceneTextLayer | MelfSceneImageLayer | MelfSceneDrawLayer;

export type MelfSceneDocument = {
  kind: 'scene';
  version: typeof MELF_DOCUMENT_VERSION;
  name: string;
  scene: {
    canvasSize: {
      width: number;
      height: number;
    };
    activeLayerId: string | null;
    baseImage: MelfEmbeddedImageAsset | null;
    layers: MelfSceneLayer[];
  };
  sceneImageAdjustments: SceneImageAdjustments;
  sceneEffectStack: SceneEffectStackItem[];
  sceneWatermark: SceneWatermark;
};

type PartialMelfEmbeddedImageAsset = Partial<MelfEmbeddedImageAsset>;
type PartialMelfSceneTextLayer = Partial<MelfSceneTextLayer>;
type PartialMelfSceneImageLayer = Partial<Omit<MelfSceneImageLayer, 'imageAsset'>> & {
  imageAsset?: PartialMelfEmbeddedImageAsset | null;
};
type PartialMelfSceneDrawLayer = Partial<Omit<MelfSceneDrawLayer, 'rasterAsset'>> & {
  rasterAsset?: PartialMelfEmbeddedImageAsset | null;
};
type PartialMelfSceneLayer =
  | (PartialMelfSceneTextLayer & { kind?: 'text' | string })
  | (PartialMelfSceneImageLayer & { kind?: 'image' | string })
  | (PartialMelfSceneDrawLayer & { kind?: 'draw' | string });

type PartialMelfSceneDocument = Partial<MelfSceneDocument> & {
  scene?: Partial<MelfSceneDocument['scene']> & {
    baseImage?: PartialMelfEmbeddedImageAsset | null;
    layers?: PartialMelfSceneLayer[];
  };
};

export function parseMelfSceneDocument(raw: string): MelfSceneDocument | null {
  try {
    const parsed = JSON.parse(raw) as PartialMelfSceneDocument;
    return normalizeMelfSceneDocument(parsed);
  } catch {
    return null;
  }
}

export function stringifyMelfSceneDocument(document: MelfSceneDocument) {
  return JSON.stringify(document, null, 2);
}

export function normalizeMelfSceneDocument(
  input: PartialMelfSceneDocument,
): MelfSceneDocument | null {
  if (input.kind !== 'scene' || input.version !== MELF_DOCUMENT_VERSION) {
    return null;
  }

  const canvasSize = normalizeCanvasSize(input.scene?.canvasSize);
  const layers = normalizeSceneLayers(input.scene?.layers, canvasSize);

  return {
    kind: 'scene',
    version: MELF_DOCUMENT_VERSION,
    name: normalizeName(input.name, 'Untitled scene'),
    scene: {
      canvasSize,
      activeLayerId: resolveActiveLayerId(input.scene?.activeLayerId, layers),
      baseImage: normalizeEmbeddedImageAsset(input.scene?.baseImage),
      layers,
    },
    sceneImageAdjustments: normalizeSceneImageAdjustments(input.sceneImageAdjustments ?? {}),
    sceneEffectStack: normalizeSceneEffectStack(input.sceneEffectStack ?? createDefaultSceneEffectStack()),
    sceneWatermark: normalizeSceneWatermark(input.sceneWatermark ?? createDefaultSceneWatermark()),
  };
}

function normalizeSceneLayers(
  input: PartialMelfSceneLayer[] | undefined,
  canvasSize: { width: number; height: number },
): MelfSceneLayer[] {
  if (!input || input.length === 0) {
    return [];
  }

  return input.map((layer, index) => normalizeSceneLayer(layer, index, canvasSize));
}

function normalizeSceneLayer(
  layer: PartialMelfSceneLayer,
  index: number,
  canvasSize: { width: number; height: number },
): MelfSceneLayer {
  if (layer.kind === 'image') {
    return normalizeImageLayer(layer, index, canvasSize);
  }

  if (layer.kind === 'draw') {
    return normalizeDrawLayer(layer, index, canvasSize);
  }

  return normalizeTextLayer(layer as PartialMelfSceneTextLayer, index, canvasSize);
}

function normalizeTextLayer(
  layer: PartialMelfSceneTextLayer,
  index: number,
  canvasSize: { width: number; height: number },
): MelfSceneTextLayer {
  const fallbackVerticalAlign = index === 1 ? 'bottom' : 'top';
  const verticalAlign = normalizeVerticalAlign(layer.verticalAlign, fallbackVerticalAlign);
  const fallbackId = verticalAlign === 'bottom' ? 'bottom' : `text-${index + 1}`;
  const defaultLayer = createTextLayer(
    normalizeIdentifier(layer.id, fallbackId),
    normalizeName(layer.name, verticalAlign === 'bottom' ? 'Bottom text' : 'Text'),
    resolveDefaultLayerY(verticalAlign, canvasSize.height),
    verticalAlign,
  );

  return {
    ...defaultLayer,
    text: normalizeString(layer.text),
    fontFamily: normalizeFontFamily(layer.fontFamily),
    fontSize: normalizePositiveInt(layer.fontSize, defaultLayer.fontSize),
    fillStyle: normalizeHexColor(layer.fillStyle, DEFAULT_FILL),
    strokeStyle: normalizeHexColor(layer.strokeStyle, DEFAULT_STROKE),
    outlineWidth: normalizeNonNegativeInt(layer.outlineWidth, DEFAULT_OUTLINE_WIDTH),
    textAlign: normalizeTextAlign(layer.textAlign, defaultLayer.textAlign),
    verticalAlign,
    effect: normalizeTextEffect(layer.effect, defaultLayer.effect),
    allCaps: typeof layer.allCaps === 'boolean' ? layer.allCaps : defaultLayer.allCaps,
    bold: typeof layer.bold === 'boolean' ? layer.bold : defaultLayer.bold,
    italic: typeof layer.italic === 'boolean' ? layer.italic : defaultLayer.italic,
    opacity: clampUnit(layer.opacity, defaultLayer.opacity),
    box: normalizeTextBox(layer.box, defaultLayer.box, canvasSize),
  };
}

function normalizeImageLayer(
  layer: PartialMelfSceneImageLayer,
  index: number,
  canvasSize: { width: number; height: number },
): MelfSceneImageLayer {
  const fallbackBox = {
    x: 0,
    y: 0,
    width: canvasSize.width,
    height: canvasSize.height,
    rotation: 0,
  };
  const fallbackSourceSize = normalizeSize(layer.sourceSize, canvasSize);

  return {
    kind: 'image',
    id: normalizeIdentifier(layer.id, `image-${index + 1}`),
    name: normalizeName(layer.name, `Image ${index + 1}`),
    opacity: clampUnit(layer.opacity, 1),
    box: normalizeTextBox(layer.box, fallbackBox, canvasSize),
    sourceSize: fallbackSourceSize,
    skew: normalizeImageSkew(layer.skew),
    imageAsset: normalizeEmbeddedImageAsset(layer.imageAsset),
  };
}

function normalizeDrawLayer(
  layer: PartialMelfSceneDrawLayer,
  index: number,
  canvasSize: { width: number; height: number },
): MelfSceneDrawLayer {
  const fallbackBox = {
    x: 0,
    y: 0,
    width: canvasSize.width,
    height: canvasSize.height,
    rotation: 0,
  };

  return {
    kind: 'draw',
    id: normalizeIdentifier(layer.id, `draw-${index + 1}`),
    name: normalizeName(layer.name, `Draw ${index + 1}`),
    opacity: clampUnit(layer.opacity, 1),
    box: normalizeTextBox(layer.box, fallbackBox, canvasSize),
    sourceSize: normalizeSize(layer.sourceSize, canvasSize),
    rasterAsset: normalizeEmbeddedImageAsset(layer.rasterAsset),
  };
}

function normalizeEmbeddedImageAsset(
  asset: PartialMelfEmbeddedImageAsset | null | undefined,
): MelfEmbeddedImageAsset | null {
  if (!asset || typeof asset.dataUrl !== 'string') {
    return null;
  }

  const dataUrl = asset.dataUrl.trim();
  if (!dataUrl.startsWith('data:')) {
    return null;
  }

  return {
    mimeType: normalizeMimeType(asset.mimeType),
    dataUrl,
    width: normalizePositiveInt(asset.width, 1),
    height: normalizePositiveInt(asset.height, 1),
  };
}

function normalizeCanvasSize(
  input: Partial<MelfSceneDocument['scene']['canvasSize']> | undefined,
) {
  return {
    width: normalizePositiveInt(input?.width, DEFAULT_CANVAS_SIZE.width),
    height: normalizePositiveInt(input?.height, DEFAULT_CANVAS_SIZE.height),
  };
}

function normalizeSize(
  input: Partial<{ width: number; height: number }> | undefined,
  fallback: { width: number; height: number },
) {
  return {
    width: normalizePositiveInt(input?.width, fallback.width),
    height: normalizePositiveInt(input?.height, fallback.height),
  };
}

function normalizeImageSkew(input: Partial<ImageSkew> | undefined): ImageSkew {
  return {
    x: normalizeFiniteNumber(input?.x, 0),
    y: normalizeFiniteNumber(input?.y, 0),
  };
}

function normalizeTextBox(
  input: Partial<TextBox> | undefined,
  fallback: TextBox,
  canvasSize: { width: number; height: number },
) {
  const x = normalizeNonNegativeInt(input?.x, fallback.x);
  const y = normalizeNonNegativeInt(input?.y, fallback.y);
  const maxWidth = Math.max(1, canvasSize.width - x);
  const maxHeight = Math.max(1, canvasSize.height - y);

  return {
    x: Math.min(x, Math.max(0, canvasSize.width - 1)),
    y: Math.min(y, Math.max(0, canvasSize.height - 1)),
    width: Math.min(normalizePositiveInt(input?.width, fallback.width), maxWidth),
    height: Math.min(normalizePositiveInt(input?.height, fallback.height), maxHeight),
    rotation: normalizeFiniteNumber(input?.rotation, fallback.rotation),
  };
}

function resolveActiveLayerId(
  activeLayerId: string | null | undefined,
  layers: MelfSceneLayer[],
) {
  if (typeof activeLayerId === 'string' && layers.some((layer) => layer.id === activeLayerId)) {
    return activeLayerId;
  }

  return layers[0]?.id ?? null;
}

function resolveDefaultLayerY(verticalAlign: VerticalAlign, canvasHeight: number) {
  if (verticalAlign === 'bottom') {
    return Math.max(0, canvasHeight - 110);
  }

  if (verticalAlign === 'middle') {
    return Math.max(0, Math.round((canvasHeight - 140) / 2));
  }

  return 0;
}

function normalizeVerticalAlign(
  value: VerticalAlign | undefined,
  fallback: VerticalAlign,
): VerticalAlign {
  return value === 'middle' || value === 'bottom' ? value : fallback;
}

function normalizeTextAlign(value: TextAlign | undefined, fallback: TextAlign): TextAlign {
  return value === 'left' || value === 'center' || value === 'right' ? value : fallback;
}

function normalizeTextEffect(value: TextEffect | undefined, fallback: TextEffect): TextEffect {
  return value === 'outline' || value === 'shadow' || value === 'none' ? value : fallback;
}

function normalizeIdentifier(value: string | undefined, fallback: string) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeName(value: string | undefined, fallback: string) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeString(value: string | undefined) {
  if (typeof value !== 'string') {
    return '';
  }

  return value;
}

function normalizeFontFamily(value: string | undefined) {
  if (typeof value !== 'string') {
    return DEFAULT_FONT_FAMILY;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_FONT_FAMILY;
}

function normalizeHexColor(value: string | undefined, fallback: string) {
  if (typeof value !== 'string') {
    return fallback;
  }

  return /^#[0-9a-f]{6}$/iu.test(value) ? value.toLowerCase() : fallback;
}

function normalizeMimeType(value: string | undefined) {
  if (typeof value !== 'string') {
    return 'image/png';
  }

  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : 'image/png';
}

function normalizePositiveInt(value: number | undefined, fallback: number) {
  if (!Number.isFinite(value) || value === undefined) {
    return fallback;
  }

  return Math.max(1, Math.round(value));
}

function normalizeNonNegativeInt(value: number | undefined, fallback: number) {
  if (!Number.isFinite(value) || value === undefined) {
    return fallback;
  }

  return Math.max(0, Math.round(value));
}

function normalizeFiniteNumber(value: number | undefined, fallback: number) {
  if (!Number.isFinite(value) || value === undefined) {
    return fallback;
  }

  return value;
}

function clampUnit(value: number | undefined, fallback: number) {
  if (!Number.isFinite(value) || value === undefined) {
    return fallback;
  }

  return Math.max(0, Math.min(1, value));
}
