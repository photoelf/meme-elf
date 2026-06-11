import { loadImageElementFromBlob } from '../image/image-loader';

type ClipboardReadItem = {
  getType(type: string): Promise<Blob>;
  types: readonly string[];
};

export type ClipboardReadResult =
  | { image: HTMLImageElement; reason: null }
  | {
      image: null;
      reason: 'unsupported' | 'permission-denied' | 'no-image' | 'load-failed';
    };

export async function readImageFromClipboardResult(): Promise<ClipboardReadResult> {
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
