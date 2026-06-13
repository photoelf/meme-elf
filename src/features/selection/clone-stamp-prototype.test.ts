import { describe, expect, it } from 'vitest';

import { createBlankRasterSurface } from '../draw/brush-engine';
import { applyCloneStampStroke } from './clone-stamp-prototype';

function setPixel(
  surface: ReturnType<typeof createBlankRasterSurface>,
  x: number,
  y: number,
  rgba: [number, number, number, number],
) {
  const offset = (y * surface.width + x) * 4;
  surface.data[offset] = rgba[0];
  surface.data[offset + 1] = rgba[1];
  surface.data[offset + 2] = rgba[2];
  surface.data[offset + 3] = rgba[3];
}

function getPixel(
  surface: ReturnType<typeof createBlankRasterSurface>,
  x: number,
  y: number,
) {
  const offset = (y * surface.width + x) * 4;
  return [
    surface.data[offset],
    surface.data[offset + 1],
    surface.data[offset + 2],
    surface.data[offset + 3],
  ] as const;
}

describe('applyCloneStampStroke', () => {
  it('copies sampled pixels using the offset between the source point and the first destination point', () => {
    const source = createBlankRasterSurface(6, 6);
    setPixel(source, 1, 1, [12, 34, 56, 255]);

    const stamped = applyCloneStampStroke({
      brushSize: 2,
      destinationStart: { x: 4, y: 4 },
      points: [{ x: 4, y: 4 }],
      sourcePoint: { x: 1, y: 1 },
      target: createBlankRasterSurface(6, 6),
      source,
    });

    expect(stamped.offset).toEqual({ x: 3, y: 3 });
    expect(getPixel(stamped.surface, 4, 4)).toEqual([12, 34, 56, 255]);
  });

  it('samples from the original source snapshot instead of smearing freshly stamped destination pixels', () => {
    const source = createBlankRasterSurface(8, 4);
    setPixel(source, 2, 2, [255, 0, 0, 255]);
    setPixel(source, 3, 2, [0, 0, 255, 255]);

    const stamped = applyCloneStampStroke({
      brushSize: 2,
      destinationStart: { x: 3, y: 2 },
      points: [
        { x: 3, y: 2 },
        { x: 4, y: 2 },
      ],
      sourcePoint: { x: 2, y: 2 },
      target: createBlankRasterSurface(8, 4),
      source,
    });

    expect(getPixel(stamped.surface, 3, 2)).toEqual([255, 0, 0, 255]);
    expect(getPixel(stamped.surface, 4, 2)).toEqual([0, 0, 255, 255]);
  });
});
