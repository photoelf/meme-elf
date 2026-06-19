import {
  applySceneImageAdjustmentsToImageData,
  applySceneEffectStackToImageData,
  applySceneEffectToImageData,
  buildAdjustmentCanvasFilter,
  createDefaultSceneEffectStack,
  createDefaultSceneImageAdjustments,
  hasActiveSceneEffectStack,
  hasActiveSceneImageAdjustments,
  normalizeSceneEffectStack,
  normalizeSceneImageAdjustments,
  serializeSceneImageAdjustments,
} from './image-effects';

describe('scene image effect helpers', () => {
  it('returns the default neutral adjustment state', () => {
    expect(createDefaultSceneImageAdjustments()).toEqual({
      brightness: 100,
      contrast: 100,
      saturation: 100,
      hue: 0,
      grayscale: false,
      includeText: false,
      sepia: false,
      invert: false,
    });
  });

  it('returns the default ordered effect stack', () => {
    expect(createDefaultSceneEffectStack()).toEqual([
      { id: 'blur', kind: 'blur', value: 0 },
      { id: 'sharpen', kind: 'sharpen', value: 0 },
      { id: 'threshold', kind: 'threshold', value: 0 },
      { id: 'pixelate', kind: 'pixelate', value: 0 },
      { id: 'noise', kind: 'noise', value: 0 },
      { id: 'grain', kind: 'grain', value: 0 },
      { id: 'posterize', kind: 'posterize', value: 0 },
      { id: 'jpeg', kind: 'jpeg', value: 0 },
    ]);
  });

  it('normalizes adjustment values into the supported ranges', () => {
    expect(
      normalizeSceneImageAdjustments({
        brightness: -10,
        contrast: 340,
        saturation: 12.6,
        hue: 481,
        grayscale: true,
        includeText: true,
        sepia: false,
        invert: true,
      }),
    ).toEqual({
      brightness: 0,
      contrast: 200,
      saturation: 13,
      hue: 180,
      grayscale: true,
      includeText: true,
      sepia: false,
      invert: true,
    });
  });

  it('serializes only adjustment controls into a deterministic filter order', () => {
    expect(
      serializeSceneImageAdjustments({
        brightness: 120,
        contrast: 95,
        saturation: 140,
        hue: -30,
        grayscale: true,
        includeText: true,
        sepia: false,
        invert: true,
      }),
    ).toEqual([
      { kind: 'brightness', value: 120, css: 'brightness(120%)' },
      { kind: 'contrast', value: 95, css: 'contrast(95%)' },
      { kind: 'saturation', value: 140, css: 'saturate(140%)' },
      { kind: 'hue', value: -30, css: 'hue-rotate(-30deg)' },
      { kind: 'grayscale', value: 100, css: 'grayscale(100%)' },
      { kind: 'sepia', value: 0, css: 'sepia(0%)' },
      { kind: 'invert', value: 100, css: 'invert(100%)' },
    ]);
  });

  it('builds a single canvas adjustment filter string', () => {
    expect(
      buildAdjustmentCanvasFilter({
        brightness: 120,
        contrast: 95,
        saturation: 140,
        hue: -30,
        grayscale: true,
        includeText: true,
        sepia: false,
        invert: true,
      }),
    ).toBe(
      'brightness(120%) contrast(95%) saturate(140%) hue-rotate(-30deg) grayscale(100%) sepia(0%) invert(100%)',
    );
  });

  it('treats adjustments and stack effects as separate active groups', () => {
    expect(hasActiveSceneImageAdjustments({ brightness: 130 })).toBe(true);
    expect(hasActiveSceneImageAdjustments({ includeText: true })).toBe(false);
    expect(
      hasActiveSceneEffectStack([{ id: 'noise', kind: 'noise', value: 15 }]),
    ).toBe(true);
  });

  it('preserves the provided effect order and appends any missing defaults', () => {
    expect(
      normalizeSceneEffectStack([
        { id: 'noise', kind: 'noise', value: 20.7 },
        { id: 'pixelate', kind: 'pixelate', value: -8 },
      ]),
    ).toEqual([
      { id: 'noise', kind: 'noise', value: 21 },
      { id: 'pixelate', kind: 'pixelate', value: 0 },
      { id: 'blur', kind: 'blur', value: 0 },
      { id: 'sharpen', kind: 'sharpen', value: 0 },
      { id: 'threshold', kind: 'threshold', value: 0 },
      { id: 'grain', kind: 'grain', value: 0 },
      { id: 'posterize', kind: 'posterize', value: 0 },
      { id: 'jpeg', kind: 'jpeg', value: 0 },
    ]);
  });

  it('applies ordered raster effects in the provided stack order', () => {
    const withNoiseThenPixelate = {
      width: 2,
      height: 2,
      data: new Uint8ClampedArray([
        100, 100, 100, 255,
        120, 120, 120, 255,
        140, 140, 140, 255,
        160, 160, 160, 255,
      ]),
    };
    const withPixelateThenNoise = {
      width: 2,
      height: 2,
      data: new Uint8ClampedArray(withNoiseThenPixelate.data),
    };

    applySceneEffectStackToImageData(
      withNoiseThenPixelate,
      [
        { id: 'noise', kind: 'noise', value: 20 },
        { id: 'pixelate', kind: 'pixelate', value: 2 },
      ],
      () => 0,
    );
    applySceneEffectStackToImageData(
      withPixelateThenNoise,
      [
        { id: 'pixelate', kind: 'pixelate', value: 2 },
        { id: 'noise', kind: 'noise', value: 20 },
      ],
      () => 0,
    );

    expect(Array.from(withNoiseThenPixelate.data)).toEqual([
      98, 98, 98, 255,
      98, 98, 98, 255,
      98, 98, 98, 255,
      98, 98, 98, 255,
    ]);
    expect(Array.from(withPixelateThenNoise.data)).toEqual([
      98, 98, 98, 255,
      98, 98, 98, 255,
      98, 98, 98, 255,
      98, 98, 98, 255,
    ]);
  });

  it('applies grain, posterize, and jpeg degradation as distinct effects', () => {
    const grainImage = {
      width: 1,
      height: 1,
      data: new Uint8ClampedArray([120, 120, 120, 255]),
    };
    const posterizeImage = {
      width: 1,
      height: 1,
      data: new Uint8ClampedArray([132, 78, 201, 255]),
    };
    const jpegImage = {
      width: 2,
      height: 2,
      data: new Uint8ClampedArray([
        10, 40, 90, 255,
        30, 80, 130, 255,
        60, 120, 180, 255,
        90, 160, 220, 255,
      ]),
    };

    applySceneEffectToImageData(grainImage, { id: 'grain', kind: 'grain', value: 50 }, () => 0);
    applySceneEffectToImageData(posterizeImage, {
      id: 'posterize',
      kind: 'posterize',
      value: 80,
    });
    applySceneEffectToImageData(jpegImage, { id: 'jpeg', kind: 'jpeg', value: 70 });

    expect(Array.from(grainImage.data)).toEqual([84, 84, 84, 255]);
    expect(Array.from(posterizeImage.data)).toEqual([146, 73, 219, 255]);
    expect(Array.from(jpegImage.data)).toEqual([
      57, 113, 142, 255,
      57, 113, 142, 255,
      57, 113, 142, 255,
      57, 113, 142, 255,
    ]);
  });

  it('applies blur through raster pixel changes without relying on canvas filters', () => {
    const image = {
      width: 3,
      height: 1,
      data: new Uint8ClampedArray([
        0, 0, 0, 255,
        90, 90, 90, 255,
        180, 180, 180, 255,
      ]),
    };

    applySceneEffectToImageData(image, { id: 'blur', kind: 'blur', value: 4 });

    expect(Array.from(image.data)).toEqual([
      45, 45, 45, 255,
      90, 90, 90, 255,
      135, 135, 135, 255,
    ]);
  });

  it('applies scene adjustments through raster pixel changes without relying on canvas filters', () => {
    const image = {
      width: 1,
      height: 1,
      data: new Uint8ClampedArray([100, 150, 200, 255]),
    };

    applySceneImageAdjustmentsToImageData(image, {
      brightness: 120,
      contrast: 90,
      saturation: 0,
      hue: 0,
      grayscale: false,
      includeText: false,
      sepia: false,
      invert: true,
    });

    expect(Array.from(image.data)).toEqual([80, 80, 80, 255]);
  });
});
