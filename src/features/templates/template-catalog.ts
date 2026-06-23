import {
  STARTER_MELF_TEMPLATE_PRESETS,
  type MelfTemplateCategory,
  type MelfTemplateDocument,
} from './melf-template';

export type MelfTemplateCatalogEntry = {
  templateId: string;
  name: string;
  title: string;
  description: string;
  category: MelfTemplateCategory;
  tags: string[];
  sortOrder: number;
  previewImagePath: string | null;
  baseImagePath: string | null;
  canvasSize: {
    width: number;
    height: number;
  };
  textSlotCount: number;
  imageSlotCount: number;
};

export function projectTemplateCatalogEntry(
  template: MelfTemplateDocument,
): MelfTemplateCatalogEntry {
  return {
    templateId: template.templateId,
    name: template.name,
    title: template.title,
    description: template.description,
    category: template.category,
    tags: [...template.tags],
    sortOrder: template.sortOrder,
    previewImagePath: template.previewImagePath,
    baseImagePath: template.baseImagePath,
    canvasSize: {
      width: template.scene.canvasSize.width,
      height: template.scene.canvasSize.height,
    },
    textSlotCount: template.scene.textSlots.length,
    imageSlotCount: template.scene.imageSlots.length,
  };
}

function compareCatalogEntries(a: MelfTemplateCatalogEntry, b: MelfTemplateCatalogEntry) {
  if (a.sortOrder !== b.sortOrder) {
    return a.sortOrder - b.sortOrder;
  }

  return a.title.localeCompare(b.title);
}

export function createBuiltInTemplateCatalog(
  templates: readonly MelfTemplateDocument[],
): readonly MelfTemplateCatalogEntry[] {
  assertUniqueTemplateIds(templates);

  return templates.map(projectTemplateCatalogEntry).sort(compareCatalogEntries);
}

export const BUILT_IN_TEMPLATE_CATALOG: readonly MelfTemplateCatalogEntry[] =
  createBuiltInTemplateCatalog(STARTER_MELF_TEMPLATE_PRESETS);

const BUILT_IN_TEMPLATE_BY_ID = createTemplateMap(STARTER_MELF_TEMPLATE_PRESETS);

const BUILT_IN_TEMPLATE_CATALOG_BY_ID = createCatalogEntryMap(BUILT_IN_TEMPLATE_CATALOG);

export function getBuiltInTemplateById(templateId: string): MelfTemplateDocument | null {
  const template = BUILT_IN_TEMPLATE_BY_ID.get(templateId);
  return template ? cloneTemplateDocument(template) : null;
}

export function getTemplateById(
  templates: readonly MelfTemplateDocument[],
  templateId: string,
): MelfTemplateDocument | null {
  const template = templates.find((entry) => entry.templateId === templateId);
  return template ? cloneTemplateDocument(template) : null;
}

export function getBuiltInTemplateCatalogEntry(
  templateId: string,
): MelfTemplateCatalogEntry | null {
  const entry = BUILT_IN_TEMPLATE_CATALOG_BY_ID.get(templateId);
  return entry ? cloneCatalogEntry(entry) : null;
}

function assertUniqueTemplateIds(templates: readonly MelfTemplateDocument[]) {
  const seen = new Set<string>();

  for (const template of templates) {
    if (seen.has(template.templateId)) {
      throw new Error(`Duplicate templateId "${template.templateId}" in built-in template catalog.`);
    }

    seen.add(template.templateId);
  }
}

function createTemplateMap(templates: readonly MelfTemplateDocument[]) {
  assertUniqueTemplateIds(templates);
  return new Map(templates.map((template) => [template.templateId, template] as const));
}

function createCatalogEntryMap(entries: readonly MelfTemplateCatalogEntry[]) {
  const seen = new Set<string>();

  return new Map(
    entries.map((entry) => {
      if (seen.has(entry.templateId)) {
        throw new Error(`Duplicate templateId "${entry.templateId}" in built-in template catalog.`);
      }

      seen.add(entry.templateId);
      return [entry.templateId, entry] as const;
    }),
  );
}

export function cloneCatalogEntry(entry: MelfTemplateCatalogEntry): MelfTemplateCatalogEntry {
  return {
    ...entry,
    tags: [...entry.tags],
    canvasSize: {
      width: entry.canvasSize.width,
      height: entry.canvasSize.height,
    },
  };
}

export function cloneTemplateDocument(template: MelfTemplateDocument): MelfTemplateDocument {
  return {
    ...template,
    tags: [...template.tags],
    scene: {
      canvasSize: {
        width: template.scene.canvasSize.width,
        height: template.scene.canvasSize.height,
      },
      activeLayerId: template.scene.activeLayerId,
      textSlots: template.scene.textSlots.map((slot) => ({
        ...slot,
        box: { ...slot.box },
      })),
      imageSlots: template.scene.imageSlots.map((slot) => ({
        ...slot,
        box: { ...slot.box },
      })),
      canvas: {
        backgroundFill: template.scene.canvas.backgroundFill,
        safeInsets: {
          top: template.scene.canvas.safeInsets.top,
          right: template.scene.canvas.safeInsets.right,
          bottom: template.scene.canvas.safeInsets.bottom,
          left: template.scene.canvas.safeInsets.left,
        },
      },
    },
    sceneImageAdjustments: {
      ...template.sceneImageAdjustments,
    },
    sceneEffectStack: template.sceneEffectStack.map((effect) => ({ ...effect })),
    sceneWatermark: {
      ...template.sceneWatermark,
    },
  };
}

export function cloneTemplateDocuments(
  templates: readonly MelfTemplateDocument[],
): MelfTemplateDocument[] {
  return templates.map(cloneTemplateDocument);
}
