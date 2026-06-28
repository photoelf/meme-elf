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

function isFiniteInsetValue(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function normalizeTelegramInset(
  value: unknown,
  fallback: TelegramInset = DEFAULT_INSET,
): TelegramInset {
  if (!value || typeof value !== 'object') {
    return fallback;
  }

  const candidate = value as Partial<TelegramInset>;

  return {
    top: isFiniteInsetValue(candidate.top) ? candidate.top : fallback.top,
    right: isFiniteInsetValue(candidate.right) ? candidate.right : fallback.right,
    bottom: isFiniteInsetValue(candidate.bottom) ? candidate.bottom : fallback.bottom,
    left: isFiniteInsetValue(candidate.left) ? candidate.left : fallback.left,
  };
}

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
    safeAreaInset: normalizeTelegramInset(webApp.safeAreaInset),
    contentSafeAreaInset: normalizeTelegramInset(webApp.contentSafeAreaInset),
  };
}
