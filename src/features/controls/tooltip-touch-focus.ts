import type {
  FocusEvent as ReactFocusEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  TouchEvent as ReactTouchEvent,
} from 'react';

const TOUCH_TOOLTIP_FOCUS_DATASET_KEY = 'touchTooltipPointer';

export function handleTooltipTouchPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
  if (event.pointerType === 'touch') {
    markTooltipTouchTarget(event.currentTarget);
  } else {
    clearTooltipTouchTarget(event.currentTarget);
  }
}

export function handleTooltipTouchStart(event: ReactTouchEvent<HTMLButtonElement>) {
  markTooltipTouchTarget(event.currentTarget);
}

export function handleTooltipTouchClick(event: ReactMouseEvent<HTMLButtonElement>) {
  blurTooltipButtonAfterTouch(event.currentTarget);
}

export function handleTooltipTouchFocus(event: ReactFocusEvent<HTMLButtonElement>) {
  blurTooltipButtonAfterTouch(event.currentTarget);
}

export function blurTooltipButtonAfterTouch(button: HTMLButtonElement) {
  if (button.dataset[TOUCH_TOOLTIP_FOCUS_DATASET_KEY] !== 'true') {
    return;
  }

  window.requestAnimationFrame(() => {
    button.blur();
    clearTooltipTouchTarget(button);
  });
}

function markTooltipTouchTarget(button: HTMLButtonElement) {
  button.dataset[TOUCH_TOOLTIP_FOCUS_DATASET_KEY] = 'true';
}

function clearTooltipTouchTarget(button: HTMLButtonElement) {
  delete button.dataset[TOUCH_TOOLTIP_FOCUS_DATASET_KEY];
}
