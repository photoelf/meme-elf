import { loadImageElementFromBlob } from '../image/image-loader';

type ClipboardReadItem = {
  getType(type: string): Promise<Blob>;
  types: readonly string[];
};

export type ClipboardReadResult =
  | { image: HTMLImageElement; reason: null }
  | {
      image: null;
      reason:
        | 'unsupported'
        | 'secure-context-required'
        | 'permission-denied'
        | 'no-image'
        | 'load-failed';
    };

export type ClipboardReadTarget = 'base-import' | 'advanced-import';

export async function readImageFromClipboardResult(): Promise<ClipboardReadResult> {
  if (typeof isSecureContext !== 'undefined' && !isSecureContext) {
    return { image: null, reason: 'secure-context-required' };
  }

  if (!('clipboard' in navigator) || typeof navigator.clipboard.read !== 'function') {
    return { image: null, reason: 'unsupported' };
  }

  let clipboardItems: ClipboardReadItem[];

  try {
    clipboardItems = (await navigator.clipboard.read()) as ClipboardReadItem[];
  } catch {
    return { image: null, reason: 'permission-denied' };
  }

  let foundImageType = false;

  for (const item of clipboardItems) {
    const imageType = item.types.find((type) => type.startsWith('image/'));

    if (!imageType) {
      continue;
    }

    foundImageType = true;

    try {
      const blob = await item.getType(imageType);
      const image = await loadImageElementFromBlob(blob);
      return { image, reason: null };
    } catch {
      continue;
    }
  }

  return { image: null, reason: foundImageType ? 'load-failed' : 'no-image' };
}

export async function readImageFromClipboard(): Promise<HTMLImageElement | null> {
  const result = await readImageFromClipboardResult();
  return result.image;
}

export function resolveClipboardReadFailureMessage(
  reason: Exclude<ClipboardReadResult['reason'], null>,
  target: ClipboardReadTarget,
) {
  const fallbackAction =
    target === 'advanced-import' ? 'Use Advanced import from file instead.' : 'Use Upload Image instead.';

  switch (reason) {
    case 'unsupported':
      return `This browser cannot read images from the clipboard here. ${fallbackAction}`;
    case 'secure-context-required':
      return `Clipboard image paste needs HTTPS or another secure context here. ${fallbackAction}`;
    case 'permission-denied':
      return `Clipboard access was blocked. Try again or ${fallbackAction.toLowerCase()}`;
    case 'no-image':
      return `No image was found in the clipboard. Copy an image first or ${fallbackAction.toLowerCase()}`;
    case 'load-failed':
      return `The clipboard image could not be loaded. ${fallbackAction}`;
  }
}

export async function extractImageFromPasteEvent(
  event: ClipboardEvent,
): Promise<HTMLImageElement | null> {
  const items = event.clipboardData?.items;

  if (!items) {
    return null;
  }

  for (const item of items) {
    if (!item.type.startsWith('image/')) {
      continue;
    }

    const blob = item.getAsFile();

    if (!blob) {
      continue;
    }

    try {
      return await loadImageElementFromBlob(blob);
    } catch {
      continue;
    }
  }

  return null;
}
