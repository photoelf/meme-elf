import { describe, expect, it } from 'vitest';

import {
  canCopyImageToClipboard,
  resolveMobileExportMessage,
} from './mobile-export-fallbacks';

describe('mobile-export-fallbacks', () => {
  it('allows direct copy only when clipboard write and ClipboardItem are both available', () => {
    expect(
      canCopyImageToClipboard({
        hasClipboardItem: true,
        hasClipboardWrite: true,
        isSecureContext: true,
      }),
    ).toBe(true);

    expect(
      canCopyImageToClipboard({
        hasClipboardItem: false,
        hasClipboardWrite: true,
        isSecureContext: true,
      }),
    ).toBe(false);

    expect(
      canCopyImageToClipboard({
        hasClipboardItem: true,
        hasClipboardWrite: false,
        isSecureContext: true,
      }),
    ).toBe(false);

    expect(
      canCopyImageToClipboard({
        hasClipboardItem: true,
        hasClipboardWrite: true,
        isSecureContext: false,
      }),
    ).toBe(false);
  });

  it('maps export outcomes to concise fallback messaging', () => {
    expect(resolveMobileExportMessage('copy-success')).toBe('Image copied to the clipboard.');
    expect(resolveMobileExportMessage('clipboard-unsupported')).toBe(
      'Direct image copy is not supported in this browser. Press and hold the image to save or copy it.',
    );
    expect(resolveMobileExportMessage('secure-context-required')).toBe(
      'Direct image copy needs HTTPS or another secure context in this browser. Press and hold the image to save or copy it.',
    );
    expect(resolveMobileExportMessage('blob-unavailable')).toBe(
      'The image could not be copied. Press and hold the image to save or copy it.',
    );
    expect(resolveMobileExportMessage('clipboard-blocked')).toBe(
      'Clipboard copy was blocked by the browser. Press and hold the image to save or copy it.',
    );
  });

  it('maps Telegram-aware export capabilities to route-specific fallback messaging', () => {
    expect(
      resolveMobileExportMessage({
        hostMode: 'telegram',
        canCopyImage: false,
        canDownloadImage: false,
        canShareMessage: true,
      }),
    ).toBe('Telegram can share the exported meme directly if clipboard copy is unavailable.');

    expect(
      resolveMobileExportMessage({
        hostMode: 'telegram',
        canCopyImage: false,
        canDownloadImage: false,
        canDownloadFile: true,
      }),
    ).toBe('Telegram can hand the exported meme to the native file-download flow here.');

    expect(
      resolveMobileExportMessage({
        hostMode: 'web',
        canCopyImage: false,
        canDownloadImage: true,
      }),
    ).toBe('If direct copy is unavailable, use the image fallback and save or share it manually.');
  });
});
