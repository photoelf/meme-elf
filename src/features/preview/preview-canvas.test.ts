import { createElement } from 'react';
import { fireEvent, render } from '@testing-library/react';
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
});
