import type { ImageLayer, TextLayer } from '../../app/types';
import {
  applySceneImageStackTransform,
  createTransformedSceneImage,
} from './scene-image-stack-utils';

describe('applySceneImageStackTransform', () => {
  it('rotates only image layers clockwise and swaps the canvas size', () => {
    const imageLayer = createImageLayer();
    const textLayer = createTextLayer();

    expect(
      applySceneImageStackTransform({
        canvasSize: { width: 400, height: 200 },
        layers: [textLayer, imageLayer],
        transform: 'rotate-clockwise',
      }),
    ).toEqual({
      canvasSize: { width: 200, height: 400 },
      layers: [
        textLayer,
        {
          ...imageLayer,
          box: {
            x: 100,
            y: 10,
            width: 80,
            height: 40,
            rotation: Math.PI / 2,
          },
        },
      ],
    });
  });

  it('flips only image layers horizontally and preserves text layer geometry', () => {
    const imageLayer = createImageLayer();
    const textLayer = createTextLayer();

    expect(
      applySceneImageStackTransform({
        canvasSize: { width: 400, height: 200 },
        layers: [textLayer, imageLayer],
        transform: 'flip-horizontal',
      }),
    ).toEqual({
      canvasSize: { width: 400, height: 200 },
      layers: [
        textLayer,
        {
          ...imageLayer,
          box: {
            ...imageLayer.box,
            x: 350,
            y: 20,
          },
          skew: {
            x: -1,
            y: 1,
          },
        },
      ],
    });
  });
});

describe('createTransformedSceneImage', () => {
  it('creates a rotated canvas for clockwise scene transforms', () => {
    const sourceImage = {} as CanvasImageSource;
    const drawImage = vi.fn();
    const rotate = vi.fn();
    const scale = vi.fn();
    const translate = vi.fn();
    const clearRect = vi.fn();
    const save = vi.fn();
    const restore = vi.fn();
    const context = {
      clearRect,
      drawImage,
      restore,
      rotate,
      save,
      scale,
      translate,
    } as unknown as CanvasRenderingContext2D;
    const createdCanvas = document.createElement('canvas');
    vi.spyOn(createdCanvas, 'getContext').mockReturnValue(context);
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, 'createElement');
    createElementSpy.mockImplementation(((tagName: string) => {
      if (tagName === 'canvas') {
        return createdCanvas;
      }

      return originalCreateElement(tagName);
    }) as typeof document.createElement);

    const result = createTransformedSceneImage({
      canvasSize: { width: 320, height: 180 },
      image: sourceImage,
      transform: 'rotate-clockwise',
    });

    expect(result).toBe(createdCanvas);
    expect(createdCanvas.width).toBe(180);
    expect(createdCanvas.height).toBe(320);
    expect(translate).toHaveBeenCalledWith(90, 160);
    expect(rotate).toHaveBeenCalledWith(Math.PI / 2);
    expect(scale).toHaveBeenCalledWith(1, 1);
    expect(drawImage).toHaveBeenCalledWith(sourceImage, -160, -90, 320, 180);

    createElementSpy.mockRestore();
  });
});

function createImageLayer(): ImageLayer {
  return {
    kind: 'image',
    id: 'image-1',
    name: 'Image 1',
    box: {
      x: 10,
      y: 20,
      width: 40,
      height: 80,
      rotation: 0,
    },
    opacity: 1,
    image: {} as CanvasImageSource,
    sourceSize: {
      width: 40,
      height: 80,
    },
    skew: {
      x: 1,
      y: 1,
    },
  };
}

function createTextLayer(): TextLayer {
  return {
    kind: 'text',
    id: 'top',
    name: 'Top text',
    text: 'TOP',
    box: {
      x: 24,
      y: 32,
      width: 200,
      height: 64,
      rotation: 0,
    },
    fontFamily: 'Impact',
    fontSize: 48,
    fillStyle: '#ffffff',
    strokeStyle: '#000000',
    outlineWidth: 4,
    opacity: 1,
    textAlign: 'center',
    verticalAlign: 'middle',
    effect: 'outline',
    allCaps: true,
    bold: true,
    italic: false,
  };
}
