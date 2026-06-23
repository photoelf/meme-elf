import { createDefaultAppState, createTextLayer } from '../../app/default-state';
import {
  isDrawLayer,
  isImageLayer,
  isTextLayer,
  type AppState,
  type EditorLayer,
  type TextLayer,
} from '../../app/types';
import type { MelfTemplateDocument, MelfTextSlot } from './melf-template';

export function applyMelfTemplateToState(
  state: AppState,
  template: MelfTemplateDocument,
): AppState {
  const nextCanvasSize = {
    width: template.scene.canvasSize.width,
    height: template.scene.canvasSize.height,
  };
  const currentTextLayers = state.layers.filter(isTextLayer);
  const nextTextLayers = template.scene.textSlots.map((slot, index) =>
    preserveTextContent(
      materializeTextLayerFromSlot(slot),
      findMatchingCurrentTextLayer(slot, currentTextLayers, index),
      slot.defaultText,
    ),
  );
  const primaryImageSlot = template.scene.imageSlots.find((slot) => slot.role === 'primary-image') ?? null;
  const nextNonTextLayers = scaleLayersForCanvas(
    state.layers.filter((layer) => !isTextLayer(layer)),
    state.canvasSize,
    nextCanvasSize,
    primaryImageSlot,
  );
  const defaultState = createDefaultAppState();

  return {
    ...state,
    canvasSize: nextCanvasSize,
    layers: [...nextTextLayers, ...nextNonTextLayers],
    activeLayerId:
      resolveActiveLayerId(template.scene.activeLayerId, nextTextLayers) ??
      nextTextLayers[0]?.id ??
      nextNonTextLayers[0]?.id ??
      null,
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
  primaryImageSlot: MelfTemplateDocument['scene']['imageSlots'][number] | null,
) {
  const scaleX = nextCanvasSize.width / Math.max(1, currentCanvasSize.width);
  const scaleY = nextCanvasSize.height / Math.max(1, currentCanvasSize.height);
  let appliedPrimaryImageSlot = false;

  return layers.map((layer) => {
    if (isImageLayer(layer)) {
      if (primaryImageSlot && !appliedPrimaryImageSlot) {
        appliedPrimaryImageSlot = true;

        return {
          ...layer,
          box: { ...primaryImageSlot.box },
          sourceSize: { ...layer.sourceSize },
          skew: { ...layer.skew },
        };
      }

      const scaledBox = {
        ...layer.box,
        x: Math.round(layer.box.x * scaleX),
        y: Math.round(layer.box.y * scaleY),
        width: Math.round(layer.box.width * scaleX),
        height: Math.round(layer.box.height * scaleY),
      };

      return {
        ...layer,
        box: scaledBox,
        sourceSize: { ...layer.sourceSize },
        skew: { ...layer.skew },
      };
    }

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

    return {
      ...layer,
      box: scaledBox,
    };
  });
}

function materializeTextLayerFromSlot(slot: MelfTextSlot): TextLayer {
  const layer = createTextLayer(slot.id, slot.name, slot.box.y, slot.verticalAlign);

  return {
    ...layer,
    box: {
      ...slot.box,
    },
    fontFamily: slot.fontFamily,
    fontSize: slot.fontSize,
    fillStyle: slot.fillStyle,
    strokeStyle: slot.strokeStyle,
    outlineWidth: slot.outlineWidth,
    textAlign: slot.textAlign,
    verticalAlign: slot.verticalAlign,
    effect: slot.effect,
    allCaps: slot.allCaps,
    bold: slot.bold,
    italic: slot.italic,
    opacity: slot.opacity,
  };
}

function findMatchingCurrentTextLayer(
  slot: MelfTextSlot,
  currentTextLayers: TextLayer[],
  index: number,
): TextLayer | null {
  const semanticMatch = currentTextLayers.find((layer) => matchesSlotSemantics(slot, layer));
  if (semanticMatch) {
    return semanticMatch;
  }

  return currentTextLayers[index] ?? null;
}

function matchesSlotSemantics(slot: MelfTextSlot, layer: TextLayer) {
  if (slot.id === layer.id) {
    return true;
  }

  if (slot.role === 'top-caption' && layer.id === 'top') {
    return true;
  }

  if (slot.role === 'bottom-caption' && layer.id === 'bottom') {
    return true;
  }

  return false;
}

function resolveActiveLayerId(activeSlotId: string | null, nextTextLayers: TextLayer[]) {
  if (typeof activeSlotId === 'string' && nextTextLayers.some((layer) => layer.id === activeSlotId)) {
    return activeSlotId;
  }

  return null;
}

function cloneTextLayer(layer: TextLayer): TextLayer {
  return {
    ...layer,
    box: {
      ...layer.box,
    },
  };
}

function preserveTextContent(
  nextLayer: TextLayer,
  currentLayer: TextLayer | null,
  defaultText: string | undefined,
): TextLayer {
  if (!currentLayer) {
    return {
      ...nextLayer,
      text: defaultText ?? nextLayer.text,
    };
  }

  return {
    ...nextLayer,
    text: currentLayer.text.trim().length > 0 ? currentLayer.text : defaultText ?? currentLayer.text,
  };
}
