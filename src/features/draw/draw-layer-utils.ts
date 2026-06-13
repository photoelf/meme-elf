import type { DrawLayer } from '../../app/types';
import {
  createBlankRasterSurface,
  rasterizeBrushStroke,
  type BrushPoint,
  type RasterSurface,
} from './brush-engine';

export function createDrawLayer(input: {
  id: DrawLayer['id'];
  name: string;
  width: number;
  height: number;
}): DrawLayer {
  return {
    id: input.id,
    kind: 'draw',
    name: input.name,
    opacity: 1,
    box: {
      x: 0,
      y: 0,
      width: input.width,
      height: input.height,
      rotation: 0,
    },
    sourceSize: {
      width: input.width,
      height: input.height,
    },
    raster: createBlankRasterSurface(input.width, input.height),
  };
}

export function cloneRasterSurface(surface: RasterSurface): RasterSurface {
  const data = new Uint8ClampedArray(new ArrayBuffer(surface.data.length));
  data.set(surface.data);

  return {
    width: surface.width,
    height: surface.height,
    data,
  };
}

export function commitDrawStroke(
  layer: DrawLayer,
  input: {
    points: BrushPoint[];
    brush: {
      color: string;
      mode?: 'draw' | 'erase';
      size: number;
      opacity?: number;
      softEdge?: boolean;
    };
  },
): DrawLayer {
  const strokeSurface = rasterizeBrushStroke({
    width: layer.sourceSize.width,
    height: layer.sourceSize.height,
    points: input.points,
    brush: input.brush,
  });
  const raster = mergeRasterSurface(layer.raster, strokeSurface, input.brush.mode ?? 'draw');

  return {
    ...layer,
    raster,
  };
}

function mergeRasterSurface(
  base: RasterSurface,
  overlay: RasterSurface,
  mode: 'draw' | 'erase',
): RasterSurface {
  const nextSurface = cloneRasterSurface(base);

  for (let offset = 0; offset < nextSurface.data.length; offset += 4) {
    const overlayAlpha = overlay.data[offset + 3] ?? 0;

    if (overlayAlpha <= 0) {
      continue;
    }

    const alpha = overlayAlpha / 255;
    const inverseAlpha = 1 - alpha;

    if (mode === 'erase') {
      const baseAlpha = base.data[offset + 3] ?? 0;
      const nextAlpha = Math.round(baseAlpha * inverseAlpha);

      if (nextAlpha <= 0) {
        nextSurface.data[offset] = 0;
        nextSurface.data[offset + 1] = 0;
        nextSurface.data[offset + 2] = 0;
        nextSurface.data[offset + 3] = 0;
        continue;
      }

      const colorScale = baseAlpha > 0 ? nextAlpha / baseAlpha : 0;
      nextSurface.data[offset] = Math.round((base.data[offset] ?? 0) * colorScale);
      nextSurface.data[offset + 1] = Math.round((base.data[offset + 1] ?? 0) * colorScale);
      nextSurface.data[offset + 2] = Math.round((base.data[offset + 2] ?? 0) * colorScale);
      nextSurface.data[offset + 3] = nextAlpha;
      continue;
    }

    nextSurface.data[offset] = Math.round((overlay.data[offset] ?? 0) * alpha + (base.data[offset] ?? 0) * inverseAlpha);
    nextSurface.data[offset + 1] = Math.round(
      (overlay.data[offset + 1] ?? 0) * alpha + (base.data[offset + 1] ?? 0) * inverseAlpha,
    );
    nextSurface.data[offset + 2] = Math.round(
      (overlay.data[offset + 2] ?? 0) * alpha + (base.data[offset + 2] ?? 0) * inverseAlpha,
    );
    nextSurface.data[offset + 3] = Math.round(overlayAlpha + (base.data[offset + 3] ?? 0) * inverseAlpha);
  }

  return nextSurface;
}
