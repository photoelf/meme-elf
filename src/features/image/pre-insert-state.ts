import type { PreInsertModalDraft, PreviewRotationQuarterTurns } from '../../app/types';

const QUARTER_TURN_COUNT = 4;

export function rotateDraftClockwise(
  rotationQuarterTurns: PreviewRotationQuarterTurns,
): PreviewRotationQuarterTurns {
  return normalizeQuarterTurns(rotationQuarterTurns + 1);
}

export function rotateDraftCounterClockwise(
  rotationQuarterTurns: PreviewRotationQuarterTurns,
): PreviewRotationQuarterTurns {
  return normalizeQuarterTurns(rotationQuarterTurns - 1);
}

export function toggleDraftFlipHorizontal(
  draft: PreInsertModalDraft,
): PreInsertModalDraft {
  return {
    ...draft,
    flipHorizontal: !draft.flipHorizontal,
  };
}

export function toggleDraftFlipVertical(
  draft: PreInsertModalDraft,
): PreInsertModalDraft {
  return {
    ...draft,
    flipVertical: !draft.flipVertical,
  };
}

function normalizeQuarterTurns(value: number): PreviewRotationQuarterTurns {
  return ((value % QUARTER_TURN_COUNT) + QUARTER_TURN_COUNT) %
    QUARTER_TURN_COUNT as PreviewRotationQuarterTurns;
}
