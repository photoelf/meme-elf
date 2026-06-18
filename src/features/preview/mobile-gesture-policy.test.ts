import { describe, expect, it } from 'vitest';

import {
  isPointWithinHandleHitSlop,
  resolveMobileGestureOwner,
  resolveTouchHandleSize,
} from './mobile-gesture-policy';

describe('mobile gesture policy', () => {
  it('routes touch draw gestures to the active retouch tool instead of pan', () => {
    expect(
      resolveMobileGestureOwner({
        hasLayerAtPoint: false,
        hasSelectionTarget: false,
        isSceneCropMode: false,
        pointerType: 'touch',
        retouchMode: 'draw',
        targetType: 'surface',
      }),
    ).toBe('draw');
  });

  it('routes touch crop gestures before generic pan handling', () => {
    expect(
      resolveMobileGestureOwner({
        hasLayerAtPoint: false,
        hasSelectionTarget: false,
        isSceneCropMode: true,
        pointerType: 'touch',
        retouchMode: 'idle',
        targetType: 'crop-handle',
      }),
    ).toBe('crop');
  });

  it('uses pan as the mobile fallback for blank-surface touches in idle mode', () => {
    expect(
      resolveMobileGestureOwner({
        hasLayerAtPoint: false,
        hasSelectionTarget: false,
        isSceneCropMode: false,
        pointerType: 'touch',
        retouchMode: 'idle',
        targetType: 'surface',
      }),
    ).toBe('pan');
  });

  it('expands handle targets for touch more than mouse', () => {
    expect(resolveTouchHandleSize('touch')).toBeGreaterThan(resolveTouchHandleSize('mouse'));
  });

  it('accepts points inside the expanded touch hit slop around a small handle', () => {
    expect(
      isPointWithinHandleHitSlop(
        { x: 12, y: 12 },
        {
          pointerType: 'touch',
          rect: { x: 20, y: 20, width: 14, height: 14 },
        },
      ),
    ).toBe(true);
  });
});
