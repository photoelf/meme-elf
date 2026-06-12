import { useMemo, useState, type ReactNode } from 'react';

import { isImageLayer, isTextLayer } from '../../app/types';
import type {
  EditorLayer,
  LayerId,
  SceneCropDraftRect,
  SceneBoundsFillMode,
  SceneExpandDraft,
  TextEffect,
  TextLayer,
  TextAlign,
  VerticalAlign,
} from '../../app/types';
import { SCENE_BOUNDS_FILL_MODE_OPTIONS } from '../../app/types';

const FONT_OPTIONS = ['Impact', 'Arial Black', 'Helvetica', 'Trebuchet MS'];

type ControlPanelProps = {
  activeTool: 'pointer' | 'image';
  activeSceneBoundsMode: 'idle' | 'crop' | 'expand';
  activeLayerId: LayerId | null;
  isImportModalOpen: boolean;
  layers: EditorLayer[];
  sceneCropDraft: SceneCropDraftRect | null;
  sceneBoundsFillColor: string;
  sceneBoundsFillMode: SceneBoundsFillMode;
  sceneExpandDraft: SceneExpandDraft;
  onOpenAdvancedImportClipboard: (opener: HTMLButtonElement) => void;
  onOpenAdvancedImportFile: (opener: HTMLButtonElement) => void;
  onBackgroundPointerDown: () => void;
  onApplySceneCrop: () => void;
  onApplySceneExpand: () => void;
  onActiveLayerChange: (layerId: LayerId) => void;
  onCancelSceneBounds: () => void;
  onClearActiveLayer: () => void;
  onAddLayer: () => void;
  onApplySettingsToAllLayers: (layerId: LayerId) => void;
  onSceneBoundsFillColorChange: (value: string) => void;
  onSceneBoundsFillModeChange: (value: SceneBoundsFillMode) => void;
  onSceneBoundsPreset: (
    preset: 'equal-margin' | 'top-caption' | 'bottom-caption' | 'square-canvas',
  ) => void;
  onTextEditSessionEnd: () => void;
  onTextEditSessionStart: () => void;
  onSceneExpandDraftChange: (
    side: keyof SceneExpandDraft,
    value: number,
  ) => void;
  onStartSceneCrop: () => void;
  onTextLayerChange: (
    layerId: LayerId,
    updates: Partial<TextLayer>,
    historyMode?: 'immediate' | 'defer',
  ) => void;
  onRotateImageLayer: (layerId: LayerId, direction: 'clockwise' | 'counter-clockwise') => void;
  onFlipImageLayerHorizontal: (layerId: LayerId) => void;
  onFlipImageLayerVertical: (layerId: LayerId) => void;
  onReorderLayers: (
    sourceLayerId: LayerId,
    targetLayerId: LayerId,
    placement: 'before' | 'after',
  ) => void;
  onRemoveLayer: (layerId: LayerId) => void;
};

export function ControlPanel({
  activeTool,
  activeSceneBoundsMode,
  activeLayerId,
  isImportModalOpen,
  layers,
  sceneCropDraft,
  sceneBoundsFillColor,
  sceneBoundsFillMode,
  sceneExpandDraft,
  onOpenAdvancedImportClipboard,
  onOpenAdvancedImportFile,
  onBackgroundPointerDown,
  onApplySceneCrop,
  onApplySceneExpand,
  onActiveLayerChange,
  onCancelSceneBounds,
  onClearActiveLayer,
  onAddLayer,
  onApplySettingsToAllLayers,
  onSceneBoundsFillColorChange,
  onSceneBoundsFillModeChange,
  onSceneBoundsPreset,
  onTextEditSessionEnd,
  onTextEditSessionStart,
  onSceneExpandDraftChange,
  onStartSceneCrop,
  onTextLayerChange,
  onRotateImageLayer,
  onFlipImageLayerHorizontal,
  onFlipImageLayerVertical,
  onReorderLayers,
  onRemoveLayer,
}: ControlPanelProps) {
  const [openSettingsLayerIds, setOpenSettingsLayerIds] = useState<LayerId[]>([]);
  const [draggingLayerId, setDraggingLayerId] = useState<LayerId | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{
    layerId: LayerId;
    placement: 'before' | 'after';
  } | null>(null);

  const resolvedOpenLayerIds = useMemo(
    () => openSettingsLayerIds.filter((layerId) => layers.some((layer) => layer.id === layerId)),
    [layers, openSettingsLayerIds],
  );
  const hasPendingSceneExpand =
    sceneExpandDraft.left !== 0 ||
    sceneExpandDraft.right !== 0 ||
    sceneExpandDraft.top !== 0 ||
    sceneExpandDraft.bottom !== 0;

  return (
    <aside
      className="inspector"
      aria-label="Controls"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          onBackgroundPointerDown();
        }
      }}
    >
      {activeTool === 'image' ? (
        <>
          <div className="inspector-section">
            <div className="section-heading">
              <h2 className="section-title">IMAGE</h2>
              <p className="section-copy">Advanced import</p>
            </div>
            <div className="settings-actions">
              <button
                type="button"
                className="mini-action-button image-import-button"
                disabled={isImportModalOpen}
                onClick={(event) => onOpenAdvancedImportFile(event.currentTarget)}
              >
                Advanced import from file
              </button>
              <button
                type="button"
                className="mini-action-button image-import-button"
                disabled={isImportModalOpen}
                onClick={(event) => onOpenAdvancedImportClipboard(event.currentTarget)}
              >
                Advanced import from clipboard
              </button>
            </div>
          </div>

          <div className="inspector-section">
            <div className="section-heading">
              <h2 className="section-title">BOUNDS</h2>
              <p className="section-copy">Scene crop and expand</p>
            </div>
            <div className="settings-actions bounds-actions">
              <button
                type="button"
                className={`mini-action-button${activeSceneBoundsMode === 'crop' ? ' settings-button-active' : ''}`}
                onClick={onStartSceneCrop}
              >
                Crop scene
              </button>
              {activeSceneBoundsMode === 'crop' ? (
                <>
                  <button
                    type="button"
                    className="mini-action-button"
                    disabled={!sceneCropDraft}
                    onClick={onApplySceneCrop}
                  >
                    Apply crop
                  </button>
                  <button
                    type="button"
                    className="mini-action-button"
                    onClick={onCancelSceneBounds}
                  >
                    Cancel
                  </button>
                </>
              ) : null}
            </div>
            <div className="control-grid control-grid-compact bounds-grid">
              <div className="field-stack">
                <label className="field-label" htmlFor="scene-expand-left">
                  Expand left
                </label>
                <input
                  id="scene-expand-left"
                  className="number-input"
                  type="number"
                  step={1}
                  value={sceneExpandDraft.left}
                  onChange={(event) =>
                    onSceneExpandDraftChange('left', Number(event.target.value))
                  }
                />
              </div>
              <div className="field-stack">
                <label className="field-label" htmlFor="scene-expand-right">
                  Expand right
                </label>
                <input
                  id="scene-expand-right"
                  className="number-input"
                  type="number"
                  step={1}
                  value={sceneExpandDraft.right}
                  onChange={(event) =>
                    onSceneExpandDraftChange('right', Number(event.target.value))
                  }
                />
              </div>
              <div className="field-stack">
                <label className="field-label" htmlFor="scene-expand-top">
                  Expand top
                </label>
                <input
                  id="scene-expand-top"
                  className="number-input"
                  type="number"
                  step={1}
                  value={sceneExpandDraft.top}
                  onChange={(event) =>
                    onSceneExpandDraftChange('top', Number(event.target.value))
                  }
                />
              </div>
              <div className="field-stack">
                <label className="field-label" htmlFor="scene-expand-bottom">
                  Expand bottom
                </label>
                <input
                  id="scene-expand-bottom"
                  className="number-input"
                  type="number"
                  step={1}
                  value={sceneExpandDraft.bottom}
                  onChange={(event) =>
                    onSceneExpandDraftChange('bottom', Number(event.target.value))
                  }
                />
              </div>
            </div>
            <div className="control-grid control-grid-compact bounds-grid">
              <div className="field-stack">
                <label className="field-label" htmlFor="scene-bounds-fill-mode">
                  Fill mode
                </label>
                <select
                  id="scene-bounds-fill-mode"
                  className="select-input"
                  value={sceneBoundsFillMode}
                  onChange={(event) =>
                    onSceneBoundsFillModeChange(event.target.value as SceneBoundsFillMode)
                  }
                >
                  {SCENE_BOUNDS_FILL_MODE_OPTIONS.map((fillMode) => (
                    <option key={fillMode} value={fillMode}>
                      {fillMode}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field-stack">
                <label className="field-label" htmlFor="scene-bounds-fill-color">
                  Fill color
                </label>
                <input
                  id="scene-bounds-fill-color"
                  className="layer-swatch bounds-fill-swatch"
                  type="color"
                  value={sceneBoundsFillColor}
                  onChange={(event) => onSceneBoundsFillColorChange(event.target.value)}
                />
              </div>
            </div>
            <div className="settings-actions bounds-actions">
              <button
                type="button"
                className="mini-action-button"
                onClick={() => onSceneBoundsPreset('equal-margin')}
              >
                Add margin equally
              </button>
              <button
                type="button"
                className="mini-action-button"
                onClick={() => onSceneBoundsPreset('top-caption')}
              >
                Add top caption space
              </button>
              <button
                type="button"
                className="mini-action-button"
                onClick={() => onSceneBoundsPreset('bottom-caption')}
              >
                Add bottom caption space
              </button>
              <button
                type="button"
                className="mini-action-button"
                onClick={() => onSceneBoundsPreset('square-canvas')}
              >
                Square canvas
              </button>
            </div>
            {activeSceneBoundsMode === 'expand' ? (
              <div className="settings-actions bounds-actions">
                <button
                  type="button"
                  className="mini-action-button"
                  disabled={!hasPendingSceneExpand}
                  onClick={onApplySceneExpand}
                >
                  Apply bounds
                </button>
                <button
                  type="button"
                  className="mini-action-button"
                  onClick={onCancelSceneBounds}
                >
                  Cancel
                </button>
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      <div className="inspector-section">
        <div className="section-heading">
          <h2 className="section-title">LAYERS</h2>
          <button type="button" className="mini-action-button" onClick={onAddLayer}>
            Add text
          </button>
        </div>

        <div className="layer-stack">
          {layers.map((layer, index) => {
            const isSettingsOpen = resolvedOpenLayerIds.includes(layer.id);

            return (
              <div
                key={layer.id}
                className={`layer-card${layer.id === activeLayerId ? ' layer-card-active' : ''}${
                  draggingLayerId === layer.id ? ' layer-card-dragging' : ''
                }${
                  dropIndicator?.layerId === layer.id
                    ? dropIndicator.placement === 'before'
                      ? ' layer-card-drop-before'
                      : ' layer-card-drop-after'
                    : ''
                }`}
                onDragOver={(event) => {
                  event.preventDefault();
                  const bounds = event.currentTarget.getBoundingClientRect();
                  const placement =
                    event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';

                  setDropIndicator({ layerId: layer.id, placement });
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const bounds = event.currentTarget.getBoundingClientRect();
                  const placement =
                    event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
                  const draggedLayerId =
                    draggingLayerId ?? event.dataTransfer.getData('application/x-meme-elf-layer-id');

                  if (!draggedLayerId || draggedLayerId === layer.id) {
                    setDropIndicator(null);
                    return;
                  }

                  onReorderLayers(draggedLayerId, layer.id, placement);
                  setDraggingLayerId(null);
                  setDropIndicator(null);
                }}
                onDragLeave={(event) => {
                  const nextTarget = event.relatedTarget;

                  if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
                    return;
                  }

                  setDropIndicator((currentIndicator) =>
                    currentIndicator?.layerId === layer.id ? null : currentIndicator,
                  );
                }}
              >
                {isTextLayer(layer) ? (
                  <div className="layer-row">
                    <textarea
                      id={`${layer.id}-text-input`}
                      className="layer-row-input"
                      aria-label={layer.name}
                      rows={2}
                      value={layer.text}
                      onFocus={() => {
                        onActiveLayerChange(layer.id);
                        onTextEditSessionStart();
                      }}
                      onBlur={onTextEditSessionEnd}
                      onChange={(event) => onTextLayerChange(layer.id, { text: event.target.value }, 'defer')}
                      placeholder={`TEXT ${index + 1}`}
                    />
                    <LayerRowActions
                      isSettingsOpen={isSettingsOpen}
                      layer={layer}
                      onDragStateChange={(isDragging) => {
                        if (!isDragging) {
                          setDraggingLayerId(null);
                          setDropIndicator(null);
                          return;
                        }

                        setDraggingLayerId(layer.id);
                        setDropIndicator(null);
                      }}
                      onSettingsClick={() => {
                        onActiveLayerChange(layer.id);
                        setOpenSettingsLayerIds((currentLayerIds) =>
                          currentLayerIds.includes(layer.id)
                            ? currentLayerIds.filter((currentLayerId) => currentLayerId !== layer.id)
                            : [...currentLayerIds, layer.id],
                        );
                      }}
                    >
                      <input
                        className="layer-swatch"
                        type="color"
                        tabIndex={-1}
                        value={layer.fillStyle}
                        onChange={(event) =>
                          onTextLayerChange(layer.id, { fillStyle: event.target.value }, 'immediate')
                        }
                      />
                      <input
                        className="layer-swatch"
                        type="color"
                        tabIndex={-1}
                        value={layer.strokeStyle}
                        onChange={(event) =>
                          onTextLayerChange(layer.id, { strokeStyle: event.target.value }, 'immediate')
                        }
                      />
                    </LayerRowActions>
                  </div>
                ) : (
                  <div className="layer-row layer-row-image">
                    <button
                      type="button"
                      className="image-layer-button"
                      aria-label={`${layer.name} layer`}
                      aria-pressed={layer.id === activeLayerId}
                      onClick={() => onActiveLayerChange(layer.id)}
                    >
                      <span className="image-layer-thumb" aria-hidden="true">
                        PNG
                      </span>
                      <span className="image-layer-copy">
                        <span className="image-layer-name">{layer.name}</span>
                        <span className="image-layer-meta">
                          {layer.sourceSize.width} x {layer.sourceSize.height}
                        </span>
                      </span>
                    </button>
                    <LayerRowActions
                      isSettingsOpen={isSettingsOpen}
                      layer={layer}
                      onDragStateChange={(isDragging) => {
                        if (!isDragging) {
                          setDraggingLayerId(null);
                          setDropIndicator(null);
                          return;
                        }

                        setDraggingLayerId(layer.id);
                        setDropIndicator(null);
                      }}
                      onSettingsClick={() => {
                        onActiveLayerChange(layer.id);
                        setOpenSettingsLayerIds((currentLayerIds) =>
                          currentLayerIds.includes(layer.id)
                            ? currentLayerIds.filter((currentLayerId) => currentLayerId !== layer.id)
                            : [...currentLayerIds, layer.id],
                        );
                      }}
                    />
                  </div>
                )}

                {isSettingsOpen ? (
                  <div className="settings-popover">
                    {isTextLayer(layer) ? (
                      <LayerSettings
                        layer={layer}
                        layerCount={layers.filter(isTextLayer).length}
                        onApplySettingsToAllLayers={onApplySettingsToAllLayers}
                        onTextLayerChange={onTextLayerChange}
                        onRemoveLayer={onRemoveLayer}
                      />
                    ) : (
                      <ImageLayerSettings
                        layer={layer}
                        layerCount={layers.length}
                        onFlipHorizontal={onFlipImageLayerHorizontal}
                        onFlipVertical={onFlipImageLayerVertical}
                        onRemoveLayer={onRemoveLayer}
                        onRotate={onRotateImageLayer}
                      />
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

type LayerRowActionsProps = {
  children?: ReactNode;
  isSettingsOpen: boolean;
  layer: EditorLayer;
  onDragStateChange: (isDragging: boolean) => void;
  onSettingsClick: () => void;
};

function LayerRowActions({
  children,
  isSettingsOpen,
  layer,
  onDragStateChange,
  onSettingsClick,
}: LayerRowActionsProps) {
  return (
    <div className="layer-row-swatches">
      {children}
      <button
        type="button"
        className={`settings-button${isSettingsOpen ? ' settings-button-active' : ''}`}
        aria-label={`Settings for ${layer.name}`}
        onClick={onSettingsClick}
      >
        ⚙
      </button>
      <button
        type="button"
        className="layer-order-handle"
        draggable
        aria-label={`Reorder ${layer.name}`}
        onDragStart={(event) => {
          onDragStateChange(true);
          event.dataTransfer.setData('application/x-meme-elf-layer-id', layer.id);
          const row = event.currentTarget.closest('.layer-row');

          if (row instanceof HTMLElement) {
            const rowRect = row.getBoundingClientRect();
            const handleRect = event.currentTarget.getBoundingClientRect();
            const offsetX = handleRect.left - rowRect.left + handleRect.width / 2;
            const offsetY = handleRect.top - rowRect.top + handleRect.height / 2;
            event.dataTransfer.setDragImage(row, offsetX, offsetY);
          }
        }}
        onDragEnd={() => onDragStateChange(false)}
      >
        ⋮⋮
      </button>
    </div>
  );
}

type LayerSettingsProps = {
  layer: TextLayer;
  layerCount: number;
  onApplySettingsToAllLayers: (layerId: LayerId) => void;
  onTextLayerChange: (
    layerId: LayerId,
    updates: Partial<TextLayer>,
    historyMode?: 'immediate' | 'defer',
  ) => void;
  onRemoveLayer: (layerId: LayerId) => void;
};

function LayerSettings({
  layer,
  layerCount,
  onApplySettingsToAllLayers,
  onTextLayerChange,
  onRemoveLayer,
}: LayerSettingsProps) {
  return (
    <div className="settings-grid">
      <div className="control-grid control-grid-compact">
        <div className="field-stack">
          <label className="field-label" htmlFor={`font-family-${layer.id}`}>
            Font
          </label>
          <select
            id={`font-family-${layer.id}`}
            className="select-input"
            value={layer.fontFamily}
            onChange={(event) => onTextLayerChange(layer.id, { fontFamily: event.target.value }, 'immediate')}
          >
            {FONT_OPTIONS.map((fontOption) => (
              <option key={fontOption} value={fontOption}>
                {fontOption}
              </option>
            ))}
          </select>
        </div>

        <div className="field-stack">
          <label className="field-label" htmlFor={`font-size-${layer.id}`}>
            Max Font Size (px)
          </label>
          <input
            id={`font-size-${layer.id}`}
            className="number-input"
            type="number"
            step={1}
            value={layer.fontSize}
            onChange={(event) =>
              onTextLayerChange(layer.id, {
                fontSize: Number(event.target.value),
              }, 'immediate')
            }
          />
        </div>
      </div>

      <div className="toggle-row">
        <CheckToggle
          checked={layer.allCaps}
          label="ALL CAPS"
          onChange={(checked) => onTextLayerChange(layer.id, { allCaps: checked }, 'immediate')}
        />
        <CheckToggle
          checked={layer.bold}
          label="Bold"
          onChange={(checked) => onTextLayerChange(layer.id, { bold: checked }, 'immediate')}
        />
        <CheckToggle
          checked={layer.italic}
          label="Italic"
          onChange={(checked) => onTextLayerChange(layer.id, { italic: checked }, 'immediate')}
        />
      </div>

      <div className="field-stack">
        <span className="field-label">Effect</span>
        <div className="radio-row">
          <EffectOption
            checked={layer.effect === 'shadow'}
            label="Shadow"
            name={`effect-${layer.id}`}
            value="shadow"
            onChange={(value) => onTextLayerChange(layer.id, { effect: value }, 'immediate')}
          />
          <EffectOption
            checked={layer.effect === 'outline'}
            label="Outline"
            name={`effect-${layer.id}`}
            value="outline"
            onChange={(value) => onTextLayerChange(layer.id, { effect: value }, 'immediate')}
          />
          <EffectOption
            checked={layer.effect === 'none'}
            label="None"
            name={`effect-${layer.id}`}
            value="none"
            onChange={(value) => onTextLayerChange(layer.id, { effect: value }, 'immediate')}
          />
        </div>
      </div>

      <div className="control-grid control-grid-compact">
        <div className="field-stack">
          <label className="field-label" htmlFor={`outline-width-${layer.id}`}>
            Outline Width
          </label>
          <input
            id={`outline-width-${layer.id}`}
            className="number-input"
            type="number"
            step={1}
            value={layer.outlineWidth}
            onChange={(event) =>
              onTextLayerChange(layer.id, {
                outlineWidth: Number(event.target.value),
              }, 'immediate')
            }
          />
        </div>

        <div className="field-stack">
          <label className="field-label" htmlFor={`opacity-${layer.id}`}>
            Opacity
          </label>
          <input
            id={`opacity-${layer.id}`}
            className="number-input"
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={layer.opacity}
            onChange={(event) =>
              onTextLayerChange(layer.id, {
                opacity: Number(event.target.value),
              }, 'immediate')
            }
          />
        </div>
      </div>

      <div className="control-grid control-grid-compact">
        <div className="field-stack">
          <label className="field-label" htmlFor={`text-align-${layer.id}`}>
            Text Align
          </label>
          <select
            id={`text-align-${layer.id}`}
            className="select-input"
            value={layer.textAlign}
            onChange={(event) =>
              onTextLayerChange(layer.id, { textAlign: event.target.value as TextAlign }, 'immediate')
            }
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>

        <div className="field-stack">
          <label className="field-label" htmlFor={`vertical-align-${layer.id}`}>
            Vertical Align
          </label>
          <select
            id={`vertical-align-${layer.id}`}
            className="select-input"
            value={layer.verticalAlign}
            onChange={(event) =>
              onTextLayerChange(layer.id, {
                verticalAlign: event.target.value as VerticalAlign,
              }, 'immediate')
            }
          >
            <option value="top">Top</option>
            <option value="middle">Middle</option>
            <option value="bottom">Bottom</option>
          </select>
        </div>
      </div>

      <div className="settings-actions">
        <button
          type="button"
          className="apply-all-button"
          onClick={() => onApplySettingsToAllLayers(layer.id)}
        >
          Apply to all layers
        </button>
        <button
          type="button"
          className="apply-all-button remove-layer-button"
          disabled={layerCount <= 1}
          onClick={() => onRemoveLayer(layer.id)}
        >
          Remove layer
        </button>
      </div>
    </div>
  );
}

function ImageLayerSettings({
  layer,
  layerCount,
  onFlipHorizontal,
  onFlipVertical,
  onRemoveLayer,
  onRotate,
}: {
  layer: EditorLayer;
  layerCount: number;
  onFlipHorizontal: (layerId: LayerId) => void;
  onFlipVertical: (layerId: LayerId) => void;
  onRemoveLayer: (layerId: LayerId) => void;
  onRotate: (layerId: LayerId, direction: 'clockwise' | 'counter-clockwise') => void;
}) {
  if (!isImageLayer(layer)) {
    return null;
  }

  return (
    <div className="image-layer-settings">
      <p className="section-copy">Transparency is preserved. Move and scale on the canvas, or drag in LAYERS to change stacking.</p>
      <div className="settings-actions">
        <button type="button" className="apply-all-button" onClick={() => onRotate(layer.id, 'clockwise')}>
          Rotate 90 clockwise
        </button>
        <button type="button" className="apply-all-button" onClick={() => onFlipHorizontal(layer.id)}>
          Flip horizontal
        </button>
        <button type="button" className="apply-all-button" onClick={() => onFlipVertical(layer.id)}>
          Flip vertical
        </button>
        <button
          type="button"
          className="apply-all-button remove-layer-button"
          disabled={layerCount <= 1}
          onClick={() => onRemoveLayer(layer.id)}
        >
          Remove layer
        </button>
      </div>
    </div>
  );
}

type CheckToggleProps = {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
};

function CheckToggle({ checked, label, onChange }: CheckToggleProps) {
  return (
    <label className="check-toggle">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

type EffectOptionProps = {
  checked: boolean;
  label: string;
  name: string;
  onChange: (value: TextEffect) => void;
  value: TextEffect;
};

function EffectOption({ checked, label, name, onChange, value }: EffectOptionProps) {
  return (
    <label className="radio-toggle">
      <input type="radio" name={name} checked={checked} onChange={() => onChange(value)} />
      <span>{label}</span>
    </label>
  );
}
