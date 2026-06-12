import type { SceneCropDraftRect } from '../../app/types';

export function normalizeSceneCropRect(
  draft: SceneCropDraftRect,
  canvasSize: { width: number; height: number },
) {
  const left = clamp(Math.min(draft.startX, draft.endX), 0, canvasSize.width);
  const top = clamp(Math.min(draft.startY, draft.endY), 0, canvasSize.height);
  const right = clamp(Math.max(draft.startX, draft.endX), 0, canvasSize.width);
  const bottom = clamp(Math.max(draft.startY, draft.endY), 0, canvasSize.height);

  return {
    x: left,
    y: top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
