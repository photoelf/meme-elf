import { afterEach, describe, expect, it, vi } from 'vitest';

import type { MelfTemplateDocument } from './melf-template';

describe('shipped template catalog', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads shipped manifest entries from /templates/catalog.json', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          templates: [
            {
              templateId: 'two-buttons',
              title: 'Two Buttons',
              tags: ['choice', 'reaction'],
              sortOrder: 100,
              templatePath: '/templates/two-buttons/template.melf',
              previewImagePath: '/templates/two-buttons/preview.png',
              baseImagePath: '/templates/two-buttons/base.png',
            },
          ],
        }),
      ),
    );

    const mod = await import('./shipped-template-catalog');
    const catalog = await mod.loadShippedTemplateCatalog();

    expect(catalog).toEqual([
      expect.objectContaining({
        templateId: 'two-buttons',
        title: 'Two Buttons',
        tags: ['choice', 'reaction'],
        sortOrder: 100,
        templatePath: '/templates/two-buttons/template.melf',
        previewImagePath: '/templates/two-buttons/preview.png',
        baseImagePath: '/templates/two-buttons/base.png',
      }),
    ]);
    expect(globalThis.fetch).toHaveBeenCalledWith('/templates/catalog.json', { cache: 'no-store' });
  });

  it('returns an empty catalog when the shipped manifest is unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('missing', { status: 404 }));

    const mod = await import('./shipped-template-catalog');

    await expect(mod.loadShippedTemplateCatalog()).resolves.toEqual([]);
  });

  it('drops invalid shipped manifest records and preserves sorted valid entries', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          templates: [
            {
              templateId: 'z-last',
              title: 'Z Last',
              tags: ['ok'],
              sortOrder: 300,
              templatePath: '/templates/z-last/template.melf',
              previewImagePath: '',
              baseImagePath: null,
            },
            {
              templateId: '',
              title: 'Broken',
              tags: ['bad'],
              sortOrder: 50,
              templatePath: '/templates/broken/template.melf',
              previewImagePath: null,
              baseImagePath: null,
            },
            {
              templateId: 'a-first',
              title: 'A First',
              tags: ['ok', 'ok'],
              sortOrder: 100,
              templatePath: '/templates/a-first/template.melf',
              previewImagePath: null,
              baseImagePath: '  /templates/a-first/base.png  ',
            },
          ],
        }),
      ),
    );

    const mod = await import('./shipped-template-catalog');
    const catalog = await mod.loadShippedTemplateCatalog();

    expect(catalog.map((entry) => entry.templateId)).toEqual(['a-first', 'z-last']);
    expect(catalog[0]).toMatchObject({
      templateId: 'a-first',
      tags: ['ok'],
      previewImagePath: null,
      baseImagePath: '/templates/a-first/base.png',
    });
    expect(catalog[1]).toMatchObject({
      templateId: 'z-last',
      previewImagePath: null,
    });
  });

  it('loads and merges shipped template document metadata from the manifest record', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          kind: 'template',
          version: 1,
          templateId: 'two-buttons',
          name: 'Two Buttons',
          title: 'Draft title',
          description: 'Pick a side.',
          category: 'classic',
          tags: ['draft'],
          sortOrder: 999,
          previewImagePath: null,
          baseImagePath: null,
          scene: {
            canvasSize: { width: 640, height: 360 },
            activeLayerId: 'top',
            textSlots: [],
            imageSlots: [],
            canvas: {
              backgroundFill: null,
              safeInsets: { top: 0, right: 0, bottom: 0, left: 0 },
            },
          },
          sceneImageAdjustments: {},
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
        } satisfies Partial<MelfTemplateDocument>),
      ),
    );

    const mod = await import('./shipped-template-catalog');
    const document = await mod.loadShippedTemplateDocument({
      templateId: 'two-buttons',
      title: 'Two Buttons',
      tags: ['choice', 'reaction'],
      sortOrder: 100,
      templatePath: '/templates/two-buttons/template.melf',
      previewImagePath: '/templates/two-buttons/preview.png',
      baseImagePath: '/templates/two-buttons/base.png',
    });

    expect(document).toMatchObject({
      templateId: 'two-buttons',
      title: 'Two Buttons',
      tags: ['choice', 'reaction'],
      sortOrder: 100,
      previewImagePath: '/templates/two-buttons/preview.png',
      baseImagePath: '/templates/two-buttons/base.png',
    });
    expect(globalThis.fetch).toHaveBeenCalledWith('/templates/two-buttons/template.melf', {
      cache: 'no-store',
    });
  });
});
