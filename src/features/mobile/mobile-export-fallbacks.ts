export type MobileExportSupport = {
  hasClipboardItem: boolean;
  hasClipboardWrite: boolean;
};

export type MobileExportOutcome =
  | 'copy-success'
  | 'clipboard-unsupported'
  | 'blob-unavailable'
  | 'clipboard-blocked';

export function canCopyImageToClipboard({
  hasClipboardItem,
  hasClipboardWrite,
}: MobileExportSupport) {
  return hasClipboardItem && hasClipboardWrite;
}

export function resolveMobileExportMessage(outcome: MobileExportOutcome) {
  switch (outcome) {
    case 'copy-success':
      return 'Image copied to the clipboard.';
    case 'clipboard-unsupported':
      return 'Direct image copy is not supported in this browser. Press and hold the image to save or copy it.';
    case 'blob-unavailable':
      return 'The image could not be copied. Press and hold the image to save or copy it.';
    case 'clipboard-blocked':
      return 'Clipboard copy was blocked by the browser. Press and hold the image to save or copy it.';
  }
}
