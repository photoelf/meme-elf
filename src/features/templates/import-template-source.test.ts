import { describe, expect, it } from 'vitest';
import { parseImportedTemplateDocument } from './import-template-source';

describe('parseImportedTemplateDocument', () => {
  it('keeps native template documents unchanged', () => {
    const templateDocument = parseImportedTemplateDocument(
      JSON.stringify({
        kind: 'template',
        version: 1,
        templateId: 'custom-template',
        name: 'Custom template',
        title: 'Custom template',
        description: 'Imported template document',
        category: 'classic',
        tags: ['custom'],
        sortOrder: 500,
        previewImagePath: null,
        baseImagePath: null,
        scene: {
          canvasSize: {
            width: 800,
            height: 450,
          },
          activeLayerId: 'top',
          textSlots: [],
          imageSlots: [],
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
      }),
      'custom-template.melf',
    );

    expect(templateDocument).not.toBeNull();
    expect(templateDocument?.kind).toBe('template');
    expect(templateDocument?.templateId).toBe('custom-template');
    expect(templateDocument?.title).toBe('Custom template');
  });

  it('converts saved scene documents into importable template documents', () => {
    const templateDocument = parseImportedTemplateDocument(
      JSON.stringify({
        kind: 'scene',
        version: 1,
        name: 'Imported Scene',
        scene: {
          canvasSize: {
            width: 640,
            height: 360,
          },
          activeLayerId: 'headline',
          baseImage: {
            mimeType: 'image/png',
            dataUrl: 'data:image/png;base64,AAAA',
            width: 640,
            height: 360,
          },
          layers: [
            {
              kind: 'text',
              id: 'headline',
              name: 'Headline',
              text: 'loaded text',
              verticalAlign: 'top',
              box: {
                x: 20,
                y: 12,
                width: 600,
                height: 96,
                rotation: 0,
              },
            },
            {
              kind: 'text',
              id: 'bottom',
              name: 'Bottom text',
              text: 'loaded bottom',
              verticalAlign: 'bottom',
              box: {
                x: 20,
                y: 252,
                width: 600,
                height: 96,
                rotation: 0,
              },
            },
          ],
        },
      }),
      'imported-scene.melf',
    );

    expect(templateDocument).not.toBeNull();
    expect(templateDocument).toMatchObject({
      kind: 'template',
      templateId: 'imported-scene',
      title: 'Imported Scene',
      description: 'Imported from imported-scene.',
      category: 'classic',
      tags: ['imported'],
      previewImagePath: 'data:image/png;base64,AAAA',
      baseImagePath: 'data:image/png;base64,AAAA',
      scene: {
        canvasSize: {
          width: 640,
          height: 360,
        },
        activeLayerId: 'headline',
      },
    });
    expect(templateDocument?.scene.textSlots).toHaveLength(2);
    expect(templateDocument?.scene.textSlots[0]).toMatchObject({
      id: 'headline',
      role: 'top-caption',
      defaultText: 'loaded text',
    });
    expect(templateDocument?.scene.textSlots[1]).toMatchObject({
      id: 'bottom',
      role: 'bottom-caption',
      defaultText: 'loaded bottom',
    });
  });

  it('returns null for non-template and non-scene input', () => {
    expect(parseImportedTemplateDocument('{"kind":"unknown"}', 'unknown.melf')).toBeNull();
  });
});
