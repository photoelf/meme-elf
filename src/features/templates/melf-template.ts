import {
  createTextLayer,
  DEFAULT_CANVAS_SIZE,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  DEFAULT_OUTLINE_WIDTH,
  DEFAULT_FILL,
  DEFAULT_STROKE,
} from '../../app/default-state';
import type {
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

export const MELF_DOCUMENT_VERSION = 1 as const;
export const MELF_EXTENSION = '.melf';
export const MELF_MIME_TYPE = 'application/x.meme-elf+json';

export type MelfTemplateCategory = 'classic' | 'caption' | 'social';

export type MelfTemplateDocument = {
  kind: 'template';
  version: typeof MELF_DOCUMENT_VERSION;
  templateId: string;
  name: string;
  description: string;
  category: MelfTemplateCategory;
  scene: {
    canvasSize: {
      width: number;
      height: number;
    };
    activeLayerId: string | null;
    textLayers: TextLayer[];
  };
  sceneImageAdjustments: SceneImageAdjustments;
  sceneEffectStack: SceneEffectStackItem[];
  sceneWatermark: SceneWatermark;
};

type PartialMelfTemplateDocument = Partial<MelfTemplateDocument> & {
  scene?: Partial<MelfTemplateDocument['scene']> & {
    textLayers?: Array<Partial<TextLayer>>;
  };
};

export function parseMelfTemplateDocument(raw: string): MelfTemplateDocument | null {
  try {
    const parsed = JSON.parse(raw) as PartialMelfTemplateDocument;
    return normalizeMelfTemplateDocument(parsed);
  } catch {
    return null;
  }
}

export function stringifyMelfTemplateDocument(document: MelfTemplateDocument) {
  return JSON.stringify(document, null, 2);
}

export function normalizeMelfTemplateDocument(
  input: PartialMelfTemplateDocument,
): MelfTemplateDocument | null {
  if (input.kind !== 'template' || input.version !== MELF_DOCUMENT_VERSION) {
    return null;
  }

  const canvasSize = normalizeCanvasSize(input.scene?.canvasSize);
  const textLayers = normalizeTextLayers(input.scene?.textLayers ?? [], canvasSize);

  return {
    kind: 'template',
    version: MELF_DOCUMENT_VERSION,
    templateId: normalizeIdentifier(input.templateId, 'untitled-template'),
    name: normalizeName(input.name, 'Untitled template'),
    description: normalizeDescription(input.description),
    category: normalizeCategory(input.category),
    scene: {
      canvasSize,
      activeLayerId: resolveActiveLayerId(input.scene?.activeLayerId, textLayers),
      textLayers,
    },
    sceneImageAdjustments: normalizeSceneImageAdjustments(input.sceneImageAdjustments ?? {}),
    sceneEffectStack: normalizeSceneEffectStack(input.sceneEffectStack ?? createDefaultSceneEffectStack()),
    sceneWatermark: normalizeSceneWatermark(input.sceneWatermark ?? createDefaultSceneWatermark()),
  };
}

export const STARTER_MELF_TEMPLATE_PRESETS: readonly MelfTemplateDocument[] = [
  createTemplatePreset({
    templateId: 'classic-top-bottom',
    name: 'Classic top and bottom',
    description: 'Two full-width caption boxes for the standard meme stack.',
    category: 'classic',
    textLayers: [
      createPresetTextLayer({
        id: 'top',
        name: 'Top text',
        verticalAlign: 'top',
        box: {
          x: 24,
          y: 0,
          width: 752,
          height: 110,
          rotation: 0,
        },
      }),
      createPresetTextLayer({
        id: 'bottom',
        name: 'Bottom text',
        verticalAlign: 'bottom',
        box: {
          x: 24,
          y: 340,
          width: 752,
          height: 110,
          rotation: 0,
        },
      }),
    ],
  }),
  createTemplatePreset({
    templateId: 'top-caption',
    name: 'Top caption',
    description: 'Single caption anchored above the image area.',
    category: 'caption',
    textLayers: [
      createPresetTextLayer({
        id: 'top',
        name: 'Top text',
        verticalAlign: 'top',
        box: {
          x: 24,
          y: 0,
          width: 752,
          height: 110,
          rotation: 0,
        },
      }),
    ],
  }),
  createTemplatePreset({
    templateId: 'bottom-caption',
    name: 'Bottom caption',
    description: 'Single caption anchored below the image area.',
    category: 'caption',
    textLayers: [
      createPresetTextLayer({
        id: 'bottom',
        name: 'Bottom text',
        verticalAlign: 'bottom',
        box: {
          x: 24,
          y: 340,
          width: 752,
          height: 110,
          rotation: 0,
        },
      }),
    ],
  }),
  createTemplatePreset({
    templateId: 'square-social',
    name: 'Square social',
    description: 'A square canvas with roomy caption blocks for feed posts.',
    category: 'social',
    canvasSize: {
      width: 1080,
      height: 1080,
    },
    textLayers: [
      createPresetTextLayer({
        id: 'top',
        name: 'Top text',
        verticalAlign: 'top',
        box: {
          x: 32,
          y: 0,
          width: 1016,
          height: 180,
          rotation: 0,
        },
        fontSize: 122,
      }),
      createPresetTextLayer({
        id: 'bottom',
        name: 'Bottom text',
        verticalAlign: 'bottom',
        box: {
          x: 32,
          y: 900,
          width: 1016,
          height: 180,
          rotation: 0,
        },
        fontSize: 122,
      }),
    ],
  }),
];

function createTemplatePreset(input: {
  templateId: string;
  name: string;
  description: string;
  category: MelfTemplateCategory;
  canvasSize?: {
    width: number;
    height: number;
  };
  textLayers: TextLayer[];
}): MelfTemplateDocument {
  return {
    kind: 'template',
    version: MELF_DOCUMENT_VERSION,
    templateId: input.templateId,
    name: input.name,
    description: input.description,
    category: input.category,
    scene: {
      canvasSize: input.canvasSize ?? { ...DEFAULT_CANVAS_SIZE },
      activeLayerId: input.textLayers[0]?.id ?? null,
      textLayers: input.textLayers.map(cloneTextLayer),
    },
    sceneImageAdjustments: normalizeSceneImageAdjustments({}),
    sceneEffectStack: createDefaultSceneEffectStack(),
    sceneWatermark: createDefaultSceneWatermark(),
  };
}

function createPresetTextLayer(input: {
  id: string;
  name: string;
  verticalAlign: VerticalAlign;
  box: TextBox;
  fontSize?: number;
}) {
  return {
    ...createTextLayer(input.id, input.name, input.box.y, input.verticalAlign),
    box: cloneTextBox(input.box),
    fontSize: normalizePositiveInt(input.fontSize, DEFAULT_FONT_SIZE),
  };
}

function normalizeCanvasSize(
  input: Partial<MelfTemplateDocument['scene']['canvasSize']> | undefined,
) {
  return {
    width: normalizePositiveInt(input?.width, DEFAULT_CANVAS_SIZE.width),
    height: normalizePositiveInt(input?.height, DEFAULT_CANVAS_SIZE.height),
  };
}

function normalizeTextLayers(
  input: Array<Partial<TextLayer>>,
  canvasSize: { width: number; height: number },
) {
  if (input.length === 0) {
    return [];
  }

  return input.map((layer, index) => {
    const fallbackVerticalAlign = index === input.length - 1 && input.length > 1 ? 'bottom' : 'top';
    const fallbackId = fallbackVerticalAlign === 'bottom' ? 'bottom' : `text-${index + 1}`;
    const verticalAlign = normalizeVerticalAlign(layer.verticalAlign, fallbackVerticalAlign);
    const defaultLayer = createTextLayer(
      normalizeIdentifier(layer.id, fallbackId),
      normalizeName(layer.name, fallbackVerticalAlign === 'bottom' ? 'Bottom text' : 'Text'),
      resolveDefaultLayerY(verticalAlign, canvasSize.height),
      verticalAlign,
    );

    return {
      ...defaultLayer,
      text: typeof layer.text === 'string' ? layer.text : defaultLayer.text,
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
      opacity: clampUnit(layer.opacity, 1),
      box: normalizeTextBox(layer.box, defaultLayer.box, canvasSize),
    };
  });
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

function resolveActiveLayerId(activeLayerId: string | null | undefined, layers: TextLayer[]) {
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

function normalizeCategory(value: MelfTemplateCategory | undefined): MelfTemplateCategory {
  return value === 'caption' || value === 'social' ? value : 'classic';
}

function normalizeVerticalAlign(
  value: VerticalAlign | undefined,
  fallback: VerticalAlign,
): VerticalAlign {
  return value === 'middle' || value === 'bottom' ? value : fallback;
}

function normalizeTextAlign(value: TextAlign | undefined, fallback: TextAlign): TextAlign {
  return value === 'left' || value === 'right' ? value : fallback;
}

function normalizeTextEffect(value: TextEffect | undefined, fallback: TextEffect): TextEffect {
  return value === 'shadow' || value === 'none' ? value : fallback;
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

function normalizeDescription(value: string | undefined) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
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

function cloneTextBox(box: TextBox): TextBox {
  return {
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    rotation: box.rotation,
  };
}

function cloneTextLayer(layer: TextLayer): TextLayer {
  return {
    ...layer,
    box: cloneTextBox(layer.box),
  };
}
