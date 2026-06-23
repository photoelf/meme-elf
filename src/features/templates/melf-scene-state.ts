import { createDefaultAppState } from '../../app/default-state';
import {
  isDrawLayer,
  isImageLayer,
  isTextLayer,
  type AppState,
  type DrawLayer,
  type ImageLayer,
  type RasterSurface,
  type TextLayer,
} from '../../app/types';
import { loadImageElementFromUrl } from '../image/image-loader';
import type {
  MelfEmbeddedImageAsset,
  MelfSceneDocument,
  MelfSceneDrawLayer,
  MelfSceneImageLayer,
  MelfSceneLayer,
} from './melf-scene';

type SerializeOptions = {
  name?: string;
  serializeImageSource?: (
    source: CanvasImageSource,
    size: { width: number; height: number },
  ) => Promise<MelfEmbeddedImageAsset | null> | MelfEmbeddedImageAsset | null;
  serializeRasterSurface?: (
    surface: RasterSurface,
  ) => Promise<MelfEmbeddedImageAsset | null> | MelfEmbeddedImageAsset | null;
};

type MaterializeOptions = {
  loadImageAsset?: (asset: MelfEmbeddedImageAsset) => Promise<HTMLImageElement>;
  decodeRasterAsset?: (asset: MelfEmbeddedImageAsset) => Promise<RasterSurface>;
};

export async function serializeAppStateToMelfSceneDocument(
  state: AppState,
  options: SerializeOptions = {},
): Promise<MelfSceneDocument> {
  const serializeImageSource = options.serializeImageSource ?? defaultSerializeImageSource;
  const serializeRasterSurface = options.serializeRasterSurface ?? defaultSerializeRasterSurface;
  const layers: MelfSceneLayer[] = [];

  for (const layer of state.layers) {
    if (isTextLayer(layer)) {
      layers.push(serializeTextLayer(layer));
      continue;
    }

    if (isImageLayer(layer)) {
      layers.push(await serializeImageLayer(layer, serializeImageSource));
      continue;
    }

    if (isDrawLayer(layer)) {
      layers.push(await serializeDrawLayer(layer, serializeRasterSurface));
    }
  }

  return {
    kind: 'scene',
    version: 1,
    name: normalizeName(options.name),
    scene: {
      canvasSize: {
        width: state.canvasSize.width,
        height: state.canvasSize.height,
      },
      activeLayerId: state.activeLayerId,
      baseImage:
        state.image === null
          ? null
          : await serializeImageSource(state.image, {
              width: getCanvasImageSourceWidth(state.image, state.canvasSize.width),
              height: getCanvasImageSourceHeight(state.image, state.canvasSize.height),
            }),
      layers,
    },
    sceneImageAdjustments: {
      ...state.sceneImageAdjustments,
    },
    sceneEffectStack: state.sceneEffectStack.map((effect) => ({ ...effect })),
    sceneWatermark: {
      ...state.sceneWatermark,
    },
  };
}

export async function materializeAppStateFromMelfSceneDocument(
  document: MelfSceneDocument,
  options: MaterializeOptions = {},
): Promise<AppState> {
  const defaultState = createDefaultAppState();
  const loadImageAsset = options.loadImageAsset ?? defaultLoadImageAsset;
  const decodeRasterAsset = options.decodeRasterAsset ?? defaultDecodeRasterAsset;
  const layers = [];

  for (const layer of document.scene.layers) {
    if (layer.kind === 'text') {
      layers.push(materializeTextLayer(layer));
      continue;
    }

    if (layer.kind === 'image') {
      layers.push(await materializeImageLayer(layer, loadImageAsset));
      continue;
    }

    layers.push(await materializeDrawLayer(layer, decodeRasterAsset));
  }

  return {
    ...defaultState,
    image: document.scene.baseImage ? await loadImageAsset(document.scene.baseImage) : null,
    canvasSize: {
      width: document.scene.canvasSize.width,
      height: document.scene.canvasSize.height,
    },
    layers,
    activeLayerId: resolveActiveLayerId(document.scene.activeLayerId, layers),
    sceneImageAdjustments: {
      ...document.sceneImageAdjustments,
    },
    sceneEffectStack: document.sceneEffectStack.map((effect) => ({ ...effect })),
    sceneWatermark: {
      ...document.sceneWatermark,
    },
  };
}

function serializeTextLayer(layer: TextLayer): TextLayer {
  return {
    ...layer,
    box: {
      ...layer.box,
    },
  };
}

async function serializeImageLayer(
  layer: ImageLayer,
  serializeImageSource: NonNullable<SerializeOptions['serializeImageSource']>,
): Promise<MelfSceneImageLayer> {
  return {
    kind: 'image',
    id: layer.id,
    name: layer.name,
    box: {
      ...layer.box,
    },
    opacity: layer.opacity,
    sourceSize: {
      ...layer.sourceSize,
    },
    skew: {
      ...layer.skew,
    },
    imageAsset: layer.image
      ? await serializeImageSource(layer.image, layer.sourceSize)
      : null,
  };
}

async function serializeDrawLayer(
  layer: DrawLayer,
  serializeRasterSurface: NonNullable<SerializeOptions['serializeRasterSurface']>,
): Promise<MelfSceneDrawLayer> {
  return {
    kind: 'draw',
    id: layer.id,
    name: layer.name,
    box: {
      ...layer.box,
    },
    opacity: layer.opacity,
    sourceSize: {
      ...layer.sourceSize,
    },
    rasterAsset: await serializeRasterSurface(layer.raster),
  };
}

function materializeTextLayer(layer: TextLayer): TextLayer {
  return {
    ...layer,
    box: {
      ...layer.box,
    },
  };
}

async function materializeImageLayer(
  layer: MelfSceneImageLayer,
  loadImageAsset: NonNullable<MaterializeOptions['loadImageAsset']>,
): Promise<ImageLayer> {
  return {
    kind: 'image',
    id: layer.id,
    name: layer.name,
    box: {
      ...layer.box,
    },
    opacity: layer.opacity,
    sourceSize: {
      ...layer.sourceSize,
    },
    skew: {
      ...layer.skew,
    },
    image: layer.imageAsset ? await loadImageAsset(layer.imageAsset) : null,
  };
}

async function materializeDrawLayer(
  layer: MelfSceneDrawLayer,
  decodeRasterAsset: NonNullable<MaterializeOptions['decodeRasterAsset']>,
): Promise<DrawLayer> {
  return {
    kind: 'draw',
    id: layer.id,
    name: layer.name,
    box: {
      ...layer.box,
    },
    opacity: layer.opacity,
    sourceSize: {
      ...layer.sourceSize,
    },
    raster: layer.rasterAsset
      ? await decodeRasterAsset(layer.rasterAsset)
      : createBlankRasterSurface(layer.sourceSize.width, layer.sourceSize.height),
  };
}

async function defaultSerializeImageSource(
  source: CanvasImageSource,
  size: { width: number; height: number },
): Promise<MelfEmbeddedImageAsset | null> {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(size.width));
  canvas.height = Math.max(1, Math.round(size.height));
  const context = canvas.getContext('2d');

  if (!context) {
    return null;
  }

  context.drawImage(source, 0, 0, canvas.width, canvas.height);

  return {
    mimeType: 'image/png',
    dataUrl: canvas.toDataURL('image/png'),
    width: canvas.width,
    height: canvas.height,
  };
}

async function defaultSerializeRasterSurface(
  surface: RasterSurface,
): Promise<MelfEmbeddedImageAsset | null> {
  const canvas = document.createElement('canvas');
  canvas.width = surface.width;
  canvas.height = surface.height;
  const context = canvas.getContext('2d');

  if (!context) {
    return null;
  }

  const imageData = new ImageData(surface.data, surface.width, surface.height);
  context.putImageData(imageData, 0, 0);

  return {
    mimeType: 'image/png',
    dataUrl: canvas.toDataURL('image/png'),
    width: surface.width,
    height: surface.height,
  };
}

async function defaultLoadImageAsset(asset: MelfEmbeddedImageAsset) {
  return loadImageElementFromUrl(asset.dataUrl);
}

async function defaultDecodeRasterAsset(asset: MelfEmbeddedImageAsset): Promise<RasterSurface> {
  const image = await defaultLoadImageAsset(asset);
  const canvas = document.createElement('canvas');
  canvas.width = asset.width;
  canvas.height = asset.height;
  const context = canvas.getContext('2d');

  if (!context) {
    return createBlankRasterSurface(asset.width, asset.height);
  }

  context.drawImage(image, 0, 0, asset.width, asset.height);
  const imageData = context.getImageData(0, 0, asset.width, asset.height);

  return {
    width: asset.width,
    height: asset.height,
    data: new Uint8ClampedArray(imageData.data),
  };
}

function createBlankRasterSurface(width: number, height: number): RasterSurface {
  return {
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4),
  };
}

function normalizeName(value: string | undefined) {
  if (typeof value !== 'string') {
    return 'Untitled scene';
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : 'Untitled scene';
}

function resolveActiveLayerId(
  activeLayerId: string | null,
  layers: AppState['layers'],
) {
  if (typeof activeLayerId === 'string' && layers.some((layer) => layer.id === activeLayerId)) {
    return activeLayerId;
  }

  return layers[0]?.id ?? null;
}

function getCanvasImageSourceWidth(source: CanvasImageSource, fallback: number) {
  if ('naturalWidth' in source && typeof source.naturalWidth === 'number' && source.naturalWidth > 0) {
    return source.naturalWidth;
  }

  if ('videoWidth' in source && typeof source.videoWidth === 'number' && source.videoWidth > 0) {
    return source.videoWidth;
  }

  if ('width' in source && typeof source.width === 'number' && source.width > 0) {
    return source.width;
  }

  return fallback;
}

function getCanvasImageSourceHeight(source: CanvasImageSource, fallback: number) {
  if ('naturalHeight' in source && typeof source.naturalHeight === 'number' && source.naturalHeight > 0) {
    return source.naturalHeight;
  }

  if ('videoHeight' in source && typeof source.videoHeight === 'number' && source.videoHeight > 0) {
    return source.videoHeight;
  }

  if ('height' in source && typeof source.height === 'number' && source.height > 0) {
    return source.height;
  }

  return fallback;
}
