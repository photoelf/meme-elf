export const TEXT_ALIGN_OPTIONS = ['left', 'center', 'right'] as const;
export const VERTICAL_ALIGN_OPTIONS = ['top', 'middle', 'bottom'] as const;
export const TEXT_EFFECT_OPTIONS = ['outline', 'shadow', 'none'] as const;
export const LAYER_KIND_OPTIONS = ['text', 'image'] as const;
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

export type LayerId = string;
export type TextAlign = (typeof TEXT_ALIGN_OPTIONS)[number];
export type VerticalAlign = (typeof VERTICAL_ALIGN_OPTIONS)[number];
export type TextEffect = (typeof TEXT_EFFECT_OPTIONS)[number];
export type LayerKind = (typeof LAYER_KIND_OPTIONS)[number];
export type ModalSourceKind = (typeof MODAL_SOURCE_KIND_OPTIONS)[number];
export type AdvancedImportPlacementMode =
  (typeof ADVANCED_IMPORT_PLACEMENT_MODE_OPTIONS)[number];
export type PreviewRotationQuarterTurns = 0 | 1 | 2 | 3;

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

export type EditorLayer = TextLayer | ImageLayer;

export function isTextLayer(layer: EditorLayer): layer is TextLayer {
  return layer.kind === 'text';
}

export function isImageLayer(layer: EditorLayer): layer is ImageLayer {
  return layer.kind === 'image';
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
};
