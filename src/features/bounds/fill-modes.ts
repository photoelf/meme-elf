import type { SceneBoundsFillMode } from '../../app/types';

export function resolveBoundsFill(input: {
  fillMode: SceneBoundsFillMode;
  solidColor: string;
  borderPixels: Uint8ClampedArray | number[];
  side: 'left' | 'right' | 'top' | 'bottom';
}) {
  if (input.fillMode === 'transparent') {
    return null;
  }

  if (input.fillMode === 'solid-color') {
    return input.solidColor;
  }

  if (input.borderPixels.length < 4) {
    return null;
  }

  if (input.fillMode === 'sampled-edge') {
    const middlePixelStart = Math.floor((Math.floor(input.borderPixels.length / 4) - 1) / 2) * 4;
    return rgbToHex(
      input.borderPixels[middlePixelStart] ?? 0,
      input.borderPixels[middlePixelStart + 1] ?? 0,
      input.borderPixels[middlePixelStart + 2] ?? 0,
    );
  }

  let red = 0;
  let green = 0;
  let blue = 0;
  let pixelCount = 0;

  for (let index = 0; index < input.borderPixels.length; index += 4) {
    red += input.borderPixels[index] ?? 0;
    green += input.borderPixels[index + 1] ?? 0;
    blue += input.borderPixels[index + 2] ?? 0;
    pixelCount += 1;
  }

  return rgbToHex(
    Math.round(red / pixelCount),
    Math.round(green / pixelCount),
    Math.round(blue / pixelCount),
  );
}

function rgbToHex(red: number, green: number, blue: number) {
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}

function toHex(value: number) {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
}
