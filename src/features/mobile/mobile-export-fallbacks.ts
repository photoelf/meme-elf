export type MobileExportSupport = {
  hasClipboardItem: boolean;
  hasClipboardWrite: boolean;
  isSecureContext: boolean;
};

export type MobileExportOutcome =
  | 'copy-success'
  | 'clipboard-unsupported'
  | 'secure-context-required'
  | 'blob-unavailable'
  | 'clipboard-blocked';

export type MobileExportRouteMessageInput = {
  hostMode?: 'web' | 'telegram';
  canCopyImage: boolean;
  canDownloadImage: boolean;
  canShareMessage?: boolean;
  canDownloadFile?: boolean;
};

export function canCopyImageToClipboard({
  hasClipboardItem,
  hasClipboardWrite,
  isSecureContext,
}: MobileExportSupport) {
  return hasClipboardItem && hasClipboardWrite && isSecureContext;
}

export function resolveMobileExportMessage(outcome: MobileExportOutcome): string;
export function resolveMobileExportMessage(input: MobileExportRouteMessageInput): string;
export function resolveMobileExportMessage(
  outcomeOrInput: MobileExportOutcome | MobileExportRouteMessageInput,
) {
  if (typeof outcomeOrInput !== 'string') {
    if (outcomeOrInput.hostMode === 'telegram' && outcomeOrInput.canShareMessage) {
      return 'Telegram can share the exported meme directly if clipboard copy is unavailable.';
    }

    if (outcomeOrInput.hostMode === 'telegram' && outcomeOrInput.canDownloadFile) {
      return 'Telegram can hand the exported meme to the native file-download flow here.';
    }

    return 'If direct copy is unavailable, use the image fallback and save or share it manually.';
  }

  const outcome = outcomeOrInput;

  switch (outcome) {
    case 'copy-success':
      return 'Image copied to the clipboard.';
    case 'clipboard-unsupported':
      return 'Direct image copy is not supported in this browser. Press and hold the image to save or copy it.';
    case 'secure-context-required':
      return 'Direct image copy needs HTTPS or another secure context in this browser. Press and hold the image to save or copy it.';
    case 'blob-unavailable':
      return 'The image could not be copied. Press and hold the image to save or copy it.';
    case 'clipboard-blocked':
      return 'Clipboard copy was blocked by the browser. Press and hold the image to save or copy it.';
  }
}
