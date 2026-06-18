import { useEffect, useRef } from 'react';

type CopyFallbackModalProps = {
  imageDataUrl: string;
  onClose: () => void;
  restoreFocusTo?: HTMLElement | null;
};

export function CopyFallbackModal({
  imageDataUrl,
  onClose,
  restoreFocusTo,
}: CopyFallbackModalProps) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();

    return () => {
      const nextFocusTarget =
        restoreFocusTo?.isConnected ? restoreFocusTo : previousFocusRef.current;

      if (nextFocusTarget?.isConnected) {
        nextFocusTarget.focus();
      }
    };
  }, [restoreFocusTo]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.defaultPrevented) {
        return;
      }

      event.preventDefault();
      onClose();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className="copy-fallback-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Save or copy image"
        tabIndex={-1}
      >
        <div className="copy-fallback-modal-header">
          <div>
            <h2 className="copy-fallback-modal-title">Save or copy image</h2>
            <p className="copy-fallback-modal-copy">
              Press and hold the finished image to use your browser&apos;s save or copy menu.
            </p>
          </div>
        </div>
        <div className="copy-fallback-modal-body">
          <img
            className="copy-fallback-modal-image"
            src={imageDataUrl}
            alt="Export preview image"
          />
        </div>
        <div className="copy-fallback-modal-actions">
          <a
            className="copy-fallback-modal-action-button"
            href={imageDataUrl}
            download="meme-elf.png"
            aria-label="Download PNG"
          >
            <svg aria-hidden="true" className="toolbar-icon-svg" viewBox="0 0 20 20" fill="none">
              <path
                d="M10 4.5v8.5M6.5 10 10 13.5 13.5 10"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M4.5 15.5V16h11v-.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
          <button
            type="button"
            className="copy-fallback-modal-action-button"
            onClick={onClose}
            aria-label="Close save or copy image"
          >
            ×
          </button>
        </div>
      </section>
    </div>
  );
}
