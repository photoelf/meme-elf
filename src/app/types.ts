export const TEXT_ALIGN_OPTIONS = ['left', 'center', 'right'] as const;
export const VERTICAL_ALIGN_OPTIONS = ['top', 'middle', 'bottom'] as const;
export const TEXT_EFFECT_OPTIONS = ['outline', 'shadow', 'none'] as const;
export const LAYER_KIND_OPTIONS = ['text', 'image', 'draw'] as const;
export const MODAL_SOURCE_KIND_OPTIONS = [
  'upload-image',
  'advanced-import-file',
  'advanced-import-clipboard',
] as const;
export const ADVANCED_IMPORT_PLACEMENT_MODE_OPTIONS = [
  'inside-canvas',
  'outside-left',
  'outside-right',
  'outside-top',
  'outside-bottom',
] as const;
export const SCENE_BOUNDS_FILL_MODE_OPTIONS = [
  'transparent',
  'solid-color',
  'sampled-edge',
  'average-border',
] as const;
export const SCENE_IMAGE_ADJUSTMENT_OPTIONS = [
  'brightness',
  'contrast',
  'saturation',
  'hue',
  'grayscale',
  'sepia',
  'invert',
] as const;
export const SCENE_EFFECT_STACK_KIND_OPTIONS = [
  'blur',
  'sharpen',
  'threshold',
  'pixelate',
  'noise',
  'grain',
  'posterize',
  'jpeg',
] as const;
export const SCENE_WATERMARK_MODE_OPTIONS = [
  'center',
  'corner',
  'tile',
  'diagonal',
] as const;
export const SCENE_WATERMARK_CORNER_OPTIONS = [
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
] as const;

export type LayerId = string;
export type TextAlign = (typeof TEXT_ALIGN_OPTIONS)[number];
export type VerticalAlign = (typeof VERTICAL_ALIGN_OPTIONS)[number];
export type TextEffect = (typeof TEXT_EFFECT_OPTIONS)[number];
export type LayerKind = (typeof LAYER_KIND_OPTIONS)[number];
export type ModalSourceKind = (typeof MODAL_SOURCE_KIND_OPTIONS)[number];
export type AdvancedImportPlacementMode =
  (typeof ADVANCED_IMPORT_PLACEMENT_MODE_OPTIONS)[number];
export type SceneBoundsFillMode = (typeof SCENE_BOUNDS_FILL_MODE_OPTIONS)[number];
export type PreviewRotationQuarterTurns = 0 | 1 | 2 | 3;
export type SceneImageAdjustmentKind = (typeof SCENE_IMAGE_ADJUSTMENT_OPTIONS)[number];
export type SceneEffectStackKind = (typeof SCENE_EFFECT_STACK_KIND_OPTIONS)[number];
export type SceneWatermarkMode = (typeof SCENE_WATERMARK_MODE_OPTIONS)[number];
export type SceneWatermarkCorner = (typeof SCENE_WATERMARK_CORNER_OPTIONS)[number];

export type TextBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

export type ImageSkew = {
  x: number;
  y: number;
};

export type CropDraftBox = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

export type SceneCropDraftRect = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

export type SceneExpandDraft = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export type SceneBoundsDraft = {
  cropRect: SceneCropDraftRect | null;
  expand: SceneExpandDraft;
  fillMode: SceneBoundsFillMode;
  fillColor: string;
};

export type SceneImageAdjustments = {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  grayscale: boolean;
  includeText: boolean;
  sepia: boolean;
  invert: boolean;
};

export type SceneEffectStackItem = {
  id: string;
  kind: SceneEffectStackKind;
  value: number;
};

export type SceneWatermark = {
  enabled: boolean;
  text: string;
  mode: SceneWatermarkMode;
  corner: SceneWatermarkCorner;
  opacity: number;
  size: number;
  color: string;
  rotation: number;
};

export type PendingPreparedImageSource = {
  sourceKind: ModalSourceKind;
  image: CanvasImageSource | null;
  sourceSize: {
    width: number;
    height: number;
  };
};

export type PreInsertModalDraft = {
  pendingSource: PendingPreparedImageSource;
  cropBox: CropDraftBox | null;
  rotationQuarterTurns: PreviewRotationQuarterTurns;
  flipHorizontal: boolean;
  flipVertical: boolean;
  advancedPlacementMode: AdvancedImportPlacementMode;
};

export type BaseLayer = {
  kind: LayerKind;
  id: LayerId;
  name: string;
  box: TextBox;
  opacity: number;
};

export type TextLayer = BaseLayer & {
  kind: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  fillStyle: string;
  strokeStyle: string;
  outlineWidth: number;
  textAlign: TextAlign;
  verticalAlign: VerticalAlign;
  effect: TextEffect;
  allCaps: boolean;
  bold: boolean;
  italic: boolean;
};

export type ImageLayer = BaseLayer & {
  kind: 'image';
  image: CanvasImageSource | null;
  sourceSize: {
    width: number;
    height: number;
  };
  skew: ImageSkew;
};

export type RasterSurface = {
  width: number;
  height: number;
  data: Uint8ClampedArray<ArrayBuffer>;
};

export type DrawPoint = {
  x: number;
  y: number;
};

export type SelectionDraftRect = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

export type SelectionRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type RasterSelectionTargetId = 'base-image' | LayerId;
export type MobileGestureOwner =
  | 'idle'
  | 'pan'
  | 'draw'
  | 'erase'
  | 'select'
  | 'crop'
  | 'transform'
  | 'clone-stamp'
  | 'eyedropper'
  | 'focus-layer';

export type MobileInteractionState = {
  activeGestureOwner: MobileGestureOwner;
  activeTargetId: RasterSelectionTargetId | null;
  lastPointerType: 'mouse' | 'pen' | 'touch' | 'unknown';
};

export type DrawLayer = BaseLayer & {
  kind: 'draw';
  raster: RasterSurface;
  sourceSize: {
    width: number;
    height: number;
  };
};

export type RetouchState = {
  mode: 'idle' | 'draw' | 'erase' | 'eyedropper' | 'select' | 'clone-stamp';
  activeDrawLayerId: LayerId | null;
  draftStroke: {
    points: DrawPoint[];
    targetLayerId: LayerId | null;
  } | null;
  cloneStamp: {
    sourcePoint: DrawPoint | null;
    sourceTargetId: RasterSelectionTargetId | null;
  };
  selection: {
    targetId: RasterSelectionTargetId | null;
    draftRect: SelectionDraftRect | null;
    rect: SelectionRect | null;
  };
  brush: {
    color: string;
    size: number;
    opacity: number;
    softEdge: boolean;
  };
};

export type EditorLayer = TextLayer | ImageLayer | DrawLayer;

export function isTextLayer(layer: EditorLayer): layer is TextLayer {
  return layer.kind === 'text';
}

export function isImageLayer(layer: EditorLayer): layer is ImageLayer {
  return layer.kind === 'image';
}

export function isDrawLayer(layer: EditorLayer): layer is DrawLayer {
  return layer.kind === 'draw';
}

export type AppStatus = 'idle' | 'loadingImage' | 'copying' | 'error';

export type AppState = {
  image: HTMLImageElement | null;
  canvasSize: {
    width: number;
    height: number;
  };
  layers: EditorLayer[];
  activeLayerId: LayerId | null;
  status: AppStatus;
  errorMessage: string | null;
  previewZoomFactor: number;
  preInsertModalDraft: PreInsertModalDraft | null;
  preferredAdvancedImportPlacementMode: AdvancedImportPlacementMode;
  sceneImageAdjustments: SceneImageAdjustments;
  sceneEffectStack: SceneEffectStackItem[];
  sceneWatermark: SceneWatermark;
  sceneBoundsDraft: SceneBoundsDraft;
  activeSceneBoundsMode: 'idle' | 'crop' | 'expand';
  mobileInteraction: MobileInteractionState;
  retouch: RetouchState;
};
