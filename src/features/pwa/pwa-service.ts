type StandaloneLaunchWindow = {
  matchMedia?: (query: string) => { matches: boolean };
  navigator: Navigator & { standalone?: boolean };
};

export function detectStandaloneMode(input: {
  matchMediaStandalone: boolean;
  navigatorStandalone: boolean;
}) {
  return input.matchMediaStandalone || input.navigatorStandalone;
}

export function getStandaloneLaunchState(win: StandaloneLaunchWindow = window) {
  const matchMediaStandalone =
    typeof win.matchMedia === 'function' &&
    win.matchMedia('(display-mode: standalone)').matches;
  const navigatorStandalone = win.navigator.standalone === true;

  return {
    isStandalone: detectStandaloneMode({
      matchMediaStandalone,
      navigatorStandalone,
    }),
    matchMediaStandalone,
    navigatorStandalone,
  };
}
