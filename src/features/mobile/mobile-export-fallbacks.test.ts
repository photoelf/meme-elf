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
});
