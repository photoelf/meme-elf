export function detectStandaloneMode(input: {
  matchMediaStandalone: boolean;
  navigatorStandalone: boolean;
}) {
  return input.matchMediaStandalone || input.navigatorStandalone;
}

export function getStandaloneLaunchState(win: Window = window) {
  const matchMediaStandalone =
    typeof win.matchMedia === 'function' &&
    win.matchMedia('(display-mode: standalone)').matches;
  const navigatorStandalone =
    'standalone' in win.navigator &&
    (win.navigator as Navigator & { standalone?: boolean }).standalone === true;

  return {
    isStandalone: detectStandaloneMode({
      matchMediaStandalone,
      navigatorStandalone,
    }),
    matchMediaStandalone,
    navigatorStandalone,
  };
}
