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
