import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  createDefaultAppState,
  createTextLayer,
  DEFAULT_CANVAS_SIZE,
  DEFAULT_LAYER_EDGE_OFFSET,
  DEFAULT_PREVIEW_ZOOM_FACTOR,
} from './default-state';
import { getContainedCanvasSize } from '../features/canvas/canvas-renderer';
import {
  extractImageFromPasteEvent,
  readImageFromClipboard,
  readImageFromClipboardResult,
} from '../features/clipboard/clipboard-service';
import { PreviewCanvas } from '../features/preview/preview-canvas';
import { ControlPanel } from '../features/controls/control-panel';
import {
  loadImageElementFromFile,
  revokeLoadedImageObjectUrl,
} from '../features/image/image-loader';
import {
  createDefaultSceneEffectStack,
  createDefaultSceneImageAdjustments,
  normalizeSceneEffectStack,
  normalizeSceneImageAdjustments,
} from '../features/image/image-effects';
import {
  createDefaultSceneWatermark,
  normalizeSceneWatermark,
} from '../features/image/watermark-utils';
import {
  createDefaultImageLayer,
  flipImageLayerHorizontal,
  flipImageLayerVertical,
  getDirectionalInsertionLayout,
  reorderLayerStack,
  rotateImageLayer90,
} from '../features/image/image-layer-utils';
import {
  applySceneImageStackTransform,
  createTransformedSceneImage,
  type SceneImageStackTransform,
} from '../features/image/scene-image-stack-utils';
import { normalizeCropDraftBox, resolvePreparedOutputDimensions } from '../features/image/image-crop-utils';
import { applySceneCrop, applySceneExpand } from '../features/bounds/scene-bounds';
import { normalizeSceneCropRect } from '../features/bounds/crop-overlay';
import { resolveBoundsFill } from '../features/bounds/fill-modes';
import { commitDrawStroke, createDrawLayer } from '../features/draw/draw-layer-utils';
import {
  clearRasterSelection,
  clampSelectionRectToBox,
  extractRasterSelection,
  mapSelectionRectToSourceRect,
  normalizeSelectionRect,
  selectionRectIsEmpty,
} from '../features/selection/selection-utils';
import {
  rotateDraftClockwise,
  rotateDraftCounterClockwise,
  toggleDraftFlipHorizontal,
  toggleDraftFlipVertical,
} from '../features/image/pre-insert-state';
import { PreInsertModal } from '../features/image/pre-insert-modal';
import { isDrawLayer, isImageLayer, isTextLayer } from './types';
import type {
  DrawPoint,
  EditorLayer,
  LayerId,
  RasterSelectionTargetId,
  SceneEffectStackItem,
  SceneImageAdjustments,
  SelectionDraftRect,
  SelectionRect,
  SceneWatermark,
  TextLayer,
} from './types';

const MAX_PREVIEW_WIDTH = 960;
const DEFAULT_INSPECTOR_WIDTH = 24;
const MIN_PANEL_WIDTH = 300;
const PREVIEW_ZOOM_STEP = 0.1;
const MIN_PREVIEW_ZOOM_FACTOR = 0.1;
const MAX_PREVIEW_ZOOM_FACTOR = 3;
const EQUAL_MARGIN_PRESET = 48;
const CAPTION_SPACE_PRESET = 120;
type InspectorTab = 'layers' | 'crop' | 'adjustments' | 'draw' | 'effects' | 'watermark';
type ImageInsertionMode =
  | 'inside-canvas'
  | 'outside-left'
  | 'outside-right'
  | 'outside-top'
  | 'outside-bottom';
type ImportTarget =
  | { kind: 'base' }
  | { kind: 'advanced-import-file' };
type ImportRequestContext = {
  restoreFocusTo: HTMLElement | null;
  target: ImportTarget;
};
type HistoryMode = 'immediate' | 'defer';
type EditorHistorySnapshot = {
  image: HTMLImageElement | null;
  canvasSize: {
    width: number;
    height: number;
  };
  layers: EditorLayer[];
  activeLayerId: LayerId | null;
  sceneImageAdjustments: SceneImageAdjustments;
  sceneEffectStack: SceneEffectStackItem[];
  sceneWatermark: SceneWatermark;
};

type SelectionClipboardSnapshot = {
  image: CanvasImageSource;
  sceneRect: SelectionRect;
  sourceRect: {
    width: number;
    height: number;
  };
};

const MAX_HISTORY_STEPS = 10;

function createLayersForCanvas(
  layers: EditorLayer[],
  currentSize: { width: number; height: number },
  nextSize: { width: number; height: number },
) {
  const scaleX = nextSize.width / currentSize.width;
  const scaleY = nextSize.height / currentSize.height;

  return layers.map((layer) => {
    return {
      ...layer,
      box: {
        ...layer.box,
        x: Math.round(layer.box.x * scaleX),
        y: Math.round(layer.box.y * scaleY),
        width: Math.round(layer.box.width * scaleX),
        height: Math.round(layer.box.height * scaleY),
      },
    };
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

function getPreferredTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getStoredInspectorWidth(): number {
  if (typeof window === 'undefined') {
    return DEFAULT_INSPECTOR_WIDTH;
  }

  const storedWidth = Number(window.localStorage.getItem('meme-elf.inspector-width'));

  if (Number.isNaN(storedWidth)) {
    return DEFAULT_INSPECTOR_WIDTH;
  }

  return storedWidth > 0 ? storedWidth : DEFAULT_INSPECTOR_WIDTH;
}

function clampPreviewZoom(nextZoom: number) {
  return Math.min(MAX_PREVIEW_ZOOM_FACTOR, Math.max(MIN_PREVIEW_ZOOM_FACTOR, nextZoom));
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

function hasTextSelection() {
  const selection = window.getSelection();
  return Boolean(selection && selection.toString().trim().length > 0);
}

function blurActiveEditable() {
  const activeElement = document.activeElement;

  if (activeElement instanceof HTMLElement && isEditableTarget(activeElement)) {
    activeElement.blur();
  }
}

function resolveClipboardRouting(target: EventTarget | null, isPreInsertModalOpen: boolean) {
  const modalOwnsClipboard = isPreInsertModalOpen;
  const backgroundCopyAllowed =
    !modalOwnsClipboard && !isEditableTarget(target) && !hasTextSelection();

  return {
    backgroundCopyAllowed,
    modalOwnsClipboard,
  };
}

export function App() {
  const [appState, setAppState] = useState(createDefaultAppState);
  const [statusMessage, setStatusMessage] = useState<string | null>(appState.errorMessage);
  const [theme, setTheme] = useState<'light' | 'dark'>(getPreferredTheme);
  const [inspectorWidth, setInspectorWidth] = useState(getStoredInspectorWidth);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadButtonRef = useRef<HTMLButtonElement | null>(null);
  const workspaceRef = useRef<HTMLElement | null>(null);
  const isDraggingSplitRef = useRef(false);
  const nextLayerSequenceRef = useRef(appState.layers.length + 1);
  const nextImageLayerSequenceRef = useRef(1);
  const nextDrawLayerSequenceRef = useRef(1);
  const lastShortcutCopyAtRef = useRef(0);
  const latestExplicitClipboardRequestTokenRef = useRef(0);
  const selectionClipboardRef = useRef<SelectionClipboardSnapshot | null>(null);
  const pendingFilePickerRequestRef = useRef<ImportRequestContext>({
    restoreFocusTo: null,
    target: { kind: 'base' },
  });
  const preInsertSessionRef = useRef<{
    pendingUploadFileName: string | null;
    previousStatusMessage: string | null;
    requestContext: ImportRequestContext;
  }>({
    pendingUploadFileName: null,
    previousStatusMessage: null,
    requestContext: {
      restoreFocusTo: null,
      target: { kind: 'base' },
    },
  });
  const isPreInsertModalOpenRef = useRef(false);
  const [activeInspectorTab, setActiveInspectorTab] = useState<InspectorTab>('layers');
  const [isPreInsertCropMode, setIsPreInsertCropMode] = useState(false);
  const [isPreviewStageHovered, setIsPreviewStageHovered] = useState(false);
  const [previewPan, setPreviewPan] = useState({ x: 0, y: 0 });
  const [historyState, setHistoryState] = useState({ canRedo: false, canUndo: false });
  const previewPanSessionRef = useRef<{
    startClientX: number;
    startClientY: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);
  const appStateRef = useRef(appState);
  const historyPastRef = useRef<EditorHistorySnapshot[]>([]);
  const historyFutureRef = useRef<EditorHistorySnapshot[]>([]);
  const historyTransactionRef = useRef<EditorHistorySnapshot | null>(null);

  const activeStatusLabel = statusMessage ?? (appState.image ? 'Image loaded.' : 'Ready.');
  const selectionStatusTarget = appState.retouch.selection.targetId
    ? `Target: ${appState.retouch.selection.targetId === 'base-image' ? 'Base image' : appState.retouch.selection.targetId}`
    : 'Target: choose a raster layer or base image';
  const selectionStatusRect = appState.retouch.selection.rect
    ? `Selection: ${appState.retouch.selection.rect.width} x ${appState.retouch.selection.rect.height}px`
    : appState.retouch.selection.draftRect
      ? `Draft: ${normalizeSelectionRect(appState.retouch.selection.draftRect, appState.canvasSize).width} x ${normalizeSelectionRect(appState.retouch.selection.draftRect, appState.canvasSize).height}px`
      : 'No selection';

  function syncHistoryState() {
    setHistoryState({
      canUndo: historyPastRef.current.length > 0,
      canRedo: historyFutureRef.current.length > 0,
    });
  }

  function createHistorySnapshot(state: typeof appState): EditorHistorySnapshot {
    return {
      image: state.image,
      canvasSize: { ...state.canvasSize },
      layers: cloneLayers(state.layers),
      activeLayerId: state.activeLayerId,
      sceneImageAdjustments: { ...state.sceneImageAdjustments },
      sceneEffectStack: state.sceneEffectStack.map((effect) => ({ ...effect })),
      sceneWatermark: { ...state.sceneWatermark },
    };
  }

  function beginHistoryTransaction() {
    if (historyTransactionRef.current) {
      return;
    }

    historyTransactionRef.current = createHistorySnapshot(appStateRef.current);
  }

  function commitHistoryTransaction() {
    const snapshot = historyTransactionRef.current;
    historyTransactionRef.current = null;

    if (!snapshot) {
      return;
    }

    if (historySnapshotsEqual(snapshot, createHistorySnapshot(appStateRef.current))) {
      return;
    }

    historyPastRef.current = [...historyPastRef.current, snapshot].slice(-MAX_HISTORY_STEPS);
    historyFutureRef.current = [];
    syncHistoryState();
  }

  function applyAppStateChange(
    updater: (currentState: typeof appState) => typeof appState,
    historyMode: HistoryMode = 'immediate',
  ) {
    setAppState((currentState) => {
      const nextState = updater(currentState);

      if (historyMode === 'immediate' && !historySnapshotsEqual(createHistorySnapshot(currentState), createHistorySnapshot(nextState))) {
        historyPastRef.current = [
          ...historyPastRef.current,
          createHistorySnapshot(currentState),
        ].slice(-MAX_HISTORY_STEPS);
        historyFutureRef.current = [];
      }

      return nextState;
    });

    if (historyMode === 'immediate') {
      syncHistoryState();
    }
  }

  function restoreHistorySnapshot(snapshot: EditorHistorySnapshot, status: string) {
    setAppState((currentState) => ({
      ...currentState,
      image: snapshot.image,
      canvasSize: { ...snapshot.canvasSize },
      layers: cloneLayers(snapshot.layers),
      activeLayerId: snapshot.activeLayerId,
      sceneImageAdjustments: { ...snapshot.sceneImageAdjustments },
      sceneEffectStack: snapshot.sceneEffectStack.map((effect) => ({ ...effect })),
      sceneWatermark: { ...snapshot.sceneWatermark },
      status: 'idle',
      errorMessage: null,
      preInsertModalDraft: null,
      activeSceneBoundsMode: 'idle',
      sceneBoundsDraft: createResetSceneBoundsDraft(currentState.sceneBoundsDraft),
      retouch: {
        ...currentState.retouch,
        draftStroke: null,
        selection: {
          targetId: resolveSelectionTargetId({
            ...currentState,
            image: snapshot.image,
            canvasSize: { ...snapshot.canvasSize },
            layers: cloneLayers(snapshot.layers),
            activeLayerId: snapshot.activeLayerId,
          }),
          draftRect: null,
          rect: null,
        },
      },
    }));
    setStatusMessage(status);
  }

  function handleUndo() {
    if (historyPastRef.current.length === 0 || isPreInsertModalOpenRef.current) {
      return;
    }

    const previousSnapshot = historyPastRef.current[historyPastRef.current.length - 1] as EditorHistorySnapshot;
    historyPastRef.current = historyPastRef.current.slice(0, -1);
    historyFutureRef.current = [createHistorySnapshot(appStateRef.current), ...historyFutureRef.current].slice(
      0,
      MAX_HISTORY_STEPS,
    );
    restoreHistorySnapshot(previousSnapshot, 'Undo applied.');
    syncHistoryState();
  }

  function handleRedo() {
    if (historyFutureRef.current.length === 0 || isPreInsertModalOpenRef.current) {
      return;
    }

    const nextSnapshot = historyFutureRef.current[0] as EditorHistorySnapshot;
    historyFutureRef.current = historyFutureRef.current.slice(1);
    historyPastRef.current = [...historyPastRef.current, createHistorySnapshot(appStateRef.current)].slice(
      -MAX_HISTORY_STEPS,
    );
    restoreHistorySnapshot(nextSnapshot, 'Redo applied.');
    syncHistoryState();
  }

  useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);

  function createImportRequestContext(
    target: ImportTarget,
    restoreFocusTo: HTMLElement | null,
  ): ImportRequestContext {
    return {
      restoreFocusTo,
      target,
    };
  }

  function beginExplicitClipboardRequest() {
    latestExplicitClipboardRequestTokenRef.current += 1;
    return latestExplicitClipboardRequestTokenRef.current;
  }

  function isLatestExplicitClipboardRequest(requestToken: number) {
    return latestExplicitClipboardRequestTokenRef.current === requestToken;
  }

  function applyLoadedImage(image: HTMLImageElement, nextStatus: string) {
    applyAppStateChange((currentState) => {
      const sourceSize = getImageSourceSize(image, currentState.canvasSize);
      const canvasSize = getContainedCanvasSize(
        sourceSize.width,
        sourceSize.height,
        MAX_PREVIEW_WIDTH,
      );

      return {
        ...currentState,
        canvasSize,
        errorMessage: null,
        image,
        layers: createLayersForCanvas(currentState.layers, currentState.canvasSize, canvasSize),
        status: 'idle',
      };
    });
    setStatusMessage(nextStatus);
  }

  function cancelSceneBounds() {
    setAppState((currentState) => ({
      ...currentState,
      activeSceneBoundsMode: 'idle',
      sceneBoundsDraft: {
        ...createResetSceneBoundsDraft(currentState.sceneBoundsDraft),
      },
    }));
  }

  function applySceneImageTransform(transform: SceneImageStackTransform) {
    applyAppStateChange((currentState) => {
      const nextScene = applySceneImageStackTransform({
        canvasSize: currentState.canvasSize,
        layers: currentState.layers,
        transform,
      });

      return {
        ...currentState,
        canvasSize: nextScene.canvasSize,
        image: createTransformedSceneImage({
          canvasSize: currentState.canvasSize,
          image: currentState.image,
          transform,
        }),
        layers: nextScene.layers,
        activeSceneBoundsMode:
          currentState.activeSceneBoundsMode === 'crop' ? 'idle' : currentState.activeSceneBoundsMode,
        sceneBoundsDraft:
          currentState.activeSceneBoundsMode === 'crop'
            ? {
                ...currentState.sceneBoundsDraft,
                cropRect: null,
              }
            : currentState.sceneBoundsDraft,
      };
    });
    setStatusMessage(getSceneImageTransformStatus(transform));
  }

  function applySceneExpandCommit() {
    applyAppStateChange((currentState) => {
      const nextScene = applySceneExpand({
        canvasSize: currentState.canvasSize,
        expand: currentState.sceneBoundsDraft.expand,
        layers: currentState.layers,
      });

      if (
        nextScene.canvasSize.width === currentState.canvasSize.width &&
        nextScene.canvasSize.height === currentState.canvasSize.height
      ) {
        return {
          ...currentState,
          activeSceneBoundsMode: 'idle',
          sceneBoundsDraft: {
            ...createResetSceneBoundsDraft(currentState.sceneBoundsDraft),
          },
        };
      }

      return {
        ...currentState,
        canvasSize: nextScene.canvasSize,
        image: createExpandedBaseImage(
          currentState.image,
          currentState.canvasSize,
          nextScene.canvasSize,
          nextScene.contentOffset,
          {
            fillColor: currentState.sceneBoundsDraft.fillColor,
            fillMode: currentState.sceneBoundsDraft.fillMode,
          },
        ),
        layers: nextScene.layers,
        activeSceneBoundsMode: 'idle',
        sceneBoundsDraft: {
          ...createResetSceneBoundsDraft(currentState.sceneBoundsDraft),
        },
      };
    });
    setStatusMessage('Canvas expanded.');
  }

  function updateSceneExpandDraft(
    side: 'left' | 'right' | 'top' | 'bottom',
    value: number,
  ) {
    setAppState((currentState) => ({
      ...currentState,
      activeSceneBoundsMode: 'expand',
      sceneBoundsDraft: {
        cropRect: null,
        expand: {
          ...currentState.sceneBoundsDraft.expand,
          [side]: Number.isFinite(value) ? value : 0,
        },
        fillMode: currentState.sceneBoundsDraft.fillMode,
        fillColor: currentState.sceneBoundsDraft.fillColor,
      },
    }));
  }

  function applySceneBoundsPreset(
    preset: 'equal-margin' | 'top-caption' | 'bottom-caption' | 'square-canvas',
  ) {
    setAppState((currentState) => ({
      ...currentState,
      activeSceneBoundsMode: 'expand',
      sceneBoundsDraft: {
        cropRect: null,
        expand: resolveSceneExpandPreset(preset, currentState.canvasSize),
        fillMode: currentState.sceneBoundsDraft.fillMode,
        fillColor: currentState.sceneBoundsDraft.fillColor,
      },
    }));
  }

  function applySceneCropCommit() {
    applyAppStateChange((currentState) => {
      const draftCropRect = currentState.sceneBoundsDraft.cropRect;

      if (!draftCropRect) {
        return currentState;
      }

      const nextCropRect = normalizeSceneCropRect(draftCropRect, currentState.canvasSize);

      if (nextCropRect.width === 0 || nextCropRect.height === 0) {
        return {
          ...currentState,
          activeSceneBoundsMode: 'idle',
          sceneBoundsDraft: {
            ...currentState.sceneBoundsDraft,
            cropRect: null,
          },
        };
      }

      const nextScene = applySceneCrop({
        canvasSize: currentState.canvasSize,
        cropRect: nextCropRect,
        layers: currentState.layers,
      });

      return {
        ...currentState,
        canvasSize: nextScene.canvasSize,
        image: currentState.image
          ? createSceneCroppedImage(currentState.image, currentState.canvasSize, nextCropRect)
          : currentState.image,
        layers: nextScene.layers,
        activeLayerId: nextScene.layers.some((layer) => layer.id === currentState.activeLayerId)
          ? currentState.activeLayerId
          : nextScene.layers[0]?.id ?? null,
        activeSceneBoundsMode: 'idle',
        sceneBoundsDraft: {
          ...currentState.sceneBoundsDraft,
          cropRect: null,
        },
      };
    });
    setStatusMessage('Scene cropped.');
  }

  function openPreInsertModal(
    image: HTMLImageElement,
    fileName: string,
    sourceKind: 'upload-image' | 'advanced-import-file' | 'advanced-import-clipboard',
    requestContext: ImportRequestContext,
  ) {
    preInsertSessionRef.current = {
      pendingUploadFileName: fileName,
      previousStatusMessage: statusMessage,
      requestContext,
    };
    isPreInsertModalOpenRef.current = true;
    setIsPreInsertCropMode(false);
    setAppState((currentState) => ({
      ...currentState,
      preInsertModalDraft: {
        pendingSource: {
          image,
          sourceKind,
          sourceSize: {
            width: image.naturalWidth || currentState.canvasSize.width,
            height: image.naturalHeight || currentState.canvasSize.height,
          },
        },
        cropBox: null,
        rotationQuarterTurns: 0,
        flipHorizontal: false,
        flipVertical: false,
        advancedPlacementMode: currentState.preferredAdvancedImportPlacementMode,
      },
      status: 'idle',
    }));
  }

  function closePreInsertModal(nextStatusMessage: string | null) {
    const pendingImage = appState.preInsertModalDraft?.pendingSource.image ?? null;

    revokeLoadedImageObjectUrl(pendingImage);

    // Keep mutable session metadata out of app state; only the draft itself drives rendering.
    preInsertSessionRef.current = {
      pendingUploadFileName: null,
      previousStatusMessage: null,
      requestContext: createImportRequestContext({ kind: 'base' }, null),
    };
    isPreInsertModalOpenRef.current = false;
    setIsPreInsertCropMode(false);
    setStatusMessage(nextStatusMessage);
    setAppState((currentState) => ({
      ...currentState,
      preInsertModalDraft: null,
      status: 'idle',
    }));
  }

  function updateTextLayer(
    layerId: LayerId,
    updates: Partial<TextLayer>,
    historyMode: HistoryMode = 'immediate',
  ) {
    applyAppStateChange((currentState) => ({
      ...currentState,
      layers: currentState.layers.map((layer) => {
        if (layer.id !== layerId || !isTextLayer(layer)) {
          return layer;
        }

        return { ...layer, ...updates };
      }),
    }), historyMode);
  }

  function updateLayer(
    layerId: LayerId,
    updates: Partial<EditorLayer>,
    historyMode: HistoryMode = 'immediate',
  ) {
    applyAppStateChange((currentState) => ({
      ...currentState,
      layers: currentState.layers.map((layer) => {
        if (layer.id !== layerId) {
          return layer;
        }

        if (isTextLayer(layer)) {
          return {
            ...layer,
            ...updates,
            kind: 'text',
          };
        }

        if (isDrawLayer(layer)) {
          return {
            ...layer,
            ...updates,
            kind: 'draw',
          };
        }

        return {
          ...layer,
          ...updates,
          kind: 'image',
        };
      }),
    }), historyMode);
  }

  function handleCreateDrawLayer() {
    applyAppStateChange((currentState) => {
      const nextSequence = nextDrawLayerSequenceRef.current;
      nextDrawLayerSequenceRef.current += 1;
      const nextLayerId = `draw-${nextSequence}`;
      const nextLayer = createDrawLayer({
        id: nextLayerId,
        name: `Brush ${nextSequence}`,
        width: currentState.canvasSize.width,
        height: currentState.canvasSize.height,
      });

      return {
        ...currentState,
        activeLayerId: nextLayerId,
        layers: insertDrawLayer(currentState.layers, nextLayer),
        retouch: {
          ...currentState.retouch,
          activeDrawLayerId: nextLayerId,
        },
      };
    }, 'defer');
  }

  function handleDraftStrokeChange(
    draftStroke: { points: DrawPoint[]; targetLayerId: LayerId | null } | null,
  ) {
    setAppState((currentState) => ({
      ...currentState,
      retouch: {
        ...currentState.retouch,
        draftStroke,
      },
    }));
  }

  function handleDraftStrokeCommit() {
    const currentDraft = appStateRef.current.retouch.draftStroke;

    if (!currentDraft || currentDraft.points.length === 0) {
      return;
    }

    applyAppStateChange((currentState) => {
      let targetLayerId = resolveDrawLayerTargetId(currentState);
      let nextLayers = cloneLayers(currentState.layers);

      if (!targetLayerId) {
        const nextSequence = nextDrawLayerSequenceRef.current;
        nextDrawLayerSequenceRef.current += 1;
        targetLayerId = `draw-${nextSequence}`;
        nextLayers = insertDrawLayer(
          nextLayers,
          createDrawLayer({
            id: targetLayerId,
            name: `Brush ${nextSequence}`,
            width: currentState.canvasSize.width,
            height: currentState.canvasSize.height,
          }),
        );
      }

      nextLayers = nextLayers.map((layer) =>
        layer.id === targetLayerId && isDrawLayer(layer)
          ? commitDrawStroke(layer, {
              points: currentDraft.points,
              brush: {
                ...currentState.retouch.brush,
                mode: currentState.retouch.mode === 'erase' ? 'erase' : 'draw',
              },
            })
          : layer,
      );

      return {
        ...currentState,
        activeLayerId: targetLayerId,
        layers: nextLayers,
        retouch: {
          ...currentState.retouch,
          activeDrawLayerId: targetLayerId,
          draftStroke: null,
        },
      };
    });
  }

  function updateRetouchBrush(
    updates: Partial<typeof appState.retouch.brush>,
  ) {
    setAppState((currentState) => ({
      ...currentState,
      retouch: {
        ...currentState.retouch,
        brush: {
          ...currentState.retouch.brush,
          ...updates,
        },
      },
    }));
  }

  function handleRetouchBrushSample(sample: { color: string; opacity: number }) {
    setAppState((currentState) => ({
      ...currentState,
      retouch: {
        ...currentState.retouch,
        mode: 'draw',
        brush: {
          ...currentState.retouch.brush,
          color: sample.color,
          opacity: sample.opacity,
        },
      },
    }));
    setStatusMessage('Brush color sampled from canvas.');
  }

  function handleSelectionDraftChange(draftRect: SelectionDraftRect | null) {
    setAppState((currentState) => ({
      ...currentState,
      retouch: {
        ...currentState.retouch,
        selection: {
          ...currentState.retouch.selection,
          draftRect,
        },
      },
    }));
  }

  function commitSelectionDraft(explicitDraftRect?: SelectionDraftRect) {
    setAppState((currentState) => {
      const targetId = currentState.retouch.selection.targetId;
      const draftRect = explicitDraftRect ?? currentState.retouch.selection.draftRect;
      const targetBox = targetId ? resolveSelectionTargetBox(currentState, targetId) : null;

      if (!targetId || !draftRect || !targetBox) {
        return currentState;
      }

      const normalized = normalizeSelectionRect(draftRect, currentState.canvasSize);
      const clamped = clampSelectionRectToBox(normalized, targetBox);

      if (selectionRectIsEmpty(clamped)) {
        return {
          ...currentState,
          retouch: {
            ...currentState.retouch,
            selection: {
              ...currentState.retouch.selection,
              draftRect: null,
              rect: null,
            },
          },
        };
      }

      return {
        ...currentState,
        retouch: {
          ...currentState.retouch,
          selection: {
            ...currentState.retouch.selection,
            draftRect: null,
            rect: clamped,
          },
        },
      };
    });
  }

  function handleApplySelection() {
    commitSelectionDraft();
  }

  function handleCancelSelection() {
    setAppState((currentState) => ({
      ...currentState,
      retouch: {
        ...currentState.retouch,
        selection: {
          ...currentState.retouch.selection,
          draftRect: null,
          rect: null,
        },
      },
    }));
  }

  function handleSelectionShortcutCopy(mode: 'copy' | 'cut') {
    let nextStatus = mode === 'copy' ? 'Selection copied.' : 'Selection cut.';

    applyAppStateChange((currentState) => {
      const targetId = currentState.retouch.selection.targetId;
      const rect = currentState.retouch.selection.rect;

      if (!targetId || !rect) {
        return currentState;
      }

      const extraction = extractSelectionForTarget(currentState, targetId, rect, mode);

      if (!extraction) {
        return currentState;
      }

      selectionClipboardRef.current = {
        image: extraction.image,
        sceneRect: extraction.sceneRect,
        sourceRect: {
          width: extraction.sourceRect.width,
          height: extraction.sourceRect.height,
        },
      };

      return mode === 'cut'
        ? {
            ...extraction.nextState,
            retouch: {
              ...extraction.nextState.retouch,
              selection: {
                targetId,
                draftRect: null,
                rect: null,
              },
            },
          }
        : currentState;
    });

    setStatusMessage(nextStatus);
  }

  function pasteSelectionClipboard() {
    const snapshot = selectionClipboardRef.current;

    if (!snapshot) {
      return;
    }

    applyAppStateChange((currentState) => {
      const nextSequence = nextImageLayerSequenceRef.current;
      nextImageLayerSequenceRef.current += 1;
      const nextLayerId = `image-${nextSequence}`;
      const nextLayer = createExtractedImageLayer(
        nextLayerId,
        nextSequence,
        snapshot.image,
        snapshot.sceneRect,
        snapshot.sourceRect,
      );

      return {
        ...currentState,
        activeLayerId: nextLayerId,
        layers: [nextLayer, ...currentState.layers],
      };
    });

    setStatusMessage('Selection pasted as a new layer.');
  }

  function copySelectionToLayer() {
    applySelectionToLayer('copy');
  }

  function cutSelectionToLayer() {
    applySelectionToLayer('cut');
  }

  function applySelectionToLayer(mode: 'copy' | 'cut') {
    applyAppStateChange((currentState) => {
      const targetId = currentState.retouch.selection.targetId;
      const rect = currentState.retouch.selection.rect;

      if (!targetId || !rect) {
        return currentState;
      }

      const extraction = extractSelectionForTarget(currentState, targetId, rect, mode);

      if (!extraction) {
        return currentState;
      }

      const nextSequence = nextImageLayerSequenceRef.current;
      nextImageLayerSequenceRef.current += 1;
      const nextLayerId = `image-${nextSequence}`;
      const nextLayer = createExtractedImageLayer(nextLayerId, nextSequence, extraction.image, extraction.sceneRect, extraction.sourceRect);

      return {
        ...extraction.nextState,
        activeLayerId: nextLayerId,
        layers: insertImageLayerAboveTarget(extraction.nextState.layers, targetId, nextLayer),
        retouch: {
          ...extraction.nextState.retouch,
          selection: {
            targetId,
            draftRect: null,
            rect: null,
          },
        },
      };
    });
    setStatusMessage(mode === 'copy' ? 'Selection copied to a new layer.' : 'Selection cut to a new layer.');
  }

  function updateSceneImageAdjustments(
    updates: Partial<typeof appState.sceneImageAdjustments>,
    historyMode: HistoryMode = 'immediate',
  ) {
    applyAppStateChange((currentState) => ({
      ...currentState,
      sceneImageAdjustments: normalizeSceneImageAdjustments({
        ...currentState.sceneImageAdjustments,
        ...updates,
      }),
    }), historyMode);
  }

  function resetSceneImageAdjustments() {
    applyAppStateChange((currentState) => ({
      ...currentState,
      sceneImageAdjustments: createDefaultSceneImageAdjustments(),
    }));
  }

  function updateSceneEffectValue(effectId: string, value: number, historyMode: HistoryMode = 'immediate') {
    applyAppStateChange((currentState) => ({
      ...currentState,
      sceneEffectStack: normalizeSceneEffectStack(
        currentState.sceneEffectStack.map((effect) =>
          effect.id === effectId ? { ...effect, value } : effect,
        ),
      ),
    }), historyMode);
  }

  function resetSceneEffectStack() {
    applyAppStateChange((currentState) => ({
      ...currentState,
      sceneEffectStack: createDefaultSceneEffectStack(),
    }));
  }

  function updateSceneWatermark(
    updates: Partial<SceneWatermark>,
    historyMode: HistoryMode = 'immediate',
  ) {
    applyAppStateChange((currentState) => ({
      ...currentState,
      sceneWatermark: normalizeSceneWatermark({
        ...currentState.sceneWatermark,
        ...updates,
      }),
    }), historyMode);
  }

  function resetSceneWatermark() {
    applyAppStateChange((currentState) => ({
      ...currentState,
      sceneWatermark: createDefaultSceneWatermark(),
    }));
  }

  function reorderSceneEffectStack(
    sourceEffectId: string,
    targetEffectId: string,
    placement: 'before' | 'after',
  ) {
    applyAppStateChange((currentState) => {
      const sourceIndex = currentState.sceneEffectStack.findIndex(
        (effect) => effect.id === sourceEffectId,
      );
      const targetIndex = currentState.sceneEffectStack.findIndex(
        (effect) => effect.id === targetEffectId,
      );

      if (
        sourceIndex < 0 ||
        targetIndex < 0 ||
        sourceEffectId === targetEffectId
      ) {
        return currentState;
      }

      const reordered = [...currentState.sceneEffectStack];
      const [moved] = reordered.splice(sourceIndex, 1);

      if (!moved) {
        return currentState;
      }

      const nextTargetIndex = reordered.findIndex((effect) => effect.id === targetEffectId);
      const insertIndex = placement === 'before' ? nextTargetIndex : nextTargetIndex + 1;
      reordered.splice(insertIndex, 0, moved);

      return {
        ...currentState,
        sceneEffectStack: reordered,
      };
    });
  }

  function transformImageLayer(
    layerId: LayerId,
    transform: (layer: Extract<EditorLayer, { kind: 'image' }>) => Extract<EditorLayer, { kind: 'image' }>,
  ) {
    applyAppStateChange((currentState) => ({
      ...currentState,
      layers: currentState.layers.map((layer) => {
        if (layer.id !== layerId || !isImageLayer(layer)) {
          return layer;
        }

        return transform(layer);
      }),
    }));
  }

  function addImageLayer(
    image: CanvasImageSource,
    fileName: string,
    insertionMode: ImageInsertionMode,
  ) {
    applyAppStateChange((currentState) => {
      const nextSequence = nextImageLayerSequenceRef.current;
      nextImageLayerSequenceRef.current += 1;
      const nextLayerId = `image-${nextSequence}`;
      const sourceSize = getImageSourceSize(
        image as Pick<HTMLImageElement, 'naturalWidth' | 'naturalHeight'> &
          Partial<Pick<HTMLCanvasElement, 'width' | 'height'>>,
        currentState.canvasSize,
      );

      if (insertionMode === 'inside-canvas') {
        const nextLayer = createDefaultImageLayer(
          nextLayerId,
          nextSequence,
          image,
          currentState.canvasSize,
          sourceSize,
        );

        return {
          ...currentState,
          activeLayerId: nextLayerId,
          layers: [nextLayer, ...currentState.layers],
          status: 'idle',
        };
      }

      const layout = getDirectionalInsertionLayout({
        canvasSize: currentState.canvasSize,
        imageSize: sourceSize,
        direction: insertionMode,
        layers: currentState.layers,
      });
      const nextBaseImage = currentState.image
        ? createExpandedBaseImage(
            currentState.image,
            currentState.canvasSize,
            layout.canvasSize,
            layout.existingContentOffset,
          )
        : currentState.image;
      const nextLayer = {
        ...createDefaultImageLayer(
          nextLayerId,
          nextSequence,
          image,
          layout.canvasSize,
          sourceSize,
        ),
        box: layout.insertedBox,
      };

      return {
        ...currentState,
        activeLayerId: nextLayerId,
        canvasSize: layout.canvasSize,
        image: nextBaseImage,
        layers: [nextLayer, ...layout.shiftedLayers],
        status: 'idle',
      };
    });

    setStatusMessage(
      insertionMode === 'inside-canvas'
        ? `${fileName} added as image layer.`
        : `${fileName} added ${insertionMode.replace('-', ' ')}.`,
    );
  }

  function applyLayerSettingsToAllLayers(sourceLayerId: LayerId) {
    applyAppStateChange((currentState) => {
      const sourceLayer = currentState.layers.find((layer) => layer.id === sourceLayerId);

      if (!sourceLayer || !isTextLayer(sourceLayer)) {
        return currentState;
      }

      return {
        ...currentState,
        layers: currentState.layers.map((layer) =>
          layer.id === sourceLayerId || !isTextLayer(layer)
            ? layer
            : {
                ...layer,
                allCaps: sourceLayer.allCaps,
                bold: sourceLayer.bold,
                effect: sourceLayer.effect,
                fillStyle: sourceLayer.fillStyle,
                fontFamily: sourceLayer.fontFamily,
                fontSize: sourceLayer.fontSize,
                italic: sourceLayer.italic,
                opacity: sourceLayer.opacity,
                outlineWidth: sourceLayer.outlineWidth,
                strokeStyle: sourceLayer.strokeStyle,
                textAlign: sourceLayer.textAlign,
                verticalAlign: sourceLayer.verticalAlign,
              },
        ),
      };
    });
  }

  function addLayer() {
    applyAppStateChange((currentState) => {
      const nextSequence = nextLayerSequenceRef.current;
      nextLayerSequenceRef.current += 1;
      const nextLayerId = `layer-${nextSequence}`;
      const fallbackWidth = currentState.canvasSize.width || DEFAULT_CANVAS_SIZE.width;
      const fallbackHeight = currentState.canvasSize.height || DEFAULT_CANVAS_SIZE.height;
      const nextLayer = createTextLayer(
        nextLayerId,
        `Text ${nextSequence}`,
        Math.round(fallbackHeight / 2),
        'middle',
      );

      nextLayer.box.x = DEFAULT_LAYER_EDGE_OFFSET;
      nextLayer.box.y = Math.round((fallbackHeight - nextLayer.box.height) / 2);
      nextLayer.box.width = fallbackWidth - DEFAULT_LAYER_EDGE_OFFSET * 2;

      return {
        ...currentState,
        activeLayerId: nextLayerId,
        layers: [...currentState.layers, nextLayer],
      };
    });
  }

  function duplicateLayer(layerId: LayerId) {
    applyAppStateChange((currentState) => {
      const sourceLayer = currentState.layers.find((layer) => layer.id === layerId);

      if (!sourceLayer) {
        return currentState;
      }

      if (isTextLayer(sourceLayer)) {
        const nextSequence = nextLayerSequenceRef.current;
        nextLayerSequenceRef.current += 1;
        const nextLayerId = `layer-${nextSequence}`;
        const nextLayer = {
          ...sourceLayer,
          id: nextLayerId,
          name: `${sourceLayer.name} copy`,
          box: {
            ...sourceLayer.box,
            x: sourceLayer.box.x + 16,
            y: sourceLayer.box.y + 16,
          },
        };

        return {
          ...currentState,
          activeLayerId: nextLayerId,
          layers: [...currentState.layers, nextLayer],
        };
      }

      if (isImageLayer(sourceLayer)) {
        const nextSequence = nextImageLayerSequenceRef.current;
        nextImageLayerSequenceRef.current += 1;
        const nextLayerId = `image-${nextSequence}`;
        const nextLayer = {
          ...sourceLayer,
          id: nextLayerId,
          name: `${sourceLayer.name} copy`,
          box: {
            ...sourceLayer.box,
            x: sourceLayer.box.x + 16,
            y: sourceLayer.box.y + 16,
          },
        };

        return {
          ...currentState,
          activeLayerId: nextLayerId,
          layers: [nextLayer, ...currentState.layers],
        };
      }

      const nextSequence = nextDrawLayerSequenceRef.current;
      nextDrawLayerSequenceRef.current += 1;
      const nextLayerId = `draw-${nextSequence}`;
      const nextLayer = {
        ...sourceLayer,
        id: nextLayerId,
        name: `${sourceLayer.name} copy`,
        box: {
          ...sourceLayer.box,
          x: sourceLayer.box.x + 16,
          y: sourceLayer.box.y + 16,
        },
        raster: {
          ...sourceLayer.raster,
          data: Uint8ClampedArray.from(sourceLayer.raster.data),
        },
      };

      return {
        ...currentState,
        activeLayerId: nextLayerId,
        layers: insertDrawLayer(currentState.layers, nextLayer),
        retouch: {
          ...currentState.retouch,
          activeDrawLayerId: nextLayerId,
        },
      };
    });
  }

  function reorderLayers(
    sourceLayerId: LayerId,
    targetLayerId: LayerId,
    placement: 'before' | 'after',
  ) {
    if (sourceLayerId === targetLayerId) {
      return;
    }

    applyAppStateChange((currentState) => {
      const sourceIndex = currentState.layers.findIndex((layer) => layer.id === sourceLayerId);
      const targetIndex = currentState.layers.findIndex((layer) => layer.id === targetLayerId);

      if (sourceIndex === -1 || targetIndex === -1) {
        return currentState;
      }

      return {
        ...currentState,
        layers: reorderLayerStack(currentState.layers, sourceLayerId, targetLayerId, placement),
      };
    });
  }

  function removeLayer(layerId: LayerId) {
    applyAppStateChange((currentState) => {
      if (currentState.layers.length <= 1) {
        return currentState;
      }

      const nextLayers = currentState.layers.filter((layer) => layer.id !== layerId);
      const nextActiveLayerId =
        currentState.activeLayerId === layerId
          ? (nextLayers[nextLayers.length - 1]?.id ?? null)
          : currentState.activeLayerId;

      return {
        ...currentState,
        activeLayerId: nextActiveLayerId,
        layers: nextLayers,
        retouch: {
          ...currentState.retouch,
          activeDrawLayerId:
            currentState.retouch.activeDrawLayerId === layerId
              ? null
              : currentState.retouch.activeDrawLayerId,
          draftStroke:
            currentState.retouch.draftStroke?.targetLayerId === layerId
              ? null
              : currentState.retouch.draftStroke,
          selection:
            currentState.retouch.selection.targetId === layerId
              ? {
                  targetId: resolveSelectionTargetId({
                    ...currentState,
                    activeLayerId: nextActiveLayerId,
                    layers: nextLayers,
                  }),
                  draftRect: null,
                  rect: null,
                }
              : currentState.retouch.selection,
        },
      };
    });
  }

  async function handlePasteClick() {
    const requestToken = beginExplicitClipboardRequest();
    setStatusMessage('Reading the clipboard...');

    const image = await readImageFromClipboard();

    if (!isLatestExplicitClipboardRequest(requestToken)) {
      return;
    }

    if (!image) {
      setStatusMessage('No image was found in the clipboard. Try Ctrl+V or upload a file.');
      return;
    }

    applyLoadedImage(image, 'Image loaded from clipboard.');
  }

  function handleUploadClick(opener: HTMLButtonElement) {
    pendingFilePickerRequestRef.current = createImportRequestContext({ kind: 'base' }, opener);
    fileInputRef.current?.click();
  }

  function handleAdvancedImportFileClick(opener: HTMLButtonElement) {
    pendingFilePickerRequestRef.current = createImportRequestContext(
      { kind: 'advanced-import-file' },
      opener,
    );
    fileInputRef.current?.click();
  }

  async function handleAdvancedImportClipboardClick(opener: HTMLButtonElement) {
    const requestToken = beginExplicitClipboardRequest();
    const requestContext = createImportRequestContext(
      { kind: 'advanced-import-file' },
      opener,
    );
    setStatusMessage('Reading the clipboard for advanced import...');

    const result = await readImageFromClipboardResult();

    if (!isLatestExplicitClipboardRequest(requestToken)) {
      return;
    }

    if (!result.image) {
      setStatusMessage('Clipboard import could not read an image. Try Paste or choose a file.');
      return;
    }

    openPreInsertModal(
      result.image,
      'Clipboard image',
      'advanced-import-clipboard',
      requestContext,
    );
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const [file] = Array.from(event.target.files ?? []);

    if (!file) {
      return;
    }

    setAppState((currentState) => ({ ...currentState, status: 'loadingImage' }));
    setStatusMessage(`Loading ${file.name}...`);
    const requestContext = pendingFilePickerRequestRef.current;
    const sourceKind =
      requestContext.target.kind === 'advanced-import-file'
        ? 'advanced-import-file'
        : 'upload-image';

    try {
      const image = await loadImageElementFromFile(file);
      openPreInsertModal(image, file.name, sourceKind, requestContext);
    } catch {
      setStatusMessage(
        requestContext.target.kind === 'advanced-import-file'
          ? 'That advanced import image could not be loaded. Try another PNG, JPEG, or WebP image.'
          : 'That file could not be loaded. Try another PNG, JPEG, or WebP image.',
      );
    } finally {
      pendingFilePickerRequestRef.current = createImportRequestContext({ kind: 'base' }, null);
      event.target.value = '';
    }
  }

  async function handleCopyClick() {
    const canvas = canvasRef.current;

    if (!canvas) {
      setStatusMessage('The canvas is not ready yet.');
      return;
    }

    if (typeof navigator.clipboard?.write !== 'function' || typeof ClipboardItem === 'undefined') {
      setStatusMessage('Direct image copy is not supported in this browser. Use Download PNG.');
      return;
    }

    const blob = await canvasToBlob(canvas);

    if (!blob) {
      setStatusMessage('The image could not be copied. Try Download PNG instead.');
      return;
    }

    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setStatusMessage('Image copied to the clipboard.');
    } catch {
      setStatusMessage('Clipboard copy was blocked by the browser. Try Download PNG instead.');
    }
  }

  function handleDownloadClick() {
    const canvas = canvasRef.current;

    if (!canvas) {
      setStatusMessage('The canvas is not ready yet.');
      return;
    }

    const downloadLink = document.createElement('a');
    downloadLink.href = canvas.toDataURL('image/png');
    downloadLink.download = 'meme-elf.png';
    downloadLink.click();
    setStatusMessage('PNG download started.');
  }

  useEffect(() => {
    isPreInsertModalOpenRef.current = appState.preInsertModalDraft !== null;
  }, [appState.preInsertModalDraft]);

  useEffect(() => {
    async function handlePasteEvent(event: ClipboardEvent) {
      const clipboardRouting = resolveClipboardRouting(
        event.target,
        isPreInsertModalOpenRef.current,
      );

      if (clipboardRouting.modalOwnsClipboard) {
        event.preventDefault();
        return;
      }

      const image = await extractImageFromPasteEvent(event);

      if (!image) {
        return;
      }

      event.preventDefault();
      applyLoadedImage(image, 'Image pasted from the clipboard.');
    }

    document.addEventListener('paste', handlePasteEvent);
    return () => document.removeEventListener('paste', handlePasteEvent);
  }, [appState.canvasSize.height, appState.canvasSize.width, appState.layers]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem('meme-elf.inspector-width', String(inspectorWidth));
  }, [inspectorWidth]);

  useEffect(() => {
    setPreviewPan({ x: 0, y: 0 });
  }, [appState.canvasSize.height, appState.canvasSize.width, appState.image]);

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      if (!isDraggingSplitRef.current || !workspaceRef.current) {
        return;
      }

      const bounds = workspaceRef.current.getBoundingClientRect();
      const availableWidth = bounds.width;
      const inspectorPixels = bounds.right - event.clientX;
      const clampedInspectorPixels = Math.min(
        Math.max(MIN_PANEL_WIDTH, availableWidth - MIN_PANEL_WIDTH),
        Math.max(MIN_PANEL_WIDTH, inspectorPixels),
      );
      const nextWidth = (clampedInspectorPixels / bounds.width) * 100;
      setInspectorWidth(nextWidth);
    }

    function handlePointerUp() {
      isDraggingSplitRef.current = false;
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  useEffect(() => {
    function handleMouseMove(event: globalThis.MouseEvent) {
      const panSession = previewPanSessionRef.current;

      if (!panSession) {
        return;
      }

      setPreviewPan({
        x: panSession.startPanX + (event.clientX - panSession.startClientX),
        y: panSession.startPanY + (event.clientY - panSession.startClientY),
      });
    }

    function handleMouseUp() {
      previewPanSessionRef.current = null;
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [previewPan.x, previewPan.y]);

  useEffect(() => {
    function requestShortcutCopy() {
      const now = Date.now();

      if (now - lastShortcutCopyAtRef.current < 200) {
        return;
      }

      lastShortcutCopyAtRef.current = now;
      void handleCopyClick();
    }

    function handleCopyEvent(event: ClipboardEvent) {
      if (appStateRef.current.retouch.selection.rect) {
        event.preventDefault();
        handleSelectionShortcutCopy('copy');
        return;
      }

      const clipboardRouting = resolveClipboardRouting(
        event.target,
        isPreInsertModalOpenRef.current,
      );

      if (!clipboardRouting.backgroundCopyAllowed) {
        return;
      }

      event.preventDefault();
      requestShortcutCopy();
    }

    function handleKeyDown(event: KeyboardEvent) {
      const isCopyShortcut =
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'c';

      if (!isCopyShortcut || event.defaultPrevented) {
        return;
      }

      if (appStateRef.current.retouch.selection.rect) {
        event.preventDefault();
        handleSelectionShortcutCopy('copy');
        return;
      }

      const clipboardRouting = resolveClipboardRouting(
        event.target,
        isPreInsertModalOpenRef.current,
      );

      if (!clipboardRouting.backgroundCopyAllowed) {
        return;
      }

      // Some browsers route copy through a native `copy` event only after keydown.
      // Keep this as a fallback for engines that do not dispatch `copy` reliably.
      event.preventDefault();
      requestShortcutCopy();
    }

    function handleCutKeyDown(event: KeyboardEvent) {
      const isCutShortcut =
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'x';

      if (
        !isCutShortcut ||
        event.defaultPrevented ||
        isEditableTarget(event.target) ||
        isPreInsertModalOpenRef.current ||
        !appStateRef.current.retouch.selection.rect
      ) {
        return;
      }

      event.preventDefault();
      handleSelectionShortcutCopy('cut');
    }

    function handlePasteKeyDown(event: KeyboardEvent) {
      const isPasteShortcut =
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'v';

      if (
        !isPasteShortcut ||
        event.defaultPrevented ||
        isEditableTarget(event.target) ||
        isPreInsertModalOpenRef.current ||
        !selectionClipboardRef.current
      ) {
        return;
      }

      event.preventDefault();
      pasteSelectionClipboard();
    }

    document.addEventListener('copy', handleCopyEvent);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keydown', handleCutKeyDown);
    document.addEventListener('keydown', handlePasteKeyDown);
    return () => {
      document.removeEventListener('copy', handleCopyEvent);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keydown', handleCutKeyDown);
      document.removeEventListener('keydown', handlePasteKeyDown);
    };
  });

  useEffect(() => {
    function handleHistoryKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || isPreInsertModalOpenRef.current || isEditableTarget(event.target)) {
        return;
      }

      const isUndoShortcut =
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        event.code === 'KeyZ';

      if (!isUndoShortcut) {
        return;
      }

      event.preventDefault();

      if (event.shiftKey) {
        handleRedo();
        return;
      }

      handleUndo();
    }

    document.addEventListener('keydown', handleHistoryKeyDown);
    return () => document.removeEventListener('keydown', handleHistoryKeyDown);
  }, []);

  const workspaceStyle = {
    '--inspector-width': `${inspectorWidth}%`,
  } as CSSProperties;
  const preInsertDraft = appState.preInsertModalDraft;

  function updatePreviewZoom(resolveNextZoom: (currentZoom: number) => number) {
    setAppState((currentState) => ({
      ...currentState,
      previewZoomFactor: clampPreviewZoom(resolveNextZoom(currentState.previewZoomFactor)),
    }));
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <h1>meme-elf</h1>
        </div>
        <div className="topbar-actions" role="toolbar" aria-label="Editor actions">
          <ToolbarIconButton
            label="Paste from Clipboard"
            icon={<PasteIcon />}
            onClick={handlePasteClick}
          />
          <ToolbarIconButton
            label="Upload Image"
            icon={<UploadIcon />}
            buttonRef={uploadButtonRef}
            onClick={(event) => handleUploadClick(event.currentTarget)}
          />
          <ToolbarIconButton
            label="Copy Image"
            icon={<CopyIcon />}
            onClick={handleCopyClick}
          />
          <ToolbarIconButton
            label="Download PNG"
            icon={<DownloadIcon />}
            onClick={handleDownloadClick}
          />
          <ToolbarIconButton
            label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
            icon={theme === 'light' ? <MoonIcon /> : <SunIcon />}
            onClick={() => setTheme((currentTheme) => (currentTheme === 'light' ? 'dark' : 'light'))}
          />
        </div>
      </header>

      <section
        ref={workspaceRef}
        style={workspaceStyle}
        className="workspace-shell"
      >
        <section className="preview-panel" aria-label="Preview">
          <div
            className="splitter"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize inspector"
            onPointerDown={(event) => {
              event.preventDefault();
              isDraggingSplitRef.current = true;
            }}
          />
          <div className="preview-panel-header">
            <div className="preview-heading">
              <h2 className="preview-title">MEME</h2>
            </div>
            <div className="preview-toolbar" role="toolbar" aria-label="Canvas tools">
              <button
                type="button"
                className="mini-action-button preview-toolbar-button"
                onClick={handleUndo}
                disabled={!historyState.canUndo}
                aria-label="Undo"
                title="Undo"
              >
                ↶
              </button>
              <button
                type="button"
                className="mini-action-button preview-toolbar-button"
                onClick={handleRedo}
                disabled={!historyState.canRedo}
                aria-label="Redo"
                title="Redo"
              >
                ↷
              </button>
              <span className="preview-zoom-label">
                {Math.round(appState.previewZoomFactor * 100)}%
              </span>
              <button
                type="button"
                className="mini-action-button preview-toolbar-button"
                onClick={() =>
                  updatePreviewZoom((currentZoom) => currentZoom - PREVIEW_ZOOM_STEP)
                }
                aria-label="Zoom out"
                title="Zoom out"
              >
                −
              </button>
              <button
                type="button"
                className="mini-action-button preview-toolbar-button"
                onClick={() =>
                  updatePreviewZoom((currentZoom) => currentZoom + PREVIEW_ZOOM_STEP)
                }
                aria-label="Zoom in"
                title="Zoom in"
              >
                +
              </button>
              <button
                type="button"
                className="mini-action-button preview-toolbar-button"
                onClick={() => updatePreviewZoom(() => DEFAULT_PREVIEW_ZOOM_FACTOR)}
                aria-label="Reset zoom"
                title="Reset zoom"
              >
                1:1
              </button>
              <button
                type="button"
                className={`mini-action-button preview-toolbar-button${appState.retouch.mode === 'select' ? ' settings-button-active' : ''}`}
                aria-label="Select area"
                title="Select area"
                onClick={() =>
                  setAppState((currentState) => applyRetouchModeChange(currentState, 'select'))
                }
              >
                ☐
              </button>
              {(appState.retouch.selection.rect || appState.retouch.selection.draftRect) ? (
                <button
                  type="button"
                  className="mini-action-button preview-toolbar-button"
                  aria-label="Cancel selection"
                  title="Cancel selection"
                  onClick={handleCancelSelection}
                >
                  ✕
                </button>
              ) : null}
              {appState.retouch.selection.rect ? (
                <>
                  <button
                    type="button"
                    className="mini-action-button preview-toolbar-button"
                    aria-label="Copy selection to new layer"
                    title="Copy selection to new layer"
                    onClick={copySelectionToLayer}
                  >
                    ⧉
                  </button>
                  <button
                    type="button"
                    className="mini-action-button preview-toolbar-button"
                    aria-label="Cut selection to new layer"
                    title="Cut selection to new layer"
                    onClick={cutSelectionToLayer}
                  >
                    ✂
                  </button>
                </>
              ) : null}
            </div>
          </div>
          <div
            className="preview-stage"
            onPointerEnter={() => setIsPreviewStageHovered(true)}
            onPointerLeave={() => setIsPreviewStageHovered(false)}
            onMouseDown={(event) => {
              if (event.button !== 1) {
                return;
              }

              event.preventDefault();
              previewPanSessionRef.current = {
                startClientX: event.clientX,
                startClientY: event.clientY,
                startPanX: previewPan.x,
                startPanY: previewPan.y,
              };
            }}
            onAuxClick={(event) => {
              if (event.button === 1) {
                event.preventDefault();
              }
            }}
            onWheel={(event) => {
              event.preventDefault();
              updatePreviewZoom((currentZoom) =>
                currentZoom + (event.deltaY < 0 ? PREVIEW_ZOOM_STEP : -PREVIEW_ZOOM_STEP),
              );
            }}
          >
            <div className="preview-frame">
              <PreviewCanvas
                canvasRef={canvasRef}
                activeLayerId={appState.activeLayerId}
                draftStroke={appState.retouch.draftStroke}
                image={appState.image}
                retouchBrush={appState.retouch.brush}
                retouchMode={appState.retouch.mode}
                selectionDraft={appState.retouch.selection.draftRect}
                selectionRect={appState.retouch.selection.rect}
                selectionTargetRect={resolveSelectionTargetRect(appState)}
                width={appState.canvasSize.width}
                height={appState.canvasSize.height}
                layers={appState.layers}
                sceneImageAdjustments={appState.sceneImageAdjustments}
                sceneEffectStack={appState.sceneEffectStack}
                sceneWatermark={appState.sceneWatermark}
                previewPan={previewPan}
                previewZoomFactor={appState.previewZoomFactor}
                isSceneCropMode={appState.activeSceneBoundsMode === 'crop'}
                sceneCropDraft={appState.sceneBoundsDraft.cropRect}
                isStageHovered={isPreviewStageHovered}
                onDocumentInteractionStart={beginHistoryTransaction}
                onDocumentInteractionEnd={commitHistoryTransaction}
                onInlineTextEditStart={beginHistoryTransaction}
                onInlineTextEditEnd={commitHistoryTransaction}
                onDraftStrokeChange={handleDraftStrokeChange}
                onDraftStrokeCommit={handleDraftStrokeCommit}
                onRetouchBrushSample={handleRetouchBrushSample}
                onSelectionDraftChange={handleSelectionDraftChange}
                onSelectionDraftCommit={commitSelectionDraft}
                onActiveLayerChange={(layerId) =>
                  setAppState((currentState) => applyLayerActivation(currentState, layerId))
                }
                onLayerChange={updateLayer}
                onSceneCropDraftChange={(cropRect) =>
                  setAppState((currentState) => ({
                    ...currentState,
                    sceneBoundsDraft: {
                      ...currentState.sceneBoundsDraft,
                      cropRect,
                    },
                  }))
                }
              />
              <div className="preview-status-hud" aria-live="polite">
                <span>{selectionStatusTarget}</span>
                <span>{selectionStatusRect}</span>
              </div>
            </div>
          </div>
          <div className="status-strip" aria-label="Editor status">
            <span>{activeStatusLabel}</span>
            <span>Local-only alpha</span>
            <span>Theme: {theme}</span>
          </div>
        </section>

        <ControlPanel
          activeTab={activeInspectorTab}
          activeSceneBoundsMode={appState.activeSceneBoundsMode}
          activeLayerId={appState.activeLayerId}
          isImportModalOpen={preInsertDraft !== null}
          layers={appState.layers}
          retouchMode={appState.retouch.mode}
          retouchBrush={appState.retouch.brush}
          selectionTargetId={appState.retouch.selection.targetId}
          selectionRect={appState.retouch.selection.rect}
          selectionDraftRect={
            appState.retouch.selection.draftRect
              ? normalizeSelectionRect(appState.retouch.selection.draftRect, appState.canvasSize)
              : null
          }
          sceneCropDraft={appState.sceneBoundsDraft.cropRect}
          sceneBoundsFillColor={appState.sceneBoundsDraft.fillColor}
          sceneBoundsFillMode={appState.sceneBoundsDraft.fillMode}
          sceneImageAdjustments={appState.sceneImageAdjustments}
          sceneEffectStack={appState.sceneEffectStack}
          sceneWatermark={appState.sceneWatermark}
          sceneExpandDraft={appState.sceneBoundsDraft.expand}
          onOpenAdvancedImportClipboard={(opener) => {
            void handleAdvancedImportClipboardClick(opener);
          }}
          onOpenAdvancedImportFile={handleAdvancedImportFileClick}
          onBackgroundPointerDown={blurActiveEditable}
          onApplySceneCrop={applySceneCropCommit}
          onApplySceneExpand={applySceneExpandCommit}
          onActiveLayerChange={(layerId) =>
            setAppState((currentState) => applyLayerActivation(currentState, layerId))
          }
          onActiveTabChange={setActiveInspectorTab}
          onCancelSceneBounds={cancelSceneBounds}
          onClearActiveLayer={() =>
            setAppState((currentState) => ({ ...currentState, activeLayerId: null }))
          }
          onAddLayer={addLayer}
          onCreateDrawLayer={handleCreateDrawLayer}
          onApplySettingsToAllLayers={applyLayerSettingsToAllLayers}
          onSceneBoundsFillColorChange={(fillColor) =>
            setAppState((currentState) => ({
              ...currentState,
              sceneBoundsDraft: {
                ...currentState.sceneBoundsDraft,
                fillColor,
              },
            }))
          }
          onSceneBoundsFillModeChange={(fillMode) =>
            setAppState((currentState) => ({
              ...currentState,
              sceneBoundsDraft: {
                ...currentState.sceneBoundsDraft,
                fillMode,
              },
            }))
          }
          onSceneImageAdjustmentsChange={(updates) => updateSceneImageAdjustments(updates)}
          onResetSceneImageAdjustments={resetSceneImageAdjustments}
          onSceneEffectValueChange={updateSceneEffectValue}
          onReorderSceneEffects={reorderSceneEffectStack}
          onResetSceneEffectStack={resetSceneEffectStack}
          onSceneWatermarkChange={updateSceneWatermark}
          onResetSceneWatermark={resetSceneWatermark}
          onSceneBoundsPreset={applySceneBoundsPreset}
          onSceneImageStackTransform={applySceneImageTransform}
          onSceneExpandDraftChange={updateSceneExpandDraft}
          onStartSceneCrop={() =>
            setAppState((currentState) => ({
              ...currentState,
              activeSceneBoundsMode: 'crop',
              sceneBoundsDraft: {
                ...createResetSceneBoundsDraft(currentState.sceneBoundsDraft),
              },
            }))
          }
          onTextLayerChange={updateTextLayer}
          onTextEditSessionStart={beginHistoryTransaction}
          onTextEditSessionEnd={commitHistoryTransaction}
          onRotateImageLayer={(layerId, direction) =>
            transformImageLayer(layerId, (layer) => rotateImageLayer90(layer, direction))
          }
          onRetouchModeChange={(mode) =>
            setAppState((currentState) => applyRetouchModeChange(currentState, mode))
          }
          onRetouchBrushChange={updateRetouchBrush}
          onApplySelection={handleApplySelection}
          onCancelSelection={handleCancelSelection}
          onCopySelectionToLayer={copySelectionToLayer}
          onCutSelectionToLayer={cutSelectionToLayer}
          onDuplicateLayer={duplicateLayer}
          onFlipImageLayerHorizontal={(layerId) =>
            transformImageLayer(layerId, (layer) => flipImageLayerHorizontal(layer))
          }
          onFlipImageLayerVertical={(layerId) =>
            transformImageLayer(layerId, (layer) => flipImageLayerVertical(layer))
          }
          onReorderLayers={reorderLayers}
          onRemoveLayer={removeLayer}
        />
      </section>
      <input
        ref={fileInputRef}
        className="file-input file-input-hidden"
        aria-label="Upload image file"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileChange}
      />
      {preInsertDraft ? (
        <PreInsertModal
          confirmLabel={
            preInsertDraft.pendingSource.sourceKind === 'upload-image' ? 'Confirm' : 'Add layer'
          }
          draft={preInsertDraft}
          isCropMode={isPreInsertCropMode}
          onCancel={() =>
            closePreInsertModal(preInsertSessionRef.current.previousStatusMessage)
          }
          onConfirm={() => {
            const preparedImage = createPreparedImageFromDraft(preInsertDraft);
            const fileName = preInsertSessionRef.current.pendingUploadFileName ?? 'Image';
            const requestContext = preInsertSessionRef.current.requestContext;

            closePreInsertModal(null);

            if (preparedImage) {
              if (requestContext.target.kind === 'advanced-import-file') {
                addImageLayer(preparedImage, fileName, preInsertDraft.advancedPlacementMode);
                return;
              }

              applyLoadedImage(preparedImage, `${fileName} loaded.`);
            }
          }}
          onFlipHorizontal={() =>
            setAppState((currentState) => ({
              ...currentState,
              preInsertModalDraft: currentState.preInsertModalDraft
                ? toggleDraftFlipHorizontal(currentState.preInsertModalDraft)
                : null,
            }))
          }
          onFlipVertical={() =>
            setAppState((currentState) => ({
              ...currentState,
              preInsertModalDraft: currentState.preInsertModalDraft
                ? toggleDraftFlipVertical(currentState.preInsertModalDraft)
                : null,
            }))
          }
          onPlacementModeChange={(advancedPlacementMode) =>
            setAppState((currentState) => ({
              ...currentState,
              preferredAdvancedImportPlacementMode: advancedPlacementMode,
              preInsertModalDraft: currentState.preInsertModalDraft
                ? {
                    ...currentState.preInsertModalDraft,
                    advancedPlacementMode,
                  }
                : null,
            }))
          }
          onCropBoxChange={(cropBox) =>
            setAppState((currentState) => ({
              ...currentState,
              preInsertModalDraft: currentState.preInsertModalDraft
                ? {
                    ...currentState.preInsertModalDraft,
                    cropBox,
                  }
                : null,
            }))
          }
          onRotateClockwise={() =>
            setAppState((currentState) => ({
              ...currentState,
              preInsertModalDraft: currentState.preInsertModalDraft
                ? {
                    ...currentState.preInsertModalDraft,
                    rotationQuarterTurns: rotateDraftClockwise(
                      currentState.preInsertModalDraft.rotationQuarterTurns,
                    ),
                  }
                : null,
            }))
          }
          onRotateCounterClockwise={() =>
            setAppState((currentState) => ({
              ...currentState,
              preInsertModalDraft: currentState.preInsertModalDraft
                ? {
                    ...currentState.preInsertModalDraft,
                    rotationQuarterTurns: rotateDraftCounterClockwise(
                      currentState.preInsertModalDraft.rotationQuarterTurns,
                    ),
                  }
                : null,
            }))
          }
          onToggleCropMode={() => setIsPreInsertCropMode((currentState) => !currentState)}
          restoreFocusTo={preInsertSessionRef.current.requestContext.restoreFocusTo}
        />
      ) : null}
    </main>
  );
}

function getSceneImageTransformStatus(transform: SceneImageStackTransform) {
  switch (transform) {
    case 'rotate-clockwise':
      return 'Scene image stack rotated clockwise.';
    case 'rotate-counter-clockwise':
      return 'Scene image stack rotated counter-clockwise.';
    case 'flip-horizontal':
      return 'Scene image stack flipped horizontally.';
    case 'flip-vertical':
      return 'Scene image stack flipped vertically.';
  }
}

function ToolbarIconButton({
  buttonRef,
  icon,
  label,
  onClick,
}: {
  buttonRef?: RefObject<HTMLButtonElement | null>;
  icon: ReactNode;
  label: string;
  onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      className="toolbar-icon-button icon-button-with-tooltip"
      aria-label={label}
      data-tooltip={label}
      onClick={onClick}
    >
      {icon}
    </button>
  );
}

function IconBase({ children, viewBox = '0 0 20 20' }: { children: ReactNode; viewBox?: string }) {
  return (
    <svg aria-hidden="true" className="toolbar-icon-svg" viewBox={viewBox} fill="none">
      {children}
    </svg>
  );
}

function PasteIcon() {
  return (
    <IconBase>
      <path d="M7 4.5h6M8 3h4l.7 1.5H15a1 1 0 0 1 1 1V15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5.5a1 1 0 0 1 1-1h2.3L8 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 8h6M7 11h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </IconBase>
  );
}

function UploadIcon() {
  return (
    <IconBase>
      <path d="M10 13V4.5M6.5 8 10 4.5 13.5 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 14.5V16h11v-1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function CopyIcon() {
  return (
    <IconBase>
      <rect x="7" y="5" width="8" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 12.5H4.5A1.5 1.5 0 0 1 3 11V5.5A1.5 1.5 0 0 1 4.5 4H10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </IconBase>
  );
}

function DownloadIcon() {
  return (
    <IconBase>
      <path d="M10 4.5v8.5M6.5 10 10 13.5 13.5 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 15.5V16h11v-.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function MoonIcon() {
  return (
    <IconBase>
      <path d="M13.8 12.8A5.8 5.8 0 0 1 7.2 6.2a5.7 5.7 0 0 0 6.6 6.6Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function SunIcon() {
  return (
    <IconBase>
      <circle cx="10" cy="10" r="3.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10 2.5v2M10 15.5v2M17.5 10h-2M4.5 10h-2M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4M15.3 15.3l-1.4-1.4M6.1 6.1 4.7 4.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </IconBase>
  );
}

function createExpandedBaseImage(
  image: CanvasImageSource | null,
  currentCanvasSize: { width: number; height: number },
  nextCanvasSize: { width: number; height: number },
  offset: { x: number; y: number },
  fillOptions: {
    fillMode: ReturnType<typeof createDefaultAppState>['sceneBoundsDraft']['fillMode'];
    fillColor: string;
  } = {
    fillMode: 'transparent',
    fillColor: '#000000',
  },
) {
  const expandedCanvas = document.createElement('canvas');
  expandedCanvas.width = nextCanvasSize.width;
  expandedCanvas.height = nextCanvasSize.height;
  const expandedContext = expandedCanvas.getContext('2d');

  if (!expandedContext) {
    return image as HTMLImageElement | null;
  }

  expandedContext.clearRect(0, 0, nextCanvasSize.width, nextCanvasSize.height);
  paintExpandedCanvasFill(expandedContext, {
    image,
    currentCanvasSize,
    nextCanvasSize,
    offset,
    fillMode: fillOptions.fillMode,
    fillColor: fillOptions.fillColor,
  });

  if (image) {
    expandedContext.drawImage(
      image,
      offset.x,
      offset.y,
      currentCanvasSize.width,
      currentCanvasSize.height,
    );
  }

  return expandedCanvas as unknown as HTMLImageElement;
}

function getImageSourceSize(
  image: Pick<HTMLImageElement, 'naturalWidth' | 'naturalHeight'> &
    Partial<Pick<HTMLCanvasElement, 'width' | 'height'>>,
  fallbackSize: { width: number; height: number },
) {
  return {
    width: image.naturalWidth || image.width || fallbackSize.width,
    height: image.naturalHeight || image.height || fallbackSize.height,
  };
}

function createPreparedImageFromDraft(preInsertModalDraft: NonNullable<ReturnType<typeof createDefaultAppState>['preInsertModalDraft']>) {
  const sourceImage = preInsertModalDraft.pendingSource.image;

  if (!sourceImage) {
    return null;
  }

  const outputDimensions = resolvePreparedOutputDimensions({
    sourceSize: preInsertModalDraft.pendingSource.sourceSize,
    cropBox: preInsertModalDraft.cropBox,
    rotationQuarterTurns: preInsertModalDraft.rotationQuarterTurns,
  });
  const cropBox = preInsertModalDraft.cropBox
    ? normalizeCropDraftBox(
        preInsertModalDraft.cropBox,
        preInsertModalDraft.pendingSource.sourceSize,
      )
    : {
        x: 0,
        y: 0,
        width: preInsertModalDraft.pendingSource.sourceSize.width,
        height: preInsertModalDraft.pendingSource.sourceSize.height,
      };
  const preparedCanvas = document.createElement('canvas');
  preparedCanvas.width = outputDimensions.width;
  preparedCanvas.height = outputDimensions.height;
  const preparedContext = preparedCanvas.getContext('2d');

  if (!preparedContext) {
    return sourceImage as HTMLImageElement;
  }

  preparedContext.save();
  preparedContext.translate(outputDimensions.width / 2, outputDimensions.height / 2);
  preparedContext.scale(
    preInsertModalDraft.flipHorizontal ? -1 : 1,
    preInsertModalDraft.flipVertical ? -1 : 1,
  );
  preparedContext.rotate((preInsertModalDraft.rotationQuarterTurns * Math.PI) / 2);
  preparedContext.drawImage(
    sourceImage,
    cropBox.x,
    cropBox.y,
    cropBox.width,
    cropBox.height,
    Math.round(-cropBox.width / 2),
    Math.round(-cropBox.height / 2),
    cropBox.width,
    cropBox.height,
  );
  preparedContext.restore();

  return preparedCanvas as unknown as HTMLImageElement;
}

function createSceneCroppedImage(
  image: HTMLImageElement,
  currentCanvasSize: { width: number; height: number },
  cropRect: { x: number; y: number; width: number; height: number },
) {
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = currentCanvasSize.width;
  sourceCanvas.height = currentCanvasSize.height;
  const sourceContext = sourceCanvas.getContext('2d');
  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = cropRect.width;
  croppedCanvas.height = cropRect.height;
  const croppedContext = croppedCanvas.getContext('2d');

  if (!sourceContext || !croppedContext) {
    return image;
  }

  sourceContext.clearRect(0, 0, currentCanvasSize.width, currentCanvasSize.height);
  sourceContext.drawImage(image, 0, 0, currentCanvasSize.width, currentCanvasSize.height);
  croppedContext.clearRect(0, 0, cropRect.width, cropRect.height);
  croppedContext.drawImage(
    sourceCanvas,
    cropRect.x,
    cropRect.y,
    cropRect.width,
    cropRect.height,
    0,
    0,
    cropRect.width,
    cropRect.height,
  );

  return croppedCanvas as unknown as HTMLImageElement;
}

function createResetSceneBoundsDraft(
  draft: ReturnType<typeof createDefaultAppState>['sceneBoundsDraft'],
) {
  return {
    cropRect: null,
    expand: {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
    },
    fillMode: draft.fillMode,
    fillColor: draft.fillColor,
  };
}

function cloneLayers(layers: EditorLayer[]) {
  return layers.map((layer) => {
    if (isTextLayer(layer)) {
      return {
        ...layer,
        box: { ...layer.box },
      };
    }

    if (isDrawLayer(layer)) {
      const rasterData = new Uint8ClampedArray(new ArrayBuffer(layer.raster.data.length));
      rasterData.set(layer.raster.data);

      return {
        ...layer,
        box: { ...layer.box },
        sourceSize: { ...layer.sourceSize },
        raster: {
          width: layer.raster.width,
          height: layer.raster.height,
          data: rasterData,
        },
      };
    }

    return {
      ...layer,
      box: { ...layer.box },
      sourceSize: { ...layer.sourceSize },
      skew: { ...layer.skew },
    };
  });
}

function historySnapshotsEqual(a: EditorHistorySnapshot, b: EditorHistorySnapshot) {
  if (a.image !== b.image || a.activeLayerId !== b.activeLayerId) {
    return false;
  }

  if (
    a.canvasSize.width !== b.canvasSize.width ||
    a.canvasSize.height !== b.canvasSize.height ||
    a.sceneImageAdjustments.brightness !== b.sceneImageAdjustments.brightness ||
    a.sceneImageAdjustments.contrast !== b.sceneImageAdjustments.contrast ||
    a.sceneImageAdjustments.saturation !== b.sceneImageAdjustments.saturation ||
    a.sceneImageAdjustments.hue !== b.sceneImageAdjustments.hue ||
    a.sceneImageAdjustments.grayscale !== b.sceneImageAdjustments.grayscale ||
    a.sceneImageAdjustments.includeText !== b.sceneImageAdjustments.includeText ||
    a.sceneImageAdjustments.sepia !== b.sceneImageAdjustments.sepia ||
    a.sceneImageAdjustments.invert !== b.sceneImageAdjustments.invert ||
    a.sceneWatermark.enabled !== b.sceneWatermark.enabled ||
    a.sceneWatermark.text !== b.sceneWatermark.text ||
    a.sceneWatermark.mode !== b.sceneWatermark.mode ||
    a.sceneWatermark.corner !== b.sceneWatermark.corner ||
    a.sceneWatermark.opacity !== b.sceneWatermark.opacity ||
    a.sceneWatermark.size !== b.sceneWatermark.size ||
    a.sceneWatermark.color !== b.sceneWatermark.color ||
    a.sceneWatermark.rotation !== b.sceneWatermark.rotation ||
    a.sceneEffectStack.length !== b.sceneEffectStack.length ||
    a.layers.length !== b.layers.length
  ) {
    return false;
  }

  if (
    !a.sceneEffectStack.every((effect, index) => {
      const candidate = b.sceneEffectStack[index];
      return (
        Boolean(candidate) &&
        effect.id === candidate.id &&
        effect.kind === candidate.kind &&
        effect.value === candidate.value
      );
    })
  ) {
    return false;
  }

  return a.layers.every((layer, index) => {
    const candidate = b.layers[index];

    if (!candidate || layer.kind !== candidate.kind || layer.id !== candidate.id) {
      return false;
    }

    if (
      layer.name !== candidate.name ||
      layer.opacity !== candidate.opacity ||
      layer.box.x !== candidate.box.x ||
      layer.box.y !== candidate.box.y ||
      layer.box.width !== candidate.box.width ||
      layer.box.height !== candidate.box.height ||
      layer.box.rotation !== candidate.box.rotation
    ) {
      return false;
    }

    if (isTextLayer(layer) && isTextLayer(candidate)) {
      return (
        layer.text === candidate.text &&
        layer.fontFamily === candidate.fontFamily &&
        layer.fontSize === candidate.fontSize &&
        layer.fillStyle === candidate.fillStyle &&
        layer.strokeStyle === candidate.strokeStyle &&
        layer.outlineWidth === candidate.outlineWidth &&
        layer.textAlign === candidate.textAlign &&
        layer.verticalAlign === candidate.verticalAlign &&
        layer.effect === candidate.effect &&
        layer.allCaps === candidate.allCaps &&
        layer.bold === candidate.bold &&
        layer.italic === candidate.italic
      );
    }

    if (isImageLayer(layer) && isImageLayer(candidate)) {
      return (
        layer.image === candidate.image &&
        layer.sourceSize.width === candidate.sourceSize.width &&
        layer.sourceSize.height === candidate.sourceSize.height &&
        layer.skew.x === candidate.skew.x &&
        layer.skew.y === candidate.skew.y
      );
    }

    if (isDrawLayer(layer) && isDrawLayer(candidate)) {
      return (
        layer.sourceSize.width === candidate.sourceSize.width &&
        layer.sourceSize.height === candidate.sourceSize.height &&
        layer.raster.width === candidate.raster.width &&
        layer.raster.height === candidate.raster.height &&
        uint8ArraysEqual(layer.raster.data, candidate.raster.data)
      );
    }

    return false;
  });
}

function uint8ArraysEqual(a: Uint8ClampedArray, b: Uint8ClampedArray) {
  if (a.length !== b.length) {
    return false;
  }

  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return false;
    }
  }

  return true;
}

function insertDrawLayer(layers: EditorLayer[], nextLayer: Extract<EditorLayer, { kind: 'draw' }>) {
  const firstNonTextIndex = layers.findIndex((layer) => !isTextLayer(layer));

  if (firstNonTextIndex === -1) {
    return [...layers, nextLayer];
  }

  return [
    ...layers.slice(0, firstNonTextIndex),
    nextLayer,
    ...layers.slice(firstNonTextIndex),
  ];
}

function insertImageLayerAboveTarget(
  layers: EditorLayer[],
  targetId: RasterSelectionTargetId,
  nextLayer: Extract<EditorLayer, { kind: 'image' }>,
) {
  if (targetId === 'base-image') {
    const firstNonTextIndex = layers.findIndex((layer) => !isTextLayer(layer));

    if (firstNonTextIndex === -1) {
      return [...layers, nextLayer];
    }

    return [
      ...layers.slice(0, firstNonTextIndex),
      nextLayer,
      ...layers.slice(firstNonTextIndex),
    ];
  }

  const targetIndex = layers.findIndex((layer) => layer.id === targetId);

  if (targetIndex === -1) {
    return [...layers, nextLayer];
  }

  return [...layers.slice(0, targetIndex), nextLayer, ...layers.slice(targetIndex)];
}

function resolveDrawLayerTargetId(
  state: ReturnType<typeof createDefaultAppState>,
) {
  if (
    state.retouch.activeDrawLayerId &&
    state.layers.some((layer) => layer.id === state.retouch.activeDrawLayerId && isDrawLayer(layer))
  ) {
    return state.retouch.activeDrawLayerId;
  }

  if (
    state.activeLayerId &&
    state.layers.some((layer) => layer.id === state.activeLayerId && isDrawLayer(layer))
  ) {
    return state.activeLayerId;
  }

  return null;
}

function resolveSelectionTargetId(state: ReturnType<typeof createDefaultAppState>): RasterSelectionTargetId | null {
  if (state.activeLayerId) {
    const activeLayer = state.layers.find((layer) => layer.id === state.activeLayerId);

    if (activeLayer && (isImageLayer(activeLayer) || isDrawLayer(activeLayer))) {
      return activeLayer.id;
    }
  }

  return state.image ? 'base-image' : null;
}

function resolveSelectionTargetBox(
  state: ReturnType<typeof createDefaultAppState>,
  targetId: RasterSelectionTargetId,
) {
  if (targetId === 'base-image') {
    return {
      x: 0,
      y: 0,
      width: state.canvasSize.width,
      height: state.canvasSize.height,
    };
  }

  const layer = state.layers.find((candidateLayer) => candidateLayer.id === targetId);

  if (!layer || (!isImageLayer(layer) && !isDrawLayer(layer))) {
    return null;
  }

  return {
    x: layer.box.x,
    y: layer.box.y,
    width: layer.box.width,
    height: layer.box.height,
  };
}

function resolveSelectionTargetRect(state: ReturnType<typeof createDefaultAppState>): SelectionRect | null {
  const targetId = state.retouch.selection.targetId;
  const box = targetId ? resolveSelectionTargetBox(state, targetId) : null;

  return box
    ? {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
      }
    : null;
}

function extractSelectionForTarget(
  state: ReturnType<typeof createDefaultAppState>,
  targetId: RasterSelectionTargetId,
  selectionRect: SelectionRect,
  mode: 'copy' | 'cut',
) {
  if (targetId === 'base-image') {
    if (!state.image) {
      return null;
    }

    const sceneRect = clampSelectionRectToBox(selectionRect, {
      x: 0,
      y: 0,
      width: state.canvasSize.width,
      height: state.canvasSize.height,
    });

    if (!sceneRect) {
      return null;
    }

    const sourceRect = mapSelectionRectToSourceRect(
      sceneRect,
      { x: 0, y: 0, width: state.canvasSize.width, height: state.canvasSize.height },
      state.canvasSize,
    );
    const image = extractCanvasImageRegion(state.image, state.canvasSize, sourceRect);

    if (!image) {
      return null;
    }

    return {
      image,
      sceneRect,
      sourceRect,
      nextState:
        mode === 'cut'
          ? {
              ...state,
              image: clearCanvasImageRegion(state.image, state.canvasSize, sourceRect) ?? state.image,
            }
          : state,
    };
  }

  const targetLayer = state.layers.find((layer) => layer.id === targetId);

  if (!targetLayer || (!isImageLayer(targetLayer) && !isDrawLayer(targetLayer))) {
    return null;
  }

  const sceneRect = clampSelectionRectToBox(selectionRect, targetLayer.box);

  if (!sceneRect) {
    return null;
  }

  const sourceRect = mapSelectionRectToSourceRect(
    sceneRect,
    targetLayer.box,
    targetLayer.sourceSize,
    isImageLayer(targetLayer) ? targetLayer.skew : { x: 1, y: 1 },
  );

  if (isDrawLayer(targetLayer)) {
    const extractedRaster = extractRasterSelection(targetLayer.raster, sourceRect);
    const image = createCanvasImageFromRasterSurface(extractedRaster);

    return {
      image,
      sceneRect,
      sourceRect,
      nextState:
        mode === 'cut'
          ? {
              ...state,
              layers: state.layers.map((layer) =>
                layer.id === targetLayer.id && isDrawLayer(layer)
                  ? {
                      ...layer,
                      raster: clearRasterSelection(layer.raster, sourceRect),
                    }
                  : layer,
              ),
            }
          : state,
    };
  }

  const image = extractCanvasImageRegion(targetLayer.image, targetLayer.sourceSize, sourceRect);

  if (!image) {
    return null;
  }

  return {
    image,
    sceneRect,
    sourceRect,
    nextState:
      mode === 'cut'
        ? {
            ...state,
            layers: state.layers.map((layer) =>
              layer.id === targetLayer.id && isImageLayer(layer)
                ? {
                    ...layer,
                    image:
                      clearCanvasImageRegion(layer.image, layer.sourceSize, sourceRect) ?? layer.image,
                  }
                : layer,
            ),
          }
        : state,
  };
}

function createExtractedImageLayer(
  id: LayerId,
  sequence: number,
  image: CanvasImageSource,
  sceneRect: SelectionRect,
  sourceRect: { width: number; height: number },
): Extract<EditorLayer, { kind: 'image' }> {
  return {
    id,
    kind: 'image',
    name: `Image ${sequence}`,
    box: {
      x: sceneRect.x,
      y: sceneRect.y,
      width: sceneRect.width,
      height: sceneRect.height,
      rotation: 0,
    },
    opacity: 1,
    image,
    sourceSize: {
      width: sourceRect.width,
      height: sourceRect.height,
    },
    skew: { x: 1, y: 1 },
  };
}

function createCanvasImageFromRasterSurface(raster: ReturnType<typeof extractRasterSelection>) {
  const canvas = document.createElement('canvas');
  canvas.width = raster.width;
  canvas.height = raster.height;
  const context = canvas.getContext('2d');

  if (!context) {
    return canvas;
  }

  context.putImageData(
    typeof ImageData === 'function'
      ? new ImageData(Uint8ClampedArray.from(raster.data), raster.width, raster.height)
      : ({
          data: Uint8ClampedArray.from(raster.data),
          width: raster.width,
          height: raster.height,
          colorSpace: 'srgb',
        } as ImageData),
    0,
    0,
  );
  return canvas;
}

function extractCanvasImageRegion(
  image: CanvasImageSource | null,
  sourceSize: { width: number; height: number },
  sourceRect: { x: number; y: number; width: number; height: number },
) {
  if (!image) {
    return null;
  }

  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = sourceSize.width;
  sourceCanvas.height = sourceSize.height;
  const sourceContext = sourceCanvas.getContext('2d');

  if (!sourceContext) {
    return null;
  }

  sourceContext.clearRect(0, 0, sourceSize.width, sourceSize.height);
  sourceContext.drawImage(image, 0, 0, sourceSize.width, sourceSize.height);

  const nextCanvas = document.createElement('canvas');
  nextCanvas.width = sourceRect.width;
  nextCanvas.height = sourceRect.height;
  const nextContext = nextCanvas.getContext('2d');

  if (!nextContext) {
    return null;
  }

  nextContext.drawImage(
    sourceCanvas,
    sourceRect.x,
    sourceRect.y,
    sourceRect.width,
    sourceRect.height,
    0,
    0,
    sourceRect.width,
    sourceRect.height,
  );
  return nextCanvas;
}

function clearCanvasImageRegion(
  image: CanvasImageSource | null,
  sourceSize: { width: number; height: number },
  sourceRect: { x: number; y: number; width: number; height: number },
) {
  if (!image) {
    return null;
  }

  const nextCanvas = document.createElement('canvas');
  nextCanvas.width = sourceSize.width;
  nextCanvas.height = sourceSize.height;
  const context = nextCanvas.getContext('2d');

  if (!context) {
    return null;
  }

  context.clearRect(0, 0, sourceSize.width, sourceSize.height);
  context.drawImage(image, 0, 0, sourceSize.width, sourceSize.height);
  context.clearRect(sourceRect.x, sourceRect.y, sourceRect.width, sourceRect.height);
  return nextCanvas as unknown as HTMLImageElement;
}

function applyLayerActivation(
  state: ReturnType<typeof createDefaultAppState>,
  layerId: LayerId,
) {
  const nextState = {
    ...state,
    activeLayerId: layerId,
  };

  if (state.retouch.mode !== 'select') {
    return nextState;
  }

  return {
    ...nextState,
    retouch: {
      ...nextState.retouch,
      selection: {
        targetId: resolveSelectionTargetId(nextState),
        draftRect: null,
        rect: null,
      },
    },
  };
}

function applyRetouchModeChange(
  state: ReturnType<typeof createDefaultAppState>,
  mode: ReturnType<typeof createDefaultAppState>['retouch']['mode'],
) {
  const nextMode = state.retouch.mode === mode && mode !== 'select' ? 'idle' : mode;
  const enteringSelect = nextMode === 'select';
  const nextSelectionTargetId = enteringSelect
    ? resolveSelectionTargetId({
        ...state,
        retouch: {
          ...state.retouch,
          mode: nextMode,
        },
      })
    : state.retouch.selection.targetId;

  return {
    ...state,
    retouch: {
      ...state.retouch,
      draftStroke:
        nextMode === 'draw' || nextMode === 'erase'
          ? state.retouch.draftStroke
          : null,
      mode: nextMode,
      selection: {
        targetId: nextSelectionTargetId,
        draftRect: enteringSelect ? null : state.retouch.selection.draftRect,
        rect: enteringSelect ? state.retouch.selection.rect : state.retouch.selection.rect,
      },
    },
  };
}

function resolveSceneExpandPreset(
  preset: 'equal-margin' | 'top-caption' | 'bottom-caption' | 'square-canvas',
  canvasSize: { width: number; height: number },
) {
  if (preset === 'equal-margin') {
    return {
      left: EQUAL_MARGIN_PRESET,
      right: EQUAL_MARGIN_PRESET,
      top: EQUAL_MARGIN_PRESET,
      bottom: EQUAL_MARGIN_PRESET,
    };
  }

  if (preset === 'top-caption') {
    return {
      left: 0,
      right: 0,
      top: CAPTION_SPACE_PRESET,
      bottom: 0,
    };
  }

  if (preset === 'bottom-caption') {
    return {
      left: 0,
      right: 0,
      top: 0,
      bottom: CAPTION_SPACE_PRESET,
    };
  }

  if (canvasSize.width === canvasSize.height) {
    return {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
    };
  }

  if (canvasSize.width > canvasSize.height) {
    const difference = canvasSize.width - canvasSize.height;
    const top = Math.floor(difference / 2);
    const bottom = difference - top;

    return {
      left: 0,
      right: 0,
      top,
      bottom,
    };
  }

  const difference = canvasSize.height - canvasSize.width;
  const left = Math.floor(difference / 2);
  const right = difference - left;

  return {
    left,
    right,
    top: 0,
    bottom: 0,
  };
}

function paintExpandedCanvasFill(
  context: CanvasRenderingContext2D,
  input: {
    image: CanvasImageSource | null;
    currentCanvasSize: { width: number; height: number };
    nextCanvasSize: { width: number; height: number };
    offset: { x: number; y: number };
    fillMode: ReturnType<typeof createDefaultAppState>['sceneBoundsDraft']['fillMode'];
    fillColor: string;
  },
) {
  if (input.fillMode === 'transparent') {
    return;
  }

  if (input.fillMode === 'solid-color') {
    context.fillStyle = input.fillColor;
    context.fillRect(0, 0, input.nextCanvasSize.width, input.nextCanvasSize.height);
    return;
  }

  const sourceContext = createSourceCanvasContext(
    input.image,
    input.currentCanvasSize,
  );

  if (!sourceContext) {
    return;
  }

  if (input.fillMode === 'average-border') {
    const averageColor = resolveBoundsFill({
      fillMode: input.fillMode,
      solidColor: input.fillColor,
      borderPixels: [
        ...getBorderPixels(sourceContext, input.currentCanvasSize, 'left'),
        ...getBorderPixels(sourceContext, input.currentCanvasSize, 'right'),
        ...getBorderPixels(sourceContext, input.currentCanvasSize, 'top'),
        ...getBorderPixels(sourceContext, input.currentCanvasSize, 'bottom'),
      ],
      side: 'left',
    });

    if (!averageColor) {
      return;
    }

    context.fillStyle = averageColor;
    context.fillRect(0, 0, input.nextCanvasSize.width, input.nextCanvasSize.height);
    return;
  }

  const leftFill = resolveBoundsFill({
    fillMode: input.fillMode,
    solidColor: input.fillColor,
    borderPixels: getBorderPixels(sourceContext, input.currentCanvasSize, 'left'),
    side: 'left',
  });
  const rightFill = resolveBoundsFill({
    fillMode: input.fillMode,
    solidColor: input.fillColor,
    borderPixels: getBorderPixels(sourceContext, input.currentCanvasSize, 'right'),
    side: 'right',
  });
  const topFill = resolveBoundsFill({
    fillMode: input.fillMode,
    solidColor: input.fillColor,
    borderPixels: getBorderPixels(sourceContext, input.currentCanvasSize, 'top'),
    side: 'top',
  });
  const bottomFill = resolveBoundsFill({
    fillMode: input.fillMode,
    solidColor: input.fillColor,
    borderPixels: getBorderPixels(sourceContext, input.currentCanvasSize, 'bottom'),
    side: 'bottom',
  });
  const rightStart = input.offset.x + input.currentCanvasSize.width;
  const bottomStart = input.offset.y + input.currentCanvasSize.height;

  if (leftFill && input.offset.x > 0) {
    context.fillStyle = leftFill;
    context.fillRect(0, 0, input.offset.x, input.nextCanvasSize.height);
  }

  if (rightFill && rightStart < input.nextCanvasSize.width) {
    context.fillStyle = rightFill;
    context.fillRect(
      rightStart,
      0,
      input.nextCanvasSize.width - rightStart,
      input.nextCanvasSize.height,
    );
  }

  if (topFill && input.offset.y > 0) {
    context.fillStyle = topFill;
    context.fillRect(input.offset.x, 0, input.currentCanvasSize.width, input.offset.y);
  }

  if (bottomFill && bottomStart < input.nextCanvasSize.height) {
    context.fillStyle = bottomFill;
    context.fillRect(
      input.offset.x,
      bottomStart,
      input.currentCanvasSize.width,
      input.nextCanvasSize.height - bottomStart,
    );
  }
}

function createSourceCanvasContext(
  image: CanvasImageSource | null,
  canvasSize: { width: number; height: number },
) {
  if (!image) {
    return null;
  }

  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = canvasSize.width;
  sourceCanvas.height = canvasSize.height;
  const sourceContext = sourceCanvas.getContext('2d');

  if (!sourceContext) {
    return null;
  }

  sourceContext.clearRect(0, 0, canvasSize.width, canvasSize.height);
  sourceContext.drawImage(image, 0, 0, canvasSize.width, canvasSize.height);
  return sourceContext;
}

function getBorderPixels(
  context: CanvasRenderingContext2D,
  canvasSize: { width: number; height: number },
  side: 'left' | 'right' | 'top' | 'bottom',
) {
  if (side === 'left') {
    return Array.from(context.getImageData(0, 0, 1, canvasSize.height).data);
  }

  if (side === 'right') {
    return Array.from(
      context.getImageData(Math.max(0, canvasSize.width - 1), 0, 1, canvasSize.height).data,
    );
  }

  if (side === 'top') {
    return Array.from(context.getImageData(0, 0, canvasSize.width, 1).data);
  }

  return Array.from(
    context.getImageData(0, Math.max(0, canvasSize.height - 1), canvasSize.width, 1).data,
  );
}
