import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
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
  createDefaultImageLayer,
  flipImageLayerHorizontal,
  flipImageLayerVertical,
  getDirectionalInsertionLayout,
  reorderLayerStack,
  rotateImageLayer90,
} from '../features/image/image-layer-utils';
import {
  normalizeCropDraftBox,
  resolvePreparedOutputDimensions,
} from '../features/image/image-crop-utils';
import { applySceneCrop, applySceneExpand } from '../features/bounds/scene-bounds';
import { normalizeSceneCropRect } from '../features/bounds/crop-overlay';
import { resolveBoundsFill } from '../features/bounds/fill-modes';
import {
  rotateDraftClockwise,
  rotateDraftCounterClockwise,
  toggleDraftFlipHorizontal,
  toggleDraftFlipVertical,
} from '../features/image/pre-insert-state';
import { PreInsertModal } from '../features/image/pre-insert-modal';
import { isImageLayer, isTextLayer } from './types';
import type { EditorLayer, LayerId, TextLayer } from './types';

const MAX_PREVIEW_WIDTH = 960;
const DEFAULT_INSPECTOR_WIDTH = 24;
const MIN_PANEL_WIDTH = 300;
const PREVIEW_ZOOM_STEP = 0.1;
const MIN_PREVIEW_ZOOM_FACTOR = 0.1;
const MAX_PREVIEW_ZOOM_FACTOR = 3;
const EQUAL_MARGIN_PRESET = 48;
const CAPTION_SPACE_PRESET = 120;
type ToolMode = 'pointer' | 'image';
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

function getStoredToolRailCollapsed(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }

  return window.localStorage.getItem('meme-elf.tool-rail-collapsed') !== 'false';
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
  const [isToolRailCollapsed, setIsToolRailCollapsed] = useState(getStoredToolRailCollapsed);
  const [inspectorWidth, setInspectorWidth] = useState(getStoredInspectorWidth);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadButtonRef = useRef<HTMLButtonElement | null>(null);
  const workspaceRef = useRef<HTMLElement | null>(null);
  const isDraggingSplitRef = useRef(false);
  const nextLayerSequenceRef = useRef(appState.layers.length + 1);
  const nextImageLayerSequenceRef = useRef(1);
  const lastShortcutCopyAtRef = useRef(0);
  const latestExplicitClipboardRequestTokenRef = useRef(0);
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
  const [activeTool, setActiveTool] = useState<ToolMode>('pointer');
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
      status: 'idle',
      errorMessage: null,
      preInsertModalDraft: null,
      activeSceneBoundsMode: 'idle',
      sceneBoundsDraft: createResetSceneBoundsDraft(currentState.sceneBoundsDraft),
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

        return {
          ...layer,
          ...updates,
          kind: 'image',
        };
      }),
    }), historyMode);
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
    window.localStorage.setItem('meme-elf.tool-rail-collapsed', String(isToolRailCollapsed));
  }, [isToolRailCollapsed]);

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
      const railWidth = isToolRailCollapsed ? 0 : 66;
      const availableWidth = bounds.width - railWidth;
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
  }, [isToolRailCollapsed]);

  useEffect(() => {
    function handleMouseMove(event: MouseEvent) {
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

    document.addEventListener('copy', handleCopyEvent);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('copy', handleCopyEvent);
      document.removeEventListener('keydown', handleKeyDown);
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
          <button
            type="button"
            className="toolbar-button"
            onClick={handlePasteClick}
          >
            Paste from Clipboard
          </button>
          <button
            ref={uploadButtonRef}
            type="button"
            className="toolbar-button"
            onClick={(event) => handleUploadClick(event.currentTarget)}
          >
            Upload Image
          </button>
          <button
            type="button"
            className="toolbar-button"
            onClick={handleCopyClick}
          >
            Copy Image
          </button>
          <button
            type="button"
            className="toolbar-button"
            onClick={handleDownloadClick}
          >
            Download PNG
          </button>
          <button
            type="button"
            className="toolbar-icon-button"
            onClick={() => setTheme((currentTheme) => (currentTheme === 'light' ? 'dark' : 'light'))}
            aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
            title={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
          >
            {theme === 'light' ? '☾' : '☀'}
          </button>
          <button
            type="button"
            className="toolbar-icon-button"
            onClick={() => setIsToolRailCollapsed((currentState) => !currentState)}
            aria-label={isToolRailCollapsed ? 'Show tool rail' : 'Hide tool rail'}
            title={isToolRailCollapsed ? 'Show tool rail' : 'Hide tool rail'}
          >
            [|]
          </button>
        </div>
      </header>

      <section
        ref={workspaceRef}
        style={workspaceStyle}
        className={`workspace-shell${isToolRailCollapsed ? ' workspace-shell-rail-collapsed' : ''}`}
      >
        <aside
          className={`tool-rail${isToolRailCollapsed ? ' tool-rail-collapsed' : ''}`}
          aria-label="Tools"
        >
          <button
            type="button"
            className={`tool-rail-button${activeTool === 'pointer' ? ' tool-rail-button-active' : ''}`}
            aria-label="Pointer tool"
            aria-pressed={activeTool === 'pointer'}
            onClick={() => setActiveTool('pointer')}
          >
            ↖
          </button>
          <button
            type="button"
            className={`tool-rail-button${activeTool === 'image' ? ' tool-rail-button-active' : ''}`}
            aria-label="Image tool"
            aria-pressed={activeTool === 'image'}
            onClick={() => setActiveTool('image')}
          >
            ▣
          </button>
        </aside>

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
              <p className="preview-hint">Paste. Caption. Export.</p>
            </div>
            <div className="preview-toolbar" role="toolbar" aria-label="Canvas zoom">
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
                image={appState.image}
                width={appState.canvasSize.width}
                height={appState.canvasSize.height}
                layers={appState.layers}
                sceneImageEffects={appState.sceneImageEffects}
                previewPan={previewPan}
                previewZoomFactor={appState.previewZoomFactor}
                isSceneCropMode={appState.activeSceneBoundsMode === 'crop'}
                sceneCropDraft={appState.sceneBoundsDraft.cropRect}
                isStageHovered={isPreviewStageHovered}
                onDocumentInteractionStart={beginHistoryTransaction}
                onDocumentInteractionEnd={commitHistoryTransaction}
                onInlineTextEditStart={beginHistoryTransaction}
                onInlineTextEditEnd={commitHistoryTransaction}
                onActiveLayerChange={(layerId) =>
                  setAppState((currentState) => ({ ...currentState, activeLayerId: layerId }))
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
            </div>
          </div>
          <div className="status-strip" aria-label="Editor status">
            <span>{activeStatusLabel}</span>
            <span>Local-only alpha</span>
            <span>Theme: {theme}</span>
          </div>
        </section>

        <ControlPanel
          activeTool={activeTool}
          activeSceneBoundsMode={appState.activeSceneBoundsMode}
          activeLayerId={appState.activeLayerId}
          isImportModalOpen={preInsertDraft !== null}
          layers={appState.layers}
          sceneCropDraft={appState.sceneBoundsDraft.cropRect}
          sceneBoundsFillColor={appState.sceneBoundsDraft.fillColor}
          sceneBoundsFillMode={appState.sceneBoundsDraft.fillMode}
          sceneExpandDraft={appState.sceneBoundsDraft.expand}
          onOpenAdvancedImportClipboard={(opener) => {
            void handleAdvancedImportClipboardClick(opener);
          }}
          onOpenAdvancedImportFile={handleAdvancedImportFileClick}
          onBackgroundPointerDown={blurActiveEditable}
          onApplySceneCrop={applySceneCropCommit}
          onApplySceneExpand={applySceneExpandCommit}
          onActiveLayerChange={(layerId) =>
            setAppState((currentState) => ({ ...currentState, activeLayerId: layerId }))
          }
          onCancelSceneBounds={cancelSceneBounds}
          onClearActiveLayer={() =>
            setAppState((currentState) => ({ ...currentState, activeLayerId: null }))
          }
          onAddLayer={addLayer}
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
          onSceneBoundsPreset={applySceneBoundsPreset}
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
    a.layers.length !== b.layers.length
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

    return false;
  });
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
