import { loadImageElementFromBlob } from '../image/image-loader';

type ClipboardReadItem = {
  getType(type: string): Promise<Blob>;
  types: readonly string[];
};

export async function readImageFromClipboard(): Promise<HTMLImageElement | null> {
  if (!('clipboard' in navigator) || typeof navigator.clipboard.read !== 'function') {
    return null;
  }

  let clipboardItems: ClipboardReadItem[];

  try {
    clipboardItems = (await navigator.clipboard.read()) as ClipboardReadItem[];
  } catch {
    return null;
  }

  for (const item of clipboardItems) {
    const imageType = item.types.find((type) => type.startsWith('image/'));

    if (!imageType) {
      continue;
    }

    try {
      const blob = await item.getType(imageType);
      return await loadImageElementFromBlob(blob);
    } catch {
      continue;
    }
  }

  return null;
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
