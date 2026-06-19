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

export function applySceneImageAdjustmentsToImageData(
  imageData: RasterImageDataLike,
  input: Partial<SceneImageAdjustments>,
) {
  const adjustments = normalizeSceneImageAdjustments(input);

  if (!hasActiveSceneImageAdjustments(adjustments)) {
    return;
  }

  const brightnessFactor = adjustments.brightness / 100;
  const contrastFactor = adjustments.contrast / 100;
  const saturationFactor = adjustments.saturation / 100;
  const hueRotation = adjustments.hue / 360;
  const { data } = imageData;

  for (let index = 0; index < data.length; index += 4) {
    let red = data[index] ?? 0;
    let green = data[index + 1] ?? 0;
    let blue = data[index + 2] ?? 0;

    red *= brightnessFactor;
    green *= brightnessFactor;
    blue *= brightnessFactor;

    red = (red - 128) * contrastFactor + 128;
    green = (green - 128) * contrastFactor + 128;
    blue = (blue - 128) * contrastFactor + 128;

    let [hue, saturation, lightness] = rgbToHsl(red, green, blue);
    hue = normalizeHue(hue + hueRotation);
    saturation = clampUnit(saturation * saturationFactor);
    [red, green, blue] = hslToRgb(hue, saturation, lightness);

    if (adjustments.grayscale) {
      const luminance = 0.299 * red + 0.587 * green + 0.114 * blue;
      red = luminance;
      green = luminance;
      blue = luminance;
    }

    if (adjustments.sepia) {
      const nextRed = red * 0.393 + green * 0.769 + blue * 0.189;
      const nextGreen = red * 0.349 + green * 0.686 + blue * 0.168;
      const nextBlue = red * 0.272 + green * 0.534 + blue * 0.131;
      red = nextRed;
      green = nextGreen;
      blue = nextBlue;
    }

    if (adjustments.invert) {
      red = 255 - red;
      green = 255 - green;
      blue = 255 - blue;
    }

    data[index] = clampChannel(red);
    data[index + 1] = clampChannel(green);
    data[index + 2] = clampChannel(blue);
  }
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
    case 'blur':
      applyBlur(imageData, value);
      return;
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
  return true;
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

function applyBlur(imageData: RasterImageDataLike, blurAmount: number) {
  const radius = Math.max(1, Math.round(blurAmount / 4));

  if (radius <= 0) {
    return;
  }

  const { data, width, height } = imageData;
  const source = new Uint8ClampedArray(data);
  const horizontalPass = new Uint8ClampedArray(data.length);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const targetIndex = (y * width + x) * 4;

      for (let channel = 0; channel < 4; channel += 1) {
        let sum = 0;
        let samples = 0;

        for (let offset = -radius; offset <= radius; offset += 1) {
          const sampleX = x + offset;

          if (sampleX < 0 || sampleX >= width) {
            continue;
          }

          const sampleIndex = (y * width + sampleX) * 4 + channel;
          sum += source[sampleIndex] ?? 0;
          samples += 1;
        }

        horizontalPass[targetIndex + channel] = clampChannel(sum / Math.max(1, samples));
      }
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const targetIndex = (y * width + x) * 4;

      for (let channel = 0; channel < 4; channel += 1) {
        let sum = 0;
        let samples = 0;

        for (let offset = -radius; offset <= radius; offset += 1) {
          const sampleY = y + offset;

          if (sampleY < 0 || sampleY >= height) {
            continue;
          }

          const sampleIndex = (sampleY * width + x) * 4 + channel;
          sum += horizontalPass[sampleIndex] ?? 0;
          samples += 1;
        }

        data[targetIndex + channel] = clampChannel(sum / Math.max(1, samples));
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

function clampUnit(value: number) {
  return Math.max(0, Math.min(1, value));
}

function normalizeHue(value: number) {
  let nextValue = value;

  while (nextValue < 0) {
    nextValue += 1;
  }

  while (nextValue > 1) {
    nextValue -= 1;
  }

  return nextValue;
}

function rgbToHsl(red: number, green: number, blue: number) {
  const r = clampChannel(red) / 255;
  const g = clampChannel(green) / 255;
  const b = clampChannel(blue) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;

  if (max === min) {
    return [0, 0, lightness] as const;
  }

  const delta = max - min;
  const saturation =
    lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue = 0;

  switch (max) {
    case r:
      hue = (g - b) / delta + (g < b ? 6 : 0);
      break;
    case g:
      hue = (b - r) / delta + 2;
      break;
    default:
      hue = (r - g) / delta + 4;
      break;
  }

  return [hue / 6, saturation, lightness] as const;
}

function hslToRgb(hue: number, saturation: number, lightness: number) {
  if (saturation === 0) {
    const value = lightness * 255;
    return [value, value, value] as const;
  }

  const q =
    lightness < 0.5
      ? lightness * (1 + saturation)
      : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;

  return [
    hueToRgb(p, q, hue + 1 / 3) * 255,
    hueToRgb(p, q, hue) * 255,
    hueToRgb(p, q, hue - 1 / 3) * 255,
  ] as const;
}

function hueToRgb(p: number, q: number, value: number) {
  let nextValue = value;

  if (nextValue < 0) {
    nextValue += 1;
  }

  if (nextValue > 1) {
    nextValue -= 1;
  }

  if (nextValue < 1 / 6) {
    return p + (q - p) * 6 * nextValue;
  }

  if (nextValue < 1 / 2) {
    return q;
  }

  if (nextValue < 2 / 3) {
    return p + (q - p) * (2 / 3 - nextValue) * 6;
  }

  return p;
}
