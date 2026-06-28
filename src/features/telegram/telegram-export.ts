import type { AppHostMode } from './telegram-route';
import type { TelegramWebAppLike } from './telegram-sdk';

export function resolveTelegramExportCapabilities(input: {
  hostMode: AppHostMode;
  canCopyImage: boolean;
  canDownloadImage: boolean;
  telegramWebApp: Pick<TelegramWebAppLike, 'shareMessage' | 'downloadFile'> | null;
}) {
  return {
    canCopyImage: input.canCopyImage,
    canDownloadImage: input.canDownloadImage,
    canShareMessage:
      input.hostMode === 'telegram' &&
      typeof input.telegramWebApp?.shareMessage === 'function',
    canDownloadFile:
      input.hostMode === 'telegram' &&
      typeof input.telegramWebApp?.downloadFile === 'function',
  };
}
