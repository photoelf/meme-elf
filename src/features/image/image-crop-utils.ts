import type { CropDraftBox, PreviewRotationQuarterTurns } from '../../app/types';

export type NormalizedCropBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function normalizeCropDraftBox(
  cropBox: CropDraftBox,
  sourceSize?: { width: number; height: number },
): NormalizedCropBox {
  const rawLeft = Math.min(cropBox.startX, cropBox.endX);
  const rawTop = Math.min(cropBox.startY, cropBox.endY);
  const rawRight = Math.max(cropBox.startX, cropBox.endX);
  const rawBottom = Math.max(cropBox.startY, cropBox.endY);
  const left = sourceSize ? clamp(rawLeft, 0, sourceSize.width) : rawLeft;
  const top = sourceSize ? clamp(rawTop, 0, sourceSize.height) : rawTop;
  const right = sourceSize ? clamp(rawRight, 0, sourceSize.width) : rawRight;
  const bottom = sourceSize ? clamp(rawBottom, 0, sourceSize.height) : rawBottom;

  return {
    x: left,
    y: top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

export function resolvePreparedOutputDimensions({
  sourceSize,
  cropBox,
  rotationQuarterTurns,
}: {
  sourceSize: { width: number; height: number };
  cropBox: CropDraftBox | null;
  rotationQuarterTurns: PreviewRotationQuarterTurns;
}) {
  const croppedSize = cropBox
    ? normalizeCropDraftBox(cropBox, sourceSize)
    : { width: sourceSize.width, height: sourceSize.height };
  const isSideways = rotationQuarterTurns % 2 === 1;

  return {
    width: isSideways ? croppedSize.height : croppedSize.width,
    height: isSideways ? croppedSize.width : croppedSize.height,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
