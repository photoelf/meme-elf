import { describe, expect, it } from 'vitest';

import { getAppRouteState, resolveAppHostMode } from './telegram-route';

describe('resolveAppHostMode', () => {
  it('treats the default route as web', () => {
    expect(resolveAppHostMode('/')).toBe('web');
  });

  it('treats /t as the Telegram surface', () => {
    expect(resolveAppHostMode('/t')).toBe('telegram');
  });

  it('treats nested Telegram paths as the Telegram surface', () => {
    expect(resolveAppHostMode('/t/share')).toBe('telegram');
  });
});

describe('getAppRouteState', () => {
  it('preserves the original pathname and search for Telegram launches', () => {
    expect(
      getAppRouteState({
        pathname: '/t',
        search: '?startapp=invite42',
      }),
    ).toEqual({
      hostMode: 'telegram',
      isTelegramRoute: true,
      pathname: '/t',
      search: '?startapp=invite42',
    });
  });
});
