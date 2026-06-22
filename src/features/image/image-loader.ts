const OBJECT_URL_KEY = '__memeElfObjectUrl';

type ImageWithObjectUrl = HTMLImageElement & {
  [OBJECT_URL_KEY]?: string;
};

export function loadImageElementFromBlob(blob: Blob): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const image = new Image() as ImageWithObjectUrl;
    image[OBJECT_URL_KEY] = objectUrl;

    image.onload = () => {
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image from blob.'));
    };

    image.src = objectUrl;
  });
}

export function loadImageElementFromFile(file: File): Promise<HTMLImageElement> {
  return loadImageElementFromBlob(file);
}

export function loadImageElementFromUrl(url: string): Promise<HTMLImageElement> {
  const parsedUrl = safelyParseUrl(url);

  if (parsedUrl && (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:')) {
    return loadRemoteImageElementFromUrl(parsedUrl.toString());
  }

  if (parsedUrl && parsedUrl.protocol !== 'data:' && parsedUrl.protocol !== 'blob:') {
    return Promise.reject(new Error('Use a direct http(s) image URL.'));
  }

  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      resolve(image);
    };

    image.onerror = () => {
      reject(new Error('Failed to load image from URL.'));
    };

    image.src = url;
  });
}

async function loadRemoteImageElementFromUrl(url: string): Promise<HTMLImageElement> {
  const parsedUrl = safelyParseUrl(url);

  if (!parsedUrl || (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:')) {
    throw new Error('Use a direct http(s) image URL.');
  }

  let response: Response;

  try {
    response = await fetch(parsedUrl.toString(), {
      credentials: 'omit',
      mode: 'cors',
      redirect: 'follow',
      referrerPolicy: 'no-referrer',
    });
  } catch {
    throw new Error('That image URL could not be fetched here. Use a direct image URL that allows browser access.');
  }

  if (!response.ok) {
    throw new Error('That image URL could not be loaded.');
  }

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';

  if (!contentType.startsWith('image/')) {
    throw new Error('That URL did not return an image.');
  }

  return loadImageElementFromBlob(await response.blob());
}

export function revokeLoadedImageObjectUrl(image: CanvasImageSource | null) {
  if (!(image instanceof HTMLImageElement)) {
    return;
  }

  const imageWithObjectUrl = image as ImageWithObjectUrl;
  const objectUrl = imageWithObjectUrl[OBJECT_URL_KEY];

  if (!objectUrl) {
    return;
  }

  URL.revokeObjectURL(objectUrl);
  delete imageWithObjectUrl[OBJECT_URL_KEY];
}

function safelyParseUrl(url: string) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}
