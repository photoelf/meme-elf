import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, vi } from 'vitest';
import type { PreInsertModalDraft } from '../../app/types';
import { PreInsertModal } from './pre-insert-modal';

describe('PreInsertModal', () => {
  const canvasContextSpy = {
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    restore: vi.fn(),
    rotate: vi.fn(),
    save: vi.fn(),
    scale: vi.fn(),
    translate: vi.fn(),
  };

  beforeEach(() => {
    Object.values(canvasContextSpy).forEach((spy) => spy.mockReset());
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      canvasContextSpy as unknown as CanvasRenderingContext2D,
    );
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
  });

  it('renders the preview region and all preparation controls', () => {
    render(
      <PreInsertModal
        draft={createDraft(createImageElement(), 'upload-image', 'inside-canvas', { width: 1200, height: 800 })}
        isCropMode
        onCancel={() => {}}
        onConfirm={() => {}}
        onFlipHorizontal={() => {}}
        onFlipVertical={() => {}}
        onRotateClockwise={() => {}}
        onRotateCounterClockwise={() => {}}
      />,
    );

    expect(screen.getByRole('dialog', { name: /prepare image/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/pre-insert preview/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /crop mode/i })).not.toBeInTheDocument();
    expect(document.querySelector('.pre-insert-crop-overlay')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resize crop from top-left/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resize crop from top-right/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resize crop from bottom-right/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resize crop from bottom-left/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rotate 90 clockwise/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rotate 90 counter-clockwise/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /flip horizontal/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /flip vertical/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('renders a placement mode selector for advanced import drafts and routes selection changes', () => {
    const onPlacementModeChange = vi.fn();

    render(
      <PreInsertModal
        draft={createDraft(null, 'advanced-import-file', 'outside-top')}
        isCropMode={false}
        onCancel={() => {}}
        onConfirm={() => {}}
        onFlipHorizontal={() => {}}
        onFlipVertical={() => {}}
        onPlacementModeChange={onPlacementModeChange}
        onRotateClockwise={() => {}}
        onRotateCounterClockwise={() => {}}
      />,
    );

    const placementMode = screen.getByRole('combobox', { name: /placement mode/i });
    expect(placementMode).toHaveValue('outside-top');

    fireEvent.change(placementMode, {
      target: { value: 'outside-bottom' },
    });

    expect(onPlacementModeChange).toHaveBeenCalledWith('outside-bottom');
  });

  it('keeps crop handles hidden on coarse-pointer devices because crop mode stays unavailable there', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(pointer: coarse)' || query === '(any-pointer: coarse)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;

    render(
      <PreInsertModal
        draft={createDraft(createImageElement(), 'advanced-import-file')}
        isCropMode={false}
        onCancel={() => {}}
        onConfirm={() => {}}
        onFlipHorizontal={() => {}}
        onFlipVertical={() => {}}
        onRotateClockwise={() => {}}
        onRotateCounterClockwise={() => {}}
      />,
    );

    expect(screen.getByRole('combobox', { name: /placement mode/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /crop mode/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /resize crop from top-left/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rotate 90 clockwise/i })).toBeInTheDocument();
  });

  it('keeps crop handles hidden for upload-image imports on coarse-pointer devices', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(pointer: coarse)' || query === '(any-pointer: coarse)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;

    render(
      <PreInsertModal
        draft={createDraft(createImageElement(), 'upload-image')}
        isCropMode={false}
        onCancel={() => {}}
        onConfirm={() => {}}
        onFlipHorizontal={() => {}}
        onFlipVertical={() => {}}
        onRotateClockwise={() => {}}
        onRotateCounterClockwise={() => {}}
      />,
    );

    expect(screen.queryByRole('button', { name: /crop mode/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /resize crop from top-left/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rotate 90 clockwise/i })).toBeInTheDocument();
  });

  it('routes preview control actions through its callbacks', () => {
    const handlers = {
      onCancel: vi.fn(),
      onConfirm: vi.fn(),
      onFlipHorizontal: vi.fn(),
      onFlipVertical: vi.fn(),
      onRotateClockwise: vi.fn(),
      onRotateCounterClockwise: vi.fn(),
    };

    render(
      <PreInsertModal
        draft={createDraft(createImageElement())}
        isCropMode={true}
        {...handlers}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /rotate 90 clockwise/i }));
    fireEvent.click(screen.getByRole('button', { name: /rotate 90 counter-clockwise/i }));
    fireEvent.click(screen.getByRole('button', { name: /flip horizontal/i }));
    fireEvent.click(screen.getByRole('button', { name: /flip vertical/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByRole('button', { name: /crop mode/i })).not.toBeInTheDocument();
    expect(handlers.onRotateClockwise).toHaveBeenCalledTimes(1);
    expect(handlers.onRotateCounterClockwise).toHaveBeenCalledTimes(1);
    expect(handlers.onFlipHorizontal).toHaveBeenCalledTimes(1);
    expect(handlers.onFlipVertical).toHaveBeenCalledTimes(1);
    expect(handlers.onConfirm).toHaveBeenCalledTimes(1);
    expect(handlers.onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders the canvas preview branch for an actual image element', () => {
    const { container } = render(
      <PreInsertModal
        draft={createDraft(createImageElement())}
        isCropMode={false}
        onCancel={() => {}}
        onConfirm={() => {}}
        onFlipHorizontal={() => {}}
        onFlipVertical={() => {}}
        onRotateClockwise={() => {}}
        onRotateCounterClockwise={() => {}}
      />,
    );

    expect(container.querySelector('.pre-insert-preview-canvas')).toBeInTheDocument();
    expect(screen.queryByText(/preview ready/i)).not.toBeInTheDocument();
  });

  it('scales the preview image down to the preview canvas instead of clipping the source image', () => {
    render(
      <PreInsertModal
        draft={createDraft(createImageElement(1683, 935), 'upload-image', 'inside-canvas', {
          width: 1683,
          height: 935,
        })}
        isCropMode={false}
        onCancel={() => {}}
        onConfirm={() => {}}
        onFlipHorizontal={() => {}}
        onFlipVertical={() => {}}
        onRotateClockwise={() => {}}
        onRotateCounterClockwise={() => {}}
      />,
    );

    expect(canvasContextSpy.drawImage).toHaveBeenCalledWith(
      expect.any(HTMLImageElement),
      -270,
      -150,
      540,
      300,
    );
  });

  it('routes crop drags back into source-space crop boxes', () => {
    const onCropBoxChange = vi.fn();
    const { container } = render(
      <PreInsertModal
        draft={createDraft(createImageElement())}
        isCropMode
        onCancel={() => {}}
        onConfirm={() => {}}
        onCropBoxChange={onCropBoxChange}
        onFlipHorizontal={() => {}}
        onFlipVertical={() => {}}
        onRotateClockwise={() => {}}
        onRotateCounterClockwise={() => {}}
      />,
    );

    const previewCanvas = container.querySelector('.pre-insert-preview-canvas') as HTMLCanvasElement;
    vi.spyOn(previewCanvas, 'getBoundingClientRect').mockReturnValue({
      bottom: 100,
      height: 100,
      left: 0,
      right: 200,
      top: 0,
      width: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.mouseDown(screen.getByLabelText(/pre-insert preview/i), {
      clientX: 20,
      clientY: 10,
    });
    fireEvent.mouseMove(window, {
      clientX: 120,
      clientY: 60,
    });
    fireEvent.mouseUp(window);

    expect(onCropBoxChange).toHaveBeenNthCalledWith(1, {
      startX: 120,
      startY: 80,
      endX: 120,
      endY: 80,
    });
    expect(onCropBoxChange).toHaveBeenLastCalledWith({
      startX: 120,
      startY: 80,
      endX: 720,
      endY: 480,
    });
  });

  it('closes on escape for safer modal keyboard behavior', () => {
    const onCancel = vi.fn();

    render(
      <PreInsertModal
        draft={createDraft()}
        isCropMode={false}
        onCancel={onCancel}
        onConfirm={() => {}}
        onFlipHorizontal={() => {}}
        onFlipVertical={() => {}}
        onRotateClockwise={() => {}}
        onRotateCounterClockwise={() => {}}
      />,
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('takes focus on mount so modal shortcuts stay local', () => {
    render(
      <PreInsertModal
        draft={createDraft(createImageElement())}
        isCropMode={false}
        onCancel={() => {}}
        onConfirm={() => {}}
        onFlipHorizontal={() => {}}
        onFlipVertical={() => {}}
        onRotateClockwise={() => {}}
        onRotateCounterClockwise={() => {}}
        onToggleCropMode={() => {}}
      />,
    );

    expect(screen.getByRole('dialog', { name: /prepare image/i })).toHaveFocus();
  });

  it('cycles focus within the modal when tabbing forward and backward', () => {
    render(
      <PreInsertModal
        draft={createDraft(createImageElement())}
        isCropMode={false}
        onCancel={() => {}}
        onConfirm={() => {}}
        onFlipHorizontal={() => {}}
        onFlipVertical={() => {}}
        onRotateClockwise={() => {}}
        onRotateCounterClockwise={() => {}}
        onToggleCropMode={() => {}}
      />,
    );

    const closeButton = screen.getByRole('button', { name: /close modal/i });
    const confirmButton = screen.getByRole('button', { name: /confirm/i });

    confirmButton.focus();
    fireEvent.keyDown(confirmButton, { key: 'Tab' });
    expect(closeButton).toHaveFocus();

    closeButton.focus();
    fireEvent.keyDown(closeButton, { key: 'Tab', shiftKey: true });
    expect(confirmButton).toHaveFocus();
  });

  it('restores focus to the opener when the modal closes', () => {
    render(<ModalHarness />);

    const opener = screen.getByRole('button', { name: /open modal/i });
    opener.focus();
    fireEvent.click(opener);

    expect(screen.getByRole('dialog', { name: /prepare image/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByRole('dialog', { name: /prepare image/i })).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('restores focus to the explicit target when provided', () => {
    render(<RestoreFocusHarness />);

    const modalTrigger = screen.getByRole('button', { name: /open modal/i });
    const explicitTarget = screen.getByRole('button', { name: /advanced import from file/i });

    modalTrigger.focus();
    fireEvent.click(modalTrigger);

    expect(screen.getByRole('dialog', { name: /prepare image/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByRole('dialog', { name: /prepare image/i })).not.toBeInTheDocument();
    expect(explicitTarget).toHaveFocus();
  });
});

function createDraft(
  image: CanvasImageSource | null = null,
  sourceKind: PreInsertModalDraft['pendingSource']['sourceKind'] = 'upload-image',
  advancedPlacementMode: PreInsertModalDraft['advancedPlacementMode'] = 'inside-canvas',
  sourceSize: { width: number; height: number } = { width: 1200, height: 800 },
): PreInsertModalDraft {
  return {
    pendingSource: {
      sourceKind,
      image,
      sourceSize,
    },
    cropBox: {
      startX: 0,
      startY: 0,
      endX: sourceSize.width,
      endY: sourceSize.height,
    },
    rotationQuarterTurns: 0,
    flipHorizontal: false,
    flipVertical: false,
    advancedPlacementMode,
    urlInputValue: '',
    urlStatus: 'idle',
    urlErrorMessage: null,
  };
}

function createImageElement(width = 1200, height = 800) {
  const image = document.createElement('img');
  image.src = 'blob:test-image';
  Object.defineProperty(image, 'naturalWidth', { configurable: true, value: width });
  Object.defineProperty(image, 'naturalHeight', { configurable: true, value: height });
  return image;
}

function ModalHarness() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        Open modal
      </button>
      {isOpen ? (
        <PreInsertModal
          draft={createDraft()}
          isCropMode={false}
          onCancel={() => setIsOpen(false)}
          onConfirm={() => setIsOpen(false)}
          onFlipHorizontal={() => {}}
          onFlipVertical={() => {}}
          onRotateClockwise={() => {}}
          onRotateCounterClockwise={() => {}}
        />
      ) : null}
    </>
  );
}

function RestoreFocusHarness() {
  const [isOpen, setIsOpen] = useState(false);
  const [restoreFocusTo, setRestoreFocusTo] = useState<HTMLButtonElement | null>(null);

  return (
    <>
      <button
        ref={setRestoreFocusTo}
        type="button"
      >
        Advanced import from file
      </button>
      <button type="button" onClick={() => setIsOpen(true)}>
        Open modal
      </button>
      {isOpen ? (
        <PreInsertModal
          draft={createDraft()}
          isCropMode={false}
          onCancel={() => setIsOpen(false)}
          onConfirm={() => setIsOpen(false)}
          onFlipHorizontal={() => {}}
          onFlipVertical={() => {}}
          onRotateClockwise={() => {}}
          onRotateCounterClockwise={() => {}}
          restoreFocusTo={restoreFocusTo}
        />
      ) : null}
    </>
  );
}
