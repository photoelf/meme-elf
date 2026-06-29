import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  type TouchEvent as ReactTouchEvent,
} from 'react';

import {
  getAxisLockedMoveDelta,
  getTextLayers,
  resizeImageLayerBox,
} from '../image/image-layer-utils';
import {
  createDefaultSceneEffectStack,
  createDefaultSceneImageAdjustments,
} from '../image/image-effects';
import { createDefaultSceneWatermark } from '../image/watermark-utils';
import {
  normalizeSceneCropRect,
  resolveSceneCropInteractionGeometry,
} from '../bounds/crop-overlay';
import { isImageLayer, isTextLayer } from '../../app/types';
import type {
  DrawPoint,
  EditorLayer,
  LayerId,
  MobileInteractionState,
  SelectionDraftRect,
  SelectionRect,
  SceneCropDraftRect,
  SceneEffectStackItem,
  SceneImageAdjustments,
  SceneWatermark,
  TextLayer,
  TextBox,
} from '../../app/types';
import { getTextLayoutMetrics, renderPreview } from '../canvas/canvas-renderer';
import {
  createInactivePreviewGuardrails,
  type PreviewGuardrails,
} from '../canvas/mobile-preview-guardrails';
import {
  resolveMobileGestureOwner,
  resolveTouchHandleSize,
} from './mobile-gesture-policy';

type PreviewCanvasProps = {
  activeLayerId: LayerId | null;
  canvasRef?: RefObject<HTMLCanvasElement | null>;
  image: HTMLImageElement | null;
  isStageHovered: boolean;
  width: number;
  height: number;
  layers: EditorLayer[];
  mobileInteraction?: MobileInteractionState;
  previewPan?: Point;
  previewZoomFactor?: number;
  sceneImageAdjustments?: SceneImageAdjustments;
  sceneEffectStack?: SceneEffectStackItem[];
  sceneWatermark?: SceneWatermark;
  previewGuardrails?: PreviewGuardrails;
  isSceneCropMode?: boolean;
  sceneCropDraft?: SceneCropDraftRect | null;
  onDocumentInteractionEnd?: () => void;
  onDocumentInteractionStart?: () => void;
  onDraftStrokeChange?: (draft: { points: DrawPoint[]; targetLayerId: LayerId | null } | null) => void;
  onDraftStrokeCommit?: () => void;
  onCloneStampSourceSet?: (point: DrawPoint) => void;
  onMobileInteractionChange?: (interaction: MobileInteractionState) => void;
  onPreviewPanEnd?: () => void;
  onPreviewPanStart?: (input: { clientX: number; clientY: number; pointerId: number }) => void;
  onPreviewPinchChange?: (input: { pan: Point; zoomFactor: number }) => void;
  onPreviewToggleFitActual?: () => void;
  onRetouchBrushSample?: (sample: { color: string; opacity: number }) => void;
  onInlineTextEditEnd?: () => void;
  onInlineTextEditStart?: () => void;
  onActiveLayerChange: (layerId: LayerId) => void;
  onActiveLayerClear?: () => void;
  onLayerChange: (
    layerId: LayerId,
    updates: Partial<EditorLayer>,
    historyMode?: 'immediate' | 'defer',
  ) => void;
  onSceneCropDraftChange?: (draft: SceneCropDraftRect | null) => void;
  draftStroke?: { points: DrawPoint[]; targetLayerId: LayerId | null } | null;
  retouchMode?: 'idle' | 'draw' | 'erase' | 'eyedropper' | 'select' | 'clone-stamp';
  retouchBrush?: {
    color: string;
    size: number;
    opacity: number;
  };
  selectionDraft?: SelectionDraftRect | null;
  selectionRect?: SelectionRect | null;
  onSelectionDraftChange?: (draft: SelectionDraftRect | null) => void;
  onSelectionDraftCommit?: (draft: SelectionDraftRect) => void;
  selectionTargetRect?: SelectionRect | null;
};

type InteractionMode =
  | { type: 'move'; layerId: LayerId; startPointer: Point; startBox: EditorLayer['box'] }
  | {
      type: 'resize';
      axisX: 'left' | 'right' | null;
      axisY: 'top' | 'bottom' | null;
      layerId: LayerId;
      startPointer: Point;
      startBox: EditorLayer['box'];
    }
  | { type: 'rotate'; layerId: LayerId; startAngle: number; startRotation: number }
  | null;
type SceneCropInteractionMode =
  | { type: 'new'; startPoint: Point }
  | { type: 'move'; startPointer: Point; startRect: NormalizedSceneCropRect }
  | {
      type: 'resize';
      axisX: 'left' | 'right' | null;
      axisY: 'top' | 'bottom' | null;
      startPointer: Point;
      startRect: NormalizedSceneCropRect;
    }
  | null;
type PreviewPanInteraction = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  moved: boolean;
} | null;
type PendingTouchTextEditInteraction = {
  layerId: LayerId;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startPoint: Point;
  startBox: EditorLayer['box'];
} | null;
type PreviewPinchInteraction = {
  anchorCanvasPoint: Point;
  pointerIds: [number, number];
  startBaseLeft: number;
  startBaseTop: number;
  startDistance: number;
  startZoomFactor: number;
} | null;
type PointerToken = number | 'touch-primary' | 'touch-secondary';
type TouchLayerTransformSession = {
  layerId: LayerId;
  primaryPointerId: PointerToken;
  secondaryPointerId: PointerToken | null;
  startBox: EditorLayer['box'];
  primaryStartCanvasPoint: Point;
  primaryCurrentClientPoint: { clientX: number; clientY: number };
  secondaryCurrentClientPoint: { clientX: number; clientY: number } | null;
  startMidpoint: Point | null;
  startDistance: number | null;
  startAngle: number | null;
  moved: boolean;
  textEditableOnTap: boolean;
} | null;
type EmptyTouchTapRecord = {
  clientX: number;
  clientY: number;
  timeStamp: number;
} | null;
type RecentTouchCompletionRecord = {
  pointerId: number | null;
  timeStamp: number;
} | null;

type Point = { x: number; y: number };
type ResizeHandle = {
  axisX: 'left' | 'right' | null;
  axisY: 'top' | 'bottom' | null;
  className: string;
};
type NormalizedSceneCropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const MIN_BOX_WIDTH = 60;
const MIN_BOX_HEIGHT = 28;
const TOUCH_TEXT_EDIT_TAP_SLOP = 10;
const TOUCH_DOUBLE_TAP_SLOP = 24;
const TOUCH_DOUBLE_TAP_WINDOW_MS = 320;
const RESIZE_HANDLES: ResizeHandle[] = [
  { axisX: 'left', axisY: 'top', className: 'transform-handle-corner-top-left' },
  { axisX: null, axisY: 'top', className: 'transform-handle-edge-top' },
  { axisX: 'right', axisY: 'top', className: 'transform-handle-corner-top-right' },
  { axisX: 'right', axisY: null, className: 'transform-handle-edge-right' },
  { axisX: 'right', axisY: 'bottom', className: 'transform-handle-corner-bottom-right' },
  { axisX: null, axisY: 'bottom', className: 'transform-handle-edge-bottom' },
  { axisX: 'left', axisY: 'bottom', className: 'transform-handle-corner-bottom-left' },
  { axisX: 'left', axisY: null, className: 'transform-handle-edge-left' },
];

export function PreviewCanvas({
  activeLayerId,
  canvasRef,
  image,
  isStageHovered,
  width,
  height,
  layers,
  mobileInteraction = {
    activeGestureOwner: 'idle',
    activeTargetId: null,
    lastPointerType: 'unknown',
  },
  previewPan = { x: 0, y: 0 },
  previewZoomFactor = 1,
  sceneImageAdjustments = createDefaultSceneImageAdjustments(),
  sceneEffectStack = createDefaultSceneEffectStack(),
  sceneWatermark = createDefaultSceneWatermark(),
  previewGuardrails = createInactivePreviewGuardrails(),
  isSceneCropMode = false,
  sceneCropDraft = null,
  onDocumentInteractionEnd,
  onDocumentInteractionStart,
  onDraftStrokeChange,
  onDraftStrokeCommit,
  onCloneStampSourceSet,
  onMobileInteractionChange,
  onPreviewPanEnd,
  onPreviewPanStart,
  onPreviewPinchChange,
  onPreviewToggleFitActual,
  onRetouchBrushSample,
  onInlineTextEditEnd,
  onInlineTextEditStart,
  onActiveLayerChange,
  onActiveLayerClear,
  onLayerChange,
  onSceneCropDraftChange,
  draftStroke = null,
  retouchMode = 'idle',
  retouchBrush = {
    color: '#ff0000',
    size: 8,
    opacity: 1,
  },
  selectionDraft = null,
  selectionRect = null,
  onSelectionDraftChange,
  onSelectionDraftCommit,
  selectionTargetRect = null,
}: PreviewCanvasProps) {
  const internalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const interactionRef = useRef<InteractionMode>(null);
  const sceneCropInteractionRef = useRef<SceneCropInteractionMode>(null);
  const drawInteractionRef = useRef(false);
  const panInteractionRef = useRef<PreviewPanInteraction>(null);
  const pinchInteractionRef = useRef<PreviewPinchInteraction>(null);
  const touchLayerTransformSessionRef = useRef<TouchLayerTransformSession>(null);
  const activePreviewTouchPointsRef = useRef<Map<number, { clientX: number; clientY: number }>>(new Map());
  const pendingTouchTextEditRef = useRef<PendingTouchTextEditInteraction>(null);
  const lastEmptyTouchTapRef = useRef<EmptyTouchTapRecord>(null);
  const recentTouchCompletionRef = useRef<RecentTouchCompletionRecord>(null);
  const clearActiveLayerOnTextBlurRef = useRef(false);
  const selectionInteractionRef = useRef(false);
  const altKeyPressedRef = useRef(false);
  const latestSelectionDraftRef = useRef<SelectionDraftRect | null>(selectionDraft);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const resolvedCanvasRef = canvasRef ?? internalCanvasRef;
  const [isInteracting, setIsInteracting] = useState(false);
  const [editingLayerId, setEditingLayerId] = useState<LayerId | null>(null);
  const [isPreviewSurfaceHovered, setIsPreviewSurfaceHovered] = useState(false);
  const textLayers = getTextLayers(layers);
  const activeLayer = activeLayerId
    ? layers.find((layer) => layer.id === activeLayerId) ?? null
    : null;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Alt') {
        altKeyPressedRef.current = true;
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Alt') {
        altKeyPressedRef.current = false;
      }
    };
    const handleBlur = () => {
      altKeyPressedRef.current = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  function updateMobileInteraction(
    activeGestureOwner: MobileInteractionState['activeGestureOwner'],
    input: {
      activeTargetId?: MobileInteractionState['activeTargetId'];
      pointerType?: MobileInteractionState['lastPointerType'];
    } = {},
  ) {
    onMobileInteractionChange?.({
      activeGestureOwner,
      activeTargetId:
        input.activeTargetId === undefined ? mobileInteraction.activeTargetId : input.activeTargetId,
      lastPointerType:
        input.pointerType === undefined ? mobileInteraction.lastPointerType : input.pointerType,
      });
  }

  function resolveEventPointerType(event: {
    nativeEvent?: { pointerType?: string };
    pointerType?: string;
  }) {
    if ('pointerType' in event && typeof event.pointerType === 'string' && event.pointerType.length > 0) {
      return event.pointerType;
    }

    const nativeEvent = 'nativeEvent' in event ? event.nativeEvent : null;

    if (
      nativeEvent &&
      'pointerType' in nativeEvent &&
      typeof nativeEvent.pointerType === 'string' &&
      nativeEvent.pointerType.length > 0
    ) {
      return nativeEvent.pointerType;
    }

    return mobileInteraction.lastPointerType === 'unknown'
      ? 'mouse'
      : mobileInteraction.lastPointerType;
  }

  function getTouchDistance(first: { clientX: number; clientY: number }, second: { clientX: number; clientY: number }) {
    return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
  }

  function getTouchCenter(first: { clientX: number; clientY: number }, second: { clientX: number; clientY: number }) {
    return {
      clientX: (first.clientX + second.clientX) / 2,
      clientY: (first.clientY + second.clientY) / 2,
    };
  }

  function canStartPreviewPinch() {
    return (
      !isSceneCropMode &&
      retouchMode === 'idle' &&
      !interactionRef.current &&
      !touchLayerTransformSessionRef.current
    );
  }

  function startPreviewPinch() {
    if (!canStartPreviewPinch() || !shellRef.current) {
      return false;
    }

    const activeTouches = [...activePreviewTouchPointsRef.current.entries()];

    if (activeTouches.length < 2) {
      return false;
    }

    const [[firstPointerId, firstTouch], [secondPointerId, secondTouch]] = activeTouches;
    const distance = getTouchDistance(firstTouch, secondTouch);

    if (!Number.isFinite(distance) || distance <= 0) {
      return false;
    }

    const center = getTouchCenter(firstTouch, secondTouch);
    const anchorCanvasPoint = getCanvasPoint(
      shellRef.current,
      width,
      height,
      center.clientX,
      center.clientY,
    );

    if (!anchorCanvasPoint) {
      return false;
    }

    const shellBounds = shellRef.current.getBoundingClientRect();
    pinchInteractionRef.current = {
      anchorCanvasPoint,
      pointerIds: [firstPointerId, secondPointerId],
      startBaseLeft: shellBounds.left - previewPan.x,
      startBaseTop: shellBounds.top - previewPan.y,
      startDistance: distance,
      startZoomFactor: previewZoomFactor,
    };
    pendingTouchTextEditRef.current = null;
    lastEmptyTouchTapRef.current = null;
    if (panInteractionRef.current) {
      panInteractionRef.current = null;
      onPreviewPanEnd?.();
    }
    updateMobileInteraction('pan', {
      activeTargetId: activeLayerId,
      pointerType: 'touch',
    });
    return true;
  }

  function clearTouchLayerTransformSession({
    startInlineEdit = false,
  }: {
    startInlineEdit?: boolean;
  } = {}) {
    const session = touchLayerTransformSessionRef.current;

    if (session) {
      onDocumentInteractionEnd?.();
    }

    touchLayerTransformSessionRef.current = null;
    setIsInteracting(false);
    updateMobileInteraction('idle', {
      activeTargetId: activeLayerId,
      pointerType: 'touch',
    });

    if (startInlineEdit && session?.textEditableOnTap && !session.moved) {
      clearActiveLayerOnTextBlurRef.current = false;
      onActiveLayerChange(session.layerId);
      onInlineTextEditStart?.();
      setEditingLayerId(session.layerId);
      updateMobileInteraction('focus-layer', {
        activeTargetId: session.layerId,
        pointerType: 'touch',
      });
    }
  }

  function upgradeTouchLayerTransformSession(pointerId: number | undefined, clientX: number, clientY: number) {
    const session = touchLayerTransformSessionRef.current;

    if (!session || session.secondaryPointerId !== null) {
      return false;
    }
    const nextPointerId: PointerToken = typeof pointerId === 'number' ? pointerId : 'touch-secondary';
    const nextSecondaryClientPoint =
      isFiniteClientPoint(clientX, clientY)
        ? { clientX, clientY }
        : session.primaryCurrentClientPoint;

    const primaryCanvasPoint =
      shellRef.current
        ? getCanvasPoint(
            shellRef.current,
            width,
            height,
            session.primaryCurrentClientPoint.clientX,
            session.primaryCurrentClientPoint.clientY,
          )
        : session.primaryStartCanvasPoint;
    const secondaryCanvasPoint =
      shellRef.current
        ? getCanvasPoint(
            shellRef.current,
            width,
            height,
            nextSecondaryClientPoint.clientX,
            nextSecondaryClientPoint.clientY,
          )
        : {
            x:
              session.primaryStartCanvasPoint.x +
              (nextSecondaryClientPoint.clientX - session.primaryCurrentClientPoint.clientX),
            y:
              session.primaryStartCanvasPoint.y +
              (nextSecondaryClientPoint.clientY - session.primaryCurrentClientPoint.clientY),
          };

    if (
      !primaryCanvasPoint ||
      !secondaryCanvasPoint ||
      !Number.isFinite(primaryCanvasPoint.x) ||
      !Number.isFinite(primaryCanvasPoint.y) ||
      !Number.isFinite(secondaryCanvasPoint.x) ||
      !Number.isFinite(secondaryCanvasPoint.y)
    ) {
      session.secondaryPointerId = nextPointerId;
      session.secondaryCurrentClientPoint = nextSecondaryClientPoint;
      session.startMidpoint = getBoxCenter(session.startBox);
      session.startDistance = Math.max(1, Math.hypot(session.startBox.width, session.startBox.height));
      session.startAngle = session.startBox.rotation;
      session.moved = true;
      pendingTouchTextEditRef.current = null;
      interactionRef.current = null;
      setEditingLayerId(null);
      setIsInteracting(true);
      updateMobileInteraction('transform', {
        activeTargetId: session.layerId,
        pointerType: 'touch',
      });
      onDocumentInteractionStart?.();
      return true;
    }

    const midpoint = {
      x: (primaryCanvasPoint.x + secondaryCanvasPoint.x) / 2,
      y: (primaryCanvasPoint.y + secondaryCanvasPoint.y) / 2,
    };
    const distance = Math.hypot(
      secondaryCanvasPoint.x - primaryCanvasPoint.x,
      secondaryCanvasPoint.y - primaryCanvasPoint.y,
    );

    if (!Number.isFinite(distance) || distance <= 0) {
      session.secondaryPointerId = nextPointerId;
      session.secondaryCurrentClientPoint = nextSecondaryClientPoint;
      session.startMidpoint = getBoxCenter(session.startBox);
      session.startDistance = Math.max(1, Math.hypot(session.startBox.width, session.startBox.height));
      session.startAngle = session.startBox.rotation;
      session.moved = true;
      pendingTouchTextEditRef.current = null;
      interactionRef.current = null;
      setEditingLayerId(null);
      setIsInteracting(true);
      updateMobileInteraction('transform', {
        activeTargetId: session.layerId,
        pointerType: 'touch',
      });
      onDocumentInteractionStart?.();
      return true;
    }

    session.secondaryPointerId = nextPointerId;
    session.secondaryCurrentClientPoint = nextSecondaryClientPoint;
    session.startMidpoint = midpoint;
    session.startDistance = distance;
    session.startAngle = Math.atan2(
      secondaryCanvasPoint.y - primaryCanvasPoint.y,
      secondaryCanvasPoint.x - primaryCanvasPoint.x,
    );
    session.moved = true;
    pendingTouchTextEditRef.current = null;
    interactionRef.current = null;
    setEditingLayerId(null);
    setIsInteracting(true);
    updateMobileInteraction('transform', {
      activeTargetId: session.layerId,
      pointerType: 'touch',
    });
    onDocumentInteractionStart?.();
    return true;
  }

  function resolveTouchLayerTransformPointerTarget(
    session: NonNullable<TouchLayerTransformSession>,
    event: {
      pointerId?: number;
      clientX: number;
      clientY: number;
    },
  ): 'primary' | 'secondary' | null {
    if (typeof event.pointerId === 'number') {
      if (event.pointerId === session.primaryPointerId) {
        return 'primary';
      }

      if (event.pointerId === session.secondaryPointerId) {
        return 'secondary';
      }
    }

    if (session.secondaryPointerId !== null && session.secondaryCurrentClientPoint) {
      const distanceToPrimary = Math.hypot(
        event.clientX - session.primaryCurrentClientPoint.clientX,
        event.clientY - session.primaryCurrentClientPoint.clientY,
      );
      const distanceToSecondary = Math.hypot(
        event.clientX - session.secondaryCurrentClientPoint.clientX,
        event.clientY - session.secondaryCurrentClientPoint.clientY,
      );

      return distanceToPrimary <= distanceToSecondary ? 'primary' : 'secondary';
    }

    return 'primary';
  }

  function handleTouchLayerTransformPointerMove(event: {
    pointerId?: number;
    clientX: number;
    clientY: number;
  }) {
    const session = touchLayerTransformSessionRef.current;

    if (!session || !shellRef.current) {
      return;
    }

    const pointerTarget = resolveTouchLayerTransformPointerTarget(session, event);

    if (pointerTarget === 'primary') {
      if (typeof event.pointerId === 'number' && typeof session.primaryPointerId !== 'number') {
        session.primaryPointerId = event.pointerId;
      }
      session.primaryCurrentClientPoint = {
        clientX: event.clientX,
        clientY: event.clientY,
      };
    } else if (pointerTarget === 'secondary') {
      if (typeof event.pointerId === 'number' && typeof session.secondaryPointerId !== 'number') {
        session.secondaryPointerId = event.pointerId;
      }
      session.secondaryCurrentClientPoint = {
        clientX: event.clientX,
        clientY: event.clientY,
      };
    } else {
      return;
    }

    const layer = layers.find((candidateLayer) => candidateLayer.id === session.layerId);

    if (!layer) {
      clearTouchLayerTransformSession();
      return;
    }

    const primaryCanvasPoint = getCanvasPoint(
      shellRef.current,
      width,
      height,
      session.primaryCurrentClientPoint.clientX,
      session.primaryCurrentClientPoint.clientY,
    );

    if (!primaryCanvasPoint) {
      return;
    }

    if (session.secondaryPointerId === null || !session.secondaryCurrentClientPoint) {
      const moveDelta = {
        x: primaryCanvasPoint.x - session.primaryStartCanvasPoint.x,
        y: primaryCanvasPoint.y - session.primaryStartCanvasPoint.y,
      };

      if (
        !session.moved &&
        (Math.abs(moveDelta.x) >= TOUCH_TEXT_EDIT_TAP_SLOP ||
          Math.abs(moveDelta.y) >= TOUCH_TEXT_EDIT_TAP_SLOP)
      ) {
        session.moved = true;
      }

      if (!session.moved) {
        return;
      }

      onDocumentInteractionStart?.();
      setIsInteracting(true);
      updateMobileInteraction('transform', {
        activeTargetId: session.layerId,
        pointerType: 'touch',
      });
      onLayerChange(session.layerId, {
        box: {
          ...session.startBox,
          x: session.startBox.x + moveDelta.x,
          y: session.startBox.y + moveDelta.y,
        },
      }, 'defer');
      return;
    }

    const secondaryCanvasPoint = getCanvasPoint(
      shellRef.current,
      width,
      height,
      session.secondaryCurrentClientPoint.clientX,
      session.secondaryCurrentClientPoint.clientY,
    );

    if (!secondaryCanvasPoint || !session.startMidpoint || !session.startDistance || session.startAngle === null) {
      return;
    }

    const midpoint = {
      x: (primaryCanvasPoint.x + secondaryCanvasPoint.x) / 2,
      y: (primaryCanvasPoint.y + secondaryCanvasPoint.y) / 2,
    };
    const currentDistance = Math.hypot(
      secondaryCanvasPoint.x - primaryCanvasPoint.x,
      secondaryCanvasPoint.y - primaryCanvasPoint.y,
    );

    if (!Number.isFinite(currentDistance) || currentDistance <= 0) {
      return;
    }

    const scale = currentDistance / session.startDistance;
    const minWidth = isImageLayer(layer) ? 1 : MIN_BOX_WIDTH;
    const minHeight = isImageLayer(layer) ? 1 : MIN_BOX_HEIGHT;
    const nextWidth = Math.max(minWidth, session.startBox.width * scale);
    const nextHeight = Math.max(minHeight, session.startBox.height * scale);
    const startCenter = getBoxCenter(session.startBox);
    const center = {
      x: startCenter.x + (midpoint.x - session.startMidpoint.x),
      y: startCenter.y + (midpoint.y - session.startMidpoint.y),
    };
    const angle = Math.atan2(
      secondaryCanvasPoint.y - primaryCanvasPoint.y,
      secondaryCanvasPoint.x - primaryCanvasPoint.x,
    );

    onLayerChange(session.layerId, {
      box: {
        ...session.startBox,
        x: center.x - nextWidth / 2,
        y: center.y - nextHeight / 2,
        width: nextWidth,
        height: nextHeight,
        rotation: session.startBox.rotation + (angle - session.startAngle),
      },
    }, 'defer');
  }

  function handleTouchLayerTransformPointerEnd(event: { pointerId?: number; clientX?: number; clientY?: number }) {
    const session = touchLayerTransformSessionRef.current;

    if (!session) {
      return;
    }

    const pointerTarget = resolveTouchLayerTransformPointerTarget(session, {
      pointerId: event.pointerId,
      clientX: event.clientX ?? session.primaryCurrentClientPoint.clientX,
      clientY: event.clientY ?? session.primaryCurrentClientPoint.clientY,
    });

    if (!pointerTarget) {
      return;
    }

    const shouldStartInlineEdit =
      session.secondaryPointerId === null &&
      pointerTarget === 'primary' &&
      session.textEditableOnTap &&
      !session.moved;

    clearTouchLayerTransformSession({
      startInlineEdit: shouldStartInlineEdit,
    });
  }

  function updatePreviewPinch() {
    const pinchInteraction = pinchInteractionRef.current;

    if (!pinchInteraction) {
      return;
    }

    const [firstPointerId, secondPointerId] = pinchInteraction.pointerIds;
    const firstTouch = activePreviewTouchPointsRef.current.get(firstPointerId);
    const secondTouch = activePreviewTouchPointsRef.current.get(secondPointerId);

    if (!firstTouch || !secondTouch) {
      return;
    }

    const distance = getTouchDistance(firstTouch, secondTouch);

    if (!Number.isFinite(distance) || distance <= 0) {
      return;
    }

    const center = getTouchCenter(firstTouch, secondTouch);
    const zoomFactor = pinchInteraction.startZoomFactor * (distance / pinchInteraction.startDistance);
    const pan = {
      x: center.clientX - pinchInteraction.startBaseLeft - (pinchInteraction.anchorCanvasPoint.x * zoomFactor),
      y: center.clientY - pinchInteraction.startBaseTop - (pinchInteraction.anchorCanvasPoint.y * zoomFactor),
    };

    onPreviewPinchChange?.({
      pan,
      zoomFactor,
    });
  }

  function clearPreviewTouchPointer(pointerId: number) {
    activePreviewTouchPointsRef.current.delete(pointerId);

    if (
      pinchInteractionRef.current &&
      pinchInteractionRef.current.pointerIds.includes(pointerId)
    ) {
      pinchInteractionRef.current = null;
      updateMobileInteraction('idle', {
        activeTargetId: activeLayerId,
        pointerType: 'touch',
      });
    }
  }

  function maybeHandleEmptyTouchDoubleTap(clientX: number, clientY: number, timeStamp: number) {
    const lastTap = lastEmptyTouchTapRef.current;

    if (
      lastTap &&
      (timeStamp - lastTap.timeStamp) <= TOUCH_DOUBLE_TAP_WINDOW_MS &&
      Math.abs(clientX - lastTap.clientX) <= TOUCH_DOUBLE_TAP_SLOP &&
      Math.abs(clientY - lastTap.clientY) <= TOUCH_DOUBLE_TAP_SLOP
    ) {
      lastEmptyTouchTapRef.current = null;
      onPreviewToggleFitActual?.();
      return;
    }

    lastEmptyTouchTapRef.current = {
      clientX,
      clientY,
      timeStamp,
    };
  }

  function handleTrackedTouchGesturePointerMove(event: {
    pointerId: number;
    clientX: number;
    clientY: number;
  }) {
    let pointerId = event.pointerId;

    if (!activePreviewTouchPointsRef.current.has(pointerId)) {
      if (pinchInteractionRef.current && activePreviewTouchPointsRef.current.size >= 2) {
        pointerId = pinchInteractionRef.current.pointerIds[1];
      } else if (panInteractionRef.current) {
        pointerId = panInteractionRef.current.pointerId;
      } else if (activePreviewTouchPointsRef.current.size === 1) {
        pointerId = [...activePreviewTouchPointsRef.current.keys()][0];
      }
    }

    const isTrackedPreviewTouch = activePreviewTouchPointsRef.current.has(pointerId);
    const isTrackedPanTouch = panInteractionRef.current?.pointerId === pointerId;

    if (isTrackedPreviewTouch) {
      activePreviewTouchPointsRef.current.set(pointerId, {
        clientX: event.clientX,
        clientY: event.clientY,
      });
    }

    const touchLayerSession = touchLayerTransformSessionRef.current;
    if (
      touchLayerSession &&
      touchLayerSession.secondaryPointerId === null &&
      activePreviewTouchPointsRef.current.size >= 2
    ) {
      const secondaryTouch = [...activePreviewTouchPointsRef.current.entries()].find(
        ([candidatePointerId]) => candidatePointerId !== touchLayerSession.primaryPointerId,
      );

      if (secondaryTouch) {
        const [secondaryPointerId, secondaryPoint] = secondaryTouch;
        upgradeTouchLayerTransformSession(
          secondaryPointerId,
          secondaryPoint.clientX,
          secondaryPoint.clientY,
        );
      }
    }

    const upgradedTouchLayerSession = touchLayerTransformSessionRef.current;
    if (
      upgradedTouchLayerSession &&
      upgradedTouchLayerSession.secondaryPointerId !== null
    ) {
      const layer = layers.find((candidateLayer) => candidateLayer.id === upgradedTouchLayerSession.layerId);
      const primaryTouch =
        typeof upgradedTouchLayerSession.primaryPointerId === 'number'
          ? activePreviewTouchPointsRef.current.get(upgradedTouchLayerSession.primaryPointerId)
          : upgradedTouchLayerSession.primaryCurrentClientPoint;
      const secondaryTouch =
        typeof upgradedTouchLayerSession.secondaryPointerId === 'number'
          ? activePreviewTouchPointsRef.current.get(upgradedTouchLayerSession.secondaryPointerId)
          : upgradedTouchLayerSession.secondaryCurrentClientPoint;

      if (
        layer &&
        primaryTouch &&
        secondaryTouch &&
        shellRef.current &&
        upgradedTouchLayerSession.startMidpoint &&
        upgradedTouchLayerSession.startDistance &&
        upgradedTouchLayerSession.startAngle !== null
      ) {
        const primaryCanvasPoint = getCanvasPoint(
          shellRef.current,
          width,
          height,
          primaryTouch.clientX,
          primaryTouch.clientY,
        );
        const secondaryCanvasPoint = getCanvasPoint(
          shellRef.current,
          width,
          height,
          secondaryTouch.clientX,
          secondaryTouch.clientY,
        );

        if (primaryCanvasPoint && secondaryCanvasPoint) {
          const midpoint = {
            x: (primaryCanvasPoint.x + secondaryCanvasPoint.x) / 2,
            y: (primaryCanvasPoint.y + secondaryCanvasPoint.y) / 2,
          };
          const currentDistance = Math.hypot(
            secondaryCanvasPoint.x - primaryCanvasPoint.x,
            secondaryCanvasPoint.y - primaryCanvasPoint.y,
          );

          if (Number.isFinite(currentDistance) && currentDistance > 0) {
            const scale = currentDistance / upgradedTouchLayerSession.startDistance;
            const minWidth = isImageLayer(layer) ? 1 : MIN_BOX_WIDTH;
            const minHeight = isImageLayer(layer) ? 1 : MIN_BOX_HEIGHT;
            const nextWidth = Math.max(minWidth, upgradedTouchLayerSession.startBox.width * scale);
            const nextHeight = Math.max(minHeight, upgradedTouchLayerSession.startBox.height * scale);
            const startCenter = getBoxCenter(upgradedTouchLayerSession.startBox);
            const center = {
              x: startCenter.x + (midpoint.x - upgradedTouchLayerSession.startMidpoint.x),
              y: startCenter.y + (midpoint.y - upgradedTouchLayerSession.startMidpoint.y),
            };
            const angle = Math.atan2(
              secondaryCanvasPoint.y - primaryCanvasPoint.y,
              secondaryCanvasPoint.x - primaryCanvasPoint.x,
            );

            upgradedTouchLayerSession.moved = true;
            onLayerChange(upgradedTouchLayerSession.layerId, {
              box: {
                ...upgradedTouchLayerSession.startBox,
                x: center.x - nextWidth / 2,
                y: center.y - nextHeight / 2,
                width: nextWidth,
                height: nextHeight,
                rotation: upgradedTouchLayerSession.startBox.rotation + (angle - upgradedTouchLayerSession.startAngle),
              },
            }, 'defer');
          }
        }
      }
    } else if (
      upgradedTouchLayerSession &&
      event.pointerId === upgradedTouchLayerSession.primaryPointerId
    ) {
      handleTouchLayerTransformPointerMove(event);
    }

    const panInteraction = panInteractionRef.current;

    if (panInteraction && panInteraction.pointerId === pointerId) {
      const movedEnough =
        Math.abs(event.clientX - panInteraction.startClientX) >= TOUCH_TEXT_EDIT_TAP_SLOP ||
        Math.abs(event.clientY - panInteraction.startClientY) >= TOUCH_TEXT_EDIT_TAP_SLOP;

      if (movedEnough) {
        panInteraction.moved = true;
      }
    }

    if (!isTrackedPreviewTouch && !isTrackedPanTouch) {
      return;
    }

    if (touchLayerTransformSessionRef.current?.secondaryPointerId !== null) {
      return;
    }

    updatePreviewPinch();
  }

  function handleTrackedTouchGesturePointerEnd(event: {
    pointerId: number;
    clientX: number;
    clientY: number;
    timeStamp: number;
  }) {
    let pointerId = event.pointerId;
    const panInteraction = panInteractionRef.current;

    if (!activePreviewTouchPointsRef.current.has(pointerId)) {
      if (panInteraction) {
        pointerId = panInteraction.pointerId;
      } else if (pinchInteractionRef.current && activePreviewTouchPointsRef.current.size >= 1) {
        pointerId = pinchInteractionRef.current.pointerIds.find((candidatePointerId) =>
          activePreviewTouchPointsRef.current.has(candidatePointerId),
        ) ?? pointerId;
      } else if (activePreviewTouchPointsRef.current.size === 1) {
        pointerId = [...activePreviewTouchPointsRef.current.keys()][0];
      }
    }

    const isTrackedPreviewTouch = activePreviewTouchPointsRef.current.has(pointerId);

    if (!panInteraction && !isTrackedPreviewTouch) {
      return;
    }

    clearPreviewTouchPointer(pointerId);
    panInteractionRef.current = panInteraction?.pointerId === pointerId ? null : panInteractionRef.current;
  }

  function syncPreviewTouches(touches: Pick<ReactTouchEvent<HTMLElement>['touches'], 'length' | 'item'> | ArrayLike<Touch>) {
    const nextTouches = new Map<number, { clientX: number; clientY: number }>();

    for (const touch of Array.from(touches as ArrayLike<Touch>)) {
      nextTouches.set(touch.identifier, {
        clientX: touch.clientX,
        clientY: touch.clientY,
      });
    }

    activePreviewTouchPointsRef.current = nextTouches;
  }

  function handlePreviewTouchStart(event: ReactTouchEvent<HTMLElement>) {
    syncPreviewTouches(event.touches);

    if (startPreviewPinch()) {
      event.preventDefault();
    }
  }

  function handlePreviewTouchMove(event: ReactTouchEvent<HTMLElement>) {
    syncPreviewTouches(event.touches);

    if (!pinchInteractionRef.current) {
      return;
    }

    event.preventDefault();
    updatePreviewPinch();
  }

  function handlePreviewTouchEnd(event: ReactTouchEvent<HTMLElement>) {
    const endingTouch = event.changedTouches[0];
    const panInteraction = panInteractionRef.current;
    const wasPinching = Boolean(pinchInteractionRef.current);

    syncPreviewTouches(event.touches);
    recentTouchCompletionRef.current = {
      pointerId: endingTouch?.identifier ?? null,
      timeStamp: event.timeStamp,
    };

    if (
      endingTouch &&
      !wasPinching &&
      (!panInteraction || !panInteraction.moved) &&
      event.touches.length === 0
    ) {
      maybeHandleEmptyTouchDoubleTap(
        endingTouch.clientX,
        endingTouch.clientY,
        event.timeStamp,
      );
      panInteractionRef.current = null;
    }

    if (pinchInteractionRef.current && event.touches.length < 2) {
      pinchInteractionRef.current = null;
      updateMobileInteraction('idle', {
        activeTargetId: activeLayerId,
        pointerType: 'touch',
      });
    }
  }

  function startSceneCrop(clientX: number, clientY: number) {
    const point = getCanvasPoint(shellRef.current, width, height, clientX, clientY);

    if (!point) {
      return;
    }

    sceneCropInteractionRef.current = {
      type: 'new',
      startPoint: point,
    };
    onSceneCropDraftChange?.(toSceneCropDraftRect({ x: point.x, y: point.y, width: 0, height: 0 }));
    setEditingLayerId(null);
    setIsInteracting(true);
  }

  function updateSceneCrop(clientX: number, clientY: number) {
    if (!isSceneCropMode || !sceneCropInteractionRef.current) {
      return;
    }

    const point = getCanvasPoint(shellRef.current, width, height, clientX, clientY);

    if (!point) {
      return;
    }

    const interaction = sceneCropInteractionRef.current;

    if (interaction.type === 'new') {
      onSceneCropDraftChange?.(
        toSceneCropDraftRect(
          normalizeSceneCropRect(
            {
              startX: interaction.startPoint.x,
              startY: interaction.startPoint.y,
              endX: point.x,
              endY: point.y,
            },
            { width, height },
          ),
        ),
      );
      return;
    }

    if (interaction.type === 'move') {
      onSceneCropDraftChange?.(
        toSceneCropDraftRect(
          moveSceneCropRect(
            interaction.startRect,
            {
              x: point.x - interaction.startPointer.x,
              y: point.y - interaction.startPointer.y,
            },
            { width, height },
          ),
        ),
      );
      return;
    }

    onSceneCropDraftChange?.(
      toSceneCropDraftRect(
        resizeSceneCropRect(
          interaction.startRect,
          interaction.axisX,
          interaction.axisY,
          {
            x: point.x - interaction.startPointer.x,
            y: point.y - interaction.startPointer.y,
          },
          { width, height },
        ),
      ),
    );
  }

  useEffect(() => {
    const canvas = resolvedCanvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');

    if (!context) {
      return;
    }

    context.clearRect(0, 0, width, height);

    renderPreview(
      context,
      image,
      { width, height },
      editingLayerId
        ? layers.filter((layer) => !isTextLayer(layer) || layer.id !== editingLayerId)
        : layers,
      sceneImageAdjustments,
      sceneEffectStack,
      sceneWatermark,
      previewGuardrails,
    );
  }, [
    editingLayerId,
    height,
    image,
    layers,
    resolvedCanvasRef,
    sceneEffectStack,
    sceneImageAdjustments,
    previewGuardrails,
    sceneWatermark,
    width,
  ]);

  useEffect(() => {
    latestSelectionDraftRef.current = selectionDraft;
  }, [selectionDraft]);

  useEffect(() => {
    function handlePanPointerMove(event: PointerEvent) {
      if (!panInteractionRef.current || panInteractionRef.current.pointerId !== event.pointerId) {
        return;
      }

      onPreviewPanStart?.({
        clientX: event.clientX,
        clientY: event.clientY,
        pointerId: event.pointerId,
      });
    }

    function handlePanPointerEnd(event: PointerEvent) {
      if (!panInteractionRef.current || panInteractionRef.current.pointerId !== event.pointerId) {
        return;
      }

      panInteractionRef.current = null;
      updateMobileInteraction('idle', {
        activeTargetId: activeLayerId,
        pointerType: 'touch',
      });
      onPreviewPanEnd?.();
    }

    window.addEventListener('pointermove', handlePanPointerMove);
    window.addEventListener('pointerup', handlePanPointerEnd);
    window.addEventListener('pointercancel', handlePanPointerEnd);

    return () => {
      window.removeEventListener('pointermove', handlePanPointerMove);
      window.removeEventListener('pointerup', handlePanPointerEnd);
      window.removeEventListener('pointercancel', handlePanPointerEnd);
    };
  }, [activeLayerId, onPreviewPanEnd, onPreviewPanStart]);

  useEffect(() => {
    function handleSelectionPointerMove(event: PointerEvent) {
      if (!selectionInteractionRef.current || retouchMode !== 'select' || !selectionTargetRect) {
        return;
      }

      const point = getCanvasPoint(shellRef.current, width, height, event.clientX, event.clientY);

      if (!point || !selectionDraft) {
        return;
      }

      const nextDraft = {
        ...selectionDraft,
        endX: clamp(point.x, selectionTargetRect.x, selectionTargetRect.x + selectionTargetRect.width),
        endY: clamp(point.y, selectionTargetRect.y, selectionTargetRect.y + selectionTargetRect.height),
      };
      latestSelectionDraftRef.current = nextDraft;
      onSelectionDraftChange?.(nextDraft);
    }

    function handleSelectionPointerUp() {
      if (!selectionInteractionRef.current || retouchMode !== 'select') {
        return;
      }

      selectionInteractionRef.current = false;
      setIsInteracting(false);
      updateMobileInteraction('idle', {
        activeTargetId: activeLayerId,
      });
      if (latestSelectionDraftRef.current) {
        onSelectionDraftCommit?.(latestSelectionDraftRef.current);
      }
      window.setTimeout(() => {
        onDocumentInteractionEnd?.();
      }, 0);
    }

    window.addEventListener('pointermove', handleSelectionPointerMove);
    window.addEventListener('pointerup', handleSelectionPointerUp);

    return () => {
      window.removeEventListener('pointermove', handleSelectionPointerMove);
      window.removeEventListener('pointerup', handleSelectionPointerUp);
    };
  }, [
    activeLayerId,
    height,
    onDocumentInteractionEnd,
    onSelectionDraftChange,
    onSelectionDraftCommit,
    retouchMode,
    selectionDraft,
    selectionTargetRect,
    width,
  ]);

  useEffect(() => {
    if (!editingLayerId || textLayers.some((layer) => layer.id === editingLayerId)) {
      return;
    }

    setEditingLayerId(null);
  }, [editingLayerId, textLayers]);

  useEffect(() => {
    if (!editorRef.current || !editingLayerId) {
      return;
    }

    editorRef.current.focus();
    syncEditableText(
      editorRef.current,
      textLayers.find((layer) => layer.id === editingLayerId)?.text ?? '',
    );
    fitEditorTextToBounds(
      editorRef.current,
      textLayers.find((layer) => layer.id === editingLayerId) ?? null,
      previewZoomFactor,
    );
    moveCaretToEnd(editorRef.current);
  }, [editingLayerId, previewZoomFactor, textLayers]);

  useEffect(() => {
    if (!editingLayerId || !editorRef.current) {
      return;
    }

    const editingLayer = textLayers.find((layer) => layer.id === editingLayerId);

    if (!editingLayer) {
      return;
    }

    if (editorRef.current.innerText !== editingLayer.text) {
      syncEditableText(editorRef.current, editingLayer.text);
    }

    fitEditorTextToBounds(editorRef.current, editingLayer, previewZoomFactor);
  }, [editingLayerId, previewZoomFactor, textLayers]);

  useEffect(() => {
    function handleSceneCropPointerMove(event: PointerEvent) {
      updateSceneCrop(event.clientX, event.clientY);
    }

    function handleSceneCropMouseMove(event: MouseEvent) {
      updateSceneCrop(event.clientX, event.clientY);
    }

    function handleSceneCropPointerUp() {
      if (!isSceneCropMode) {
        return;
      }

      sceneCropInteractionRef.current = null;
      setIsInteracting(false);
      updateMobileInteraction('idle', {
        activeTargetId: activeLayerId,
      });
    }

    window.addEventListener('pointermove', handleSceneCropPointerMove);
    window.addEventListener('mousemove', handleSceneCropMouseMove);
    window.addEventListener('pointerup', handleSceneCropPointerUp);
    window.addEventListener('mouseup', handleSceneCropPointerUp);

    return () => {
      window.removeEventListener('pointermove', handleSceneCropPointerMove);
      window.removeEventListener('mousemove', handleSceneCropMouseMove);
      window.removeEventListener('pointerup', handleSceneCropPointerUp);
      window.removeEventListener('mouseup', handleSceneCropPointerUp);
    };
  }, [activeLayerId, height, isSceneCropMode, onSceneCropDraftChange, width]);

  useEffect(() => {
    function handleDrawPointerMove(event: PointerEvent) {
      if (
        !drawInteractionRef.current ||
        (retouchMode !== 'draw' && retouchMode !== 'erase' && retouchMode !== 'clone-stamp')
      ) {
        return;
      }

      const point = getCanvasPoint(shellRef.current, width, height, event.clientX, event.clientY);

      if (!point) {
        return;
      }

      onDraftStrokeChange?.({
        points: [...(draftStroke?.points ?? []), point],
        targetLayerId: draftStroke?.targetLayerId ?? null,
      });
    }

    function handleDrawPointerUp() {
      if (
        !drawInteractionRef.current ||
        (retouchMode !== 'draw' && retouchMode !== 'erase' && retouchMode !== 'clone-stamp')
      ) {
        return;
      }

      drawInteractionRef.current = false;
      setIsInteracting(false);
      updateMobileInteraction('idle', {
        activeTargetId: activeLayerId,
      });
      onDraftStrokeCommit?.();
      window.setTimeout(() => {
        onDocumentInteractionEnd?.();
      }, 0);
    }

    function handleDrawPointerCancel() {
      if (
        !drawInteractionRef.current ||
        (retouchMode !== 'draw' && retouchMode !== 'erase' && retouchMode !== 'clone-stamp')
      ) {
        return;
      }

      drawInteractionRef.current = false;
      setIsInteracting(false);
      updateMobileInteraction('idle', {
        activeTargetId: activeLayerId,
      });
      onDraftStrokeChange?.(null);
      window.setTimeout(() => {
        onDocumentInteractionEnd?.();
      }, 0);
    }

    window.addEventListener('pointermove', handleDrawPointerMove);
    window.addEventListener('pointerup', handleDrawPointerUp);
    window.addEventListener('pointercancel', handleDrawPointerCancel);

    return () => {
      window.removeEventListener('pointermove', handleDrawPointerMove);
      window.removeEventListener('pointerup', handleDrawPointerUp);
      window.removeEventListener('pointercancel', handleDrawPointerCancel);
    };
  }, [
    draftStroke?.points,
    draftStroke?.targetLayerId,
    activeLayerId,
    height,
    onDocumentInteractionEnd,
    onDraftStrokeChange,
    onDraftStrokeCommit,
    retouchMode,
    width,
  ]);

  useEffect(() => {
    function handleTouchGesturePointerMove(event: PointerEvent) {
      handleTrackedTouchGesturePointerMove(event);
    }

    function handleTouchGesturePointerEnd(event: PointerEvent) {
      handleTrackedTouchGesturePointerEnd(event);
    }

    window.addEventListener('pointermove', handleTouchGesturePointerMove);
    window.addEventListener('pointerup', handleTouchGesturePointerEnd);
    window.addEventListener('pointercancel', handleTouchGesturePointerEnd);

    return () => {
      window.removeEventListener('pointermove', handleTouchGesturePointerMove);
      window.removeEventListener('pointerup', handleTouchGesturePointerEnd);
      window.removeEventListener('pointercancel', handleTouchGesturePointerEnd);
    };
  }, [activeLayerId, onPreviewPanEnd, onPreviewPinchChange, onPreviewToggleFitActual, previewPan.x, previewPan.y, previewZoomFactor, retouchMode, isSceneCropMode, width, height]);

  useEffect(() => {
    window.addEventListener('pointermove', handleTouchLayerTransformPointerMove);
    window.addEventListener('pointerup', handleTouchLayerTransformPointerEnd);
    window.addEventListener('pointercancel', handleTouchLayerTransformPointerEnd);

    return () => {
      window.removeEventListener('pointermove', handleTouchLayerTransformPointerMove);
      window.removeEventListener('pointerup', handleTouchLayerTransformPointerEnd);
      window.removeEventListener('pointercancel', handleTouchLayerTransformPointerEnd);
    };
  }, [
    activeLayerId,
    height,
    layers,
    onActiveLayerChange,
    onDocumentInteractionEnd,
    onDocumentInteractionStart,
    onInlineTextEditStart,
    onLayerChange,
    width,
  ]);

  useEffect(() => {
    function handlePendingTouchTextEditMove(event: PointerEvent) {
      const pendingTouchEdit = pendingTouchTextEditRef.current;

      if (!pendingTouchEdit || pendingTouchEdit.pointerId !== event.pointerId || !shellRef.current) {
        return;
      }

      const movedEnough =
        Math.abs(event.clientX - pendingTouchEdit.startClientX) >= TOUCH_TEXT_EDIT_TAP_SLOP ||
        Math.abs(event.clientY - pendingTouchEdit.startClientY) >= TOUCH_TEXT_EDIT_TAP_SLOP;

      if (!movedEnough) {
        return;
      }

      const point = getCanvasPoint(shellRef.current, width, height, event.clientX, event.clientY);

      if (!point) {
        return;
      }

      pendingTouchTextEditRef.current = null;
      onDocumentInteractionStart?.();
      interactionRef.current = {
        type: 'move',
        layerId: pendingTouchEdit.layerId,
        startPointer: pendingTouchEdit.startPoint,
        startBox: pendingTouchEdit.startBox,
      };
      setIsInteracting(true);
      updateMobileInteraction('transform', {
        activeTargetId: pendingTouchEdit.layerId,
        pointerType: 'touch',
      });
      onLayerChange(
        pendingTouchEdit.layerId,
        {
          box: {
            ...pendingTouchEdit.startBox,
            x: pendingTouchEdit.startBox.x + (point.x - pendingTouchEdit.startPoint.x),
            y: pendingTouchEdit.startBox.y + (point.y - pendingTouchEdit.startPoint.y),
          },
        },
        'defer',
      );
    }

    function handlePendingTouchTextEditEnd(event: PointerEvent) {
      const pendingTouchEdit = pendingTouchTextEditRef.current;

      if (!pendingTouchEdit || pendingTouchEdit.pointerId !== event.pointerId) {
        return;
      }

      pendingTouchTextEditRef.current = null;
      clearActiveLayerOnTextBlurRef.current = false;
      onActiveLayerChange(pendingTouchEdit.layerId);
      onInlineTextEditStart?.();
      setEditingLayerId(pendingTouchEdit.layerId);
      updateMobileInteraction('focus-layer', {
        activeTargetId: pendingTouchEdit.layerId,
        pointerType: 'touch',
      });
    }

    function handlePendingTouchTextEditCancel(event: PointerEvent) {
      if (
        pendingTouchTextEditRef.current &&
        pendingTouchTextEditRef.current.pointerId === event.pointerId
      ) {
        pendingTouchTextEditRef.current = null;
      }
    }

    window.addEventListener('pointermove', handlePendingTouchTextEditMove);
    window.addEventListener('pointerup', handlePendingTouchTextEditEnd);
    window.addEventListener('pointercancel', handlePendingTouchTextEditCancel);

    return () => {
      window.removeEventListener('pointermove', handlePendingTouchTextEditMove);
      window.removeEventListener('pointerup', handlePendingTouchTextEditEnd);
      window.removeEventListener('pointercancel', handlePendingTouchTextEditCancel);
    };
  }, [
    height,
    onActiveLayerChange,
    onDocumentInteractionStart,
    onInlineTextEditStart,
    onLayerChange,
    width,
  ]);

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      if (!interactionRef.current || !shellRef.current) {
        return;
      }

      const point = getCanvasPoint(shellRef.current, width, height, event.clientX, event.clientY);

      if (!point) {
        return;
      }

      const interaction = interactionRef.current;
      const layer = layers.find((candidateLayer) => candidateLayer.id === interaction.layerId);

      if (!layer) {
        return;
      }

      if (interaction.type === 'move') {
        const moveDelta = isImageLayer(layer) && event.shiftKey
          ? getAxisLockedMoveDelta({
              x: point.x - interaction.startPointer.x,
              y: point.y - interaction.startPointer.y,
            })
          : {
              x: point.x - interaction.startPointer.x,
              y: point.y - interaction.startPointer.y,
            };

        onLayerChange(interaction.layerId, {
          box: {
            ...interaction.startBox,
            x: interaction.startBox.x + moveDelta.x,
            y: interaction.startBox.y + moveDelta.y,
          },
        }, 'defer');
        return;
      }

      if (interaction.type === 'resize') {
        const nextBox = isImageLayer(layer)
          ? resizeImageLayerBox({
              startBox: interaction.startBox,
              axisX: interaction.axisX,
              axisY: interaction.axisY,
              deltaX: point.x - interaction.startPointer.x,
              deltaY: point.y - interaction.startPointer.y,
              preserveAspectRatio: event.shiftKey,
            })
          : resizeBoxFromLocalAxes(
              interaction.startBox,
              interaction.axisX,
              interaction.axisY,
              point.x - interaction.startPointer.x,
              point.y - interaction.startPointer.y,
            );

        onLayerChange(interaction.layerId, {
          box: nextBox,
        }, 'defer');
        return;
      }

      if (interaction.type === 'rotate') {
        const center = getBoxCenter(layer.box);
        const currentAngle = Math.atan2(point.y - center.y, point.x - center.x);

        onLayerChange(interaction.layerId, {
          box: {
            ...layer.box,
            rotation: interaction.startRotation + (currentAngle - interaction.startAngle),
          },
        }, 'defer');
      }
    }

    function handlePointerUp() {
      if (interactionRef.current) {
        onDocumentInteractionEnd?.();
      }

      interactionRef.current = null;
      setIsInteracting(false);
      updateMobileInteraction('idle', {
        activeTargetId: activeLayerId,
      });
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [activeLayerId, height, layers, onDocumentInteractionEnd, onLayerChange, textLayers, width]);

  const isTouchFocusVisible =
    mobileInteraction.lastPointerType === 'touch' &&
    activeLayerId !== null &&
    retouchMode === 'idle' &&
    !isSceneCropMode;
  const isOverlayVisible =
    isStageHovered || isPreviewSurfaceHovered || isInteracting || editingLayerId !== null || isTouchFocusVisible;
  const normalizedSceneCropRect =
    isSceneCropMode && sceneCropDraft
      ? normalizeSceneCropRect(sceneCropDraft, { width, height })
      : null;
  const showLayerOverlay = !isSceneCropMode && retouchMode === 'idle' && isOverlayVisible;
  const normalizedSelectionDraft = selectionDraft
    ? normalizeSceneCropRect(selectionDraft, { width, height })
    : null;
  const visibleSelectionRect =
    normalizedSelectionDraft && normalizedSelectionDraft.width > 0 && normalizedSelectionDraft.height > 0
      ? normalizedSelectionDraft
      : selectionRect;
  const handleSize = resolveTouchHandleSize(mobileInteraction.lastPointerType);
  const handleOffset = Math.round(handleSize / 2);
  const cropInteractionGeometry = resolveSceneCropInteractionGeometry(
    mobileInteraction.lastPointerType,
  );
  const rotateSize = mobileInteraction.lastPointerType === 'touch' ? 28 : 20;
  const rotateOffset = mobileInteraction.lastPointerType === 'touch' ? 36 : 28;

  return (
    <div className="preview-viewport">
      <div
        ref={viewportRef}
        className="preview-viewport-content"
        style={{
          overscrollBehavior: 'contain',
          touchAction: 'none',
        }}
        onTouchStart={handlePreviewTouchStart}
        onTouchMove={handlePreviewTouchMove}
        onTouchEnd={handlePreviewTouchEnd}
        onTouchCancel={handlePreviewTouchEnd}
        onPointerDown={(event) => {
          const pointerType = resolveEventPointerType(event);
          if (
            !isSceneCropMode &&
            pointerType === 'touch' &&
            event.target === event.currentTarget
          ) {
            panInteractionRef.current = {
              pointerId: event.pointerId,
              startClientX: event.clientX,
              startClientY: event.clientY,
              moved: false,
            };
            updateMobileInteraction('pan', {
              activeTargetId: activeLayerId,
              pointerType: 'touch',
            });
            onPreviewPanStart?.({
              clientX: event.clientX,
              clientY: event.clientY,
              pointerId: event.pointerId,
            });
            return;
          }

          if (!isSceneCropMode) {
            return;
          }

          if (event.button === 1 || event.button === 2) {
            return;
          }

          event.preventDefault();
          updateMobileInteraction('crop', {
            activeTargetId: activeLayerId,
            pointerType: pointerType === 'touch' ? 'touch' : 'mouse',
          });
          startSceneCrop(event.clientX, event.clientY);
        }}
        onMouseDown={(event) => {
          if (!isSceneCropMode || event.button !== 0) {
            return;
          }

          event.preventDefault();
          startSceneCrop(event.clientX, event.clientY);
        }}
      >
        <div
          ref={shellRef}
          className={`preview-surface${isOverlayVisible ? ' preview-surface-overlay-visible' : ''}`}
          data-touch-mode={mobileInteraction.lastPointerType === 'touch'}
          style={{
            overscrollBehavior: 'contain',
            touchAction: 'none',
            transform: `translate(${previewPan.x}px, ${previewPan.y}px)`,
            width: `${width * previewZoomFactor}px`,
            height: `${height * previewZoomFactor}px`,
          }}
          onPointerEnter={() => setIsPreviewSurfaceHovered(true)}
          onPointerLeave={() => setIsPreviewSurfaceHovered(false)}
          onPointerMove={(event) => {
            handleTouchLayerTransformPointerMove(event);
            handleTrackedTouchGesturePointerMove(event);
          }}
          onPointerUp={(event) => {
            handleTouchLayerTransformPointerEnd(event);
            handleTrackedTouchGesturePointerEnd(event);
          }}
          onPointerCancel={(event) => {
            handleTouchLayerTransformPointerEnd(event);
            handleTrackedTouchGesturePointerEnd(event);
          }}
          onPointerDown={(event) => {
            const pointerType = resolveEventPointerType(event);
            if (pointerType === 'touch') {
              if (upgradeTouchLayerTransformSession(event.pointerId, event.clientX, event.clientY)) {
                event.preventDefault();
                return;
              }

              activePreviewTouchPointsRef.current.set(event.pointerId, {
                clientX: event.clientX,
                clientY: event.clientY,
              });

              if (startPreviewPinch()) {
                return;
              }
            }

            const pointerTarget = event.target instanceof Element ? event.target : null;
            const tappedInsideActiveTextEditingChrome = Boolean(
              pointerTarget?.closest('.transform-box-active') ||
              pointerTarget?.closest('.canvas-text-editor'),
            );
            const point = getCanvasPoint(shellRef.current, width, height, event.clientX, event.clientY);
            const targetLayer = point ? getTopLayerAtPoint(layers, point) : null;
            const mobileGestureOwner = resolveMobileGestureOwner({
              hasLayerAtPoint: Boolean(targetLayer),
              hasSelectionTarget: Boolean(selectionTargetRect),
              isSceneCropMode,
              pointerType,
              retouchMode,
              targetType: 'surface',
            });

            if (
              editingLayerId !== null &&
              activeLayer &&
              isTextLayer(activeLayer) &&
              !tappedInsideActiveTextEditingChrome
            ) {
              clearActiveLayerOnTextBlurRef.current = false;
              setEditingLayerId(null);
              updateMobileInteraction('idle', {
                activeTargetId: null,
                pointerType: pointerType === 'touch' ? 'touch' : mobileInteraction.lastPointerType,
              });
              onActiveLayerClear?.();
              return;
            }

            if (pointerType === 'touch' && mobileGestureOwner === 'pan') {
              panInteractionRef.current = {
                pointerId: event.pointerId,
                startClientX: event.clientX,
                startClientY: event.clientY,
                moved: false,
              };
              updateMobileInteraction('pan', {
                activeTargetId: activeLayerId,
                pointerType: 'touch',
              });
              onPreviewPanStart?.({
                clientX: event.clientX,
                clientY: event.clientY,
                pointerId: event.pointerId,
              });
              return;
            }

            if (retouchMode === 'eyedropper' && event.button !== 1 && event.button !== 2) {
              if (!point) {
                return;
              }

              event.preventDefault();
              setEditingLayerId(null);
              updateMobileInteraction('eyedropper', {
                activeTargetId: activeLayerId,
                pointerType: pointerType === 'touch' ? 'touch' : mobileInteraction.lastPointerType,
              });
              const sample = sampleCanvasPixel(resolvedCanvasRef.current, width, height, point);

              if (!sample) {
                return;
              }

              onRetouchBrushSample?.(sample);
              return;
            }

            if (retouchMode === 'select' && event.button !== 1 && event.button !== 2) {
              if (!point || !selectionTargetRect) {
                return;
              }

              event.preventDefault();
              selectionInteractionRef.current = true;
              setEditingLayerId(null);
              setIsInteracting(true);
              updateMobileInteraction('select', {
                activeTargetId: activeLayerId,
                pointerType: pointerType === 'touch' ? 'touch' : mobileInteraction.lastPointerType,
              });
              onDocumentInteractionStart?.();
              onSelectionDraftChange?.({
                startX: clamp(point.x, selectionTargetRect.x, selectionTargetRect.x + selectionTargetRect.width),
                startY: clamp(point.y, selectionTargetRect.y, selectionTargetRect.y + selectionTargetRect.height),
                endX: clamp(point.x, selectionTargetRect.x, selectionTargetRect.x + selectionTargetRect.width),
                endY: clamp(point.y, selectionTargetRect.y, selectionTargetRect.y + selectionTargetRect.height),
              });
              return;
            }

            const isCloneSourceSample =
              retouchMode === 'clone-stamp' &&
              event.button !== 1 &&
              event.button !== 2 &&
              (
                event.altKey ||
                event.nativeEvent.altKey ||
                event.getModifierState?.('Alt') ||
                altKeyPressedRef.current
              );

            if (isCloneSourceSample) {
              if (!point) {
                return;
              }

              event.preventDefault();
              setEditingLayerId(null);
              updateMobileInteraction('clone-stamp', {
                activeTargetId: activeLayerId,
                pointerType: pointerType === 'touch' ? 'touch' : mobileInteraction.lastPointerType,
              });
              onCloneStampSourceSet?.(point);
              return;
            }

            if (
              (retouchMode === 'draw' || retouchMode === 'erase' || retouchMode === 'clone-stamp') &&
              event.button !== 1 &&
              event.button !== 2
            ) {
              if (!point) {
                return;
              }

              event.preventDefault();
              drawInteractionRef.current = true;
              setEditingLayerId(null);
              setIsInteracting(true);
              updateMobileInteraction(retouchMode, {
                activeTargetId: activeLayerId,
                pointerType: pointerType === 'touch' ? 'touch' : mobileInteraction.lastPointerType,
              });
              onDocumentInteractionStart?.();
              onDraftStrokeChange?.({
                points: [point],
                targetLayerId: activeLayerId,
              });
              return;
            }

            if (event.button === 1 || event.button === 2) {
              return;
            }

            if (!point) {
              return;
            }

            if (!targetLayer) {
              if (activeLayer && isTextLayer(activeLayer)) {
                if (editingLayerId === activeLayer.id) {
                  clearActiveLayerOnTextBlurRef.current = true;
                }
                setEditingLayerId(null);
                updateMobileInteraction('idle', {
                  activeTargetId: null,
                  pointerType: pointerType === 'touch' ? 'touch' : mobileInteraction.lastPointerType,
                });
                onActiveLayerClear?.();
              }
              return;
            }

            if (event.target !== event.currentTarget) {
              return;
            }

            onActiveLayerChange(targetLayer.id);
            setEditingLayerId(null);
            updateMobileInteraction('focus-layer', {
              activeTargetId: targetLayer.id,
              pointerType: pointerType === 'touch' ? 'touch' : mobileInteraction.lastPointerType,
            });
          }}
        >
          <canvas
            ref={resolvedCanvasRef}
            width={width}
            height={height}
            aria-label="Meme preview canvas"
            className="preview-canvas"
          />
          {draftStroke && draftStroke.points.length > 0 ? (
            <svg
              className="draw-stroke-preview"
              aria-hidden="true"
              viewBox={`0 0 ${width} ${height}`}
              preserveAspectRatio="none"
              style={{
                position: 'absolute',
                inset: '0px',
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
              }}
            >
              <polyline
                fill="none"
                points={draftStroke.points.map((point) => `${point.x},${point.y}`).join(' ')}
                stroke={retouchMode === 'erase' ? '#ffffff' : retouchBrush.color}
                strokeOpacity={retouchBrush.opacity}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={retouchBrush.size}
                strokeDasharray={retouchMode === 'erase' ? '6 4' : undefined}
              />
            </svg>
          ) : null}
          {normalizedSceneCropRect ? (
            <div
              className={cropInteractionGeometry.overlayClassName}
              aria-hidden="true"
              style={getSceneCropOverlayStyle(
                normalizedSceneCropRect,
                width,
                height,
                cropInteractionGeometry,
              )}
            >
              <button
                type="button"
                className="scene-crop-hitbox"
                aria-label="Move crop selection"
                style={
                  cropInteractionGeometry.moveHitboxInset > 0
                    ? { inset: `${-cropInteractionGeometry.moveHitboxInset}px` }
                    : undefined
                }
                onPointerDown={(event) => {
                  const pointerType = resolveEventPointerType(event);
                  if (!normalizedSceneCropRect || event.button === 1 || event.button === 2) {
                    return;
                  }

                  const point = getCanvasPoint(shellRef.current, width, height, event.clientX, event.clientY);

                  if (!point) {
                    return;
                  }

                  event.preventDefault();
                  event.stopPropagation();
                  sceneCropInteractionRef.current = {
                    type: 'move',
                    startPointer: point,
                    startRect: normalizedSceneCropRect,
                  };
                  setEditingLayerId(null);
                  setIsInteracting(true);
                  updateMobileInteraction('crop', {
                    activeTargetId: activeLayerId,
                    pointerType: pointerType === 'touch' ? 'touch' : mobileInteraction.lastPointerType,
                  });
                }}
              />
              {RESIZE_HANDLES.map(({ axisX, axisY, className }) => (
                <button
                  key={`scene-crop-${axisX ?? 'center'}-${axisY ?? 'center'}`}
                  type="button"
                  className={`transform-handle ${className}`}
                  aria-label="Resize crop selection"
                  style={getHandleStyle(
                    className,
                    cropInteractionGeometry.handleSize,
                    cropInteractionGeometry.handleOffset,
                  )}
                  onPointerDown={(event) => {
                    const pointerType = resolveEventPointerType(event);
                    if (!normalizedSceneCropRect || event.button === 1 || event.button === 2) {
                      return;
                    }

                    const point = getCanvasPoint(shellRef.current, width, height, event.clientX, event.clientY);

                    if (!point) {
                      return;
                    }

                    event.preventDefault();
                    event.stopPropagation();
                    sceneCropInteractionRef.current = {
                      type: 'resize',
                      axisX,
                      axisY,
                      startPointer: point,
                      startRect: normalizedSceneCropRect,
                    };
                    setEditingLayerId(null);
                    setIsInteracting(true);
                    updateMobileInteraction('crop', {
                      activeTargetId: activeLayerId,
                      pointerType: pointerType === 'touch' ? 'touch' : mobileInteraction.lastPointerType,
                    });
                  }}
                />
              ))}
            </div>
          ) : null}
          {visibleSelectionRect ? (
            <div
              className="scene-crop-overlay selection-overlay"
              aria-hidden="true"
              style={getSceneCropOverlayStyle(visibleSelectionRect, width, height)}
            />
          ) : null}
          <div className="preview-overlay" aria-hidden="true">
            {!isSceneCropMode && (retouchMode === 'idle' || editingLayerId !== null) ? [...layers].reverse().map((layer) => {
              const isActive = layer.id === activeLayerId;
              const boxStyle = getOverlayBoxStyle(layer.box, width, height);
              const isEditing = isTextLayer(layer) && editingLayerId === layer.id;

              return (
                <div
                  key={layer.id}
                  className={`transform-box transform-box-${layer.kind}${isActive ? ' transform-box-active' : ''}`}
                  style={boxStyle}
                  onPointerDown={(event) => {
                    const pointerType = resolveEventPointerType(event);
                    if ((event.button === 1 || event.button === 2) || editingLayerId === layer.id) {
                      return;
                    }

                    if (pointerType === 'touch') {
                      if (
                        layer.id === activeLayerId &&
                        retouchMode === 'idle' &&
                        !isSceneCropMode &&
                        upgradeTouchLayerTransformSession(event.pointerId, event.clientX, event.clientY)
                      ) {
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                      }

                      activePreviewTouchPointsRef.current.set(event.pointerId, {
                        clientX: event.clientX,
                        clientY: event.clientY,
                      });

                      if (startPreviewPinch()) {
                        return;
                      }
                    }

                    event.preventDefault();
                    event.stopPropagation();
                    onActiveLayerChange(layer.id);
                    setEditingLayerId(null);
                    updateMobileInteraction('transform', {
                      activeTargetId: layer.id,
                      pointerType: pointerType === 'touch' ? 'touch' : mobileInteraction.lastPointerType,
                    });
                    const point = getCanvasPoint(shellRef.current, width, height, event.clientX, event.clientY);

                    if (!point) {
                      return;
                    }

                    if (pointerType === 'touch' && layer.id === activeLayerId) {
                      const fallbackStartPoint = getBoxCenter(layer.box);
                      const startPoint =
                        point && Number.isFinite(point.x) && Number.isFinite(point.y)
                          ? point
                          : fallbackStartPoint;
                      const startClientPoint =
                        isFiniteClientPoint(event.clientX, event.clientY)
                          ? { clientX: event.clientX, clientY: event.clientY }
                          : getClientPointFromCanvasPoint(
                              shellRef.current,
                              width,
                              height,
                              startPoint,
                            ) ?? { clientX: 0, clientY: 0 };

                      touchLayerTransformSessionRef.current = {
                        layerId: layer.id,
                        primaryPointerId: typeof event.pointerId === 'number' ? event.pointerId : 'touch-primary',
                        secondaryPointerId: null,
                        startBox: { ...layer.box },
                        primaryStartCanvasPoint: startPoint,
                        primaryCurrentClientPoint: startClientPoint,
                        secondaryCurrentClientPoint: null,
                        startMidpoint: null,
                        startDistance: null,
                        startAngle: null,
                        moved: false,
                        textEditableOnTap: isTextLayer(layer),
                      };
                      updateMobileInteraction('focus-layer', {
                        activeTargetId: layer.id,
                        pointerType: 'touch',
                      });
                      return;
                    }

                    onDocumentInteractionStart?.();
                    interactionRef.current = {
                      type: 'move',
                      layerId: layer.id,
                      startPointer: point,
                      startBox: { ...layer.box },
                    };
                    setIsInteracting(true);
                  }}
                  onDoubleClick={(event) => {
                    if (!isTextLayer(layer)) {
                      return;
                    }

                    event.preventDefault();
                    event.stopPropagation();
                    onActiveLayerChange(layer.id);
                    onInlineTextEditStart?.();
                    setEditingLayerId(layer.id);
                  }}
                >
                  {isEditing ? (
                    <div
                      ref={editorRef}
                      className="canvas-text-editor"
                      aria-label={`Edit ${layer.name}`}
                      contentEditable="plaintext-only"
                      suppressContentEditableWarning
                      style={getEditorTextStyle(layer, previewZoomFactor)}
                      onPointerDown={(event) => event.stopPropagation()}
                      onBlur={(event) => {
                      onLayerChange(layer.id, {
                          text: finalizeInlineEditorText(
                            (event.currentTarget as HTMLDivElement).innerText,
                          ),
                        }, 'defer');
                        if (clearActiveLayerOnTextBlurRef.current) {
                          clearActiveLayerOnTextBlurRef.current = false;
                          onActiveLayerClear?.();
                        }
                        setEditingLayerId(null);
                        onInlineTextEditEnd?.();
                      }}
                      onInput={(event) =>
                        onLayerChange(layer.id, {
                          text: normalizeInlineEditorInput(
                            (event.currentTarget as HTMLDivElement).innerText,
                          ),
                        }, 'defer')
                      }
                      onKeyDown={(event: ReactKeyboardEvent<HTMLDivElement>) => {
                        if (event.key === 'Escape') {
                          event.preventDefault();
                          onLayerChange(layer.id, {
                            text: finalizeInlineEditorText(
                              (event.currentTarget as HTMLDivElement).innerText,
                            ),
                          }, 'defer');
                          setEditingLayerId(null);
                          onInlineTextEditEnd?.();
                        }
                      }}
                    />
                  ) : null}
                  {showLayerOverlay ? (
                    <>
                      {RESIZE_HANDLES.map(({ axisX, axisY, className }) => (
                        <button
                          key={`${axisX ?? 'center'}-${axisY ?? 'center'}`}
                          type="button"
                          className={`transform-handle ${className}`}
                          style={getHandleStyle(className, handleSize, handleOffset)}
                          onPointerDown={(event) => {
                            const pointerType = resolveEventPointerType(event);
                            if (event.button === 1 || event.button === 2) {
                              return;
                            }

                            event.preventDefault();
                            event.stopPropagation();
                            const point = getCanvasPoint(
                              shellRef.current,
                              width,
                              height,
                              event.clientX,
                              event.clientY,
                            );

                            if (!point) {
                              return;
                            }

                            onActiveLayerChange(layer.id);
                            setEditingLayerId(null);
                            updateMobileInteraction('transform', {
                              activeTargetId: layer.id,
                              pointerType: pointerType === 'touch' ? 'touch' : mobileInteraction.lastPointerType,
                            });
                            onDocumentInteractionStart?.();
                            interactionRef.current = {
                              type: 'resize',
                              axisX,
                              axisY,
                              layerId: layer.id,
                              startPointer: point,
                              startBox: { ...layer.box },
                            };
                            setIsInteracting(true);
                          }}
                        />
                      ))}
                      <button
                        type="button"
                        className="transform-rotate"
                        style={getRotateHandleStyle(rotateSize, rotateOffset)}
                        onPointerDown={(event) => {
                          const pointerType = resolveEventPointerType(event);
                          if (event.button === 1 || event.button === 2) {
                            return;
                          }

                          event.preventDefault();
                          event.stopPropagation();
                          const point = getCanvasPoint(
                            shellRef.current,
                            width,
                            height,
                            event.clientX,
                            event.clientY,
                          );

                          if (!point) {
                            return;
                          }

                          const center = getBoxCenter(layer.box);
                          onActiveLayerChange(layer.id);
                          setEditingLayerId(null);
                          updateMobileInteraction('transform', {
                            activeTargetId: layer.id,
                            pointerType: pointerType === 'touch' ? 'touch' : mobileInteraction.lastPointerType,
                          });
                          onDocumentInteractionStart?.();

                          interactionRef.current = {
                            type: 'rotate',
                            layerId: layer.id,
                            startAngle: Math.atan2(point.y - center.y, point.x - center.x),
                            startRotation: layer.box.rotation,
                          };
                          setIsInteracting(true);
                        }}
                      >
                        ↻
                      </button>
                    </>
                  ) : null}
                </div>
              );
            }) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function getCanvasPoint(
  shell: HTMLDivElement | null,
  width: number,
  height: number,
  clientX: number,
  clientY: number,
) {
  if (!shell) {
    return null;
  }

  const rect = shell.getBoundingClientRect();
  const scaleX = width / rect.width;
  const scaleY = height / rect.height;

  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

function getBoxCenter(box: TextLayer['box']) {
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
}

function getTopLayerAtPoint(layers: EditorLayer[], point: Point) {
  return [...layers].reverse().find((layer) => isPointInsideBox(point, layer.box)) ?? null;
}

function isPointInsideBox(point: Point, box: EditorLayer['box']) {
  const center = getBoxCenter(box);
  const localPoint = rotatePoint(
    {
      x: point.x - center.x,
      y: point.y - center.y,
    },
    -box.rotation,
  );

  return (
    localPoint.x >= -box.width / 2 &&
    localPoint.x <= box.width / 2 &&
    localPoint.y >= -box.height / 2 &&
    localPoint.y <= box.height / 2
  );
}

function resizeBoxFromLocalAxes(
  startBox: TextBox,
  axisX: 'left' | 'right' | null,
  axisY: 'top' | 'bottom' | null,
  deltaX: number,
  deltaY: number,
) {
  const delta = rotatePoint({ x: deltaX, y: deltaY }, -startBox.rotation);
  let left = -startBox.width / 2;
  let right = startBox.width / 2;
  let top = -startBox.height / 2;
  let bottom = startBox.height / 2;

  if (axisX === 'left') {
    left += delta.x;
  } else if (axisX === 'right') {
    right += delta.x;
  }

  if (axisY === 'top') {
    top += delta.y;
  } else if (axisY === 'bottom') {
    bottom += delta.y;
  }

  if (right - left < MIN_BOX_WIDTH) {
    if (axisX === 'left') {
      left = right - MIN_BOX_WIDTH;
    } else if (axisX === 'right') {
      right = left + MIN_BOX_WIDTH;
    }
  }

  if (bottom - top < MIN_BOX_HEIGHT) {
    if (axisY === 'top') {
      top = bottom - MIN_BOX_HEIGHT;
    } else if (axisY === 'bottom') {
      bottom = top + MIN_BOX_HEIGHT;
    }
  }

  const centerOffsetLocal = {
    x: (left + right) / 2,
    y: (top + bottom) / 2,
  };
  const centerOffsetWorld = rotatePoint(centerOffsetLocal, startBox.rotation);
  const startCenter = getBoxCenter(startBox);
  const nextCenter = {
    x: startCenter.x + centerOffsetWorld.x,
    y: startCenter.y + centerOffsetWorld.y,
  };
  const width = right - left;
  const height = bottom - top;

  return {
    ...startBox,
    x: nextCenter.x - width / 2,
    y: nextCenter.y - height / 2,
    width,
    height,
  };
}

function rotatePoint(point: Point, angle: number) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}

function isFiniteClientPoint(clientX: number, clientY: number) {
  return Number.isFinite(clientX) && Number.isFinite(clientY);
}

function getClientPointFromCanvasPoint(
  shell: HTMLDivElement | null,
  width: number,
  height: number,
  point: Point,
) {
  if (!shell) {
    return null;
  }

  const rect = shell.getBoundingClientRect();

  if (rect.width === 0 || rect.height === 0) {
    return null;
  }

  return {
    clientX: rect.left + (point.x / width) * rect.width,
    clientY: rect.top + (point.y / height) * rect.height,
  };
}

function getOverlayBoxStyle(box: TextLayer['box'], canvasWidth: number, canvasHeight: number) {
  return {
    left: `${(box.x / canvasWidth) * 100}%`,
    top: `${(box.y / canvasHeight) * 100}%`,
    width: `${(box.width / canvasWidth) * 100}%`,
    height: `${(box.height / canvasHeight) * 100}%`,
    transform: `rotate(${box.rotation}rad)`,
  };
}

function getHandleStyle(className: string, handleSize: number, handleOffset: number) {
  const style: Record<string, string> = {
    width: `${handleSize}px`,
    height: `${handleSize}px`,
  };

  if (className.includes('top-left')) {
    style.left = `${-handleOffset}px`;
    style.top = `${-handleOffset}px`;
  } else if (className.includes('top-right')) {
    style.right = `${-handleOffset}px`;
    style.top = `${-handleOffset}px`;
  } else if (className.includes('bottom-left')) {
    style.left = `${-handleOffset}px`;
    style.bottom = `${-handleOffset}px`;
  } else if (className.includes('bottom-right')) {
    style.right = `${-handleOffset}px`;
    style.bottom = `${-handleOffset}px`;
  } else if (className.includes('edge-top')) {
    style.left = `calc(50% - ${handleOffset}px)`;
    style.top = `${-handleOffset}px`;
  } else if (className.includes('edge-right')) {
    style.right = `${-handleOffset}px`;
    style.top = `calc(50% - ${handleOffset}px)`;
  } else if (className.includes('edge-bottom')) {
    style.left = `calc(50% - ${handleOffset}px)`;
    style.bottom = `${-handleOffset}px`;
  } else if (className.includes('edge-left')) {
    style.left = `${-handleOffset}px`;
    style.top = `calc(50% - ${handleOffset}px)`;
  }

  return style;
}

function getRotateHandleStyle(rotateSize: number, rotateOffset: number) {
  return {
    width: `${rotateSize}px`,
    height: `${rotateSize}px`,
    bottom: `${-rotateOffset}px`,
  };
}

function getSceneCropOverlayStyle(
  cropRect: { x: number; y: number; width: number; height: number },
  canvasWidth: number,
  canvasHeight: number,
  geometry?: {
    overlayBorderWidth: number;
    overlayFill: string;
  },
) {
  return {
    background: geometry?.overlayFill,
    borderWidth: `${geometry?.overlayBorderWidth ?? 1}px`,
    left: `${(cropRect.x / canvasWidth) * 100}%`,
    top: `${(cropRect.y / canvasHeight) * 100}%`,
    width: `${(cropRect.width / canvasWidth) * 100}%`,
    height: `${(cropRect.height / canvasHeight) * 100}%`,
  };
}

function toSceneCropDraftRect(rect: NormalizedSceneCropRect): SceneCropDraftRect {
  return {
    startX: rect.x,
    startY: rect.y,
    endX: rect.x + rect.width,
    endY: rect.y + rect.height,
  };
}

function moveSceneCropRect(
  rect: NormalizedSceneCropRect,
  delta: Point,
  canvasSize: { width: number; height: number },
) {
  const x = clamp(rect.x + delta.x, 0, canvasSize.width - rect.width);
  const y = clamp(rect.y + delta.y, 0, canvasSize.height - rect.height);

  return {
    ...rect,
    x,
    y,
  };
}

function resizeSceneCropRect(
  startRect: NormalizedSceneCropRect,
  axisX: 'left' | 'right' | null,
  axisY: 'top' | 'bottom' | null,
  delta: Point,
  canvasSize: { width: number; height: number },
) {
  let left = startRect.x;
  let top = startRect.y;
  let right = startRect.x + startRect.width;
  let bottom = startRect.y + startRect.height;

  if (axisX === 'left') {
    left += delta.x;
  } else if (axisX === 'right') {
    right += delta.x;
  }

  if (axisY === 'top') {
    top += delta.y;
  } else if (axisY === 'bottom') {
    bottom += delta.y;
  }

  const normalized = normalizeSceneCropRect(
    {
      startX: left,
      startY: top,
      endX: right,
      endY: bottom,
    },
    canvasSize,
  );

  return {
    x: normalized.x,
    y: normalized.y,
    width: Math.max(1, normalized.width),
    height: Math.max(1, normalized.height),
  };
}

function getEditorTextStyle(layer: TextLayer, previewZoomFactor = 1) {
  const metrics = getTextLayoutMetrics(layer);
  const computedTextAlign =
    layer.textAlign === 'left' ? 'left' : layer.textAlign === 'right' ? 'right' : 'center';
  const zoom = Math.max(0.1, previewZoomFactor);

  if (!metrics) {
    return {
      color: layer.fillStyle,
      fontFamily: layer.fontFamily,
      fontSize: `${Math.max(8, layer.fontSize) * zoom}px`,
      fontStyle: layer.italic ? 'italic' : 'normal',
      fontWeight: layer.bold ? '900' : '400',
      inset: '0',
      lineHeight: `${1.04 * zoom}`,
      position: 'absolute',
      textAlign: computedTextAlign,
      textTransform: layer.allCaps ? 'uppercase' : 'none',
    } as const;
  }

  const topOffset = Math.max(0, Math.round(metrics.drawY + layer.box.height / 2));
  const availableHeight = Math.max(
    metrics.lineHeight,
    Math.round(layer.box.height - topOffset - metrics.paddingY),
  );

  return {
    color: layer.fillStyle,
    fontFamily: layer.fontFamily,
    fontSize: `${metrics.fontSize * zoom}px`,
    fontStyle: layer.italic ? 'italic' : 'normal',
    fontWeight: layer.bold ? '900' : '400',
    height: `${availableHeight * zoom}px`,
    left: `${metrics.paddingX * zoom}px`,
    lineHeight: `${metrics.lineHeight * zoom}px`,
    maxHeight: `${availableHeight * zoom}px`,
    position: 'absolute',
    textAlign: computedTextAlign,
    textTransform: layer.allCaps ? 'uppercase' : 'none',
    top: `${topOffset * zoom}px`,
    width: `${metrics.innerWidth * zoom}px`,
  } as const;
}

function syncEditableText(element: HTMLDivElement, text: string) {
  element.innerText = text;
}

export function normalizeInlineEditorInput(text: string) {
  return text.replace(/\r\n/g, '\n');
}

export function finalizeInlineEditorText(text: string) {
  return normalizeInlineEditorInput(text).replace(/\n+$/, '');
}

function fitEditorTextToBounds(
  element: HTMLDivElement,
  layer: TextLayer | null,
  previewZoomFactor: number,
) {
  if (!layer) {
    return;
  }

  const baseMetrics = getTextLayoutMetrics({
    ...layer,
    text: finalizeInlineEditorText(element.innerText || layer.text),
  });

  if (!baseMetrics) {
    return;
  }

  const zoom = Math.max(0.1, previewZoomFactor);
  let fontSize = Math.max(8 * zoom, baseMetrics.fontSize * zoom);
  let lineHeight = Math.max(1, baseMetrics.lineHeight * zoom);

  element.style.fontSize = `${fontSize}px`;
  element.style.lineHeight = `${lineHeight}px`;

  while (
    fontSize > 8 &&
    (element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth)
  ) {
    fontSize -= 1;
    lineHeight = Math.max(1, Math.round(fontSize * 1.02));
    element.style.fontSize = `${fontSize}px`;
    element.style.lineHeight = `${lineHeight}px`;
  }
}

function moveCaretToEnd(element: HTMLDivElement) {
  const selection = window.getSelection();

  if (!selection) {
    return;
  }

  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function sampleCanvasPixel(
  canvas: HTMLCanvasElement | null,
  width: number,
  height: number,
  point: Point,
) {
  if (!canvas) {
    return null;
  }

  const context = canvas.getContext('2d');

  if (!context) {
    return null;
  }

  const x = clamp(Math.round(point.x), 0, Math.max(0, width - 1));
  const y = clamp(Math.round(point.y), 0, Math.max(0, height - 1));
  const data = context.getImageData(x, y, 1, 1).data;
  const red = data[0] ?? 0;
  const green = data[1] ?? 0;
  const blue = data[2] ?? 0;
  const alpha = data[3] ?? 255;

  return {
    color: rgbToHex(red, green, blue),
    opacity: Number((alpha / 255).toFixed(2)),
  };
}

function rgbToHex(red: number, green: number, blue: number) {
  return `#${toHexChannel(red)}${toHexChannel(green)}${toHexChannel(blue)}`;
}

function toHexChannel(value: number) {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0');
}
