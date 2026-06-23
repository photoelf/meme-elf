import { describe, expect, it } from 'vitest';
import { detectStandaloneMode } from './pwa-service';

describe('detectStandaloneMode', () => {
  it('detects ios standalone mode from navigator.standalone', () => {
    expect(
      detectStandaloneMode({
        matchMediaStandalone: false,
        navigatorStandalone: true,
      }),
    ).toBe(true);
  });

  it('detects standard standalone mode from display-mode media query', () => {
    expect(
      detectStandaloneMode({
        matchMediaStandalone: true,
        navigatorStandalone: false,
      }),
    ).toBe(true);
  });
});
