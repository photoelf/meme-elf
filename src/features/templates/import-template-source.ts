import type { MelfSceneDocument } from './melf-scene';
import { parseMelfSceneDocument } from './melf-scene';
import {
  MELF_DOCUMENT_VERSION,
  type MelfTemplateDocument,
  parseMelfTemplateDocument,
} from './melf-template';

export function parseImportedTemplateDocument(rawDocument: string, fileName: string) {
  const templateDocument = parseMelfTemplateDocument(rawDocument);

  if (templateDocument) {
    return templateDocument;
  }

  const sceneDocument = parseMelfSceneDocument(rawDocument);

  if (!sceneDocument) {
    return null;
  }

  return createTemplateDocumentFromScene(sceneDocument, fileName);
}

function createTemplateDocumentFromScene(
  sceneDocument: MelfSceneDocument,
  fileName: string,
): MelfTemplateDocument {
  const textSlots = sceneDocument.scene.layers
    .filter(
      (
        layer,
      ): layer is Extract<MelfSceneDocument['scene']['layers'][number], { kind: 'text' }> =>
        layer.kind === 'text',
    )
    .map((layer, index) => ({
      id: layer.id,
      role: resolveImportedTextSlotRole(layer.id, layer.verticalAlign, index),
      name: layer.name,
      defaultText: layer.text,
      box: { ...layer.box },
      verticalAlign: layer.verticalAlign,
      fontFamily: layer.fontFamily,
      fontSize: layer.fontSize,
      fillStyle: layer.fillStyle,
      strokeStyle: layer.strokeStyle,
      outlineWidth: layer.outlineWidth,
      textAlign: layer.textAlign,
      effect: layer.effect,
      allCaps: layer.allCaps,
      bold: layer.bold,
      italic: layer.italic,
      opacity: layer.opacity,
    }));
  const normalizedName = normalizeImportedTemplateName(sceneDocument.name, fileName);
  const previewImagePath = resolveImportedTemplatePreview(sceneDocument);

  return {
    kind: 'template',
    version: MELF_DOCUMENT_VERSION,
    templateId: createImportedTemplateId(normalizedName),
    name: normalizedName,
    title: normalizedName,
    description: `Imported from ${normalizeImportedSceneFileName(fileName)}.`,
    category: resolveImportedTemplateCategory(textSlots.length),
    tags: ['imported'],
    sortOrder: 0,
    previewImagePath,
    baseImagePath: previewImagePath,
    scene: {
      canvasSize: {
        width: sceneDocument.scene.canvasSize.width,
        height: sceneDocument.scene.canvasSize.height,
      },
      activeLayerId: sceneDocument.scene.activeLayerId,
      textSlots,
      imageSlots: previewImagePath
        ? [
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
                width: sceneDocument.scene.canvasSize.width,
                height: sceneDocument.scene.canvasSize.height,
                rotation: 0,
              },
            },
          ]
        : [],
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
      ...sceneDocument.sceneImageAdjustments,
    },
    sceneEffectStack: sceneDocument.sceneEffectStack.map((effect) => ({ ...effect })),
    sceneWatermark: {
      ...sceneDocument.sceneWatermark,
    },
  };
}

function resolveImportedTemplatePreview(sceneDocument: MelfSceneDocument) {
  if (sceneDocument.scene.baseImage?.dataUrl) {
    return sceneDocument.scene.baseImage.dataUrl;
  }

  const imageLayer = sceneDocument.scene.layers.find((layer) => layer.kind === 'image');
  return imageLayer?.imageAsset?.dataUrl ?? null;
}

function resolveImportedTemplateCategory(textSlotCount: number): MelfTemplateDocument['category'] {
  if (textSlotCount >= 2) {
    return 'classic';
  }

  if (textSlotCount === 1) {
    return 'caption';
  }

  return 'social';
}

function resolveImportedTextSlotRole(
  layerId: string,
  verticalAlign: 'top' | 'middle' | 'bottom',
  index: number,
): MelfTemplateDocument['scene']['textSlots'][number]['role'] {
  const normalizedId = layerId.trim().toLowerCase();

  if (normalizedId === 'top' || verticalAlign === 'top') {
    return 'top-caption';
  }

  if (normalizedId === 'bottom' || verticalAlign === 'bottom') {
    return 'bottom-caption';
  }

  return index === 0 ? 'headline' : 'custom';
}

function normalizeImportedTemplateName(documentName: string, fileName: string) {
  const normalizedFileName = normalizeImportedSceneFileName(fileName);
  const trimmedDocumentName = documentName.trim();

  if (trimmedDocumentName.length > 0 && !isGenericImportedSceneName(trimmedDocumentName)) {
    return trimmedDocumentName;
  }

  return normalizedFileName;
}

function normalizeImportedSceneFileName(fileName: string) {
  const trimmed = stripMelfExtension(fileName.trim());
  return trimmed.length > 0 ? trimmed : 'Imported template';
}

function createImportedTemplateId(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug.length > 0 ? slug : 'imported-template';
}

function stripMelfExtension(fileName: string) {
  return fileName.toLowerCase().endsWith('.melf') ? fileName.slice(0, -'.melf'.length) : fileName;
}

function isGenericImportedSceneName(name: string) {
  const normalized = name.trim().toLowerCase();
  return normalized === 'meme-elf-scene' || normalized === 'untitled scene';
}
