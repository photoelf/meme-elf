import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';

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
import { normalizeSceneCropRect } from '../bounds/crop-overlay';
import { isImageLayer, isTextLayer } from '../../app/types';
import type {
  DrawPoint,
  EditorLayer,
  LayerId,
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

type PreviewCanvasProps = {
  activeLayerId: LayerId | null;
  canvasRef?: RefObject<HTMLCanvasElement | null>;
  image: HTMLImageElement | null;
  isStageHovered: boolean;
  width: number;
  height: number;
  layers: EditorLayer[];
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
  onRetouchBrushSample?: (sample: { color: string; opacity: number }) => void;
  onInlineTextEditEnd?: () => void;
  onInlineTextEditStart?: () => void;
  onActiveLayerChange: (layerId: LayerId) => void;
  onLayerChange: (
    layerId: LayerId,
    updates: Partial<EditorLayer>,
    historyMode?: 'immediate' | 'defer',
  ) => void;
  onSceneCropDraftChange?: (draft: SceneCropDraftRect | null) => void;
  draftStroke?: { points: DrawPoint[]; targetLayerId: LayerId | null } | null;
  retouchMode?: 'idle' | 'draw' | 'erase' | 'eyedropper' | 'select';
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
  onRetouchBrushSample,
  onInlineTextEditEnd,
  onInlineTextEditStart,
  onActiveLayerChange,
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
  const selectionInteractionRef = useRef(false);
  const latestSelectionDraftRef = useRef<SelectionDraftRect | null>(selectionDraft);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const resolvedCanvasRef = canvasRef ?? internalCanvasRef;
  const [isInteracting, setIsInteracting] = useState(false);
  const [editingLayerId, setEditingLayerId] = useState<LayerId | null>(null);
  const [isPreviewSurfaceHovered, setIsPreviewSurfaceHovered] = useState(false);
  const textLayers = getTextLayers(layers);

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
  }, [height, isSceneCropMode, onSceneCropDraftChange, width]);

  useEffect(() => {
    function handleDrawPointerMove(event: PointerEvent) {
      if (!drawInteractionRef.current || (retouchMode !== 'draw' && retouchMode !== 'erase')) {
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
      if (!drawInteractionRef.current || (retouchMode !== 'draw' && retouchMode !== 'erase')) {
        return;
      }

      drawInteractionRef.current = false;
      setIsInteracting(false);
      onDraftStrokeCommit?.();
      window.setTimeout(() => {
        onDocumentInteractionEnd?.();
      }, 0);
    }

    function handleDrawPointerCancel() {
      if (!drawInteractionRef.current || (retouchMode !== 'draw' && retouchMode !== 'erase')) {
        return;
      }

      drawInteractionRef.current = false;
      setIsInteracting(false);
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
    height,
    onDocumentInteractionEnd,
    onDraftStrokeChange,
    onDraftStrokeCommit,
    retouchMode,
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
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [height, layers, onDocumentInteractionEnd, onLayerChange, textLayers, width]);

  const isOverlayVisible =
    isStageHovered || isPreviewSurfaceHovered || isInteracting || editingLayerId !== null;
  const normalizedSceneCropRect =
    isSceneCropMode && sceneCropDraft
      ? normalizeSceneCropRect(sceneCropDraft, { width, height })
      : null;
  const showLayerOverlay = !isSceneCropMode && retouchMode === 'idle' && isOverlayVisible;
  const normalizedSelectionDraft = selectionDraft
    ? normalizeSceneCropRect(selectionDraft, { width, height })
    : null;
  const visibleSelectionRect =
    retouchMode === 'select'
      ? normalizedSelectionDraft && normalizedSelectionDraft.width > 0 && normalizedSelectionDraft.height > 0
        ? normalizedSelectionDraft
        : selectionRect
      : null;

  return (
    <div className="preview-viewport">
      <div
        ref={viewportRef}
        className="preview-viewport-content"
        onPointerDown={(event) => {
          if (!isSceneCropMode) {
            return;
          }

          if (event.button === 1 || event.button === 2) {
            return;
          }

          event.preventDefault();
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
          style={{
            transform: `translate(${previewPan.x}px, ${previewPan.y}px)`,
            width: `${width * previewZoomFactor}px`,
            height: `${height * previewZoomFactor}px`,
          }}
          onPointerEnter={() => setIsPreviewSurfaceHovered(true)}
          onPointerLeave={() => setIsPreviewSurfaceHovered(false)}
          onPointerDown={(event) => {
            if (retouchMode === 'eyedropper' && event.button !== 1 && event.button !== 2) {
              const point = getCanvasPoint(shellRef.current, width, height, event.clientX, event.clientY);

              if (!point) {
                return;
              }

              event.preventDefault();
              setEditingLayerId(null);
              const sample = sampleCanvasPixel(resolvedCanvasRef.current, width, height, point);

              if (!sample) {
                return;
              }

              onRetouchBrushSample?.(sample);
              return;
            }

            if (retouchMode === 'select' && event.button !== 1 && event.button !== 2) {
              const point = getCanvasPoint(shellRef.current, width, height, event.clientX, event.clientY);

              if (!point || !selectionTargetRect) {
                return;
              }

              event.preventDefault();
              selectionInteractionRef.current = true;
              setEditingLayerId(null);
              setIsInteracting(true);
              onDocumentInteractionStart?.();
              onSelectionDraftChange?.({
                startX: clamp(point.x, selectionTargetRect.x, selectionTargetRect.x + selectionTargetRect.width),
                startY: clamp(point.y, selectionTargetRect.y, selectionTargetRect.y + selectionTargetRect.height),
                endX: clamp(point.x, selectionTargetRect.x, selectionTargetRect.x + selectionTargetRect.width),
                endY: clamp(point.y, selectionTargetRect.y, selectionTargetRect.y + selectionTargetRect.height),
              });
              return;
            }

            if ((retouchMode === 'draw' || retouchMode === 'erase') && event.button !== 1 && event.button !== 2) {
              const point = getCanvasPoint(shellRef.current, width, height, event.clientX, event.clientY);

              if (!point) {
                return;
              }

              event.preventDefault();
              drawInteractionRef.current = true;
              setEditingLayerId(null);
              setIsInteracting(true);
              onDocumentInteractionStart?.();
              onDraftStrokeChange?.({
                points: [point],
                targetLayerId: activeLayerId,
              });
              return;
            }

            if ((event.button === 1 || event.button === 2) || event.target !== event.currentTarget) {
              return;
            }

            const point = getCanvasPoint(shellRef.current, width, height, event.clientX, event.clientY);

            if (!point) {
              return;
            }

            const targetLayer = getTopLayerAtPoint(layers, point);

            if (!targetLayer) {
              return;
            }

            onActiveLayerChange(targetLayer.id);
            setEditingLayerId(null);
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
              className="scene-crop-overlay"
              aria-hidden="true"
              style={getSceneCropOverlayStyle(normalizedSceneCropRect, width, height)}
            >
              <button
                type="button"
                className="scene-crop-hitbox"
                aria-label="Move crop selection"
                onPointerDown={(event) => {
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
                }}
              />
              {RESIZE_HANDLES.map(({ axisX, axisY, className }) => (
                <button
                  key={`scene-crop-${axisX ?? 'center'}-${axisY ?? 'center'}`}
                  type="button"
                  className={`transform-handle ${className}`}
                  aria-label="Resize crop selection"
                  onPointerDown={(event) => {
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
                    if ((event.button === 1 || event.button === 2) || editingLayerId === layer.id) {
                      return;
                    }

                    event.preventDefault();
                    event.stopPropagation();
                    onActiveLayerChange(layer.id);
                    setEditingLayerId(null);
                    const point = getCanvasPoint(shellRef.current, width, height, event.clientX, event.clientY);

                    if (!point) {
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
                      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
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
                          onPointerDown={(event) => {
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
                        onPointerDown={(event) => {
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

function getSceneCropOverlayStyle(
  cropRect: { x: number; y: number; width: number; height: number },
  canvasWidth: number,
  canvasHeight: number,
) {
  return {
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
