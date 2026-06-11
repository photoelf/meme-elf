import { describe, expect, it } from 'vitest';

import type { PreInsertModalDraft } from '../../app/types';
import {
  rotateDraftClockwise,
  rotateDraftCounterClockwise,
  toggleDraftFlipHorizontal,
  toggleDraftFlipVertical,
} from './pre-insert-state';

describe('rotateDraftClockwise', () => {
  it('wraps preview rotation forward in quarter turns', () => {
    expect(rotateDraftClockwise(0)).toBe(1);
    expect(rotateDraftClockwise(3)).toBe(0);
  });
});

describe('rotateDraftCounterClockwise', () => {
  it('wraps preview rotation backward in quarter turns', () => {
    expect(rotateDraftCounterClockwise(0)).toBe(3);
    expect(rotateDraftCounterClockwise(2)).toBe(1);
  });
});

describe('toggleDraftFlipHorizontal', () => {
  it('toggles only the horizontal preview flip state while preserving the rest of the draft', () => {
    const draft = createDraft({ flipHorizontal: false, flipVertical: true });

    expect(toggleDraftFlipHorizontal(draft)).toEqual({
      ...draft,
      flipHorizontal: true,
      flipVertical: true,
    });
  });
});

describe('toggleDraftFlipVertical', () => {
  it('toggles only the vertical preview flip state while preserving the rest of the draft', () => {
    const draft = createDraft({ flipHorizontal: true, flipVertical: false });

    expect(toggleDraftFlipVertical(draft)).toEqual({
      ...draft,
      flipHorizontal: true,
      flipVertical: true,
    });
  });
});

function createDraft(
  overrides: Partial<Pick<PreInsertModalDraft, 'flipHorizontal' | 'flipVertical'>> = {},
): PreInsertModalDraft {
  return {
    pendingSource: {
      sourceKind: 'upload-image',
      image: null,
      sourceSize: { width: 640, height: 480 },
    },
    cropBox: {
      startX: 30,
      startY: 20,
      endX: 300,
      endY: 220,
    },
    rotationQuarterTurns: 2,
    flipHorizontal: false,
    flipVertical: false,
    advancedPlacementMode: 'outside-bottom',
    ...overrides,
  };
}
