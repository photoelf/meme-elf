import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  blurTooltipButtonAfterTouch,
  handleTooltipTouchClick,
  handleTooltipTouchFocus,
  handleTooltipTouchPointerDown,
  handleTooltipTouchStart,
} from './tooltip-touch-focus';

describe('tooltip touch focus helpers', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('blurs tapped tooltip buttons after touch clicks', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame'] });

    const button = document.createElement('button');
    const blurSpy = vi.spyOn(button, 'blur');

    handleTooltipTouchPointerDown({
      currentTarget: button,
      pointerType: 'touch',
    } as ReactPointerEvent<HTMLButtonElement>);
    handleTooltipTouchClick({
      currentTarget: button,
    } as ReactMouseEvent<HTMLButtonElement>);

    expect(blurSpy).not.toHaveBeenCalled();

    vi.runAllTimers();

    expect(blurSpy).toHaveBeenCalledTimes(1);
    expect(button.dataset.touchTooltipPointer).toBeUndefined();
  });

  it('ignores non-touch tooltip clicks', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame'] });

    const button = document.createElement('button');
    const blurSpy = vi.spyOn(button, 'blur');

    handleTooltipTouchPointerDown({
      currentTarget: button,
      pointerType: 'mouse',
    } as ReactPointerEvent<HTMLButtonElement>);
    handleTooltipTouchClick({
      currentTarget: button,
    } as ReactMouseEvent<HTMLButtonElement>);
    blurTooltipButtonAfterTouch(button);

    vi.runAllTimers();

    expect(blurSpy).not.toHaveBeenCalled();
    expect(button.dataset.touchTooltipPointer).toBeUndefined();
  });

  it('marks tooltip buttons from touchstart fallback events', () => {
    const button = document.createElement('button');

    handleTooltipTouchStart({
      currentTarget: button,
    } as ReactTouchEvent<HTMLButtonElement>);

    expect(button.dataset.touchTooltipPointer).toBe('true');
  });

  it('blurs focused tooltip buttons when the focus came from touch', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame'] });

    const button = document.createElement('button');
    const blurSpy = vi.spyOn(button, 'blur');

    handleTooltipTouchStart({
      currentTarget: button,
    } as ReactTouchEvent<HTMLButtonElement>);
    handleTooltipTouchFocus({
      currentTarget: button,
    } as ReactFocusEvent<HTMLButtonElement>);

    expect(blurSpy).not.toHaveBeenCalled();

    vi.runAllTimers();

    expect(blurSpy).toHaveBeenCalledTimes(1);
    expect(button.dataset.touchTooltipPointer).toBeUndefined();
  });
});
