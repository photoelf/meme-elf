import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadImageElementFromUrl } from './image-loader';

const originalFetch = globalThis.fetch;
const originalCreateObjectURL = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
const originalRevokeObjectURL = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
const originalImage = globalThis.Image;

beforeEach(() => {
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(() => 'blob:remote-image'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });

  class FakeImage {
    onload: null | (() => void) = null;
    onerror: null | (() => void) = null;
    src = '';

    constructor() {
      queueMicrotask(() => this.onload?.());
    }
  }

  vi.stubGlobal('Image', FakeImage as unknown as typeof Image);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();

  if (originalFetch) {
    globalThis.fetch = originalFetch;
  } else {
    delete (globalThis as { fetch?: typeof fetch }).fetch;
  }

  if (originalCreateObjectURL) {
    Object.defineProperty(URL, 'createObjectURL', originalCreateObjectURL);
  }

  if (originalRevokeObjectURL) {
    Object.defineProperty(URL, 'revokeObjectURL', originalRevokeObjectURL);
  }

  globalThis.Image = originalImage;
});

describe('loadImageElementFromUrl', () => {
  it('fetches a direct image URL, validates the MIME type, and decodes the blob', async () => {
    const blob = new Blob(['png'], { type: 'image/png' });
    globalThis.fetch = vi.fn().mockResolvedValue({
      blob: vi.fn().mockResolvedValue(blob),
      headers: {
        get: vi.fn(() => 'image/png'),
      },
      ok: true,
    } as unknown as Response);

    const image = await loadImageElementFromUrl('https://cdn.example.com/meme.png');

    expect(globalThis.fetch).toHaveBeenCalledWith('https://cdn.example.com/meme.png', {
      credentials: 'omit',
      mode: 'cors',
      redirect: 'follow',
      referrerPolicy: 'no-referrer',
    });
    expect(image.src).toBe('blob:remote-image');
  });

  it('rejects URLs with unsupported protocols before fetching', async () => {
    await expect(loadImageElementFromUrl('javascript:alert(1)')).rejects.toThrow(
      /direct http\(s\) image url/i,
    );
  });

  it('rejects non-image responses even when the request succeeds', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      blob: vi.fn().mockResolvedValue(new Blob(['html'], { type: 'text/html' })),
      headers: {
        get: vi.fn(() => 'text/html; charset=utf-8'),
      },
      ok: true,
    } as unknown as Response);

    await expect(loadImageElementFromUrl('https://example.com/not-image')).rejects.toThrow(
      /did not return an image/i,
    );
  });
});
