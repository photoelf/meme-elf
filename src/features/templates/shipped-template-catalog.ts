import {
  parseMelfTemplateDocument,
  type MelfTemplateDocument,
} from './melf-template';

export type ShippedTemplateCatalogRecord = {
  templateId: string;
  title: string;
  tags: string[];
  sortOrder: number;
  templatePath: string;
  previewImagePath: string | null;
  baseImagePath: string | null;
};

type ShippedTemplateCatalogPayload = {
  templates?: unknown;
};

export async function loadShippedTemplateCatalog(): Promise<ShippedTemplateCatalogRecord[]> {
  const response = await fetch('/templates/catalog.json', { cache: 'no-store' });
  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as ShippedTemplateCatalogPayload;
  return normalizeShippedTemplateCatalog(payload.templates);
}

export async function loadShippedTemplateDocument(
  record: ShippedTemplateCatalogRecord,
): Promise<MelfTemplateDocument | null> {
  const response = await fetch(record.templatePath, { cache: 'no-store' });
  if (!response.ok) {
    return null;
  }

  const raw = await response.text();
  const document = parseMelfTemplateDocument(raw);
  if (!document) {
    return null;
  }

  return {
    ...document,
    title: record.title,
    tags: [...record.tags],
    sortOrder: record.sortOrder,
    previewImagePath: record.previewImagePath,
    baseImagePath: record.baseImagePath,
  };
}

export async function loadShippedTemplateDocuments(): Promise<MelfTemplateDocument[]> {
  const records = await loadShippedTemplateCatalog();
  const loaded = await Promise.all(records.map((record) => loadShippedTemplateDocument(record)));

  return loaded.filter((document): document is MelfTemplateDocument => document !== null);
}

function normalizeShippedTemplateCatalog(input: unknown): ShippedTemplateCatalogRecord[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map(normalizeShippedTemplateCatalogRecord)
    .filter((record): record is ShippedTemplateCatalogRecord => record !== null)
    .sort(compareCatalogRecords);
}

function normalizeShippedTemplateCatalogRecord(
  input: unknown,
): ShippedTemplateCatalogRecord | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const templateId = normalizeRequiredString('templateId' in input ? input.templateId : undefined);
  const title = normalizeRequiredString('title' in input ? input.title : undefined);
  const templatePath = normalizeRequiredString('templatePath' in input ? input.templatePath : undefined);

  if (!templateId || !title || !templatePath) {
    return null;
  }

  return {
    templateId,
    title,
    tags: normalizeTags('tags' in input ? input.tags : undefined),
    sortOrder: normalizeSortOrder('sortOrder' in input ? input.sortOrder : undefined),
    templatePath,
    previewImagePath: normalizeOptionalString('previewImagePath' in input ? input.previewImagePath : undefined),
    baseImagePath: normalizeOptionalString('baseImagePath' in input ? input.baseImagePath : undefined),
  };
}

function compareCatalogRecords(a: ShippedTemplateCatalogRecord, b: ShippedTemplateCatalogRecord) {
  if (a.sortOrder !== b.sortOrder) {
    return a.sortOrder - b.sortOrder;
  }

  return a.title.localeCompare(b.title);
}

function normalizeRequiredString(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeOptionalString(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);

  return Array.from(new Set(normalized));
}

function normalizeSortOrder(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value));
}
