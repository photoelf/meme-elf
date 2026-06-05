import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  loadImageElementFromBlob,
  loadImageElementFromFile,
} from './image-loader';

const originalCreateObjectURL = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
const originalRevokeObjectURL = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
const originalImage = globalThis.Image;

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

  globalThis.Image = originalImage;
});

describe('loadImageElementFromBlob', () => {
  it('creates an image element from a blob URL and revokes it after load', async () => {
    const blob = new Blob(['fake'], { type: 'image/png' });
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:demo');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    class FakeImage {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      src = '';

      constructor() {
        queueMicrotask(() => this.onload?.());
      }
    }

    vi.stubGlobal('Image', FakeImage as unknown as typeof Image);

    const image = await loadImageElementFromBlob(blob);

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(image.src).toBe('blob:demo');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:demo');
  });
});

describe('loadImageElementFromFile', () => {
  it('delegates file loading through the blob loader path', async () => {
    const file = new File(['fake'], 'demo.png', { type: 'image/png' });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:file-demo');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    class FakeImage {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      src = '';

      constructor() {
        queueMicrotask(() => this.onload?.());
      }
    }

    vi.stubGlobal('Image', FakeImage as unknown as typeof Image);

    const image = await loadImageElementFromFile(file);

    expect(URL.createObjectURL).toHaveBeenCalledWith(file);
    expect(image.src).toBe('blob:file-demo');
  });
});
