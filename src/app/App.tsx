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
import {
  resolveLoadedImageGuardrails,
  resolveMobilePreviewGuardrails,
} from '../features/canvas/mobile-preview-guardrails';
import { renderPreview } from '../features/canvas/canvas-renderer';
import {
  extractImageFromPasteEvent,
  extractImageUrlFromPasteEvent,
  readImageFromClipboardResult,
  resolveClipboardReadFailureMessage,
} from '../features/clipboard/clipboard-service';
import { PreviewCanvas } from '../features/preview/preview-canvas';
import { ControlPanel } from '../features/controls/control-panel';
import {
  resolveMobileShellLayout,
  resolveTopbarActionLayout,
  SMALL_TABLET_MAX_WIDTH,
  type ToolbarActionId,
} from '../features/controls/mobile-layout';
import {
  canCopyImageToClipboard,
  resolveMobileExportMessage,
} from '../features/mobile/mobile-export-fallbacks';
import { CopyFallbackModal } from '../features/mobile/copy-fallback-modal';
import {
  handleTooltipTouchClick,
  handleTooltipTouchFocus,
  handleTooltipTouchPointerDown,
  handleTooltipTouchStart,
} from '../features/controls/tooltip-touch-focus';
import {
  loadImageElementFromFile,
  loadImageElementFromUrl,
  revokeLoadedImageObjectUrl,
} from '../features/image/image-loader';
import {
  createDefaultSceneEffectStack,
  createDefaultSceneImageAdjustments,
  hasActiveSceneEffectStack,
  hasActiveSceneImageAdjustments,
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
import { applyCloneStampStroke } from '../features/selection/clone-stamp-prototype';
import { applyMelfTemplateToState } from '../features/templates/apply-template';
import {
  MELF_EXTENSION,
  MELF_MIME_TYPE,
  type MelfSceneDocument,
  parseMelfSceneDocument,
  stringifyMelfSceneDocument,
} from '../features/templates/melf-scene';
import {
  type MelfTemplateDocument,
  parseMelfTemplateDocument,
} from '../features/templates/melf-template';
import {
  materializeAppStateFromMelfSceneDocument,
  serializeAppStateToMelfSceneDocument,
} from '../features/templates/melf-scene-state';
import {
  readRecentSceneEntries,
  removeRecentSceneEntry,
  upsertRecentSceneEntry,
  type RecentSceneEntry,
} from '../features/templates/recent-scenes-storage';
import {
  readPersistedTemplateLibrary,
  writePersistedTemplateLibrary,
} from '../features/templates/dev-template-library-storage';
import {
  createBuiltInTemplateCatalog,
  cloneTemplateDocuments,
  getTemplateById,
} from '../features/templates/template-catalog';
import { loadShippedTemplateDocuments } from '../features/templates/shipped-template-catalog';
import { parseImportedTemplateDocument } from '../features/templates/import-template-source';
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
  SceneExpandDraft,
  SceneImageAdjustments,
  SelectionDraftRect,
  SelectionRect,
  SceneWatermark,
  TextLayer,
} from './types';

const DEFAULT_INSPECTOR_WIDTH = 24;
const MIN_PANEL_WIDTH = 300;
const PREVIEW_ZOOM_STEP = 0.1;
const MIN_PREVIEW_ZOOM_FACTOR = 0.1;
const MAX_PREVIEW_ZOOM_FACTOR = 3;
const EQUAL_MARGIN_PRESET = 48;
const CAPTION_SPACE_PRESET = 120;
const MOBILE_RECOVERY_STORAGE_KEY = 'meme-elf.mobile-recovery';
const DEV_TEMPLATE_LIBRARY_STORAGE_KEY = 'meme-elf.dev-template-library';
type SceneFileHandle = {
  name?: string;
  createWritable: () => Promise<{
    write: (data: string) => Promise<void>;
    close: () => Promise<void>;
  }>;
  getFile: () => Promise<File>;
};
type FilePickerWindow = Window & {
  showOpenFilePicker?: (options?: unknown) => Promise<SceneFileHandle[]>;
  showSaveFilePicker?: (options?: unknown) => Promise<SceneFileHandle>;
};
type InspectorTab =
  | 'layers'
  | 'saves'
  | 'templates'
  | 'crop'
  | 'adjustments'
  | 'draw'
  | 'effects'
  | 'watermark'
  | 'experimental';
type ImageInsertionMode =
  | 'inside-canvas'
  | 'outside-left'
  | 'outside-right'
  | 'outside-top'
  | 'outside-bottom';
type ImportTarget =
  | { kind: 'base' }
  | { kind: 'advanced-import-file' }
  | { kind: 'advanced-import-url' };
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

type MobileRecoverySnapshot = {
  canvasSize: {
    width: number;
    height: number;
  };
  height: number;
  imageDataUrl?: string;
  textLayers: TextLayer[];
  version: 1;
  width: number;
};

const MAX_HISTORY_STEPS = 10;
const MOBILE_RECOVERY_SCALE_STEPS = [1, 0.75, 0.5, 0.375, 0.25] as const;

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

async function readTextFromBlob(blob: Blob) {
  if (typeof blob.text === 'function') {
    return blob.text();
  }

  return new Response(blob).text();
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

function resolveViewportHeight() {
  if (typeof window === 'undefined') {
    return 0;
  }

  return Math.round(window.visualViewport?.height ?? window.innerHeight);
}

function resolveFitToWindowZoomFactor(
  canvasSize: { width: number; height: number },
  previewFrame: HTMLDivElement | null,
) {
  if (!previewFrame) {
    return DEFAULT_PREVIEW_ZOOM_FACTOR;
  }

  const bounds = previewFrame.getBoundingClientRect();
  const widthScale = bounds.width / canvasSize.width;
  const heightScale = bounds.height / canvasSize.height;
  const nextZoom = Math.min(widthScale, heightScale);

  if (!Number.isFinite(nextZoom) || nextZoom <= 0) {
    return DEFAULT_PREVIEW_ZOOM_FACTOR;
  }

  return Math.min(MAX_PREVIEW_ZOOM_FACTOR, nextZoom);
}

function shouldShowLocalOnlyTabs() {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
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
    return;
  }

  const inlineEditor = document.querySelector('.canvas-text-editor');

  if (inlineEditor instanceof HTMLElement) {
    inlineEditor.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    inlineEditor.dispatchEvent(new FocusEvent('blur'));
  }
}

function resolveClipboardRouting(
  target: EventTarget | null,
  isPreInsertModalOpen: boolean,
  isCopyFallbackModalOpen: boolean,
) {
  const modalOwnsClipboard = isPreInsertModalOpen || isCopyFallbackModalOpen;
  const backgroundCopyAllowed =
    !modalOwnsClipboard && !isEditableTarget(target) && !hasTextSelection();

  return {
    backgroundCopyAllowed,
    modalOwnsClipboard,
  };
}

function hasVisibleSceneContent(state: ReturnType<typeof createDefaultAppState>) {
  if (state.image) {
    return true;
  }

  return state.layers.some((layer) => {
    if (isTextLayer(layer)) {
      return layer.text.trim().length > 0;
    }

    return true;
  });
}

function readMobileRecoverySnapshot(): MobileRecoverySnapshot | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const rawSnapshot = window.sessionStorage.getItem(MOBILE_RECOVERY_STORAGE_KEY);

  if (!rawSnapshot) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawSnapshot) as MobileRecoverySnapshot;

    if (
      parsed.version !== 1 ||
      !Array.isArray(parsed.textLayers) ||
      parsed.canvasSize?.width <= 0 ||
      parsed.canvasSize?.height <= 0 ||
      (parsed.imageDataUrl !== undefined && typeof parsed.imageDataUrl !== 'string')
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function App() {
  const [appState, setAppState] = useState(createDefaultAppState);
  const [statusMessage, setStatusMessage] = useState<string | null>(appState.errorMessage);
  const [theme, setTheme] = useState<'light' | 'dark'>(getPreferredTheme);
  const [inspectorWidth, setInspectorWidth] = useState(getStoredInspectorWidth);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const openSceneInputRef = useRef<HTMLInputElement | null>(null);
  const uploadButtonRef = useRef<HTMLButtonElement | null>(null);
  const workspaceRef = useRef<HTMLElement | null>(null);
  const previewFrameRef = useRef<HTMLDivElement | null>(null);
  const isDraggingSplitRef = useRef(false);
  const nextLayerSequenceRef = useRef(appState.layers.length + 1);
  const nextImageLayerSequenceRef = useRef(1);
  const nextDrawLayerSequenceRef = useRef(1);
  const lastShortcutCopyAtRef = useRef(0);
  const latestExplicitClipboardRequestTokenRef = useRef(0);
  const latestUrlImportRequestTokenRef = useRef(0);
  const latestTemplateApplyRequestTokenRef = useRef(0);
  const latestShippedTemplateLoadRequestTokenRef = useRef(0);
  const pendingAutoFitPreviewRef = useRef(true);
  const selectionClipboardRef = useRef<SelectionClipboardSnapshot | null>(null);
  const pendingFilePickerRequestRef = useRef<ImportRequestContext>({
    restoreFocusTo: null,
    target: { kind: 'base' },
  });
  const saveSceneFileHandleRef = useRef<SceneFileHandle | null>(null);
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
  const isCopyFallbackModalOpenRef = useRef(false);
  const [activeInspectorTab, setActiveInspectorTab] = useState<InspectorTab>('layers');
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === 'undefined' ? SMALL_TABLET_MAX_WIDTH + 1 : window.innerWidth,
  );
  const [viewportHeight, setViewportHeight] = useState(() =>
    typeof window === 'undefined' ? 0 : resolveViewportHeight(),
  );
  const [isPhoneInspectorOpen, setIsPhoneInspectorOpen] = useState(false);
  const [isTopbarOverflowOpen, setIsTopbarOverflowOpen] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [isPreInsertCropMode, setIsPreInsertCropMode] = useState(false);
  const [isPreviewStageHovered, setIsPreviewStageHovered] = useState(false);
  const [previewPan, setPreviewPan] = useState({ x: 0, y: 0 });
  const [historyState, setHistoryState] = useState({ canRedo: false, canUndo: false });
  const [templateLibrary, setTemplateLibrary] = useState<MelfTemplateDocument[]>(readInitialTemplateLibrary);
  const [shippedTemplateLibrary, setShippedTemplateLibrary] = useState<MelfTemplateDocument[]>([]);
  const [templatePromoteStatus, setTemplatePromoteStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [applyingTemplateId, setApplyingTemplateId] = useState<string | null>(null);
  const [recentScenes, setRecentScenes] = useState<RecentSceneEntry[]>(readInitialRecentSceneEntries);
  const [mobileRecoverySnapshot, setMobileRecoverySnapshot] = useState<MobileRecoverySnapshot | null>(
    readMobileRecoverySnapshot,
  );
  const [copyFallbackModalState, setCopyFallbackModalState] = useState<{
    imageDataUrl: string;
    restoreFocusTo: HTMLElement | null;
  } | null>(null);
  const showLocalOnlyTabs = shouldShowLocalOnlyTabs();
  const pickerTemplateLibrary =
    showLocalOnlyTabs && shippedTemplateLibrary.length === 0
      ? templateLibrary
      : shippedTemplateLibrary;
  const templateCatalog = createBuiltInTemplateCatalog(pickerTemplateLibrary);
  const draftTemplateCatalog = createBuiltInTemplateCatalog(templateLibrary);
  const mobileShellLayout = resolveMobileShellLayout(viewportWidth);
  const topbarActionLayout = resolveTopbarActionLayout(mobileShellLayout.shellMode);
  const isInspectorVisible =
    mobileShellLayout.inspectorMode !== 'collapsed' || isPhoneInspectorOpen;
  const hasPhoneSelectionSession = Boolean(
    appState.retouch.selection.rect || appState.retouch.selection.draftRect,
  );
  const hasDrawLayers = appState.layers.some((layer) => isDrawLayer(layer));
  const isPhoneSceneSession =
    mobileShellLayout.shellMode === 'phone' &&
    (appState.activeSceneBoundsMode === 'crop' || appState.activeSceneBoundsMode === 'expand');
  const isPhoneRetouchSession =
    mobileShellLayout.shellMode === 'phone' &&
    !isPhoneSceneSession &&
    (
      activeInspectorTab === 'draw' ||
      appState.retouch.mode === 'draw' ||
      appState.retouch.mode === 'erase' ||
      appState.retouch.mode === 'eyedropper' ||
      appState.retouch.mode === 'select' ||
      hasPhoneSelectionSession
    );
  const previewGuardrails = resolveMobilePreviewGuardrails({
    canvasSize: appState.canvasSize,
    hasRasterEffects:
      hasActiveSceneImageAdjustments(appState.sceneImageAdjustments) ||
      hasActiveSceneEffectStack(appState.sceneEffectStack),
    viewportWidth,
  });
  const toolToggleLabel = isInspectorVisible ? 'Hide tools' : 'Show tools';
  const previewPanSessionRef = useRef<{
    pointerId: number | null;
    source: 'mouse' | 'touch';
    startClientX: number;
    startClientY: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);
  const appStateRef = useRef(appState);
  const historyPastRef = useRef<EditorHistorySnapshot[]>([]);
  const historyFutureRef = useRef<EditorHistorySnapshot[]>([]);
  const historyTransactionRef = useRef<EditorHistorySnapshot | null>(null);
  const templateLibraryMutationVersionRef = useRef(0);

  const activeStatusLabel = statusMessage ?? (appState.image ? 'Image loaded.' : 'Ready.');
  const activeToolLabel = resolveActiveToolLabel(appState);
  const activeTargetLabel = resolveActiveTargetLabel(appState);
  const activeGestureLabel = resolveMobileGestureLabel(appState.mobileInteraction.activeGestureOwner);

  useEffect(() => {
    let cancelled = false;
    const requestToken = latestShippedTemplateLoadRequestTokenRef.current + 1;
    latestShippedTemplateLoadRequestTokenRef.current = requestToken;

    void loadShippedTemplateDocuments().then((templates) => {
      if (cancelled || latestShippedTemplateLoadRequestTokenRef.current !== requestToken) {
        return;
      }

      setShippedTemplateLibrary(templates);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  function syncHistoryState() {
    setHistoryState({
      canUndo: historyPastRef.current.length > 0,
      canRedo: historyFutureRef.current.length > 0,
    });
  }

  function updateMobileInteractionState(
    updates: Partial<typeof appState.mobileInteraction>,
  ) {
    setAppState((currentState) => ({
      ...currentState,
      mobileInteraction: {
        ...currentState.mobileInteraction,
        ...updates,
      },
    }));
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

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleResize = () => {
      setViewportWidth(window.innerWidth);
      setViewportHeight(resolveViewportHeight());
    };

    window.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    if (mobileShellLayout.shellMode !== 'phone') {
      setIsPhoneInspectorOpen(false);
      setIsKeyboardOpen(false);
      return undefined;
    }

    const syncKeyboardState = () => {
      setIsKeyboardOpen(isEditableTarget(document.activeElement));
    };

    const handleFocusOut = () => {
      window.setTimeout(syncKeyboardState, 0);
    };

    document.addEventListener('focus', syncKeyboardState, true);
    document.addEventListener('blur', handleFocusOut, true);

    return () => {
      document.removeEventListener('focus', syncKeyboardState, true);
      document.removeEventListener('blur', handleFocusOut, true);
    };
  }, [mobileShellLayout.shellMode]);

  useEffect(() => {
    setIsTopbarOverflowOpen(false);
  }, [mobileShellLayout.shellMode]);

  useEffect(() => {
    if (viewportWidth > SMALL_TABLET_MAX_WIDTH) {
      return;
    }

    const snapshot = mobileRecoverySnapshot;

    if (!snapshot) {
      return;
    }

    let cancelled = false;

    if (!snapshot.imageDataUrl) {
      applyMobileRecoverySnapshot(
        snapshot,
        null,
        'Recovered the last mobile draft text after the previous session was interrupted. Non-text content could not be restored on this phone.',
      );
      return;
    }

    loadImageElementFromUrl(snapshot.imageDataUrl)
      .then((image) => {
        if (cancelled) {
          return;
        }

        applyMobileRecoverySnapshot(
          snapshot,
          image,
          'Recovered the last mobile draft with editable text layers after the previous session was interrupted. Non-text content was flattened into the base image.',
        );
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        window.sessionStorage.removeItem(MOBILE_RECOVERY_STORAGE_KEY);
      });

    return () => {
      cancelled = true;
    };
  }, [mobileRecoverySnapshot, viewportWidth]);

  useEffect(() => {
    if (!pendingAutoFitPreviewRef.current || typeof window === 'undefined') {
      return undefined;
    }

    const frame = window.requestAnimationFrame(() => {
      const previewFrame = previewFrameRef.current;

      if (!previewFrame) {
        return;
      }

      const bounds = previewFrame.getBoundingClientRect();

      if (bounds.width <= 0 || bounds.height <= 0) {
        return;
      }

      pendingAutoFitPreviewRef.current = false;
      setAppState((currentState) => ({
        ...currentState,
        previewZoomFactor: resolveFitToWindowZoomFactor(
          currentState.canvasSize,
          previewFrame,
        ),
      }));
      setPreviewPan({ x: 0, y: 0 });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [appState.canvasSize, viewportHeight, viewportWidth]);

  useEffect(() => {
    function persistMobileRecoverySnapshot() {
      if (
        typeof window === 'undefined' ||
        viewportWidth > SMALL_TABLET_MAX_WIDTH ||
        !hasVisibleSceneContent(appStateRef.current)
      ) {
        return;
      }

      const canvas = canvasRef.current;

      if (!canvas) {
        return;
      }

      try {
        persistMobileRecoverySnapshotToStorage(appStateRef.current, window.sessionStorage);
      } catch {
        // Ignore recovery snapshot failures and keep the current session running.
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        persistMobileRecoverySnapshot();
      }
    }

    window.addEventListener('pagehide', persistMobileRecoverySnapshot);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pagehide', persistMobileRecoverySnapshot);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [viewportWidth]);

  useEffect(() => {
    if (!showLocalOnlyTabs && activeInspectorTab === 'experimental') {
      setActiveInspectorTab('layers');
    }
  }, [activeInspectorTab, showLocalOnlyTabs]);

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
    pendingAutoFitPreviewRef.current = true;
    const loadedImageGuardrails = resolveLoadedImageGuardrails({
      sourceSize: getImageSourceSize(image, appStateRef.current.canvasSize),
      viewportWidth,
    });

    applyAppStateChange((currentState) => {
      const canvasSize = loadedImageGuardrails.canvasSize;
      const fitZoomFactor = resolveFitToWindowZoomFactor(canvasSize, previewFrameRef.current);

      return {
        ...currentState,
        canvasSize,
        errorMessage: null,
        image,
        layers: createLayersForCanvas(currentState.layers, currentState.canvasSize, canvasSize),
        previewZoomFactor: fitZoomFactor,
        status: 'idle',
      };
    });
    setPreviewPan({ x: 0, y: 0 });
    setStatusMessage(
      loadedImageGuardrails.message ? `${nextStatus} ${loadedImageGuardrails.message}` : nextStatus,
    );
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

  function startSceneCropSession() {
    setAppState((currentState) => ({
      ...currentState,
      activeSceneBoundsMode: 'crop',
      sceneBoundsDraft: {
        ...createResetSceneBoundsDraft(currentState.sceneBoundsDraft),
      },
    }));
  }

  function openPreInsertModal(
    image: HTMLImageElement,
    fileName: string,
    sourceKind:
      | 'upload-image'
      | 'upload-url'
      | 'advanced-import-file'
      | 'advanced-import-clipboard'
      | 'advanced-import-url',
    requestContext: ImportRequestContext,
  ) {
    const sourceSize = {
      width: image.naturalWidth || appStateRef.current.canvasSize.width,
      height: image.naturalHeight || appStateRef.current.canvasSize.height,
    };

    preInsertSessionRef.current = {
      pendingUploadFileName: fileName,
      previousStatusMessage: statusMessage,
      requestContext,
    };
    isPreInsertModalOpenRef.current = true;
    setIsPreInsertCropMode(true);
    setAppState((currentState) => ({
      ...currentState,
      preInsertModalDraft: {
        pendingSource: {
          image,
          sourceKind,
          sourceSize,
        },
        cropBox: {
          startX: 0,
          startY: 0,
          endX: sourceSize.width,
          endY: sourceSize.height,
        },
        rotationQuarterTurns: 0,
        flipHorizontal: false,
        flipVertical: false,
        advancedPlacementMode: currentState.preferredAdvancedImportPlacementMode,
        urlInputValue: '',
        urlStatus: 'idle',
        urlErrorMessage: null,
      },
      status: 'idle',
    }));
  }

  function openUrlImportModal(
    sourceKind: 'upload-url' | 'advanced-import-url',
    requestContext: ImportRequestContext,
    initialUrl = '',
  ) {
    preInsertSessionRef.current = {
      pendingUploadFileName: null,
      previousStatusMessage: statusMessage,
      requestContext,
    };
    isPreInsertModalOpenRef.current = true;
    setIsPreInsertCropMode(true);
    setAppState((currentState) => ({
      ...currentState,
      preInsertModalDraft: {
        pendingSource: {
          image: null,
          sourceKind,
          sourceSize: {
            width: 1,
            height: 1,
          },
        },
        cropBox: null,
        rotationQuarterTurns: 0,
        flipHorizontal: false,
        flipVertical: false,
        advancedPlacementMode: currentState.preferredAdvancedImportPlacementMode,
        urlInputValue: initialUrl,
        urlStatus: 'idle',
        urlErrorMessage: null,
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
    latestUrlImportRequestTokenRef.current += 1;
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
        mobileInteraction: {
          ...currentState.mobileInteraction,
          activeTargetId: nextLayerId,
        },
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

    if (appStateRef.current.retouch.mode === 'clone-stamp') {
      applyAppStateChange((currentState) => {
        const cloneSource = currentState.retouch.cloneStamp;
        const targetId = cloneSource.sourceTargetId;

        if (!cloneSource.sourcePoint || !targetId) {
          return {
            ...currentState,
            retouch: {
              ...currentState.retouch,
              draftStroke: null,
            },
          };
        }

        const nextState = commitCloneStampToTarget(currentState, {
          points: currentDraft.points,
          sourcePoint: cloneSource.sourcePoint,
          targetId,
        });

        if (!nextState) {
          return {
            ...currentState,
            retouch: {
              ...currentState.retouch,
              draftStroke: null,
            },
          };
        }

        return nextState;
      });

      setStatusMessage('Clone stamp applied.');
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

  async function applyTemplatePreset(templateId: string) {
    const requestToken = latestTemplateApplyRequestTokenRef.current + 1;
    latestTemplateApplyRequestTokenRef.current = requestToken;
    setApplyingTemplateId(templateId);
    const template = getTemplateById(pickerTemplateLibrary, templateId);

    if (!template) {
      setApplyingTemplateId(null);
      setStatusMessage('That template is no longer available.');
      return;
    }

    let templateImage: HTMLImageElement | null = null;
    let imageLoadFailed = false;

    if (template.baseImagePath) {
      try {
        templateImage = await loadImageElementFromUrl(template.baseImagePath);
      } catch {
        imageLoadFailed = true;
      }
    }

    if (latestTemplateApplyRequestTokenRef.current !== requestToken) {
      return;
    }

    pendingAutoFitPreviewRef.current = true;
    setSelectedTemplateId(templateId);
    setAppState((currentState) => ({
      ...applyMelfTemplateToState(currentState, template),
      image: templateImage,
    }));
    setActiveInspectorTab('layers');
    setStatusMessage(
      imageLoadFailed
        ? `Applied template: ${template.title}. The template base image could not be loaded.`
        : `Applied template: ${template.title}.`,
    );
    setApplyingTemplateId(null);
  }

  function persistTemplateLibrary(nextLibrary: MelfTemplateDocument[]) {
    templateLibraryMutationVersionRef.current += 1;
    setTemplateLibrary(nextLibrary);

    if (typeof window === 'undefined' || !showLocalOnlyTabs) {
      return;
    }

    void writePersistedTemplateLibrary(DEV_TEMPLATE_LIBRARY_STORAGE_KEY, nextLibrary);
  }

  function reorderTemplateLibrary(
    currentLibrary: readonly MelfTemplateDocument[],
    orderedTemplateIds: readonly string[],
  ) {
    const templateMap = new Map(
      currentLibrary.map((template) => [template.templateId, template] as const),
    );

    return orderedTemplateIds.map((templateId, index) => ({
      ...cloneTemplateDocuments([templateMap.get(templateId)!])[0]!,
      sortOrder: (index + 1) * 100,
    }));
  }

  function updateTemplateTitle(templateId: string, title: string) {
    persistTemplateLibrary(
      templateLibrary.map((template) =>
        template.templateId === templateId
          ? {
              ...template,
              title: title.trim().length > 0 ? title.trim() : template.name,
            }
          : template,
      ),
    );
  }

  function updateTemplateTags(templateId: string, rawTags: string) {
    const tags = Array.from(
      new Set(
        rawTags
          .split(',')
          .map((tag) => tag.trim().toLowerCase())
          .filter((tag) => tag.length > 0),
      ),
    );

    persistTemplateLibrary(
      templateLibrary.map((template) =>
        template.templateId === templateId
          ? {
              ...template,
              tags,
            }
          : template,
      ),
    );
  }

  function moveTemplate(templateId: string, direction: 'up' | 'down') {
    const orderedIds = draftTemplateCatalog.map((entry) => entry.templateId);
    const index = orderedIds.indexOf(templateId);

    if (index < 0) {
      return;
    }

    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= orderedIds.length) {
      return;
    }

    const nextIds = [...orderedIds];
    const [movedId] = nextIds.splice(index, 1);
    nextIds.splice(targetIndex, 0, movedId!);
    persistTemplateLibrary(reorderTemplateLibrary(templateLibrary, nextIds));
  }

  function deleteTemplate(templateId: string) {
    persistTemplateLibrary(templateLibrary.filter((template) => template.templateId !== templateId));

    if (selectedTemplateId === templateId) {
      setSelectedTemplateId(null);
    }
  }

  async function importTemplateFiles(files: File[]) {
    const importedTemplates: MelfTemplateDocument[] = [];

    for (const file of files) {
      const rawDocument = await readTextFromBlob(file);
      const template = parseImportedTemplateDocument(rawDocument, file.name);

      if (template) {
        importedTemplates.push(template);
      }
    }

    if (importedTemplates.length === 0) {
      setStatusMessage('No valid template or scene .melf documents were imported.');
      return;
    }

    const existingIds = draftTemplateCatalog.map((entry) => entry.templateId);
    const importedIds = importedTemplates.map((template) => template.templateId);
    const nextOrderedIds = [
      ...importedIds,
      ...existingIds.filter((templateId) => !importedIds.includes(templateId)),
    ];
    const nextLibrary = reorderTemplateLibrary(
      [
        ...importedTemplates,
        ...templateLibrary.filter((template) => !importedIds.includes(template.templateId)),
      ],
      nextOrderedIds,
    );

    persistTemplateLibrary(nextLibrary);
    setStatusMessage(
      importedTemplates.length === 1
        ? `Imported template: ${importedTemplates[0]!.title}.`
        : `Imported ${importedTemplates.length} templates.`,
    );
  }

  async function refreshShippedTemplateLibrary() {
    const requestToken = latestShippedTemplateLoadRequestTokenRef.current + 1;
    latestShippedTemplateLoadRequestTokenRef.current = requestToken;
    const templates = await loadShippedTemplateDocuments();

    if (latestShippedTemplateLoadRequestTokenRef.current !== requestToken) {
      return templates;
    }

    setShippedTemplateLibrary(templates);
    return templates;
  }

  async function promoteTemplateCatalog() {
    setTemplatePromoteStatus('loading');

    try {
      const response = await fetch('/__dev/templates/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templates: templateLibrary.map((template) => ({
            templateId: template.templateId,
            title: template.title,
            tags: template.tags,
            sortOrder: template.sortOrder,
            template,
          })),
        }),
      });

      if (!response.ok) {
        setTemplatePromoteStatus('error');
        setStatusMessage('Failed to promote the shipped template catalog.');
        return;
      }

      await refreshShippedTemplateLibrary();
      setTemplatePromoteStatus('success');
      setStatusMessage('Shipped template catalog updated.');
    } catch {
      setTemplatePromoteStatus('error');
      setStatusMessage('Failed to promote the shipped template catalog.');
    }
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

  function handleCloneStampSourceSet(point: DrawPoint) {
    setAppState((currentState) => {
      const targetId = resolveSelectionTargetId(currentState);
      const targetBox = targetId ? resolveSelectionTargetBox(currentState, targetId) : null;

      if (!targetId || !targetBox) {
        return currentState;
      }

      if (
        point.x < targetBox.x ||
        point.x > targetBox.x + targetBox.width ||
        point.y < targetBox.y ||
        point.y > targetBox.y + targetBox.height
      ) {
        return currentState;
      }

      return {
        ...currentState,
        retouch: {
          ...currentState.retouch,
          cloneStamp: {
            sourcePoint: point,
            sourceTargetId: targetId,
          },
        },
      };
    });
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
            mode: 'idle',
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
          mode: 'idle',
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
        mode: 'idle',
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

      const nextState = mode === 'cut' ? extraction.nextState : currentState;

      return {
        ...nextState,
        retouch: {
          ...nextState.retouch,
          selection: {
            targetId,
            draftRect: null,
            rect: null,
          },
        },
      };
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

    const result = await readImageFromClipboardResult();

    if (!isLatestExplicitClipboardRequest(requestToken)) {
      return;
    }

    if (!result.image) {
      setStatusMessage(resolveClipboardReadFailureMessage(result.reason, 'base-import'));
      return;
    }

    applyLoadedImage(result.image, 'Image loaded from clipboard.');
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
      setStatusMessage(resolveClipboardReadFailureMessage(result.reason, 'advanced-import'));
      return;
    }

    openPreInsertModal(
      result.image,
      'Clipboard image',
      'advanced-import-clipboard',
      requestContext,
    );
  }

  function handleUrlImportClick(opener: HTMLButtonElement) {
    openUrlImportModal('upload-url', createImportRequestContext({ kind: 'base' }, opener));
  }

  function handleAdvancedImportUrlClick(opener: HTMLButtonElement) {
    openUrlImportModal(
      'advanced-import-url',
      createImportRequestContext({ kind: 'advanced-import-url' }, opener),
    );
  }

  async function handlePreInsertUrlLoad(urlOverride?: string) {
    const preInsertModalDraft = appStateRef.current.preInsertModalDraft;

    if (!preInsertModalDraft && !urlOverride) {
      return;
    }

    const nextUrl = (urlOverride ?? preInsertModalDraft?.urlInputValue ?? '').trim();

    if (!nextUrl) {
      setAppState((currentState) => ({
        ...currentState,
        preInsertModalDraft: currentState.preInsertModalDraft
          ? {
              ...currentState.preInsertModalDraft,
              urlStatus: 'error',
              urlErrorMessage: 'Paste a direct image URL first.',
            }
          : null,
      }));
      return;
    }

    latestUrlImportRequestTokenRef.current += 1;
    const requestToken = latestUrlImportRequestTokenRef.current;

    setAppState((currentState) => ({
      ...currentState,
      preInsertModalDraft: currentState.preInsertModalDraft
        ? {
            ...currentState.preInsertModalDraft,
            urlInputValue: nextUrl,
            urlStatus: 'loading',
            urlErrorMessage: null,
          }
        : null,
    }));

    try {
      const image = await loadImageElementFromUrl(nextUrl);

      if (latestUrlImportRequestTokenRef.current !== requestToken) {
        revokeLoadedImageObjectUrl(image);
        return;
      }

      const sourceSize = {
        width: image.naturalWidth || appStateRef.current.canvasSize.width,
        height: image.naturalHeight || appStateRef.current.canvasSize.height,
      };
      const fileName = resolveImageUrlFileName(nextUrl);

      setAppState((currentState) => {
        const currentDraft = currentState.preInsertModalDraft;

        if (!currentDraft) {
          revokeLoadedImageObjectUrl(image);
          return currentState;
        }

        revokeLoadedImageObjectUrl(currentDraft.pendingSource.image);

        return {
          ...currentState,
          preInsertModalDraft: {
            ...currentDraft,
            pendingSource: {
              ...currentDraft.pendingSource,
              image,
              sourceSize,
            },
            cropBox: {
              startX: 0,
              startY: 0,
              endX: sourceSize.width,
              endY: sourceSize.height,
            },
            rotationQuarterTurns: 0,
            flipHorizontal: false,
            flipVertical: false,
            urlInputValue: nextUrl,
            urlStatus: 'idle',
            urlErrorMessage: null,
          },
        };
      });
      preInsertSessionRef.current = {
        ...preInsertSessionRef.current,
        pendingUploadFileName: fileName,
      };
    } catch (error) {
      if (latestUrlImportRequestTokenRef.current !== requestToken) {
        return;
      }

      setAppState((currentState) => ({
        ...currentState,
        preInsertModalDraft: currentState.preInsertModalDraft
          ? {
              ...currentState.preInsertModalDraft,
              urlInputValue: nextUrl,
              urlStatus: 'error',
              urlErrorMessage: resolveUrlImportFailureMessage(error),
            }
          : null,
      }));
    }
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

  async function handleCopyClick(restoreFocusTo: HTMLElement | null = null) {
    const canvas = canvasRef.current;

    if (!canvas) {
      setStatusMessage('The canvas is not ready yet.');
      return;
    }

    if (
      !canCopyImageToClipboard({
        hasClipboardItem: typeof ClipboardItem !== 'undefined',
        hasClipboardWrite: typeof navigator.clipboard?.write === 'function',
        isSecureContext: typeof window === 'undefined' ? true : window.isSecureContext,
      })
    ) {
      openCopyFallbackModal(
        canvas,
        typeof window !== 'undefined' && !window.isSecureContext
          ? 'secure-context-required'
          : 'clipboard-unsupported',
        restoreFocusTo,
      );
      return;
    }

    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': canvasToBlob(canvas).then((blob) => {
            if (!blob) {
              throw new Error('blob-unavailable');
            }

            return blob;
          }),
        }),
      ]);
      setCopyFallbackModalState(null);
      setStatusMessage(resolveMobileExportMessage('copy-success'));
    } catch {
      const blob = await canvasToBlob(canvas);

      openCopyFallbackModal(
        canvas,
        blob ? 'clipboard-blocked' : 'blob-unavailable',
        restoreFocusTo,
      );
    }
  }

  function openCopyFallbackModal(
    canvas: HTMLCanvasElement,
    outcome: Exclude<Parameters<typeof resolveMobileExportMessage>[0], 'copy-success'>,
    restoreFocusTo: HTMLElement | null,
  ) {
    try {
      const imageDataUrl = canvas.toDataURL('image/png');
      setCopyFallbackModalState({ imageDataUrl, restoreFocusTo });
    } catch {
      setCopyFallbackModalState(null);
    }

    setStatusMessage(resolveMobileExportMessage(outcome));
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

  async function handleSaveSceneClick() {
    try {
      const currentHandle = saveSceneFileHandleRef.current;
      const suggestedName = normalizeSceneFileName(currentHandle?.name ?? 'meme-elf-scene');
      const sceneDocument = await serializeAppStateToMelfSceneDocument(appStateRef.current, {
        name: stripMelfExtension(suggestedName),
      });
      const rawDocument = stringifyMelfSceneDocument(sceneDocument);

      if (currentHandle) {
        await writeSceneDocumentToHandle(currentHandle, rawDocument);
        persistRecentScene(sceneDocument.name, rawDocument);
        setStatusMessage(`${normalizeSceneFileName(currentHandle.name ?? suggestedName)} saved.`);
        return;
      }

      const pickerWindow = window as FilePickerWindow;
      if (typeof pickerWindow.showSaveFilePicker === 'function') {
        const nextHandle = await pickerWindow.showSaveFilePicker({
          suggestedName,
          types: [
            {
              accept: {
                [MELF_MIME_TYPE]: [MELF_EXTENSION],
              },
              description: 'meme-elf scene',
            },
          ],
        });

        await writeSceneDocumentToHandle(nextHandle, rawDocument);
        saveSceneFileHandleRef.current = nextHandle;
        persistRecentScene(sceneDocument.name, rawDocument);
        setStatusMessage(`${normalizeSceneFileName(nextHandle.name ?? suggestedName)} saved.`);
        return;
      }

      downloadSceneDocument(rawDocument, suggestedName);
      persistRecentScene(sceneDocument.name, rawDocument);
      setStatusMessage(`${suggestedName} download started.`);
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }

      setStatusMessage('The .melf scene could not be saved.');
    }
  }

  async function handleOpenSceneClick() {
    try {
      const pickerWindow = window as FilePickerWindow;
      if (typeof pickerWindow.showOpenFilePicker === 'function') {
        const handles = await pickerWindow.showOpenFilePicker({
          excludeAcceptAllOption: false,
          multiple: false,
          types: [
            {
              accept: {
                [MELF_MIME_TYPE]: [MELF_EXTENSION],
                'application/json': [MELF_EXTENSION],
              },
              description: 'meme-elf scene',
            },
          ],
        });
        const handle = handles[0] ?? null;

        if (!handle) {
          return;
        }

        const file = await handle.getFile();
        await openSceneFile(file, handle);
        return;
      }

      openSceneInputRef.current?.click();
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }

      setStatusMessage('The .melf scene could not be opened.');
    }
  }

  async function openSceneFile(file: File, fileHandle: SceneFileHandle | null) {
    try {
      const rawDocument = await file.text();
      const sceneDocument = parseMelfSceneDocument(rawDocument);

      if (!sceneDocument) {
        setStatusMessage('That .melf file is not valid.');
        return;
      }

      await applySceneDocument(sceneDocument, {
        fileHandle,
        rawDocument,
      });
      setStatusMessage(`${normalizeSceneFileName(file.name)} opened.`);
    } catch {
      setStatusMessage('The .melf scene could not be opened.');
    }
  }

  async function handleOpenRecentScene(entry: RecentSceneEntry) {
    const sceneDocument = parseMelfSceneDocument(entry.document);

    if (!sceneDocument) {
      handleRemoveRecentScene(entry.id);
      setStatusMessage('That saved scene is no longer valid.');
      return;
    }

    await applySceneDocument(sceneDocument, {
      fileHandle: null,
      rawDocument: entry.document,
    });
    setStatusMessage(`${entry.name} reopened from local saves.`);
  }

  function handleRemoveRecentScene(sceneId: string) {
    const nextEntries = removeRecentSceneEntry(window.localStorage, sceneId);
    setRecentScenes(nextEntries);
  }

  function handleDismissRecoveryDraft() {
    window.sessionStorage.removeItem(MOBILE_RECOVERY_STORAGE_KEY);
    setMobileRecoverySnapshot(null);
    setStatusMessage('Recovery draft dismissed.');
  }

  async function handleRecoverMobileDraft() {
    if (!mobileRecoverySnapshot) {
      return;
    }

    if (!mobileRecoverySnapshot.imageDataUrl) {
      applyMobileRecoverySnapshot(
        mobileRecoverySnapshot,
        null,
        'Recovered the interrupted mobile draft into the current editor session.',
      );
      return;
    }

    try {
      const image = await loadImageElementFromUrl(mobileRecoverySnapshot.imageDataUrl);
      applyMobileRecoverySnapshot(
        mobileRecoverySnapshot,
        image,
        'Recovered the interrupted mobile draft into the current editor session.',
      );
    } catch {
      handleDismissRecoveryDraft();
      setStatusMessage('The recovery draft could not be restored.');
    }
  }

  function persistRecentScene(name: string, rawDocument: string) {
    const nextEntries = upsertRecentSceneEntry(window.localStorage, {
      document: rawDocument,
      name,
      updatedAt: new Date().toISOString(),
    });
    setRecentScenes(nextEntries);
  }

  async function applySceneDocument(
    sceneDocument: MelfSceneDocument,
    options: {
      fileHandle: SceneFileHandle | null;
      rawDocument: string;
    },
  ) {
    const nextState = await materializeAppStateFromMelfSceneDocument(sceneDocument);
    const fitZoomFactor = resolveFitToWindowZoomFactor(nextState.canvasSize, previewFrameRef.current);

    historyPastRef.current = [];
    historyFutureRef.current = [];
    historyTransactionRef.current = null;
    syncHistoryState();
    pendingAutoFitPreviewRef.current = true;
    nextLayerSequenceRef.current = nextState.layers.filter(isTextLayer).length + 1;
    nextImageLayerSequenceRef.current = nextState.layers.filter(isImageLayer).length + 1;
    nextDrawLayerSequenceRef.current = nextState.layers.filter(isDrawLayer).length + 1;
    saveSceneFileHandleRef.current = options.fileHandle;
    setAppState({
      ...nextState,
      previewZoomFactor: fitZoomFactor,
    });
    setActiveInspectorTab('layers');
    setPreviewPan({ x: 0, y: 0 });
    persistRecentScene(sceneDocument.name, options.rawDocument);
  }

  function applyMobileRecoverySnapshot(
    snapshot: MobileRecoverySnapshot,
    image: HTMLImageElement | null,
    nextStatusMessage: string,
  ) {
    pendingAutoFitPreviewRef.current = true;
    setAppState((currentState) => ({
      ...currentState,
      activeLayerId: snapshot.textLayers[0]?.id ?? null,
      canvasSize: { ...snapshot.canvasSize },
      errorMessage: null,
      image,
      layers: cloneTextLayers(snapshot.textLayers),
      previewZoomFactor: currentState.previewZoomFactor,
      sceneEffectStack: createDefaultSceneEffectStack(),
      sceneImageAdjustments: createDefaultSceneImageAdjustments(),
      sceneWatermark: {
        ...createDefaultSceneWatermark(),
        enabled: false,
      },
      status: 'idle',
    }));
    setPreviewPan({ x: 0, y: 0 });
    setStatusMessage(nextStatusMessage);
  }

  function handleOpenSceneFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';

    if (!file) {
      return;
    }

    void openSceneFile(file, null);
  }

  useEffect(() => {
    isPreInsertModalOpenRef.current = appState.preInsertModalDraft !== null;
  }, [appState.preInsertModalDraft]);

  useEffect(() => {
    isCopyFallbackModalOpenRef.current = copyFallbackModalState !== null;
  }, [copyFallbackModalState]);

  useEffect(() => {
    if (!showLocalOnlyTabs) {
      return;
    }

    if (typeof window !== 'undefined' && window.localStorage.getItem(DEV_TEMPLATE_LIBRARY_STORAGE_KEY)) {
      return;
    }

    let cancelled = false;
    const mutationVersionAtRequestStart = templateLibraryMutationVersionRef.current;

    void readPersistedTemplateLibrary(DEV_TEMPLATE_LIBRARY_STORAGE_KEY).then((library) => {
      if (
        cancelled ||
        library === null ||
        templateLibraryMutationVersionRef.current !== mutationVersionAtRequestStart
      ) {
        return;
      }

      setTemplateLibrary(library);
    });

    return () => {
      cancelled = true;
    };
  }, [showLocalOnlyTabs]);

  useEffect(() => {
    async function handlePasteEvent(event: ClipboardEvent) {
      if (isEditableTarget(event.target)) {
        return;
      }

      const clipboardRouting = resolveClipboardRouting(
        event.target,
        isPreInsertModalOpenRef.current,
        isCopyFallbackModalOpenRef.current,
      );

      if (clipboardRouting.modalOwnsClipboard) {
        event.preventDefault();
        return;
      }

      const image = await extractImageFromPasteEvent(event);

      if (image) {
        event.preventDefault();
        applyLoadedImage(image, 'Image pasted from the clipboard.');
        return;
      }

      const pastedUrl = extractImageUrlFromPasteEvent(event);

      if (!pastedUrl) {
        return;
      }

      event.preventDefault();
      openUrlImportModal(
        'upload-url',
        createImportRequestContext({ kind: 'base' }, null),
        pastedUrl,
      );
      void handlePreInsertUrlLoad(pastedUrl);
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

      if (!panSession || panSession.source !== 'mouse') {
        return;
      }

      setPreviewPan({
        x: panSession.startPanX + (event.clientX - panSession.startClientX),
        y: panSession.startPanY + (event.clientY - panSession.startClientY),
      });
    }

    function handleMouseUp() {
      if (previewPanSessionRef.current?.source === 'mouse') {
        previewPanSessionRef.current = null;
      }
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [previewPan.x, previewPan.y]);

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const panSession = previewPanSessionRef.current;

      if (!panSession || panSession.source !== 'touch' || panSession.pointerId !== event.pointerId) {
        return;
      }

      setPreviewPan({
        x: panSession.startPanX + (event.clientX - panSession.startClientX),
        y: panSession.startPanY + (event.clientY - panSession.startClientY),
      });
    }

    function handlePointerEnd(event: PointerEvent) {
      const panSession = previewPanSessionRef.current;

      if (!panSession || panSession.source !== 'touch' || panSession.pointerId !== event.pointerId) {
        return;
      }

      previewPanSessionRef.current = null;
      updateMobileInteractionState({
        activeGestureOwner: 'idle',
      });
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
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
        isCopyFallbackModalOpenRef.current,
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
        event.code === 'KeyC';

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
        isCopyFallbackModalOpenRef.current,
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
        event.code === 'KeyX';

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
        event.code === 'KeyV';

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
    '--app-height': `${viewportHeight}px`,
    '--inspector-width': `${inspectorWidth}%`,
  } as CSSProperties;
  const preInsertDraft = appState.preInsertModalDraft;

  function handleThemeToggle() {
    setTheme((currentTheme) => (currentTheme === 'light' ? 'dark' : 'light'));
  }

  function handleTextEditSessionStart(source: 'canvas' | 'inspector' = 'inspector') {
    beginHistoryTransaction();

    if (mobileShellLayout.shellMode === 'phone') {
      setIsKeyboardOpen(true);

      if (source === 'inspector') {
        setIsPhoneInspectorOpen(true);
      }
    }
  }

  function handleTextEditSessionEnd() {
    commitHistoryTransaction();

    if (mobileShellLayout.shellMode === 'phone') {
      setIsKeyboardOpen(false);
    }
  }

  function dismissActiveTextFocus() {
    const currentState = appStateRef.current;
    const activeLayer = currentState.layers.find((layer) => layer.id === currentState.activeLayerId);

    if (!activeLayer || !isTextLayer(activeLayer)) {
      return;
    }

    blurActiveEditable();
    setAppState((state) => clearActiveLayer(state));
  }

  function renderToolbarAction(actionId: ToolbarActionId) {
    switch (actionId) {
      case 'paste':
        return (
          <ToolbarIconButton
            key={actionId}
            label="Paste from Clipboard"
            icon={<PasteIcon />}
            onClick={() => {
              dismissActiveTextFocus();
              handlePasteClick();
            }}
          />
        );
      case 'upload':
        return (
          <ToolbarIconButton
            key={actionId}
            label="Upload Image"
            icon={<UploadIcon />}
            buttonRef={uploadButtonRef}
            onClick={(event) => {
              dismissActiveTextFocus();
              handleUploadClick(event.currentTarget);
            }}
          />
        );
      case 'url':
        return (
          <ToolbarIconButton
            key={actionId}
            label="Paste image URL"
            icon={<UrlIcon />}
            onClick={(event) => {
              dismissActiveTextFocus();
              handleUrlImportClick(event.currentTarget);
            }}
          />
        );
      case 'copy':
        return (
          <ToolbarIconButton
            key={actionId}
            label="Copy Image"
            icon={<CopyIcon />}
            onClick={(event) => {
              dismissActiveTextFocus();
              handleCopyClick(event.currentTarget);
            }}
          />
        );
      case 'open-scene':
        return (
          <ToolbarIconButton
            key={actionId}
            label="Open .melf"
            icon={<OpenSceneIcon />}
            onClick={() => {
              dismissActiveTextFocus();
              void handleOpenSceneClick();
            }}
          />
        );
      case 'save-scene':
        return (
          <ToolbarIconButton
            key={actionId}
            label="Save .melf"
            icon={<SaveSceneIcon />}
            onClick={() => {
              dismissActiveTextFocus();
              void handleSaveSceneClick();
            }}
          />
        );
      case 'download':
        return (
          <ToolbarIconButton
            key={actionId}
            label="Download PNG"
            icon={<DownloadIcon />}
            onClick={() => {
              dismissActiveTextFocus();
              handleDownloadClick();
            }}
          />
        );
      case 'theme':
        return (
          <ToolbarIconButton
            key={actionId}
            label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
            icon={theme === 'light' ? <MoonIcon /> : <SunIcon />}
            onClick={() => {
              dismissActiveTextFocus();
              handleThemeToggle();
            }}
          />
        );
      case 'tools':
        return (
          <button
            key={actionId}
            type="button"
            className="toolbar-icon-button icon-button-with-tooltip"
            aria-label={toolToggleLabel}
            aria-expanded={isInspectorVisible}
            data-tooltip={toolToggleLabel}
            onPointerDown={handleTooltipTouchPointerDown}
            onTouchStart={handleTooltipTouchStart}
            onFocus={handleTooltipTouchFocus}
            onClick={(event) => {
              handleTooltipTouchClick(event);
              dismissActiveTextFocus();
              setIsPhoneInspectorOpen((currentState) => !currentState);
            }}
          >
            <ToolsIcon />
          </button>
        );
      case 'overflow':
        return (
          <button
            key={actionId}
            type="button"
            className={`toolbar-icon-button icon-button-with-tooltip${isTopbarOverflowOpen ? ' tool-rail-button-active' : ''}`}
            aria-label="More actions"
            aria-expanded={isTopbarOverflowOpen}
            aria-haspopup="menu"
            data-tooltip="More actions"
            onPointerDown={handleTooltipTouchPointerDown}
            onTouchStart={handleTooltipTouchStart}
            onFocus={handleTooltipTouchFocus}
            onClick={(event) => {
              handleTooltipTouchClick(event);
              dismissActiveTextFocus();
              setIsTopbarOverflowOpen((currentState) => !currentState);
            }}
          >
            <MoreIcon />
          </button>
        );
    }
  }

  function updatePreviewZoom(resolveNextZoom: (currentZoom: number) => number) {
    setAppState((currentState) => ({
      ...currentState,
      previewZoomFactor: clampPreviewZoom(resolveNextZoom(currentState.previewZoomFactor)),
    }));
  }

  function fitPreviewToWindow() {
    setAppState((currentState) => ({
      ...currentState,
      previewZoomFactor: resolveFitToWindowZoomFactor(
        currentState.canvasSize,
        previewFrameRef.current,
      ),
    }));
    setPreviewPan({ x: 0, y: 0 });
  }

  useEffect(() => {
    function handleDocumentTouchPointerDown(event: PointerEvent) {
      const currentState = appStateRef.current;
      const pointerType = event.pointerType || currentState.mobileInteraction.lastPointerType;
      const target = event.target;

      if (
        pointerType !== 'touch' ||
        !(target instanceof HTMLElement) ||
        target.closest('.preview-surface')
      ) {
        return;
      }

      const activeLayer = currentState.layers.find((layer) => layer.id === currentState.activeLayerId);

      if (!activeLayer || !isTextLayer(activeLayer)) {
        return;
      }

      blurActiveEditable();
      setAppState((state) => clearActiveLayer(state));
    }

    document.addEventListener('pointerdown', handleDocumentTouchPointerDown, true);
    return () => document.removeEventListener('pointerdown', handleDocumentTouchPointerDown, true);
  }, []);

  return (
    <main
      className={`app-shell app-shell-${mobileShellLayout.shellMode}`}
      data-shell-mode={mobileShellLayout.shellMode}
      data-keyboard-open={isKeyboardOpen}
    >
      <header className="topbar">
        <div className="topbar-brand">
          <h1>meme-elf</h1>
        </div>
        <div
          className={`topbar-actions topbar-actions-${mobileShellLayout.topbarActionsMode}`}
          role="toolbar"
          aria-label="Editor actions"
          data-actions-mode={mobileShellLayout.topbarActionsMode}
        >
          {topbarActionLayout.primary.map((actionId) => renderToolbarAction(actionId))}
          {topbarActionLayout.overflow.length > 0 &&
          !topbarActionLayout.primary.includes('overflow')
            ? renderToolbarAction('overflow')
            : null}
          {isTopbarOverflowOpen ? (
            <div className="toolbar-overflow-menu" role="menu" aria-label="More actions">
              {topbarActionLayout.overflow.map((actionId) => (
                <button
                  key={actionId}
                  type="button"
                  role="menuitem"
                  className="toolbar-overflow-item"
                  aria-label={resolveOverflowActionLabel(actionId, theme)}
                  onClick={() => {
                    setIsTopbarOverflowOpen(false);

                    if (actionId === 'theme') {
                      handleThemeToggle();
                      return;
                    }

                    if (actionId === 'open-scene') {
                      dismissActiveTextFocus();
                      void handleOpenSceneClick();
                      return;
                    }

                    if (actionId === 'save-scene') {
                      dismissActiveTextFocus();
                      void handleSaveSceneClick();
                    }
                  }}
                >
                  {resolveOverflowActionLabel(actionId, theme)}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </header>

      <section
        ref={workspaceRef}
        style={workspaceStyle}
        className={`workspace-shell workspace-shell-${mobileShellLayout.workspaceMode}`}
        aria-label="Workspace"
        data-inspector-mode={mobileShellLayout.inspectorMode}
        data-workspace-mode={mobileShellLayout.workspaceMode}
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
              {mobileShellLayout.shellMode === 'phone' ? null : (
                <h2 className="preview-title">MEME</h2>
              )}
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
                onClick={() => {
                  updatePreviewZoom(() => DEFAULT_PREVIEW_ZOOM_FACTOR);
                  setPreviewPan({ x: 0, y: 0 });
                }}
                aria-label="Actual size"
                title="Actual size"
              >
                1:1
              </button>
              <button
                type="button"
                className="mini-action-button preview-toolbar-button preview-toolbar-button-fit"
                onClick={fitPreviewToWindow}
                aria-label="Fit to window"
                title="Fit to window"
              >
                Fit
              </button>
              <button
                type="button"
                className={`mini-action-button preview-toolbar-button${appState.retouch.mode === 'select' ? ' settings-button-active' : ''}`}
                aria-label="Select area"
                title="Select area"
                style={isPhoneRetouchSession ? { display: 'none' } : undefined}
                onClick={() =>
                  setAppState((currentState) => applyRetouchModeChange(currentState, 'select'))
                }
              >
                ☐
              </button>
              {!isPhoneRetouchSession && (appState.retouch.selection.rect || appState.retouch.selection.draftRect) ? (
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
              {!isPhoneRetouchSession && appState.retouch.selection.rect ? (
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
                pointerId: null,
                source: 'mouse',
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
            <div ref={previewFrameRef} className="preview-frame">
              <PreviewCanvas
                canvasRef={canvasRef}
                activeLayerId={appState.activeLayerId}
                draftStroke={appState.retouch.draftStroke}
                image={appState.image}
                mobileInteraction={appState.mobileInteraction}
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
                previewGuardrails={previewGuardrails}
                previewPan={previewPan}
                previewZoomFactor={appState.previewZoomFactor}
                isSceneCropMode={appState.activeSceneBoundsMode === 'crop'}
                sceneCropDraft={appState.sceneBoundsDraft.cropRect}
                isStageHovered={isPreviewStageHovered}
                onDocumentInteractionStart={beginHistoryTransaction}
                onDocumentInteractionEnd={commitHistoryTransaction}
                onInlineTextEditStart={() => handleTextEditSessionStart('canvas')}
                onInlineTextEditEnd={handleTextEditSessionEnd}
                onDraftStrokeChange={handleDraftStrokeChange}
                onDraftStrokeCommit={handleDraftStrokeCommit}
                onCloneStampSourceSet={handleCloneStampSourceSet}
                onMobileInteractionChange={(interaction) =>
                  updateMobileInteractionState(interaction)
                }
                onPreviewPanStart={({ clientX, clientY, pointerId }) => {
                  const currentSession = previewPanSessionRef.current;

                  if (!currentSession || currentSession.pointerId !== pointerId) {
                    previewPanSessionRef.current = {
                      pointerId,
                      source: 'touch',
                      startClientX: clientX,
                      startClientY: clientY,
                      startPanX: previewPan.x,
                      startPanY: previewPan.y,
                    };
                    return;
                  }

                  setPreviewPan({
                    x: currentSession.startPanX + (clientX - currentSession.startClientX),
                    y: currentSession.startPanY + (clientY - currentSession.startClientY),
                  });
                }}
                onPreviewPanEnd={() => {
                  previewPanSessionRef.current = null;
                }}
                onRetouchBrushSample={handleRetouchBrushSample}
                onSelectionDraftChange={handleSelectionDraftChange}
                onSelectionDraftCommit={commitSelectionDraft}
                onActiveLayerChange={(layerId) =>
                  setAppState((currentState) => applyLayerActivation(currentState, layerId))
                }
                onActiveLayerClear={() =>
                  setAppState((currentState) => clearActiveLayer(currentState))
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
            {mobileShellLayout.shellMode !== 'desktop' ? (
              <>
                <span>Tool: {activeToolLabel}</span>
                <span>Target: {activeTargetLabel ?? 'Base image'}</span>
                {activeGestureLabel ? <span>Gesture: {activeGestureLabel}</span> : null}
              </>
            ) : null}
          </div>
        </section>

        {isInspectorVisible ? (
          <ControlPanel
            activeTab={activeInspectorTab}
            activeSceneBoundsMode={appState.activeSceneBoundsMode}
            activeLayerId={appState.activeLayerId}
            shellMode={mobileShellLayout.shellMode}
            isImportModalOpen={preInsertDraft !== null}
            layers={appState.layers}
            showLocalOnlyTabs={showLocalOnlyTabs}
            retouchMode={appState.retouch.mode}
            retouchBrush={appState.retouch.brush}
            cloneStampSourcePoint={appState.retouch.cloneStamp.sourcePoint}
            cloneStampSourceTargetId={appState.retouch.cloneStamp.sourceTargetId}
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
            templateCatalog={templateCatalog}
            templateDraftCatalog={draftTemplateCatalog}
            selectedTemplateId={selectedTemplateId}
            applyingTemplateId={applyingTemplateId}
            recentScenes={recentScenes}
            mobileRecoverySnapshot={mobileRecoverySnapshot}
            onOpenAdvancedImportClipboard={(opener) => {
              void handleAdvancedImportClipboardClick(opener);
            }}
            onOpenAdvancedImportFile={handleAdvancedImportFileClick}
            onOpenAdvancedImportUrl={handleAdvancedImportUrlClick}
            onBackgroundPointerDown={blurActiveEditable}
            onInterfacePointerDown={dismissActiveTextFocus}
            onApplySceneCrop={applySceneCropCommit}
            onApplySceneExpand={applySceneExpandCommit}
            onActiveLayerChange={(layerId) =>
              setAppState((currentState) => applyLayerActivation(currentState, layerId))
            }
            onActiveTabChange={setActiveInspectorTab}
            onCancelSceneBounds={cancelSceneBounds}
            onClearActiveLayer={() =>
              setAppState((currentState) => clearActiveLayer(currentState))
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
            onApplyTemplatePreset={applyTemplatePreset}
            onImportTemplateFiles={(files) => {
              void importTemplateFiles(files);
            }}
            onTemplateTitleChange={updateTemplateTitle}
            onTemplateTagsChange={updateTemplateTags}
            onMoveTemplateUp={(templateId) => moveTemplate(templateId, 'up')}
            onMoveTemplateDown={(templateId) => moveTemplate(templateId, 'down')}
            onDeleteTemplate={deleteTemplate}
            onPromoteTemplateCatalog={() => {
              void promoteTemplateCatalog();
            }}
            templatePromoteStatus={templatePromoteStatus}
            onOpenRecentScene={(entry) => {
              void handleOpenRecentScene(entry);
            }}
            onRemoveRecentScene={handleRemoveRecentScene}
            onRecoverMobileDraft={() => {
              void handleRecoverMobileDraft();
            }}
            onDismissRecoveryDraft={handleDismissRecoveryDraft}
            onStartSceneCrop={startSceneCropSession}
            onTextLayerChange={updateTextLayer}
            onTextEditSessionStart={() => handleTextEditSessionStart('inspector')}
            onTextEditSessionEnd={handleTextEditSessionEnd}
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
        ) : null}
      </section>
      {isPhoneSceneSession ? (
        <div className="mobile-session-actions" role="toolbar" aria-label="Scene transform session">
          <span className="mobile-session-label">
            {appState.activeSceneBoundsMode === 'crop' ? 'Crop session' : 'Canvas expand session'}
          </span>
          <button
            type="button"
            className="mini-action-button"
            disabled={
              appState.activeSceneBoundsMode === 'crop'
                ? !appState.sceneBoundsDraft.cropRect
                : !hasPendingSceneExpand(appState.sceneBoundsDraft.expand)
            }
            onClick={
              appState.activeSceneBoundsMode === 'crop'
                ? applySceneCropCommit
                : applySceneExpandCommit
            }
          >
            {appState.activeSceneBoundsMode === 'crop' ? 'Apply crop' : 'Apply bounds'}
          </button>
          <button type="button" className="mini-action-button" onClick={cancelSceneBounds}>
            Cancel
          </button>
        </div>
      ) : isPhoneRetouchSession ? (
        <div className="mobile-session-actions mobile-session-actions-retouch" role="toolbar" aria-label="Retouch session">
          <span className="mobile-session-label">
            {hasPhoneSelectionSession ? 'Selection session' : 'Retouch session'}
          </span>
          {appState.retouch.selection.rect ? (
            <>
              <SessionIconButton
                icon={<CopyIcon />}
                label="Copy selection to new layer"
                onClick={copySelectionToLayer}
              />
              <SessionIconButton
                icon={<CutIcon />}
                label="Cut selection to new layer"
                onClick={cutSelectionToLayer}
              />
            </>
          ) : null}
          {hasPhoneSelectionSession ? (
            <SessionIconButton
              icon={<CloseIcon />}
              label="Cancel selection"
              onClick={handleCancelSelection}
            />
          ) : null}
          <SessionIconButton
            isActive={appState.retouch.mode === 'draw'}
            icon={<DrawModeIcon />}
            label="Activate draw mode"
            onClick={() =>
              setAppState((currentState) => applyRetouchModeChange(currentState, 'draw'))
            }
          />
          {hasDrawLayers ? (
            <SessionIconButton
              isActive={appState.retouch.mode === 'erase'}
              icon={<EraseIcon />}
              label="Activate erase mode"
              onClick={() =>
                setAppState((currentState) => applyRetouchModeChange(currentState, 'erase'))
              }
            />
          ) : null}
          <SessionIconButton
            isActive={appState.retouch.mode === 'eyedropper'}
            icon={<EyedropperIcon />}
            label="Pick color"
            onClick={() =>
              setAppState((currentState) => applyRetouchModeChange(currentState, 'eyedropper'))
            }
          />
          <SessionIconButton
            isActive={appState.retouch.mode === 'select'}
            icon={<SelectIcon />}
            label="Select area"
            onClick={() =>
              setAppState((currentState) => applyRetouchModeChange(currentState, 'select'))
            }
          />
          <SessionIconButton
            icon={<ToolsIcon />}
            label={toolToggleLabel}
            onClick={() => setIsPhoneInspectorOpen((current) => !current)}
          />
        </div>
      ) : topbarActionLayout.sticky.length > 0 ? (
        <div className="mobile-primary-actions" role="toolbar" aria-label="Mobile primary actions">
          {topbarActionLayout.sticky.map((actionId) => renderToolbarAction(actionId))}
        </div>
      ) : null}
      <input
        ref={fileInputRef}
        className="file-input file-input-hidden"
        aria-label="Upload image file"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileChange}
      />
      <input
        ref={openSceneInputRef}
        className="file-input file-input-hidden"
        aria-label="Open .melf file"
        type="file"
        accept={`${MELF_EXTENSION},${MELF_MIME_TYPE},application/json`}
        onChange={handleOpenSceneFileChange}
      />
      {preInsertDraft ? (
        <PreInsertModal
          confirmLabel={
            (preInsertDraft.pendingSource.sourceKind === 'upload-image' ||
            preInsertDraft.pendingSource.sourceKind === 'upload-url')
              ? 'Confirm'
              : 'Add layer'
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

              if (requestContext.target.kind === 'advanced-import-url') {
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
          onUrlInputChange={(urlInputValue) =>
            setAppState((currentState) => ({
              ...currentState,
              preInsertModalDraft: currentState.preInsertModalDraft
                ? {
                    ...currentState.preInsertModalDraft,
                    urlInputValue,
                    urlStatus: 'idle',
                    urlErrorMessage: null,
                  }
                : null,
            }))
          }
          onUrlLoad={() => {
            void handlePreInsertUrlLoad();
          }}
          restoreFocusTo={preInsertSessionRef.current.requestContext.restoreFocusTo}
        />
      ) : null}
      {copyFallbackModalState ? (
        <CopyFallbackModal
          imageDataUrl={copyFallbackModalState.imageDataUrl}
          onClose={() => setCopyFallbackModalState(null)}
          restoreFocusTo={copyFallbackModalState.restoreFocusTo}
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
      onPointerDown={handleTooltipTouchPointerDown}
      onTouchStart={handleTooltipTouchStart}
      onFocus={handleTooltipTouchFocus}
      onClick={(event) => {
        handleTooltipTouchClick(event);
        onClick(event);
      }}
    >
      {icon}
    </button>
  );
}

function SessionIconButton({
  icon,
  isActive = false,
  label,
  onClick,
}: {
  icon: ReactNode;
  isActive?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`mini-action-button icon-button-with-tooltip${isActive ? ' settings-button-active' : ''}`}
      aria-label={label}
      title={label}
      data-tooltip={label}
      onPointerDown={handleTooltipTouchPointerDown}
      onTouchStart={handleTooltipTouchStart}
      onFocus={handleTooltipTouchFocus}
      onClick={(event) => {
        handleTooltipTouchClick(event);
        onClick();
      }}
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

function UrlIcon() {
  return (
    <IconBase>
      <path
        d="M6.2 12.8 4.6 14.4a2.2 2.2 0 1 0 3.1 3.1l1.8-1.8M13.8 7.2l1.6-1.6a2.2 2.2 0 1 0-3.1-3.1l-1.8 1.8M7.8 12.2l4.4-4.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

function OpenSceneIcon() {
  return (
    <IconBase>
      <path
        d="M4.5 15V6a1.5 1.5 0 0 1 1.5-1.5h3l1.5 1.5H14A1.5 1.5 0 0 1 15.5 7.5V15"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 12V7.5M7.8 9.7 10 7.5l2.2 2.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

function SaveSceneIcon() {
  return (
    <IconBase>
      <path
        d="M5 4.5h8l2 2V15a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 5 15V4.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 4.5v4h4v-4M10 13v-2.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 11.5 10 13l1.5-1.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

function MoreIcon() {
  return (
    <IconBase>
      <circle cx="4.5" cy="10" r="1.3" fill="currentColor" />
      <circle cx="10" cy="10" r="1.3" fill="currentColor" />
      <circle cx="15.5" cy="10" r="1.3" fill="currentColor" />
    </IconBase>
  );
}

function ToolsIcon() {
  return (
    <IconBase>
      <path
        d="M4.5 6.5h11M4.5 10h11M4.5 13.5h11"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </IconBase>
  );
}

function DrawModeIcon() {
  return (
    <IconBase>
      <path
        d="M5 14.8 6.8 11l5.9-5.9a1.4 1.4 0 0 1 2 2L8.8 13 5 14.8Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10.8 7l2.2 2.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </IconBase>
  );
}

function EraseIcon() {
  return (
    <IconBase>
      <path
        d="m6 12.8 4.8-6a1.6 1.6 0 0 1 2.5-.1l2 2.4a1.6 1.6 0 0 1 0 2.1l-3.2 3.6H8.4L6 12.8Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M4.8 14.8h8.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </IconBase>
  );
}

function EyedropperIcon() {
  return (
    <IconBase>
      <path
        d="m12.8 4.8 2.4 2.4M8.5 9.1l4.7-4.7a1.4 1.4 0 0 1 2 0l.4.4a1.4 1.4 0 0 1 0 2L11 11.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m9.2 10.8-3.9 3.9-.3 1.1 1.1-.3 3.9-3.9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

function SelectIcon() {
  return (
    <IconBase>
      <path
        d="M5 7V5h2M13 5h2v2M15 13v2h-2M7 15H5v-2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 5H12.5M15 7.5V12.5M12.5 15H7.5M5 12.5V7.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeDasharray="1.8 2.2"
      />
    </IconBase>
  );
}

function CutIcon() {
  return (
    <IconBase>
      <circle cx="6.2" cy="6.2" r="1.7" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="6.2" cy="13.8" r="1.7" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 7.4 15 3.8M8 12.6 15 16.2M8 8.6l3 2.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </IconBase>
  );
}

function CloseIcon() {
  return (
    <IconBase>
      <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </IconBase>
  );
}

function resolveOverflowActionLabel(
  actionId: ToolbarActionId,
  theme: 'light' | 'dark',
) {
  if (actionId === 'theme') {
    return theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme';
  }

  if (actionId === 'open-scene') {
    return 'Open .melf';
  }

  if (actionId === 'save-scene') {
    return 'Save .melf';
  }

  return actionId;
}

async function writeSceneDocumentToHandle(handle: SceneFileHandle, rawDocument: string) {
  const writable = await handle.createWritable();
  await writable.write(rawDocument);
  await writable.close();
}

function downloadSceneDocument(rawDocument: string, fileName: string) {
  const blob = new Blob([rawDocument], { type: MELF_MIME_TYPE });
  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement('a');
  downloadLink.href = url;
  downloadLink.download = normalizeSceneFileName(fileName);
  downloadLink.click();
  URL.revokeObjectURL(url);
}

function normalizeSceneFileName(fileName: string) {
  const trimmed = fileName.trim();
  const normalized = trimmed.length > 0 ? trimmed : 'meme-elf-scene';
  return normalized.toLowerCase().endsWith(MELF_EXTENSION) ? normalized : `${normalized}${MELF_EXTENSION}`;
}

function stripMelfExtension(fileName: string) {
  return fileName.toLowerCase().endsWith(MELF_EXTENSION)
    ? fileName.slice(0, -MELF_EXTENSION.length)
    : fileName;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';
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

function resolveImageUrlFileName(url: string) {
  try {
    const parsedUrl = new URL(url);
    const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
    const lastSegment = pathSegments[pathSegments.length - 1];

    if (lastSegment) {
      return decodeURIComponent(lastSegment);
    }

    return `${parsedUrl.hostname} image`;
  } catch {
    return 'URL image';
  }
}

function readInitialRecentSceneEntries() {
  if (typeof window === 'undefined') {
    return [];
  }

  return readRecentSceneEntries(window.localStorage);
}

function readInitialTemplateLibrary() {
  if (typeof window === 'undefined' || !shouldShowLocalOnlyTabs()) {
    return [];
  }

  const rawLibrary = window.localStorage.getItem(DEV_TEMPLATE_LIBRARY_STORAGE_KEY);

  if (!rawLibrary) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawLibrary) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    if (parsed.length === 0) {
      return [];
    }

    const library = parsed
      .map((entry) => parseMelfTemplateDocument(JSON.stringify(entry)))
      .filter((entry): entry is MelfTemplateDocument => entry !== null);

    return library;
  } catch {
    return [];
  }
}

function resolveUrlImportFailureMessage(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return 'That URL could not be loaded as an image. Use a direct PNG, JPEG, or WebP URL.';
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

function hasPendingSceneExpand(expand: SceneExpandDraft) {
  return expand.left !== 0 || expand.right !== 0 || expand.top !== 0 || expand.bottom !== 0;
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

function cloneTextLayers(layers: TextLayer[]) {
  return layers.map((layer) => ({
    ...layer,
    box: { ...layer.box },
  }));
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

function createMobileRecoverySnapshotBase(state: ReturnType<typeof createDefaultAppState>) {
  return {
    canvasSize: { ...state.canvasSize },
    height: state.canvasSize.height,
    textLayers: state.layers.filter(isTextLayer).map((layer) => ({
      ...layer,
      box: { ...layer.box },
    })),
    version: 1 as const,
    width: state.canvasSize.width,
  };
}

function createScaledRecoveryRasterDataUrl(
  sourceCanvas: HTMLCanvasElement,
  scale: number,
) {
  if (scale === 1) {
    return sourceCanvas.toDataURL('image/png');
  }

  const scaledCanvas = document.createElement('canvas');
  scaledCanvas.width = Math.max(1, Math.round(sourceCanvas.width * scale));
  scaledCanvas.height = Math.max(1, Math.round(sourceCanvas.height * scale));
  const scaledContext = scaledCanvas.getContext('2d');

  if (!scaledContext) {
    return null;
  }

  scaledContext.drawImage(sourceCanvas, 0, 0, scaledCanvas.width, scaledCanvas.height);
  return scaledCanvas.toDataURL('image/png');
}

function persistMobileRecoverySnapshotToStorage(
  state: ReturnType<typeof createDefaultAppState>,
  storage: Storage,
) {
  const recoveryCanvas = document.createElement('canvas');
  recoveryCanvas.width = state.canvasSize.width;
  recoveryCanvas.height = state.canvasSize.height;
  const recoveryContext = recoveryCanvas.getContext('2d');

  if (!recoveryContext) {
    return;
  }

  renderPreview(
    recoveryContext,
    state.image,
    state.canvasSize,
    state.layers.filter((layer) => !isTextLayer(layer)),
    state.sceneImageAdjustments,
    state.sceneEffectStack,
    state.sceneWatermark,
  );

  const baseSnapshot = createMobileRecoverySnapshotBase(state);

  for (const scale of MOBILE_RECOVERY_SCALE_STEPS) {
    const imageDataUrl = createScaledRecoveryRasterDataUrl(recoveryCanvas, scale);

    if (!imageDataUrl) {
      continue;
    }

    try {
      storage.setItem(
        MOBILE_RECOVERY_STORAGE_KEY,
        JSON.stringify({
          ...baseSnapshot,
          imageDataUrl,
        } satisfies MobileRecoverySnapshot),
      );
      return;
    } catch {
      // Try a smaller raster snapshot before giving up on non-text recovery.
    }
  }

  try {
    storage.setItem(MOBILE_RECOVERY_STORAGE_KEY, JSON.stringify(baseSnapshot));
  } catch {
    // Ignore recovery snapshot failures and keep the current session running.
  }
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

function resolveActiveToolLabel(state: ReturnType<typeof createDefaultAppState>) {
  switch (state.retouch.mode) {
    case 'draw':
      return 'Draw';
    case 'erase':
      return 'Erase';
    case 'select':
      return 'Select';
    case 'clone-stamp':
      return 'Clone Stamp';
    case 'eyedropper':
      return 'Eyedropper';
    case 'idle':
      return state.activeSceneBoundsMode === 'crop' ? 'Crop' : 'Move';
  }
}

function resolveActiveTargetLabel(state: ReturnType<typeof createDefaultAppState>) {
  if (state.activeLayerId) {
    const activeLayer = state.layers.find((layer) => layer.id === state.activeLayerId);

    if (activeLayer) {
      return activeLayer.name;
    }
  }

  if (state.retouch.selection.targetId === 'base-image') {
    return 'Base image';
  }

  return state.image ? 'Base image' : null;
}

function resolveMobileGestureLabel(gestureOwner: ReturnType<typeof createDefaultAppState>['mobileInteraction']['activeGestureOwner']) {
  switch (gestureOwner) {
    case 'idle':
      return null;
    case 'draw':
      return 'Draw';
    case 'erase':
      return 'Erase';
    case 'select':
      return 'Select';
    case 'crop':
      return 'Crop';
    case 'transform':
      return 'Transform';
    case 'clone-stamp':
      return 'Clone stamp';
    case 'eyedropper':
      return 'Eyedropper';
    case 'focus-layer':
      return 'Focus target';
    case 'pan':
      return 'Pan';
  }
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

function rasterSurfaceFromCanvasImage(
  image: CanvasImageSource | null,
  sourceSize: { width: number; height: number },
) {
  if (!image) {
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = sourceSize.width;
  canvas.height = sourceSize.height;
  const context = canvas.getContext('2d');

  if (!context) {
    return null;
  }

  context.clearRect(0, 0, sourceSize.width, sourceSize.height);
  context.drawImage(image, 0, 0, sourceSize.width, sourceSize.height);
  const imageData = context.getImageData(0, 0, sourceSize.width, sourceSize.height);

  return {
    width: sourceSize.width,
    height: sourceSize.height,
    data: Uint8ClampedArray.from(imageData.data),
  };
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

function mapScenePointToSourcePoint(
  point: DrawPoint,
  targetBox: { x: number; y: number; width: number; height: number },
  sourceSize: { width: number; height: number },
  skew: { x: number; y: number } = { x: 1, y: 1 },
): DrawPoint {
  const clampedX = Math.min(targetBox.x + targetBox.width, Math.max(targetBox.x, point.x));
  const clampedY = Math.min(targetBox.y + targetBox.height, Math.max(targetBox.y, point.y));
  const relativeX = (clampedX - targetBox.x) / Math.max(targetBox.width, 1);
  const relativeY = (clampedY - targetBox.y) / Math.max(targetBox.height, 1);
  const unflippedX = relativeX * sourceSize.width;
  const unflippedY = relativeY * sourceSize.height;

  return {
    x: skew.x < 0 ? sourceSize.width - unflippedX : unflippedX,
    y: skew.y < 0 ? sourceSize.height - unflippedY : unflippedY,
  };
}

function commitCloneStampToTarget(
  state: ReturnType<typeof createDefaultAppState>,
  input: {
    points: DrawPoint[];
    sourcePoint: DrawPoint;
    targetId: RasterSelectionTargetId;
  },
) {
  if (input.targetId === 'base-image') {
    const target = rasterSurfaceFromCanvasImage(state.image, state.canvasSize);

    if (!target) {
      return null;
    }

    const stamped = applyCloneStampStroke({
      brushSize: state.retouch.brush.size,
      destinationStart: input.points[0]!,
      opacity: state.retouch.brush.opacity,
      points: input.points,
      softEdge: state.retouch.brush.softEdge,
      sourcePoint: input.sourcePoint,
      target,
    });

    return {
      ...state,
      image: createCanvasImageFromRasterSurface(stamped.surface) as unknown as HTMLImageElement,
      retouch: {
        ...state.retouch,
        draftStroke: null,
      },
    };
  }

  const targetLayer = state.layers.find((layer) => layer.id === input.targetId);

  if (!targetLayer || (!isImageLayer(targetLayer) && !isDrawLayer(targetLayer))) {
    return null;
  }

  const mappedSourcePoint = mapScenePointToSourcePoint(
    input.sourcePoint,
    targetLayer.box,
    targetLayer.sourceSize,
    isImageLayer(targetLayer) ? targetLayer.skew : { x: 1, y: 1 },
  );
  const mappedPoints = input.points.map((point) =>
    mapScenePointToSourcePoint(
      point,
      targetLayer.box,
      targetLayer.sourceSize,
      isImageLayer(targetLayer) ? targetLayer.skew : { x: 1, y: 1 },
    ),
  );

  if (isDrawLayer(targetLayer)) {
    const stamped = applyCloneStampStroke({
      brushSize: state.retouch.brush.size,
      destinationStart: mappedPoints[0]!,
      opacity: state.retouch.brush.opacity,
      points: mappedPoints,
      softEdge: state.retouch.brush.softEdge,
      sourcePoint: mappedSourcePoint,
      target: targetLayer.raster,
    });

    return {
      ...state,
      layers: state.layers.map((layer) =>
        layer.id === targetLayer.id && isDrawLayer(layer)
          ? {
              ...layer,
              raster: stamped.surface,
            }
          : layer,
      ),
      retouch: {
        ...state.retouch,
        draftStroke: null,
      },
    };
  }

  const targetRaster = rasterSurfaceFromCanvasImage(targetLayer.image, targetLayer.sourceSize);

  if (!targetRaster) {
    return null;
  }

  const stamped = applyCloneStampStroke({
    brushSize: state.retouch.brush.size,
    destinationStart: mappedPoints[0]!,
    opacity: state.retouch.brush.opacity,
    points: mappedPoints,
    softEdge: state.retouch.brush.softEdge,
    sourcePoint: mappedSourcePoint,
    target: targetRaster,
  });

  return {
    ...state,
    layers: state.layers.map((layer) =>
      layer.id === targetLayer.id && isImageLayer(layer)
        ? {
            ...layer,
            image: createCanvasImageFromRasterSurface(stamped.surface),
          }
        : layer,
    ),
    retouch: {
      ...state.retouch,
      draftStroke: null,
    },
  };
}

function applyLayerActivation(
  state: ReturnType<typeof createDefaultAppState>,
  layerId: LayerId,
) {
  const nextCloneStamp =
    state.retouch.cloneStamp.sourceTargetId === layerId
      ? state.retouch.cloneStamp
      : {
          sourcePoint: null,
          sourceTargetId: null,
        };
  const nextState = {
    ...state,
    activeLayerId: layerId,
    mobileInteraction: {
      ...state.mobileInteraction,
      activeTargetId: layerId,
    },
    retouch: {
      ...state.retouch,
      cloneStamp: nextCloneStamp,
    },
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

function clearActiveLayer(state: ReturnType<typeof createDefaultAppState>) {
  const nextCloneStamp =
    state.retouch.cloneStamp.sourceTargetId === state.activeLayerId
      ? {
          sourcePoint: null,
          sourceTargetId: null,
        }
      : state.retouch.cloneStamp;
  const nextState = {
    ...state,
    activeLayerId: null,
    mobileInteraction: {
      ...state.mobileInteraction,
      activeTargetId: null,
    },
    retouch: {
      ...state.retouch,
      cloneStamp: nextCloneStamp,
    },
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
    mobileInteraction: {
      ...state.mobileInteraction,
      activeTargetId:
        nextMode === 'select'
          ? nextSelectionTargetId
          : state.activeLayerId,
    },
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
