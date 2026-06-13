import { type BrushPoint, type RasterSurface } from '../draw/brush-engine';
import { cloneRasterSurface } from '../draw/draw-layer-utils';

export type CloneStampStrokeInput = {
  target: RasterSurface;
  source?: RasterSurface;
  sourcePoint: BrushPoint;
  destinationStart: BrushPoint;
  points: BrushPoint[];
  brushSize: number;
  opacity?: number;
  softEdge?: boolean;
};

export type CloneStampStrokeResult = {
  surface: RasterSurface;
  offset: {
    x: number;
    y: number;
  };
};

export function applyCloneStampStroke(
  input: CloneStampStrokeInput,
): CloneStampStrokeResult {
  const sourceSnapshot = cloneRasterSurface(input.source ?? input.target);
  const nextSurface = cloneRasterSurface(input.target);
  const offset = {
    x: input.destinationStart.x - input.sourcePoint.x,
    y: input.destinationStart.y - input.sourcePoint.y,
  };

  if (input.points.length === 0) {
    return {
      surface: nextSurface,
      offset,
    };
  }

  const radius = Math.max(1, input.brushSize / 2);
  const spacing = Math.max(1, radius / 2);

  stampCloneCircle(nextSurface, sourceSnapshot, input.points[0]!, offset, radius, input.opacity ?? 1, input.softEdge ?? false);

  for (let index = 1; index < input.points.length; index += 1) {
    const previous = input.points[index - 1]!;
    const current = input.points[index]!;
    const deltaX = current.x - previous.x;
    const deltaY = current.y - previous.y;
    const distance = Math.hypot(deltaX, deltaY);
    const steps = Math.max(1, Math.ceil(distance / spacing));

    for (let step = 1; step <= steps; step += 1) {
      const progress = step / steps;
      stampCloneCircle(
        nextSurface,
        sourceSnapshot,
        {
          x: previous.x + deltaX * progress,
          y: previous.y + deltaY * progress,
        },
        offset,
        radius,
        input.opacity ?? 1,
        input.softEdge ?? false,
      );
    }
  }

  return {
    surface: nextSurface,
    offset,
  };
}

function stampCloneCircle(
  target: RasterSurface,
  source: RasterSurface,
  point: BrushPoint,
  offset: { x: number; y: number },
  radius: number,
  opacity: number,
  softEdge: boolean,
) {
  const left = Math.max(0, Math.floor(point.x - radius));
  const right = Math.min(target.width - 1, Math.ceil(point.x + radius));
  const top = Math.max(0, Math.floor(point.y - radius));
  const bottom = Math.min(target.height - 1, Math.ceil(point.y + radius));
  const radiusSquared = radius * radius;
  const clampedOpacity = Math.max(0, Math.min(1, opacity));

  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      const distanceX = x + 0.5 - point.x;
      const distanceY = y + 0.5 - point.y;
      const distanceSquared = distanceX * distanceX + distanceY * distanceY;

      if (distanceSquared > radiusSquared) {
        continue;
      }

      const sourceX = Math.round(x - offset.x);
      const sourceY = Math.round(y - offset.y);

      if (sourceX < 0 || sourceX >= source.width || sourceY < 0 || sourceY >= source.height) {
        continue;
      }

      const sourceOffset = (sourceY * source.width + sourceX) * 4;
      const sourceAlpha = source.data[sourceOffset + 3] ?? 0;

      if (sourceAlpha <= 0) {
        continue;
      }

      const maskAlpha = softEdge
        ? resolveSoftEdgeAlphaScale(Math.sqrt(distanceSquared), radius)
        : 1;
      const blendAlpha = (sourceAlpha / 255) * clampedOpacity * maskAlpha;

      if (blendAlpha <= 0) {
        continue;
      }

      const targetOffset = (y * target.width + x) * 4;
      const baseAlpha = (target.data[targetOffset + 3] ?? 0) / 255;
      const outAlpha = blendAlpha + baseAlpha * (1 - blendAlpha);

      if (outAlpha <= 0) {
        continue;
      }

      target.data[targetOffset] = Math.round(
        ((source.data[sourceOffset] ?? 0) * blendAlpha + (target.data[targetOffset] ?? 0) * baseAlpha * (1 - blendAlpha)) /
          outAlpha,
      );
      target.data[targetOffset + 1] = Math.round(
        ((source.data[sourceOffset + 1] ?? 0) * blendAlpha +
          (target.data[targetOffset + 1] ?? 0) * baseAlpha * (1 - blendAlpha)) /
          outAlpha,
      );
      target.data[targetOffset + 2] = Math.round(
        ((source.data[sourceOffset + 2] ?? 0) * blendAlpha +
          (target.data[targetOffset + 2] ?? 0) * baseAlpha * (1 - blendAlpha)) /
          outAlpha,
      );
      target.data[targetOffset + 3] = Math.round(outAlpha * 255);
    }
  }
}

function resolveSoftEdgeAlphaScale(distance: number, radius: number) {
  if (radius <= 0) {
    return 1;
  }

  const normalizedDistance = Math.max(0, Math.min(1, distance / radius));
  const innerSolidRatio = 0.22;

  if (normalizedDistance <= innerSolidRatio) {
    return 1;
  }

  const featherProgress = (normalizedDistance - innerSolidRatio) / (1 - innerSolidRatio);
  return 1 - featherProgress * featherProgress;
}
