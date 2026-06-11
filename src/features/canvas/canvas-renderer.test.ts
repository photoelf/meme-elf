import { act, createElement, useState } from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';

import type { AppState, TextLayer } from '../../app/types';
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
        kind: 'text',
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
        kind: 'text',
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

  it('renders image layers from the same stack without breaking text-layer drawing', () => {
    const context = createContextStub();
    const imageLayerImage = {} as CanvasImageSource;
    const layers = [
      {
        kind: 'text',
        id: 'top',
        name: 'Top text',
        text: 'CAPTION',
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
      {
        id: 'image-1',
        kind: 'image',
        name: 'Sticker',
        box: { x: 120, y: 80, width: 240, height: 180, rotation: 0 },
        opacity: 0.8,
        image: imageLayerImage,
        sourceSize: { width: 1200, height: 900 },
        skew: { x: 1, y: 1 },
      },
    ] satisfies AppState['layers'];

    renderPreview(context, null, { width: 800, height: 450 }, layers);

    expect(context.translate).toHaveBeenCalledWith(240, 170);
    expect(context.drawImage).toHaveBeenCalledWith(imageLayerImage, -120, -90, 240, 180);
    expect(context.fillText).toHaveBeenCalledWith('CAPTION', 0, -43);
  });

  it('draws higher layer-list entries above lower ones by rendering them later', () => {
    const events: string[] = [];
    const topImage = {} as CanvasImageSource;
    const context = createContextStub();
    vi.mocked(context.drawImage).mockImplementation((image: CanvasImageSource) => {
      events.push(image === topImage ? 'image-layer' : 'base-image');
    });
    vi.mocked(context.fillText).mockImplementation((text: string) => {
      events.push(`text:${text}`);
    });

    const layers = [
      {
        id: 'image-1',
        kind: 'image',
        name: 'Sticker',
        box: { x: 120, y: 80, width: 240, height: 180, rotation: 0 },
        opacity: 1,
        image: topImage,
        sourceSize: { width: 1200, height: 900 },
        skew: { x: 1, y: 1 },
      },
      {
        kind: 'text',
        id: 'top',
        name: 'Top text',
        text: 'CAPTION',
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
    ] satisfies AppState['layers'];

    renderPreview(context, {} as CanvasImageSource, { width: 800, height: 450 }, layers);

    expect(events.indexOf('image-layer')).toBeGreaterThan(events.indexOf('text:CAPTION'));
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
        kind: 'text',
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
        kind: 'text',
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
      createElement(PreviewCanvas, {
        image,
        width: 800,
        height: 450,
        layers,
        activeLayerId: null,
        onActiveLayerChange: vi.fn(),
        onLayerChange: vi.fn(),
      }),
    );

    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 800, 450);
    vi.mocked(context.clearRect).mockClear();

    rerender(
      createElement(PreviewCanvas, {
        image: null,
        width: 800,
        height: 450,
        layers,
        activeLayerId: null,
        onActiveLayerChange: vi.fn(),
        onLayerChange: vi.fn(),
      }),
    );

    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 800, 450);
  });

  it('moves an active image layer with the shared transform box', async () => {
    const context = createContextStub();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
    const { container } = render(createElement(PreviewCanvasHarness));

    const surface = container.querySelector('.preview-surface') as HTMLDivElement;
    vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({
      bottom: 900,
      height: 900,
      left: 0,
      right: 900,
      top: 0,
      width: 900,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    await act(async () => {
      firePointerEnter(surface);
    });
    const imageBox = container.querySelector('.transform-box-image.transform-box-active') as HTMLDivElement;
    const initialLeft = parseFloat(imageBox.style.left);
    const initialTop = parseFloat(imageBox.style.top);

    await act(async () => {
      firePointerDown(imageBox, 450, 450);
      firePointerMove(540, 510);
      firePointerUp();
    });

    await waitFor(() => {
      const movedBox = container.querySelector('.transform-box-image.transform-box-active') as HTMLDivElement;
      expect(parseFloat(movedBox.style.left)).toBeGreaterThan(initialLeft);
      expect(parseFloat(movedBox.style.top)).toBeGreaterThan(initialTop);
    });
  });

  it('locks image-layer move to the dominant axis while Shift is held', async () => {
    const context = createContextStub();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
    const { container } = render(createElement(PreviewCanvasHarness));

    const surface = container.querySelector('.preview-surface') as HTMLDivElement;
    vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({
      bottom: 900,
      height: 900,
      left: 0,
      right: 900,
      top: 0,
      width: 900,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    await act(async () => {
      firePointerEnter(surface);
    });
    const imageBox = container.querySelector('.transform-box-image.transform-box-active') as HTMLDivElement;
    const initialLeft = parseFloat(imageBox.style.left);
    const initialTop = parseFloat(imageBox.style.top);

    await act(async () => {
      firePointerDown(imageBox, 450, 450, { shiftKey: true });
      firePointerMove(560, 490, { shiftKey: true });
      firePointerUp();
    });

    await waitFor(() => {
      const movedBox = container.querySelector('.transform-box-image.transform-box-active') as HTMLDivElement;
      expect(parseFloat(movedBox.style.left)).toBeGreaterThan(initialLeft);
      expect(parseFloat(movedBox.style.top)).toBe(initialTop);
    });
  });

  it('scales an active image layer with the shared resize handles', async () => {
    const context = createContextStub();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
    const { container } = render(createElement(PreviewCanvasHarness));

    const surface = container.querySelector('.preview-surface') as HTMLDivElement;
    vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({
      bottom: 900,
      height: 900,
      left: 0,
      right: 900,
      top: 0,
      width: 900,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    await act(async () => {
      firePointerEnter(surface);
    });
    const imageBox = container.querySelector('.transform-box-image.transform-box-active') as HTMLDivElement;
    const initialWidth = parseFloat(imageBox.style.width);
    const initialHeight = parseFloat(imageBox.style.height);
    const resizeHandle = await waitFor(() => {
      const handle = container.querySelector(
        '.transform-box-image.transform-box-active .transform-handle-corner-bottom-right',
      );

      if (!(handle instanceof HTMLButtonElement)) {
        throw new Error('Resize handle not ready');
      }

      return handle;
    });

    await act(async () => {
      firePointerDown(resizeHandle, 650, 550);
      firePointerMove(760, 640);
      firePointerUp();
    });

    await waitFor(() => {
      const resizedBox = container.querySelector('.transform-box-image.transform-box-active') as HTMLDivElement;
      expect(parseFloat(resizedBox.style.width)).toBeGreaterThan(initialWidth);
      expect(parseFloat(resizedBox.style.height)).toBeGreaterThan(initialHeight);
    });
  });

  it('preserves image aspect ratio while shift-resizing from a corner handle', async () => {
    const context = createContextStub();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
    const { container } = render(createElement(PreviewCanvasHarness));

    const surface = container.querySelector('.preview-surface') as HTMLDivElement;
    vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({
      bottom: 900,
      height: 900,
      left: 0,
      right: 900,
      top: 0,
      width: 900,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    await act(async () => {
      firePointerEnter(surface);
    });
    const resizeHandle = await waitFor(() => {
      const handle = container.querySelector(
        '.transform-box-image.transform-box-active .transform-handle-corner-bottom-right',
      );

      if (!(handle instanceof HTMLButtonElement)) {
        throw new Error('Resize handle not ready');
      }

      return handle;
    });

    await act(async () => {
      firePointerDown(resizeHandle, 650, 550, { shiftKey: true });
      firePointerMove(760, 590, { shiftKey: true });
      firePointerUp();
    });

    await waitFor(() => {
      const resizedBox = container.querySelector('.transform-box-image.transform-box-active') as HTMLDivElement;
      expect(parseFloat(resizedBox.style.width)).toBeCloseTo(56.67, 1);
      expect(parseFloat(resizedBox.style.height)).toBeCloseTo(28.33, 1);
    });
  });

  it('lets image layers shrink close to zero instead of stopping at the old minimum size clamp', async () => {
    const context = createContextStub();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
    const { container } = render(createElement(PreviewCanvasHarness));

    const surface = container.querySelector('.preview-surface') as HTMLDivElement;
    vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({
      bottom: 900,
      height: 900,
      left: 0,
      right: 900,
      top: 0,
      width: 900,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    await act(async () => {
      firePointerEnter(surface);
    });
    const resizeHandle = await waitFor(() => {
      const handle = container.querySelector(
        '.transform-box-image.transform-box-active .transform-handle-corner-bottom-right',
      );

      if (!(handle instanceof HTMLButtonElement)) {
        throw new Error('Resize handle not ready');
      }

      return handle;
    });

    await act(async () => {
      firePointerDown(resizeHandle, 650, 550);
      firePointerMove(251, 351);
      firePointerUp();
    });

    await waitFor(() => {
      const resizedBox = container.querySelector('.transform-box-image.transform-box-active') as HTMLDivElement;
      expect(parseFloat(resizedBox.style.width)).toBeLessThan(7);
      expect(parseFloat(resizedBox.style.height)).toBeLessThan(7);
    });
  });

  it('shows a rotate handle for active image layers and rotates through the shared overlay', async () => {
    const context = createContextStub();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
    const { container } = render(createElement(PreviewCanvasHarness));

    const surface = container.querySelector('.preview-surface') as HTMLDivElement;
    vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({
      bottom: 900,
      height: 900,
      left: 0,
      right: 900,
      top: 0,
      width: 900,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    await act(async () => {
      firePointerEnter(surface);
    });

    const imageBox = container.querySelector('.transform-box-image.transform-box-active') as HTMLDivElement;
    const initialTransform = imageBox.style.transform;
    const rotateHandle = await waitFor(() => {
      const handle = container.querySelector(
        '.transform-box-image.transform-box-active .transform-rotate',
      );

      if (!(handle instanceof HTMLButtonElement)) {
        throw new Error('Rotate handle not ready');
      }

      return handle;
    });

    await act(async () => {
      firePointerDown(rotateHandle, 650, 300);
      firePointerMove(700, 500);
      firePointerUp();
    });

    await waitFor(() => {
      const rotatedBox = container.querySelector(
        '.transform-box-image.transform-box-active',
      ) as HTMLDivElement;
      expect(rotatedBox.style.transform).not.toBe(initialTransform);
      expect(rotatedBox.style.transform).toContain('rotate(');
    });
  });

  it('applies image-layer flip state before drawing the image', () => {
    const context = createContextStub();
    const imageLayerImage = {} as CanvasImageSource;
    const layers = [
      {
        id: 'image-1',
        kind: 'image',
        name: 'Sticker',
        box: { x: 120, y: 80, width: 240, height: 180, rotation: Math.PI / 2 },
        opacity: 0.8,
        image: imageLayerImage,
        sourceSize: { width: 1200, height: 900 },
        skew: { x: -1, y: 1 },
      },
    ] satisfies AppState['layers'];

    renderPreview(context, null, { width: 800, height: 450 }, layers);

    expect(context.translate).toHaveBeenCalledWith(240, 170);
    expect(context.rotate).toHaveBeenCalledWith(Math.PI / 2);
    expect(context.scale).toHaveBeenCalledWith(-1, 1);
    expect(context.drawImage).toHaveBeenCalledWith(imageLayerImage, -120, -90, 240, 180);
  });
});

function PreviewCanvasHarness() {
  const [layers, setLayers] = useState<AppState['layers']>([
    {
      id: 'image-1',
      kind: 'image',
      name: 'Sticker',
      box: { x: 250, y: 350, width: 400, height: 200, rotation: 0 },
      opacity: 1,
      image: {} as CanvasImageSource,
      sourceSize: { width: 400, height: 200 },
      skew: { x: 1, y: 1 },
    },
  ]);
  const [activeLayerId, setActiveLayerId] = useState<string | null>('image-1');

  return createElement(PreviewCanvas, {
    activeLayerId,
    height: 900,
    image: null,
    layers,
    onActiveLayerChange: setActiveLayerId,
    onLayerChange: (layerId, updates) =>
      setLayers((currentLayers) =>
        currentLayers.map((layer) => (layer.id === layerId ? { ...layer, ...updates } : layer)),
      ),
    width: 900,
  });
}

function firePointerDown(
  target: Element | Window,
  clientX: number,
  clientY: number,
  options?: MouseEventInit,
) {
  target.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX, clientY, ...options }));
}

function firePointerEnter(target: Element) {
  fireEvent.pointerEnter(target);
}

function firePointerMove(clientX: number, clientY: number, options?: MouseEventInit) {
  window.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX, clientY, ...options }));
}

function firePointerUp() {
  window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
}

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
    scale: vi.fn(),
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
