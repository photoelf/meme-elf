import { describe, expect, it } from 'vitest';

import {
  createTelegramHostSnapshot,
  getDefaultTelegramHostState,
  normalizeTelegramInset,
} from './telegram-host';

describe('createTelegramHostSnapshot', () => {
  it('maps a missing Telegram runtime to a safe fallback state', () => {
    expect(createTelegramHostSnapshot(null)).toEqual(getDefaultTelegramHostState());
  });

  it('maps safe-area and fullscreen fields when Telegram is present', () => {
    expect(
      createTelegramHostSnapshot({
        isFullscreen: true,
        safeAreaInset: { top: 12, right: 0, bottom: 8, left: 0 },
        contentSafeAreaInset: { top: 16, right: 0, bottom: 12, left: 0 },
        themeParams: { bg_color: '#ffffff' },
      }),
    ).toMatchObject({
      isAvailable: true,
      isFullscreen: true,
      safeAreaInset: { top: 12, bottom: 8 },
      contentSafeAreaInset: { top: 16, bottom: 12 },
    });
  });

  it('normalizes partial or invalid inset payloads onto a stable box model', () => {
    expect(
      normalizeTelegramInset({
        top: 20,
        bottom: 8,
      }),
    ).toEqual({
      top: 20,
      right: 0,
      bottom: 8,
      left: 0,
    });

    expect(normalizeTelegramInset(null)).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
  });
});
