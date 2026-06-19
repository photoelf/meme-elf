import { describe, expect, it } from 'vitest';

import { createDefaultAppState } from '../../app/default-state';
import { createDefaultImageLayer } from '../image/image-layer-utils';
import { applyMelfTemplateToState } from './apply-template';
import { STARTER_MELF_TEMPLATE_PRESETS } from './melf-template';

function createImageStub(width = 1200, height = 800) {
  return {
    naturalHeight: height,
    naturalWidth: width,
    src: 'blob:test-image',
  } as HTMLImageElement;
}

describe('applyMelfTemplateToState', () => {
  it('replaces text layers with preset layers and reapplies template defaults', () => {
    const state = createDefaultAppState();
    const imageLayer = createDefaultImageLayer(
      'image-1',
      1,
      createImageStub(),
      state.canvasSize,
      { width: 1200, height: 800 },
    );

    state.layers = [...state.layers, imageLayer];
    state.activeLayerId = imageLayer.id;
    state.sceneImageAdjustments.brightness = 150;
    state.sceneWatermark.text = 'PRIVATE';
    state.retouch.mode = 'draw';
    state.retouch.selection.rect = { x: 10, y: 10, width: 50, height: 50 };

    const applied = applyMelfTemplateToState(
      state,
      STARTER_MELF_TEMPLATE_PRESETS.find((preset) => preset.templateId === 'square-social')!,
    );

    expect(applied.canvasSize).toEqual({ width: 1080, height: 1080 });
    expect(applied.layers.filter((layer) => layer.kind === 'text').map((layer) => layer.id)).toEqual([
      'top',
      'bottom',
    ]);
    expect(applied.layers.filter((layer) => layer.kind !== 'text')).toHaveLength(1);
    expect(applied.activeLayerId).toBe('top');
    expect(applied.layers.find((layer) => layer.kind === 'image')?.box).toEqual({
      x: 85,
      y: 0,
      width: 911,
      height: 1080,
      rotation: 0,
    });
    expect(applied.sceneImageAdjustments).toMatchObject({
      brightness: 100,
      contrast: 100,
      saturation: 100,
    });
    expect(applied.sceneWatermark.text).toBe('создано в программе meme-elf');
    expect(applied.retouch.mode).toBe('idle');
    expect(applied.retouch.selection.rect).toBeNull();
  });

  it('supports quick-apply to a single-caption preset', () => {
    const state = createDefaultAppState();
    const imageLayer = createDefaultImageLayer(
      'image-1',
      1,
      createImageStub(),
      state.canvasSize,
      { width: 400, height: 200 },
    );

    state.layers = [...state.layers, imageLayer];

    const applied = applyMelfTemplateToState(
      state,
      STARTER_MELF_TEMPLATE_PRESETS.find((preset) => preset.templateId === 'top-caption')!,
    );

    expect(applied.layers.filter((layer) => layer.kind === 'text')).toHaveLength(1);
    expect(applied.layers.find((layer) => layer.kind === 'text')?.id).toBe('top');
  });

  it('preserves existing text content while applying template layout defaults', () => {
    const state = createDefaultAppState();
    state.layers[0]!.text = 'HELLO TOP';
    state.layers[1]!.text = 'hello bottom';

    const applied = applyMelfTemplateToState(
      state,
      STARTER_MELF_TEMPLATE_PRESETS.find((preset) => preset.templateId === 'square-social')!,
    );

    const nextTextLayers = applied.layers.filter((layer) => layer.kind === 'text');
    expect(nextTextLayers[0]).toMatchObject({
      id: 'top',
      text: 'HELLO TOP',
      fontSize: 122,
      box: {
        width: 1016,
      },
    });
    expect(nextTextLayers[1]).toMatchObject({
      id: 'bottom',
      text: 'hello bottom',
      fontSize: 122,
      box: {
        width: 1016,
      },
    });
  });
});
