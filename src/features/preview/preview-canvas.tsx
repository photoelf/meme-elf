import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';

import type { LayerId, TextLayer } from '../../app/types';
import { getTextLayoutMetrics, renderPreview } from '../canvas/canvas-renderer';

type PreviewCanvasProps = {
  activeLayerId: LayerId | null;
  canvasRef?: RefObject<HTMLCanvasElement | null>;
  image: HTMLImageElement | null;
  width: number;
  height: number;
  layers: TextLayer[];
  onActiveLayerChange: (layerId: LayerId) => void;
  onLayerChange: (layerId: LayerId, updates: Partial<TextLayer>) => void;
};

type InteractionMode =
  | { type: 'move'; layerId: LayerId; startPointer: Point; startBox: TextLayer['box'] }
  | {
      type: 'resize';
      axisX: 'left' | 'right' | null;
      axisY: 'top' | 'bottom' | null;
      layerId: LayerId;
      startPointer: Point;
      startBox: TextLayer['box'];
    }
  | { type: 'rotate'; layerId: LayerId; startAngle: number; startRotation: number }
  | null;

type Point = { x: number; y: number };
type ResizeHandle = {
  axisX: 'left' | 'right' | null;
  axisY: 'top' | 'bottom' | null;
  className: string;
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
  width,
  height,
  layers,
  onActiveLayerChange,
  onLayerChange,
}: PreviewCanvasProps) {
  const internalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const interactionRef = useRef<InteractionMode>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const resolvedCanvasRef = canvasRef ?? internalCanvasRef;
  const [isPointerInside, setIsPointerInside] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const [editingLayerId, setEditingLayerId] = useState<LayerId | null>(null);

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

    renderPreview(context, image, { width, height }, layers);
  }, [height, image, layers, resolvedCanvasRef, width]);

  useEffect(() => {
    if (!editingLayerId || layers.some((layer) => layer.id === editingLayerId)) {
      return;
    }

    setEditingLayerId(null);
  }, [editingLayerId, layers]);

  useEffect(() => {
    if (!editorRef.current || !editingLayerId) {
      return;
    }

    editorRef.current.focus();
    syncEditableText(editorRef.current, layers.find((layer) => layer.id === editingLayerId)?.text ?? '');
    moveCaretToEnd(editorRef.current);
  }, [editingLayerId]);

  useEffect(() => {
    if (!editingLayerId || !editorRef.current) {
      return;
    }

    const editingLayer = layers.find((layer) => layer.id === editingLayerId);

    if (!editingLayer) {
      return;
    }

    if (editorRef.current.innerText !== editingLayer.text) {
      syncEditableText(editorRef.current, editingLayer.text);
    }
  }, [editingLayerId, layers]);

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

      if (interaction.type === 'move') {
        const deltaX = point.x - interaction.startPointer.x;
        const deltaY = point.y - interaction.startPointer.y;

        onLayerChange(interaction.layerId, {
          box: {
            ...interaction.startBox,
            x: interaction.startBox.x + deltaX,
            y: interaction.startBox.y + deltaY,
          },
        });
        return;
      }

      if (interaction.type === 'resize') {
        const nextBox = resizeBoxFromLocalAxes(
          interaction.startBox,
          interaction.axisX,
          interaction.axisY,
          point.x - interaction.startPointer.x,
          point.y - interaction.startPointer.y,
        );

        onLayerChange(interaction.layerId, {
          box: nextBox,
        });
        return;
      }

      if (interaction.type === 'rotate') {
        const layer = layers.find((candidateLayer) => candidateLayer.id === interaction.layerId);

        if (!layer) {
          return;
        }

        const center = getBoxCenter(layer.box);
        const currentAngle = Math.atan2(point.y - center.y, point.x - center.x);

        onLayerChange(interaction.layerId, {
          box: {
            ...layer.box,
            rotation: interaction.startRotation + (currentAngle - interaction.startAngle),
          },
        });
      }
    }

    function handlePointerUp() {
      interactionRef.current = null;
      setIsInteracting(false);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [height, layers, onLayerChange, width]);

  const isOverlayVisible = isPointerInside || isInteracting || editingLayerId !== null;

  return (
    <div
      ref={shellRef}
      className={`preview-surface${isOverlayVisible ? ' preview-surface-overlay-visible' : ''}`}
      onPointerEnter={() => setIsPointerInside(true)}
      onPointerLeave={() => setIsPointerInside(false)}
    >
      <canvas
        ref={resolvedCanvasRef}
        width={width}
        height={height}
        aria-label="Meme preview canvas"
        className="preview-canvas"
      />
      <div className="preview-overlay" aria-hidden="true">
        {[...layers].reverse().map((layer) => {
          const isActive = layer.id === activeLayerId;
          const boxStyle = getOverlayBoxStyle(layer.box, width, height);
          const isEditing = editingLayerId === layer.id;

          return (
            <div
              key={layer.id}
              className={`transform-box${isActive ? ' transform-box-active' : ''}`}
              style={boxStyle}
              onPointerDown={(event) => {
                if (editingLayerId === layer.id) {
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

                interactionRef.current = {
                  type: 'move',
                  layerId: layer.id,
                  startPointer: point,
                  startBox: { ...layer.box },
                };
                setIsInteracting(true);
              }}
              onDoubleClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onActiveLayerChange(layer.id);
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
                  style={getEditorTextStyle(layer)}
                  onPointerDown={(event) => event.stopPropagation()}
                  onBlur={() => setEditingLayerId(null)}
                  onInput={(event) =>
                    onLayerChange(layer.id, { text: (event.currentTarget as HTMLDivElement).innerText })
                  }
                  onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      setEditingLayerId(null);
                    }
                  }}
                />
              ) : null}
              {isOverlayVisible ? (
                <>
                  {RESIZE_HANDLES.map(({ axisX, axisY, className }) => (
                    <button
                      key={`${axisX ?? 'center'}-${axisY ?? 'center'}`}
                      type="button"
                      className={`transform-handle ${className}`}
                      onPointerDown={(event) => {
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
        })}
      </div>
    </div>
  );
}

function getCanvasPoint(
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

function resizeBoxFromLocalAxes(
  startBox: TextLayer['box'],
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

function getEditorTextStyle(layer: TextLayer) {
  const metrics = getTextLayoutMetrics(layer);
  const computedTextAlign =
    layer.textAlign === 'left' ? 'left' : layer.textAlign === 'right' ? 'right' : 'center';

  if (!metrics) {
    return {
      color: layer.fillStyle,
      fontFamily: layer.fontFamily,
      fontSize: `${Math.max(16, Math.min(layer.fontSize, layer.box.height - 12))}px`,
      fontStyle: layer.italic ? 'italic' : 'normal',
      fontWeight: layer.bold ? '900' : '400',
      textAlign: computedTextAlign,
      textTransform: layer.allCaps ? 'uppercase' : 'none',
    } as const;
  }

  const topOffset = Math.max(0, metrics.drawY + layer.box.height / 2);

  return {
    color: layer.fillStyle,
    fontFamily: layer.fontFamily,
    fontSize: `${metrics.fontSize}px`,
    fontStyle: layer.italic ? 'italic' : 'normal',
    fontWeight: layer.bold ? '900' : '400',
    textAlign: computedTextAlign,
    textTransform: layer.allCaps ? 'uppercase' : 'none',
    paddingTop: `${topOffset}px`,
    paddingRight: `${metrics.paddingX}px`,
    paddingBottom: `${metrics.paddingY}px`,
    paddingLeft: `${metrics.paddingX}px`,
    lineHeight: `${metrics.lineHeight}px`,
  } as const;
}

function syncEditableText(element: HTMLDivElement, text: string) {
  element.innerText = text;
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
