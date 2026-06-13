import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import { App } from './App';
import { getCanvasPoint } from '../features/preview/preview-canvas';
import { resetPreviewRenderSurfacesForTests } from '../features/canvas/canvas-renderer';

const mocks = vi.hoisted(() => ({
  extractImageFromPasteEvent: vi.fn(),
  loadImageElementFromFile: vi.fn(),
  readImageFromClipboard: vi.fn(),
  readImageFromClipboardResult: vi.fn(),
  revokeLoadedImageObjectUrl: vi.fn(),
}));

vi.mock('../features/clipboard/clipboard-service', () => ({
  extractImageFromPasteEvent: mocks.extractImageFromPasteEvent,
  readImageFromClipboard: mocks.readImageFromClipboard,
  readImageFromClipboardResult: mocks.readImageFromClipboardResult,
}));

vi.mock('../features/image/image-loader', () => ({
  loadImageElementFromFile: mocks.loadImageElementFromFile,
  revokeLoadedImageObjectUrl: mocks.revokeLoadedImageObjectUrl,
}));

function createImageStub(width = 1200, height = 800) {
  return {
    naturalHeight: height,
    naturalWidth: width,
    src: 'blob:test-image',
  } as HTMLImageElement;
}

function createImageElement(width = 1200, height = 800) {
  const image = document.createElement('img');
  image.src = 'blob:test-image';
  Object.defineProperty(image, 'naturalWidth', { configurable: true, value: width });
  Object.defineProperty(image, 'naturalHeight', { configurable: true, value: height });
  return image as HTMLImageElement;
}

describe('App', () => {
  beforeEach(() => {
    resetPreviewRenderSurfacesForTests();
    vi.clearAllMocks();
    document.documentElement.dataset.theme = '';
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(createCanvasContextStub());
    mocks.readImageFromClipboardResult.mockImplementation(async () => {
      const image = await mocks.readImageFromClipboard();
      return image ? { image, reason: null } : { image: null, reason: 'no-image' };
    });
  });

  it('renders the meme-elf heading, editor toolbar, and inspector fields', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /meme-elf/i })).toBeInTheDocument();
    expect(screen.getByRole('toolbar', { name: /editor actions/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /paste from clipboard/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy image/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /download png/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /switch to dark theme/i })).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: /control sections/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /layers/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /crop/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /adjustments/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /draw/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /effects/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /watermark/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /show tool rail/i })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /top text/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /bottom text/i })).toBeInTheDocument();
  });

  it('switches right-side control tabs instead of pointer or image tools', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('tab', { name: /adjustments/i }));
    expect(screen.getByRole('heading', { name: /adjustments/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /^layers$/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /effects/i }));
    expect(screen.getByRole('heading', { name: /effects/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /draw/i }));
    expect(screen.getByRole('heading', { name: /draw/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^draw$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^erase$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new draw layer/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /eyedropper/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/brush color/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/brush size/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /layers/i }));
    expect(screen.getByRole('heading', { name: /^layers$/i })).toBeInTheDocument();
    const layersPanel = screen.getByRole('heading', { name: /^layers$/i }).parentElement?.parentElement;
    expect(layersPanel).not.toBeNull();
    expect(within(layersPanel as HTMLElement).queryByRole('button', { name: /select area/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /apply selection/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /copy selection to new layer/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cut selection to new layer/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /watermark/i }));
    expect(screen.getByRole('heading', { name: /watermark/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /crop/i }));
    expect(screen.getByRole('heading', { name: /crop/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /crop scene/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /image tool/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pointer tool/i })).not.toBeInTheDocument();
    expect(screen.getByRole('toolbar', { name: /canvas tools/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /select area/i })).toBeInTheDocument();
  });

  it('switches the manual theme from light to dark', () => {
    window.matchMedia = vi.fn().mockReturnValue({
      addEventListener: vi.fn(),
      matches: false,
      removeEventListener: vi.fn(),
    });

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /switch to dark theme/i }));

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(screen.getByRole('button', { name: /switch to light theme/i })).toBeInTheDocument();
  });

  it('loads an image when the clipboard button succeeds', async () => {
    mocks.readImageFromClipboard.mockResolvedValue(createImageStub());

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /paste from clipboard/i }));

    await waitFor(() => {
      expect(screen.getByText(/image loaded from clipboard/i)).toBeInTheDocument();
    });

    expect(mocks.readImageFromClipboard).toHaveBeenCalledTimes(1);
  });

  it('loads an image from a file selection', async () => {
    const file = new File(['fake-image'], 'meme.png', { type: 'image/png' });
    mocks.loadImageElementFromFile.mockResolvedValue(createImageStub(900, 900));

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /upload image/i }));
    fireEvent.change(screen.getByLabelText(/upload image file/i), {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /prepare image/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    await waitFor(() => {
      expect(screen.getByText(/meme\.png loaded/i)).toBeInTheDocument();
    });

    expect(mocks.loadImageElementFromFile).toHaveBeenCalledWith(file);
  });

  it('shows upload image preview controls before replacing the base image', async () => {
    const file = new File(['fake-image'], 'meme.png', { type: 'image/png' });
    mocks.loadImageElementFromFile.mockResolvedValue(createImageElement(1200, 800));

    const { container } = render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /upload image/i }));
    fireEvent.change(screen.getByLabelText(/upload image file/i), {
      target: { files: [file] },
    });

    const dialog = await screen.findByRole('dialog', { name: /prepare image/i });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByLabelText(/pre-insert preview/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /crop mode/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rotate 90 clockwise/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rotate 90 counter-clockwise/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /flip horizontal/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /flip vertical/i })).toBeInTheDocument();
    expect(screen.getByText('1200 x 800')).toBeInTheDocument();
    expect(container.querySelector('.pre-insert-preview-canvas')).toBeInTheDocument();
    expect(screen.getByLabelText(/meme preview canvas/i)).toHaveAttribute('width', '800');
  });

  it('keeps the current base image when upload modal is cancelled', async () => {
    const baseFile = new File(['base-image'], 'base.png', { type: 'image/png' });
    const replacementFile = new File(['replacement-image'], 'replacement.png', { type: 'image/png' });
    mocks.loadImageElementFromFile
      .mockResolvedValueOnce(createImageStub(900, 900))
      .mockResolvedValueOnce(createImageStub(1200, 800));

    const { container } = render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /upload image/i }));
    fireEvent.change(screen.getByLabelText(/upload image file/i), {
      target: { files: [baseFile] },
    });
    fireEvent.click(await screen.findByRole('button', { name: /confirm/i }));

    await waitFor(() => {
      expect(screen.getByText(/base\.png loaded/i)).toBeInTheDocument();
    });

    expect(container.querySelector('.preview-canvas')).toHaveAttribute('width', '900');

    fireEvent.click(screen.getByRole('button', { name: /upload image/i }));
    fireEvent.change(screen.getByLabelText(/upload image file/i), {
      target: { files: [replacementFile] },
    });

    const dialog = await screen.findByRole('dialog', { name: /prepare image/i });
    fireEvent.click(within(dialog).getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /prepare image/i })).not.toBeInTheDocument();
    });

    expect(screen.getByText(/base\.png loaded/i)).toBeInTheDocument();
    expect(screen.queryByText(/replacement\.png loaded/i)).not.toBeInTheDocument();
    expect(container.querySelector('.preview-canvas')).toHaveAttribute('width', '900');
  });

  it('adds a new image layer from the advanced file import flow and selects it', async () => {
    const baseFile = new File(['base-image'], 'base.png', { type: 'image/png' });
    const layerFile = new File(['layer-image'], 'sticker.png', { type: 'image/png' });
    mocks.loadImageElementFromFile
      .mockResolvedValueOnce(createImageStub(900, 900))
      .mockResolvedValueOnce(createImageStub(400, 200));

    render(<App />);

    await uploadBaseImage(baseFile, 900);

    fireEvent.click(screen.getByRole('button', { name: /advanced import from file/i }));

    fireEvent.change(screen.getByLabelText(/upload image file/i), {
      target: { files: [layerFile] },
    });

    await screen.findByRole('dialog', { name: /prepare image/i });
    fireEvent.click(screen.getByRole('button', { name: /add layer/i }));

    await waitFor(() => {
      expect(screen.getByText(/sticker\.png added as image layer/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /image 1 layer/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /settings for image 1/i })).toBeInTheDocument();
  });

  it('creates newly inserted image layers as the topmost stack entry', async () => {
    const baseFile = new File(['base-image'], 'base.png', { type: 'image/png' });
    const firstLayerFile = new File(['layer-image'], 'sticker-1.png', { type: 'image/png' });
    const secondLayerFile = new File(['layer-image'], 'sticker-2.png', { type: 'image/png' });
    mocks.loadImageElementFromFile
      .mockResolvedValueOnce(createImageStub(900, 900))
      .mockResolvedValueOnce(createImageStub(400, 200))
      .mockResolvedValueOnce(createImageStub(400, 200));

    const { container } = render(<App />);

    await uploadBaseImage(baseFile, 900);

    fireEvent.click(screen.getByRole('button', { name: /advanced import from file/i }));
    fireEvent.change(screen.getByLabelText(/upload image file/i), {
      target: { files: [firstLayerFile] },
    });
    await screen.findByRole('dialog', { name: /prepare image/i });
    fireEvent.click(screen.getByRole('button', { name: /add layer/i }));

    await waitFor(() => {
      expect(screen.getByText(/sticker-1\.png added as image layer/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /advanced import from file/i }));
    fireEvent.change(screen.getByLabelText(/upload image file/i), {
      target: { files: [secondLayerFile] },
    });
    await screen.findByRole('dialog', { name: /prepare image/i });
    fireEvent.click(screen.getByRole('button', { name: /add layer/i }));

    await waitFor(() => {
      expect(screen.getByText(/sticker-2\.png added as image layer/i)).toBeInTheDocument();
    });

    const layerButtons = screen.getAllByRole('button', { name: /image \d layer/i });
    expect(layerButtons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Image 2 layer',
      'Image 1 layer',
    ]);

    const previewSurface = container.querySelector('.preview-surface') as HTMLDivElement;
    vi.spyOn(previewSurface, 'getBoundingClientRect').mockReturnValue({
      bottom: 900,
      height: 900,
      left: 0,
      right: 900,
      top: 0,
      width: 900,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerEnter(previewSurface);
    const topmostImageBox = container.querySelector('.transform-box-image.transform-box-active') as HTMLDivElement;
    fireEvent.pointerDown(topmostImageBox, { button: 0, clientX: 450, clientY: 450 });
    fireEvent.pointerUp(window);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /image 2 layer/i })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
  });

  it('opens the pre-insert modal for advanced file import instead of inserting immediately', async () => {
    const baseFile = new File(['base-image'], 'base.png', { type: 'image/png' });
    const layerFile = new File(['layer-image'], 'sticker.png', { type: 'image/png' });
    mocks.loadImageElementFromFile
      .mockResolvedValueOnce(createImageStub(900, 900))
      .mockResolvedValueOnce(createImageStub(400, 200));

    render(<App />);

    await uploadBaseImage(baseFile, 900);

    fireEvent.click(screen.getByRole('button', { name: /advanced import from file/i }));
    fireEvent.change(screen.getByLabelText(/upload image file/i), {
      target: { files: [layerFile] },
    });

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /prepare image/i })).toBeInTheDocument();
    });

    expect(screen.getByText(/advanced import file/i)).toBeInTheDocument();
    expect(screen.queryByText(/sticker\.png added as image layer/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /image 1 layer/i })).not.toBeInTheDocument();
  });

  it('opens the pre-insert modal for advanced clipboard import', async () => {
    const baseFile = new File(['base-image'], 'base.png', { type: 'image/png' });
    mocks.loadImageElementFromFile.mockResolvedValueOnce(createImageStub(900, 900));
    mocks.readImageFromClipboard.mockResolvedValue(createImageStub(512, 256));

    render(<App />);

    await uploadBaseImage(baseFile, 900);

    fireEvent.click(screen.getByRole('button', { name: /advanced import from clipboard/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /prepare image/i })).toBeInTheDocument();
    });

    expect(mocks.readImageFromClipboard).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/advanced import clipboard/i)).toBeInTheDocument();
    expect(screen.queryByText(/image pasted from the clipboard/i)).not.toBeInTheDocument();
  });

  it('persists advanced import placement selection across modal sessions', async () => {
    const baseFile = new File(['base-image'], 'base.png', { type: 'image/png' });
    const firstLayerFile = new File(['layer-image'], 'sticker.png', { type: 'image/png' });
    const secondLayerFile = new File(['layer-image'], 'sticker-2.png', { type: 'image/png' });
    mocks.loadImageElementFromFile
      .mockResolvedValueOnce(createImageStub(900, 900))
      .mockResolvedValueOnce(createImageStub(400, 200))
      .mockResolvedValueOnce(createImageStub(320, 160));

    render(<App />);

    await uploadBaseImage(baseFile, 900);

    fireEvent.click(screen.getByRole('button', { name: /advanced import from file/i }));
    fireEvent.change(screen.getByLabelText(/upload image file/i), {
      target: { files: [firstLayerFile] },
    });

    const firstDialog = await screen.findByRole('dialog', { name: /prepare image/i });

    fireEvent.change(within(firstDialog).getByRole('combobox', { name: /placement mode/i }), {
      target: { value: 'outside-right' },
    });
    fireEvent.click(within(firstDialog).getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /prepare image/i })).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /advanced import from file/i }));
    fireEvent.change(screen.getByLabelText(/upload image file/i), {
      target: { files: [secondLayerFile] },
    });

    const secondDialog = await screen.findByRole('dialog', { name: /prepare image/i });

    expect(within(secondDialog).getByRole('combobox', { name: /placement mode/i })).toHaveValue('outside-right');
  });

  it('confirms advanced import into an image layer without replacing the base image', async () => {
    const baseFile = new File(['base-image'], 'base.png', { type: 'image/png' });
    const layerFile = new File(['layer-image'], 'sticker.png', { type: 'image/png' });
    mocks.loadImageElementFromFile
      .mockResolvedValueOnce(createImageStub(900, 900))
      .mockResolvedValueOnce(createImageStub(400, 200));

    const { container } = render(<App />);

    await uploadBaseImage(baseFile, 900);

    fireEvent.click(screen.getByRole('button', { name: /advanced import from file/i }));
    fireEvent.change(screen.getByLabelText(/upload image file/i), {
      target: { files: [layerFile] },
    });

    await screen.findByRole('dialog', { name: /prepare image/i });
    fireEvent.change(screen.getByRole('combobox', { name: /placement mode/i }), {
      target: { value: 'outside-left' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add layer/i }));

    await waitFor(() => {
      expect(screen.getByText(/sticker\.png added outside left/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/sticker\.png loaded/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /image 1 layer/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(container.querySelector('.preview-canvas')).toHaveAttribute('width', '1300');
  });

  it('shows a clipboard fallback message and leaves the scene unchanged when advanced clipboard import fails', async () => {
    const baseFile = new File(['base-image'], 'base.png', { type: 'image/png' });
    mocks.loadImageElementFromFile.mockResolvedValueOnce(createImageStub(900, 900));
    mocks.readImageFromClipboard.mockResolvedValue(null);

    const { container } = render(<App />);

    await uploadBaseImage(baseFile, 900);

    fireEvent.click(screen.getByRole('button', { name: /advanced import from clipboard/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/clipboard import could not read an image\. try paste or choose a file/i),
      ).toBeInTheDocument();
    });

    expect(screen.queryByRole('dialog', { name: /prepare image/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /image 1 layer/i })).not.toBeInTheDocument();
    expect(container.querySelector('.preview-canvas')).toHaveAttribute('width', '900');
  });

  it('shows compact inside-vs-outside placement controls in the image rail', async () => {
    render(<App />);

    expect(screen.getByRole('button', { name: /advanced import from file/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /advanced import from clipboard/i }),
    ).toBeInTheDocument();
  });

  it('shows image effect controls in the image rail and applies color adjustments to the preview', async () => {
    const file = new File(['base-image'], 'base.png', { type: 'image/png' });
    const context = createCanvasContextStub();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
    mocks.loadImageElementFromFile.mockResolvedValue(createImageStub(900, 900));

    render(<App />);
    await uploadBaseImage(file, 900);

    openAdjustmentsTab();
    expect(screen.getByRole('heading', { name: /adjustments/i })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: /brightness/i })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: /contrast/i })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: /saturation/i })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: /hue/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /grayscale/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /sepia/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /invert/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /apply to text/i })).not.toBeChecked();

    openEffectsTab();
    expect(screen.getByRole('heading', { name: /effects/i })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: /blur/i })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: /sharpen/i })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: /threshold/i })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: /pixelate/i })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: /noise/i })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: /grain/i })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: /posterize/i })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: /jpeg degrade/i })).toBeInTheDocument();
    openWatermarkTab();
    expect(screen.getByRole('heading', { name: /watermark/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /enable watermark/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /watermark text/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /watermark mode/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /watermark corner/i })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: /watermark opacity/i })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: /watermark size/i })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: /tile rotation/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/watermark color/i)).toBeInTheDocument();

    openAdjustmentsTab();
    fireEvent.change(screen.getByRole('slider', { name: /brightness/i }), {
      target: { value: '125' },
    });
    fireEvent.change(screen.getByRole('slider', { name: /contrast/i }), {
      target: { value: '90' },
    });
    fireEvent.change(screen.getByRole('slider', { name: /saturation/i }), {
      target: { value: '140' },
    });
    fireEvent.change(screen.getByRole('slider', { name: /hue/i }), {
      target: { value: '-30' },
    });

    await waitFor(() => {
      expect(context.filter).toBe(
        'brightness(125%) contrast(90%) saturate(140%) hue-rotate(-30deg) grayscale(0%) sepia(0%) invert(0%)',
      );
    });

    openEffectsTab();
    fireEvent.change(screen.getByRole('slider', { name: /blur/i }), {
      target: { value: '4' },
    });

    await waitFor(() => {
      expect(context.filter).toBe('blur(4px)');
    });
  });

  it('resets adjustments and effects independently', async () => {
    const file = new File(['base-image'], 'base.png', { type: 'image/png' });
    const context = createCanvasContextStub();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
    mocks.loadImageElementFromFile.mockResolvedValue(createImageStub(900, 900));

    render(<App />);
    await uploadBaseImage(file, 900);

    openAdjustmentsTab();
    fireEvent.change(screen.getByRole('slider', { name: /brightness/i }), { target: { value: '145' } });
    fireEvent.change(screen.getByRole('slider', { name: /contrast/i }), { target: { value: '115' } });
    fireEvent.change(screen.getByRole('slider', { name: /saturation/i }), { target: { value: '60' } });
    fireEvent.change(screen.getByRole('slider', { name: /hue/i }), { target: { value: '45' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /grayscale/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /sepia/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /invert/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /apply to text/i }));

    openEffectsTab();
    fireEvent.change(screen.getByRole('slider', { name: /blur/i }), { target: { value: '6' } });
    fireEvent.change(screen.getByRole('slider', { name: /sharpen/i }), { target: { value: '30' } });
    fireEvent.change(screen.getByRole('slider', { name: /threshold/i }), { target: { value: '55' } });
    fireEvent.change(screen.getByRole('slider', { name: /pixelate/i }), { target: { value: '7' } });
    fireEvent.change(screen.getByRole('slider', { name: /noise/i }), { target: { value: '12' } });
    fireEvent.change(screen.getByRole('slider', { name: /grain/i }), { target: { value: '16' } });
    fireEvent.change(screen.getByRole('slider', { name: /posterize/i }), { target: { value: '24' } });
    fireEvent.change(screen.getByRole('slider', { name: /jpeg degrade/i }), { target: { value: '40' } });

    await waitFor(() => {
      expect(context.filter).toBe('blur(6px)');
    });

    openAdjustmentsTab();
    fireEvent.click(screen.getByRole('button', { name: /reset adjustments/i }));

    await waitFor(() => {
      expect(screen.getByRole('slider', { name: /brightness/i })).toHaveValue('100');
      expect(screen.getByRole('slider', { name: /contrast/i })).toHaveValue('100');
      expect(screen.getByRole('slider', { name: /saturation/i })).toHaveValue('100');
      expect(screen.getByRole('slider', { name: /hue/i })).toHaveValue('0');
      expect(screen.getByRole('checkbox', { name: /grayscale/i })).not.toBeChecked();
      expect(screen.getByRole('checkbox', { name: /sepia/i })).not.toBeChecked();
      expect(screen.getByRole('checkbox', { name: /invert/i })).not.toBeChecked();
      expect(screen.getByRole('checkbox', { name: /apply to text/i })).not.toBeChecked();
    });

    openEffectsTab();
    fireEvent.click(screen.getByRole('button', { name: /reset effects/i }));

    await waitFor(() => {
      expect(screen.getByRole('slider', { name: /blur/i })).toHaveValue('0');
      expect(screen.getByRole('slider', { name: /sharpen/i })).toHaveValue('0');
      expect(screen.getByRole('slider', { name: /threshold/i })).toHaveValue('0');
      expect(screen.getByRole('slider', { name: /pixelate/i })).toHaveValue('0');
      expect(screen.getByRole('slider', { name: /noise/i })).toHaveValue('0');
      expect(screen.getByRole('slider', { name: /grain/i })).toHaveValue('0');
      expect(screen.getByRole('slider', { name: /posterize/i })).toHaveValue('0');
      expect(screen.getByRole('slider', { name: /jpeg degrade/i })).toHaveValue('0');
    });
  });

  it('renders and resets watermark controls independently from the effect stack', async () => {
    const file = new File(['base-image'], 'base.png', { type: 'image/png' });
    const context = createCanvasContextStub();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
    mocks.loadImageElementFromFile.mockResolvedValue(createImageStub(900, 900));

    render(<App />);
    await uploadBaseImage(file, 900);

    openWatermarkTab();
    fireEvent.click(screen.getByRole('checkbox', { name: /enable watermark/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /watermark text/i }), {
      target: { value: '' },
    });

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /watermark text/i })).toHaveValue('');
    });

    fireEvent.change(screen.getByRole('textbox', { name: /watermark text/i }), {
      target: { value: 'PRIVATE' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: /watermark mode/i }), {
      target: { value: 'tile' },
    });
    fireEvent.change(screen.getByRole('slider', { name: /tile rotation/i }), {
      target: { value: '35' },
    });
    fireEvent.change(screen.getByRole('slider', { name: /watermark opacity/i }), {
      target: { value: '50' },
    });
    fireEvent.change(screen.getByRole('slider', { name: /watermark size/i }), {
      target: { value: '40' },
    });
    fireEvent.change(screen.getByLabelText(/watermark color/i), {
      target: { value: '#808080' },
    });

    await waitFor(() => {
      expect(context.fillText).toHaveBeenCalledWith('PRIVATE', 0, 0);
    });

    fireEvent.click(screen.getByRole('button', { name: /reset watermark/i }));

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: /enable watermark/i })).not.toBeChecked();
      expect(screen.getByRole('textbox', { name: /watermark text/i })).toHaveValue('meme-elf');
      expect(screen.getByRole('combobox', { name: /watermark mode/i })).toHaveValue('corner');
      expect(screen.getByRole('combobox', { name: /watermark corner/i })).toHaveValue('bottom-left');
      expect(screen.getByRole('slider', { name: /watermark opacity/i })).toHaveValue('50');
      expect(screen.getByRole('slider', { name: /watermark size/i })).toHaveValue('16');
      expect(screen.getByRole('slider', { name: /tile rotation/i })).toHaveValue('0');
      expect(screen.getByLabelText(/watermark color/i)).toHaveValue('#808080');
    });
  });

  it('changes size defaults when switching between centered and corner watermark modes', async () => {
    const file = new File(['base-image'], 'base.png', { type: 'image/png' });
    mocks.loadImageElementFromFile.mockResolvedValue(createImageStub(900, 900));

    render(<App />);
    await uploadBaseImage(file, 900);

    openWatermarkTab();
    fireEvent.change(screen.getByRole('combobox', { name: /watermark mode/i }), {
      target: { value: 'center' },
    });

    await waitFor(() => {
      expect(screen.getByRole('slider', { name: /watermark size/i })).toHaveValue('240');
    });

    fireEvent.change(screen.getByRole('combobox', { name: /watermark mode/i }), {
      target: { value: 'corner' },
    });

    await waitFor(() => {
      expect(screen.getByRole('slider', { name: /watermark size/i })).toHaveValue('16');
    });
  });

  it('reorders scene effects in the image rail by drag and drop', async () => {
    const file = new File(['base-image'], 'base.png', { type: 'image/png' });
    mocks.loadImageElementFromFile.mockResolvedValue(createImageStub(900, 900));

    const { container } = render(<App />);
    await uploadBaseImage(file, 900);

    openEffectsTab();
    const getEffectOrder = () =>
      Array.from(container.querySelectorAll('.effect-card-title')).map((node) => node.textContent);

    expect(getEffectOrder()).toEqual([
      'Blur',
      'Sharpen',
      'Threshold',
      'Pixelate',
      'Noise',
      'Grain',
      'Posterize',
      'JPEG degrade',
    ]);

    const dataTransfer = {
      data: new Map<string, string>(),
      getData(type: string) {
        return this.data.get(type) ?? '';
      },
      setData(type: string, value: string) {
        this.data.set(type, value);
      },
    };
    const posterizeCard = screen.getByText('Posterize').closest('.effect-card') as HTMLDivElement;
    vi.spyOn(posterizeCard, 'getBoundingClientRect').mockReturnValue({
      bottom: 140,
      height: 40,
      left: 0,
      right: 320,
      top: 100,
      width: 320,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    });

    fireEvent.dragStart(screen.getByRole('button', { name: /reorder noise effect/i }), {
      dataTransfer,
    });
    fireEvent.dragOver(posterizeCard, { clientY: 110 });
    fireEvent.drop(posterizeCard, { clientY: 110, dataTransfer });
    fireEvent.dragEnd(screen.getByRole('button', { name: /reorder noise effect/i }), {
      dataTransfer,
    });

    expect(getEffectOrder()).toEqual([
      'Blur',
      'Sharpen',
      'Threshold',
      'Pixelate',
      'Grain',
      'Posterize',
      'Noise',
      'JPEG degrade',
    ]);
  });

  it('removes image layers without reusing ids or disturbing remaining layer order', async () => {
    const baseFile = new File(['base-image'], 'base.png', { type: 'image/png' });
    const firstLayerFile = new File(['layer-image'], 'sticker-1.png', { type: 'image/png' });
    const secondLayerFile = new File(['layer-image'], 'sticker-2.png', { type: 'image/png' });
    const thirdLayerFile = new File(['layer-image'], 'sticker-3.png', { type: 'image/png' });
    mocks.loadImageElementFromFile
      .mockResolvedValueOnce(createImageStub(900, 900))
      .mockResolvedValueOnce(createImageStub(400, 200))
      .mockResolvedValueOnce(createImageStub(320, 160))
      .mockResolvedValueOnce(createImageStub(280, 140));

    render(<App />);

    await uploadBaseImage(baseFile, 900);

    for (const file of [firstLayerFile, secondLayerFile]) {
      fireEvent.click(screen.getByRole('button', { name: /advanced import from file/i }));
      fireEvent.change(screen.getByLabelText(/upload image file/i), {
        target: { files: [file] },
      });
      await screen.findByRole('dialog', { name: /prepare image/i });
      fireEvent.click(screen.getByRole('button', { name: /add layer/i }));
      await waitFor(() => {
        expect(
          screen.getByText(new RegExp(`${escapeForRegex(file.name)} added as image layer`, 'i')),
        ).toBeInTheDocument();
      });
    }

    fireEvent.click(screen.getByRole('button', { name: /settings for image 1/i }));
    fireEvent.click(screen.getByRole('button', { name: /remove layer/i }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /image 1 layer/i })).not.toBeInTheDocument();
    });

    expect(screen.getAllByRole('button', { name: /image \d layer/i }).map((button) => button.getAttribute('aria-label'))).toEqual([
      'Image 2 layer',
    ]);

    fireEvent.click(screen.getByRole('button', { name: /advanced import from file/i }));
    fireEvent.change(screen.getByLabelText(/upload image file/i), {
      target: { files: [thirdLayerFile] },
    });
    await screen.findByRole('dialog', { name: /prepare image/i });
    fireEvent.click(screen.getByRole('button', { name: /add layer/i }));

    await waitFor(() => {
      expect(screen.getByText(/sticker-3\.png added as image layer/i)).toBeInTheDocument();
    });

    expect(screen.getAllByRole('button', { name: /image \d layer/i }).map((button) => button.getAttribute('aria-label'))).toEqual([
      'Image 3 layer',
      'Image 2 layer',
    ]);
  });

  it('removes the redundant counter-clockwise rotate control from image-layer inspector settings', async () => {
    const baseFile = new File(['base-image'], 'base.png', { type: 'image/png' });
    const layerFile = new File(['layer-image'], 'sticker.png', { type: 'image/png' });
    mocks.loadImageElementFromFile
      .mockResolvedValueOnce(createImageStub(900, 900))
      .mockResolvedValueOnce(createImageStub(400, 200));

    render(<App />);

    await uploadBaseImage(baseFile, 900);
    fireEvent.click(screen.getByRole('button', { name: /advanced import from file/i }));
    fireEvent.change(screen.getByLabelText(/upload image file/i), {
      target: { files: [layerFile] },
    });
    await screen.findByRole('dialog', { name: /prepare image/i });
    fireEvent.click(screen.getByRole('button', { name: /add layer/i }));

    await waitFor(() => {
      expect(screen.getByText(/sticker\.png added as image layer/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /settings for image 1/i }));

    expect(screen.getByRole('button', { name: /rotate 90 clockwise/i })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /rotate 90 counter-clockwise/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove layer/i })).toBeInTheDocument();
  });

  it('adjusts canvas zoom from the meme header without changing canvas composition size', () => {
    const { container } = render(<App />);

    const editorToolbar = screen.getByRole('toolbar', { name: /editor actions/i });
    const zoomToolbar = screen.getByRole('toolbar', { name: /canvas tools/i });
    expect(within(editorToolbar).queryByRole('button', { name: /zoom in/i })).not.toBeInTheDocument();
    expect(within(zoomToolbar).getByRole('button', { name: /zoom in/i })).toBeInTheDocument();
    expect(screen.queryByText(/preview zoom/i)).not.toBeInTheDocument();

    const previewSurface = container.querySelector('.preview-surface') as HTMLDivElement;
    const previewViewport = container.querySelector('.preview-viewport') as HTMLDivElement;
    const previewCanvas = screen.getByLabelText(/meme preview canvas/i);
    const initialWidthStyle = previewSurface.style.width;
    const initialHeightStyle = previewSurface.style.height;
    const initialWidth = previewCanvas.getAttribute('width');
    const initialHeight = previewCanvas.getAttribute('height');

    fireEvent.click(screen.getByRole('button', { name: /zoom in/i }));

    expect(previewSurface.style.width).not.toBe(initialWidthStyle);
    expect(previewSurface.style.height).not.toBe(initialHeightStyle);
    expect(previewCanvas).toHaveAttribute('width', initialWidth ?? '');
    expect(previewCanvas).toHaveAttribute('height', initialHeight ?? '');
    expect(previewViewport).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /zoom out/i }));
    expect(previewSurface.style.width).toBe(initialWidthStyle);
    expect(previewSurface.style.height).toBe(initialHeightStyle);

    fireEvent.click(screen.getByRole('button', { name: /zoom in/i }));
    fireEvent.click(screen.getByRole('button', { name: /zoom in/i }));
    expect(previewSurface.style.width).not.toBe(initialWidthStyle);

    fireEvent.click(screen.getByRole('button', { name: /reset zoom/i }));
    expect(previewSurface.style.width).toBe(initialWidthStyle);
  });

  it('zooms the canvas with the mouse wheel while the pointer is over the preview stage', () => {
    const { container } = render(<App />);

    const previewStage = container.querySelector('.preview-stage') as HTMLDivElement;
    const previewSurface = container.querySelector('.preview-surface') as HTMLDivElement;
    const initialWidthStyle = previewSurface.style.width;

    fireEvent.wheel(previewStage, { deltaY: -100 });
    expect(previewSurface.style.width).not.toBe(initialWidthStyle);

    fireEvent.wheel(previewStage, { deltaY: 100 });
    expect(previewSurface.style.width).toBe(initialWidthStyle);
  });

  it('undoes with the physical Z key even when the keyboard layout is not English', async () => {
    render(<App />);
    const topTextarea = screen.getByRole('textbox', { name: /top text/i });

    fireEvent.focus(topTextarea);
    fireEvent.change(topTextarea, {
      target: { value: 'NEW TOP TEXT' },
    });
    fireEvent.blur(topTextarea);

    expect(topTextarea).toHaveValue('NEW TOP TEXT');

    fireEvent.keyDown(document, {
      code: 'KeyZ',
      ctrlKey: true,
      key: 'я',
    });

    await waitFor(() => {
      expect(topTextarea).toHaveValue('');
    });
  });

  it('pans the zoomed canvas with the middle mouse button instead of relying on scrollbars', () => {
    const { container } = render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /zoom in/i }));

    const previewStage = container.querySelector('.preview-stage') as HTMLDivElement;
    const previewSurface = container.querySelector('.preview-surface') as HTMLDivElement;

    expect(previewSurface.style.transform).toBe('translate(0px, 0px)');

    fireEvent.mouseDown(previewStage, { button: 1, clientX: 200, clientY: 120 });
    fireEvent.mouseMove(window, { clientX: 240, clientY: 150 });
    fireEvent.mouseUp(window);

    expect(previewSurface.style.transform).toBe('translate(40px, 30px)');
  });

  it('shows preview overlays when hovering the full preview stage', () => {
    const { container } = render(<App />);

    const previewStage = container.querySelector('.preview-stage') as HTMLDivElement;
    const previewSurface = container.querySelector('.preview-surface') as HTMLDivElement;

    expect(previewSurface).not.toHaveClass('preview-surface-overlay-visible');

    fireEvent.pointerEnter(previewStage);
    expect(previewSurface).toHaveClass('preview-surface-overlay-visible');

    fireEvent.pointerLeave(previewStage);
    expect(previewSurface).not.toHaveClass('preview-surface-overlay-visible');
  });

  it('keeps preview overlays visible when the pointer moves from the stage onto visible zoom overflow', () => {
    const { container } = render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /zoom in/i }));
    fireEvent.click(screen.getByRole('button', { name: /zoom in/i }));

    const previewStage = container.querySelector('.preview-stage') as HTMLDivElement;
    const previewSurface = container.querySelector('.preview-surface') as HTMLDivElement;

    fireEvent.pointerEnter(previewStage);
    fireEvent.pointerEnter(previewSurface);
    expect(previewSurface).toHaveClass('preview-surface-overlay-visible');

    fireEvent.pointerLeave(previewStage);

    expect(previewSurface).toHaveClass('preview-surface-overlay-visible');
  });

  it('keeps image-layer overlay selection working after zoom', async () => {
    const baseFile = new File(['base-image'], 'base.png', { type: 'image/png' });
    const layerFile = new File(['layer-image'], 'sticker.png', { type: 'image/png' });
    mocks.loadImageElementFromFile
      .mockResolvedValueOnce(createImageStub(900, 900))
      .mockResolvedValueOnce(createImageStub(400, 200));

    const { container } = render(<App />);

    await uploadBaseImage(baseFile, 900);

    fireEvent.click(screen.getByRole('button', { name: /advanced import from file/i }));
    fireEvent.change(screen.getByLabelText(/upload image file/i), {
      target: { files: [layerFile] },
    });

    await screen.findByRole('dialog', { name: /prepare image/i });
    fireEvent.click(screen.getByRole('button', { name: /add layer/i }));

    await waitFor(() => {
      expect(screen.getByText(/sticker\.png added as image layer/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /zoom in/i }));
    fireEvent.click(screen.getByRole('button', { name: /zoom in/i }));

    const previewSurface = container.querySelector('.preview-surface') as HTMLDivElement;
    vi.spyOn(previewSurface, 'getBoundingClientRect').mockReturnValue({
      bottom: 1350,
      height: 1350,
      left: 0,
      right: 1350,
      top: 0,
      width: 1350,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerEnter(previewSurface);
    fireEvent.focus(screen.getByRole('textbox', { name: /top text/i }));
    expect(screen.getByRole('button', { name: /image 1 layer/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    const imageBox = container.querySelector('.transform-box-image') as HTMLDivElement;
    fireEvent.pointerDown(imageBox, { button: 0, clientX: 675, clientY: 675 });
    fireEvent.pointerUp(window);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /image 1 layer/i })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
  });

  it('maps scaled preview pointer coordinates back into canvas space', () => {
    const shell = document.createElement('div');

    vi.spyOn(shell, 'getBoundingClientRect').mockReturnValue({
      bottom: 1350,
      height: 1350,
      left: 0,
      right: 1350,
      top: 0,
      width: 1350,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    expect(getCanvasPoint(shell, 900, 900, 675, 675)).toEqual({ x: 450, y: 450 });
  });

  it('grows the canvas on outside-left insertion and shifts existing overlays to the right', async () => {
    const context = createCanvasContextStub();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
    const baseFile = new File(['base-image'], 'base.png', { type: 'image/png' });
    const firstLayerFile = new File(['layer-image'], 'sticker.png', { type: 'image/png' });
    const outsideLayerFile = new File(['outside-image'], 'outside.png', { type: 'image/png' });
    mocks.loadImageElementFromFile
      .mockResolvedValueOnce(createImageStub(900, 900))
      .mockResolvedValueOnce(createImageStub(400, 200))
      .mockResolvedValueOnce(createImageStub(200, 100));

    const { container } = render(<App />);

    await uploadBaseImage(baseFile);

    fireEvent.click(screen.getByRole('button', { name: /advanced import from file/i }));
    fireEvent.change(screen.getByLabelText(/upload image file/i), {
      target: { files: [firstLayerFile] },
    });
    await screen.findByRole('dialog', { name: /prepare image/i });
    fireEvent.click(screen.getByRole('button', { name: /add layer/i }));

    await waitFor(() => {
      expect(screen.getByText(/sticker\.png added as image layer/i)).toBeInTheDocument();
    });

    const previewSurface = container.querySelector('.preview-surface') as HTMLDivElement;
    vi.spyOn(previewSurface, 'getBoundingClientRect').mockReturnValue({
      bottom: 900,
      height: 900,
      left: 0,
      right: 900,
      top: 0,
      width: 900,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    fireEvent.pointerEnter(previewSurface);

    const firstImageBox = await waitFor(() => {
      const activeImageBox = container.querySelector(
        '.transform-box-image.transform-box-active',
      );

      if (!(activeImageBox instanceof HTMLDivElement)) {
        throw new Error('Initial image layer overlay not ready');
      }

      return activeImageBox;
    });
    const initialLeft = parseFloat(firstImageBox.style.left);

    fireEvent.click(screen.getByRole('button', { name: /advanced import from file/i }));
    fireEvent.change(screen.getByLabelText(/upload image file/i), {
      target: { files: [outsideLayerFile] },
    });
    await screen.findByRole('dialog', { name: /prepare image/i });
    fireEvent.change(screen.getByRole('combobox', { name: /placement mode/i }), {
      target: { value: 'outside-left' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add layer/i }));

    await waitFor(() => {
      expect(screen.getByText(/outside\.png added outside left/i)).toBeInTheDocument();
    });

    const grownCanvas = container.querySelector('.preview-canvas') as HTMLCanvasElement;
    expect(grownCanvas.width).toBe(1100);
    expect(grownCanvas.height).toBe(900);

    const shiftedImageBox = await waitFor(() => {
      const imageBoxes = Array.from(container.querySelectorAll('.transform-box-image'));
      const shiftedBox = imageBoxes.find((box) => {
        return parseFloat((box as HTMLDivElement).style.left) > initialLeft;
      });

      if (!(shiftedBox instanceof HTMLDivElement)) {
        throw new Error('Shifted image layer overlay not ready');
      }

      return shiftedBox;
    });

    expect(parseFloat(shiftedImageBox.style.left)).toBeGreaterThan(initialLeft);
    expect(container.querySelector('.transform-box-image.transform-box-active')).toHaveStyle({
      left: '0%',
    });
    expect(container.querySelector('.transform-box-text')).toHaveStyle({
      left: `${(227 / 1100) * 100}%`,
    });
  });

  it('shows image-only transform controls in the left rail and applies them to the selected image layer', async () => {
    const context = createCanvasContextStub();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
    const baseFile = new File(['base-image'], 'base.png', { type: 'image/png' });
    const layerFile = new File(['layer-image'], 'sticker.png', { type: 'image/png' });
    mocks.loadImageElementFromFile
      .mockResolvedValueOnce(createImageStub(900, 900))
      .mockResolvedValueOnce(createImageStub(400, 200));

    const { container } = render(<App />);

    await uploadBaseImage(baseFile);

    fireEvent.click(screen.getByRole('button', { name: /advanced import from file/i }));
    fireEvent.change(screen.getByLabelText(/upload image file/i), {
      target: { files: [layerFile] },
    });
    await screen.findByRole('dialog', { name: /prepare image/i });
    fireEvent.click(screen.getByRole('button', { name: /add layer/i }));

    await waitFor(() => {
      expect(screen.getByText(/sticker\.png added as image layer/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /settings for image 1/i }));

    expect(screen.getByRole('button', { name: /rotate 90 clockwise/i })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /rotate 90 counter-clockwise/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /flip horizontal/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /flip vertical/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove layer/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /rotate 90 clockwise for top/i })).not.toBeInTheDocument();

    const imageBox = container.querySelector('.transform-box-image') as HTMLDivElement;
    const initialTransform = imageBox.style.transform;

    fireEvent.click(screen.getByRole('button', { name: /rotate 90 clockwise/i }));

    await waitFor(() => {
      const rotatedBox = container.querySelector('.transform-box-image') as HTMLDivElement;
      expect(rotatedBox.style.transform).not.toBe(initialTransform);
      expect(rotatedBox.style.transform).toContain('rotate(');
    });

    fireEvent.click(screen.getByRole('button', { name: /flip horizontal/i }));
    fireEvent.click(screen.getByRole('button', { name: /flip vertical/i }));

    await waitFor(() => {
      expect(context.scale).toHaveBeenCalledWith(-1, -1);
    });
  });

  it('selects an image layer from the canvas overlay', async () => {
    const context = createCanvasContextStub();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);

    const baseFile = new File(['base-image'], 'base.png', { type: 'image/png' });
    const layerFile = new File(['layer-image'], 'sticker.png', { type: 'image/png' });
    mocks.loadImageElementFromFile
      .mockResolvedValueOnce(createImageStub(900, 900))
      .mockResolvedValueOnce(createImageStub(400, 200));

    const { container } = render(<App />);

    await uploadBaseImage(baseFile);

    fireEvent.click(screen.getByRole('button', { name: /advanced import from file/i }));

    fireEvent.change(screen.getByLabelText(/upload image file/i), {
      target: { files: [layerFile] },
    });
    await screen.findByRole('dialog', { name: /prepare image/i });
    fireEvent.click(screen.getByRole('button', { name: /add layer/i }));

    await waitFor(() => {
      expect(screen.getByText(/sticker\.png added as image layer/i)).toBeInTheDocument();
    });

    const previewSurface = container.querySelector('.preview-surface') as HTMLDivElement;
    vi.spyOn(previewSurface, 'getBoundingClientRect').mockReturnValue({
      bottom: 900,
      height: 900,
      left: 0,
      right: 900,
      top: 0,
      width: 900,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerEnter(previewSurface);
    fireEvent.focus(screen.getByRole('textbox', { name: /top text/i }));
    const imageBox = container.querySelector('.transform-box-image') as HTMLDivElement;
    fireEvent.pointerDown(imageBox, { button: 0, clientX: 450, clientY: 450 });
    fireEvent.pointerUp(window);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /image 1 layer/i })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });

    expect(container.querySelector('.transform-box-image.transform-box-active')).toBeInTheDocument();
  });

  it('handles pasted images from the global paste event', async () => {
    mocks.extractImageFromPasteEvent.mockResolvedValue(createImageStub(1024, 512));

    render(<App />);
    fireEvent.paste(document, new Event('paste', { bubbles: true }));

    await waitFor(() => {
      expect(screen.getByText(/image pasted from the clipboard/i)).toBeInTheDocument();
    });

    expect(mocks.extractImageFromPasteEvent).toHaveBeenCalledTimes(1);
  });

  it('does not replace the base image from paste while the upload modal is open', async () => {
    const baseFile = new File(['base-image'], 'base.png', { type: 'image/png' });
    const replacementFile = new File(['replacement-image'], 'replacement.png', { type: 'image/png' });
    mocks.loadImageElementFromFile
      .mockResolvedValueOnce(createImageStub(900, 900))
      .mockResolvedValueOnce(createImageElement(1200, 800));
    mocks.extractImageFromPasteEvent.mockResolvedValue(createImageStub(1024, 512));

    render(<App />);

    await uploadBaseImage(baseFile, 900);

    fireEvent.click(screen.getByRole('button', { name: /upload image/i }));
    fireEvent.change(screen.getByLabelText(/upload image file/i), {
      target: { files: [replacementFile] },
    });

    await screen.findByRole('dialog', { name: /prepare image/i });
    fireEvent.paste(document);

    expect(mocks.extractImageFromPasteEvent).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: /prepare image/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/meme preview canvas/i)).toHaveAttribute('width', '900');
    expect(screen.queryByText(/image pasted from the clipboard/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/replacement\.png loaded/i)).not.toBeInTheDocument();
  });

  it('does not copy the background canvas while the upload modal is open', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const blob = new Blob(['png'], { type: 'image/png' });
    const baseFile = new File(['base-image'], 'base.png', { type: 'image/png' });
    const replacementFile = new File(['replacement-image'], 'replacement.png', { type: 'image/png' });

    vi.stubGlobal('ClipboardItem', class ClipboardItemStub {
      constructor(public items: Record<string, Blob>) {}
    });
    Object.assign(navigator, {
      clipboard: {
        write,
      },
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      callback(blob);
    });
    mocks.loadImageElementFromFile
      .mockResolvedValueOnce(createImageStub(900, 900))
      .mockResolvedValueOnce(createImageElement(1200, 800));

    render(<App />);

    await uploadBaseImage(baseFile, 900);

    fireEvent.click(screen.getByRole('button', { name: /upload image/i }));
    fireEvent.change(screen.getByLabelText(/upload image file/i), {
      target: { files: [replacementFile] },
    });

    const dialog = await screen.findByRole('dialog', { name: /prepare image/i });
    fireEvent.keyDown(dialog, { ctrlKey: true, key: 'c' });
    fireEvent.copy(dialog);

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    });

    expect(write).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: /prepare image/i })).toBeInTheDocument();
    expect(screen.queryByText(/image copied to the clipboard/i)).not.toBeInTheDocument();
  });

  it('keeps tab navigation inside the upload modal while it is open', async () => {
    const baseFile = new File(['base-image'], 'base.png', { type: 'image/png' });
    const replacementFile = new File(['replacement-image'], 'replacement.png', { type: 'image/png' });
    mocks.loadImageElementFromFile
      .mockResolvedValueOnce(createImageStub(900, 900))
      .mockResolvedValueOnce(createImageElement(1200, 800));

    render(<App />);

    await uploadBaseImage(baseFile, 900);

    const topTextInput = screen.getByRole('textbox', { name: /top text/i });

    fireEvent.click(screen.getByRole('button', { name: /upload image/i }));
    fireEvent.change(screen.getByLabelText(/upload image file/i), {
      target: { files: [replacementFile] },
    });

    await screen.findByRole('dialog', { name: /prepare image/i });

    const closeButton = screen.getByRole('button', { name: /close modal/i });
    const confirmButton = screen.getByRole('button', { name: /confirm/i });

    confirmButton.focus();
    fireEvent.keyDown(confirmButton, { key: 'Tab' });
    expect(closeButton).toHaveFocus();
    expect(topTextInput).not.toHaveFocus();

    closeButton.focus();
    fireEvent.keyDown(closeButton, { key: 'Tab', shiftKey: true });
    expect(confirmButton).toHaveFocus();
    expect(topTextInput).not.toHaveFocus();
  });

  it('restores focus to the upload button after cancelling the real upload flow', async () => {
    const file = new File(['fake-image'], 'meme.png', { type: 'image/png' });
    mocks.loadImageElementFromFile.mockResolvedValue(createImageElement(1200, 800));

    render(<App />);

    const uploadButton = screen.getByRole('button', { name: /upload image/i });
    const uploadInput = screen.getByLabelText(/upload image file/i);
    uploadButton.focus();

    fireEvent.click(uploadButton);
    uploadInput.focus();
    fireEvent.change(uploadInput, {
      target: { files: [file] },
    });

    const dialog = await screen.findByRole('dialog', { name: /prepare image/i });
    fireEvent.click(within(dialog).getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /prepare image/i })).not.toBeInTheDocument();
    });

    expect(uploadButton).toHaveFocus();
  });

  it('restores focus to the upload button after confirming the real upload flow', async () => {
    const file = new File(['fake-image'], 'meme.png', { type: 'image/png' });
    mocks.loadImageElementFromFile.mockResolvedValue(createImageElement(1200, 800));

    render(<App />);

    const uploadButton = screen.getByRole('button', { name: /upload image/i });
    const uploadInput = screen.getByLabelText(/upload image file/i);
    uploadButton.focus();

    fireEvent.click(uploadButton);
    uploadInput.focus();
    fireEvent.change(uploadInput, {
      target: { files: [file] },
    });

    await screen.findByRole('dialog', { name: /prepare image/i });
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /prepare image/i })).not.toBeInTheDocument();
    });

    expect(uploadButton).toHaveFocus();
  });

  it('keeps an in-flight upload-image request in the base-image flow even if advanced import starts before file decode resolves', async () => {
    const baseFile = new File(['base-image'], 'base.png', { type: 'image/png' });
    const replacementFile = new File(['replacement-image'], 'replacement.png', { type: 'image/png' });
    const pendingReplacement = createDeferredPromise<HTMLImageElement>();
    mocks.loadImageElementFromFile
      .mockResolvedValueOnce(createImageStub(900, 900))
      .mockImplementationOnce(() => pendingReplacement.promise);
    mocks.readImageFromClipboard.mockResolvedValue(createImageStub(320, 160));

    render(<App />);

    await uploadBaseImage(baseFile, 900);

    fireEvent.click(screen.getByRole('button', { name: /upload image/i }));
    fireEvent.change(screen.getByLabelText(/upload image file/i), {
      target: { files: [replacementFile] },
    });

    await waitFor(() => {
      expect(screen.getByText(/loading replacement\.png/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /advanced import from clipboard/i }));

    const dialog = await screen.findByRole('dialog', { name: /prepare image/i });
    fireEvent.click(within(dialog).getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /prepare image/i })).not.toBeInTheDocument();
    });

    pendingReplacement.resolve(createImageElement(1200, 800));

    const resumedDialog = await screen.findByRole('dialog', { name: /prepare image/i });

    expect(within(resumedDialog).getByText(/^upload image$/i)).toBeInTheDocument();
    expect(within(resumedDialog).queryByText(/^advanced import file$/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    await waitFor(() => {
      expect(screen.getByText(/replacement\.png loaded/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/replacement\.png added as image layer/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /image 1 layer/i })).not.toBeInTheDocument();
  });

  it('restores focus to the advanced import trigger after cancelling advanced file import', async () => {
    const baseFile = new File(['base-image'], 'base.png', { type: 'image/png' });
    const layerFile = new File(['layer-image'], 'sticker.png', { type: 'image/png' });
    mocks.loadImageElementFromFile
      .mockResolvedValueOnce(createImageStub(900, 900))
      .mockResolvedValueOnce(createImageElement(400, 200));

    render(<App />);

    await uploadBaseImage(baseFile, 900);

    const advancedImportButton = screen.getByRole('button', { name: /advanced import from file/i });
    const uploadInput = screen.getByLabelText(/upload image file/i);

    advancedImportButton.focus();
    fireEvent.click(advancedImportButton);
    uploadInput.focus();
    fireEvent.change(uploadInput, {
      target: { files: [layerFile] },
    });

    const dialog = await screen.findByRole('dialog', { name: /prepare image/i });
    fireEvent.click(within(dialog).getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /prepare image/i })).not.toBeInTheDocument();
    });

    expect(advancedImportButton).toHaveFocus();
  });

  it('ignores stale clipboard results when a newer clipboard import action starts before the older one resolves', async () => {
    const baseClipboardRead = createDeferredPromise<HTMLImageElement | null>();
    const advancedClipboardRead = createDeferredPromise<HTMLImageElement | null>();

    mocks.readImageFromClipboard
      .mockImplementationOnce(() => baseClipboardRead.promise)
      .mockImplementationOnce(() => advancedClipboardRead.promise);

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /paste from clipboard/i }));
    await waitFor(() => {
      expect(screen.getByText(/reading the clipboard/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /advanced import from clipboard/i }));

    await waitFor(() => {
      expect(screen.getByText(/reading the clipboard for advanced import/i)).toBeInTheDocument();
    });

    advancedClipboardRead.resolve(createImageStub(320, 160));

    const dialog = await screen.findByRole('dialog', { name: /prepare image/i });
    expect(within(dialog).getByText(/advanced import clipboard/i)).toBeInTheDocument();

    baseClipboardRead.resolve(createImageStub(1200, 800));

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole('dialog', { name: /prepare image/i })).toBeInTheDocument();
    expect(within(dialog).getByText(/advanced import clipboard/i)).toBeInTheDocument();
    expect(screen.queryByText(/image loaded from clipboard/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/meme preview canvas/i)).toHaveAttribute('width', '800');
  });

  it('applies preview transforms before confirming an uploaded base image', async () => {
    const file = new File(['fake-image'], 'meme.png', { type: 'image/png' });
    const context = createCanvasContextStub();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
    mocks.loadImageElementFromFile.mockResolvedValue(createImageElement(1200, 800));

    const { container } = render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /upload image/i }));
    fireEvent.change(screen.getByLabelText(/upload image file/i), {
      target: { files: [file] },
    });

    await screen.findByRole('dialog', { name: /prepare image/i });
    fireEvent.click(screen.getByRole('button', { name: /rotate 90 clockwise/i }));
    fireEvent.click(screen.getByRole('button', { name: /flip horizontal/i }));

    expect(container.querySelector('.pre-insert-preview-canvas')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    await waitFor(() => {
      expect(screen.getByText(/meme\.png loaded/i)).toBeInTheDocument();
    });

    expect(context.rotate).toHaveBeenCalledWith(Math.PI / 2);
    expect(context.scale).toHaveBeenCalledWith(-1, 1);
  });

  it('applies a dragged crop box before confirming an uploaded base image', async () => {
    const file = new File(['fake-image'], 'meme.png', { type: 'image/png' });
    mocks.loadImageElementFromFile.mockResolvedValue(createImageElement(1200, 800));

    const { container } = render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /upload image/i }));
    fireEvent.change(screen.getByLabelText(/upload image file/i), {
      target: { files: [file] },
    });

    await screen.findByRole('dialog', { name: /prepare image/i });
    fireEvent.click(screen.getByRole('button', { name: /crop mode/i }));

    const previewCanvas = container.querySelector('.pre-insert-preview-canvas') as HTMLCanvasElement;
    vi.spyOn(previewCanvas, 'getBoundingClientRect').mockReturnValue({
      bottom: 200,
      height: 200,
      left: 0,
      right: 300,
      top: 0,
      width: 300,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.mouseDown(screen.getByLabelText(/pre-insert preview/i), {
      clientX: 30,
      clientY: 20,
    });
    fireEvent.mouseMove(window, {
      clientX: 180,
      clientY: 120,
    });
    fireEvent.mouseUp(window);

    await waitFor(() => {
      expect(screen.getByText('600 x 400')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    await waitFor(() => {
      expect(screen.getByText(/meme\.png loaded/i)).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/meme preview canvas/i)).toHaveAttribute('width', '600');
  });

  it('applies a scene crop from the bounds controls without mutating the canvas before apply', async () => {
    const baseFile = new File(['base-image'], 'base.png', { type: 'image/png' });
    mocks.loadImageElementFromFile.mockResolvedValue(createImageStub(900, 900));

    render(<App />);
    await uploadBaseImage(baseFile, 900);

    openCropTab();
    fireEvent.click(screen.getByRole('button', { name: /crop scene/i }));

    const previewSurface = document.querySelector('.preview-surface') as HTMLDivElement;
    vi.spyOn(previewSurface, 'getBoundingClientRect').mockReturnValue({
      bottom: 450,
      height: 450,
      left: 0,
      right: 900,
      top: 0,
      width: 900,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.mouseDown(previewSurface, { clientX: 100, clientY: 60, button: 0 });
    fireEvent.mouseMove(window, { clientX: 700, clientY: 360 });

    expect(screen.getByLabelText(/meme preview canvas/i)).toHaveAttribute('width', '900');

    fireEvent.click(screen.getByRole('button', { name: /apply crop/i }));

    await waitFor(() => {
      expect(screen.getByText(/scene cropped/i)).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/meme preview canvas/i)).toHaveAttribute('width', '600');
  });

  it('cancels scene crop draft state without changing the committed canvas size', async () => {
    const baseFile = new File(['base-image'], 'base.png', { type: 'image/png' });
    mocks.loadImageElementFromFile.mockResolvedValue(createImageStub(900, 900));

    render(<App />);
    await uploadBaseImage(baseFile, 900);

    openCropTab();
    fireEvent.click(screen.getByRole('button', { name: /crop scene/i }));

    const previewSurface = document.querySelector('.preview-surface') as HTMLDivElement;
    vi.spyOn(previewSurface, 'getBoundingClientRect').mockReturnValue({
      bottom: 450,
      height: 450,
      left: 0,
      right: 900,
      top: 0,
      width: 900,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.mouseDown(previewSurface, { clientX: 100, clientY: 60, button: 0 });
    fireEvent.mouseMove(window, { clientX: 700, clientY: 360 });
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(screen.getByLabelText(/meme preview canvas/i)).toHaveAttribute('width', '900');
    expect(screen.queryByText(/scene cropped/i)).not.toBeInTheDocument();
  });

  it('cancels an in-flight scene crop draft when a crop-tab rotate action is used', async () => {
    const baseFile = new File(['base-image'], 'base.png', { type: 'image/png' });
    mocks.loadImageElementFromFile.mockResolvedValue(createImageStub(900, 600));

    render(<App />);
    await uploadBaseImage(baseFile, 900);

    openCropTab();
    fireEvent.click(screen.getByRole('button', { name: /crop scene/i }));

    const previewSurface = document.querySelector('.preview-surface') as HTMLDivElement;
    vi.spyOn(previewSurface, 'getBoundingClientRect').mockReturnValue({
      bottom: 300,
      height: 300,
      left: 0,
      right: 900,
      top: 0,
      width: 900,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.mouseDown(previewSurface, { clientX: 120, clientY: 40, button: 0 });
    fireEvent.mouseMove(window, { clientX: 760, clientY: 240 });

    expect(screen.getByRole('button', { name: /apply crop/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /rotate 90 clockwise/i }));

    await waitFor(() => {
      expect(screen.getByText(/scene image stack rotated clockwise/i)).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/meme preview canvas/i)).toHaveAttribute('width', '600');
    expect(screen.queryByRole('button', { name: /apply crop/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/scene cropped/i)).not.toBeInTheDocument();
  });

  it('expands the scene from the left without scaling content before apply', async () => {
    const baseFile = new File(['base-image'], 'base.png', { type: 'image/png' });
    mocks.loadImageElementFromFile.mockResolvedValue(createImageStub(800, 450));

    render(<App />);
    await uploadBaseImage(baseFile, 800);

    openCropTab();
    fireEvent.change(screen.getByRole('spinbutton', { name: /expand left/i }), {
      target: { value: '120' },
    });

    expect(screen.getByLabelText(/meme preview canvas/i)).toHaveAttribute('width', '800');

    fireEvent.click(screen.getByRole('button', { name: /apply bounds/i }));

    await waitFor(() => {
      expect(screen.getByText(/canvas expanded/i)).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/meme preview canvas/i)).toHaveAttribute('width', '920');
  });

  it('cancels pending scene expansion without mutating the committed canvas size', async () => {
    const baseFile = new File(['base-image'], 'base.png', { type: 'image/png' });
    mocks.loadImageElementFromFile.mockResolvedValue(createImageStub(800, 450));

    render(<App />);
    await uploadBaseImage(baseFile, 800);

    openCropTab();
    fireEvent.change(screen.getByRole('spinbutton', { name: /expand top/i }), {
      target: { value: '60' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(screen.getByLabelText(/meme preview canvas/i)).toHaveAttribute('width', '800');
    expect(screen.queryByText(/canvas expanded/i)).not.toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /expand top/i })).toHaveValue(0);
  });

  it('keeps bounds fill controls selectable before applying expansion', async () => {
    const baseFile = new File(['base-image'], 'base.png', { type: 'image/png' });
    mocks.loadImageElementFromFile.mockResolvedValue(createImageStub(800, 450));

    render(<App />);
    await uploadBaseImage(baseFile, 800);

    openCropTab();
    fireEvent.change(screen.getByRole('combobox', { name: /fill mode/i }), {
      target: { value: 'solid-color' },
    });
    fireEvent.change(screen.getByLabelText(/fill color/i), {
      target: { value: '#112233' },
    });
    fireEvent.change(screen.getByRole('spinbutton', { name: /expand right/i }), {
      target: { value: '40' },
    });

    expect(screen.getByRole('combobox', { name: /fill mode/i })).toHaveValue('solid-color');
    expect(screen.getByLabelText(/fill color/i)).toHaveValue('#112233');

    fireEvent.click(screen.getByRole('button', { name: /apply bounds/i }));

    await waitFor(() => {
      expect(screen.getByText(/canvas expanded/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('combobox', { name: /fill mode/i })).toHaveValue('solid-color');
    expect(screen.getByLabelText(/fill color/i)).toHaveValue('#112233');
  });

  it('applies expansion presets into the pending bounds draft', async () => {
    const baseFile = new File(['base-image'], 'base.png', { type: 'image/png' });
    mocks.loadImageElementFromFile.mockResolvedValue(createImageStub(800, 450));

    render(<App />);
    await uploadBaseImage(baseFile, 800);

    openCropTab();

    fireEvent.click(screen.getByRole('button', { name: /add margin equally/i }));
    expect(screen.getByRole('spinbutton', { name: /expand left/i })).toHaveValue(48);
    expect(screen.getByRole('spinbutton', { name: /expand right/i })).toHaveValue(48);
    expect(screen.getByRole('spinbutton', { name: /expand top/i })).toHaveValue(48);
    expect(screen.getByRole('spinbutton', { name: /expand bottom/i })).toHaveValue(48);

    fireEvent.click(screen.getByRole('button', { name: /add top caption space/i }));
    expect(screen.getByRole('spinbutton', { name: /expand top/i })).toHaveValue(120);
    expect(screen.getByRole('spinbutton', { name: /expand bottom/i })).toHaveValue(0);

    fireEvent.click(screen.getByRole('button', { name: /add bottom caption space/i }));
    expect(screen.getByRole('spinbutton', { name: /expand top/i })).toHaveValue(0);
    expect(screen.getByRole('spinbutton', { name: /expand bottom/i })).toHaveValue(120);

    fireEvent.click(screen.getByRole('button', { name: /square canvas/i }));
    expect(screen.getByRole('spinbutton', { name: /expand left/i })).toHaveValue(0);
    expect(screen.getByRole('spinbutton', { name: /expand right/i })).toHaveValue(0);
    expect(screen.getByRole('spinbutton', { name: /expand top/i })).toHaveValue(175);
    expect(screen.getByRole('spinbutton', { name: /expand bottom/i })).toHaveValue(175);
  });

  it('keeps layer ids stable after add, remove, and add again', async () => {
    const { container } = render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /add text/i }));
    expect(screen.getAllByRole('textbox')).toHaveLength(3);
    expect(container.querySelectorAll('.transform-box')).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: /^settings for top text$/i }));
    fireEvent.click(screen.getByRole('button', { name: /remove layer/i }));
    expect(screen.getAllByRole('textbox')).toHaveLength(2);
    expect(container.querySelectorAll('.transform-box')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: /add text/i }));
    expect(screen.getAllByRole('textbox')).toHaveLength(3);
    expect(container.querySelectorAll('.transform-box')).toHaveLength(3);
  });

  it('copies the canvas with ctrl+c when the page is not editing text', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const blob = new Blob(['png'], { type: 'image/png' });

    vi.stubGlobal('ClipboardItem', class ClipboardItemStub {
      constructor(public items: Record<string, Blob>) {}
    });
    Object.assign(navigator, {
      clipboard: {
        write,
      },
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      callback(blob);
    });

    render(<App />);
    fireEvent.keyDown(document, { ctrlKey: true, key: 'c' });

    await waitFor(() => {
      expect(write).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/image copied to the clipboard/i)).toBeInTheDocument();
    });
  });

  it('copies the canvas from the native copy event when nothing editable is active', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const blob = new Blob(['png'], { type: 'image/png' });

    vi.stubGlobal('ClipboardItem', class ClipboardItemStub {
      constructor(public items: Record<string, Blob>) {}
    });
    Object.assign(navigator, {
      clipboard: {
        write,
      },
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      callback(blob);
    });

    render(<App />);
    fireEvent.copy(document);

    await waitFor(() => {
      expect(write).toHaveBeenCalledTimes(1);
    });
  });

  it('enters draw mode, auto-creates a draw layer on first stroke, and undoes the committed stroke', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('tab', { name: /draw/i }));
    fireEvent.click(screen.getByRole('button', { name: /^draw$/i }));

    const previewSurface = document.querySelector('.preview-surface') as HTMLDivElement;
    vi.spyOn(previewSurface, 'getBoundingClientRect').mockReturnValue({
      bottom: 450,
      height: 450,
      left: 0,
      right: 800,
      top: 0,
      width: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(previewSurface, { button: 0, clientX: 60, clientY: 60 });
    fireEvent.pointerMove(window, { clientX: 180, clientY: 120 });

    expect(document.querySelector('.draw-stroke-preview')).toBeInTheDocument();

    fireEvent.pointerUp(window);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /brush 1 layer/i })).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /undo/i })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: /undo/i }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /brush 1 layer/i })).not.toBeInTheDocument();
    });
  });

  it('opens draw-layer settings and exposes remove layer action', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('tab', { name: /draw/i }));
    fireEvent.click(screen.getByRole('button', { name: /new draw layer/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /brush 1 layer/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /settings for brush 1/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /remove layer/i })).toBeInTheDocument();
    });
  });

  it('samples brush color from the preview canvas with the eyedropper', async () => {
    const context = createCanvasContextStub();
    context.getImageData = vi.fn(() => ({
      data: new Uint8ClampedArray([18, 52, 86, 255]),
      width: 1,
      height: 1,
    }));
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);

    render(<App />);

    fireEvent.click(screen.getByRole('tab', { name: /draw/i }));
    fireEvent.click(screen.getByRole('button', { name: /eyedropper/i }));

    const previewSurface = document.querySelector('.preview-surface') as HTMLDivElement;
    vi.spyOn(previewSurface, 'getBoundingClientRect').mockReturnValue({
      bottom: 450,
      height: 450,
      left: 0,
      right: 800,
      top: 0,
      width: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(previewSurface, { button: 0, clientX: 60, clientY: 60 });

    await waitFor(() => {
      expect(screen.getByLabelText(/brush color/i)).toHaveValue('#123456');
    });
  });

  it('disables draw mode when switching away from the draw tab', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('tab', { name: /draw/i }));
    fireEvent.click(screen.getByRole('button', { name: /^draw$/i }));

    expect(screen.getByRole('button', { name: /^draw$/i })).toHaveClass('settings-button-active');

    fireEvent.click(screen.getByRole('tab', { name: /crop/i }));
    fireEvent.click(screen.getByRole('tab', { name: /draw/i }));

    expect(screen.getByRole('button', { name: /^draw$/i })).not.toHaveClass('settings-button-active');
  });

  it('creates a marquee selection on a draw layer and copies it to a new image layer', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('tab', { name: /draw/i }));
    fireEvent.click(screen.getByRole('button', { name: /new draw layer/i }));
    fireEvent.click(screen.getByRole('button', { name: /^draw$/i }));

    const previewSurface = document.querySelector('.preview-surface') as HTMLDivElement;
    vi.spyOn(previewSurface, 'getBoundingClientRect').mockReturnValue({
      bottom: 450,
      height: 450,
      left: 0,
      right: 800,
      top: 0,
      width: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(previewSurface, { button: 0, clientX: 80, clientY: 80 });
    fireEvent.pointerMove(window, { clientX: 180, clientY: 140 });
    fireEvent.pointerUp(window);

    fireEvent.click(screen.getByRole('button', { name: /select area/i }));
    fireEvent.pointerDown(previewSurface, { button: 0, clientX: 70, clientY: 70 });
    fireEvent.pointerMove(window, { clientX: 190, clientY: 150 });
    fireEvent.pointerUp(window);
    fireEvent.click(screen.getByRole('button', { name: /copy selection to new layer/i }));
    fireEvent.click(screen.getByRole('tab', { name: /layers/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /image 1 layer/i })).toBeInTheDocument();
    });
  });

  it('cuts an applied selection into a new layer', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('tab', { name: /draw/i }));
    fireEvent.click(screen.getByRole('button', { name: /new draw layer/i }));
    fireEvent.click(screen.getByRole('button', { name: /^draw$/i }));

    const previewSurface = document.querySelector('.preview-surface') as HTMLDivElement;
    vi.spyOn(previewSurface, 'getBoundingClientRect').mockReturnValue({
      bottom: 450,
      height: 450,
      left: 0,
      right: 800,
      top: 0,
      width: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(previewSurface, { button: 0, clientX: 90, clientY: 90 });
    fireEvent.pointerMove(window, { clientX: 190, clientY: 160 });
    fireEvent.pointerUp(window);

    fireEvent.click(screen.getByRole('button', { name: /select area/i }));
    fireEvent.pointerDown(previewSurface, { button: 0, clientX: 80, clientY: 80 });
    fireEvent.pointerMove(window, { clientX: 200, clientY: 170 });
    fireEvent.pointerUp(window);
    fireEvent.click(screen.getByRole('button', { name: /cut selection to new layer/i }));
    fireEvent.click(screen.getByRole('tab', { name: /layers/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /image 1 layer/i })).toBeInTheDocument();
    });
  });

  it('disables draw mode when layer reordering starts', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('tab', { name: /draw/i }));
    fireEvent.click(screen.getByRole('button', { name: /^draw$/i }));
    expect(screen.getByRole('button', { name: /^draw$/i })).toHaveClass('settings-button-active');

    fireEvent.click(screen.getByRole('tab', { name: /layers/i }));

    const dataTransfer = {
      data: new Map<string, string>(),
      getData(type: string) {
        return this.data.get(type) ?? '';
      },
      setData(type: string, value: string) {
        this.data.set(type, value);
      },
      setDragImage: vi.fn(),
    };

    fireEvent.dragStart(screen.getByRole('button', { name: /reorder top text/i }), {
      dataTransfer,
    });

    fireEvent.click(screen.getByRole('tab', { name: /draw/i }));

    expect(screen.getByRole('button', { name: /^draw$/i })).not.toHaveClass('settings-button-active');
  });

  it('toggles between draw and erase without losing the shared brush controls', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('tab', { name: /draw/i }));
    fireEvent.click(screen.getByRole('button', { name: /^erase$/i }));

    expect(screen.getByRole('button', { name: /^erase$/i })).toHaveClass('settings-button-active');
    expect(screen.getByRole('button', { name: /^draw$/i })).not.toHaveClass('settings-button-active');
    expect(screen.getByLabelText(/brush color/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/brush size/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^draw$/i }));

    expect(screen.getByRole('button', { name: /^draw$/i })).toHaveClass('settings-button-active');
    expect(screen.getByRole('button', { name: /^erase$/i })).not.toHaveClass('settings-button-active');
  });

  it('duplicates a text layer while preserving its text and style', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /^settings for top text$/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /top text/i }), {
      target: { value: 'TOP TEXT' },
    });
    fireEvent.change(screen.getByRole('spinbutton', { name: /font size/i }), {
      target: { value: '72' },
    });
    fireEvent.click(screen.getByRole('button', { name: /duplicate top text/i }));

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /top text copy/i })).toBeInTheDocument();
    });

    expect(screen.getByRole('textbox', { name: /top text copy/i })).toHaveValue('TOP TEXT');
    fireEvent.click(screen.getByRole('button', { name: /^settings for top text$/i }));
    fireEvent.click(screen.getByRole('button', { name: /settings for top text copy/i }));
    expect(screen.getByRole('spinbutton', { name: /font size/i })).toHaveValue(72);
  });

  it('copies a selection with ctrl+c and pastes it as a new layer with ctrl+v', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('tab', { name: /draw/i }));
    fireEvent.click(screen.getByRole('button', { name: /new draw layer/i }));
    fireEvent.click(screen.getByRole('button', { name: /^draw$/i }));

    const previewSurface = document.querySelector('.preview-surface') as HTMLDivElement;
    vi.spyOn(previewSurface, 'getBoundingClientRect').mockReturnValue({
      bottom: 450,
      height: 450,
      left: 0,
      right: 800,
      top: 0,
      width: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(previewSurface, { button: 0, clientX: 80, clientY: 80 });
    fireEvent.pointerMove(window, { clientX: 180, clientY: 140 });
    fireEvent.pointerUp(window);

    fireEvent.click(screen.getByRole('button', { name: /select area/i }));
    fireEvent.pointerDown(previewSurface, { button: 0, clientX: 70, clientY: 70 });
    fireEvent.pointerMove(window, { clientX: 190, clientY: 150 });
    fireEvent.pointerUp(window);

    fireEvent.keyDown(document, { ctrlKey: true, key: 'c' });
    fireEvent.keyDown(document, { ctrlKey: true, key: 'v' });
    fireEvent.click(screen.getByRole('tab', { name: /layers/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /image 1 layer/i })).toBeInTheDocument();
    });
  });

  it('uses the base image as the selection target when a text layer is active', async () => {
    const baseFile = new File(['base-image'], 'base.png', { type: 'image/png' });
    mocks.loadImageElementFromFile.mockResolvedValueOnce(createImageStub(900, 900));

    render(<App />);
    await uploadBaseImage(baseFile, 900);

    fireEvent.click(screen.getByRole('textbox', { name: /top text/i }));
    fireEvent.click(screen.getByRole('button', { name: /select area/i }));

    expect(screen.getByText(/target: base image/i)).toBeInTheDocument();
  });
});

function createCanvasContextStub() {
  return {
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    getImageData: vi.fn((x: number, y: number, width: number, height: number) => ({
      data: new Uint8ClampedArray(Math.max(1, width * height) * 4),
      height,
      width,
    })),
    putImageData: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
    restore: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    save: vi.fn(),
    strokeText: vi.fn(),
    transform: vi.fn(),
    translate: vi.fn(),
    fillStyle: '#000000',
    font: '10px sans-serif',
    globalAlpha: 1,
    filter: '',
    lineJoin: 'round',
    lineWidth: 1,
    shadowBlur: 0,
    shadowColor: '',
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    strokeStyle: '#000000',
    textAlign: 'start',
    textBaseline: 'alphabetic',
  } as unknown as CanvasRenderingContext2D;
}

async function uploadBaseImage(file: File, expectedCanvasWidth?: number) {
  fireEvent.click(screen.getByRole('button', { name: /upload image/i }));
  fireEvent.change(screen.getByLabelText(/upload image file/i), {
    target: { files: [file] },
  });
  await screen.findByRole('dialog', { name: /prepare image/i });
  fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

  await waitFor(() => {
    expect(screen.getByText(new RegExp(`${escapeForRegex(file.name)} loaded`, 'i'))).toBeInTheDocument();
  });

  if (expectedCanvasWidth) {
    await waitFor(() => {
      expect(screen.getByLabelText(/meme preview canvas/i)).toHaveAttribute(
        'width',
        String(expectedCanvasWidth),
      );
    });
  }
}

function openCropTab() {
  fireEvent.click(screen.getByRole('tab', { name: /crop/i }));
}

function openAdjustmentsTab() {
  fireEvent.click(screen.getByRole('tab', { name: /adjustments/i }));
}

function openEffectsTab() {
  fireEvent.click(screen.getByRole('tab', { name: /effects/i }));
}

function openWatermarkTab() {
  fireEvent.click(screen.getByRole('tab', { name: /watermark/i }));
}

function escapeForRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createDeferredPromise<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return { promise, reject, resolve };
}
