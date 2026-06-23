import { describe, expect, it } from 'vitest';

describe('melf template foundation', () => {
  it('normalizes text slot documents and preserves slot defaults', async () => {
    const mod = await import('./melf-template');
    const document = mod.parseMelfTemplateDocument(
      JSON.stringify({
        kind: 'template',
        version: 1,
        templateId: 'slot-template',
        name: 'Slot template',
        category: 'classic',
        scene: {
          canvasSize: {
            width: 640,
            height: 360,
          },
          activeLayerId: 'headline',
          textSlots: [
            {
              id: 'headline',
              role: 'top-caption',
              name: 'Headline',
              verticalAlign: 'top',
              fontSize: 72,
              allCaps: false,
              box: {
                x: 20,
                y: 12,
                width: 600,
                height: 96,
                rotation: 0,
              },
            },
          ],
        },
      }),
    );

    expect(document?.scene.textSlots).toHaveLength(1);
    expect(document?.scene.textSlots[0]).toMatchObject({
      id: 'headline',
      role: 'top-caption',
      name: 'Headline',
      fontSize: 72,
      allCaps: false,
      box: {
        x: 20,
        y: 12,
        width: 600,
        height: 96,
        rotation: 0,
      },
    });
    expect(document?.scene.activeLayerId).toBe('headline');
  });

  it('normalizes image slots and canvas metadata onto template documents', async () => {
    const mod = await import('./melf-template');
    const document = mod.parseMelfTemplateDocument(
      JSON.stringify({
        kind: 'template',
        version: 1,
        templateId: 'image-slot-template',
        name: 'Image slot template',
        category: 'classic',
        scene: {
          canvasSize: { width: 640, height: 360 },
          textSlots: [],
          imageSlots: [
            {
              id: 'hero-image',
              role: 'primary-image',
              name: 'Hero image',
              fitMode: 'contain',
              anchor: 'center',
              allowOverflow: false,
              box: { x: 40, y: 50, width: 560, height: 220, rotation: 0 },
            },
          ],
          canvas: {
            backgroundFill: '#101010',
            safeInsets: { top: 12, right: 16, bottom: 20, left: 16 },
          },
        },
      }),
    );

    expect(document?.scene.imageSlots[0]).toMatchObject({
      id: 'hero-image',
      role: 'primary-image',
      fitMode: 'contain',
      anchor: 'center',
      allowOverflow: false,
      box: { x: 40, y: 50, width: 560, height: 220, rotation: 0 },
    });
    expect(document?.scene.canvas).toEqual({
      backgroundFill: '#101010',
      safeInsets: { top: 12, right: 16, bottom: 20, left: 16 },
    });
  });

  it('keeps starter presets empty until templates are explicitly imported or shipped', async () => {
    const templateMod = await import('./melf-template');
    const catalogMod = await import('./template-catalog');

    expect(templateMod.STARTER_MELF_TEMPLATE_PRESETS).toEqual([]);
    expect(catalogMod.BUILT_IN_TEMPLATE_CATALOG).toEqual([]);
    expect(catalogMod.getBuiltInTemplateById('two-buttons')).toBeNull();
    expect(catalogMod.getBuiltInTemplateCatalogEntry('two-buttons')).toBeNull();
  });

  it('rejects duplicate template ids when building the runtime catalog', async () => {
    const catalogMod = await import('./template-catalog');
    const template = {
      kind: 'template' as const,
      version: 1 as const,
      templateId: 'two-buttons',
      name: 'Two Buttons',
      title: 'Two Buttons',
      description: 'Imported from Two Buttons.',
      category: 'classic' as const,
      tags: ['imported'],
      sortOrder: 100,
      previewImagePath: null,
      baseImagePath: null,
      scene: {
        canvasSize: { width: 500, height: 757 },
        activeLayerId: null,
        textSlots: [],
        imageSlots: [],
        canvas: {
          backgroundFill: null,
          safeInsets: { top: 0, right: 0, bottom: 0, left: 0 },
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
        enabled: true,
        text: 'создано в программе meme-elf',
        mode: 'corner' as const,
        corner: 'bottom-left' as const,
        opacity: 50,
        size: 12,
        color: '#808080',
        rotation: 0,
      },
    };

    expect(() => catalogMod.createBuiltInTemplateCatalog([template, { ...template }])).toThrow(
      /duplicate templateId/i,
    );
  });
});
