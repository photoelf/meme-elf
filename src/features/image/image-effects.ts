import type {
  SceneEffectStackItem,
  SceneEffectStackKind,
  SceneImageAdjustmentKind,
  SceneImageAdjustments,
} from '../../app/types';

const MIN_PERCENT_FILTER = 0;
const MAX_PERCENT_FILTER = 200;
const MIN_HUE_ROTATION = -180;
const MAX_HUE_ROTATION = 180;
const MIN_BLUR = 0;
const MAX_BLUR = 24;
const MIN_RASTER_INTENSITY = 0;
const MAX_RASTER_INTENSITY = 100;
const DEFAULT_SCENE_EFFECT_ORDER: SceneEffectStackKind[] = [
  'blur',
  'sharpen',
  'threshold',
  'pixelate',
  'noise',
  'grain',
  'posterize',
  'jpeg',
];

type RasterImageDataLike = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

export type SerializedSceneImageAdjustment = {
  kind: SceneImageAdjustmentKind;
  value: number;
  css: string;
};

export function createDefaultSceneImageAdjustments(): SceneImageAdjustments {
  return {
    brightness: 100,
    contrast: 100,
    saturation: 100,
    hue: 0,
    grayscale: false,
    includeText: false,
    sepia: false,
    invert: false,
  };
}

export function createDefaultSceneEffectStack(): SceneEffectStackItem[] {
  return DEFAULT_SCENE_EFFECT_ORDER.map((kind) => ({
    id: kind,
    kind,
    value: 0,
  }));
}

export function normalizeSceneImageAdjustments(
  input: Partial<SceneImageAdjustments>,
): SceneImageAdjustments {
  const defaults = createDefaultSceneImageAdjustments();

  return {
    brightness: clampRounded(
      input.brightness ?? defaults.brightness,
      MIN_PERCENT_FILTER,
      MAX_PERCENT_FILTER,
    ),
    contrast: clampRounded(
      input.contrast ?? defaults.contrast,
      MIN_PERCENT_FILTER,
      MAX_PERCENT_FILTER,
    ),
    saturation: clampRounded(
      input.saturation ?? defaults.saturation,
      MIN_PERCENT_FILTER,
      MAX_PERCENT_FILTER,
    ),
    hue: clampRounded(input.hue ?? defaults.hue, MIN_HUE_ROTATION, MAX_HUE_ROTATION),
    grayscale: Boolean(input.grayscale ?? defaults.grayscale),
    includeText: Boolean(input.includeText ?? defaults.includeText),
    sepia: Boolean(input.sepia ?? defaults.sepia),
    invert: Boolean(input.invert ?? defaults.invert),
  };
}

export function normalizeSceneEffectStack(
  input: SceneEffectStackItem[],
): SceneEffectStackItem[] {
  const defaults = createDefaultSceneEffectStack();
  const defaultByKind = new Map(defaults.map((effect) => [effect.kind, effect]));
  const seenKinds = new Set<SceneEffectStackKind>();
  const normalized: SceneEffectStackItem[] = [];

  for (const effect of input) {
    if (!defaultByKind.has(effect.kind) || seenKinds.has(effect.kind)) {
      continue;
    }

    normalized.push({
      id: effect.id,
      kind: effect.kind,
      value: normalizeSceneEffectValue(effect.kind, effect.value),
    });
    seenKinds.add(effect.kind);
  }

  for (const effect of defaults) {
    if (seenKinds.has(effect.kind)) {
      continue;
    }

    normalized.push({ ...effect });
  }

  return normalized;
}

export function serializeSceneImageAdjustments(
  input: Partial<SceneImageAdjustments>,
): SerializedSceneImageAdjustment[] {
  const effects = normalizeSceneImageAdjustments(input);

  return [
    {
      kind: 'brightness',
      value: effects.brightness,
      css: `brightness(${effects.brightness}%)`,
    },
    {
      kind: 'contrast',
      value: effects.contrast,
      css: `contrast(${effects.contrast}%)`,
    },
    {
      kind: 'saturation',
      value: effects.saturation,
      css: `saturate(${effects.saturation}%)`,
    },
    {
      kind: 'hue',
      value: effects.hue,
      css: `hue-rotate(${effects.hue}deg)`,
    },
    {
      kind: 'grayscale',
      value: effects.grayscale ? 100 : 0,
      css: `grayscale(${effects.grayscale ? 100 : 0}%)`,
    },
    {
      kind: 'sepia',
      value: effects.sepia ? 100 : 0,
      css: `sepia(${effects.sepia ? 100 : 0}%)`,
    },
    {
      kind: 'invert',
      value: effects.invert ? 100 : 0,
      css: `invert(${effects.invert ? 100 : 0}%)`,
    },
  ];
}

export function buildAdjustmentCanvasFilter(input: Partial<SceneImageAdjustments>) {
  return serializeSceneImageAdjustments(input)
    .filter((effect) => effect.css.length > 0)
    .map((effect) => effect.css)
    .join(' ');
}

export function hasActiveSceneImageAdjustments(input: Partial<SceneImageAdjustments>) {
  const effects = normalizeSceneImageAdjustments(input);
  const defaults = createDefaultSceneImageAdjustments();

  return (
    effects.brightness !== defaults.brightness ||
    effects.contrast !== defaults.contrast ||
    effects.saturation !== defaults.saturation ||
    effects.hue !== defaults.hue ||
    effects.grayscale !== defaults.grayscale ||
    effects.sepia !== defaults.sepia ||
    effects.invert !== defaults.invert
  );
}

export function hasActiveSceneEffectStack(input: SceneEffectStackItem[]) {
  return normalizeSceneEffectStack(input).some((effect) => effect.value > 0);
}

export function applySceneEffectToImageData(
  imageData: RasterImageDataLike,
  effect: SceneEffectStackItem,
  random: () => number = Math.random,
) {
  const value = normalizeSceneEffectValue(effect.kind, effect.value);

  if (value <= 0) {
    return;
  }

  switch (effect.kind) {
    case 'sharpen':
      applySharpen(imageData, value / 100);
      return;
    case 'threshold':
      applyThreshold(imageData, value);
      return;
    case 'pixelate':
      applyPixelate(imageData, value);
      return;
    case 'noise':
      applyNoise(imageData, value, random);
      return;
    case 'grain':
      applyGrain(imageData, value, random);
      return;
    case 'posterize':
      applyPosterize(imageData, value);
      return;
    case 'jpeg':
      applyJpegDegradation(imageData, value);
      return;
    case 'blur':
      return;
  }
}

export function applySceneEffectStackToImageData(
  imageData: RasterImageDataLike,
  effects: SceneEffectStackItem[],
  random: () => number = Math.random,
) {
  for (const effect of normalizeSceneEffectStack(effects)) {
    applySceneEffectToImageData(imageData, effect, random);
  }
}

export function isRasterSceneEffectKind(kind: SceneEffectStackKind) {
  return kind !== 'blur';
}

function clampRounded(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}

function normalizeSceneEffectValue(kind: SceneEffectStackKind, value: number) {
  if (kind === 'blur') {
    return clampRounded(value, MIN_BLUR, MAX_BLUR);
  }

  return clampRounded(value, MIN_RASTER_INTENSITY, MAX_RASTER_INTENSITY);
}

function applyThreshold(imageData: RasterImageDataLike, thresholdPercent: number) {
  const limit = Math.round((thresholdPercent / 100) * 255);
  const { data } = imageData;

  for (let index = 0; index < data.length; index += 4) {
    const luminance = 0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2];
    const nextValue = luminance >= limit ? 255 : 0;
    data[index] = nextValue;
    data[index + 1] = nextValue;
    data[index + 2] = nextValue;
  }
}

function applyPixelate(imageData: RasterImageDataLike, pixelateAmount: number) {
  const blockSize = Math.max(1, Math.round(pixelateAmount));

  if (blockSize <= 1) {
    return;
  }

  const { data, width, height } = imageData;

  for (let y = 0; y < height; y += blockSize) {
    for (let x = 0; x < width; x += blockSize) {
      let red = 0;
      let green = 0;
      let blue = 0;
      let alpha = 0;
      let pixels = 0;

      for (let offsetY = 0; offsetY < blockSize && y + offsetY < height; offsetY += 1) {
        for (let offsetX = 0; offsetX < blockSize && x + offsetX < width; offsetX += 1) {
          const index = ((y + offsetY) * width + (x + offsetX)) * 4;
          red += data[index];
          green += data[index + 1];
          blue += data[index + 2];
          alpha += data[index + 3];
          pixels += 1;
        }
      }

      const nextRed = Math.round(red / pixels);
      const nextGreen = Math.round(green / pixels);
      const nextBlue = Math.round(blue / pixels);
      const nextAlpha = Math.round(alpha / pixels);

      for (let offsetY = 0; offsetY < blockSize && y + offsetY < height; offsetY += 1) {
        for (let offsetX = 0; offsetX < blockSize && x + offsetX < width; offsetX += 1) {
          const index = ((y + offsetY) * width + (x + offsetX)) * 4;
          data[index] = nextRed;
          data[index + 1] = nextGreen;
          data[index + 2] = nextBlue;
          data[index + 3] = nextAlpha;
        }
      }
    }
  }
}

function applyNoise(
  imageData: RasterImageDataLike,
  noiseAmount: number,
  random: () => number,
) {
  const deltaLimit = Math.round((noiseAmount / 100) * 160);
  const { data } = imageData;

  for (let index = 0; index < data.length; index += 4) {
    data[index] = clampChannel(data[index] + Math.round((random() * 2 - 1) * deltaLimit));
    data[index + 1] = clampChannel(
      data[index + 1] + Math.round((random() * 2 - 1) * deltaLimit),
    );
    data[index + 2] = clampChannel(
      data[index + 2] + Math.round((random() * 2 - 1) * deltaLimit),
    );
  }
}

function applyGrain(
  imageData: RasterImageDataLike,
  grainAmount: number,
  random: () => number,
) {
  const deltaLimit = Math.round((grainAmount / 100) * 72);
  const { data } = imageData;

  for (let index = 0; index < data.length; index += 4) {
    const delta = Math.round((random() * 2 - 1) * deltaLimit);
    data[index] = clampChannel(data[index] + delta);
    data[index + 1] = clampChannel(data[index + 1] + delta);
    data[index + 2] = clampChannel(data[index + 2] + delta);
  }
}

function applyPosterize(imageData: RasterImageDataLike, posterizeAmount: number) {
  const levels = Math.max(2, 32 - Math.round((posterizeAmount / 100) * 30));
  const step = 255 / (levels - 1);
  const { data } = imageData;

  for (let index = 0; index < data.length; index += 4) {
    data[index] = clampChannel(Math.round(data[index] / step) * step);
    data[index + 1] = clampChannel(Math.round(data[index + 1] / step) * step);
    data[index + 2] = clampChannel(Math.round(data[index + 2] / step) * step);
  }
}

function applyJpegDegradation(imageData: RasterImageDataLike, jpegAmount: number) {
  const blockSize = Math.max(1, 1 + Math.floor(jpegAmount / 20));
  applyPixelate(imageData, blockSize);

  const quantizeLevels = Math.max(3, 24 - Math.round((jpegAmount / 100) * 20));
  const quantizeStep = 255 / (quantizeLevels - 1);
  const { data } = imageData;

  for (let index = 0; index < data.length; index += 4) {
    data[index] = clampChannel(Math.round(data[index] / quantizeStep) * quantizeStep);
    data[index + 1] = clampChannel(Math.round(data[index + 1] / quantizeStep) * quantizeStep);
    data[index + 2] = clampChannel(Math.round(data[index + 2] / quantizeStep) * quantizeStep);
  }
}

function applySharpen(imageData: RasterImageDataLike, amount: number) {
  const { data, width, height } = imageData;
  const source = new Uint8ClampedArray(data);

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = (y * width + x) * 4;

      for (let channel = 0; channel < 3; channel += 1) {
        const center = source[index + channel];
        const left = source[index - 4 + channel];
        const right = source[index + 4 + channel];
        const top = source[index - width * 4 + channel];
        const bottom = source[index + width * 4 + channel];
        const sharpened = center * 5 - left - right - top - bottom;
        const mixed = center + (sharpened - center) * amount;
        data[index + channel] = clampChannel(mixed);
      }
    }
  }
}

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}
