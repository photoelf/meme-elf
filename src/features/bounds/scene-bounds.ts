import type { EditorLayer, SceneExpandDraft } from '../../app/types';

export function applySceneCrop(input: {
  canvasSize: { width: number; height: number };
  cropRect: { x: number; y: number; width: number; height: number };
  layers: EditorLayer[];
}) {
  const nextLayers = input.layers
    .filter((layer) => intersectsRect(layer.box, input.cropRect))
    .map((layer) => ({
      ...layer,
      box: {
        ...layer.box,
        x: layer.box.x - input.cropRect.x,
        y: layer.box.y - input.cropRect.y,
      },
    }));

  return {
    canvasSize: {
      width: input.cropRect.width,
      height: input.cropRect.height,
    },
    layers: nextLayers,
  };
}

export function applySceneExpand(input: {
  canvasSize: { width: number; height: number };
  expand: SceneExpandDraft;
  layers: EditorLayer[];
}) {
  const expand = normalizeExpandDraft(input.expand);
  const contentOffset = {
    x: expand.left,
    y: expand.top,
  };

  return {
    canvasSize: {
      width: input.canvasSize.width + expand.left + expand.right,
      height: input.canvasSize.height + expand.top + expand.bottom,
    },
    contentOffset,
    layers: input.layers.map((layer) => ({
      ...layer,
      box: {
        ...layer.box,
        x: layer.box.x + contentOffset.x,
        y: layer.box.y + contentOffset.y,
      },
    })),
  };
}

function intersectsRect(
  box: { x: number; y: number; width: number; height: number },
  rect: { x: number; y: number; width: number; height: number },
) {
  return (
    box.x < rect.x + rect.width &&
    box.x + box.width > rect.x &&
    box.y < rect.y + rect.height &&
    box.y + box.height > rect.y
  );
}

function normalizeExpandDraft(expand: SceneExpandDraft) {
  return {
    left: Math.max(0, expand.left),
    right: Math.max(0, expand.right),
    top: Math.max(0, expand.top),
    bottom: Math.max(0, expand.bottom),
  };
}
