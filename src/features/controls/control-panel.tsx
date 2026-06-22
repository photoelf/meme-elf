import { useMemo, useState, type ReactNode } from 'react';

import { isDrawLayer, isImageLayer, isTextLayer } from '../../app/types';
import type {
  EditorLayer,
  LayerId,
  RasterSelectionTargetId,
  SceneCropDraftRect,
  SceneBoundsFillMode,
  SceneEffectStackItem,
  SceneImageAdjustments,
  SelectionRect,
  SceneWatermark,
  SceneWatermarkCorner,
  SceneWatermarkMode,
  SceneExpandDraft,
  TextEffect,
  TextLayer,
  TextAlign,
  VerticalAlign,
} from '../../app/types';
import { SCENE_BOUNDS_FILL_MODE_OPTIONS } from '../../app/types';
import type { SceneImageStackTransform } from '../image/scene-image-stack-utils';
import { describeSceneWatermarkPreview } from '../image/watermark-utils';
import type { MelfTemplateDocument } from '../templates/melf-template';
import {
  handleTooltipTouchClick,
  handleTooltipTouchFocus,
  handleTooltipTouchPointerDown,
  handleTooltipTouchStart,
} from './tooltip-touch-focus';

const FONT_OPTIONS = ['Impact', 'Arial Black', 'Helvetica', 'Trebuchet MS'];

type ControlPanelProps = {
  activeTab: 'layers' | 'crop' | 'adjustments' | 'draw' | 'effects' | 'watermark' | 'experimental';
  activeSceneBoundsMode: 'idle' | 'crop' | 'expand';
  activeLayerId: LayerId | null;
  shellMode: 'desktop' | 'small-tablet' | 'phone';
  isImportModalOpen: boolean;
  layers: EditorLayer[];
  showLocalOnlyTabs: boolean;
  retouchMode: 'idle' | 'draw' | 'erase' | 'eyedropper' | 'select' | 'clone-stamp';
  retouchBrush: {
    color: string;
    size: number;
    opacity: number;
    softEdge: boolean;
  };
  cloneStampSourcePoint: { x: number; y: number } | null;
  cloneStampSourceTargetId: RasterSelectionTargetId | null;
  selectionTargetId: RasterSelectionTargetId | null;
  selectionRect: SelectionRect | null;
  selectionDraftRect: SelectionRect | null;
  sceneCropDraft: SceneCropDraftRect | null;
  sceneBoundsFillColor: string;
  sceneBoundsFillMode: SceneBoundsFillMode;
  sceneImageAdjustments: SceneImageAdjustments;
  sceneEffectStack: SceneEffectStackItem[];
  sceneWatermark: SceneWatermark;
  sceneExpandDraft: SceneExpandDraft;
  templatePresets: readonly MelfTemplateDocument[];
  onOpenAdvancedImportClipboard: (opener: HTMLButtonElement) => void;
  onOpenAdvancedImportFile: (opener: HTMLButtonElement) => void;
  onOpenAdvancedImportUrl: (opener: HTMLButtonElement) => void;
  onBackgroundPointerDown: () => void;
  onInterfacePointerDown: () => void;
  onApplySceneCrop: () => void;
  onApplySceneExpand: () => void;
  onActiveLayerChange: (layerId: LayerId) => void;
  onActiveTabChange: (tab: 'layers' | 'crop' | 'adjustments' | 'draw' | 'effects' | 'watermark' | 'experimental') => void;
  onCancelSceneBounds: () => void;
  onClearActiveLayer: () => void;
  onAddLayer: () => void;
  onCreateDrawLayer: () => void;
  onApplySettingsToAllLayers: (layerId: LayerId) => void;
  onSceneBoundsFillColorChange: (value: string) => void;
  onSceneBoundsFillModeChange: (value: SceneBoundsFillMode) => void;
  onSceneImageAdjustmentsChange: (updates: Partial<SceneImageAdjustments>) => void;
  onResetSceneImageAdjustments: () => void;
  onSceneEffectValueChange: (effectId: string, value: number) => void;
  onReorderSceneEffects: (
    sourceEffectId: string,
    targetEffectId: string,
    placement: 'before' | 'after',
  ) => void;
  onResetSceneEffectStack: () => void;
  onSceneWatermarkChange: (updates: Partial<SceneWatermark>) => void;
  onResetSceneWatermark: () => void;
  onSceneBoundsPreset: (
    preset: 'equal-margin' | 'top-caption' | 'bottom-caption' | 'square-canvas',
  ) => void;
  onSceneImageStackTransform: (transform: SceneImageStackTransform) => void;
  onTextEditSessionEnd: () => void;
  onTextEditSessionStart: () => void;
  onSceneExpandDraftChange: (
    side: keyof SceneExpandDraft,
    value: number,
  ) => void;
  onApplyTemplatePreset: (templateId: string) => void;
  onStartSceneCrop: () => void;
  onTextLayerChange: (
    layerId: LayerId,
    updates: Partial<TextLayer>,
    historyMode?: 'immediate' | 'defer',
  ) => void;
  onRotateImageLayer: (layerId: LayerId, direction: 'clockwise' | 'counter-clockwise') => void;
  onRetouchModeChange: (mode: 'idle' | 'draw' | 'erase' | 'eyedropper' | 'select' | 'clone-stamp') => void;
  onRetouchBrushChange: (updates: {
    color?: string;
    size?: number;
    opacity?: number;
    softEdge?: boolean;
  }) => void;
  onApplySelection: () => void;
  onCancelSelection: () => void;
  onCopySelectionToLayer: () => void;
  onCutSelectionToLayer: () => void;
  onDuplicateLayer: (layerId: LayerId) => void;
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
  activeTab,
  activeSceneBoundsMode,
  activeLayerId,
  shellMode,
  isImportModalOpen,
  layers,
  showLocalOnlyTabs,
  retouchMode,
  retouchBrush,
  cloneStampSourcePoint,
  cloneStampSourceTargetId,
  selectionTargetId,
  selectionRect,
  selectionDraftRect,
  sceneCropDraft,
  sceneBoundsFillColor,
  sceneBoundsFillMode,
  sceneImageAdjustments,
  sceneEffectStack,
  sceneWatermark,
  sceneExpandDraft,
  templatePresets,
  onOpenAdvancedImportClipboard,
  onOpenAdvancedImportFile,
  onOpenAdvancedImportUrl,
  onBackgroundPointerDown,
  onInterfacePointerDown,
  onApplySceneCrop,
  onApplySceneExpand,
  onActiveLayerChange,
  onActiveTabChange,
  onCancelSceneBounds,
  onClearActiveLayer,
  onAddLayer,
  onCreateDrawLayer,
  onApplySettingsToAllLayers,
  onSceneBoundsFillColorChange,
  onSceneBoundsFillModeChange,
  onSceneImageAdjustmentsChange,
  onResetSceneImageAdjustments,
  onSceneEffectValueChange,
  onReorderSceneEffects,
  onResetSceneEffectStack,
  onSceneWatermarkChange,
  onResetSceneWatermark,
  onSceneBoundsPreset,
  onSceneImageStackTransform,
  onTextEditSessionEnd,
  onTextEditSessionStart,
  onSceneExpandDraftChange,
  onApplyTemplatePreset,
  onStartSceneCrop,
  onTextLayerChange,
  onRotateImageLayer,
  onRetouchModeChange,
  onRetouchBrushChange,
  onApplySelection,
  onCancelSelection,
  onCopySelectionToLayer,
  onCutSelectionToLayer,
  onDuplicateLayer,
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
  const [draggingEffectId, setDraggingEffectId] = useState<string | null>(null);
  const [effectDropIndicator, setEffectDropIndicator] = useState<{
    effectId: string;
    placement: 'before' | 'after';
  } | null>(null);

  const resolvedOpenLayerIds = useMemo(
    () => openSettingsLayerIds.filter((layerId) => layers.some((layer) => layer.id === layerId)),
    [layers, openSettingsLayerIds],
  );
  const clearRetouchMode = () => {
    if (retouchMode !== 'idle') {
      onRetouchModeChange('idle');
    }
  };
  const hasPendingSceneExpand =
    sceneExpandDraft.left !== 0 ||
    sceneExpandDraft.right !== 0 ||
    sceneExpandDraft.top !== 0 ||
    sceneExpandDraft.bottom !== 0;
  const isCompactMobileCropLayout = shellMode === 'phone';
  const drawLayers = layers.filter(isDrawLayer);
  const watermarkPreviewLabel = describeSceneWatermarkPreview(sceneWatermark);

  return (
    <aside
      className="inspector"
      aria-label="Controls"
      onPointerDownCapture={onInterfacePointerDown}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          clearRetouchMode();
          onBackgroundPointerDown();
        }
      }}
    >
      <div className="tool-rail inspector-rail">
        <div className="tool-rail-tabs" role="tablist" aria-label="Control sections">
          <InspectorTabButton icon={<LayersIcon />} isActive={activeTab === 'layers'} label="Layers" onClick={() => {
            clearRetouchMode();
            onActiveTabChange('layers');
          }} />
          <InspectorTabButton icon={<CropIcon />} isActive={activeTab === 'crop'} label="Crop" onClick={() => {
            clearRetouchMode();
            onActiveTabChange('crop');
          }} />
          <InspectorTabButton icon={<AdjustmentsIcon />} isActive={activeTab === 'adjustments'} label="Adjustments" onClick={() => {
            clearRetouchMode();
            onActiveTabChange('adjustments');
          }} />
          <InspectorTabButton icon={<DrawIcon />} isActive={activeTab === 'draw'} label="Draw" onClick={() => onActiveTabChange('draw')} />
          <InspectorTabButton icon={<EffectsIcon />} isActive={activeTab === 'effects'} label="Effects" onClick={() => {
            clearRetouchMode();
            onActiveTabChange('effects');
          }} />
          <InspectorTabButton icon={<WatermarkIcon />} isActive={activeTab === 'watermark'} label="Watermark" onClick={() => {
            clearRetouchMode();
            onActiveTabChange('watermark');
          }} />
          {showLocalOnlyTabs ? (
            <InspectorTabButton icon={<SparkIcon />} isActive={activeTab === 'experimental'} label="Experimental" onClick={() => onActiveTabChange('experimental')} />
          ) : null}
        </div>
      </div>

      <div className="inspector-card">
        {activeTab === 'layers' ? (
          <div className="inspector-section">
            <div className="section-heading section-heading-stack">
              <div>
                <h2 className="section-title">LAYERS</h2>
              </div>
              <div className="section-action-row">
                <button
                  type="button"
                  className="mini-action-button mini-action-button-icon icon-button-with-tooltip"
                  aria-label="Add text"
                  data-tooltip="Add text"
                  onPointerDown={handleTooltipTouchPointerDown}
                  onTouchStart={handleTooltipTouchStart}
                  onFocus={handleTooltipTouchFocus}
                  onClick={(event) => {
                    handleTooltipTouchClick(event);
                    clearRetouchMode();
                    onAddLayer();
                  }}
                >
                  <LayerAddIcon />
                </button>
                <button
                  type="button"
                  className="mini-action-button mini-action-button-icon image-import-button icon-button-with-tooltip"
                  aria-label="Advanced import from file"
                  data-tooltip="Advanced import from file"
                  disabled={isImportModalOpen}
                  onPointerDown={handleTooltipTouchPointerDown}
                  onTouchStart={handleTooltipTouchStart}
                  onFocus={handleTooltipTouchFocus}
                  onClick={(event) => {
                    handleTooltipTouchClick(event);
                    clearRetouchMode();
                    onOpenAdvancedImportFile(event.currentTarget);
                  }}
                >
                  <UploadImageIcon />
                </button>
                <button
                  type="button"
                  className="mini-action-button mini-action-button-icon image-import-button icon-button-with-tooltip"
                  aria-label="Advanced import from clipboard"
                  data-tooltip="Advanced import from clipboard"
                  disabled={isImportModalOpen}
                  onPointerDown={handleTooltipTouchPointerDown}
                  onTouchStart={handleTooltipTouchStart}
                  onFocus={handleTooltipTouchFocus}
                  onClick={(event) => {
                    handleTooltipTouchClick(event);
                    clearRetouchMode();
                    onOpenAdvancedImportClipboard(event.currentTarget);
                  }}
                >
                  <PasteImageIcon />
                </button>
                <button
                  type="button"
                  className="mini-action-button mini-action-button-icon image-import-button icon-button-with-tooltip"
                  aria-label="Advanced import from URL"
                  data-tooltip="Advanced import from URL"
                  disabled={isImportModalOpen}
                  onPointerDown={handleTooltipTouchPointerDown}
                  onTouchStart={handleTooltipTouchStart}
                  onFocus={handleTooltipTouchFocus}
                  onClick={(event) => {
                    handleTooltipTouchClick(event);
                    clearRetouchMode();
                    onOpenAdvancedImportUrl(event.currentTarget);
                  }}
                >
                  <UrlImageIcon />
                </button>
              </div>
            </div>

            <div className="layer-stack">
              {layers.map((layer, index) => {
                const isSettingsOpen = resolvedOpenLayerIds.includes(layer.id);
                const canMoveEarlier = index > 0;
                const canMoveLater = index < layers.length - 1;

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
                          shellMode={shellMode}
                          onDragStateChange={(isDragging) => {
                            if (!isDragging) {
                              setDraggingLayerId(null);
                              setDropIndicator(null);
                              return;
                            }

                            clearRetouchMode();
                            setDraggingLayerId(layer.id);
                            setDropIndicator(null);
                          }}
                          onSettingsClick={() => {
                            clearRetouchMode();
                            onActiveLayerChange(layer.id);
                            setOpenSettingsLayerIds((currentLayerIds) =>
                              currentLayerIds.includes(layer.id)
                                ? currentLayerIds.filter((currentLayerId) => currentLayerId !== layer.id)
                                : [...currentLayerIds, layer.id],
                            );
                          }}
                          onMoveEarlier={
                            canMoveEarlier
                              ? () => onReorderLayers(layer.id, layers[index - 1]!.id, 'before')
                              : undefined
                          }
                          onMoveLater={
                            canMoveLater
                              ? () => onReorderLayers(layer.id, layers[index + 1]!.id, 'after')
                              : undefined
                          }
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
                    ) : isImageLayer(layer) ? (
                      <div className="layer-row layer-row-image">
                        <button
                          type="button"
                          className="image-layer-button"
                          aria-label={`${layer.name} layer`}
                          aria-pressed={layer.id === activeLayerId}
                          onClick={() => {
                            clearRetouchMode();
                            onActiveLayerChange(layer.id);
                          }}
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
                          shellMode={shellMode}
                          onDragStateChange={(isDragging) => {
                            if (!isDragging) {
                              setDraggingLayerId(null);
                              setDropIndicator(null);
                              return;
                            }

                            clearRetouchMode();
                            setDraggingLayerId(layer.id);
                            setDropIndicator(null);
                          }}
                          onSettingsClick={() => {
                            clearRetouchMode();
                            onActiveLayerChange(layer.id);
                            setOpenSettingsLayerIds((currentLayerIds) =>
                              currentLayerIds.includes(layer.id)
                                ? currentLayerIds.filter((currentLayerId) => currentLayerId !== layer.id)
                                : [...currentLayerIds, layer.id],
                            );
                          }}
                          onMoveEarlier={
                            canMoveEarlier
                              ? () => onReorderLayers(layer.id, layers[index - 1]!.id, 'before')
                              : undefined
                          }
                          onMoveLater={
                            canMoveLater
                              ? () => onReorderLayers(layer.id, layers[index + 1]!.id, 'after')
                              : undefined
                          }
                        />
                      </div>
                    ) : (
                      <div className="layer-row layer-row-image">
                        <button
                          type="button"
                          className="image-layer-button"
                          aria-label={`${layer.name} layer`}
                          aria-pressed={layer.id === activeLayerId}
                          onClick={() => {
                            clearRetouchMode();
                            onActiveLayerChange(layer.id);
                          }}
                        >
                          <span className="image-layer-thumb" aria-hidden="true">
                            DRAW
                          </span>
                          <span className="image-layer-copy">
                            <span className="image-layer-name">{layer.name}</span>
                            <span className="image-layer-meta">
                              {isDrawLayer(layer) ? `${layer.sourceSize.width} x ${layer.sourceSize.height}` : ''}
                            </span>
                          </span>
                        </button>
                        <LayerRowActions
                          isSettingsOpen={isSettingsOpen}
                          layer={layer}
                          shellMode={shellMode}
                          onDragStateChange={(isDragging) => {
                            if (!isDragging) {
                              setDraggingLayerId(null);
                              setDropIndicator(null);
                              return;
                            }

                            clearRetouchMode();
                            setDraggingLayerId(layer.id);
                            setDropIndicator(null);
                          }}
                          onSettingsClick={() => {
                            clearRetouchMode();
                            onActiveLayerChange(layer.id);
                            setOpenSettingsLayerIds((currentLayerIds) =>
                              currentLayerIds.includes(layer.id)
                                ? currentLayerIds.filter((currentLayerId) => currentLayerId !== layer.id)
                                : [...currentLayerIds, layer.id],
                            );
                          }}
                          onMoveEarlier={
                            canMoveEarlier
                              ? () => onReorderLayers(layer.id, layers[index - 1]!.id, 'before')
                              : undefined
                          }
                          onMoveLater={
                            canMoveLater
                              ? () => onReorderLayers(layer.id, layers[index + 1]!.id, 'after')
                              : undefined
                          }
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
                            onDuplicateLayer={onDuplicateLayer}
                            onTextLayerChange={onTextLayerChange}
                            onRemoveLayer={onRemoveLayer}
                          />
                        ) : isImageLayer(layer) ? (
                          <ImageLayerSettings
                            layer={layer}
                            layerCount={layers.length}
                            onDuplicateLayer={onDuplicateLayer}
                            onFlipHorizontal={onFlipImageLayerHorizontal}
                            onFlipVertical={onFlipImageLayerVertical}
                            onRemoveLayer={onRemoveLayer}
                            onRotate={onRotateImageLayer}
                          />
                        ) : (
                          <DrawLayerSettings
                            layer={layer}
                            layerCount={layers.length}
                            onDuplicateLayer={onDuplicateLayer}
                            onRemoveLayer={onRemoveLayer}
                          />
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {activeTab === 'draw' ? (
          <div className="inspector-section">
            <div className="section-heading">
              <h2 className="section-title">DRAW</h2>
            </div>
            <div className="settings-actions bounds-actions">
              <button
                type="button"
                className={`mini-action-button${retouchMode === 'draw' ? ' settings-button-active' : ''}`}
                onClick={() => onRetouchModeChange(retouchMode === 'draw' ? 'idle' : 'draw')}
              >
                Draw
              </button>
              <button type="button" className="mini-action-button" onClick={onCreateDrawLayer}>
                New draw layer
              </button>
              {drawLayers.length > 0 ? (
                <button
                  type="button"
                  className={`mini-action-button${retouchMode === 'erase' ? ' settings-button-active' : ''}`}
                  onClick={() => onRetouchModeChange(retouchMode === 'erase' ? 'idle' : 'erase')}
                >
                  Erase
                </button>
              ) : null}
            </div>
            <div className="control-grid control-grid-compact">
              <div className="field-stack">
                <label className="field-label" htmlFor="retouch-brush-color">
                  Brush color
                </label>
                <input
                  id="retouch-brush-color"
                  className="color-input"
                  type="color"
                  value={retouchBrush.color}
                  onChange={(event) => onRetouchBrushChange({ color: event.target.value })}
                />
              </div>
              <RangeField
                id="retouch-brush-size"
                label="Brush size"
                max={128}
                min={1}
                step={1}
                unit="px"
                value={retouchBrush.size}
                onChange={(value) => onRetouchBrushChange({ size: value })}
              />
            </div>
            <div className="control-grid control-grid-compact">
              <RangeField
                id="retouch-brush-opacity"
                label="Brush opacity"
                max={100}
                min={1}
                step={1}
                unit="%"
                value={Math.round(retouchBrush.opacity * 100)}
                onChange={(value) => onRetouchBrushChange({ opacity: value / 100 })}
              />
            </div>
            <div className="toggle-row">
              <CheckToggle
                checked={retouchBrush.softEdge}
                label="Soft edge"
                onChange={(checked) => onRetouchBrushChange({ softEdge: checked })}
              />
            </div>
            <div className="layer-stack">
              {drawLayers.length > 0 ? (
                drawLayers.map((layer) => {
                  const isSettingsOpen = resolvedOpenLayerIds.includes(layer.id);
                  const layerIndex = layers.findIndex((candidate) => candidate.id === layer.id);
                  const canMoveEarlier = layerIndex > 0;
                  const canMoveLater = layerIndex > -1 && layerIndex < layers.length - 1;

                  return (
                    <div key={layer.id} className={`layer-card${layer.id === activeLayerId ? ' layer-card-active' : ''}`}>
                      <div className="layer-row layer-row-image">
                        <button
                          type="button"
                          className="image-layer-button"
                          aria-label={`${layer.name} layer`}
                          aria-pressed={layer.id === activeLayerId}
                          onClick={() => onActiveLayerChange(layer.id)}
                        >
                          <span className="image-layer-thumb" aria-hidden="true">
                            DRAW
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
                          shellMode={shellMode}
                          onDragStateChange={() => {}}
                          onSettingsClick={() => {
                            onActiveLayerChange(layer.id);
                            setOpenSettingsLayerIds((currentLayerIds) =>
                              currentLayerIds.includes(layer.id)
                                ? currentLayerIds.filter((currentLayerId) => currentLayerId !== layer.id)
                                : [...currentLayerIds, layer.id],
                            );
                          }}
                          onMoveEarlier={
                            canMoveEarlier
                              ? () => onReorderLayers(layer.id, layers[layerIndex - 1]!.id, 'before')
                              : undefined
                          }
                          onMoveLater={
                            canMoveLater
                              ? () => onReorderLayers(layer.id, layers[layerIndex + 1]!.id, 'after')
                              : undefined
                          }
                        />
                      </div>
                      {isSettingsOpen ? (
                        <div className="settings-popover">
                          <DrawLayerSettings
                            layer={layer}
                            layerCount={layers.length}
                            onDuplicateLayer={onDuplicateLayer}
                            onRemoveLayer={onRemoveLayer}
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })
              ) : null}
            </div>
          </div>
        ) : null}

        {activeTab === 'crop' ? (
          <div className="inspector-section">
            <div className="section-heading">
              <h2 className="section-title">CROP</h2>
            </div>
            <div className="section-subgroup section-subgroup-first">
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
                    <button type="button" className="mini-action-button" disabled={!sceneCropDraft} onClick={onApplySceneCrop}>
                      Apply crop
                    </button>
                    <button type="button" className="mini-action-button" onClick={onCancelSceneBounds}>
                      Cancel
                    </button>
                  </>
                ) : null}
              </div>
            </div>
            <div className="section-subgroup">
              {isCompactMobileCropLayout ? (
                <div className="section-heading-stack">
                  <h3 className="section-subtitle">Scene transforms</h3>
                </div>
              ) : null}
              <div className="settings-actions bounds-actions">
                <button type="button" className="mini-action-button" onClick={() => onSceneImageStackTransform('rotate-clockwise')}>
                  Rotate 90 clockwise
                </button>
                <button type="button" className="mini-action-button" onClick={() => onSceneImageStackTransform('rotate-counter-clockwise')}>
                  Rotate 90 counter-clockwise
                </button>
                <button type="button" className="mini-action-button" onClick={() => onSceneImageStackTransform('flip-vertical')}>
                  Flip vertical
                </button>
                <button type="button" className="mini-action-button" onClick={() => onSceneImageStackTransform('flip-horizontal')}>
                  Flip horizontal
                </button>
              </div>
            </div>
            <div className="section-subgroup">
              {isCompactMobileCropLayout ? (
                <div className="section-heading-stack">
                  <h3 className="section-subtitle">Canvas expand</h3>
                </div>
              ) : null}
              <div className="control-grid control-grid-compact bounds-grid">
                <div className="field-stack">
                  <label className="field-label" htmlFor="scene-expand-left">Expand left</label>
                  <input id="scene-expand-left" className="number-input" type="number" step={1} value={sceneExpandDraft.left} onChange={(event) => onSceneExpandDraftChange('left', Number(event.target.value))} />
                </div>
                <div className="field-stack">
                  <label className="field-label" htmlFor="scene-expand-right">Expand right</label>
                  <input id="scene-expand-right" className="number-input" type="number" step={1} value={sceneExpandDraft.right} onChange={(event) => onSceneExpandDraftChange('right', Number(event.target.value))} />
                </div>
                <div className="field-stack">
                  <label className="field-label" htmlFor="scene-expand-top">Expand top</label>
                  <input id="scene-expand-top" className="number-input" type="number" step={1} value={sceneExpandDraft.top} onChange={(event) => onSceneExpandDraftChange('top', Number(event.target.value))} />
                </div>
                <div className="field-stack">
                  <label className="field-label" htmlFor="scene-expand-bottom">Expand bottom</label>
                  <input id="scene-expand-bottom" className="number-input" type="number" step={1} value={sceneExpandDraft.bottom} onChange={(event) => onSceneExpandDraftChange('bottom', Number(event.target.value))} />
                </div>
              </div>
              <div className="control-grid control-grid-compact bounds-grid">
                <div className="field-stack">
                  <label className="field-label" htmlFor="scene-bounds-fill-mode">Fill mode</label>
                  <select id="scene-bounds-fill-mode" className="select-input" value={sceneBoundsFillMode} onChange={(event) => onSceneBoundsFillModeChange(event.target.value as SceneBoundsFillMode)}>
                    {SCENE_BOUNDS_FILL_MODE_OPTIONS.map((fillMode) => (
                      <option key={fillMode} value={fillMode}>
                        {fillMode}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field-stack">
                  <label className="field-label" htmlFor="scene-bounds-fill-color">Fill color</label>
                  <input id="scene-bounds-fill-color" className="layer-swatch bounds-fill-swatch" type="color" value={sceneBoundsFillColor} onChange={(event) => onSceneBoundsFillColorChange(event.target.value)} />
                </div>
              </div>
              <div className="settings-actions bounds-actions">
                <button type="button" className="mini-action-button" onClick={() => onSceneBoundsPreset('equal-margin')}>Add margin equally</button>
                <button type="button" className="mini-action-button" onClick={() => onSceneBoundsPreset('top-caption')}>Add top caption space</button>
                <button type="button" className="mini-action-button" onClick={() => onSceneBoundsPreset('bottom-caption')}>Add bottom caption space</button>
                <button type="button" className="mini-action-button" onClick={() => onSceneBoundsPreset('square-canvas')}>Square canvas</button>
              </div>
              {activeSceneBoundsMode === 'expand' ? (
                <div className="settings-actions bounds-actions">
                  <button type="button" className="mini-action-button" disabled={!hasPendingSceneExpand} onClick={onApplySceneExpand}>
                    Apply bounds
                  </button>
                  <button type="button" className="mini-action-button" onClick={onCancelSceneBounds}>
                    Cancel
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {showLocalOnlyTabs && activeTab === 'experimental' ? (
          <div className="inspector-section">
            <div className="section-heading">
              <div>
                <h2 className="section-title">EXPERIMENTAL</h2>
                <p className="section-copy">Narrow retouch tools outside the default meme path</p>
              </div>
            </div>
            <div className="section-subgroup section-subgroup-first">
              <div className="section-heading">
                <div>
                  <p className="section-subtitle">Starter templates</p>
                  <p className="section-copy">
                    Temporary home for quick-apply caption layouts until the dedicated template UX lands in `8C`.
                  </p>
                </div>
              </div>
              <div className="template-preset-stack">
                {templatePresets.map((preset) => (
                  <div key={preset.templateId} className="template-preset-card">
                    <div className="template-preset-copy">
                      <span className="template-preset-name">{preset.name}</span>
                      <span className="template-preset-meta">
                        {preset.scene.canvasSize.width} x {preset.scene.canvasSize.height} - {preset.description}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="mini-action-button"
                      aria-label={`Apply ${preset.name} template`}
                      onClick={() => onApplyTemplatePreset(preset.templateId)}
                    >
                      Apply
                    </button>
                  </div>
                ))}
              </div>
            </div>
            {shellMode === 'phone' ? (
              <>
                <p className="section-copy">
                  Experimental retouch stays desktop-only on phone for now.
                </p>
                <p className="section-copy">
                  Use desktop to set clone sources and stamp precisely without fighting touch gestures.
                </p>
              </>
            ) : (
              <>
                <div className="settings-actions bounds-actions">
                  <button
                    type="button"
                    className={`mini-action-button${retouchMode === 'clone-stamp' ? ' settings-button-active' : ''}`}
                    onClick={() => onRetouchModeChange(retouchMode === 'clone-stamp' ? 'idle' : 'clone-stamp')}
                  >
                    Clone Stamp
                  </button>
                </div>
                <div className="control-grid control-grid-compact">
                  <RangeField
                    id="clone-stamp-brush-size"
                    label="Brush size"
                    max={128}
                    min={1}
                    step={1}
                    unit="px"
                    value={retouchBrush.size}
                    onChange={(value) => onRetouchBrushChange({ size: value })}
                  />
                  <RangeField
                    id="clone-stamp-brush-opacity"
                    label="Brush opacity"
                    max={100}
                    min={1}
                    step={1}
                    unit="%"
                    value={Math.round(retouchBrush.opacity * 100)}
                    onChange={(value) => onRetouchBrushChange({ opacity: value / 100 })}
                  />
                </div>
                <div className="toggle-row">
                  <CheckToggle
                    checked={retouchBrush.softEdge}
                    label="Soft edge"
                    onChange={(checked) => onRetouchBrushChange({ softEdge: checked })}
                  />
                </div>
                <p className="section-copy">Alt+click to set source</p>
                <p className="section-copy">
                  {cloneStampSourcePoint && cloneStampSourceTargetId
                    ? `Source set`
                    : 'No source selected'}
                </p>
              </>
            )}
          </div>
        ) : null}

        {activeTab === 'adjustments' ? (
          <div className="inspector-section">
            <div className="section-heading">
              <h2 className="section-title">ADJUSTMENTS</h2>
              <p className="section-copy">Scene-wide tone and color</p>
            </div>
            <div className="effect-stack">
              <RangeField id="scene-adjustment-brightness" label="Brightness" max={200} min={0} step={1} unit="%" value={sceneImageAdjustments.brightness} onChange={(value) => onSceneImageAdjustmentsChange({ brightness: value })} />
              <RangeField id="scene-adjustment-contrast" label="Contrast" max={200} min={0} step={1} unit="%" value={sceneImageAdjustments.contrast} onChange={(value) => onSceneImageAdjustmentsChange({ contrast: value })} />
              <RangeField id="scene-adjustment-saturation" label="Saturation" max={200} min={0} step={1} unit="%" value={sceneImageAdjustments.saturation} onChange={(value) => onSceneImageAdjustmentsChange({ saturation: value })} />
              <RangeField id="scene-adjustment-hue" label="Hue" max={180} min={-180} step={1} unit="deg" value={sceneImageAdjustments.hue} onChange={(value) => onSceneImageAdjustmentsChange({ hue: value })} />
            </div>
            <div className="toggle-row">
              <CheckToggle checked={sceneImageAdjustments.grayscale} label="Grayscale" onChange={(checked) => onSceneImageAdjustmentsChange({ grayscale: checked })} />
              <CheckToggle checked={sceneImageAdjustments.sepia} label="Sepia" onChange={(checked) => onSceneImageAdjustmentsChange({ sepia: checked })} />
              <CheckToggle checked={sceneImageAdjustments.invert} label="Invert" onChange={(checked) => onSceneImageAdjustmentsChange({ invert: checked })} />
            </div>
            <div className="settings-actions">
              <button type="button" className="mini-action-button" onClick={onResetSceneImageAdjustments}>
                Reset adjustments
              </button>
            </div>
            <div className="toggle-row">
              <CheckToggle checked={sceneImageAdjustments.includeText} label="Apply to text" onChange={(checked) => onSceneImageAdjustmentsChange({ includeText: checked })} />
            </div>
          </div>
        ) : null}

        {activeTab === 'effects' ? (
          <div className="inspector-section">
            <div className="section-heading">
              <h2 className="section-title">EFFECTS</h2>
            </div>
            <div className="effect-card-stack">
              {sceneEffectStack.map((effect, index) => (
                <div
                  key={effect.id}
                  className={`effect-card${
                    draggingEffectId === effect.id ? ' layer-card-dragging' : ''
                  }${
                    effectDropIndicator?.effectId === effect.id
                      ? effectDropIndicator.placement === 'before'
                        ? ' layer-card-drop-before'
                        : ' layer-card-drop-after'
                      : ''
                  }`}
                  onDragOver={(event) => {
                    event.preventDefault();
                    const bounds = event.currentTarget.getBoundingClientRect();
                    const placement =
                      event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
                    setEffectDropIndicator({ effectId: effect.id, placement });
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const bounds = event.currentTarget.getBoundingClientRect();
                    const placement =
                      event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
                    const draggedEffectId =
                      draggingEffectId ?? event.dataTransfer.getData('application/x-meme-elf-effect-id');

                    if (!draggedEffectId || draggedEffectId === effect.id) {
                      setEffectDropIndicator(null);
                      return;
                    }

                    onReorderSceneEffects(draggedEffectId, effect.id, placement);
                    setDraggingEffectId(null);
                    setEffectDropIndicator(null);
                  }}
                  onDragLeave={(event) => {
                    const nextTarget = event.relatedTarget;

                    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
                      return;
                    }

                    setEffectDropIndicator((currentIndicator) =>
                      currentIndicator?.effectId === effect.id ? null : currentIndicator,
                    );
                  }}
                >
                    <div className="effect-card-head">
                      <div className="effect-card-title-group">
                        <span className="effect-card-title">{getSceneEffectLabel(effect.kind)}</span>
                        <span className="effect-value">
                          {effect.value}
                          {getSceneEffectUnit(effect.kind)}
                        </span>
                      </div>
                      {shellMode === 'phone' ? null : (
                        <button
                          type="button"
                          className="layer-order-handle"
                          draggable
                          aria-label={`Reorder ${getSceneEffectLabel(effect.kind)} effect`}
                          onDragStart={(event) => {
                            setDraggingEffectId(effect.id);
                            setEffectDropIndicator(null);
                            event.dataTransfer.setData('application/x-meme-elf-effect-id', effect.id);
                          }}
                          onDragEnd={() => {
                            setDraggingEffectId(null);
                            setEffectDropIndicator(null);
                          }}
                        >
                          ⋮⋮
                        </button>
                      )}
                  </div>
                  {shellMode === 'phone' ? (
                    <div className="effect-card-mobile-row">
                      <input
                        id={`scene-effect-${effect.id}`}
                        className="range-input effect-range-input"
                        type="range"
                        min={0}
                        max={effect.kind === 'blur' ? 24 : 100}
                        step={1}
                        value={effect.value}
                        aria-label={getSceneEffectLabel(effect.kind)}
                        onChange={(event) => onSceneEffectValueChange(effect.id, Number(event.target.value))}
                      />
                      <div className="effect-order-actions" aria-label={`${getSceneEffectLabel(effect.kind)} ordering`}>
                          <button
                            type="button"
                            className="layer-order-button"
                            aria-label={`Move ${getSceneEffectLabel(effect.kind)} earlier`}
                            disabled={index === 0}
                            onClick={() => {
                              if (index === 0) {
                                return;
                              }

                              onReorderSceneEffects(
                                effect.id,
                                sceneEffectStack[index - 1]!.id,
                                'before',
                              );
                            }}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="layer-order-button"
                            aria-label={`Move ${getSceneEffectLabel(effect.kind)} later`}
                            disabled={index === sceneEffectStack.length - 1}
                            onClick={() => {
                              if (index === sceneEffectStack.length - 1) {
                                return;
                              }

                              onReorderSceneEffects(
                                effect.id,
                                sceneEffectStack[index + 1]!.id,
                                'after',
                              );
                            }}
                          >
                            ↓
                          </button>
                        </div>
                    </div>
                  ) : (
                    <input
                      id={`scene-effect-${effect.id}`}
                      className="range-input"
                      type="range"
                      min={0}
                      max={effect.kind === 'blur' ? 24 : 100}
                      step={1}
                      value={effect.value}
                      aria-label={getSceneEffectLabel(effect.kind)}
                      onChange={(event) => onSceneEffectValueChange(effect.id, Number(event.target.value))}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="settings-actions">
              <button type="button" className="mini-action-button" onClick={onResetSceneEffectStack}>
                Reset effects
              </button>
            </div>
          </div>
        ) : null}

        {activeTab === 'watermark' ? (
          <div className="inspector-section">
            <div className="section-heading">
              <h2 className="section-title">WATERMARK</h2>
            </div>
            {shellMode === 'phone' ? (
              <div className="watermark-preview-summary" aria-label="Watermark preview summary">
                <span className="watermark-preview-summary-label">Preview</span>
                <span className="watermark-preview-summary-copy">{watermarkPreviewLabel}</span>
              </div>
            ) : null}
            <div className="toggle-row">
              <CheckToggle
                checked={sceneWatermark.enabled}
                label="Enable watermark"
                onChange={(checked) => onSceneWatermarkChange({ enabled: checked })}
              />
            </div>
            <div className="field-stack">
              <label className="field-label" htmlFor="scene-watermark-text">
                Watermark text
              </label>
              <input
                id="scene-watermark-text"
                className="text-input watermark-text-input"
                type="text"
                value={sceneWatermark.text}
                onChange={(event) => onSceneWatermarkChange({ text: event.target.value })}
              />
            </div>
            <div className="control-grid control-grid-compact">
              <div className="field-stack">
                <label className="field-label" htmlFor="scene-watermark-mode">
                  Watermark mode
                </label>
                <select
                  id="scene-watermark-mode"
                  className="select-input"
                  value={sceneWatermark.mode}
                  onChange={(event) => {
                    const nextMode = event.target.value as SceneWatermarkMode;

                    onSceneWatermarkChange(
                      nextMode === 'center'
                        ? { mode: nextMode, size: 240 }
                        : nextMode === 'corner'
                          ? { mode: nextMode, corner: 'bottom-left', size: 12 }
                          : { mode: nextMode },
                    );
                  }}
                >
                  <option value="center">Centered word</option>
                  <option value="corner">Corner mark</option>
                  <option value="tile">Tiled text</option>
                  <option value="diagonal">Diagonal</option>
                </select>
              </div>
              {sceneWatermark.mode === 'corner' ? (
                <div className="field-stack">
                  <label className="field-label" htmlFor="scene-watermark-corner">
                    Watermark corner
                  </label>
                  <select
                    id="scene-watermark-corner"
                    className="select-input"
                    value={sceneWatermark.corner}
                    onChange={(event) =>
                      onSceneWatermarkChange({ corner: event.target.value as SceneWatermarkCorner })
                    }
                  >
                    <option value="top-left">Top left</option>
                    <option value="top-right">Top right</option>
                    <option value="bottom-left">Bottom left</option>
                    <option value="bottom-right">Bottom right</option>
                  </select>
                </div>
              ) : null}
            </div>
            <div className="control-grid control-grid-compact">
              <div className="field-stack">
                <label className="field-label" htmlFor="scene-watermark-color">
                  Watermark color
                </label>
                <input
                  id="scene-watermark-color"
                  className="color-input"
                  type="color"
                  value={sceneWatermark.color}
                  onChange={(event) => onSceneWatermarkChange({ color: event.target.value })}
                />
              </div>
            </div>
            <div className="control-grid control-grid-compact">
              <RangeField
                id="scene-watermark-opacity"
                label="Watermark opacity"
                max={100}
                min={0}
                step={1}
                unit="%"
                value={sceneWatermark.opacity}
                onChange={(value) => onSceneWatermarkChange({ opacity: value })}
              />
              <RangeField
                id="scene-watermark-size"
                label="Watermark size"
                max={240}
                min={12}
                step={1}
                unit="px"
                value={sceneWatermark.size}
                onChange={(value) => onSceneWatermarkChange({ size: value })}
              />
            </div>
            {sceneWatermark.mode === 'tile' ? (
              <div className="control-grid control-grid-compact">
                <RangeField
                  id="scene-watermark-rotation"
                  label="Tile rotation"
                  max={180}
                  min={0}
                  step={1}
                  unit="deg"
                  value={sceneWatermark.rotation}
                  onChange={(value) => onSceneWatermarkChange({ rotation: value })}
                />
              </div>
            ) : null}
            <div className="settings-actions">
              <button type="button" className="mini-action-button" onClick={onResetSceneWatermark}>
                Reset watermark
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function InspectorTabButton({
  icon,
  isActive,
  label,
  onClick,
}: {
  icon: ReactNode;
  isActive: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      aria-label={label}
      data-tooltip={label}
      className={`tool-rail-button icon-button-with-tooltip${isActive ? ' tool-rail-button-active' : ''}`}
      onPointerDown={handleTooltipTouchPointerDown}
      onTouchStart={handleTooltipTouchStart}
      onFocus={handleTooltipTouchFocus}
      onClick={(event) => {
        handleTooltipTouchClick(event);
        onClick();
      }}
    >
      {icon}
    </button>
  );
}

function RailIconBase({ children }: { children: ReactNode }) {
  return (
    <svg aria-hidden="true" className="tool-rail-icon-svg" viewBox="0 0 20 20" fill="none">
      {children}
    </svg>
  );
}

function LayersIcon() {
  return (
    <RailIconBase>
      <path d="M4 6h12M4 10h12M4 14h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </RailIconBase>
  );
}

function CropIcon() {
  return (
    <RailIconBase>
      <path d="M6 3.5v10a1.5 1.5 0 0 0 1.5 1.5h9M3.5 6h10a1.5 1.5 0 0 1 1.5 1.5v9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </RailIconBase>
  );
}

function AdjustmentsIcon() {
  return (
    <RailIconBase>
      <path d="M4 6h4M12 6h4M9 6a1 1 0 1 0-2 0 1 1 0 0 0 2 0ZM4 10h8M15 10h1M14 10a1 1 0 1 0-2 0 1 1 0 0 0 2 0ZM4 14h2M10 14h6M9 14a1 1 0 1 0-2 0 1 1 0 0 0 2 0Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </RailIconBase>
  );
}

function DrawIcon() {
  return (
    <RailIconBase>
      <path d="M5 14.5 13.8 5.7a1.6 1.6 0 0 1 2.2 0l.3.3a1.6 1.6 0 0 1 0 2.2L7.5 17H5v-2.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M11.5 8l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </RailIconBase>
  );
}

function EffectsIcon() {
  return (
    <RailIconBase>
      <path d="M10 3.5 12 7.5l4 .5-3 2.8.8 4.2L10 13l-3.8 2 .8-4.2-3-2.8 4-.5 2-4Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </RailIconBase>
  );
}

function WatermarkIcon() {
  return (
    <RailIconBase>
      <path d="M4.5 14.5 8 5.5l2 5 2-3 3.5 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 14.5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </RailIconBase>
  );
}

function SparkIcon() {
  return (
    <RailIconBase>
      <path d="M10 3.5 11.7 7l3.8 1-3 2.4.6 4.1-3.1-1.7-3.1 1.7.6-4.1-3-2.4 3.8-1L10 3.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </RailIconBase>
  );
}

function LayerAddIcon() {
  return (
    <RailIconBase>
      <path d="M4 6.5h8M4 10h8M4 13.5h8M15 8v6M12 11h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </RailIconBase>
  );
}

function UploadImageIcon() {
  return (
    <RailIconBase>
      <path d="M10 14V5.5M7 8.5l3-3 3 3M5 15.5h10M5 5.5h2M13 5.5h2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="4" y="4" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
    </RailIconBase>
  );
}

function PasteImageIcon() {
  return (
    <RailIconBase>
      <rect x="5.2" y="4.8" width="9.6" height="11" rx="1.4" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 4.8v-1h4v1M7.2 8.2h5.6M7.2 11h5.6M3.8 7.2V15a1 1 0 0 0 1 1h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </RailIconBase>
  );
}

function UrlImageIcon() {
  return (
    <RailIconBase>
      <path
        d="M6.4 12.8 4.8 14.4a2.3 2.3 0 0 0 3.2 3.2l1.8-1.8M13.6 7.2l1.6-1.6a2.3 2.3 0 1 0-3.2-3.2l-1.8 1.8M7.8 12.2l4.4-4.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12.8 14.6h2.8M14.2 13.2V16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </RailIconBase>
  );
}

type LayerRowActionsProps = {
  children?: ReactNode;
  isSettingsOpen: boolean;
  layer: EditorLayer;
  shellMode: 'desktop' | 'small-tablet' | 'phone';
  onDragStateChange: (isDragging: boolean) => void;
  onSettingsClick: () => void;
  onMoveEarlier?: () => void;
  onMoveLater?: () => void;
};

function LayerRowActions({
  children,
  isSettingsOpen,
  layer,
  shellMode,
  onDragStateChange,
  onSettingsClick,
  onMoveEarlier,
  onMoveLater,
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
      {shellMode === 'phone' ? (
        <div className="layer-order-actions" aria-label={`${layer.name} ordering`}>
          <button
            type="button"
            className="layer-order-button"
            aria-label={`Move ${layer.name} earlier`}
            disabled={!onMoveEarlier}
            onClick={() => onMoveEarlier?.()}
          >
            ↑
          </button>
          <button
            type="button"
            className="layer-order-button"
            aria-label={`Move ${layer.name} later`}
            disabled={!onMoveLater}
            onClick={() => onMoveLater?.()}
          >
            ↓
          </button>
        </div>
      ) : (
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
      )}
    </div>
  );
}

type LayerSettingsProps = {
  layer: TextLayer;
  layerCount: number;
  onApplySettingsToAllLayers: (layerId: LayerId) => void;
  onDuplicateLayer: (layerId: LayerId) => void;
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
  onDuplicateLayer,
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
          aria-label={`Duplicate ${layer.name}`}
          onClick={() => onDuplicateLayer(layer.id)}
        >
          Duplicate layer
        </button>
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
  onDuplicateLayer,
  onFlipHorizontal,
  onFlipVertical,
  onRemoveLayer,
  onRotate,
}: {
  layer: EditorLayer;
  layerCount: number;
  onDuplicateLayer: (layerId: LayerId) => void;
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
        <button type="button" className="apply-all-button" aria-label={`Duplicate ${layer.name}`} onClick={() => onDuplicateLayer(layer.id)}>
          Duplicate layer
        </button>
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

function DrawLayerSettings({
  layer,
  layerCount,
  onDuplicateLayer,
  onRemoveLayer,
}: {
  layer: EditorLayer;
  layerCount: number;
  onDuplicateLayer: (layerId: LayerId) => void;
  onRemoveLayer: (layerId: LayerId) => void;
}) {
  if (!isDrawLayer(layer)) {
    return null;
  }

  return (
    <div className="image-layer-settings">
      <p className="section-copy">This draw layer stays in the scene stack and receives new strokes while it is the active brush target.</p>
      <div className="settings-actions">
        <button
          type="button"
          className="apply-all-button"
          aria-label={`Duplicate ${layer.name}`}
          onClick={() => onDuplicateLayer(layer.id)}
        >
          Duplicate layer
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

type RangeFieldProps = {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  value: number;
  onChange: (value: number) => void;
};

function RangeField({ id, label, max, min, onChange, step, unit, value }: RangeFieldProps) {
  return (
    <div className="field-stack effect-field">
      <label className="field-label effect-label" htmlFor={id}>
        <span>{label}</span>
        <span className="effect-value">
          {value}
          {unit}
        </span>
      </label>
      <input
        id={id}
        className="range-input"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

function getSceneEffectLabel(effectKind: SceneEffectStackItem['kind']) {
  switch (effectKind) {
    case 'blur':
      return 'Blur';
    case 'sharpen':
      return 'Sharpen';
    case 'threshold':
      return 'Threshold';
    case 'pixelate':
      return 'Pixelate';
    case 'noise':
      return 'Noise';
    case 'grain':
      return 'Grain';
    case 'posterize':
      return 'Posterize';
    case 'jpeg':
      return 'JPEG degrade';
  }
}

function getSceneEffectUnit(effectKind: SceneEffectStackItem['kind']) {
  return effectKind === 'blur' || effectKind === 'pixelate' ? 'px' : '%';
}
