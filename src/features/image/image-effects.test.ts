import {
  buildCanvasFilter,
  createDefaultSceneImageEffects,
  normalizeSceneImageEffects,
  serializeSceneImageEffects,
} from './image-effects';

describe('scene image effects helpers', () => {
  it('returns the default neutral effect state', () => {
    expect(createDefaultSceneImageEffects()).toEqual({
      brightness: 100,
      contrast: 100,
      saturation: 100,
      hue: 0,
      grayscale: false,
      sepia: false,
      invert: false,
    });
  });

  it('normalizes numeric values into the supported ranges', () => {
    expect(
      normalizeSceneImageEffects({
        brightness: -10,
        contrast: 340,
        saturation: 12.6,
        hue: 481,
        grayscale: true,
        sepia: false,
        invert: true,
      }),
    ).toEqual({
      brightness: 0,
      contrast: 200,
      saturation: 13,
      hue: 180,
      grayscale: true,
      sepia: false,
      invert: true,
    });
  });

  it('serializes the scene effect state in a deterministic preview order', () => {
    expect(
      serializeSceneImageEffects({
        brightness: 120,
        contrast: 95,
        saturation: 140,
        hue: -30,
        grayscale: true,
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

  it('builds a single canvas filter string from the serialized order', () => {
    expect(
      buildCanvasFilter({
        brightness: 120,
        contrast: 95,
        saturation: 140,
        hue: -30,
        grayscale: true,
        sepia: false,
        invert: true,
      }),
    ).toBe(
      'brightness(120%) contrast(95%) saturate(140%) hue-rotate(-30deg) grayscale(100%) sepia(0%) invert(100%)',
    );
  });
});
