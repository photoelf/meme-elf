import type { TelegramWebAppLike } from './telegram-sdk';

type TelegramInset = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type TelegramHostState = {
  isAvailable: boolean;
  isFullscreen: boolean;
  colorScheme: 'light' | 'dark';
  safeAreaInset: TelegramInset;
  contentSafeAreaInset: TelegramInset;
};

const DEFAULT_INSET: TelegramInset = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

export function getDefaultTelegramHostState(): TelegramHostState {
  return {
    isAvailable: false,
    isFullscreen: false,
    colorScheme: 'light',
    safeAreaInset: DEFAULT_INSET,
    contentSafeAreaInset: DEFAULT_INSET,
  };
}

export function createTelegramHostSnapshot(
  webApp: TelegramWebAppLike | null,
): TelegramHostState {
  if (!webApp) {
    return getDefaultTelegramHostState();
  }

  return {
    isAvailable: true,
    isFullscreen: webApp.isFullscreen === true,
    colorScheme: webApp.colorScheme === 'dark' ? 'dark' : 'light',
    safeAreaInset: webApp.safeAreaInset ?? DEFAULT_INSET,
    contentSafeAreaInset: webApp.contentSafeAreaInset ?? DEFAULT_INSET,
  };
}
