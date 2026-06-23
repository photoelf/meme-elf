import { describe, expect, it } from 'vitest';
import { parseImportedTemplateDocument } from './import-template-source';
import { createTwoButtonsSceneDocument } from './two-buttons-test-fixture';

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
      JSON.stringify(createTwoButtonsSceneDocument()),
      'Two Buttons.melf',
    );

    expect(templateDocument).not.toBeNull();
    expect(templateDocument).toMatchObject({
      kind: 'template',
      templateId: 'two-buttons',
      title: 'Two Buttons',
      description: 'Imported from Two Buttons.',
      category: 'classic',
      tags: ['imported'],
      previewImagePath: 'data:image/png;base64,AAAA',
      baseImagePath: 'data:image/png;base64,AAAA',
      scene: {
        canvasSize: {
          width: 500,
          height: 757,
        },
        activeLayerId: 'top',
      },
    });
    expect(templateDocument?.scene.textSlots).toHaveLength(3);
    expect(templateDocument?.scene.textSlots[0]).toMatchObject({
      id: 'top',
      role: 'top-caption',
      defaultText: '',
    });
    expect(templateDocument?.scene.textSlots[1]).toMatchObject({
      id: 'bottom',
      role: 'bottom-caption',
      defaultText: '',
    });
    expect(templateDocument?.scene.textSlots[2]).toMatchObject({
      id: 'layer-4',
      role: 'custom',
      defaultText: '',
    });
  });

  it('returns null for non-template and non-scene input', () => {
    expect(parseImportedTemplateDocument('{"kind":"unknown"}', 'unknown.melf')).toBeNull();
  });
});
