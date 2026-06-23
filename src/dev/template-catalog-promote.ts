import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

import {
  stringifyMelfTemplateDocument,
  type MelfTemplateDocument,
} from '../features/templates/melf-template';

export type CuratedTemplatePayload = {
  templateId: string;
  title: string;
  tags: string[];
  sortOrder: number;
  template: MelfTemplateDocument;
};

export function createTemplateCatalogPromoter(options: { workspaceRoot: string }) {
  return async function promoteCatalog(input: { templates: CuratedTemplatePayload[] }) {
    const normalized = normalizeCuratedTemplatePayloads(input.templates);
    const publicTemplatesRoot = join(options.workspaceRoot, 'public', 'templates');
    const manifestTemplates: Array<{
      templateId: string;
      title: string;
      tags: string[];
      sortOrder: number;
      templatePath: string;
      previewImagePath: string | null;
      baseImagePath: string | null;
    }> = [];

    mkdirSync(publicTemplatesRoot, { recursive: true });

    for (const entry of normalized) {
      const templateDir = join(publicTemplatesRoot, entry.templateId);
      mkdirSync(templateDir, { recursive: true });

      const previewImagePath = writeTemplateAsset(
        templateDir,
        entry.template.previewImagePath,
        'preview',
        entry.templateId,
        options.workspaceRoot,
      );
      const baseImagePath = writeTemplateAsset(
        templateDir,
        entry.template.baseImagePath,
        'base',
        entry.templateId,
        options.workspaceRoot,
      );
      const shippedTemplate = {
        ...entry.template,
        title: entry.title,
        tags: [...entry.tags],
        sortOrder: entry.sortOrder,
        previewImagePath,
        baseImagePath,
      } satisfies MelfTemplateDocument;

      writeFileSync(
        join(templateDir, 'template.melf'),
        stringifyMelfTemplateDocument(shippedTemplate),
      );

      manifestTemplates.push({
        templateId: entry.templateId,
        title: entry.title,
        tags: [...entry.tags],
        sortOrder: entry.sortOrder,
        templatePath: `/templates/${entry.templateId}/template.melf`,
        previewImagePath,
        baseImagePath,
      });
    }

    writeFileSync(
      join(publicTemplatesRoot, 'catalog.json'),
      JSON.stringify(
        {
          templates: manifestTemplates,
        },
        null,
        2,
      ),
    );
  };
}

function normalizeCuratedTemplatePayloads(input: CuratedTemplatePayload[]) {
  return [...input]
    .map(validateCuratedTemplatePayload)
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }

      return a.title.localeCompare(b.title);
    });
}

function validateCuratedTemplatePayload(input: CuratedTemplatePayload): CuratedTemplatePayload {
  const templateId = normalizeRequiredString(input.templateId, 'templateId');
  const title = normalizeRequiredString(input.title, 'title');

  if (input.template.templateId !== templateId) {
    throw new Error(`Template payload templateId mismatch for "${templateId}".`);
  }

  return {
    templateId,
    title,
    tags: normalizeTags(input.tags),
    sortOrder: normalizeSortOrder(input.sortOrder),
    template: input.template,
  };
}

function writeTemplateAsset(
  templateDir: string,
  assetPath: string | null,
  assetName: 'preview' | 'base',
  templateId: string,
  workspaceRoot: string,
) {
  if (!assetPath) {
    return null;
  }

  if (assetPath.startsWith('data:')) {
    const asset = decodeDataUrl(assetPath);
    const extension = extensionForMimeType(asset.mimeType);
    writeFileSync(join(templateDir, `${assetName}.${extension}`), asset.bytes);

    return `/templates/${templateId}/${assetName}.${extension}`;
  }

  const sourceAssetPath = resolveRepoAssetSourcePath(workspaceRoot, assetPath);

  if (!sourceAssetPath || !existsSync(sourceAssetPath)) {
    return null;
  }

  const extension = extname(sourceAssetPath).toLowerCase();

  if (!extension) {
    return null;
  }

  const destinationPath = join(templateDir, `${assetName}${extension}`);

  if (resolve(sourceAssetPath) !== resolve(destinationPath)) {
    copyFileSync(sourceAssetPath, destinationPath);
  }

  return `/templates/${templateId}/${assetName}${extension}`;
}

function resolveRepoAssetSourcePath(workspaceRoot: string, assetPath: string) {
  const trimmed = assetPath.trim();

  if (!trimmed.startsWith('/')) {
    return null;
  }

  return join(workspaceRoot, 'public', trimmed.slice(1));
}

function decodeDataUrl(dataUrl: string) {
  const match = /^data:([^;]+);base64,(.+)$/u.exec(dataUrl);
  if (!match) {
    throw new Error('Invalid data URL asset in template catalog promotion payload.');
  }

  return {
    mimeType: match[1].toLowerCase(),
    bytes: decodeBase64(match[2]),
  };
}

function extensionForMimeType(mimeType: string) {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'image/png':
      return 'png';
    default:
      throw new Error(`Unsupported promoted asset mimeType "${mimeType}".`);
  }
}

function normalizeRequiredString(value: string, fieldName: string) {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`Missing required ${fieldName} in template catalog promotion payload.`);
  }

  return normalized;
}

function normalizeTags(value: string[]) {
  return Array.from(
    new Set(
      value
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry) => entry.length > 0),
    ),
  );
}

function normalizeSortOrder(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value));
}

function decodeBase64(payload: string) {
  const binary = atob(payload);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
