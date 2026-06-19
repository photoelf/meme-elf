import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  extractImageFromPasteEvent,
  readImageFromClipboardResult,
  readImageFromClipboard,
  resolveClipboardReadFailureMessage,
} from './clipboard-service';

const originalCreateObjectURL = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
const originalRevokeObjectURL = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
const originalImage = globalThis.Image;
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
const originalIsSecureContext = Object.getOwnPropertyDescriptor(globalThis, 'isSecureContext');

beforeEach(() => {
  Object.defineProperty(globalThis, 'isSecureContext', {
    configurable: true,
    writable: true,
    value: true,
  });
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();

  if (originalCreateObjectURL) {
    Object.defineProperty(URL, 'createObjectURL', originalCreateObjectURL);
  }

  if (originalRevokeObjectURL) {
    Object.defineProperty(URL, 'revokeObjectURL', originalRevokeObjectURL);
  }

  if (originalNavigator) {
    Object.defineProperty(globalThis, 'navigator', originalNavigator);
  }

  if (originalIsSecureContext) {
    Object.defineProperty(globalThis, 'isSecureContext', originalIsSecureContext);
  }

  globalThis.Image = originalImage;
});

function stubImageLoad() {
  class FakeImage {
    onload: null | (() => void) = null;
    onerror: null | (() => void) = null;
    src = '';

    constructor() {
      queueMicrotask(() => this.onload?.());
    }
  }

  vi.stubGlobal('Image', FakeImage as unknown as typeof Image);
}

describe('readImageFromClipboard', () => {
  it('returns an unsupported reason when clipboard read is unavailable', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      writable: true,
      value: {},
    });

    await expect(readImageFromClipboardResult()).resolves.toEqual({
      image: null,
      reason: 'unsupported',
    });
  });

  it('returns a secure-context-required reason when async clipboard read is unavailable on an insecure page', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      writable: true,
      value: {
        clipboard: { read: vi.fn() },
      },
    });
    Object.defineProperty(globalThis, 'isSecureContext', {
      configurable: true,
      writable: true,
      value: false,
    });

    await expect(readImageFromClipboardResult()).resolves.toEqual({
      image: null,
      reason: 'secure-context-required',
    });
  });

  it('returns null when clipboard read is unavailable', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      writable: true,
      value: {},
    });

    const image = await readImageFromClipboard();

    expect(image).toBeNull();
  });

  it('returns null when clipboard read is denied', async () => {
    const read = vi.fn().mockRejectedValue(new Error('NotAllowedError'));

    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      writable: true,
      value: {
        clipboard: { read },
      },
    });

    await expect(readImageFromClipboard()).resolves.toBeNull();
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('returns a permission-denied reason when clipboard read is denied', async () => {
    const read = vi.fn().mockRejectedValue(new Error('NotAllowedError'));

    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      writable: true,
      value: {
        clipboard: { read },
      },
    });

    await expect(readImageFromClipboardResult()).resolves.toEqual({
      image: null,
      reason: 'permission-denied',
    });
  });

  it('loads the first clipboard image blob when available', async () => {
    stubImageLoad();

    const pngBlob = new Blob(['fake'], { type: 'image/png' });
    const read = vi.fn().mockResolvedValue([
      {
        types: ['text/plain'],
        getType: vi.fn(),
      },
      {
        types: ['image/png'],
        getType: vi.fn().mockResolvedValue(pngBlob),
      },
    ]);

    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      writable: true,
      value: {
        clipboard: { read },
      },
    });

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:clipboard-demo');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const image = await readImageFromClipboard();

    expect(read).toHaveBeenCalledTimes(1);
    expect(image).not.toBeNull();
    expect(image?.src).toBe('blob:clipboard-demo');
  });

  it('returns null when the clipboard image cannot be loaded', async () => {
    const pngBlob = new Blob(['fake'], { type: 'image/png' });
    const read = vi.fn().mockResolvedValue([
      {
        types: ['image/png'],
        getType: vi.fn().mockResolvedValue(pngBlob),
      },
    ]);

    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      writable: true,
      value: {
        clipboard: { read },
      },
    });

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:broken-image');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    class FailingImage {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      src = '';

      constructor() {
        queueMicrotask(() => this.onerror?.());
      }
    }

    vi.stubGlobal('Image', FailingImage as unknown as typeof Image);

    await expect(readImageFromClipboard()).resolves.toBeNull();
  });

  it('returns a no-image reason when the clipboard has no image payloads', async () => {
    const read = vi.fn().mockResolvedValue([
      {
        types: ['text/plain'],
        getType: vi.fn(),
      },
    ]);

    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      writable: true,
      value: {
        clipboard: { read },
      },
    });

    await expect(readImageFromClipboardResult()).resolves.toEqual({
      image: null,
      reason: 'no-image',
    });
  });

  it('returns a load-failed reason when image payloads exist but decoding fails', async () => {
    const pngBlob = new Blob(['fake'], { type: 'image/png' });
    const read = vi.fn().mockResolvedValue([
      {
        types: ['image/png'],
        getType: vi.fn().mockResolvedValue(pngBlob),
      },
    ]);

    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      writable: true,
      value: {
        clipboard: { read },
      },
    });

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:broken-image');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    class FailingImage {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      src = '';

      constructor() {
        queueMicrotask(() => this.onerror?.());
      }
    }

    vi.stubGlobal('Image', FailingImage as unknown as typeof Image);

    await expect(readImageFromClipboardResult()).resolves.toEqual({
      image: null,
      reason: 'load-failed',
    });
  });
});

describe('resolveClipboardReadFailureMessage', () => {
  it('maps clipboard read failures to actionable base import guidance', () => {
    expect(resolveClipboardReadFailureMessage('unsupported', 'base-import')).toBe(
      'This browser cannot read images from the clipboard here. Use Upload Image instead.',
    );
    expect(resolveClipboardReadFailureMessage('secure-context-required', 'base-import')).toBe(
      'Clipboard image paste needs HTTPS or another secure context here. Use Upload Image instead.',
    );
    expect(resolveClipboardReadFailureMessage('permission-denied', 'base-import')).toBe(
      'Clipboard access was blocked. Try again or use upload image instead.',
    );
  });

  it('maps clipboard read failures to actionable advanced import guidance', () => {
    expect(resolveClipboardReadFailureMessage('no-image', 'advanced-import')).toBe(
      'No image was found in the clipboard. Copy an image first or use advanced import from file instead.',
    );
    expect(resolveClipboardReadFailureMessage('load-failed', 'advanced-import')).toBe(
      'The clipboard image could not be loaded. Use Advanced import from file instead.',
    );
  });
});

describe('extractImageFromPasteEvent', () => {
  it('loads the first pasted image item when present', async () => {
    stubImageLoad();

    const pngBlob = new Blob(['fake'], { type: 'image/png' });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:paste-demo');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const event = {
      clipboardData: {
        items: [
          {
            type: 'text/plain',
            getAsFile: vi.fn(),
          },
          {
            type: 'image/png',
            getAsFile: vi.fn().mockReturnValue(pngBlob),
          },
        ],
      },
    } as unknown as ClipboardEvent;

    const image = await extractImageFromPasteEvent(event);

    expect(image).not.toBeNull();
    expect(image?.src).toBe('blob:paste-demo');
  });

  it('returns null when the pasted image cannot be loaded', async () => {
    const pngBlob = new Blob(['fake'], { type: 'image/png' });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:broken-paste-image');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    class FailingImage {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      src = '';

      constructor() {
        queueMicrotask(() => this.onerror?.());
      }
    }

    vi.stubGlobal('Image', FailingImage as unknown as typeof Image);

    const event = {
      clipboardData: {
        items: [
          {
            type: 'image/png',
            getAsFile: vi.fn().mockReturnValue(pngBlob),
          },
        ],
      },
    } as unknown as ClipboardEvent;

    await expect(extractImageFromPasteEvent(event)).resolves.toBeNull();
  });

  it('continues to a later pasted image item when an earlier image fails to load', async () => {
    const firstBlob = new Blob(['broken'], { type: 'image/png' });
    const secondBlob = new Blob(['working'], { type: 'image/png' });

    vi.spyOn(URL, 'createObjectURL')
      .mockReturnValueOnce('blob:broken-paste-image')
      .mockReturnValueOnce('blob:working-paste-image');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    class MixedImage {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      private currentSrc = '';

      set src(value: string) {
        this.currentSrc = value;

        queueMicrotask(() => {
          if (value === 'blob:broken-paste-image') {
            this.onerror?.();
            return;
          }

          this.onload?.();
        });
      }

      get src() {
        return this.currentSrc;
      }
    }

    vi.stubGlobal('Image', MixedImage as unknown as typeof Image);

    const event = {
      clipboardData: {
        items: [
          {
            type: 'image/png',
            getAsFile: vi.fn().mockReturnValue(firstBlob),
          },
          {
            type: 'image/png',
            getAsFile: vi.fn().mockReturnValue(secondBlob),
          },
        ],
      },
    } as unknown as ClipboardEvent;

    const image = await extractImageFromPasteEvent(event);

    expect(image).not.toBeNull();
    expect(image?.src).toBe('blob:working-paste-image');
  });
});
