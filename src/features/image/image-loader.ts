export function loadImageElementFromBlob(blob: Blob): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
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
