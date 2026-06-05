import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  extractImageFromPasteEvent,
  readImageFromClipboard,
} from './clipboard-service';

const originalCreateObjectURL = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
const originalRevokeObjectURL = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
const originalImage = globalThis.Image;
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

beforeEach(() => {
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
