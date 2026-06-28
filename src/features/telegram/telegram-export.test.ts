import { describe, expect, it } from 'vitest';

import { resolveTelegramExportCapabilities } from './telegram-export';

describe('resolveTelegramExportCapabilities', () => {
  it('keeps the normal browser policy on the web route', () => {
    expect(
      resolveTelegramExportCapabilities({
        hostMode: 'web',
        canCopyImage: true,
        canDownloadImage: true,
        telegramWebApp: null,
      }),
    ).toEqual({
      canCopyImage: true,
      canDownloadImage: true,
      canShareMessage: false,
      canDownloadFile: false,
    });
  });

  it('exposes Telegram-native fallbacks when the sdk supports them', () => {
    expect(
      resolveTelegramExportCapabilities({
        hostMode: 'telegram',
        canCopyImage: false,
        canDownloadImage: false,
        telegramWebApp: {
          shareMessage: () => undefined,
          downloadFile: () => undefined,
        },
      }),
    ).toEqual({
      canCopyImage: false,
      canDownloadImage: false,
      canShareMessage: true,
      canDownloadFile: true,
    });
  });
});
