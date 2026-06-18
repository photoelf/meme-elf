import type { MobileGestureOwner, RetouchState } from '../../app/types';

export type MobileGestureTargetType =
  | 'surface'
  | 'layer'
  | 'transform-handle'
  | 'crop-area'
  | 'crop-handle';

export type ResolveMobileGestureOwnerInput = {
  hasLayerAtPoint: boolean;
  hasSelectionTarget: boolean;
  isSceneCropMode: boolean;
  pointerType: string | null;
  retouchMode: RetouchState['mode'];
  targetType: MobileGestureTargetType;
};

const POINTER_TOUCH_HANDLE_SIZE = 30;
const POINTER_MOUSE_HANDLE_SIZE = 14;

export function isTouchPointer(pointerType: string | null | undefined) {
  return pointerType === 'touch';
}

export function resolveTouchHandleSize(pointerType: string | null | undefined) {
  return isTouchPointer(pointerType) ? POINTER_TOUCH_HANDLE_SIZE : POINTER_MOUSE_HANDLE_SIZE;
}

export function isPointWithinHandleHitSlop(
  point: { x: number; y: number },
  input: {
    pointerType: string | null;
    rect: { x: number; y: number; width: number; height: number };
  },
) {
  const handleSize = resolveTouchHandleSize(input.pointerType);
  const extraX = Math.max(0, (handleSize - input.rect.width) / 2);
  const extraY = Math.max(0, (handleSize - input.rect.height) / 2);

  return (
    point.x >= input.rect.x - extraX &&
    point.x <= input.rect.x + input.rect.width + extraX &&
    point.y >= input.rect.y - extraY &&
    point.y <= input.rect.y + input.rect.height + extraY
  );
}

export function resolveMobileGestureOwner(
  input: ResolveMobileGestureOwnerInput,
): MobileGestureOwner {
  if (!isTouchPointer(input.pointerType)) {
    return 'idle';
  }

  if (input.isSceneCropMode || input.targetType === 'crop-area' || input.targetType === 'crop-handle') {
    return 'crop';
  }

  if (input.targetType === 'transform-handle') {
    return 'transform';
  }

  switch (input.retouchMode) {
    case 'draw':
      return 'draw';
    case 'erase':
      return 'erase';
    case 'clone-stamp':
      return 'clone-stamp';
    case 'eyedropper':
      return 'eyedropper';
    case 'select':
      return input.hasSelectionTarget ? 'select' : 'pan';
    case 'idle':
      return input.hasLayerAtPoint ? 'focus-layer' : 'pan';
  }
}
