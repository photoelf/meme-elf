import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MelfTemplateDocument } from './melf-template';
import {
  readPersistedTemplateLibrary,
  writePersistedTemplateLibrary,
} from './dev-template-library-storage';

const STORAGE_KEY = 'meme-elf.dev-template-library';

const TEMPLATE: MelfTemplateDocument = {
  kind: 'template',
  version: 1,
  templateId: 'imported-scene',
  name: 'Imported Scene',
  title: 'Imported Scene',
  description: 'Imported template',
  category: 'classic',
  tags: ['imported'],
  sortOrder: 100,
  previewImagePath: 'data:image/png;base64,AAAA',
  baseImagePath: 'data:image/png;base64,AAAA',
  scene: {
    canvasSize: {
      width: 640,
      height: 360,
    },
    activeLayerId: 'top',
    textSlots: [
      {
        id: 'top',
        role: 'top-caption',
        name: 'Top text',
        defaultText: 'IMPORTED TOP',
        verticalAlign: 'top',
        fontFamily: 'Impact',
        fontSize: 90,
        fillStyle: '#ffffff',
        strokeStyle: '#000000',
        outlineWidth: 5,
        textAlign: 'center',
        effect: 'outline',
        allCaps: true,
        bold: false,
        italic: false,
        opacity: 1,
        box: {
          x: 20,
          y: 12,
          width: 600,
          height: 96,
          rotation: 0,
        },
      },
    ],
    imageSlots: [
      {
        id: 'primary-image',
        role: 'primary-image',
        name: 'Primary image',
        fitMode: 'cover',
        anchor: 'center',
        allowOverflow: false,
        box: {
          x: 0,
          y: 0,
          width: 640,
          height: 360,
          rotation: 0,
        },
      },
    ],
    canvas: {
      backgroundFill: null,
      safeInsets: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      },
    },
  },
  sceneImageAdjustments: {
    brightness: 100,
    contrast: 100,
    saturation: 100,
    hue: 0,
    grayscale: false,
    includeText: false,
    sepia: false,
    invert: false,
  },
  sceneEffectStack: [],
  sceneWatermark: {
    enabled: false,
    text: 'meme-elf',
    mode: 'corner',
    corner: 'bottom-left',
    opacity: 50,
    size: 12,
    color: '#808080',
    rotation: 0,
  },
};

describe('dev template library storage', () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await clearIndexedDb();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await clearIndexedDb();
  });

  it('round-trips template libraries through IndexedDB', async () => {
    await writePersistedTemplateLibrary(STORAGE_KEY, [TEMPLATE]);

    const library = await readPersistedTemplateLibrary(STORAGE_KEY);

    expect(library).toHaveLength(1);
    expect(library?.[0]).toMatchObject({
      templateId: 'imported-scene',
      baseImagePath: 'data:image/png;base64,AAAA',
    });
  });

  it('does not fail the save path when localStorage hits quota', async () => {
    const originalSetItem = window.localStorage.setItem.bind(window.localStorage);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function setItemWithQuota(
      this: Storage,
      key: string,
      value: string,
    ) {
      if (this === window.localStorage && key === STORAGE_KEY) {
        throw new DOMException('Quota exceeded.', 'QuotaExceededError');
      }

      return originalSetItem(key, value);
    });

    await expect(writePersistedTemplateLibrary(STORAGE_KEY, [TEMPLATE])).resolves.toBeUndefined();
  });
});

async function clearIndexedDb() {
  if (typeof indexedDB === 'undefined') {
    return;
  }

  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase('meme-elf-dev-template-library');
    request.onerror = () => resolve();
    request.onsuccess = () => resolve();
    request.onblocked = () => resolve();
  });
}
