export type BrushPoint = {
  x: number;
  y: number;
};

export type BrushStrokeInput = {
  width: number;
  height: number;
  points: BrushPoint[];
  brush: {
    color: string;
    size: number;
    opacity?: number;
    softEdge?: boolean;
  };
};

export type RasterSurface = {
  width: number;
  height: number;
  data: Uint8ClampedArray<ArrayBuffer>;
};

export function rasterizeBrushStroke(input: BrushStrokeInput): RasterSurface {
  const surface = createBlankRasterSurface(input.width, input.height);

  if (input.points.length === 0) {
    return surface;
  }

  const rgba = parseHexColor(input.brush.color, input.brush.opacity ?? 1);
  const radius = Math.max(1, input.brush.size / 2);
  const spacing = Math.max(1, radius / 2);

  stampCircle(surface, input.points[0]!, radius, rgba, input.brush.softEdge ?? false);

  for (let index = 1; index < input.points.length; index += 1) {
    const previous = input.points[index - 1]!;
    const current = input.points[index]!;
    const deltaX = current.x - previous.x;
    const deltaY = current.y - previous.y;
    const distance = Math.hypot(deltaX, deltaY);
    const steps = Math.max(1, Math.ceil(distance / spacing));

    for (let step = 1; step <= steps; step += 1) {
      const progress = step / steps;
      stampCircle(
        surface,
        {
          x: previous.x + deltaX * progress,
          y: previous.y + deltaY * progress,
        },
        radius,
        rgba,
        input.brush.softEdge ?? false,
      );
    }
  }

  return surface;
}

export function createBlankRasterSurface(width: number, height: number): RasterSurface {
  return {
    width,
    height,
    data: new Uint8ClampedArray(new ArrayBuffer(width * height * 4)),
  };
}

function stampCircle(
  surface: RasterSurface,
  point: BrushPoint,
  radius: number,
  rgba: [number, number, number, number],
  softEdge: boolean,
) {
  const left = Math.max(0, Math.floor(point.x - radius));
  const right = Math.min(surface.width - 1, Math.ceil(point.x + radius));
  const top = Math.max(0, Math.floor(point.y - radius));
  const bottom = Math.min(surface.height - 1, Math.ceil(point.y + radius));
  const radiusSquared = radius * radius;

  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      const distanceX = x + 0.5 - point.x;
      const distanceY = y + 0.5 - point.y;

      if (distanceX * distanceX + distanceY * distanceY > radiusSquared) {
        continue;
      }

      const offset = (y * surface.width + x) * 4;
      const alphaScale = softEdge
        ? resolveSoftEdgeAlphaScale(Math.sqrt(distanceX * distanceX + distanceY * distanceY), radius)
        : 1;
      const nextAlpha = Math.round(rgba[3] * alphaScale);

      if (nextAlpha <= 0) {
        continue;
      }

      surface.data[offset] = rgba[0];
      surface.data[offset + 1] = rgba[1];
      surface.data[offset + 2] = rgba[2];
      surface.data[offset + 3] = Math.max(surface.data[offset + 3] ?? 0, nextAlpha);
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

function parseHexColor(color: string, opacity: number): [number, number, number, number] {
  const normalized = color.replace('#', '').trim();
  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((part) => `${part}${part}`)
          .join('')
      : normalized;

  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);

  return [red, green, blue, Math.round(Math.max(0, Math.min(1, opacity)) * 255)];
}
