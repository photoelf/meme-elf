import { describe, expect, it } from 'vitest';

import { createDrawLayer, commitDrawStroke } from './draw-layer-utils';

describe('createDrawLayer', () => {
  it('creates a blank draw layer sized to the current canvas', () => {
    const layer = createDrawLayer({
      id: 'draw-1',
      name: 'Brush layer',
      width: 320,
      height: 180,
    });

    expect(layer).toMatchObject({
      id: 'draw-1',
      kind: 'draw',
      name: 'Brush layer',
      opacity: 1,
      box: {
        x: 0,
        y: 0,
        width: 320,
        height: 180,
        rotation: 0,
      },
      sourceSize: {
        width: 320,
        height: 180,
      },
    });
    expect(layer.raster.width).toBe(320);
    expect(layer.raster.height).toBe(180);
    expect(Array.from(layer.raster.data)).toEqual(new Array(320 * 180 * 4).fill(0));
  });
});

describe('commitDrawStroke', () => {
  it('rasterizes a simple pointer path into committed pixels', () => {
    const layer = createDrawLayer({
      id: 'draw-1',
      name: 'Brush layer',
      width: 48,
      height: 48,
    });

    const updatedLayer = commitDrawStroke(layer, {
      points: [
        { x: 8, y: 8 },
        { x: 24, y: 24 },
        { x: 40, y: 40 },
      ],
      brush: {
        color: '#ff0000',
        size: 8,
      },
    });

    const alphaValues = Array.from(updatedLayer.raster.data).filter((_, index) => index % 4 === 3);
    expect(alphaValues.some((value) => value > 0)).toBe(true);

    const centerIndex = ((24 * updatedLayer.raster.width + 24) * 4) as number;
    expect(updatedLayer.raster.data[centerIndex]).toBe(255);
    expect(updatedLayer.raster.data[centerIndex + 1]).toBe(0);
    expect(updatedLayer.raster.data[centerIndex + 2]).toBe(0);
    expect(updatedLayer.raster.data[centerIndex + 3]).toBe(255);
  });

  it('removes alpha from existing draw pixels when the brush is in erase mode', () => {
    const layer = createDrawLayer({
      id: 'draw-1',
      name: 'Brush layer',
      width: 48,
      height: 48,
    });

    const paintedLayer = commitDrawStroke(layer, {
      points: [{ x: 24, y: 24 }],
      brush: {
        color: '#ff0000',
        size: 12,
      },
    });
    const erasedLayer = commitDrawStroke(paintedLayer, {
      points: [{ x: 24, y: 24 }],
      brush: {
        color: '#ff0000',
        size: 12,
        mode: 'erase',
      },
    });

    const centerIndex = ((24 * erasedLayer.raster.width + 24) * 4) as number;

    expect(paintedLayer.raster.data[centerIndex + 3]).toBeGreaterThan(0);
    expect(erasedLayer.raster.data[centerIndex + 3]).toBe(0);
  });
});
