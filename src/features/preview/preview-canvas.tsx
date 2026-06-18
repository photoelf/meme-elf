import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
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
} | null;
type PendingTouchTextEditInteraction = {
  layerId: LayerId;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startPoint: Point;
  startBox: EditorLayer['box'];
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
  const pendingTouchTextEditRef = useRef<PendingTouchTextEditInteraction>(null);
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
    );
  }, [
    editingLayerId,
    height,
    image,
    layers,
    resolvedCanvasRef,
    sceneEffectStack,
    sceneImageAdjustments,
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
        onPointerDown={(event) => {
          const pointerType = resolveEventPointerType(event);
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
          onPointerDown={(event) => {
            const pointerType = resolveEventPointerType(event);
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
              panInteractionRef.current = { pointerId: event.pointerId };
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

                    if (
                      pointerType === 'touch' &&
                      isTextLayer(layer) &&
                      layer.id === activeLayerId
                    ) {
                      pendingTouchTextEditRef.current = {
                        layerId: layer.id,
                        pointerId: event.pointerId,
                        startClientX: event.clientX,
                        startClientY: event.clientY,
                        startPoint: point,
                        startBox: { ...layer.box },
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
