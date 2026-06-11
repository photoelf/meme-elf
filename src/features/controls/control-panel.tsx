import { useMemo, useState, type ReactNode } from 'react';

import { isImageLayer, isTextLayer } from '../../app/types';
import type {
  EditorLayer,
  LayerId,
  TextEffect,
  TextLayer,
  TextAlign,
  VerticalAlign,
} from '../../app/types';

const FONT_OPTIONS = ['Impact', 'Arial Black', 'Helvetica', 'Trebuchet MS'];

type ControlPanelProps = {
  activeTool: 'pointer' | 'image';
  activeLayerId: LayerId | null;
  isImportModalOpen: boolean;
  layers: EditorLayer[];
  onOpenAdvancedImportClipboard: (opener: HTMLButtonElement) => void;
  onOpenAdvancedImportFile: (opener: HTMLButtonElement) => void;
  onBackgroundPointerDown: () => void;
  onActiveLayerChange: (layerId: LayerId) => void;
  onClearActiveLayer: () => void;
  onAddLayer: () => void;
  onApplySettingsToAllLayers: (layerId: LayerId) => void;
  onTextLayerChange: (layerId: LayerId, updates: Partial<TextLayer>) => void;
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
  activeLayerId,
  isImportModalOpen,
  layers,
  onOpenAdvancedImportClipboard,
  onOpenAdvancedImportFile,
  onBackgroundPointerDown,
  onActiveLayerChange,
  onClearActiveLayer,
  onAddLayer,
  onApplySettingsToAllLayers,
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
                      onFocus={() => onActiveLayerChange(layer.id)}
                      onChange={(event) => onTextLayerChange(layer.id, { text: event.target.value })}
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
                          onTextLayerChange(layer.id, { fillStyle: event.target.value })
                        }
                      />
                      <input
                        className="layer-swatch"
                        type="color"
                        tabIndex={-1}
                        value={layer.strokeStyle}
                        onChange={(event) =>
                          onTextLayerChange(layer.id, { strokeStyle: event.target.value })
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
  onTextLayerChange: (layerId: LayerId, updates: Partial<TextLayer>) => void;
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
            onChange={(event) => onTextLayerChange(layer.id, { fontFamily: event.target.value })}
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
              })
            }
          />
        </div>
      </div>

      <div className="toggle-row">
        <CheckToggle
          checked={layer.allCaps}
          label="ALL CAPS"
          onChange={(checked) => onTextLayerChange(layer.id, { allCaps: checked })}
        />
        <CheckToggle
          checked={layer.bold}
          label="Bold"
          onChange={(checked) => onTextLayerChange(layer.id, { bold: checked })}
        />
        <CheckToggle
          checked={layer.italic}
          label="Italic"
          onChange={(checked) => onTextLayerChange(layer.id, { italic: checked })}
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
            onChange={(value) => onTextLayerChange(layer.id, { effect: value })}
          />
          <EffectOption
            checked={layer.effect === 'outline'}
            label="Outline"
            name={`effect-${layer.id}`}
            value="outline"
            onChange={(value) => onTextLayerChange(layer.id, { effect: value })}
          />
          <EffectOption
            checked={layer.effect === 'none'}
            label="None"
            name={`effect-${layer.id}`}
            value="none"
            onChange={(value) => onTextLayerChange(layer.id, { effect: value })}
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
              })
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
              })
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
              onTextLayerChange(layer.id, { textAlign: event.target.value as TextAlign })
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
              })
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
