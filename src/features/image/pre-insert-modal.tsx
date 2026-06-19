import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  normalizeCropDraftBox,
  resolvePreparedOutputDimensions,
  type NormalizedCropBox,
} from './image-crop-utils';
import type {
  AdvancedImportPlacementMode,
  CropDraftBox,
  PreInsertModalDraft,
} from '../../app/types';

type PreInsertModalProps = {
  confirmLabel?: string;
  copy?: string;
  draft: PreInsertModalDraft;
  heading?: string;
  isCropMode: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onFlipHorizontal: () => void;
  onFlipVertical: () => void;
  onPlacementModeChange?: (mode: AdvancedImportPlacementMode) => void;
  onCropBoxChange?: (cropBox: CropDraftBox | null) => void;
  onRotateClockwise: () => void;
  onRotateCounterClockwise: () => void;
  restoreFocusTo?: HTMLElement | null;
};

type CropHandle = 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left';
type CropInteraction =
  | { type: 'new'; startX: number; startY: number }
  | { type: 'move'; startX: number; startY: number; cropBox: NormalizedCropBox }
  | {
      type: 'resize';
      handle: CropHandle;
      startX: number;
      startY: number;
      cropBox: NormalizedCropBox;
    };

export function PreInsertModal({
  confirmLabel = 'Confirm',
  copy = 'Prepare the incoming image before it enters the editor.',
  draft,
  heading = 'Prepare image',
  isCropMode,
  onCancel,
  onConfirm,
  onFlipHorizontal,
  onFlipVertical,
  onPlacementModeChange,
  onCropBoxChange,
  onRotateClockwise,
  onRotateCounterClockwise,
  restoreFocusTo,
}: PreInsertModalProps) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cropInteractionRef = useRef<CropInteraction | null>(null);
  const isAdvancedImport = draft.pendingSource.sourceKind !== 'upload-image';
  const supportsCropMode = !isCoarsePointerEnvironment();
  const effectiveCropMode = supportsCropMode && isCropMode;
  const previewSize = resolvePreparedOutputDimensions({
    sourceSize: draft.pendingSource.sourceSize,
    cropBox: draft.cropBox,
    rotationQuarterTurns: draft.rotationQuarterTurns,
  });
  const previewCanvasSize = getPreviewCanvasSize(
    draft.pendingSource.sourceSize,
    draft.rotationQuarterTurns,
  );
  const cropOverlayStyle = draft.cropBox
    ? getCropOverlayStyle({
        cropBox: draft.cropBox,
        sourceSize: draft.pendingSource.sourceSize,
        rotationQuarterTurns: draft.rotationQuarterTurns,
        flipHorizontal: draft.flipHorizontal,
        flipVertical: draft.flipVertical,
      })
    : null;
  useEffect(() => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();

    return () => {
      const nextFocusTarget =
        restoreFocusTo?.isConnected ? restoreFocusTo : previousFocusRef.current;

      if (nextFocusTarget?.isConnected) {
        nextFocusTarget.focus();
      }
    };
  }, [restoreFocusTo]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.defaultPrevented) {
        return;
      }

      event.preventDefault();
      onCancel();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  useEffect(() => {
    const previewCanvas = previewCanvasRef.current;

    if (!previewCanvas) {
      return;
    }

    const context = previewCanvas.getContext('2d');

    if (!context) {
      return;
    }

    previewCanvas.width = previewCanvasSize.width;
    previewCanvas.height = previewCanvasSize.height;
    context.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

    if (!draft.pendingSource.image) {
      return;
    }

    const previewScale = getPreviewCanvasScale(
      draft.pendingSource.sourceSize,
      draft.rotationQuarterTurns,
    );
    const drawWidth = Math.round(draft.pendingSource.sourceSize.width * previewScale);
    const drawHeight = Math.round(draft.pendingSource.sourceSize.height * previewScale);

    context.save();
    context.translate(previewCanvas.width / 2, previewCanvas.height / 2);
    context.scale(draft.flipHorizontal ? -1 : 1, draft.flipVertical ? -1 : 1);
    context.rotate((draft.rotationQuarterTurns * Math.PI) / 2);
    context.drawImage(
      draft.pendingSource.image,
      Math.round(-drawWidth / 2),
      Math.round(-drawHeight / 2),
      drawWidth,
      drawHeight,
    );
    context.restore();
  }, [
    draft.flipHorizontal,
    draft.flipVertical,
    draft.pendingSource.image,
    draft.pendingSource.sourceSize.height,
    draft.pendingSource.sourceSize.width,
    draft.rotationQuarterTurns,
    previewCanvasSize.height,
    previewCanvasSize.width,
  ]);

  useEffect(() => {
    function handleMouseMove(event: MouseEvent) {
      if (!effectiveCropMode || !cropInteractionRef.current) {
        return;
      }

      const sourcePoint = resolveCropSourcePoint(
        previewCanvasRef.current,
        event.clientX,
        event.clientY,
        draft.pendingSource.sourceSize,
        draft.rotationQuarterTurns,
        draft.flipHorizontal,
        draft.flipVertical,
      );

      if (!sourcePoint) {
        return;
      }

      const interaction = cropInteractionRef.current;

      if (interaction.type === 'new') {
        onCropBoxChange?.({
          startX: interaction.startX,
          startY: interaction.startY,
          endX: sourcePoint.x,
          endY: sourcePoint.y,
        });
        return;
      }

      if (interaction.type === 'move') {
        const nextBox = clampNormalizedCropBox(
          {
            ...interaction.cropBox,
            x: interaction.cropBox.x + (sourcePoint.x - interaction.startX),
            y: interaction.cropBox.y + (sourcePoint.y - interaction.startY),
          },
          draft.pendingSource.sourceSize,
        );

        onCropBoxChange?.(toCropDraftBox(nextBox));
        return;
      }

      const nextBox = resizeCropBoxFromHandle(
        interaction.cropBox,
        interaction.handle,
        {
          x: sourcePoint.x,
          y: sourcePoint.y,
        },
        draft.pendingSource.sourceSize,
      );

      onCropBoxChange?.(toCropDraftBox(nextBox));
    }

    function handleMouseUp() {
      cropInteractionRef.current = null;
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    draft.flipHorizontal,
    draft.flipVertical,
    draft.pendingSource.sourceSize,
    draft.rotationQuarterTurns,
    effectiveCropMode,
    onCropBoxChange,
  ]);

  function handleDialogKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key !== 'Tab' || event.defaultPrevented) {
      return;
    }

    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    const focusableElements = getFocusableElements(dialog);

    if (focusableElements.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement;

    if (event.shiftKey) {
      if (activeElement === firstFocusable || activeElement === dialog) {
        event.preventDefault();
        lastFocusable.focus();
      }

      return;
    }

    if (activeElement === lastFocusable) {
      event.preventDefault();
      firstFocusable.focus();
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className="pre-insert-modal"
        role="dialog"
        aria-modal="true"
        aria-label={heading}
        tabIndex={-1}
        onKeyDown={handleDialogKeyDown}
      >
        <div className="pre-insert-modal-header">
          <div>
            <h2 className="pre-insert-modal-title">{heading}</h2>
            <p className="pre-insert-modal-copy">{copy}</p>
          </div>
          <button type="button" className="modal-close-button" onClick={onCancel} aria-label="Close modal">
            ×
          </button>
        </div>

        <div className="pre-insert-modal-body">
          <div className="pre-insert-preview-panel">
            <div className="pre-insert-preview-meta">
              <span>{draft.pendingSource.sourceKind.replace(/-/g, ' ')}</span>
              <span>
                {previewSize.width} x {previewSize.height}
              </span>
            </div>
            <div
              className={`pre-insert-preview${effectiveCropMode ? ' pre-insert-preview-crop-mode' : ''}`}
              aria-label="Pre-insert preview"
              onMouseDown={(event) => {
                if (!effectiveCropMode) {
                  return;
                }

                const sourcePoint = resolveCropSourcePoint(
                  previewCanvasRef.current,
                  event.clientX,
                  event.clientY,
                  draft.pendingSource.sourceSize,
                  draft.rotationQuarterTurns,
                  draft.flipHorizontal,
                  draft.flipVertical,
                );

                if (!sourcePoint) {
                  return;
                }

                event.preventDefault();
                cropInteractionRef.current = {
                  type: 'new',
                  startX: sourcePoint.x,
                  startY: sourcePoint.y,
                };
                onCropBoxChange?.({
                  startX: sourcePoint.x,
                  startY: sourcePoint.y,
                  endX: sourcePoint.x,
                  endY: sourcePoint.y,
                });
              }}
            >
              {draft.pendingSource.image ? (
                <div className="pre-insert-preview-canvas-shell">
                  <canvas
                    ref={previewCanvasRef}
                    className="pre-insert-preview-canvas"
                    width={previewCanvasSize.width}
                    height={previewCanvasSize.height}
                  />
                  {cropOverlayStyle ? (
                    <div
                      className={`pre-insert-crop-overlay${effectiveCropMode ? ' pre-insert-crop-overlay-interactive' : ''}`}
                      style={cropOverlayStyle}
                      onMouseDown={(event) => {
                        if (!effectiveCropMode || !draft.cropBox) {
                          return;
                        }

                        const normalizedCropBox = normalizeCropDraftBox(
                          draft.cropBox,
                          draft.pendingSource.sourceSize,
                        );

                        const sourcePoint = resolveCropSourcePoint(
                          previewCanvasRef.current,
                          event.clientX,
                          event.clientY,
                          draft.pendingSource.sourceSize,
                          draft.rotationQuarterTurns,
                          draft.flipHorizontal,
                          draft.flipVertical,
                        );

                        if (!sourcePoint) {
                          return;
                        }

                        event.preventDefault();
                        event.stopPropagation();
                        cropInteractionRef.current = {
                          type: 'move',
                          startX: sourcePoint.x,
                          startY: sourcePoint.y,
                          cropBox: normalizedCropBox,
                        };
                      }}
                    >
                      <div className="pre-insert-crop-overlay-frame" />
                      {effectiveCropMode && draft.cropBox ? (
                        <>
                          {(['top-left', 'top-right', 'bottom-right', 'bottom-left'] as CropHandle[]).map((handle) => (
                            <button
                              key={handle}
                              type="button"
                              className={`pre-insert-crop-handle pre-insert-crop-handle-${handle}`}
                              aria-label={`Resize crop from ${handle}`}
                              onMouseDown={(event) => {
                                if (!draft.cropBox) {
                                  return;
                                }

                                const normalizedCropBox = normalizeCropDraftBox(
                                  draft.cropBox,
                                  draft.pendingSource.sourceSize,
                                );
                                const sourcePoint = resolveCropSourcePoint(
                                  previewCanvasRef.current,
                                  event.clientX,
                                  event.clientY,
                                  draft.pendingSource.sourceSize,
                                  draft.rotationQuarterTurns,
                                  draft.flipHorizontal,
                                  draft.flipVertical,
                                );

                                if (!sourcePoint) {
                                  return;
                                }

                                event.preventDefault();
                                event.stopPropagation();
                                cropInteractionRef.current = {
                                  type: 'resize',
                                  handle,
                                  startX: sourcePoint.x,
                                  startY: sourcePoint.y,
                                  cropBox: normalizedCropBox,
                                };
                              }}
                            />
                          ))}
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="pre-insert-preview-placeholder">Preview ready</div>
              )}
            </div>
          </div>

          <div className="pre-insert-controls">
            {isAdvancedImport ? (
              <div className="field-stack">
                <label className="field-label" htmlFor="pre-insert-placement-mode">
                  Placement mode
                </label>
                <select
                  id="pre-insert-placement-mode"
                  className="select-input"
                  value={draft.advancedPlacementMode}
                  onChange={(event) =>
                    onPlacementModeChange?.(event.target.value as AdvancedImportPlacementMode)
                  }
                >
                  <option value="inside-canvas">Inside canvas</option>
                  <option value="outside-left">Outside left</option>
                  <option value="outside-right">Outside right</option>
                  <option value="outside-top">Outside top</option>
                  <option value="outside-bottom">Outside bottom</option>
                </select>
              </div>
            ) : null}
            <button type="button" className="apply-all-button" onClick={onRotateClockwise}>
              Rotate 90 clockwise
            </button>
            <button
              type="button"
              className="apply-all-button"
              onClick={onRotateCounterClockwise}
            >
              Rotate 90 counter-clockwise
            </button>
            <button type="button" className="apply-all-button" onClick={onFlipHorizontal}>
              Flip horizontal
            </button>
            <button type="button" className="apply-all-button" onClick={onFlipVertical}>
              Flip vertical
            </button>
          </div>
        </div>

        <div className="pre-insert-modal-actions">
          <button type="button" className="apply-all-button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="apply-all-button pre-insert-confirm-button" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => {
    return element.tabIndex >= 0 && !element.hasAttribute('aria-hidden');
  });
}

function isCoarsePointerEnvironment() {
  if (typeof window === 'undefined') {
    return false;
  }

  if (typeof window.matchMedia === 'function') {
    if (
      window.matchMedia('(pointer: coarse)').matches ||
      window.matchMedia('(any-pointer: coarse)').matches
    ) {
      return true;
    }
  }

  return typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
}

function getPreviewCanvasSize(
  sourceSize: { width: number; height: number },
  rotationQuarterTurns: PreInsertModalDraft['rotationQuarterTurns'],
) {
  const isSideways = rotationQuarterTurns % 2 === 1;
  const orientedWidth = isSideways ? sourceSize.height : sourceSize.width;
  const orientedHeight = isSideways ? sourceSize.width : sourceSize.height;
  const scale = getPreviewCanvasScale(sourceSize, rotationQuarterTurns);

  return {
    width: Math.max(1, Math.round(orientedWidth * scale)),
    height: Math.max(1, Math.round(orientedHeight * scale)),
  };
}

function getPreviewCanvasScale(
  sourceSize: { width: number; height: number },
  rotationQuarterTurns: PreInsertModalDraft['rotationQuarterTurns'],
) {
  const isSideways = rotationQuarterTurns % 2 === 1;
  const orientedWidth = isSideways ? sourceSize.height : sourceSize.width;
  const orientedHeight = isSideways ? sourceSize.width : sourceSize.height;

  return Math.min(540 / orientedWidth, 320 / orientedHeight, 1);
}

function getCropOverlayStyle({
  cropBox,
  sourceSize,
  rotationQuarterTurns,
  flipHorizontal,
  flipVertical,
}: {
  cropBox: CropDraftBox;
  sourceSize: { width: number; height: number };
  rotationQuarterTurns: PreInsertModalDraft['rotationQuarterTurns'];
  flipHorizontal: boolean;
  flipVertical: boolean;
}) {
  const normalizedCropBox = normalizeCropDraftBox(cropBox, sourceSize);

  if (normalizedCropBox.width === 0 || normalizedCropBox.height === 0) {
    return null;
  }

  const corners = [
    { x: normalizedCropBox.x / sourceSize.width, y: normalizedCropBox.y / sourceSize.height },
    {
      x: (normalizedCropBox.x + normalizedCropBox.width) / sourceSize.width,
      y: normalizedCropBox.y / sourceSize.height,
    },
    {
      x: normalizedCropBox.x / sourceSize.width,
      y: (normalizedCropBox.y + normalizedCropBox.height) / sourceSize.height,
    },
    {
      x: (normalizedCropBox.x + normalizedCropBox.width) / sourceSize.width,
      y: (normalizedCropBox.y + normalizedCropBox.height) / sourceSize.height,
    },
  ].map((corner) =>
    mapSourceNormalizedToPreviewNormalized(
      corner.x,
      corner.y,
      rotationQuarterTurns,
      flipHorizontal,
      flipVertical,
    ),
  );

  const left = Math.min(...corners.map((corner) => corner.x));
  const right = Math.max(...corners.map((corner) => corner.x));
  const top = Math.min(...corners.map((corner) => corner.y));
  const bottom = Math.max(...corners.map((corner) => corner.y));

  return {
    left: `${left * 100}%`,
    top: `${top * 100}%`,
    width: `${(right - left) * 100}%`,
    height: `${(bottom - top) * 100}%`,
  } as const;
}

function resolveCropSourcePoint(
  previewCanvas: HTMLCanvasElement | null,
  clientX: number,
  clientY: number,
  sourceSize: { width: number; height: number },
  rotationQuarterTurns: PreInsertModalDraft['rotationQuarterTurns'],
  flipHorizontal: boolean,
  flipVertical: boolean,
) {
  if (!previewCanvas) {
    return null;
  }

  const rect = previewCanvas.getBoundingClientRect();

  if (rect.width === 0 || rect.height === 0) {
    return null;
  }

  const previewX = clamp((clientX - rect.left) / rect.width, 0, 1);
  const previewY = clamp((clientY - rect.top) / rect.height, 0, 1);
  const sourcePoint = mapPreviewNormalizedToSourceNormalized(
    previewX,
    previewY,
    rotationQuarterTurns,
    flipHorizontal,
    flipVertical,
  );

  return {
    x: Math.round(sourcePoint.x * sourceSize.width),
    y: Math.round(sourcePoint.y * sourceSize.height),
  };
}

function mapSourceNormalizedToPreviewNormalized(
  sourceX: number,
  sourceY: number,
  rotationQuarterTurns: PreInsertModalDraft['rotationQuarterTurns'],
  flipHorizontal: boolean,
  flipVertical: boolean,
) {
  const flippedPoint = {
    x: (sourceX - 0.5) * (flipHorizontal ? -1 : 1),
    y: (sourceY - 0.5) * (flipVertical ? -1 : 1),
  };
  const rotatedPoint = rotateAroundCenter(
    flippedPoint.x,
    flippedPoint.y,
    (rotationQuarterTurns * Math.PI) / 2,
  );

  return {
    x: clamp(rotatedPoint.x + 0.5, 0, 1),
    y: clamp(rotatedPoint.y + 0.5, 0, 1),
  };
}

function mapPreviewNormalizedToSourceNormalized(
  previewX: number,
  previewY: number,
  rotationQuarterTurns: PreInsertModalDraft['rotationQuarterTurns'],
  flipHorizontal: boolean,
  flipVertical: boolean,
) {
  const unrotatedPoint = rotateAroundCenter(
    previewX - 0.5,
    previewY - 0.5,
    (-rotationQuarterTurns * Math.PI) / 2,
  );

  return {
    x: clamp(unrotatedPoint.x * (flipHorizontal ? -1 : 1) + 0.5, 0, 1),
    y: clamp(unrotatedPoint.y * (flipVertical ? -1 : 1) + 0.5, 0, 1),
  };
}

function rotateAroundCenter(x: number, y: number, angle: number) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toCropDraftBox(cropBox: NormalizedCropBox): CropDraftBox {
  return {
    startX: cropBox.x,
    startY: cropBox.y,
    endX: cropBox.x + cropBox.width,
    endY: cropBox.y + cropBox.height,
  };
}

function clampNormalizedCropBox(
  cropBox: NormalizedCropBox,
  sourceSize: { width: number; height: number },
) {
  const width = Math.max(1, Math.min(cropBox.width, sourceSize.width));
  const height = Math.max(1, Math.min(cropBox.height, sourceSize.height));

  return {
    x: clamp(cropBox.x, 0, sourceSize.width - width),
    y: clamp(cropBox.y, 0, sourceSize.height - height),
    width,
    height,
  };
}

function resizeCropBoxFromHandle(
  cropBox: NormalizedCropBox,
  handle: CropHandle,
  point: { x: number; y: number },
  sourceSize: { width: number; height: number },
) {
  let left = cropBox.x;
  let top = cropBox.y;
  let right = cropBox.x + cropBox.width;
  let bottom = cropBox.y + cropBox.height;

  if (handle === 'top-left' || handle === 'bottom-left') {
    left = point.x;
  }

  if (handle === 'top-right' || handle === 'bottom-right') {
    right = point.x;
  }

  if (handle === 'top-left' || handle === 'top-right') {
    top = point.y;
  }

  if (handle === 'bottom-left' || handle === 'bottom-right') {
    bottom = point.y;
  }

  const normalized = normalizeCropDraftBox(
    {
      startX: left,
      startY: top,
      endX: right,
      endY: bottom,
    },
    sourceSize,
  );

  return {
    x: normalized.x,
    y: normalized.y,
    width: Math.max(1, normalized.width),
    height: Math.max(1, normalized.height),
  };
}
