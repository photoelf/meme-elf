import { describe, expect, it } from 'vitest';

import {
  finalizeInlineEditorText,
  getCanvasPoint,
  normalizeInlineEditorInput,
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
});
