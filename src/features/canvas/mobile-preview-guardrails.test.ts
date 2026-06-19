import { describe, expect, it } from 'vitest';

import {
  createInactivePreviewGuardrails,
  resolveLoadedImageGuardrails,
  resolveMobilePreviewGuardrails,
} from './mobile-preview-guardrails';

describe('createInactivePreviewGuardrails', () => {
  it('returns a stable no-op guardrail payload', () => {
    expect(createInactivePreviewGuardrails()).toEqual({
      active: false,
      guardedRenderSize: null,
      message: null,
      reason: null,
    });
  });
});

describe('resolveMobilePreviewGuardrails', () => {
  it('keeps previews unguarded when the scene has no expensive raster pass', () => {
    expect(
      resolveMobilePreviewGuardrails({
        canvasSize: { width: 1200, height: 900 },
        hasRasterEffects: false,
        viewportWidth: 680,
      }),
    ).toEqual(createInactivePreviewGuardrails());
  });

  it('reduces the offscreen raster-pass size on phone when the preview would exceed the mobile pixel budget', () => {
    expect(
      resolveMobilePreviewGuardrails({
        canvasSize: { width: 1600, height: 1200 },
        hasRasterEffects: true,
        viewportWidth: 680,
      }),
    ).toEqual({
      active: true,
      guardedRenderSize: { width: 924, height: 693 },
      message: 'Preview quality reduced on this phone to keep editing responsive.',
      reason: 'mobile-raster-effects',
    });
  });

  it('leaves desktop raster previews at full size even when they are large', () => {
    expect(
      resolveMobilePreviewGuardrails({
        canvasSize: { width: 1600, height: 1200 },
        hasRasterEffects: true,
        viewportWidth: 1280,
      }),
    ).toEqual(createInactivePreviewGuardrails());
  });
});

describe('resolveLoadedImageGuardrails', () => {
  it('keeps ordinary phone imports at their natural working size', () => {
    expect(
      resolveLoadedImageGuardrails({
        sourceSize: { width: 900, height: 600 },
        viewportWidth: 680,
      }),
    ).toEqual({
      canvasSize: { width: 900, height: 600 },
      message: null,
      reason: null,
    });
  });

  it('downscales oversized phone imports and returns recovery messaging', () => {
    expect(
      resolveLoadedImageGuardrails({
        sourceSize: { width: 5000, height: 2500 },
        viewportWidth: 680,
      }),
    ).toEqual({
      canvasSize: { width: 1600, height: 800 },
      message:
        'Large image detected. The working canvas was reduced to 1600 x 800 so this phone session stays responsive.',
      reason: 'mobile-import-downscaled',
    });
  });

  it('warns when an imported image is still extreme after mobile downscaling', () => {
    expect(
      resolveLoadedImageGuardrails({
        sourceSize: { width: 1800, height: 7200 },
        viewportWidth: 680,
      }),
    ).toEqual({
      canvasSize: { width: 400, height: 1600 },
      message:
        'Large image detected. The working canvas was reduced to 400 x 1600 so this phone session stays responsive. If editing still feels heavy, crop the source image or import a smaller version.',
      reason: 'mobile-import-downscaled-warning',
    });
  });
});
