import type {
  RasterSelectionTargetId,
  RasterSurface,
  SelectionDraftRect,
  SelectionRect,
} from '../../app/types';

export type RasterSelectionSourceRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type RasterSelectionTarget = {
  id: RasterSelectionTargetId;
  sceneRect: SelectionRect;
  sourceRect: RasterSelectionSourceRect;
};

export function normalizeSelectionRect(
  draft: SelectionDraftRect,
  canvasSize: { width: number; height: number },
): SelectionRect {
  const left = clamp(Math.min(draft.startX, draft.endX), 0, canvasSize.width);
  const right = clamp(Math.max(draft.startX, draft.endX), 0, canvasSize.width);
  const top = clamp(Math.min(draft.startY, draft.endY), 0, canvasSize.height);
  const bottom = clamp(Math.max(draft.startY, draft.endY), 0, canvasSize.height);

  return {
    x: left,
    y: top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

export function mapSelectionRectToSourceRect(
  selectionRect: SelectionRect,
  targetBox: { x: number; y: number; width: number; height: number },
  sourceSize: { width: number; height: number },
  skew: { x: number; y: number } = { x: 1, y: 1 },
): RasterSelectionSourceRect {
  const relativeLeft = (selectionRect.x - targetBox.x) / Math.max(targetBox.width, 1);
  const relativeTop = (selectionRect.y - targetBox.y) / Math.max(targetBox.height, 1);
  const relativeWidth = selectionRect.width / Math.max(targetBox.width, 1);
  const relativeHeight = selectionRect.height / Math.max(targetBox.height, 1);
  const sourceWidth = Math.max(1, Math.round(relativeWidth * sourceSize.width));
  const sourceHeight = Math.max(1, Math.round(relativeHeight * sourceSize.height));
  const unflippedX = Math.round(relativeLeft * sourceSize.width);
  const unflippedY = Math.round(relativeTop * sourceSize.height);

  return {
    x:
      skew.x < 0
        ? Math.max(0, sourceSize.width - unflippedX - sourceWidth)
        : clamp(unflippedX, 0, Math.max(0, sourceSize.width - sourceWidth)),
    y:
      skew.y < 0
        ? Math.max(0, sourceSize.height - unflippedY - sourceHeight)
        : clamp(unflippedY, 0, Math.max(0, sourceSize.height - sourceHeight)),
    width: clamp(sourceWidth, 1, sourceSize.width),
    height: clamp(sourceHeight, 1, sourceSize.height),
  };
}

export function clampSelectionRectToBox(
  selectionRect: SelectionRect,
  targetBox: { x: number; y: number; width: number; height: number },
): SelectionRect | null {
  const left = Math.max(selectionRect.x, targetBox.x);
  const right = Math.min(selectionRect.x + selectionRect.width, targetBox.x + targetBox.width);
  const top = Math.max(selectionRect.y, targetBox.y);
  const bottom = Math.min(selectionRect.y + selectionRect.height, targetBox.y + targetBox.height);

  if (right <= left || bottom <= top) {
    return null;
  }

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

export function extractRasterSelection(
  surface: RasterSurface,
  sourceRect: RasterSelectionSourceRect,
): RasterSurface {
  const nextData = new Uint8ClampedArray(new ArrayBuffer(sourceRect.width * sourceRect.height * 4));

  for (let y = 0; y < sourceRect.height; y += 1) {
    for (let x = 0; x < sourceRect.width; x += 1) {
      const sourceOffset = ((sourceRect.y + y) * surface.width + (sourceRect.x + x)) * 4;
      const nextOffset = (y * sourceRect.width + x) * 4;

      nextData[nextOffset] = surface.data[sourceOffset] ?? 0;
      nextData[nextOffset + 1] = surface.data[sourceOffset + 1] ?? 0;
      nextData[nextOffset + 2] = surface.data[sourceOffset + 2] ?? 0;
      nextData[nextOffset + 3] = surface.data[sourceOffset + 3] ?? 0;
    }
  }

  return {
    width: sourceRect.width,
    height: sourceRect.height,
    data: nextData,
  };
}

export function clearRasterSelection(
  surface: RasterSurface,
  sourceRect: RasterSelectionSourceRect,
): RasterSurface {
  const nextData = new Uint8ClampedArray(new ArrayBuffer(surface.data.length));
  nextData.set(surface.data);

  for (let y = sourceRect.y; y < sourceRect.y + sourceRect.height; y += 1) {
    for (let x = sourceRect.x; x < sourceRect.x + sourceRect.width; x += 1) {
      const offset = (y * surface.width + x) * 4;
      nextData[offset] = 0;
      nextData[offset + 1] = 0;
      nextData[offset + 2] = 0;
      nextData[offset + 3] = 0;
    }
  }

  return {
    width: surface.width,
    height: surface.height,
    data: nextData,
  };
}

export function selectionRectIsEmpty(rect: SelectionRect | null) {
  return !rect || rect.width <= 0 || rect.height <= 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
