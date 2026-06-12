import { describe, expect, it } from 'vitest';

import { resolveBoundsFill } from './fill-modes';

describe('resolveBoundsFill', () => {
  it('returns null for transparent mode', () => {
    expect(
      resolveBoundsFill({
        fillMode: 'transparent',
        solidColor: '#112233',
        borderPixels: [0, 0, 0, 255],
        side: 'left',
      }),
    ).toBeNull();
  });

  it('returns the explicit fill color for solid-color mode', () => {
    expect(
      resolveBoundsFill({
        fillMode: 'solid-color',
        solidColor: '#112233',
        borderPixels: [],
        side: 'left',
      }),
    ).toBe('#112233');
  });

  it('returns the middle border sample for sampled-edge mode', () => {
    expect(
      resolveBoundsFill({
        fillMode: 'sampled-edge',
        solidColor: '#112233',
        borderPixels: [
          10, 20, 30, 255,
          60, 90, 120, 255,
          200, 210, 220, 255,
        ],
        side: 'top',
      }),
    ).toBe('#3c5a78');
  });

  it('returns the rounded average border color for average-border mode', () => {
    expect(
      resolveBoundsFill({
        fillMode: 'average-border',
        solidColor: '#112233',
        borderPixels: [
          0, 0, 0, 255,
          120, 150, 180, 255,
          240, 210, 180, 255,
        ],
        side: 'bottom',
      }),
    ).toBe('#787878');
  });
});
