import { isImageLayer } from '../../app/types';
import type { EditorLayer, ImageLayer } from '../../app/types';

const RIGHT_ANGLE_RADIANS = Math.PI / 2;

export type SceneImageStackTransform =
  | 'rotate-clockwise'
  | 'rotate-counter-clockwise'
  | 'flip-horizontal'
  | 'flip-vertical';

export function applySceneImageStackTransform(input: {
  canvasSize: { width: number; height: number };
  layers: EditorLayer[];
  transform: SceneImageStackTransform;
}) {
  const nextCanvasSize = resolveTransformedCanvasSize(input.canvasSize, input.transform);

  return {
    canvasSize: nextCanvasSize,
    layers: input.layers.map((layer) => {
      if (!isImageLayer(layer)) {
        return layer;
      }

      return transformImageLayerInScene(layer, input.canvasSize, input.transform);
    }),
  };
}

export function createTransformedSceneImage(input: {
  canvasSize: { width: number; height: number };
  image: CanvasImageSource | null;
  transform: SceneImageStackTransform;
}) {
  if (!input.image) {
    return null;
  }

  const nextCanvasSize = resolveTransformedCanvasSize(input.canvasSize, input.transform);
  const transformedCanvas = document.createElement('canvas');
  transformedCanvas.width = nextCanvasSize.width;
  transformedCanvas.height = nextCanvasSize.height;
  const transformedContext = transformedCanvas.getContext('2d');

  if (!transformedContext) {
    return input.image as HTMLImageElement;
  }

  transformedContext.clearRect(0, 0, nextCanvasSize.width, nextCanvasSize.height);
  transformedContext.save();
  transformedContext.translate(nextCanvasSize.width / 2, nextCanvasSize.height / 2);

  if (input.transform === 'rotate-clockwise') {
    transformedContext.rotate(RIGHT_ANGLE_RADIANS);
  } else if (input.transform === 'rotate-counter-clockwise') {
    transformedContext.rotate(-RIGHT_ANGLE_RADIANS);
  }

  transformedContext.scale(
    input.transform === 'flip-horizontal' ? -1 : 1,
    input.transform === 'flip-vertical' ? -1 : 1,
  );
  transformedContext.drawImage(
    input.image,
    -input.canvasSize.width / 2,
    -input.canvasSize.height / 2,
    input.canvasSize.width,
    input.canvasSize.height,
  );
  transformedContext.restore();

  return transformedCanvas as unknown as HTMLImageElement;
}

function resolveTransformedCanvasSize(
  canvasSize: { width: number; height: number },
  transform: SceneImageStackTransform,
) {
  if (transform === 'rotate-clockwise' || transform === 'rotate-counter-clockwise') {
    return {
      width: canvasSize.height,
      height: canvasSize.width,
    };
  }

  return { ...canvasSize };
}

function transformImageLayerInScene(
  layer: ImageLayer,
  canvasSize: { width: number; height: number },
  transform: SceneImageStackTransform,
): ImageLayer {
  const centerX = layer.box.x + layer.box.width / 2;
  const centerY = layer.box.y + layer.box.height / 2;

  if (transform === 'rotate-clockwise') {
    const nextWidth = layer.box.height;
    const nextHeight = layer.box.width;
    const nextCenterX = canvasSize.height - centerY;
    const nextCenterY = centerX;

    return {
      ...layer,
      box: {
        x: nextCenterX - nextWidth / 2,
        y: nextCenterY - nextHeight / 2,
        width: nextWidth,
        height: nextHeight,
        rotation: layer.box.rotation + RIGHT_ANGLE_RADIANS,
      },
    };
  }

  if (transform === 'rotate-counter-clockwise') {
    const nextWidth = layer.box.height;
    const nextHeight = layer.box.width;
    const nextCenterX = centerY;
    const nextCenterY = canvasSize.width - centerX;

    return {
      ...layer,
      box: {
        x: nextCenterX - nextWidth / 2,
        y: nextCenterY - nextHeight / 2,
        width: nextWidth,
        height: nextHeight,
        rotation: layer.box.rotation - RIGHT_ANGLE_RADIANS,
      },
    };
  }

  if (transform === 'flip-horizontal') {
    return {
      ...layer,
      box: {
        ...layer.box,
        x: canvasSize.width - layer.box.x - layer.box.width,
      },
      skew: {
        x: layer.skew.x * -1,
        y: layer.skew.y,
      },
    };
  }

  return {
    ...layer,
    box: {
      ...layer.box,
      y: canvasSize.height - layer.box.y - layer.box.height,
    },
    skew: {
      x: layer.skew.x,
      y: layer.skew.y * -1,
    },
  };
}
