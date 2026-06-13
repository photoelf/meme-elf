import { describe, expect, it } from 'vitest';

import {
  clearRasterSelection,
  extractRasterSelection,
  mapSelectionRectToSourceRect,
  normalizeSelectionRect,
} from './selection-utils';

describe('normalizeSelectionRect', () => {
  it('normalizes marquee drags from any direction and clamps them to canvas bounds', () => {
    expect(
      normalizeSelectionRect(
        {
          startX: 180,
          startY: 140,
          endX: 40,
          endY: 20,
        },
        { width: 160, height: 120 },
      ),
    ).toEqual({
      x: 40,
      y: 20,
      width: 120,
      height: 100,
    });
  });
});

describe('mapSelectionRectToSourceRect', () => {
  it('maps a scene-space selection into source pixels for an unflipped raster target', () => {
    expect(
      mapSelectionRectToSourceRect(
        { x: 40, y: 30, width: 120, height: 60 },
        { x: 20, y: 10, width: 240, height: 120 },
        { width: 480, height: 240 },
      ),
    ).toEqual({
      x: 40,
      y: 40,
      width: 240,
      height: 120,
    });
  });

  it('mirrors the source selection when the target is flipped horizontally', () => {
    expect(
      mapSelectionRectToSourceRect(
        { x: 40, y: 30, width: 120, height: 60 },
        { x: 20, y: 10, width: 240, height: 120 },
        { width: 480, height: 240 },
        { x: -1, y: 1 },
      ),
    ).toEqual({
      x: 200,
      y: 40,
      width: 240,
      height: 120,
    });
  });
});

describe('extractRasterSelection', () => {
  it('extracts the selected source pixels into a new raster surface', () => {
    const source = new Uint8ClampedArray(4 * 4 * 4);
    const sourceOffset = (1 * 4 + 1) * 4;
    source[sourceOffset] = 255;
    source[sourceOffset + 3] = 255;

    const extracted = extractRasterSelection(
      {
        width: 4,
        height: 4,
        data: source,
      },
      { x: 1, y: 1, width: 2, height: 2 },
    );

    expect(extracted.width).toBe(2);
    expect(extracted.height).toBe(2);
    expect(extracted.data[0]).toBe(255);
    expect(extracted.data[3]).toBe(255);
  });
});

describe('clearRasterSelection', () => {
  it('clears the selected pixels to transparency without changing other pixels', () => {
    const source = new Uint8ClampedArray(4 * 4 * 4);
    const clearedOffset = (1 * 4 + 1) * 4;
    const untouchedOffset = (3 * 4 + 3) * 4;
    source[clearedOffset] = 255;
    source[clearedOffset + 3] = 255;
    source[untouchedOffset + 1] = 200;
    source[untouchedOffset + 3] = 255;

    const cleared = clearRasterSelection(
      {
        width: 4,
        height: 4,
        data: source,
      },
      { x: 1, y: 1, width: 1, height: 1 },
    );

    expect(cleared.data[clearedOffset]).toBe(0);
    expect(cleared.data[clearedOffset + 3]).toBe(0);
    expect(cleared.data[untouchedOffset + 1]).toBe(200);
    expect(cleared.data[untouchedOffset + 3]).toBe(255);
  });
});
