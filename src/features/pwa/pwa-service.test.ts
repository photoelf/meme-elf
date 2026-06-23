import { describe, expect, it } from 'vitest';
import { detectStandaloneMode, getStandaloneLaunchState } from './pwa-service';

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

  it('returns false for the normal browser path', () => {
    expect(
      detectStandaloneMode({
        matchMediaStandalone: false,
        navigatorStandalone: false,
      }),
    ).toBe(false);
  });
});

describe('getStandaloneLaunchState', () => {
  it('detects standalone mode from the display-mode media query', () => {
    expect(
      getStandaloneLaunchState(createWindowStub({ matchMediaStandalone: true })),
    ).toEqual({
      isStandalone: true,
      matchMediaStandalone: true,
      navigatorStandalone: false,
    });
  });

  it('detects standalone mode from safari navigator.standalone', () => {
    expect(
      getStandaloneLaunchState(createWindowStub({ navigatorStandalone: true })),
    ).toEqual({
      isStandalone: true,
      matchMediaStandalone: false,
      navigatorStandalone: true,
    });
  });

  it('returns false for the normal browser path', () => {
    expect(
      getStandaloneLaunchState(
        createWindowStub({
          matchMediaStandalone: false,
          navigatorStandalone: false,
        }),
      ),
    ).toEqual({
      isStandalone: false,
      matchMediaStandalone: false,
      navigatorStandalone: false,
    });
  });
});

function createWindowStub(input: {
  matchMediaStandalone?: boolean;
  navigatorStandalone?: boolean;
}) {
  return {
    matchMedia: () => ({
      matches: input.matchMediaStandalone ?? false,
    }),
    navigator: {
      standalone: input.navigatorStandalone ?? false,
    },
  };
}
