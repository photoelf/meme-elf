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

  it('preserves explicit center alignment and outline text effect', async () => {
    const mod = await import('./melf-template');
    const document = mod.parseMelfTemplateDocument(
      JSON.stringify({
        kind: 'template',
        version: 1,
        templateId: 'center-outline-template',
        name: 'Center outline template',
        category: 'classic',
        scene: {
          canvasSize: {
            width: 640,
            height: 360,
          },
          textSlots: [
            {
              id: 'headline',
              role: 'headline',
              name: 'Headline',
              verticalAlign: 'middle',
              textAlign: 'center',
              effect: 'outline',
              box: {
                x: 40,
                y: 120,
                width: 560,
                height: 120,
                rotation: 0,
              },
            },
          ],
        },
      }),
    );

    expect(document?.scene.textSlots[0]).toMatchObject({
      textAlign: 'center',
      effect: 'outline',
      verticalAlign: 'middle',
    });
  });

  it('normalizes a minimal template document onto editor defaults', async () => {
    const mod = await import('./melf-template');
    const document = mod.parseMelfTemplateDocument(
      JSON.stringify({
        kind: 'template',
        version: 1,
        templateId: 'test-minimal',
        name: 'Minimal',
        category: 'classic',
        scene: {
          canvasSize: {
            width: 640,
            height: 360,
          },
          textLayers: [
            {
              id: 'headline',
              name: 'Headline',
              box: {
                x: 16,
                y: 12,
                width: 608,
                height: 96,
                rotation: 0,
              },
            },
          ],
        },
      }),
    );

    expect(document).not.toBeNull();
    expect(document).toMatchObject({
      title: 'Minimal',
      tags: [],
      sortOrder: 0,
      previewImagePath: null,
      baseImagePath: null,
    });
    expect(document?.scene.textSlots).toHaveLength(1);
    expect(document?.sceneImageAdjustments).toMatchObject({
      brightness: 100,
      contrast: 100,
      saturation: 100,
      hue: 0,
      grayscale: false,
      includeText: false,
      sepia: false,
      invert: false,
    });
    expect(document?.sceneWatermark).toMatchObject({
      enabled: true,
      mode: 'corner',
      corner: 'bottom-left',
      opacity: 50,
      size: 12,
      color: '#808080',
    });
    expect(document?.scene.textSlots[0]).toMatchObject({
      fontFamily: 'Impact',
      fontSize: 90,
      fillStyle: '#ffffff',
      strokeStyle: '#000000',
      outlineWidth: 5,
      textAlign: 'center',
      verticalAlign: 'top',
      effect: 'outline',
      allCaps: true,
      bold: false,
      italic: false,
      opacity: 1,
    });
  });

  it('converts legacy text layers into text slots and ships starter presets on slots', async () => {
    const mod = await import('./melf-template');
    const document = mod.parseMelfTemplateDocument(
      JSON.stringify({
        kind: 'template',
        version: 1,
        templateId: 'legacy-template',
        name: 'Legacy template',
        category: 'classic',
        scene: {
          canvasSize: {
            width: 800,
            height: 450,
          },
          textLayers: [
            {
              id: 'top',
              name: 'Top text',
              verticalAlign: 'top',
              fontSize: 90,
              box: {
                x: 24,
                y: 0,
                width: 752,
                height: 110,
                rotation: 0,
              },
            },
          ],
        },
      }),
    );

    expect(document?.scene.textSlots[0]).toMatchObject({
      id: 'top',
      role: 'top-caption',
      verticalAlign: 'top',
      box: {
        x: 24,
        y: 0,
        width: 752,
        height: 110,
        rotation: 0,
      },
    });

    const presets = mod.STARTER_MELF_TEMPLATE_PRESETS;
    expect(
      presets.every((preset: (typeof presets)[number]) => 'textSlots' in preset.scene),
    ).toBe(true);
    expect(
      presets.every((preset: (typeof presets)[number]) => !('textLayers' in preset.scene)),
    ).toBe(true);
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

  it('ships starter presets with a primary image slot and default canvas metadata', async () => {
    const mod = await import('./melf-template');
    const presets = mod.STARTER_MELF_TEMPLATE_PRESETS;
    const expectedPrimaryImageBoxes = {
      'classic-top-bottom': { x: 24, y: 110, width: 752, height: 230, rotation: 0 },
      'top-caption': { x: 24, y: 110, width: 752, height: 340, rotation: 0 },
      'bottom-caption': { x: 24, y: 0, width: 752, height: 340, rotation: 0 },
      'square-social': { x: 32, y: 180, width: 1016, height: 720, rotation: 0 },
    } as const;

    expect(presets).toHaveLength(Object.keys(expectedPrimaryImageBoxes).length);

    for (const preset of presets) {
      expect(preset.scene.imageSlots).toHaveLength(1);
      expect(preset.scene.imageSlots[0]).toMatchObject({
        role: 'primary-image',
        box: expectedPrimaryImageBoxes[preset.templateId as keyof typeof expectedPrimaryImageBoxes],
      });
      expect(preset.scene.canvas).toEqual({
        backgroundFill: null,
        safeInsets: { top: 0, right: 0, bottom: 0, left: 0 },
      });
    }
  });

  it('rejects unsupported document versions', async () => {
    const mod = await import('./melf-template');

    expect(
      mod.parseMelfTemplateDocument(
        JSON.stringify({
          kind: 'template',
          version: 99,
          templateId: 'unsupported',
          name: 'Unsupported',
          category: 'classic',
          scene: {
            canvasSize: {
              width: 800,
              height: 450,
            },
            textLayers: [],
          },
        }),
      ),
    ).toBeNull();
  });

  it('ships a starter preset catalog with unique ids and preserved text defaults', async () => {
    const mod = await import('./melf-template');
    const presets = mod.STARTER_MELF_TEMPLATE_PRESETS;

    expect(presets).toHaveLength(4);
    expect(new Set(presets.map((preset: { templateId: string }) => preset.templateId)).size).toBe(
      presets.length,
    );
    expect(presets.every((preset: { kind: string; version: number }) => preset.kind === 'template' && preset.version === 1)).toBe(true);
    expect(presets.map((preset: { templateId: string }) => preset.templateId)).toEqual([
      'classic-top-bottom',
      'top-caption',
      'bottom-caption',
      'square-social',
    ]);
    expect(presets.every((preset: { title: string; tags: string[]; previewImagePath: string | null; baseImagePath: string | null }) => (
      preset.title.length > 0 &&
      preset.tags.length > 0 &&
      typeof preset.previewImagePath === 'string' &&
      typeof preset.baseImagePath === 'string'
    ))).toBe(true);

    const classicPreset = presets.find((preset: { templateId: string }) => preset.templateId === 'classic-top-bottom');
    expect(classicPreset?.scene.canvasSize).toEqual({ width: 800, height: 450 });
    expect(classicPreset).toMatchObject({
      title: 'Classic Top / Bottom',
      tags: ['classic', 'two-text', 'reaction'],
      sortOrder: 100,
      previewImagePath: '/templates/classic-top-bottom/preview.jpg',
      baseImagePath: '/templates/classic-top-bottom/base.jpg',
    });
    expect(classicPreset?.scene.textSlots).toHaveLength(2);
    expect(classicPreset?.scene.textSlots[0]).toMatchObject({
      role: 'top-caption',
      fontFamily: 'Impact',
      fontSize: 90,
      effect: 'outline',
      allCaps: true,
    });

    const squarePreset = presets.find((preset: { templateId: string }) => preset.templateId === 'square-social');
    expect(squarePreset?.scene.canvasSize).toEqual({ width: 1080, height: 1080 });
    expect(
      squarePreset?.scene.textSlots.map((slot: { verticalAlign: string }) => slot.verticalAlign),
    ).toEqual(['top', 'bottom']);
  });

  it('projects built-in templates into a sorted runtime catalog', async () => {
    const mod = await import('./template-catalog');

    expect(mod.BUILT_IN_TEMPLATE_CATALOG.map((entry: { templateId: string }) => entry.templateId)).toEqual([
      'classic-top-bottom',
      'top-caption',
      'bottom-caption',
      'square-social',
    ]);

    expect(mod.BUILT_IN_TEMPLATE_CATALOG[0]).toMatchObject({
      templateId: 'classic-top-bottom',
      title: 'Classic Top / Bottom',
      name: 'Classic top and bottom',
      description: 'Two full-width caption boxes for the standard meme stack.',
      category: 'classic',
      tags: ['classic', 'two-text', 'reaction'],
      sortOrder: 100,
      previewImagePath: '/templates/classic-top-bottom/preview.jpg',
      baseImagePath: '/templates/classic-top-bottom/base.jpg',
      canvasSize: { width: 800, height: 450 },
      textSlotCount: 2,
      imageSlotCount: 1,
    });
  });

  it('looks up built-in templates and catalog entries by id', async () => {
    const mod = await import('./template-catalog');

    expect(mod.getBuiltInTemplateCatalogEntry('square-social')).toMatchObject({
      templateId: 'square-social',
      title: 'Square Social',
      sortOrder: 400,
    });
    expect(mod.getBuiltInTemplateCatalogEntry('missing-template')).toBeNull();
    expect(mod.getBuiltInTemplateById('top-caption')).toMatchObject({
      templateId: 'top-caption',
      title: 'Top Caption',
    });
    expect(mod.getBuiltInTemplateById('missing-template')).toBeNull();
  });

  it('returns defensive clones from built-in template lookups', async () => {
    const mod = await import('./template-catalog');

    const firstCatalogEntry = mod.getBuiltInTemplateCatalogEntry('classic-top-bottom');
    const secondCatalogEntry = mod.getBuiltInTemplateCatalogEntry('classic-top-bottom');
    expect(firstCatalogEntry).not.toBe(secondCatalogEntry);
    firstCatalogEntry!.tags.push('mutated');
    firstCatalogEntry!.canvasSize.width = 1;
    expect(secondCatalogEntry).toMatchObject({
      tags: ['classic', 'two-text', 'reaction'],
      canvasSize: { width: 800, height: 450 },
    });

    const firstTemplate = mod.getBuiltInTemplateById('classic-top-bottom');
    const secondTemplate = mod.getBuiltInTemplateById('classic-top-bottom');
    expect(firstTemplate).not.toBe(secondTemplate);
    firstTemplate!.tags.push('mutated');
    firstTemplate!.scene.textSlots[0].box.width = 1;
    firstTemplate!.scene.imageSlots[0].box.height = 1;
    firstTemplate!.scene.canvas.safeInsets.top = 99;
    expect(secondTemplate?.tags).toEqual(['classic', 'two-text', 'reaction']);
    expect(secondTemplate?.scene.textSlots[0].box.width).toBe(752);
    expect(secondTemplate?.scene.imageSlots[0].box.height).toBe(230);
    expect(secondTemplate?.scene.canvas.safeInsets).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
  });

  it('rejects duplicate template ids when building the runtime catalog', async () => {
    const templateMod = await import('./melf-template');
    const catalogMod = await import('./template-catalog');
    const duplicateTemplate = {
      ...templateMod.STARTER_MELF_TEMPLATE_PRESETS[0],
      title: 'Duplicate title',
    };

    expect(() =>
      catalogMod.createBuiltInTemplateCatalog([
        templateMod.STARTER_MELF_TEMPLATE_PRESETS[0],
        duplicateTemplate,
      ]),
    ).toThrow(/duplicate templateId/i);
  });
});
