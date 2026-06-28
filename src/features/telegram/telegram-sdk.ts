export const TELEGRAM_SDK_URL = 'https://telegram.org/js/telegram-web-app.js?62';
const TELEGRAM_SDK_SCRIPT_SELECTOR = 'script[data-telegram-sdk="true"]';

export type TelegramWebAppLike = {
  ready?: () => void;
  expand?: () => void;
  requestFullscreen?: () => void;
  disableVerticalSwipes?: () => void;
  enableVerticalSwipes?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  onEvent?: (eventName: string, listener: (...args: unknown[]) => void) => void;
  offEvent?: (eventName: string, listener: (...args: unknown[]) => void) => void;
  BackButton?: {
    show?: () => void;
    hide?: () => void;
    onClick?: (listener: () => void) => void;
    offClick?: (listener: () => void) => void;
  };
  themeParams?: Record<string, string>;
  colorScheme?: string;
  isFullscreen?: boolean;
  safeAreaInset?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  contentSafeAreaInset?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  shareMessage?: () => void;
  downloadFile?: () => void;
};

export type TelegramWindowLike = Window &
  typeof globalThis & {
    Telegram?: {
      WebApp?: TelegramWebAppLike;
    };
  };

export function detectTelegramWebApp(win: TelegramWindowLike) {
  return win.Telegram?.WebApp ?? null;
}

function waitForExistingScript(script: HTMLScriptElement, win: TelegramWindowLike) {
  return new Promise<TelegramWebAppLike | null>((resolve, reject) => {
    const handleLoad = () => {
      cleanup();
      resolve(detectTelegramWebApp(win));
    };
    const handleError = () => {
      cleanup();
      reject(new Error('Telegram SDK failed to load.'));
    };
    const cleanup = () => {
      script.removeEventListener('load', handleLoad);
      script.removeEventListener('error', handleError);
    };

    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });
  });
}

export function loadTelegramSdk(input: {
  document?: Document;
  window?: TelegramWindowLike;
}) {
  const doc = input.document ?? document;
  const win = input.window ?? (window as TelegramWindowLike);
  const existing = detectTelegramWebApp(win);

  if (existing) {
    return Promise.resolve(existing);
  }

  const pendingScript = doc.querySelector(TELEGRAM_SDK_SCRIPT_SELECTOR);
  if (pendingScript instanceof HTMLScriptElement) {
    return waitForExistingScript(pendingScript, win);
  }

  const script = doc.createElement('script');
  script.src = TELEGRAM_SDK_URL;
  script.async = true;
  script.dataset.telegramSdk = 'true';
  doc.head.appendChild(script);

  return waitForExistingScript(script, win);
}
