import { describe, expect, it } from 'vitest';

import {
  normalizeCropDraftBox,
  resolvePreparedOutputDimensions,
} from './image-crop-utils';

describe('normalizeCropDraftBox', () => {
  it('returns a top-left anchored crop box when the user drags up and left', () => {
    expect(
      normalizeCropDraftBox({
        startX: 240,
        startY: 180,
        endX: 60,
        endY: 30,
      }),
    ).toEqual({
      x: 60,
      y: 30,
      width: 180,
      height: 150,
    });
  });

  it('clamps a dragged crop box to the visible source image bounds', () => {
    expect(
      normalizeCropDraftBox(
        {
          startX: -40,
          startY: 520,
          endX: 900,
          endY: -30,
        },
        { width: 800, height: 450 },
      ),
    ).toEqual({
      x: 0,
      y: 0,
      width: 800,
      height: 450,
    });
  });
});

describe('resolvePreparedOutputDimensions', () => {
  it('uses the normalized crop size before applying quarter-turn rotation', () => {
    expect(
      resolvePreparedOutputDimensions({
        sourceSize: { width: 1000, height: 700 },
        cropBox: {
          startX: 300,
          startY: 640,
          endX: 100,
          endY: 40,
        },
        rotationQuarterTurns: 1,
      }),
    ).toEqual({
      width: 600,
      height: 200,
    });
  });

  it('clamps an out-of-bounds crop before applying rotation', () => {
    expect(
      resolvePreparedOutputDimensions({
        sourceSize: { width: 600, height: 400 },
        cropBox: {
          startX: -100,
          startY: 50,
          endX: 250,
          endY: 700,
        },
        rotationQuarterTurns: 1,
      }),
    ).toEqual({
      width: 350,
      height: 250,
    });
  });

  it('returns zero-area dimensions when the crop drag collapses to a point', () => {
    expect(
      resolvePreparedOutputDimensions({
        sourceSize: { width: 320, height: 200 },
        cropBox: {
          startX: 120,
          startY: 80,
          endX: 120,
          endY: 80,
        },
        rotationQuarterTurns: 3,
      }),
    ).toEqual({
      width: 0,
      height: 0,
    });
  });

  it('falls back to the full source size when no crop box is active', () => {
    expect(
      resolvePreparedOutputDimensions({
        sourceSize: { width: 320, height: 200 },
        cropBox: null,
        rotationQuarterTurns: 2,
      }),
    ).toEqual({
      width: 320,
      height: 200,
    });
  });
});
