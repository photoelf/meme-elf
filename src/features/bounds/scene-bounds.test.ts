import { describe, expect, it } from 'vitest';

import type { EditorLayer, ImageLayer, TextLayer } from '../../app/types';
import { applySceneCrop, applySceneExpand } from './scene-bounds';

describe('applySceneCrop', () => {
  it('remaps scene layers into the cropped coordinate space', () => {
    const result = applySceneCrop({
      canvasSize: { width: 1200, height: 800 },
      cropRect: { x: 100, y: 80, width: 900, height: 500 },
      layers: [
        createTextLayerFixture({
          id: 'text-1',
          box: { x: 140, y: 120, width: 640, height: 120, rotation: 0 },
        }),
      ],
    });

    expect(result.canvasSize).toEqual({ width: 900, height: 500 });
    expect(result.layers).toHaveLength(1);
    expect(result.layers[0]?.box.x).toBe(40);
    expect(result.layers[0]?.box.y).toBe(40);
  });

  it('remaps image layers by subtracting the crop origin', () => {
    const result = applySceneCrop({
      canvasSize: { width: 1200, height: 800 },
      cropRect: { x: 180, y: 110, width: 700, height: 420 },
      layers: [
        createImageLayerFixture({
          id: 'image-1',
          box: { x: 260, y: 190, width: 320, height: 180, rotation: 0 },
        }),
      ],
    });

    expect(result.canvasSize).toEqual({ width: 700, height: 420 });
    expect(result.layers).toHaveLength(1);
    expect(result.layers[0]?.box.x).toBe(80);
    expect(result.layers[0]?.box.y).toBe(80);
  });

  it('removes layers that end up fully outside the cropped scene', () => {
    const result = applySceneCrop({
      canvasSize: { width: 1200, height: 800 },
      cropRect: { x: 100, y: 80, width: 260, height: 180 },
      layers: [
        createTextLayerFixture({
          id: 'inside',
          box: { x: 120, y: 100, width: 160, height: 80, rotation: 0 },
        }),
        createImageLayerFixture({
          id: 'outside',
          box: { x: 600, y: 500, width: 240, height: 160, rotation: 0 },
        }),
      ],
    });

    expect(result.layers.map((layer) => layer.id)).toEqual(['inside']);
  });
});

describe('applySceneExpand', () => {
  it('shifts scene content when expanding from the left', () => {
    const result = applySceneExpand({
      canvasSize: { width: 800, height: 450 },
      expand: { left: 120, right: 0, top: 0, bottom: 0 },
      layers: [
        createTextLayerFixture({
          id: 'text-1',
          box: { x: 40, y: 20, width: 640, height: 120, rotation: 0 },
        }),
      ],
    });

    expect(result.canvasSize).toEqual({ width: 920, height: 450 });
    expect(result.contentOffset).toEqual({ x: 120, y: 0 });
    expect(result.layers[0]?.box.x).toBe(160);
    expect(result.layers[0]?.box.y).toBe(20);
  });

  it('shifts scene content when expanding from the top', () => {
    const result = applySceneExpand({
      canvasSize: { width: 800, height: 450 },
      expand: { left: 0, right: 0, top: 90, bottom: 0 },
      layers: [
        createImageLayerFixture({
          id: 'image-1',
          box: { x: 120, y: 40, width: 320, height: 180, rotation: 0 },
        }),
      ],
    });

    expect(result.canvasSize).toEqual({ width: 800, height: 540 });
    expect(result.contentOffset).toEqual({ x: 0, y: 90 });
    expect(result.layers[0]?.box.x).toBe(120);
    expect(result.layers[0]?.box.y).toBe(130);
  });

  it('preserves layer coordinates when expanding only to the right and bottom', () => {
    const result = applySceneExpand({
      canvasSize: { width: 800, height: 450 },
      expand: { left: 0, right: 200, top: 0, bottom: 75 },
      layers: [
        createTextLayerFixture({
          id: 'text-1',
          box: { x: 24, y: 0, width: 752, height: 110, rotation: 0 },
        }),
      ],
    });

    expect(result.canvasSize).toEqual({ width: 1000, height: 525 });
    expect(result.contentOffset).toEqual({ x: 0, y: 0 });
    expect(result.layers[0]?.box.x).toBe(24);
    expect(result.layers[0]?.box.y).toBe(0);
  });

  it('clamps negative expand values to zero', () => {
    const result = applySceneExpand({
      canvasSize: { width: 800, height: 450 },
      expand: { left: -120, right: 40, top: -30, bottom: 50 },
      layers: [
        createTextLayerFixture({
          id: 'text-1',
          box: { x: 24, y: 0, width: 752, height: 110, rotation: 0 },
        }),
      ],
    });

    expect(result.canvasSize).toEqual({ width: 840, height: 500 });
    expect(result.contentOffset).toEqual({ x: 0, y: 0 });
    expect(result.layers[0]?.box.x).toBe(24);
    expect(result.layers[0]?.box.y).toBe(0);
  });
});

function createTextLayerFixture(
  overrides: Partial<TextLayer> & Pick<TextLayer, 'id' | 'box'>,
): TextLayer {
  return {
    kind: 'text',
    id: overrides.id,
    name: overrides.name ?? overrides.id,
    text: overrides.text ?? 'TOP',
    fontFamily: overrides.fontFamily ?? 'Impact',
    fontSize: overrides.fontSize ?? 90,
    fillStyle: overrides.fillStyle ?? '#ffffff',
    strokeStyle: overrides.strokeStyle ?? '#000000',
    outlineWidth: overrides.outlineWidth ?? 5,
    textAlign: overrides.textAlign ?? 'center',
    verticalAlign: overrides.verticalAlign ?? 'top',
    effect: overrides.effect ?? 'outline',
    allCaps: overrides.allCaps ?? true,
    bold: overrides.bold ?? false,
    italic: overrides.italic ?? false,
    opacity: overrides.opacity ?? 1,
    box: overrides.box,
  };
}

function createImageLayerFixture(
  overrides: Partial<ImageLayer> & Pick<ImageLayer, 'id' | 'box'>,
): ImageLayer {
  return {
    kind: 'image',
    id: overrides.id,
    name: overrides.name ?? overrides.id,
    image: overrides.image ?? ({} as CanvasImageSource),
    sourceSize: overrides.sourceSize ?? { width: 320, height: 180 },
    skew: overrides.skew ?? { x: 1, y: 1 },
    opacity: overrides.opacity ?? 1,
    box: overrides.box,
  };
}
