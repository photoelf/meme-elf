import { createElement } from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  finalizeInlineEditorText,
  getCanvasPoint,
  normalizeInlineEditorInput,
  PreviewCanvas,
} from './preview-canvas';

describe('preview-canvas helpers', () => {
  it('maps scaled preview pointer coordinates back into canvas space', () => {
    const shell = document.createElement('div');

    Object.defineProperty(shell, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        bottom: 1350,
        height: 1350,
        left: 0,
        right: 1350,
        top: 0,
        width: 1350,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    });

    expect(getCanvasPoint(shell, 900, 900, 675, 675)).toEqual({ x: 450, y: 450 });
  });

  it('preserves newlines during inline editing input', () => {
    expect(normalizeInlineEditorInput('TOP LINE\n')).toBe('TOP LINE\n');
    expect(normalizeInlineEditorInput('TOP\r\nBOTTOM\r\n')).toBe('TOP\nBOTTOM\n');
  });

  it('removes trailing newlines only when inline editing is finalized', () => {
    expect(finalizeInlineEditorText('TOP LINE\nBOTTOM LINE')).toBe('TOP LINE\nBOTTOM LINE');
    expect(finalizeInlineEditorText('TOP LINE\n')).toBe('TOP LINE');
    expect(finalizeInlineEditorText('TOP LINE\n\n')).toBe('TOP LINE');
    expect(finalizeInlineEditorText('TOP\r\nBOTTOM\r\n')).toBe('TOP\nBOTTOM');
  });

  it('shows a draft stroke overlay and routes pointer updates while draw mode is active', () => {
    const context = {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      fillText: vi.fn(),
      getImageData: vi.fn(),
      measureText: vi.fn(() => ({ width: 10 })),
      putImageData: vi.fn(),
      restore: vi.fn(),
      rotate: vi.fn(),
      save: vi.fn(),
      scale: vi.fn(),
      strokeText: vi.fn(),
      transform: vi.fn(),
      translate: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);

    const onDraftStrokeChange = vi.fn();
    const onDraftStrokeCommit = vi.fn();
    const { container } = render(
      createElement(PreviewCanvas, {
        activeLayerId: null,
        height: 450,
        image: null,
        isStageHovered: true,
        layers: [],
        onActiveLayerChange: vi.fn(),
        onLayerChange: vi.fn(),
        retouchMode: 'draw',
        draftStroke: {
          points: [
            { x: 40, y: 40 },
            { x: 120, y: 100 },
          ],
          targetLayerId: null,
        },
        onDraftStrokeChange,
        onDraftStrokeCommit,
        width: 800,
      }),
    );

    const surface = container.querySelector('.preview-surface') as HTMLDivElement;
    vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({
      bottom: 450,
      height: 450,
      left: 0,
      right: 800,
      top: 0,
      width: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    const overlay = container.querySelector('.draw-stroke-preview') as SVGElement | null;
    expect(overlay).toBeInTheDocument();
    expect(overlay?.style.position).toBe('absolute');
    expect(overlay?.style.inset).toBe('0px');
    expect(overlay?.style.pointerEvents).toBe('none');

    fireEvent.pointerDown(surface, { button: 0, clientX: 20, clientY: 20 });
    fireEvent.pointerMove(window, { clientX: 80, clientY: 60 });
    fireEvent.pointerUp(window);

    expect(onDraftStrokeChange).toHaveBeenCalled();
    expect(onDraftStrokeCommit).toHaveBeenCalledTimes(1);
  });

  it('does not render transform boxes while draw mode is active', () => {
    const context = {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      fillText: vi.fn(),
      getImageData: vi.fn(),
      measureText: vi.fn(() => ({ width: 10 })),
      putImageData: vi.fn(),
      restore: vi.fn(),
      rotate: vi.fn(),
      save: vi.fn(),
      scale: vi.fn(),
      strokeText: vi.fn(),
      transform: vi.fn(),
      translate: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);

    const { container } = render(
      createElement(PreviewCanvas, {
        activeLayerId: 'top',
        height: 450,
        image: null,
        isStageHovered: true,
        layers: [
          {
            kind: 'text',
            id: 'top',
            name: 'Top text',
            opacity: 1,
            text: 'TOP',
            fontFamily: 'Impact',
            fontSize: 90,
            fillStyle: '#ffffff',
            strokeStyle: '#000000',
            outlineWidth: 5,
            textAlign: 'center',
            verticalAlign: 'top',
            effect: 'outline',
            allCaps: true,
            bold: false,
            italic: false,
            box: { x: 24, y: 0, width: 752, height: 110, rotation: 0 },
          },
        ],
        onActiveLayerChange: vi.fn(),
        onLayerChange: vi.fn(),
        retouchMode: 'draw',
        width: 800,
      }),
    );

    expect(container.querySelectorAll('.transform-box')).toHaveLength(0);
  });

  it('clears the draft stroke without committing when the pointer interaction is cancelled', async () => {
    const context = {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      fillText: vi.fn(),
      getImageData: vi.fn(),
      measureText: vi.fn(() => ({ width: 10 })),
      putImageData: vi.fn(),
      restore: vi.fn(),
      rotate: vi.fn(),
      save: vi.fn(),
      scale: vi.fn(),
      strokeText: vi.fn(),
      transform: vi.fn(),
      translate: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);

    const onDraftStrokeChange = vi.fn();
    const onDraftStrokeCommit = vi.fn();
    const onDocumentInteractionEnd = vi.fn();
    const { container } = render(
      createElement(PreviewCanvas, {
        activeLayerId: null,
        height: 450,
        image: null,
        isStageHovered: true,
        layers: [],
        onActiveLayerChange: vi.fn(),
        onDocumentInteractionEnd,
        onLayerChange: vi.fn(),
        retouchMode: 'draw',
        onDraftStrokeChange,
        onDraftStrokeCommit,
        width: 800,
      }),
    );

    const surface = container.querySelector('.preview-surface') as HTMLDivElement;
    vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({
      bottom: 450,
      height: 450,
      left: 0,
      right: 800,
      top: 0,
      width: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(surface, { button: 0, clientX: 20, clientY: 20 });
    fireEvent.pointerMove(window, { clientX: 80, clientY: 60 });
    fireEvent.pointerCancel(window);

    expect(onDraftStrokeCommit).not.toHaveBeenCalled();
    expect(onDraftStrokeChange).toHaveBeenLastCalledWith(null);
    await waitFor(() => {
      expect(onDocumentInteractionEnd).toHaveBeenCalledTimes(1);
    });
  });

  it('keeps the committed marquee overlay visible after selection mode exits', () => {
    const context = {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      fillText: vi.fn(),
      getImageData: vi.fn(),
      measureText: vi.fn(() => ({ width: 10 })),
      putImageData: vi.fn(),
      restore: vi.fn(),
      rotate: vi.fn(),
      save: vi.fn(),
      scale: vi.fn(),
      strokeText: vi.fn(),
      transform: vi.fn(),
      translate: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);

    const props = {
      activeLayerId: null,
      height: 450,
      image: null,
      isStageHovered: true,
      layers: [],
      onActiveLayerChange: vi.fn(),
      onLayerChange: vi.fn(),
      selectionRect: { x: 40, y: 40, width: 100, height: 60 },
      selectionTargetRect: { x: 0, y: 0, width: 800, height: 450 },
      width: 800,
    } as const;

    const activeResult = render(
      createElement(PreviewCanvas, {
        ...props,
        retouchMode: 'select',
      }),
    );

    expect(activeResult.container.querySelector('.selection-overlay')).toBeInTheDocument();

    activeResult.unmount();

    const idleResult = render(
      createElement(PreviewCanvas, {
        ...props,
        retouchMode: 'idle',
      }),
    );

    expect(idleResult.container.querySelector('.selection-overlay')).toBeInTheDocument();
  });

  it('sets a clone source on alt-click without starting a draft stroke', () => {
    const context = {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      fillText: vi.fn(),
      getImageData: vi.fn(),
      measureText: vi.fn(() => ({ width: 10 })),
      putImageData: vi.fn(),
      restore: vi.fn(),
      rotate: vi.fn(),
      save: vi.fn(),
      scale: vi.fn(),
      strokeText: vi.fn(),
      transform: vi.fn(),
      translate: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);

    const onDraftStrokeChange = vi.fn();
    const onCloneStampSourceSet = vi.fn();
    const { container } = render(
      createElement(PreviewCanvas, {
        activeLayerId: 'draw-1',
        height: 450,
        image: null,
        isStageHovered: true,
        layers: [],
        onActiveLayerChange: vi.fn(),
        onCloneStampSourceSet,
        onDraftStrokeChange,
        onLayerChange: vi.fn(),
        retouchMode: 'clone-stamp',
        width: 800,
      }),
    );

    const surface = container.querySelector('.preview-surface') as HTMLDivElement;
    const canvas = container.querySelector('.preview-canvas') as HTMLCanvasElement;
    vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({
      bottom: 450,
      height: 450,
      left: 0,
      right: 800,
      top: 0,
      width: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.keyDown(window, { key: 'Alt' });
    fireEvent.pointerDown(surface, {
      button: 0,
      clientX: 140,
      clientY: 110,
    });
    fireEvent.keyUp(window, { key: 'Alt' });

    expect(onCloneStampSourceSet).toHaveBeenCalledTimes(1);
    expect(onCloneStampSourceSet.mock.calls[0]?.[0]).toMatchObject({
      x: expect.any(Number),
      y: expect.any(Number),
    });
    expect(onDraftStrokeChange).not.toHaveBeenCalled();
  });

  it('shows transform handles for the active layer on phone touch sessions without hover', () => {
    const context = {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      fillText: vi.fn(),
      getImageData: vi.fn(),
      measureText: vi.fn(() => ({ width: 10 })),
      putImageData: vi.fn(),
      restore: vi.fn(),
      rotate: vi.fn(),
      save: vi.fn(),
      scale: vi.fn(),
      strokeText: vi.fn(),
      transform: vi.fn(),
      translate: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);

    const { container } = render(
      createElement(PreviewCanvas, {
        activeLayerId: 'top',
        height: 450,
        image: null,
        isStageHovered: false,
        layers: [
          {
            kind: 'text',
            id: 'top',
            name: 'Top text',
            opacity: 1,
            text: 'TOP',
            fontFamily: 'Impact',
            fontSize: 90,
            fillStyle: '#ffffff',
            strokeStyle: '#000000',
            outlineWidth: 5,
            textAlign: 'center',
            verticalAlign: 'top',
            effect: 'outline',
            allCaps: true,
            bold: false,
            italic: false,
            box: { x: 24, y: 0, width: 752, height: 110, rotation: 0 },
          },
        ],
        mobileInteraction: {
          activeGestureOwner: 'idle',
          activeTargetId: 'top',
          lastPointerType: 'touch',
        },
        onActiveLayerChange: vi.fn(),
        onLayerChange: vi.fn(),
        retouchMode: 'idle',
        width: 800,
      }),
    );

    expect(container.querySelector('.transform-box-active')).toBeInTheDocument();
    expect(container.querySelectorAll('.transform-handle')).toHaveLength(8);
  });

  it('renders touch-safe crop overlay handles and mobile cues during scene crop mode', () => {
    const context = {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      fillText: vi.fn(),
      getImageData: vi.fn(),
      measureText: vi.fn(() => ({ width: 10 })),
      putImageData: vi.fn(),
      restore: vi.fn(),
      rotate: vi.fn(),
      save: vi.fn(),
      scale: vi.fn(),
      strokeText: vi.fn(),
      transform: vi.fn(),
      translate: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);

    const { container } = render(
      createElement(PreviewCanvas, {
        activeLayerId: null,
        height: 450,
        image: null,
        isSceneCropMode: true,
        isStageHovered: true,
        layers: [],
        mobileInteraction: {
          activeGestureOwner: 'crop',
          activeTargetId: null,
          lastPointerType: 'touch',
        },
        onActiveLayerChange: vi.fn(),
        onLayerChange: vi.fn(),
        sceneCropDraft: {
          startX: 100,
          startY: 80,
          endX: 420,
          endY: 260,
        },
        width: 800,
      }),
    );

    const overlay = container.querySelector('.scene-crop-overlay') as HTMLDivElement | null;
    const hitbox = container.querySelector('.scene-crop-hitbox') as HTMLButtonElement | null;
    const handle = container.querySelector('.scene-crop-overlay .transform-handle') as HTMLButtonElement | null;

    expect(overlay).toHaveClass('scene-crop-overlay-touch');
    expect(hitbox?.style.inset).toBe('-14px');
    expect(handle?.style.width).toBe('44px');
    expect(handle?.style.height).toBe('44px');
  });

  it('disables native touch scrolling on the preview surface', () => {
    const context = {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      fillText: vi.fn(),
      getImageData: vi.fn(),
      measureText: vi.fn(() => ({ width: 10 })),
      putImageData: vi.fn(),
      restore: vi.fn(),
      rotate: vi.fn(),
      save: vi.fn(),
      scale: vi.fn(),
      strokeText: vi.fn(),
      transform: vi.fn(),
      translate: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);

    const { container } = render(
      createElement(PreviewCanvas, {
        activeLayerId: null,
        height: 450,
        image: null,
        isStageHovered: true,
        layers: [],
        onActiveLayerChange: vi.fn(),
        onLayerChange: vi.fn(),
        width: 800,
      }),
    );

    const surface = container.querySelector('.preview-surface') as HTMLDivElement;
    expect(surface.style.touchAction).toBe('none');
    expect(surface.style.overscrollBehavior).toBe('contain');
  });

  it('opens inline text editing from a touch tap on the active text layer', () => {
    const context = {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      fillText: vi.fn(),
      getImageData: vi.fn(),
      measureText: vi.fn(() => ({ width: 10 })),
      putImageData: vi.fn(),
      restore: vi.fn(),
      rotate: vi.fn(),
      save: vi.fn(),
      scale: vi.fn(),
      strokeText: vi.fn(),
      transform: vi.fn(),
      translate: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);

    const onInlineTextEditStart = vi.fn();
    const onLayerChange = vi.fn();
    const { container } = render(
      createElement(PreviewCanvas, {
        activeLayerId: 'top',
        height: 450,
        image: null,
        isStageHovered: false,
        layers: [
          {
            kind: 'text',
            id: 'top',
            name: 'Top text',
            opacity: 1,
            text: 'TOP',
            fontFamily: 'Impact',
            fontSize: 90,
            fillStyle: '#ffffff',
            strokeStyle: '#000000',
            outlineWidth: 5,
            textAlign: 'center',
            verticalAlign: 'top',
            effect: 'outline',
            allCaps: true,
            bold: false,
            italic: false,
            box: { x: 24, y: 0, width: 752, height: 110, rotation: 0 },
          },
        ],
        mobileInteraction: {
          activeGestureOwner: 'idle',
          activeTargetId: 'top',
          lastPointerType: 'touch',
        },
        onActiveLayerChange: vi.fn(),
        onInlineTextEditStart,
        onLayerChange,
        retouchMode: 'idle',
        width: 800,
      }),
    );

    const surface = container.querySelector('.preview-surface') as HTMLDivElement;
    const canvas = container.querySelector('.preview-canvas') as HTMLCanvasElement;
    vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({
      bottom: 450,
      height: 450,
      left: 0,
      right: 800,
      top: 0,
      width: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    const transformBox = container.querySelector('.transform-box-active') as HTMLDivElement;
    fireEvent.pointerDown(transformBox, {
      button: 0,
      clientX: 120,
      clientY: 60,
      pointerId: 1,
      pointerType: 'touch',
    });
    fireEvent.pointerUp(window, {
      clientX: 122,
      clientY: 62,
      pointerId: 1,
      pointerType: 'touch',
    });

    expect(onInlineTextEditStart).toHaveBeenCalledTimes(1);
    expect(onLayerChange).not.toHaveBeenCalled();
    expect(container.querySelector('.canvas-text-editor')).toBeInTheDocument();
  });

  it('clears the active text layer after an outside tap blurs inline touch editing', () => {
    const context = {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      fillText: vi.fn(),
      getImageData: vi.fn(),
      measureText: vi.fn(() => ({ width: 10 })),
      putImageData: vi.fn(),
      restore: vi.fn(),
      rotate: vi.fn(),
      save: vi.fn(),
      scale: vi.fn(),
      strokeText: vi.fn(),
      transform: vi.fn(),
      translate: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);

    const onActiveLayerClear = vi.fn();
    const onInlineTextEditStart = vi.fn();
    const { container } = render(
      createElement(PreviewCanvas, {
        activeLayerId: 'top',
        height: 450,
        image: null,
        isStageHovered: false,
        layers: [
          {
            kind: 'text',
            id: 'top',
            name: 'Top text',
            opacity: 1,
            text: 'TOP',
            fontFamily: 'Impact',
            fontSize: 90,
            fillStyle: '#ffffff',
            strokeStyle: '#000000',
            outlineWidth: 5,
            textAlign: 'center',
            verticalAlign: 'top',
            effect: 'outline',
            allCaps: true,
            bold: false,
            italic: false,
            box: { x: 24, y: 0, width: 752, height: 110, rotation: 0 },
          },
        ],
        mobileInteraction: {
          activeGestureOwner: 'idle',
          activeTargetId: 'top',
          lastPointerType: 'touch',
        },
        onActiveLayerChange: vi.fn(),
        onActiveLayerClear,
        onInlineTextEditStart,
        onLayerChange: vi.fn(),
        retouchMode: 'idle',
        width: 800,
      }),
    );

    const surface = container.querySelector('.preview-surface') as HTMLDivElement;
    const canvas = container.querySelector('.preview-canvas') as HTMLCanvasElement;
    vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({
      bottom: 450,
      height: 450,
      left: 0,
      right: 800,
      top: 0,
      width: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    const transformBox = container.querySelector('.transform-box-active') as HTMLDivElement;
    fireEvent.pointerDown(transformBox, {
      button: 0,
      clientX: 120,
      clientY: 60,
      pointerId: 1,
      pointerType: 'touch',
    });
    fireEvent.pointerUp(window, {
      clientX: 122,
      clientY: 62,
      pointerId: 1,
      pointerType: 'touch',
    });

    expect(onInlineTextEditStart).toHaveBeenCalledTimes(1);

    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: 300,
      clientY: 200,
      pointerId: 2,
      pointerType: 'touch',
    });

    expect(onActiveLayerClear).toHaveBeenCalledTimes(1);
  });

});
