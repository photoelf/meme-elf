import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import {
  createDefaultAppState,
  createTextLayer,
  DEFAULT_CANVAS_SIZE,
  DEFAULT_LAYER_EDGE_OFFSET,
} from './default-state';
import { getContainedCanvasSize } from '../features/canvas/canvas-renderer';
import {
  extractImageFromPasteEvent,
  readImageFromClipboard,
} from '../features/clipboard/clipboard-service';
import { PreviewCanvas } from '../features/preview/preview-canvas';
import { ControlPanel } from '../features/controls/control-panel';
import { loadImageElementFromFile } from '../features/image/image-loader';
import type { AppState, LayerId, TextLayer } from './types';

const MAX_PREVIEW_WIDTH = 960;
const DEFAULT_INSPECTOR_WIDTH = 24;
const MIN_PANEL_WIDTH = 300;

function createLayersForCanvas(
  layers: TextLayer[],
  currentSize: { width: number; height: number },
  nextSize: { width: number; height: number },
) {
  const scaleX = nextSize.width / currentSize.width;
  const scaleY = nextSize.height / currentSize.height;

  return layers.map((layer) => {
    return {
      ...layer,
      box: {
        ...layer.box,
        x: Math.round(layer.box.x * scaleX),
        y: Math.round(layer.box.y * scaleY),
        width: Math.round(layer.box.width * scaleX),
        height: Math.round(layer.box.height * scaleY),
      },
    };
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

function getPreferredTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getStoredToolRailCollapsed(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }

  return window.localStorage.getItem('meme-elf.tool-rail-collapsed') !== 'false';
}

function getStoredInspectorWidth(): number {
  if (typeof window === 'undefined') {
    return DEFAULT_INSPECTOR_WIDTH;
  }

  const storedWidth = Number(window.localStorage.getItem('meme-elf.inspector-width'));

  if (Number.isNaN(storedWidth)) {
    return DEFAULT_INSPECTOR_WIDTH;
  }

  return storedWidth > 0 ? storedWidth : DEFAULT_INSPECTOR_WIDTH;
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

function hasTextSelection() {
  const selection = window.getSelection();
  return Boolean(selection && selection.toString().trim().length > 0);
}

function blurActiveEditable() {
  const activeElement = document.activeElement;

  if (activeElement instanceof HTMLElement && isEditableTarget(activeElement)) {
    activeElement.blur();
  }
}

export function App() {
  const [appState, setAppState] = useState(createDefaultAppState);
  const [statusMessage, setStatusMessage] = useState<string | null>(appState.errorMessage);
  const [theme, setTheme] = useState<'light' | 'dark'>(getPreferredTheme);
  const [isToolRailCollapsed, setIsToolRailCollapsed] = useState(getStoredToolRailCollapsed);
  const [inspectorWidth, setInspectorWidth] = useState(getStoredInspectorWidth);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const workspaceRef = useRef<HTMLElement | null>(null);
  const isDraggingSplitRef = useRef(false);
  const nextLayerSequenceRef = useRef(appState.layers.length + 1);
  const lastShortcutCopyAtRef = useRef(0);

  const activeLayer =
    appState.layers.find((layer) => layer.id === appState.activeLayerId) ?? null;
  const activeStatusLabel = statusMessage ?? (appState.image ? 'Image loaded.' : 'Ready.');

  function applyLoadedImage(image: HTMLImageElement, nextStatus: string) {
    const canvasSize = getContainedCanvasSize(
      image.naturalWidth || appState.canvasSize.width,
      image.naturalHeight || appState.canvasSize.height,
      MAX_PREVIEW_WIDTH,
    );

    setAppState((currentState) => ({
      ...currentState,
      canvasSize,
      errorMessage: null,
      image,
      layers: createLayersForCanvas(currentState.layers, currentState.canvasSize, canvasSize),
      status: 'idle',
    }));
    setStatusMessage(nextStatus);
  }

  function updateLayer(layerId: LayerId, updates: Partial<TextLayer>) {
    setAppState((currentState) => ({
      ...currentState,
      layers: currentState.layers.map((layer) => {
        if (layer.id !== layerId) {
          return layer;
        }

        return { ...layer, ...updates };
      }),
    }));
  }

  function applyLayerSettingsToAllLayers(sourceLayerId: LayerId) {
    setAppState((currentState) => {
      const sourceLayer = currentState.layers.find((layer) => layer.id === sourceLayerId);

      if (!sourceLayer) {
        return currentState;
      }

      return {
        ...currentState,
        layers: currentState.layers.map((layer) =>
          layer.id === sourceLayerId
            ? layer
            : {
                ...layer,
                allCaps: sourceLayer.allCaps,
                bold: sourceLayer.bold,
                effect: sourceLayer.effect,
                fillStyle: sourceLayer.fillStyle,
                fontFamily: sourceLayer.fontFamily,
                fontSize: sourceLayer.fontSize,
                italic: sourceLayer.italic,
                opacity: sourceLayer.opacity,
                outlineWidth: sourceLayer.outlineWidth,
                strokeStyle: sourceLayer.strokeStyle,
                textAlign: sourceLayer.textAlign,
                verticalAlign: sourceLayer.verticalAlign,
              },
        ),
      };
    });
  }

  function addLayer() {
    setAppState((currentState) => {
      const nextSequence = nextLayerSequenceRef.current;
      nextLayerSequenceRef.current += 1;
      const nextLayerId = `layer-${nextSequence}`;
      const fallbackWidth = currentState.canvasSize.width || DEFAULT_CANVAS_SIZE.width;
      const fallbackHeight = currentState.canvasSize.height || DEFAULT_CANVAS_SIZE.height;
      const nextLayer = createTextLayer(
        nextLayerId,
        `Text ${nextSequence}`,
        Math.round(fallbackHeight / 2),
        'middle',
      );

      nextLayer.box.x = DEFAULT_LAYER_EDGE_OFFSET;
      nextLayer.box.y = Math.round((fallbackHeight - nextLayer.box.height) / 2);
      nextLayer.box.width = fallbackWidth - DEFAULT_LAYER_EDGE_OFFSET * 2;

      return {
        ...currentState,
        activeLayerId: nextLayerId,
        layers: [...currentState.layers, nextLayer],
      };
    });
  }

  function reorderLayers(
    sourceLayerId: LayerId,
    targetLayerId: LayerId,
    placement: 'before' | 'after',
  ) {
    if (sourceLayerId === targetLayerId) {
      return;
    }

    setAppState((currentState) => {
      const sourceIndex = currentState.layers.findIndex((layer) => layer.id === sourceLayerId);
      const targetIndex = currentState.layers.findIndex((layer) => layer.id === targetLayerId);

      if (sourceIndex === -1 || targetIndex === -1) {
        return currentState;
      }

      const nextLayers = [...currentState.layers];
      const [movedLayer] = nextLayers.splice(sourceIndex, 1);
      const adjustedTargetIndex =
        sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
      const insertIndex = placement === 'before' ? adjustedTargetIndex : adjustedTargetIndex + 1;
      nextLayers.splice(insertIndex, 0, movedLayer);

      return {
        ...currentState,
        layers: nextLayers,
      };
    });
  }

  function removeLayer(layerId: LayerId) {
    setAppState((currentState) => {
      if (currentState.layers.length <= 1) {
        return currentState;
      }

      const nextLayers = currentState.layers.filter((layer) => layer.id !== layerId);
      const nextActiveLayerId =
        currentState.activeLayerId === layerId
          ? (nextLayers[nextLayers.length - 1]?.id ?? null)
          : currentState.activeLayerId;

      return {
        ...currentState,
        activeLayerId: nextActiveLayerId,
        layers: nextLayers,
      };
    });
  }

  async function handlePasteClick() {
    setStatusMessage('Reading the clipboard...');

    const image = await readImageFromClipboard();

    if (!image) {
      setStatusMessage('No image was found in the clipboard. Try Ctrl+V or upload a file.');
      return;
    }

    applyLoadedImage(image, 'Image loaded from clipboard.');
  }

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const [file] = Array.from(event.target.files ?? []);

    if (!file) {
      return;
    }

    setAppState((currentState) => ({ ...currentState, status: 'loadingImage' }));
    setStatusMessage(`Loading ${file.name}...`);

    try {
      const image = await loadImageElementFromFile(file);
      applyLoadedImage(image, `${file.name} loaded.`);
    } catch {
      setStatusMessage('That file could not be loaded. Try another PNG, JPEG, or WebP image.');
    } finally {
      event.target.value = '';
    }
  }

  async function handleCopyClick() {
    const canvas = canvasRef.current;

    if (!canvas) {
      setStatusMessage('The canvas is not ready yet.');
      return;
    }

    if (typeof navigator.clipboard?.write !== 'function' || typeof ClipboardItem === 'undefined') {
      setStatusMessage('Direct image copy is not supported in this browser. Use Download PNG.');
      return;
    }

    const blob = await canvasToBlob(canvas);

    if (!blob) {
      setStatusMessage('The image could not be copied. Try Download PNG instead.');
      return;
    }

    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setStatusMessage('Image copied to the clipboard.');
    } catch {
      setStatusMessage('Clipboard copy was blocked by the browser. Try Download PNG instead.');
    }
  }

  function handleDownloadClick() {
    const canvas = canvasRef.current;

    if (!canvas) {
      setStatusMessage('The canvas is not ready yet.');
      return;
    }

    const downloadLink = document.createElement('a');
    downloadLink.href = canvas.toDataURL('image/png');
    downloadLink.download = 'meme-elf.png';
    downloadLink.click();
    setStatusMessage('PNG download started.');
  }

  useEffect(() => {
    async function handlePasteEvent(event: ClipboardEvent) {
      const image = await extractImageFromPasteEvent(event);

      if (!image) {
        return;
      }

      event.preventDefault();
      applyLoadedImage(image, 'Image pasted from the clipboard.');
    }

    document.addEventListener('paste', handlePasteEvent);
    return () => document.removeEventListener('paste', handlePasteEvent);
  }, [appState.canvasSize.height, appState.canvasSize.width, appState.layers]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem('meme-elf.tool-rail-collapsed', String(isToolRailCollapsed));
  }, [isToolRailCollapsed]);

  useEffect(() => {
    window.localStorage.setItem('meme-elf.inspector-width', String(inspectorWidth));
  }, [inspectorWidth]);

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      if (!isDraggingSplitRef.current || !workspaceRef.current) {
        return;
      }

      const bounds = workspaceRef.current.getBoundingClientRect();
      const railWidth = isToolRailCollapsed ? 0 : 66;
      const availableWidth = bounds.width - railWidth;
      const inspectorPixels = bounds.right - event.clientX;
      const clampedInspectorPixels = Math.min(
        Math.max(MIN_PANEL_WIDTH, availableWidth - MIN_PANEL_WIDTH),
        Math.max(MIN_PANEL_WIDTH, inspectorPixels),
      );
      const nextWidth = (clampedInspectorPixels / bounds.width) * 100;
      setInspectorWidth(nextWidth);
    }

    function handlePointerUp() {
      isDraggingSplitRef.current = false;
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isToolRailCollapsed]);

  useEffect(() => {
    function shouldHandleCanvasCopy(target: EventTarget | null) {
      return !isEditableTarget(target) && !hasTextSelection();
    }

    function requestShortcutCopy() {
      const now = Date.now();

      if (now - lastShortcutCopyAtRef.current < 200) {
        return;
      }

      lastShortcutCopyAtRef.current = now;
      void handleCopyClick();
    }

    function handleCopyEvent(event: ClipboardEvent) {
      if (!shouldHandleCanvasCopy(event.target)) {
        return;
      }

      event.preventDefault();
      requestShortcutCopy();
    }

    function handleKeyDown(event: KeyboardEvent) {
      const isCopyShortcut =
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'c';

      if (!isCopyShortcut || event.defaultPrevented) {
        return;
      }

      if (!shouldHandleCanvasCopy(event.target)) {
        return;
      }

      // Some browsers route copy through a native `copy` event only after keydown.
      // Keep this as a fallback for engines that do not dispatch `copy` reliably.
      event.preventDefault();
      requestShortcutCopy();
    }

    document.addEventListener('copy', handleCopyEvent);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('copy', handleCopyEvent);
      document.removeEventListener('keydown', handleKeyDown);
    };
  });

  const workspaceStyle = {
    '--inspector-width': `${inspectorWidth}%`,
  } as CSSProperties;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <h1>meme-elf</h1>
        </div>
        <div className="topbar-actions" role="toolbar" aria-label="Editor actions">
          <button
            type="button"
            className="toolbar-button"
            onClick={handlePasteClick}
          >
            Paste from Clipboard
          </button>
          <button type="button" className="toolbar-button" onClick={handleUploadClick}>
            Upload Image
          </button>
          <button
            type="button"
            className="toolbar-button"
            onClick={handleCopyClick}
          >
            Copy Image
          </button>
          <button
            type="button"
            className="toolbar-button"
            onClick={handleDownloadClick}
          >
            Download PNG
          </button>
          <button
            type="button"
            className="toolbar-icon-button"
            onClick={() => setTheme((currentTheme) => (currentTheme === 'light' ? 'dark' : 'light'))}
            aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
            title={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
          >
            {theme === 'light' ? '☾' : '☀'}
          </button>
          <button
            type="button"
            className="toolbar-icon-button"
            onClick={() => setIsToolRailCollapsed((currentState) => !currentState)}
            aria-label={isToolRailCollapsed ? 'Show tool rail' : 'Hide tool rail'}
            title={isToolRailCollapsed ? 'Show tool rail' : 'Hide tool rail'}
          >
            [|]
          </button>
        </div>
      </header>

      <section
        ref={workspaceRef}
        style={workspaceStyle}
        className={`workspace-shell${isToolRailCollapsed ? ' workspace-shell-rail-collapsed' : ''}`}
      >
        <aside
          className={`tool-rail${isToolRailCollapsed ? ' tool-rail-collapsed' : ''}`}
          aria-label="Tools"
        >
          <button
            type="button"
            className="tool-rail-button tool-rail-button-active"
            aria-label="Pointer tool"
          >
            ↖
          </button>
        </aside>

        <section className="preview-panel" aria-label="Preview">
          <div
            className="splitter"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize inspector"
            onPointerDown={(event) => {
              event.preventDefault();
              isDraggingSplitRef.current = true;
            }}
          />
          <div className="preview-panel-header">
            <h2 className="preview-title">MEME</h2>
            <p className="preview-hint">Paste. Caption. Export.</p>
          </div>
          <div className="preview-stage">
            <div className="preview-frame">
              <PreviewCanvas
                canvasRef={canvasRef}
                activeLayerId={appState.activeLayerId}
                image={appState.image}
                width={appState.canvasSize.width}
                height={appState.canvasSize.height}
                layers={appState.layers}
                onActiveLayerChange={(layerId) =>
                  setAppState((currentState) => ({ ...currentState, activeLayerId: layerId }))
                }
                onLayerChange={updateLayer}
              />
            </div>
          </div>
          <div className="status-strip" aria-label="Editor status">
            <span>{activeStatusLabel}</span>
            <span>Local-only alpha</span>
            <span>Theme: {theme}</span>
          </div>
        </section>

        <ControlPanel
          activeLayerId={appState.activeLayerId}
          layers={appState.layers}
          onBackgroundPointerDown={blurActiveEditable}
          onActiveLayerChange={(layerId) =>
            setAppState((currentState) => ({ ...currentState, activeLayerId: layerId }))
          }
          onClearActiveLayer={() =>
            setAppState((currentState) => ({ ...currentState, activeLayerId: null }))
          }
          onAddLayer={addLayer}
          onApplySettingsToAllLayers={applyLayerSettingsToAllLayers}
          onLayerChange={updateLayer}
          onReorderLayers={reorderLayers}
          onRemoveLayer={removeLayer}
        />
      </section>
      <input
        ref={fileInputRef}
        className="file-input file-input-hidden"
        aria-label="Upload image file"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileChange}
      />
    </main>
  );
}
