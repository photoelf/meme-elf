import { describe, expect, it } from 'vitest';

import type { SceneCropDraftRect } from '../../app/types';
import { normalizeSceneCropRect } from './crop-overlay';

describe('normalizeSceneCropRect', () => {
  it('normalizes a drag from bottom-right to top-left into a top-left crop rect', () => {
    const draft: SceneCropDraftRect = {
      startX: 720,
      startY: 420,
      endX: 120,
      endY: 80,
    };

    expect(
      normalizeSceneCropRect(draft, {
        width: 1200,
        height: 800,
      }),
    ).toEqual({
      x: 120,
      y: 80,
      width: 600,
      height: 340,
    });
  });

  it('clamps crop coordinates to the current canvas bounds', () => {
    const draft: SceneCropDraftRect = {
      startX: -40,
      startY: -25,
      endX: 860,
      endY: 490,
    };

    expect(
      normalizeSceneCropRect(draft, {
        width: 800,
        height: 450,
      }),
    ).toEqual({
      x: 0,
      y: 0,
      width: 800,
      height: 450,
    });
  });
});
