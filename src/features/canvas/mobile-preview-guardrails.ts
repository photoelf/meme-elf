import { SMALL_TABLET_MAX_WIDTH } from '../controls/mobile-layout';

const MOBILE_PREVIEW_MAX_RASTER_PIXELS = 640_000;
const MOBILE_IMPORT_MAX_DIMENSION = 1_600;
const MOBILE_IMPORT_WARNING_ASPECT_RATIO = 3.5;

export type PreviewGuardrailReason = 'mobile-raster-effects';

export type PreviewGuardrails = {
  active: boolean;
  guardedRenderSize: { width: number; height: number } | null;
  message: string | null;
  reason: PreviewGuardrailReason | null;
};

export type LoadedImageGuardrailReason =
  | 'mobile-import-downscaled'
  | 'mobile-import-downscaled-warning';

export function createInactivePreviewGuardrails(): PreviewGuardrails {
  return {
    active: false,
    guardedRenderSize: null,
    message: null,
    reason: null,
  };
}

export function resolveMobilePreviewGuardrails(input: {
  canvasSize: { width: number; height: number };
  hasRasterEffects: boolean;
  viewportWidth: number;
}): PreviewGuardrails {
  if (!input.hasRasterEffects || input.viewportWidth > SMALL_TABLET_MAX_WIDTH) {
    return createInactivePreviewGuardrails();
  }

  const totalPixels = input.canvasSize.width * input.canvasSize.height;

  if (totalPixels <= MOBILE_PREVIEW_MAX_RASTER_PIXELS) {
    return createInactivePreviewGuardrails();
  }

  const scale = Math.sqrt(MOBILE_PREVIEW_MAX_RASTER_PIXELS / totalPixels);

  return {
    active: true,
    guardedRenderSize: {
      width: Math.max(1, Math.round(input.canvasSize.width * scale)),
      height: Math.max(1, Math.round(input.canvasSize.height * scale)),
    },
    message: 'Preview quality reduced on this phone to keep editing responsive.',
    reason: 'mobile-raster-effects',
  };
}

export function resolveLoadedImageGuardrails(input: {
  sourceSize: { width: number; height: number };
  viewportWidth: number;
}): {
  canvasSize: { width: number; height: number };
  message: string | null;
  reason: LoadedImageGuardrailReason | null;
} {
  if (input.viewportWidth > SMALL_TABLET_MAX_WIDTH) {
    return {
      canvasSize: { ...input.sourceSize },
      message: null,
      reason: null,
    };
  }

  const longestEdge = Math.max(input.sourceSize.width, input.sourceSize.height);

  if (longestEdge <= MOBILE_IMPORT_MAX_DIMENSION) {
    return {
      canvasSize: { ...input.sourceSize },
      message: null,
      reason: null,
    };
  }

  const scale = MOBILE_IMPORT_MAX_DIMENSION / longestEdge;
  const canvasSize = {
    width: Math.max(1, Math.round(input.sourceSize.width * scale)),
    height: Math.max(1, Math.round(input.sourceSize.height * scale)),
  };
  const aspectRatio =
    Math.max(canvasSize.width, canvasSize.height) / Math.max(1, Math.min(canvasSize.width, canvasSize.height));
  const warningNeeded = aspectRatio >= MOBILE_IMPORT_WARNING_ASPECT_RATIO;

  return {
    canvasSize,
    message: warningNeeded
      ? `Large image detected. The working canvas was reduced to ${canvasSize.width} x ${canvasSize.height} so this phone session stays responsive. If editing still feels heavy, crop the source image or import a smaller version.`
      : `Large image detected. The working canvas was reduced to ${canvasSize.width} x ${canvasSize.height} so this phone session stays responsive.`,
    reason: warningNeeded ? 'mobile-import-downscaled-warning' : 'mobile-import-downscaled',
  };
}
