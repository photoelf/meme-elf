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
export type MelfTextSlotRole =
  | 'top-caption'
  | 'bottom-caption'
  | 'headline'
  | 'subtitle'
  | 'custom';

export type MelfTextSlot = {
  id: string;
  role: MelfTextSlotRole;
  name: string;
  defaultText?: string;
  box: TextBox;
  verticalAlign: VerticalAlign;
  fontFamily: string;
  fontSize: number;
  fillStyle: string;
  strokeStyle: string;
  outlineWidth: number;
  textAlign: TextAlign;
  effect: TextEffect;
  allCaps: boolean;
  bold: boolean;
  italic: boolean;
  opacity: number;
};

export type MelfImageSlotRole = 'primary-image' | 'secondary-image' | 'background-image' | 'custom';
export type MelfImageSlotFitMode = 'cover' | 'contain' | 'stretch';
export type MelfImageSlotAnchor =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'left'
  | 'center'
  | 'right'
  | 'bottom-left'
  | 'bottom'
  | 'bottom-right';

export type MelfTemplateImageSlot = {
  id: string;
  role: MelfImageSlotRole;
  name: string;
  fitMode: MelfImageSlotFitMode;
  anchor: MelfImageSlotAnchor;
  allowOverflow: boolean;
  box: TextBox;
};

export type MelfTemplateCanvasMetadata = {
  backgroundFill: string | null;
  safeInsets: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
};

type PartialMelfTemplateCanvasMetadata = Partial<MelfTemplateCanvasMetadata> & {
  safeInsets?: Partial<MelfTemplateCanvasMetadata['safeInsets']>;
};

export type MelfTemplateDocument = {
  kind: 'template';
  version: typeof MELF_DOCUMENT_VERSION;
  templateId: string;
  name: string;
  title: string;
  description: string;
  category: MelfTemplateCategory;
  tags: string[];
  sortOrder: number;
  previewImagePath: string | null;
  baseImagePath: string | null;
  scene: {
    canvasSize: {
      width: number;
      height: number;
    };
    activeLayerId: string | null;
    textSlots: MelfTextSlot[];
    imageSlots: MelfTemplateImageSlot[];
    canvas: MelfTemplateCanvasMetadata;
  };
  sceneImageAdjustments: SceneImageAdjustments;
  sceneEffectStack: SceneEffectStackItem[];
  sceneWatermark: SceneWatermark;
};

type PartialMelfTemplateDocument = Partial<MelfTemplateDocument> & {
  scene?: Partial<MelfTemplateDocument['scene']> & {
    textSlots?: Array<Partial<MelfTextSlot>>;
    imageSlots?: Array<Partial<MelfTemplateImageSlot>>;
    canvas?: PartialMelfTemplateCanvasMetadata;
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

  const templateId = normalizeIdentifier(input.templateId, 'untitled-template');
  const name = normalizeName(input.name, 'Untitled template');
  const canvasSize = normalizeCanvasSize(input.scene?.canvasSize);
  const textSlots = normalizeTextSlots(input.scene?.textSlots, input.scene?.textLayers, canvasSize);
  const imageSlots = normalizeImageSlots(input.scene?.imageSlots, canvasSize);
  const canvas = normalizeTemplateCanvasMetadata(input.scene?.canvas);

  return {
    kind: 'template',
    version: MELF_DOCUMENT_VERSION,
    templateId,
    name,
    title: normalizeName(input.title, name),
    description: normalizeDescription(input.description),
    category: normalizeCategory(input.category),
    tags: normalizeTags(input.tags),
    sortOrder: normalizeSortOrder(input.sortOrder),
    previewImagePath: normalizeAssetPath(input.previewImagePath),
    baseImagePath: normalizeAssetPath(input.baseImagePath),
    scene: {
      canvasSize,
      activeLayerId: resolveActiveLayerId(input.scene?.activeLayerId, textSlots),
      textSlots,
      imageSlots,
      canvas,
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
    title: 'Classic Top / Bottom',
    description: 'Two full-width caption boxes for the standard meme stack.',
    category: 'classic',
    tags: ['classic', 'two-text', 'reaction'],
    sortOrder: 100,
    previewImagePath: '/templates/classic-top-bottom/preview.jpg',
    baseImagePath: '/templates/classic-top-bottom/base.jpg',
    textSlots: [
      createPresetTextSlot({
        id: 'top',
        role: 'top-caption',
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
      createPresetTextSlot({
        id: 'bottom',
        role: 'bottom-caption',
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
    imageSlots: [
      createPresetImageSlot({
        id: 'primary-image',
        role: 'primary-image',
        name: 'Primary image',
        box: {
          x: 24,
          y: 110,
          width: 752,
          height: 230,
          rotation: 0,
        },
      }),
    ],
  }),
  createTemplatePreset({
    templateId: 'top-caption',
    name: 'Top caption',
    title: 'Top Caption',
    description: 'Single caption anchored above the image area.',
    category: 'caption',
    tags: ['caption', 'headline', 'single-text'],
    sortOrder: 200,
    previewImagePath: '/templates/top-caption/preview.jpg',
    baseImagePath: '/templates/top-caption/base.jpg',
    textSlots: [
      createPresetTextSlot({
        id: 'top',
        role: 'top-caption',
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
    imageSlots: [
      createPresetImageSlot({
        id: 'primary-image',
        role: 'primary-image',
        name: 'Primary image',
        box: {
          x: 24,
          y: 110,
          width: 752,
          height: 340,
          rotation: 0,
        },
      }),
    ],
  }),
  createTemplatePreset({
    templateId: 'bottom-caption',
    name: 'Bottom caption',
    title: 'Bottom Caption',
    description: 'Single caption anchored below the image area.',
    category: 'caption',
    tags: ['caption', 'single-text', 'subtitle'],
    sortOrder: 300,
    previewImagePath: '/templates/bottom-caption/preview.jpg',
    baseImagePath: '/templates/bottom-caption/base.jpg',
    textSlots: [
      createPresetTextSlot({
        id: 'bottom',
        role: 'bottom-caption',
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
    imageSlots: [
      createPresetImageSlot({
        id: 'primary-image',
        role: 'primary-image',
        name: 'Primary image',
        box: {
          x: 24,
          y: 0,
          width: 752,
          height: 340,
          rotation: 0,
        },
      }),
    ],
  }),
  createTemplatePreset({
    templateId: 'square-social',
    name: 'Square social',
    title: 'Square Social',
    description: 'A square canvas with roomy caption blocks for feed posts.',
    category: 'social',
    tags: ['feed', 'instagram', 'square'],
    sortOrder: 400,
    previewImagePath: '/templates/square-social/preview.jpg',
    baseImagePath: '/templates/square-social/base.jpg',
    canvasSize: {
      width: 1080,
      height: 1080,
    },
    textSlots: [
      createPresetTextSlot({
        id: 'top',
        role: 'top-caption',
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
      createPresetTextSlot({
        id: 'bottom',
        role: 'bottom-caption',
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
    imageSlots: [
      createPresetImageSlot({
        id: 'primary-image',
        role: 'primary-image',
        name: 'Primary image',
        box: {
          x: 32,
          y: 180,
          width: 1016,
          height: 720,
          rotation: 0,
        },
      }),
    ],
  }),
];

function createTemplatePreset(input: {
  templateId: string;
  name: string;
  title: string;
  description: string;
  category: MelfTemplateCategory;
  tags: string[];
  sortOrder: number;
  previewImagePath: string | null;
  baseImagePath: string | null;
  canvasSize?: {
    width: number;
    height: number;
  };
  textSlots: MelfTextSlot[];
  imageSlots?: MelfTemplateImageSlot[];
  canvas?: PartialMelfTemplateCanvasMetadata;
}): MelfTemplateDocument {
  return {
    kind: 'template',
    version: MELF_DOCUMENT_VERSION,
    templateId: input.templateId,
    name: input.name,
    title: input.title,
    description: input.description,
    category: input.category,
    tags: [...input.tags],
    sortOrder: input.sortOrder,
    previewImagePath: input.previewImagePath,
    baseImagePath: input.baseImagePath,
    scene: {
      canvasSize: input.canvasSize ?? { ...DEFAULT_CANVAS_SIZE },
      activeLayerId: input.textSlots[0]?.id ?? null,
      textSlots: input.textSlots.map(cloneTextSlot),
      imageSlots: input.imageSlots?.map(cloneImageSlot) ?? [],
      canvas: normalizeTemplateCanvasMetadata(input.canvas),
    },
    sceneImageAdjustments: normalizeSceneImageAdjustments({}),
    sceneEffectStack: createDefaultSceneEffectStack(),
    sceneWatermark: createDefaultSceneWatermark(),
  };
}

function createPresetTextSlot(input: {
  id: string;
  role: MelfTextSlotRole;
  name: string;
  verticalAlign: VerticalAlign;
  box: TextBox;
  fontSize?: number;
}): MelfTextSlot {
  const defaultLayer = createTextLayer(input.id, input.name, input.box.y, input.verticalAlign);

  return {
    id: input.id,
    role: input.role,
    name: input.name,
    box: cloneTextBox(input.box),
    verticalAlign: input.verticalAlign,
    fontFamily: defaultLayer.fontFamily,
    fontSize: normalizePositiveInt(input.fontSize, DEFAULT_FONT_SIZE),
    fillStyle: defaultLayer.fillStyle,
    strokeStyle: defaultLayer.strokeStyle,
    outlineWidth: defaultLayer.outlineWidth,
    textAlign: defaultLayer.textAlign,
    effect: defaultLayer.effect,
    allCaps: defaultLayer.allCaps,
    bold: defaultLayer.bold,
    italic: defaultLayer.italic,
    opacity: defaultLayer.opacity,
  };
}

function createPresetImageSlot(input: {
  id: string;
  role: MelfImageSlotRole;
  name: string;
  box: TextBox;
  fitMode?: MelfImageSlotFitMode;
  anchor?: MelfImageSlotAnchor;
  allowOverflow?: boolean;
}): MelfTemplateImageSlot {
  return {
    id: input.id,
    role: input.role,
    name: input.name,
    fitMode: input.fitMode ?? 'cover',
    anchor: input.anchor ?? 'center',
    allowOverflow: input.allowOverflow ?? false,
    box: cloneTextBox(input.box),
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

function normalizeTextSlots(
  input: Array<Partial<MelfTextSlot>> | undefined,
  legacyLayers: Array<Partial<TextLayer>> | undefined,
  canvasSize: { width: number; height: number },
) {
  if (input && input.length > 0) {
    return input.map((slot, index) => normalizeTextSlot(slot, index, canvasSize));
  }

  if (legacyLayers && legacyLayers.length > 0) {
    return legacyLayers.map((layer, index) => normalizeLegacyTextLayerAsSlot(layer, index, canvasSize));
  }

  return [];
}

function normalizeTextSlot(
  slot: Partial<MelfTextSlot>,
  index: number,
  canvasSize: { width: number; height: number },
) {
  const fallbackVerticalAlign = index === 1 ? 'bottom' : 'top';
  const verticalAlign = normalizeVerticalAlign(slot.verticalAlign, fallbackVerticalAlign);
  const fallbackId = verticalAlign === 'bottom' ? 'bottom' : `text-${index + 1}`;
  const defaultLayer = createTextLayer(
    normalizeIdentifier(slot.id, fallbackId),
    normalizeName(slot.name, verticalAlign === 'bottom' ? 'Bottom text' : 'Text'),
    resolveDefaultLayerY(verticalAlign, canvasSize.height),
    verticalAlign,
  );

  return {
    id: defaultLayer.id,
    role: normalizeTextSlotRole(slot.role, resolveSlotRole(defaultLayer.id, verticalAlign, index)),
    name: normalizeName(slot.name, defaultLayer.name),
    defaultText: normalizeOptionalString(slot.defaultText),
    fontFamily: normalizeFontFamily(slot.fontFamily),
    fontSize: normalizePositiveInt(slot.fontSize, defaultLayer.fontSize),
    fillStyle: normalizeHexColor(slot.fillStyle, DEFAULT_FILL),
    strokeStyle: normalizeHexColor(slot.strokeStyle, DEFAULT_STROKE),
    outlineWidth: normalizeNonNegativeInt(slot.outlineWidth, DEFAULT_OUTLINE_WIDTH),
    textAlign: normalizeTextAlign(slot.textAlign, defaultLayer.textAlign),
    verticalAlign,
    effect: normalizeTextEffect(slot.effect, defaultLayer.effect),
    allCaps: typeof slot.allCaps === 'boolean' ? slot.allCaps : defaultLayer.allCaps,
    bold: typeof slot.bold === 'boolean' ? slot.bold : defaultLayer.bold,
    italic: typeof slot.italic === 'boolean' ? slot.italic : defaultLayer.italic,
    opacity: clampUnit(slot.opacity, 1),
    box: normalizeTextBox(slot.box, defaultLayer.box, canvasSize),
  };
}

function normalizeLegacyTextLayerAsSlot(
  layer: Partial<TextLayer>,
  index: number,
  canvasSize: { width: number; height: number },
) {
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
    id: defaultLayer.id,
    role: resolveSlotRole(defaultLayer.id, verticalAlign, index),
    name: defaultLayer.name,
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

function normalizeImageSlots(
  input: Array<Partial<MelfTemplateImageSlot>> | undefined,
  canvasSize: { width: number; height: number },
) {
  if (!input || input.length === 0) {
    return [];
  }

  return input.map((slot, index) => normalizeImageSlot(slot, index, canvasSize));
}

function normalizeImageSlot(
  slot: Partial<MelfTemplateImageSlot>,
  index: number,
  canvasSize: { width: number; height: number },
): MelfTemplateImageSlot {
  const fallbackId = `image-slot-${index + 1}`;
  const defaultBox = {
    x: 0,
    y: 0,
    width: canvasSize.width,
    height: canvasSize.height,
    rotation: 0,
  };

  return {
    id: normalizeIdentifier(slot.id, fallbackId),
    role: normalizeImageSlotRole(slot.role),
    name: normalizeName(slot.name, `Image slot ${index + 1}`),
    fitMode: normalizeImageSlotFitMode(slot.fitMode),
    anchor: normalizeImageSlotAnchor(slot.anchor),
    allowOverflow: typeof slot.allowOverflow === 'boolean' ? slot.allowOverflow : false,
    box: normalizeTextBox(slot.box, defaultBox, canvasSize),
  };
}

function normalizeTemplateCanvasMetadata(
  input: PartialMelfTemplateCanvasMetadata | undefined,
): MelfTemplateCanvasMetadata {
  const defaults = createDefaultTemplateCanvasMetadata();

  return {
    backgroundFill:
      input?.backgroundFill === undefined
        ? defaults.backgroundFill
        : normalizeNullableHexColor(input.backgroundFill),
    safeInsets: {
      top: normalizeNonNegativeInt(input?.safeInsets?.top, defaults.safeInsets.top),
      right: normalizeNonNegativeInt(input?.safeInsets?.right, defaults.safeInsets.right),
      bottom: normalizeNonNegativeInt(input?.safeInsets?.bottom, defaults.safeInsets.bottom),
      left: normalizeNonNegativeInt(input?.safeInsets?.left, defaults.safeInsets.left),
    },
  };
}

function resolveActiveLayerId(activeLayerId: string | null | undefined, slots: MelfTextSlot[]) {
  if (typeof activeLayerId === 'string' && slots.some((slot) => slot.id === activeLayerId)) {
    return activeLayerId;
  }

  return slots[0]?.id ?? null;
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

function normalizeTextSlotRole(
  value: MelfTextSlotRole | undefined,
  fallback: MelfTextSlotRole,
): MelfTextSlotRole {
  return value === 'top-caption' ||
    value === 'bottom-caption' ||
    value === 'headline' ||
    value === 'subtitle' ||
    value === 'custom'
    ? value
    : fallback;
}

function normalizeImageSlotRole(value: MelfImageSlotRole | undefined): MelfImageSlotRole {
  return value === 'primary-image' ||
    value === 'secondary-image' ||
    value === 'background-image'
    ? value
    : 'custom';
}

function normalizeImageSlotFitMode(
  value: MelfImageSlotFitMode | undefined,
): MelfImageSlotFitMode {
  return value === 'contain' || value === 'stretch' ? value : 'cover';
}

function normalizeImageSlotAnchor(
  value: MelfImageSlotAnchor | undefined,
): MelfImageSlotAnchor {
  return value === 'top-left' ||
    value === 'top' ||
    value === 'top-right' ||
    value === 'left' ||
    value === 'center' ||
    value === 'right' ||
    value === 'bottom-left' ||
    value === 'bottom' ||
    value === 'bottom-right'
    ? value
    : 'center';
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

function normalizeDescription(value: string | undefined) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);

  return Array.from(new Set(normalized));
}

function normalizeSortOrder(value: number | undefined) {
  if (!Number.isFinite(value) || value === undefined) {
    return 0;
  }

  return Math.max(0, Math.round(value));
}

function normalizeAssetPath(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeOptionalString(value: string | undefined) {
  if (typeof value !== 'string') {
    return undefined;
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

function normalizeNullableHexColor(value: string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  return /^#[0-9a-f]{6}$/iu.test(value) ? value.toLowerCase() : null;
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

function createDefaultTemplateCanvasMetadata(): MelfTemplateCanvasMetadata {
  return {
    backgroundFill: null,
    safeInsets: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
  };
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

function cloneTextSlot(slot: MelfTextSlot): MelfTextSlot {
  return {
    ...slot,
    defaultText: slot.defaultText,
    box: cloneTextBox(slot.box),
  };
}

function cloneImageSlot(slot: MelfTemplateImageSlot): MelfTemplateImageSlot {
  return {
    ...slot,
    box: cloneTextBox(slot.box),
  };
}

function resolveSlotRole(
  id: string,
  verticalAlign: VerticalAlign,
  index: number,
): MelfTextSlotRole {
  if (id === 'top') {
    return 'top-caption';
  }

  if (id === 'bottom') {
    return 'bottom-caption';
  }

  if (verticalAlign === 'bottom') {
    return index <= 1 ? 'bottom-caption' : 'subtitle';
  }

  if (verticalAlign === 'middle') {
    return index === 0 ? 'headline' : 'subtitle';
  }

  return index === 0 ? 'top-caption' : 'headline';
}
