import { describe, expect, it } from 'vitest';

import { createDefaultAppState } from '../../app/default-state';
import { createDefaultImageLayer } from '../image/image-layer-utils';
import { applyMelfTemplateToState } from './apply-template';
import { createTwoButtonsTemplateDocument } from './two-buttons-test-fixture';

function createImageStub(width = 1200, height = 800) {
  return {
    naturalHeight: height,
    naturalWidth: width,
    src: 'blob:test-image',
  } as HTMLImageElement;
}

describe('applyMelfTemplateToState', () => {
  it('materializes text layers from slots and preserves text by semantic match first', () => {
    const state = createDefaultAppState();
    state.layers[0]!.id = 'top';
    state.layers[0]!.text = 'HELLO TOP';
    state.layers[1]!.id = 'bottom';
    state.layers[1]!.text = 'hello bottom';
    const template = createTwoButtonsTemplateDocument();

    const applied = applyMelfTemplateToState(state, template);

    const nextTextLayers = applied.layers.filter((layer) => layer.kind === 'text');
    expect(nextTextLayers[0]).toMatchObject({ id: 'top', text: 'HELLO TOP' });
    expect(nextTextLayers[1]).toMatchObject({ id: 'bottom', text: 'hello bottom' });
    expect(nextTextLayers[2]).toMatchObject({ id: 'layer-4', text: '' });
  });

  it('replaces text layers with the imported template layout and reapplies template defaults', () => {
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
    const template = createTwoButtonsTemplateDocument();

    const applied = applyMelfTemplateToState(state, template);

    expect(applied.canvasSize).toEqual({ width: 500, height: 757 });
    expect(applied.layers.filter((layer) => layer.kind === 'text').map((layer) => layer.id)).toEqual([
      'top',
      'bottom',
      'layer-4',
    ]);
    expect(applied.layers.filter((layer) => layer.kind !== 'text')).toHaveLength(1);
    expect(applied.activeLayerId).toBe('top');
    expect(applied.layers.find((layer) => layer.kind === 'image')?.box).toEqual({
      x: 0,
      y: 0,
      width: 500,
      height: 757,
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

  it('adds all imported text slots when the template carries more labels than the editor default', () => {
    const state = createDefaultAppState();
    const imageLayer = createDefaultImageLayer(
      'image-1',
      1,
      createImageStub(),
      state.canvasSize,
      { width: 400, height: 200 },
    );

    state.layers = [...state.layers, imageLayer];
    const template = createTwoButtonsTemplateDocument();

    const applied = applyMelfTemplateToState(state, template);

    expect(applied.layers.filter((layer) => layer.kind === 'text')).toHaveLength(3);
    expect(applied.layers.find((layer) => layer.kind === 'text')?.id).toBe('top');
  });

  it('keeps template apply safe when the template has an image slot but the editor has no image layer', () => {
    const state = createDefaultAppState();
    const template = createTwoButtonsTemplateDocument();

    const applied = applyMelfTemplateToState(state, template);

    expect(applied.layers.filter((layer) => layer.kind === 'image')).toHaveLength(0);
    expect(applied.layers.filter((layer) => layer.kind === 'text')).toHaveLength(3);
  });

  it('repositions only the first current image layer into the template primary image slot', () => {
    const state = createDefaultAppState();
    const firstImageLayer = createDefaultImageLayer(
      'image-1',
      1,
      createImageStub(1200, 800),
      state.canvasSize,
      { width: 1200, height: 800 },
    );
    const secondImageLayer = createDefaultImageLayer(
      'image-2',
      2,
      createImageStub(400, 200),
      state.canvasSize,
      { width: 400, height: 200 },
    );
    state.layers = [...state.layers, firstImageLayer, secondImageLayer];
    const template = createTwoButtonsTemplateDocument();

    const applied = applyMelfTemplateToState(state, template);

    const appliedImageLayers = applied.layers.filter((layer) => layer.kind === 'image');
    expect(appliedImageLayers).toHaveLength(2);
    expect(appliedImageLayers[0]?.box).toEqual({
      x: 0,
      y: 0,
      width: 500,
      height: 757,
      rotation: 0,
    });
    expect(appliedImageLayers[1]?.box).toEqual({
      x: 125,
      y: 210,
      width: 250,
      height: 336,
      rotation: 0,
    });
    expect(appliedImageLayers[1]?.box).not.toEqual({
      x: 0,
      y: 0,
      width: 500,
      height: 757,
      rotation: 0,
    });
  });

  it('preserves existing text content while applying template layout defaults', () => {
    const state = createDefaultAppState();
    state.layers[0]!.text = 'HELLO TOP';
    state.layers[1]!.text = 'hello bottom';
    const template = createTwoButtonsTemplateDocument();

    const applied = applyMelfTemplateToState(state, template);

    const nextTextLayers = applied.layers.filter((layer) => layer.kind === 'text');
    expect(nextTextLayers[0]).toMatchObject({
      id: 'top',
      text: 'HELLO TOP',
      fontSize: 90,
      box: {
        width: 179,
      },
    });
    expect(nextTextLayers[1]).toMatchObject({
      id: 'bottom',
      text: 'hello bottom',
      fontSize: 90,
      box: {
        width: 115,
      },
    });
  });

  it('uses slot default text when the current layer text is empty', () => {
    const state = createDefaultAppState();
    state.layers[0]!.text = '';
    state.layers[1]!.text = '';
    const template = structuredClone(createTwoButtonsTemplateDocument());
    template.scene.textSlots[0]!.defaultText = 'IMPORTED TOP';
    template.scene.textSlots[1]!.defaultText = 'IMPORTED BOTTOM';
    template.scene.textSlots[2]!.defaultText = 'PRESS HERE';

    const applied = applyMelfTemplateToState(state, template);

    const nextTextLayers = applied.layers.filter((layer) => layer.kind === 'text');
    expect(nextTextLayers[0]).toMatchObject({ id: 'top', text: 'IMPORTED TOP' });
    expect(nextTextLayers[1]).toMatchObject({ id: 'bottom', text: 'IMPORTED BOTTOM' });
    expect(nextTextLayers[2]).toMatchObject({ id: 'layer-4', text: 'PRESS HERE' });
  });
});
