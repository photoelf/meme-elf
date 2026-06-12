import type { SceneImageEffectKind, SceneImageEffects } from '../../app/types';

const MIN_PERCENT_FILTER = 0;
const MAX_PERCENT_FILTER = 200;
const MIN_HUE_ROTATION = -180;
const MAX_HUE_ROTATION = 180;

export type SerializedSceneImageEffect = {
  kind: SceneImageEffectKind;
  value: number;
  css: string;
};

export function createDefaultSceneImageEffects(): SceneImageEffects {
  return {
    brightness: 100,
    contrast: 100,
    saturation: 100,
    hue: 0,
    grayscale: false,
    sepia: false,
    invert: false,
  };
}

export function normalizeSceneImageEffects(
  input: Partial<SceneImageEffects>,
): SceneImageEffects {
  const defaults = createDefaultSceneImageEffects();

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
    sepia: Boolean(input.sepia ?? defaults.sepia),
    invert: Boolean(input.invert ?? defaults.invert),
  };
}

export function serializeSceneImageEffects(
  input: Partial<SceneImageEffects>,
): SerializedSceneImageEffect[] {
  const effects = normalizeSceneImageEffects(input);

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

export function buildCanvasFilter(input: Partial<SceneImageEffects>) {
  return serializeSceneImageEffects(input)
    .map((effect) => effect.css)
    .join(' ');
}

export function hasActiveSceneImageEffects(input: Partial<SceneImageEffects>) {
  const effects = normalizeSceneImageEffects(input);
  const defaults = createDefaultSceneImageEffects();

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

function clampRounded(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}
