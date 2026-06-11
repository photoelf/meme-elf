import { describe, expect, it } from 'vitest';

import type { ImageLayer, TextLayer } from '../../app/types';
import {
  clampLayerBoxSize,
  createDefaultImageLayer,
  getAxisLockedMoveDelta,
  getDirectionalInsertionLayout,
  flipImageLayerHorizontal,
  flipImageLayerVertical,
  getDefaultImageLayerBox,
  resizeImageLayerBox,
  getTextLayers,
  reorderTextLayersWithinStack,
  reorderLayerStack,
  rotateImageLayer90,
} from './image-layer-utils';

describe('getDefaultImageLayerBox', () => {
  it('fits a wide image inside the canvas without changing its aspect ratio', () => {
    expect(
      getDefaultImageLayerBox(
        { width: 800, height: 450 },
        { width: 1600, height: 800 },
      ),
    ).toEqual({
      x: 0,
      y: 25,
      width: 800,
      height: 400,
      rotation: 0,
    });
  });

  it('does not upscale a smaller source image by default', () => {
    expect(
      getDefaultImageLayerBox(
        { width: 800, height: 450 },
        { width: 320, height: 200 },
      ),
    ).toEqual({
      x: 240,
      y: 125,
      width: 320,
      height: 200,
      rotation: 0,
    });
  });
});

describe('createDefaultImageLayer', () => {
  it('creates a centered transparent image layer with a sequential label', () => {
    const image = {} as CanvasImageSource;

    expect(
      createDefaultImageLayer(
        'image-1',
        1,
        image,
        { width: 800, height: 450 },
        { width: 1600, height: 800 },
      ),
    ).toEqual({
      id: 'image-1',
      kind: 'image',
      name: 'Image 1',
      box: {
        x: 0,
        y: 25,
        width: 800,
        height: 400,
        rotation: 0,
      },
      opacity: 1,
      image,
      sourceSize: { width: 1600, height: 800 },
      skew: { x: 1, y: 1 },
    });
  });
});

describe('getDirectionalInsertionLayout', () => {
  it('grows the canvas to the left and shifts existing content into the new coordinate space', () => {
    const textLayer = createTextLayer('top');
    const imageLayer = createImageLayer('image-1');

    expect(
      getDirectionalInsertionLayout({
        canvasSize: { width: 800, height: 450 },
        imageSize: { width: 200, height: 120 },
        direction: 'outside-left',
        layers: [textLayer, imageLayer],
      }),
    ).toEqual({
      canvasSize: { width: 1000, height: 450 },
      existingContentOffset: { x: 200, y: 0 },
      insertedBox: { x: 0, y: 165, width: 200, height: 120, rotation: 0 },
      shiftedLayers: [
        {
          ...textLayer,
          box: { ...textLayer.box, x: textLayer.box.x + 200, y: textLayer.box.y },
        },
        {
          ...imageLayer,
          box: { ...imageLayer.box, x: imageLayer.box.x + 200, y: imageLayer.box.y },
        },
      ],
    });
  });

  it('grows the canvas to the right without shifting existing content', () => {
    expect(
      getDirectionalInsertionLayout({
        canvasSize: { width: 800, height: 450 },
        imageSize: { width: 180, height: 240 },
        direction: 'outside-right',
        layers: [createTextLayer('top')],
      }),
    ).toMatchObject({
      canvasSize: { width: 980, height: 450 },
      existingContentOffset: { x: 0, y: 0 },
      insertedBox: { x: 800, y: 105, width: 180, height: 240, rotation: 0 },
      shiftedLayers: [{ box: { x: 24, y: 24 } }],
    });
  });

  it('grows the canvas upward and shifts every existing layer down by the inserted height', () => {
    const imageLayer = createImageLayer('image-1');

    expect(
      getDirectionalInsertionLayout({
        canvasSize: { width: 800, height: 450 },
        imageSize: { width: 320, height: 150 },
        direction: 'outside-top',
        layers: [imageLayer],
      }),
    ).toEqual({
      canvasSize: { width: 800, height: 600 },
      existingContentOffset: { x: 0, y: 150 },
      insertedBox: { x: 240, y: 0, width: 320, height: 150, rotation: 0 },
      shiftedLayers: [
        {
          ...imageLayer,
          box: { ...imageLayer.box, x: imageLayer.box.x, y: imageLayer.box.y + 150 },
        },
      ],
    });
  });

  it('grows the canvas downward and places the new image in the appended region', () => {
    expect(
      getDirectionalInsertionLayout({
        canvasSize: { width: 800, height: 450 },
        imageSize: { width: 300, height: 210 },
        direction: 'outside-bottom',
        layers: [createTextLayer('bottom')],
      }),
    ).toMatchObject({
      canvasSize: { width: 800, height: 660 },
      existingContentOffset: { x: 0, y: 0 },
      insertedBox: { x: 250, y: 450, width: 300, height: 210, rotation: 0 },
      shiftedLayers: [{ box: { x: 24, y: 24 } }],
    });
  });
});

describe('reorderLayerStack', () => {
  it('moves a layer while preserving the existing top-to-bottom stacking rule', () => {
    const textTop = createTextLayer('top');
    const imageLayer = createImageLayer('image-1');
    const textBottom = createTextLayer('bottom');

    const reordered = reorderLayerStack(
      [textTop, imageLayer, textBottom],
      'bottom',
      'top',
      'before',
    );

    expect(reordered.map((layer) => layer.id)).toEqual(['bottom', 'top', 'image-1']);
  });
});

describe('reorderTextLayersWithinStack', () => {
  it('reorders only visible text layers while preserving hidden image-layer positions', () => {
    const textTop = createTextLayer('top');
    const imageLayer = createImageLayer('image-1');
    const textMiddle = createTextLayer('middle');
    const imageLayerTwo = createImageLayer('image-2');
    const textBottom = createTextLayer('bottom');

    const reordered = reorderTextLayersWithinStack(
      [textTop, imageLayer, textMiddle, imageLayerTwo, textBottom],
      'bottom',
      'top',
      'before',
    );

    expect(reordered.map((layer) => layer.id)).toEqual([
      'bottom',
      'image-1',
      'top',
      'image-2',
      'middle',
    ]);
  });
});

describe('getTextLayers', () => {
  it('filters mixed layer arrays down to text layers without requiring image text fields', () => {
    const textTop = createTextLayer('top');
    const imageLayer = createImageLayer('image-1');

    expect(getTextLayers([textTop, imageLayer])).toEqual([textTop]);
  });
});

describe('clampLayerBoxSize', () => {
  it('keeps transformed bounds at or above the minimum editable size', () => {
    expect(
      clampLayerBoxSize(
        {
          x: 100,
          y: 60,
          width: 18,
          height: 24,
          rotation: 0,
        },
        48,
      ),
    ).toEqual({
      x: 100,
      y: 60,
      width: 48,
      height: 48,
      rotation: 0,
    });
  });
});

describe('getAxisLockedMoveDelta', () => {
  it('locks movement horizontally when horizontal delta is dominant', () => {
    expect(getAxisLockedMoveDelta({ x: 80, y: 24 })).toEqual({ x: 80, y: 0 });
  });

  it('locks movement vertically when vertical delta is dominant', () => {
    expect(getAxisLockedMoveDelta({ x: 18, y: -60 })).toEqual({ x: 0, y: -60 });
  });
});

describe('resizeImageLayerBox', () => {
  it('preserves aspect ratio during shift-resize from the bottom-right handle', () => {
    expect(
      resizeImageLayerBox({
        startBox: {
          x: 200,
          y: 120,
          width: 300,
          height: 150,
          rotation: 0,
        },
        axisX: 'right',
        axisY: 'bottom',
        deltaX: 90,
        deltaY: 20,
        preserveAspectRatio: true,
      }),
    ).toEqual({
      x: 200,
      y: 120,
      width: 390,
      height: 195,
      rotation: 0,
    });
  });

  it('allows image resize handles to shrink dimensions close to zero without a minimum clamp', () => {
    expect(
      resizeImageLayerBox({
        startBox: {
          x: 100,
          y: 80,
          width: 160,
          height: 100,
          rotation: 0,
        },
        axisX: 'right',
        axisY: 'bottom',
        deltaX: -159,
        deltaY: -99,
        preserveAspectRatio: false,
      }),
    ).toEqual({
      x: 100,
      y: 80,
      width: 1,
      height: 1,
      rotation: 0,
    });
  });

  it('keeps shift-resize aspect ratio near the minimum size floor for wide images', () => {
    expect(
      resizeImageLayerBox({
        startBox: {
          x: 100,
          y: 80,
          width: 160,
          height: 80,
          rotation: 0,
        },
        axisX: 'right',
        axisY: 'bottom',
        deltaX: -159,
        deltaY: -79,
        preserveAspectRatio: true,
      }),
    ).toEqual({
      x: 100,
      y: 80,
      width: 2,
      height: 1,
      rotation: 0,
    });
  });
});

describe('rotateImageLayer90', () => {
  it('rotates clockwise around the layer center and swaps width and height', () => {
    const layer = createImageLayer('image-1');

    expect(rotateImageLayer90(layer, 'clockwise')).toMatchObject({
      id: 'image-1',
      box: {
        x: 80,
        y: 0,
        width: 120,
        height: 200,
        rotation: Math.PI / 2,
      },
      skew: { x: 1, y: 1 },
    });
  });

  it('rotates counter-clockwise around the layer center and preserves predictable bounds', () => {
    const layer = createImageLayer('image-1');

    expect(rotateImageLayer90(layer, 'counter-clockwise')).toMatchObject({
      id: 'image-1',
      box: {
        x: 80,
        y: 0,
        width: 120,
        height: 200,
        rotation: -Math.PI / 2,
      },
      skew: { x: 1, y: 1 },
    });
  });
});

describe('flipImageLayerHorizontal', () => {
  it('toggles horizontal flip state without changing the layer bounds', () => {
    const layer = createImageLayer('image-1');

    expect(flipImageLayerHorizontal(layer)).toMatchObject({
      id: 'image-1',
      box: layer.box,
      skew: { x: -1, y: 1 },
    });
  });
});

describe('flipImageLayerVertical', () => {
  it('toggles vertical flip state without changing the layer bounds', () => {
    const layer = createImageLayer('image-1');

    expect(flipImageLayerVertical(layer)).toMatchObject({
      id: 'image-1',
      box: layer.box,
      skew: { x: 1, y: -1 },
    });
  });
});

function createTextLayer(id: string): TextLayer {
  return {
    kind: 'text',
    id,
    name: id,
    text: id.toUpperCase(),
    box: { x: 24, y: 24, width: 320, height: 80, rotation: 0 },
    fontFamily: 'Impact',
    fontSize: 64,
    fillStyle: '#ffffff',
    strokeStyle: '#000000',
    outlineWidth: 4,
    opacity: 1,
    textAlign: 'center',
    verticalAlign: 'middle',
    effect: 'outline',
    allCaps: true,
    bold: false,
    italic: false,
  };
}

function createImageLayer(id: string): ImageLayer {
  return {
    id,
    kind: 'image',
    name: id,
    box: { x: 40, y: 40, width: 200, height: 120, rotation: 0 },
    opacity: 1,
    image: {} as CanvasImageSource,
    sourceSize: { width: 1000, height: 600 },
    skew: { x: 1, y: 1 },
  };
}
