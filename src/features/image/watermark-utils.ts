import type {
  SceneWatermark,
  SceneWatermarkCorner,
  SceneWatermarkMode,
} from '../../app/types';

export type WatermarkLayoutItem = {
  color: string;
  opacity: number;
  rotation: number;
  text: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  x: number;
  y: number;
};

export function createDefaultSceneWatermark(): SceneWatermark {
  return {
    enabled: true,
    text: 'создано в программе meme-elf',
    mode: 'corner',
    corner: 'bottom-left',
    opacity: 50,
    size: 12,
    color: '#808080',
    rotation: 0,
  };
}

export function normalizeSceneWatermark(
  input: Partial<SceneWatermark>,
): SceneWatermark {
  const defaults = createDefaultSceneWatermark();

  return {
    enabled: Boolean(input.enabled ?? defaults.enabled),
    text: normalizeText(input.text, defaults.text),
    mode: normalizeMode(input.mode ?? defaults.mode),
    corner: normalizeCorner(input.corner ?? defaults.corner),
    opacity: clampRounded(input.opacity ?? defaults.opacity, 0, 100),
    size: clampRounded(input.size ?? defaults.size, 12, 240),
    color: normalizeColor(input.color ?? defaults.color),
    rotation: clampRounded(input.rotation ?? defaults.rotation, 0, 180),
  };
}

export function buildWatermarkLayout(input: {
  canvasSize: { width: number; height: number };
  color: string;
  mode: SceneWatermarkMode;
  corner: SceneWatermarkCorner;
  opacity: number;
  rotation: number;
  size: number;
  text: string;
}): WatermarkLayoutItem[] {
  const normalizedOpacity = clampOpacity(input.opacity);

  if (input.mode === 'center') {
    return [
      {
        color: input.color,
        opacity: normalizedOpacity,
        rotation: 0,
        text: input.text,
        textAlign: 'center',
        textBaseline: 'middle',
        x: Math.round(input.canvasSize.width / 2),
        y: Math.round(input.canvasSize.height / 2),
      },
    ];
  }

  if (input.mode === 'corner') {
    const padding = 20;
    const isLeft = input.corner === 'top-left' || input.corner === 'bottom-left';
    const isTop = input.corner === 'top-left' || input.corner === 'top-right';

    return [
      {
        color: input.color,
        opacity: normalizedOpacity,
        rotation: 0,
        text: input.text,
        textAlign: isLeft ? 'left' : 'right',
        textBaseline: isTop ? 'top' : 'bottom',
        x: isLeft ? padding : input.canvasSize.width - padding,
        y: isTop ? padding : input.canvasSize.height - padding,
      },
    ];
  }

  if (input.mode === 'diagonal') {
    return [
      {
        color: input.color,
        opacity: normalizedOpacity,
        rotation: -Math.PI / 6,
        text: input.text,
        textAlign: 'center',
        textBaseline: 'middle',
        x: Math.round(input.canvasSize.width / 2),
        y: Math.round(input.canvasSize.height / 2),
      },
    ];
  }

  const items: WatermarkLayoutItem[] = [];
  const stepX = Math.max(1, Math.round(input.size * 3));
  const stepY = Math.max(1, Math.round(input.size * 2));
  const startX = Math.max(1, Math.round(input.size * 1.5));
  const startY = Math.max(1, Math.round(input.size));

  for (let y = startY; y <= input.canvasSize.height; y += stepY) {
    for (let x = startX; x <= input.canvasSize.width; x += stepX) {
      items.push({
        color: input.color,
        opacity: normalizedOpacity,
        rotation: (input.rotation * Math.PI) / 180,
        text: input.text,
        textAlign: 'center',
        textBaseline: 'middle',
        x,
        y,
      });
    }
  }

  return items;
}

function clampOpacity(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, Math.round(value) / 100));
}

function clampRounded(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}

function normalizeMode(value: SceneWatermarkMode | string): SceneWatermarkMode {
  return value === 'corner' || value === 'tile' || value === 'diagonal' ? value : 'center';
}

function normalizeCorner(value: SceneWatermarkCorner | string): SceneWatermarkCorner {
  return value === 'top-left' ||
    value === 'top-right' ||
    value === 'bottom-right'
    ? value
    : 'bottom-left';
}

function normalizeText(value: string | undefined, defaultValue: string) {
  if (typeof value !== 'string') {
    return defaultValue;
  }

  return value.trim();
}

function normalizeColor(value: string) {
  if (/^#[0-9a-f]{6}$/iu.test(value)) {
    return value.toLowerCase();
  }

  return '#808080';
}
