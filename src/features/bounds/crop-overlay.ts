import type { SceneCropDraftRect } from '../../app/types';

type SceneCropInteractionGeometry = {
  handleOffset: number;
  handleSize: number;
  moveHitboxInset: number;
  overlayBorderWidth: number;
  overlayClassName: string;
  overlayFill: string;
};

const MOUSE_CROP_INTERACTION_GEOMETRY: SceneCropInteractionGeometry = {
  handleOffset: 7,
  handleSize: 14,
  moveHitboxInset: 0,
  overlayBorderWidth: 1,
  overlayClassName: 'scene-crop-overlay',
  overlayFill: 'rgba(51, 199, 241, 0.16)',
};

const TOUCH_CROP_INTERACTION_GEOMETRY: SceneCropInteractionGeometry = {
  handleOffset: 22,
  handleSize: 44,
  moveHitboxInset: 14,
  overlayBorderWidth: 2,
  overlayClassName: 'scene-crop-overlay scene-crop-overlay-touch',
  overlayFill: 'rgba(51, 199, 241, 0.24)',
};

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

export function resolveSceneCropInteractionGeometry(pointerType: string | null | undefined) {
  return resolveTouchSafeCropGeometry(pointerType);
}

export function resolveTouchSafeCropGeometry(pointerType: string | null | undefined) {
  return pointerType === 'touch'
    ? TOUCH_CROP_INTERACTION_GEOMETRY
    : MOUSE_CROP_INTERACTION_GEOMETRY;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
