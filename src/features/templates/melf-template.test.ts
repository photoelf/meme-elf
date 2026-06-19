import { describe, expect, it } from 'vitest';

describe('melf template foundation', () => {
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
    expect(document?.scene.textLayers[0]).toMatchObject({
      text: '',
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

    const classicPreset = presets.find((preset: { templateId: string }) => preset.templateId === 'classic-top-bottom');
    expect(classicPreset?.scene.canvasSize).toEqual({ width: 800, height: 450 });
    expect(classicPreset?.scene.textLayers).toHaveLength(2);
    expect(classicPreset?.scene.textLayers[0]).toMatchObject({
      fontFamily: 'Impact',
      fontSize: 90,
      effect: 'outline',
      allCaps: true,
    });

    const squarePreset = presets.find((preset: { templateId: string }) => preset.templateId === 'square-social');
    expect(squarePreset?.scene.canvasSize).toEqual({ width: 1080, height: 1080 });
    expect(squarePreset?.scene.textLayers.map((layer: { verticalAlign: string }) => layer.verticalAlign)).toEqual([
      'top',
      'bottom',
    ]);
  });
});
