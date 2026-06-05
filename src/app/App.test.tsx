import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { App } from './App';

const mocks = vi.hoisted(() => ({
  extractImageFromPasteEvent: vi.fn(),
  loadImageElementFromFile: vi.fn(),
  readImageFromClipboard: vi.fn(),
}));

vi.mock('../features/clipboard/clipboard-service', () => ({
  extractImageFromPasteEvent: mocks.extractImageFromPasteEvent,
  readImageFromClipboard: mocks.readImageFromClipboard,
}));

vi.mock('../features/image/image-loader', () => ({
  loadImageElementFromFile: mocks.loadImageElementFromFile,
}));

function createImageStub(width = 1200, height = 800) {
  return {
    naturalHeight: height,
    naturalWidth: width,
    src: 'blob:test-image',
  } as HTMLImageElement;
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.dataset.theme = '';
  });

  it('renders the meme-elf heading, editor toolbar, and inspector fields', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /meme-elf/i })).toBeInTheDocument();
    expect(screen.getByRole('toolbar', { name: /editor actions/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /paste from clipboard/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy image/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /download png/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /switch to dark theme/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /top text/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /bottom text/i })).toBeInTheDocument();
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
    fireEvent.change(screen.getByLabelText(/upload image file/i), {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(screen.getByText(/meme\.png loaded/i)).toBeInTheDocument();
    });

    expect(mocks.loadImageElementFromFile).toHaveBeenCalledWith(file);
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

  it('keeps layer ids stable after add, remove, and add again', async () => {
    const { container } = render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /add text/i }));
    expect(screen.getAllByRole('textbox')).toHaveLength(3);
    expect(container.querySelectorAll('.transform-box')).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: /settings for top text/i }));
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
});
