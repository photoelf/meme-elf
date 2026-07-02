import { createElement } from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  finalizeInlineEditorText,
  getCanvasPoint,
  normalizeInlineEditorInput,
  PreviewCanvas,
} from './preview-canvas';

function dispatchPointerEvent(
  target: EventTarget,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  init: {
    button?: number;
    clientX?: number;
    clientY?: number;
    pointerId?: number;
    pointerType?: string;
  },
) {
  const event = new Event(type, { bubbles: true, cancelable: true });

  for (const [key, value] of Object.entries(init)) {
    Object.defineProperty(event, key, {
      configurable: true,
      value,
    });
  }

  fireEvent(target, event);
}

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

  it('starts a clamped selection marquee from a workspace pointerdown outside the canvas', () => {
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

    const onSelectionDraftChange = vi.fn();
    const onSelectionDraftCommit = vi.fn();
    const onDocumentInteractionStart = vi.fn();
    const props = {
      activeLayerId: null,
      height: 450,
      image: null,
      isStageHovered: true,
      layers: [],
      onActiveLayerChange: vi.fn(),
      onDocumentInteractionStart,
      onLayerChange: vi.fn(),
      onSelectionDraftChange,
      onSelectionDraftCommit,
      retouchMode: 'select',
      selectionTargetRect: { x: 0, y: 0, width: 800, height: 450 },
      width: 800,
    } as const;
    const { container, rerender } = render(createElement(PreviewCanvas, props));

    const surface = container.querySelector('.preview-surface') as HTMLDivElement;
    vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({
      bottom: 500,
      height: 450,
      left: 100,
      right: 900,
      top: 50,
      width: 800,
      x: 100,
      y: 50,
      toJSON: () => ({}),
    });

    const viewportContent = container.querySelector('.preview-viewport-content') as HTMLDivElement;
    dispatchPointerEvent(viewportContent, 'pointerdown', {
      button: 0,
      clientX: 40,
      clientY: 20,
      pointerId: 1,
    });

    expect(onDocumentInteractionStart).toHaveBeenCalledTimes(1);
    expect(onSelectionDraftChange).toHaveBeenLastCalledWith({
      startX: 0,
      startY: 0,
      endX: 0,
      endY: 0,
    });

    rerender(
      createElement(PreviewCanvas, {
        ...props,
        selectionDraft: { startX: 0, startY: 0, endX: 0, endY: 0 },
      }),
    );

    dispatchPointerEvent(window, 'pointermove', { clientX: 1000, clientY: 300, pointerId: 1 });

    expect(onSelectionDraftChange).toHaveBeenLastCalledWith({
      startX: 0,
      startY: 0,
      endX: 800,
      endY: 250,
    });

    dispatchPointerEvent(window, 'pointerup', { pointerId: 1 });

    expect(onSelectionDraftCommit).toHaveBeenCalledWith({
      startX: 0,
      startY: 0,
      endX: 800,
      endY: 250,
    });
  });

  it('keeps workspace touch pointerdown as preview pan while select mode is active', () => {
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

    const onSelectionDraftChange = vi.fn();
    const onPreviewPanStart = vi.fn();
    const { container } = render(
      createElement(PreviewCanvas, {
        activeLayerId: null,
        height: 450,
        image: null,
        isStageHovered: true,
        layers: [],
        onActiveLayerChange: vi.fn(),
        onLayerChange: vi.fn(),
        onPreviewPanStart,
        onSelectionDraftChange,
        retouchMode: 'select',
        selectionTargetRect: { x: 0, y: 0, width: 800, height: 450 },
        width: 800,
      }),
    );

    const viewportContent = container.querySelector('.preview-viewport-content') as HTMLDivElement;
    dispatchPointerEvent(viewportContent, 'pointerdown', {
      button: 0,
      clientX: 40,
      clientY: 20,
      pointerId: 7,
      pointerType: 'touch',
    });

    expect(onPreviewPanStart).toHaveBeenCalledTimes(1);
    expect(onSelectionDraftChange).not.toHaveBeenCalled();
  });

  it('does not start a second marquee when the pointerdown lands on the canvas', () => {
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

    const onSelectionDraftChange = vi.fn();
    const onDocumentInteractionStart = vi.fn();
    const { container } = render(
      createElement(PreviewCanvas, {
        activeLayerId: null,
        height: 450,
        image: null,
        isStageHovered: true,
        layers: [],
        onActiveLayerChange: vi.fn(),
        onDocumentInteractionStart,
        onLayerChange: vi.fn(),
        onSelectionDraftChange,
        retouchMode: 'select',
        selectionTargetRect: { x: 0, y: 0, width: 800, height: 450 },
        width: 800,
      }),
    );

    const surface = container.querySelector('.preview-surface') as HTMLDivElement;
    vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({
      bottom: 500,
      height: 450,
      left: 100,
      right: 900,
      top: 50,
      width: 800,
      x: 100,
      y: 50,
      toJSON: () => ({}),
    });

    dispatchPointerEvent(surface, 'pointerdown', {
      button: 0,
      clientX: 300,
      clientY: 200,
      pointerId: 1,
    });

    expect(onDocumentInteractionStart).toHaveBeenCalledTimes(1);
    expect(onSelectionDraftChange).toHaveBeenCalledTimes(1);
    expect(onSelectionDraftChange).toHaveBeenLastCalledWith({
      startX: 200,
      startY: 150,
      endX: 200,
      endY: 150,
    });
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

  it('clamps a scene crop that starts from zoom overflow back into image bounds', () => {
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

    const onSceneCropDraftChange = vi.fn();
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
        onSceneCropDraftChange,
        previewZoomFactor: 2,
        sceneCropDraft: null,
        width: 800,
      }),
    );

    const viewport = container.querySelector('.preview-viewport-content') as HTMLDivElement;
    const surface = container.querySelector('.preview-surface') as HTMLDivElement;
    vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({
      bottom: 950,
      height: 900,
      left: 100,
      right: 1700,
      top: 50,
      width: 1600,
      x: 100,
      y: 50,
      toJSON: () => ({}),
    });

    fireEvent.mouseDown(viewport, {
      button: 0,
      clientX: 40,
      clientY: 10,
    });
    fireEvent.mouseMove(window, {
      clientX: 500,
      clientY: 250,
    });

    expect(onSceneCropDraftChange).toHaveBeenLastCalledWith({
      endX: 200,
      endY: 100,
      startX: 0,
      startY: 0,
    });
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
    const viewportContent = container.querySelector('.preview-viewport-content') as HTMLDivElement;
    expect(viewportContent.style.touchAction).toBe('none');
    expect(viewportContent.style.overscrollBehavior).toBe('contain');
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

  it('routes touch draw gestures through the retouch path instead of preview pan', () => {
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
    const onPreviewPanStart = vi.fn();
    const { container } = render(
      createElement(PreviewCanvas, {
        activeLayerId: null,
        height: 450,
        image: null,
        isStageHovered: false,
        layers: [],
        mobileInteraction: {
          activeGestureOwner: 'idle',
          activeTargetId: null,
          lastPointerType: 'touch',
        },
        onActiveLayerChange: vi.fn(),
        onDraftStrokeChange,
        onDraftStrokeCommit,
        onLayerChange: vi.fn(),
        onPreviewPanStart,
        retouchMode: 'draw',
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

    fireEvent.pointerDown(surface, {
      button: 0,
      clientX: 50,
      clientY: 60,
      pointerId: 1,
      pointerType: 'touch',
    });
    fireEvent.pointerMove(window, {
      clientX: 90,
      clientY: 100,
      pointerId: 1,
      pointerType: 'touch',
    });
    fireEvent.pointerUp(window, {
      pointerId: 1,
      pointerType: 'touch',
    });

    expect(onDraftStrokeChange).toHaveBeenCalled();
    expect(onDraftStrokeCommit).toHaveBeenCalledTimes(1);
    expect(onPreviewPanStart).not.toHaveBeenCalled();
  });

  it('does not open inline text editing when a second finger joins the active layer touch gesture', () => {
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
    const onPreviewPinchChange = vi.fn();
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
        onLayerChange: vi.fn(),
        onPreviewPinchChange,
        retouchMode: 'idle',
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

    const transformBox = container.querySelector('.transform-box-active') as HTMLDivElement;
    dispatchPointerEvent(transformBox, 'pointerdown', {
      button: 0,
      clientX: 120,
      clientY: 60,
      pointerId: 1,
      pointerType: 'touch',
    });
    dispatchPointerEvent(transformBox, 'pointerdown', {
      button: 0,
      clientX: 260,
      clientY: 220,
      pointerId: 2,
      pointerType: 'touch',
    });
    dispatchPointerEvent(transformBox, 'pointermove', {
      clientX: 320,
      clientY: 220,
      pointerId: 2,
      pointerType: 'touch',
    });
    dispatchPointerEvent(surface, 'pointerup', {
      clientX: 122,
      clientY: 62,
      pointerId: 1,
      pointerType: 'touch',
    });

    expect(onPreviewPinchChange).not.toHaveBeenCalled();
    expect(onInlineTextEditStart).not.toHaveBeenCalled();
  });

  it('upgrades an active layer touch move into two-finger layer transform instead of preview pinch zoom', () => {
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

    const onLayerChange = vi.fn();
    const onPreviewPinchChange = vi.fn();
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
            box: { x: 200, y: 100, width: 240, height: 90, rotation: 0 },
          },
        ],
        mobileInteraction: {
          activeGestureOwner: 'idle',
          activeTargetId: 'top',
          lastPointerType: 'touch',
        },
        onActiveLayerChange: vi.fn(),
        onLayerChange,
        onPreviewPinchChange,
        retouchMode: 'idle',
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

    const transformBox = container.querySelector('.transform-box-active') as HTMLDivElement;
    dispatchPointerEvent(transformBox, 'pointerdown', {
      button: 0,
      clientX: 220,
      clientY: 120,
      pointerId: 1,
      pointerType: 'touch',
    });
    dispatchPointerEvent(surface, 'pointermove', {
      clientX: 230,
      clientY: 130,
      pointerId: 1,
      pointerType: 'touch',
    });
    dispatchPointerEvent(transformBox, 'pointerdown', {
      button: 0,
      clientX: 420,
      clientY: 240,
      pointerId: 2,
      pointerType: 'touch',
    });
    dispatchPointerEvent(surface, 'pointermove', {
      clientX: 260,
      clientY: 90,
      pointerId: 1,
      pointerType: 'touch',
    });
    dispatchPointerEvent(surface, 'pointermove', {
      clientX: 500,
      clientY: 280,
      pointerId: 2,
      pointerType: 'touch',
    });
    dispatchPointerEvent(surface, 'pointerup', {
      pointerId: 1,
      pointerType: 'touch',
    });
    dispatchPointerEvent(surface, 'pointerup', {
      pointerId: 2,
      pointerType: 'touch',
    });

    expect(onPreviewPinchChange).not.toHaveBeenCalled();
    expect(onLayerChange).toHaveBeenCalled();
    expect(onLayerChange).toHaveBeenLastCalledWith(
      'top',
      expect.objectContaining({
        box: expect.objectContaining({
          rotation: expect.any(Number),
          width: expect.any(Number),
          height: expect.any(Number),
          x: expect.any(Number),
          y: expect.any(Number),
        }),
      }),
      'defer',
    );
    expect(onLayerChange.mock.calls.at(-1)?.[1]?.box.rotation).not.toBe(0);
    expect(onLayerChange.mock.calls.at(-1)?.[1]?.box.width).not.toBe(240);
  });

  it('does not start preview pinch touch events while an active layer touch transform session is in progress', () => {
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

    const onPreviewPinchChange = vi.fn();
    const { container } = render(
      createElement(PreviewCanvas, {
        activeLayerId: 'image-1',
        height: 450,
        image: null,
        isStageHovered: false,
        layers: [
          {
            kind: 'image',
            id: 'image-1',
            name: 'Image 1',
            opacity: 1,
            box: { x: 200, y: 100, width: 240, height: 160, rotation: 0 },
          },
        ],
        mobileInteraction: {
          activeGestureOwner: 'idle',
          activeTargetId: 'image-1',
          lastPointerType: 'touch',
        },
        onActiveLayerChange: vi.fn(),
        onLayerChange: vi.fn(),
        onPreviewPinchChange,
        retouchMode: 'idle',
        width: 800,
      }),
    );

    const surface = container.querySelector('.preview-surface') as HTMLDivElement;
    const viewportContent = container.querySelector('.preview-viewport-content') as HTMLDivElement;
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
    dispatchPointerEvent(transformBox, 'pointerdown', {
      button: 0,
      clientX: 220,
      clientY: 120,
      pointerId: 1,
      pointerType: 'touch',
    });
    fireEvent.touchStart(viewportContent, {
      touches: [
        { clientX: 220, clientY: 120, identifier: 1, target: surface },
        { clientX: 420, clientY: 240, identifier: 2, target: surface },
      ],
      changedTouches: [
        { clientX: 420, clientY: 240, identifier: 2, target: surface },
      ],
    });
    fireEvent.touchMove(viewportContent, {
      touches: [
        { clientX: 240, clientY: 110, identifier: 1, target: surface },
        { clientX: 470, clientY: 270, identifier: 2, target: surface },
      ],
      changedTouches: [
        { clientX: 470, clientY: 270, identifier: 2, target: surface },
      ],
    });

    expect(onPreviewPinchChange).not.toHaveBeenCalled();
  });

  it('fires the preview double-tap callback only for empty-canvas touch taps', () => {
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

    const onPreviewToggleFitActual = vi.fn();
    const { container } = render(
      createElement(PreviewCanvas, {
        activeLayerId: null,
        height: 450,
        image: null,
        isStageHovered: false,
        layers: [],
        mobileInteraction: {
          activeGestureOwner: 'idle',
          activeTargetId: null,
          lastPointerType: 'touch',
        },
        onActiveLayerChange: vi.fn(),
        onLayerChange: vi.fn(),
        onPreviewToggleFitActual,
        retouchMode: 'idle',
        width: 800,
      }),
    );

    const surface = container.querySelector('.preview-surface') as HTMLDivElement;
    fireEvent.touchStart(surface, {
      touches: [
        { clientX: 300, clientY: 200, identifier: 1, target: surface },
      ],
      changedTouches: [
        { clientX: 300, clientY: 200, identifier: 1, target: surface },
      ],
    });
    fireEvent.touchEnd(surface, {
      touches: [],
      changedTouches: [
        { clientX: 300, clientY: 200, identifier: 1, target: surface },
      ],
    });
    fireEvent.touchStart(surface, {
      touches: [
        { clientX: 302, clientY: 202, identifier: 2, target: surface },
      ],
      changedTouches: [
        { clientX: 302, clientY: 202, identifier: 2, target: surface },
      ],
    });
    fireEvent.touchEnd(surface, {
      touches: [],
      changedTouches: [
        { clientX: 302, clientY: 202, identifier: 2, target: surface },
      ],
    });

    expect(onPreviewToggleFitActual).toHaveBeenCalledTimes(1);
  });

});
