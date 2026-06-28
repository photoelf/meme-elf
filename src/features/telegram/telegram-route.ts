export type AppHostMode = 'web' | 'telegram';
export type AppRouteState = {
  hostMode: AppHostMode;
  isTelegramRoute: boolean;
  pathname: string;
  search: string;
};

export function resolveAppHostMode(pathname: string): AppHostMode {
  return pathname === '/t' || pathname.startsWith('/t/') ? 'telegram' : 'web';
}

export function getAppRouteState(
  locationLike: Pick<Location, 'pathname' | 'search'> = window.location,
): AppRouteState {
  const hostMode = resolveAppHostMode(locationLike.pathname);

  return {
    hostMode,
    isTelegramRoute: hostMode === 'telegram',
    pathname: locationLike.pathname,
    search: locationLike.search,
  };
}
