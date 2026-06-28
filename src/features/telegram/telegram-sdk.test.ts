import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  TELEGRAM_SDK_URL,
  detectTelegramWebApp,
  loadTelegramSdk,
  type TelegramWindowLike,
} from './telegram-sdk';

beforeEach(() => {
  document
    .querySelectorAll('script[data-telegram-sdk="true"]')
    .forEach((script) => script.remove());
  vi.restoreAllMocks();
});

describe('detectTelegramWebApp', () => {
  it('returns the existing WebApp object when Telegram is already present', () => {
    const webApp = { ready: vi.fn() };

    expect(
      detectTelegramWebApp({
        Telegram: {
          WebApp: webApp,
        },
      } as TelegramWindowLike),
    ).toBe(webApp);
  });
});

describe('loadTelegramSdk', () => {
  it('resolves immediately when Telegram.WebApp already exists', async () => {
    const webApp = { ready: vi.fn() };

    await expect(
      loadTelegramSdk({
        document,
        window: {
          Telegram: { WebApp: webApp },
        } as TelegramWindowLike,
      }),
    ).resolves.toBe(webApp);
  });

  it('injects the official sdk script when Telegram is absent', async () => {
    const headAppendSpy = vi.spyOn(document.head, 'appendChild');
    const pendingWindow = {} as TelegramWindowLike;

    const loadPromise = loadTelegramSdk({
      document,
      window: pendingWindow,
    });

    expect(TELEGRAM_SDK_URL).toBe('https://telegram.org/js/telegram-web-app.js?62');
    expect(headAppendSpy).toHaveBeenCalledTimes(1);

    const script = headAppendSpy.mock.calls[0]?.[0] as HTMLScriptElement;
    expect(script.src).toBe(TELEGRAM_SDK_URL);

    pendingWindow.Telegram = {
      WebApp: { ready: vi.fn() },
    };

    script.dispatchEvent(new Event('load'));

    await expect(loadPromise).resolves.toBe(pendingWindow.Telegram.WebApp);
  });

  it('reuses an already injected sdk script while load is pending', async () => {
    const headAppendSpy = vi.spyOn(document.head, 'appendChild');
    const pendingWindow = {} as TelegramWindowLike;

    const firstLoad = loadTelegramSdk({
      document,
      window: pendingWindow,
    });
    const secondLoad = loadTelegramSdk({
      document,
      window: pendingWindow,
    });

    expect(headAppendSpy).toHaveBeenCalledTimes(1);

    const script = headAppendSpy.mock.calls[0]?.[0] as HTMLScriptElement;
    pendingWindow.Telegram = {
      WebApp: { expand: vi.fn() },
    };
    script.dispatchEvent(new Event('load'));

    await expect(firstLoad).resolves.toBe(pendingWindow.Telegram.WebApp);
    await expect(secondLoad).resolves.toBe(pendingWindow.Telegram.WebApp);
  });

  it('rejects when the sdk script fails to load', async () => {
    const headAppendSpy = vi.spyOn(document.head, 'appendChild');

    const loadPromise = loadTelegramSdk({
      document,
      window: {} as TelegramWindowLike,
    });

    const script = headAppendSpy.mock.calls[0]?.[0] as HTMLScriptElement;
    script.dispatchEvent(new Event('error'));

    await expect(loadPromise).rejects.toThrow('Telegram SDK failed to load.');
  });
});
