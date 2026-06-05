import { createElement } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';

import type { TextLayer } from '../../app/types';
import { getContainedCanvasSize, renderPreview } from './canvas-renderer';
import { PreviewCanvas } from '../preview/preview-canvas';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getContainedCanvasSize', () => {
  it('scales an image down to the max width while preserving aspect ratio', () => {
    expect(getContainedCanvasSize(1600, 800, 1000)).toEqual({
      width: 1000,
      height: 500,
    });
  });
});

describe('renderPreview', () => {
  it('clears the canvas and draws the contained image to the full preview size', () => {
    const image = {} as CanvasImageSource;
    const context = createContextStub();

    renderPreview(context, image, { width: 800, height: 450 }, []);

    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 800, 450);
    expect(context.drawImage).toHaveBeenCalledWith(image, 0, 0, 800, 450);
  });

  it('renders text layers even when no image is loaded yet', () => {
    const context = createContextStub();
    const layers: TextLayer[] = [
      {
        id: 'top',
        name: 'Top text',
        text: 'DRAFT',
        box: { x: 24, y: 0, width: 752, height: 110, rotation: 0 },
        fontFamily: 'Impact',
        fontSize: 90,
        fillStyle: '#ffffff',
        strokeStyle: '#000000',
        outlineWidth: 5,
        opacity: 1,
        textAlign: 'center',
        verticalAlign: 'top',
        effect: 'outline',
        allCaps: true,
        bold: false,
        italic: false,
      },
    ];

    renderPreview(context, null, { width: 800, height: 450 }, layers);

    expect(context.drawImage).not.toHaveBeenCalled();
    expect(context.fillText).toHaveBeenCalled();
  });

  it('renders each text layer inside its box with fill and stroke styling', () => {
    const image = {} as CanvasImageSource;
    const context = createContextStub();
    const layers: TextLayer[] = [
      {
        id: 'top',
        name: 'Top text',
        text: 'TOP TEXT',
        box: { x: 24, y: 0, width: 752, height: 110, rotation: 0 },
        fontFamily: 'Impact',
        fontSize: 90,
        fillStyle: '#ffffff',
        strokeStyle: '#000000',
        outlineWidth: 5,
        opacity: 1,
        textAlign: 'center',
        verticalAlign: 'top',
        effect: 'outline',
        allCaps: true,
        bold: false,
        italic: false,
      },
    ];

    renderPreview(context, image, { width: 800, height: 450 }, layers);

    expect(context.font).toBe('400 83px Impact');
    expect(context.textAlign).toBe('center');
    expect(context.textBaseline).toBe('top');
    expect(context.fillStyle).toBe('#ffffff');
    expect(context.strokeStyle).toBe('#000000');
    expect(context.lineWidth).toBe(5);
    expect(context.translate).toHaveBeenCalledWith(400, 55);
    expect(context.strokeText).toHaveBeenCalledWith('TOP TEXT', 0, -43);
    expect(context.fillText).toHaveBeenCalledWith('TOP TEXT', 0, -43);
  });

  it('preserves explicit new lines and wraps long text inside the box width', () => {
    const image = {} as CanvasImageSource;
    const context = createContextStub((value) => {
      if (value.includes('SECOND LINE')) {
        return 220;
      }

      return value.length * 12;
    });
    const layers: TextLayer[] = [
      {
        id: 'top',
        name: 'Top text',
        text: 'FIRST LINE\nSECOND LINE LONG',
        box: { x: 24, y: 0, width: 240, height: 320, rotation: 0 },
        fontFamily: 'Impact',
        fontSize: 90,
        fillStyle: '#ffffff',
        strokeStyle: '#000000',
        outlineWidth: 5,
        opacity: 1,
        textAlign: 'center',
        verticalAlign: 'top',
        effect: 'outline',
        allCaps: true,
        bold: false,
        italic: false,
      },
    ];

    renderPreview(context, image, { width: 280, height: 320 }, layers);

    expect(context.fillText).toHaveBeenCalledWith('FIRST LINE', 0, -148);
    expect(context.fillText).toHaveBeenCalledWith('SECOND', 0, -54);
    expect(context.fillText).toHaveBeenCalledWith('LINE LONG', 0, 40);
  });

  it('shrinks rendered text to fit smaller text boxes without changing layer max font size', () => {
    const image = {} as CanvasImageSource;
    const context = createContextStub((value) => value.length * 13);
    const layers: TextLayer[] = [
      {
        id: 'top',
        name: 'Top text',
        text: 'VERY LONG MEME TEXT',
        box: { x: 24, y: 0, width: 220, height: 56, rotation: 0 },
        fontFamily: 'Impact',
        fontSize: 90,
        fillStyle: '#ffffff',
        strokeStyle: '#000000',
        outlineWidth: 5,
        opacity: 1,
        textAlign: 'center',
        verticalAlign: 'middle',
        effect: 'outline',
        allCaps: true,
        bold: false,
        italic: false,
      },
    ];

    renderPreview(context, image, { width: 280, height: 180 }, layers);

    expect(context.font).not.toBe('400 90px Impact');
    expect(context.fillText).toHaveBeenCalled();
  });

  it('clears the preview canvas when the image becomes null', () => {
    const context = createContextStub();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);

    const image = {} as HTMLImageElement;
    const layers: TextLayer[] = [];
    const { rerender } = render(
      createElement(PreviewCanvas, { image, width: 800, height: 450, layers }),
    );

    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 800, 450);
    vi.mocked(context.clearRect).mockClear();

    rerender(createElement(PreviewCanvas, { image: null, width: 800, height: 450, layers }));

    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 800, 450);
  });
});

function createContextStub(measureWidth?: (value: string) => number) {
  return {
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    strokeText: vi.fn(),
    fillText: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    transform: vi.fn(),
    measureText: vi.fn((value: string) => ({
      width: measureWidth ? measureWidth(value) : value.length * 10,
    })),
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineJoin: 'miter',
    globalAlpha: 1,
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
  } as unknown as CanvasRenderingContext2D;
}
