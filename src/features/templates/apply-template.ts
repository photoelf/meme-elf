import { createDefaultAppState } from '../../app/default-state';
import {
  isDrawLayer,
  isImageLayer,
  isTextLayer,
  type AppState,
  type EditorLayer,
  type TextLayer,
} from '../../app/types';
import type { MelfTemplateDocument } from './melf-template';

export function applyMelfTemplateToState(
  state: AppState,
  template: MelfTemplateDocument,
): AppState {
  const nextCanvasSize = {
    width: template.scene.canvasSize.width,
    height: template.scene.canvasSize.height,
  };
  const currentTextLayers = state.layers.filter(isTextLayer);
  const nextTextLayers = template.scene.textLayers.map((layer, index) =>
    preserveTextContent(cloneTextLayer(layer), currentTextLayers[index] ?? null),
  );
  const nextNonTextLayers = scaleLayersForCanvas(
    state.layers.filter((layer) => !isTextLayer(layer)),
    state.canvasSize,
    nextCanvasSize,
  );
  const defaultState = createDefaultAppState();

  return {
    ...state,
    canvasSize: nextCanvasSize,
    layers: [...nextTextLayers, ...nextNonTextLayers],
    activeLayerId: template.scene.activeLayerId ?? nextTextLayers[0]?.id ?? nextNonTextLayers[0]?.id ?? null,
    errorMessage: null,
    status: 'idle',
    preInsertModalDraft: null,
    sceneImageAdjustments: {
      ...template.sceneImageAdjustments,
    },
    sceneEffectStack: template.sceneEffectStack.map((effect) => ({ ...effect })),
    sceneWatermark: {
      ...template.sceneWatermark,
    },
    sceneBoundsDraft: {
      cropRect: null,
      expand: { ...defaultState.sceneBoundsDraft.expand },
      fillMode: defaultState.sceneBoundsDraft.fillMode,
      fillColor: defaultState.sceneBoundsDraft.fillColor,
    },
    activeSceneBoundsMode: 'idle',
    mobileInteraction: {
      ...state.mobileInteraction,
      activeGestureOwner: 'idle',
      activeTargetId: null,
    },
    retouch: {
      ...state.retouch,
      mode: 'idle',
      activeDrawLayerId: null,
      draftStroke: null,
      cloneStamp: {
        sourcePoint: null,
        sourceTargetId: null,
      },
      selection: {
        targetId: null,
        draftRect: null,
        rect: null,
      },
    },
  };
}

function scaleLayersForCanvas(
  layers: EditorLayer[],
  currentCanvasSize: { width: number; height: number },
  nextCanvasSize: { width: number; height: number },
) {
  const scaleX = nextCanvasSize.width / Math.max(1, currentCanvasSize.width);
  const scaleY = nextCanvasSize.height / Math.max(1, currentCanvasSize.height);

  return layers.map((layer) => {
    const scaledBox = {
      ...layer.box,
      x: Math.round(layer.box.x * scaleX),
      y: Math.round(layer.box.y * scaleY),
      width: Math.round(layer.box.width * scaleX),
      height: Math.round(layer.box.height * scaleY),
    };

    if (isDrawLayer(layer)) {
      const rasterData = new Uint8ClampedArray(new ArrayBuffer(layer.raster.data.length));
      rasterData.set(layer.raster.data);

      return {
        ...layer,
        box: scaledBox,
        sourceSize: { ...layer.sourceSize },
        raster: {
          width: layer.raster.width,
          height: layer.raster.height,
          data: rasterData,
        },
      };
    }

    if (isImageLayer(layer)) {
      return {
        ...layer,
        box: scaledBox,
        sourceSize: { ...layer.sourceSize },
        skew: { ...layer.skew },
      };
    }

    return {
      ...layer,
      box: scaledBox,
    };
  });
}

function cloneTextLayer(layer: TextLayer): TextLayer {
  return {
    ...layer,
    box: {
      ...layer.box,
    },
  };
}

function preserveTextContent(nextLayer: TextLayer, currentLayer: TextLayer | null): TextLayer {
  if (!currentLayer) {
    return nextLayer;
  }

  return {
    ...nextLayer,
    text: currentLayer.text,
  };
}
