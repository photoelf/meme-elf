import { describe, expect, it } from 'vitest';

import { rasterizeBrushStroke } from './brush-engine';

describe('rasterizeBrushStroke', () => {
  it('returns non-empty stamp coverage for a simple drag path', () => {
    const stroke = rasterizeBrushStroke({
      brush: {
        color: '#ff0000',
        size: 8,
      },
      height: 48,
      points: [
        { x: 8, y: 8 },
        { x: 24, y: 24 },
        { x: 40, y: 40 },
      ],
      width: 48,
    });

    const alphaValues = Array.from(stroke.data).filter((_, index) => index % 4 === 3);
    expect(alphaValues.some((value) => value > 0)).toBe(true);

    const centerIndex = (24 * 48 + 24) * 4;
    expect(stroke.data[centerIndex]).toBe(255);
    expect(stroke.data[centerIndex + 1]).toBe(0);
    expect(stroke.data[centerIndex + 2]).toBe(0);
    expect(stroke.data[centerIndex + 3]).toBe(255);
  });

  it('uses a softer alpha falloff near the edge when softEdge is enabled', () => {
    const hardStroke = rasterizeBrushStroke({
      brush: {
        color: '#ff0000',
        size: 12,
        softEdge: false,
      },
      height: 24,
      points: [{ x: 12, y: 12 }],
      width: 24,
    });
    const softStroke = rasterizeBrushStroke({
      brush: {
        color: '#ff0000',
        size: 12,
        softEdge: true,
      },
      height: 24,
      points: [{ x: 12, y: 12 }],
      width: 24,
    });

    const centerAlphaOffset = (12 * 24 + 12) * 4 + 3;
    const edgeAlphaOffset = (12 * 24 + 17) * 4 + 3;

    expect(hardStroke.data[centerAlphaOffset]).toBe(255);
    expect(softStroke.data[centerAlphaOffset]).toBe(255);
    expect(hardStroke.data[edgeAlphaOffset]).toBe(255);
    expect(softStroke.data[edgeAlphaOffset]).toBeGreaterThan(0);
    expect(softStroke.data[edgeAlphaOffset]).toBeLessThan(hardStroke.data[edgeAlphaOffset] ?? 0);
  });
});
