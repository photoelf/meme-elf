import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const TEMP_DIRECTORIES: string[] = [];

describe('template catalog promoter', () => {
  afterEach(() => {
    while (TEMP_DIRECTORIES.length > 0) {
      const directory = TEMP_DIRECTORIES.pop();
      if (directory) {
        rmSync(directory, { recursive: true, force: true });
      }
    }
  });

  it('writes one template file per curated template and a sorted manifest', async () => {
    const workspaceRoot = createWorkspaceRoot();
    const mod = await import('./template-catalog-promote');
    const writeCatalog = mod.createTemplateCatalogPromoter({ workspaceRoot });

    await writeCatalog({
      templates: [
        createCuratedTemplatePayload({
          templateId: 'z-template',
          title: 'Z Template',
          sortOrder: 300,
          tags: ['reaction', 'choice'],
          previewImagePath: 'data:image/png;base64,QUFBQQ==',
          baseImagePath: 'data:image/jpeg;base64,QkJCQg==',
        }),
        createCuratedTemplatePayload({
          templateId: 'a-template',
          title: 'A Template',
          sortOrder: 100,
          tags: ['classic'],
          previewImagePath: 'data:image/webp;base64,Q0NDQw==',
          baseImagePath: 'data:image/png;base64,RERERA==',
        }),
      ],
    });

    const manifest = JSON.parse(
      readFileSync(join(workspaceRoot, 'public', 'templates', 'catalog.json'), 'utf8'),
    ) as {
      templates: Array<{
        templateId: string;
        title: string;
        tags: string[];
        sortOrder: number;
        templatePath: string;
        previewImagePath: string | null;
        baseImagePath: string | null;
      }>;
    };

    expect(manifest.templates.map((entry) => entry.templateId)).toEqual(['a-template', 'z-template']);
    expect(manifest.templates[0]).toMatchObject({
      templateId: 'a-template',
      title: 'A Template',
      tags: ['classic'],
      sortOrder: 100,
      templatePath: '/templates/a-template/template.melf',
      previewImagePath: '/templates/a-template/preview.webp',
      baseImagePath: '/templates/a-template/base.png',
    });
    expect(manifest.templates[1]).toMatchObject({
      templateId: 'z-template',
      previewImagePath: '/templates/z-template/preview.png',
      baseImagePath: '/templates/z-template/base.jpg',
    });

    const shippedTemplate = JSON.parse(
      readFileSync(join(workspaceRoot, 'public', 'templates', 'a-template', 'template.melf'), 'utf8'),
    ) as {
      kind: string;
      templateId: string;
      previewImagePath: string | null;
      baseImagePath: string | null;
    };

    expect(shippedTemplate).toMatchObject({
      kind: 'template',
      templateId: 'a-template',
      previewImagePath: '/templates/a-template/preview.webp',
      baseImagePath: '/templates/a-template/base.png',
    });

    expect(
      readFileSync(join(workspaceRoot, 'public', 'templates', 'a-template', 'preview.webp')),
    ).toEqual(Buffer.from('CCCC', 'utf8'));
    expect(
      readFileSync(join(workspaceRoot, 'public', 'templates', 'z-template', 'base.jpg')),
    ).toEqual(Buffer.from('BBBB', 'utf8'));
  });

  it('rejects template records whose ids do not match their template document', async () => {
    const workspaceRoot = createWorkspaceRoot();
    const mod = await import('./template-catalog-promote');
    const writeCatalog = mod.createTemplateCatalogPromoter({ workspaceRoot });

    await expect(
      writeCatalog({
        templates: [
          createCuratedTemplatePayload({
            templateId: 'manifest-id',
            templateDocumentId: 'template-id',
            title: 'Broken Template',
            sortOrder: 100,
            tags: ['broken'],
            previewImagePath: 'data:image/png;base64,QUFBQQ==',
            baseImagePath: 'data:image/png;base64,QUFBQQ==',
          }),
        ],
      }),
    ).rejects.toThrow(/templateId/i);
  });

  it('drops missing path-based asset references instead of shipping broken URLs', async () => {
    const workspaceRoot = createWorkspaceRoot();
    const mod = await import('./template-catalog-promote');
    const writeCatalog = mod.createTemplateCatalogPromoter({ workspaceRoot });

    await writeCatalog({
      templates: [
        createCuratedTemplatePayload({
          templateId: 'missing-assets',
          title: 'Missing Assets',
          sortOrder: 100,
          tags: ['broken'],
          previewImagePath: '/templates/missing-assets/preview.jpg',
          baseImagePath: '/templates/missing-assets/base.jpg',
        }),
      ],
    });

    const manifest = JSON.parse(
      readFileSync(join(workspaceRoot, 'public', 'templates', 'catalog.json'), 'utf8'),
    ) as {
      templates: Array<{
        previewImagePath: string | null;
        baseImagePath: string | null;
      }>;
    };
    const shippedTemplate = JSON.parse(
      readFileSync(
        join(workspaceRoot, 'public', 'templates', 'missing-assets', 'template.melf'),
        'utf8',
      ),
    ) as {
      previewImagePath: string | null;
      baseImagePath: string | null;
    };

    expect(manifest.templates[0]).toMatchObject({
      previewImagePath: null,
      baseImagePath: null,
    });
    expect(shippedTemplate).toMatchObject({
      previewImagePath: null,
      baseImagePath: null,
    });
  });
});

function createWorkspaceRoot() {
  const workspaceRoot = mkdtempSync(join(tmpdir(), 'meme-elf-template-promote-'));
  TEMP_DIRECTORIES.push(workspaceRoot);
  return workspaceRoot;
}

function createCuratedTemplatePayload(input: {
  templateId: string;
  templateDocumentId?: string;
  title: string;
  sortOrder: number;
  tags: string[];
  previewImagePath: string;
  baseImagePath: string;
}) {
  return {
    templateId: input.templateId,
    title: input.title,
    tags: input.tags,
    sortOrder: input.sortOrder,
    template: {
      kind: 'template' as const,
      version: 1 as const,
      templateId: input.templateDocumentId ?? input.templateId,
      name: input.title,
      title: input.title,
      description: `${input.title} description`,
      category: 'classic' as const,
      tags: input.tags,
      sortOrder: input.sortOrder,
      previewImagePath: input.previewImagePath,
      baseImagePath: input.baseImagePath,
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
      sceneImageAdjustments: {
        brightness: 100,
        contrast: 100,
        saturation: 100,
        hue: 0,
        grayscale: false,
        sepia: false,
        invert: false,
        blur: 0,
        sharpen: 0,
        pixelate: 0,
        posterize: 0,
        threshold: 0,
        noise: 0,
        jpegQuality: 100,
        includeText: false,
      },
      sceneEffectStack: [],
      sceneWatermark: {
        enabled: false,
        text: 'meme-elf',
        mode: 'corner' as const,
        corner: 'bottom-left' as const,
        opacity: 50,
        size: 12,
        color: '#808080',
        rotation: 0,
      },
    },
  };
}
