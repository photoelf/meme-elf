import { isImageLayer, isTextLayer } from '../../app/types';
import type { BaseLayer, EditorLayer, ImageLayer, LayerId, TextBox, TextLayer } from '../../app/types';

const DEFAULT_MIN_LAYER_SIZE = 48;
const MIN_IMAGE_LAYER_SIZE = 1;
const RIGHT_ANGLE_RADIANS = Math.PI / 2;
export type DirectionalInsertionMode =
  | 'outside-left'
  | 'outside-right'
  | 'outside-top'
  | 'outside-bottom';

type Point = { x: number; y: number };

export function getDefaultImageLayerBox(
  canvasSize: { width: number; height: number },
  imageSize: { width: number; height: number },
): TextBox {
  const safeImageWidth = Math.max(1, imageSize.width);
  const safeImageHeight = Math.max(1, imageSize.height);
  const scale = Math.min(
    canvasSize.width / safeImageWidth,
    canvasSize.height / safeImageHeight,
    1,
  );
  const width = Math.round(safeImageWidth * scale);
  const height = Math.round(safeImageHeight * scale);

  return {
    x: Math.round((canvasSize.width - width) / 2),
    y: Math.round((canvasSize.height - height) / 2),
    width,
    height,
    rotation: 0,
  };
}

export function createDefaultImageLayer(
  id: LayerId,
  sequence: number,
  image: CanvasImageSource,
  canvasSize: { width: number; height: number },
  imageSize: { width: number; height: number },
): ImageLayer {
  return {
    id,
    kind: 'image',
    name: `Image ${sequence}`,
    box: getDefaultImageLayerBox(canvasSize, imageSize),
    opacity: 1,
    image,
    sourceSize: imageSize,
    skew: { x: 1, y: 1 },
  };
}

export function getDirectionalInsertionLayout({
  canvasSize,
  imageSize,
  direction,
  layers,
}: {
  canvasSize: { width: number; height: number };
  imageSize: { width: number; height: number };
  direction: DirectionalInsertionMode;
  layers: EditorLayer[];
}) {
  const nextCanvasSize =
    direction === 'outside-left' || direction === 'outside-right'
      ? {
          width: canvasSize.width + imageSize.width,
          height: canvasSize.height,
        }
      : {
          width: canvasSize.width,
          height: canvasSize.height + imageSize.height,
        };

  const existingContentOffset = {
    x: direction === 'outside-left' ? imageSize.width : 0,
    y: direction === 'outside-top' ? imageSize.height : 0,
  };

  const shiftedLayers = shiftLayersByOffset(layers, existingContentOffset);
  const insertedBox = getInsertedImageBox(nextCanvasSize, imageSize, direction);

  return {
    canvasSize: nextCanvasSize,
    existingContentOffset,
    insertedBox,
    shiftedLayers,
  };
}

export function rotateImageLayer90(
  layer: ImageLayer,
  direction: 'clockwise' | 'counter-clockwise',
): ImageLayer {
  const centerX = layer.box.x + layer.box.width / 2;
  const centerY = layer.box.y + layer.box.height / 2;
  const nextWidth = layer.box.height;
  const nextHeight = layer.box.width;
  const rotationDelta = direction === 'clockwise' ? RIGHT_ANGLE_RADIANS : -RIGHT_ANGLE_RADIANS;

  return {
    ...layer,
    box: {
      x: centerX - nextWidth / 2,
      y: centerY - nextHeight / 2,
      width: nextWidth,
      height: nextHeight,
      rotation: normalizeRightAngle(layer.box.rotation + rotationDelta),
    },
    skew: normalizeFlipScale(layer.skew),
  };
}

export function flipImageLayerHorizontal(layer: ImageLayer): ImageLayer {
  const skew = normalizeFlipScale(layer.skew);

  return {
    ...layer,
    skew: {
      x: skew.x * -1,
      y: skew.y,
    },
  };
}

export function flipImageLayerVertical(layer: ImageLayer): ImageLayer {
  const skew = normalizeFlipScale(layer.skew);

  return {
    ...layer,
    skew: {
      x: skew.x,
      y: skew.y * -1,
    },
  };
}

export function reorderLayerStack<T extends BaseLayer>(
  layers: T[],
  sourceLayerId: T['id'],
  targetLayerId: T['id'],
  placement: 'before' | 'after',
) {
  if (sourceLayerId === targetLayerId) {
    return [...layers];
  }

  const sourceIndex = layers.findIndex((layer) => layer.id === sourceLayerId);
  const targetIndex = layers.findIndex((layer) => layer.id === targetLayerId);

  if (sourceIndex === -1 || targetIndex === -1) {
    return [...layers];
  }

  const nextLayers = [...layers];
  const [movedLayer] = nextLayers.splice(sourceIndex, 1);
  const adjustedTargetIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
  const insertIndex = placement === 'before' ? adjustedTargetIndex : adjustedTargetIndex + 1;
  nextLayers.splice(insertIndex, 0, movedLayer);
  return nextLayers;
}

export function clampLayerBoxSize(box: TextBox, minSize = DEFAULT_MIN_LAYER_SIZE): TextBox {
  return {
    ...box,
    width: Math.max(minSize, box.width),
    height: Math.max(minSize, box.height),
  };
}

export function getAxisLockedMoveDelta(delta: Point): Point {
  if (Math.abs(delta.x) >= Math.abs(delta.y)) {
    return { x: delta.x, y: 0 };
  }

  return { x: 0, y: delta.y };
}

export function resizeImageLayerBox({
  startBox,
  axisX,
  axisY,
  deltaX,
  deltaY,
  preserveAspectRatio,
}: {
  startBox: TextBox;
  axisX: 'left' | 'right' | null;
  axisY: 'top' | 'bottom' | null;
  deltaX: number;
  deltaY: number;
  preserveAspectRatio: boolean;
}): TextBox {
  const delta = rotatePoint({ x: deltaX, y: deltaY }, -startBox.rotation);
  const startLeft = -startBox.width / 2;
  const startRight = startBox.width / 2;
  const startTop = -startBox.height / 2;
  const startBottom = startBox.height / 2;
  let left = startLeft;
  let right = startRight;
  let top = startTop;
  let bottom = startBottom;

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

  if (preserveAspectRatio) {
    const aspectRatio = startBox.width / Math.max(startBox.height, MIN_IMAGE_LAYER_SIZE);
    const minimumAspectSize = getMinimumAspectSize(aspectRatio);
    const rawWidth = Math.max(minimumAspectSize.width, right - left);
    const rawHeight = Math.max(minimumAspectSize.height, bottom - top);
    const widthDeltaRatio = Math.abs(rawWidth - startBox.width) / Math.max(startBox.width, 1);
    const heightDeltaRatio = Math.abs(rawHeight - startBox.height) / Math.max(startBox.height, 1);

    if (axisX && axisY) {
      if (widthDeltaRatio >= heightDeltaRatio) {
        const nextWidth = rawWidth;
        const nextHeight = Math.max(MIN_IMAGE_LAYER_SIZE, nextWidth / aspectRatio);
        ({ left, right } = applyAnchoredDimension(startLeft, startRight, axisX, nextWidth));
        ({ top, bottom } = applyAnchoredDimension(startTop, startBottom, axisY, nextHeight));
      } else {
        const nextHeight = rawHeight;
        const nextWidth = Math.max(MIN_IMAGE_LAYER_SIZE, nextHeight * aspectRatio);
        ({ top, bottom } = applyAnchoredDimension(startTop, startBottom, axisY, nextHeight));
        ({ left, right } = applyAnchoredDimension(startLeft, startRight, axisX, nextWidth));
      }
    } else if (axisX) {
      const nextWidth = rawWidth;
      const nextHeight = Math.max(MIN_IMAGE_LAYER_SIZE, nextWidth / aspectRatio);
      top = -nextHeight / 2;
      bottom = nextHeight / 2;
    } else if (axisY) {
      const nextHeight = rawHeight;
      const nextWidth = Math.max(MIN_IMAGE_LAYER_SIZE, nextHeight * aspectRatio);
      left = -nextWidth / 2;
      right = nextWidth / 2;
    }
  }

  const width = Math.max(MIN_IMAGE_LAYER_SIZE, right - left);
  const height = Math.max(MIN_IMAGE_LAYER_SIZE, bottom - top);
  ({ left, right } = normalizeDimension(left, right, width, axisX));
  ({ top, bottom } = normalizeDimension(top, bottom, height, axisY));

  const centerOffsetLocal = {
    x: (left + right) / 2,
    y: (top + bottom) / 2,
  };
  const centerOffsetWorld = rotatePoint(centerOffsetLocal, startBox.rotation);
  const startCenter = {
    x: startBox.x + startBox.width / 2,
    y: startBox.y + startBox.height / 2,
  };
  const nextCenter = {
    x: startCenter.x + centerOffsetWorld.x,
    y: startCenter.y + centerOffsetWorld.y,
  };

  return {
    ...startBox,
    x: nextCenter.x - width / 2,
    y: nextCenter.y - height / 2,
    width,
    height,
  };
}

export function getTextLayers(layers: EditorLayer[]) {
  return layers.filter(isTextLayer);
}

export function getImageLayers(layers: EditorLayer[]) {
  return layers.filter(isImageLayer);
}

export function reorderTextLayersWithinStack(
  layers: EditorLayer[],
  sourceLayerId: LayerId,
  targetLayerId: LayerId,
  placement: 'before' | 'after',
) {
  const textLayers = getTextLayers(layers);
  const reorderedTextLayers = reorderLayerStack(
    textLayers,
    sourceLayerId,
    targetLayerId,
    placement,
  );

  if (
    reorderedTextLayers.length !== textLayers.length ||
    reorderedTextLayers.every((layer, index) => layer.id === textLayers[index]?.id)
  ) {
    return [...layers];
  }

  let textLayerIndex = 0;

  return layers.map((layer) => {
    if (!isTextLayer(layer)) {
      return layer;
    }

    const nextLayer = reorderedTextLayers[textLayerIndex] as TextLayer;
    textLayerIndex += 1;
    return nextLayer;
  });
}

function normalizeFlipScale(skew: ImageLayer['skew']) {
  return {
    x: skew.x < 0 ? -1 : 1,
    y: skew.y < 0 ? -1 : 1,
  };
}

function applyAnchoredDimension(
  startMin: number,
  startMax: number,
  activeAxis: 'left' | 'right' | 'top' | 'bottom',
  nextSize: number,
) {
  if (activeAxis === 'left' || activeAxis === 'top') {
    return {
      left: startMax - nextSize,
      right: startMax,
      top: startMax - nextSize,
      bottom: startMax,
    };
  }

  return {
    left: startMin,
    right: startMin + nextSize,
    top: startMin,
    bottom: startMin + nextSize,
  };
}

function normalizeDimension(
  min: number,
  max: number,
  size: number,
  activeAxis: 'left' | 'right' | 'top' | 'bottom' | null,
) {
  if (activeAxis === 'left' || activeAxis === 'top') {
    return {
      left: max - size,
      right: max,
      top: max - size,
      bottom: max,
    };
  }

  if (activeAxis === 'right' || activeAxis === 'bottom') {
    return {
      left: min,
      right: min + size,
      top: min,
      bottom: min + size,
    };
  }

  return {
    left: -size / 2,
    right: size / 2,
    top: -size / 2,
    bottom: size / 2,
  };
}

function shiftLayersByOffset(
  layers: EditorLayer[],
  offset: { x: number; y: number },
) {
  return layers.map((layer) => ({
    ...layer,
    box: {
      ...layer.box,
      x: layer.box.x + offset.x,
      y: layer.box.y + offset.y,
    },
  }));
}

function getInsertedImageBox(
  canvasSize: { width: number; height: number },
  imageSize: { width: number; height: number },
  direction: DirectionalInsertionMode,
): TextBox {
  if (direction === 'outside-left') {
    return {
      x: 0,
      y: Math.round((canvasSize.height - imageSize.height) / 2),
      width: imageSize.width,
      height: imageSize.height,
      rotation: 0,
    };
  }

  if (direction === 'outside-right') {
    return {
      x: canvasSize.width - imageSize.width,
      y: Math.round((canvasSize.height - imageSize.height) / 2),
      width: imageSize.width,
      height: imageSize.height,
      rotation: 0,
    };
  }

  if (direction === 'outside-top') {
    return {
      x: Math.round((canvasSize.width - imageSize.width) / 2),
      y: 0,
      width: imageSize.width,
      height: imageSize.height,
      rotation: 0,
    };
  }

  return {
    x: Math.round((canvasSize.width - imageSize.width) / 2),
    y: canvasSize.height - imageSize.height,
    width: imageSize.width,
    height: imageSize.height,
    rotation: 0,
  };
}

function normalizeRightAngle(rotation: number) {
  const quarterTurns = Math.round(rotation / RIGHT_ANGLE_RADIANS);
  const normalizedQuarterTurns = ((quarterTurns + 2) % 4) - 2;
  return normalizedQuarterTurns * RIGHT_ANGLE_RADIANS;
}

function rotatePoint(point: Point, angle: number) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}

function getMinimumAspectSize(aspectRatio: number) {
  if (aspectRatio >= 1) {
    return {
      width: aspectRatio * MIN_IMAGE_LAYER_SIZE,
      height: MIN_IMAGE_LAYER_SIZE,
    };
  }

  return {
    width: MIN_IMAGE_LAYER_SIZE,
    height: MIN_IMAGE_LAYER_SIZE / Math.max(aspectRatio, Number.EPSILON),
  };
}
