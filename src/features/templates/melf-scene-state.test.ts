import { describe, expect, it, vi } from 'vitest';
import { createDefaultAppState } from '../../app/default-state';
import { createDefaultImageLayer } from '../image/image-layer-utils';
import { createDrawLayer } from '../draw/draw-layer-utils';
import type { MelfEmbeddedImageAsset } from './melf-scene';

describe('melf scene state conversion', () => {
  it('serializes app state into a scene document with embedded image and draw assets', async () => {
    const mod = await import('./melf-scene-state');
    const state = createDefaultAppState();
    const baseImage = { kind: 'base-image-stub' } as unknown as HTMLImageElement;
    const stickerImage = { kind: 'sticker-image-stub' } as unknown as CanvasImageSource;
    const drawLayer = createDrawLayer({
      id: 'draw-1',
      name: 'Brush 1',
      width: 800,
      height: 450,
    });

    state.image = baseImage;
    state.layers[0]!.text = 'TOP';
    state.layers.push(
      createDefaultImageLayer('image-1', 1, stickerImage, state.canvasSize, {
        width: 320,
        height: 240,
      }),
    );
    state.layers.push(drawLayer);

    const serializeImageSource = vi
      .fn<[CanvasImageSource, { width: number; height: number }], Promise<MelfEmbeddedImageAsset | null>>()
      .mockImplementation(async (source, size) => ({
        dataUrl: `data:image/png;base64,${source === baseImage ? 'BASE' : 'LAYER'}`,
        height: size.height,
        mimeType: 'image/png',
        width: size.width,
      }));
    const serializeRasterSurface = vi.fn().mockResolvedValue({
      dataUrl: 'data:image/png;base64,DRAW',
      height: 450,
      mimeType: 'image/png',
      width: 800,
    } satisfies MelfEmbeddedImageAsset);

    const document = await mod.serializeAppStateToMelfSceneDocument(state, {
      name: 'Saved meme',
      serializeImageSource,
      serializeRasterSurface,
    });

    expect(document.name).toBe('Saved meme');
    expect(document.scene.baseImage?.dataUrl).toBe('data:image/png;base64,BASE');
    expect(document.scene.layers).toHaveLength(4);
    expect(document.scene.layers[0]).toMatchObject({
      kind: 'text',
      id: 'top',
      text: 'TOP',
    });
    expect(document.scene.layers[2]).toMatchObject({
      kind: 'image',
      id: 'image-1',
      imageAsset: {
        dataUrl: 'data:image/png;base64,LAYER',
      },
    });
    expect(document.scene.layers[3]).toMatchObject({
      kind: 'draw',
      id: 'draw-1',
      rasterAsset: {
        dataUrl: 'data:image/png;base64,DRAW',
      },
    });
    expect(serializeImageSource).toHaveBeenCalledTimes(2);
    expect(serializeRasterSurface).toHaveBeenCalledTimes(1);
  });

  it('materializes a saved scene into app state with reset runtime fields', async () => {
    const mod = await import('./melf-scene-state');
    const sceneMod = await import('./melf-scene');
    const document = sceneMod.parseMelfSceneDocument(
      JSON.stringify({
        kind: 'scene',
        version: 1,
        name: 'Loaded meme',
        scene: {
          canvasSize: {
            width: 640,
            height: 360,
          },
          activeLayerId: 'image-1',
          baseImage: {
            mimeType: 'image/png',
            dataUrl: 'data:image/png;base64,BASE',
            width: 1200,
            height: 800,
          },
          layers: [
            {
              kind: 'text',
              id: 'headline',
              name: 'Headline',
              text: 'hello',
              verticalAlign: 'top',
              box: {
                x: 20,
                y: 12,
                width: 600,
                height: 96,
                rotation: 0,
              },
            },
            {
              kind: 'image',
              id: 'image-1',
              name: 'Sticker',
              box: {
                x: 80,
                y: 60,
                width: 220,
                height: 140,
                rotation: 0,
              },
              opacity: 0.75,
              sourceSize: {
                width: 640,
                height: 480,
              },
              skew: {
                x: -1,
                y: 1,
              },
              imageAsset: {
                mimeType: 'image/png',
                dataUrl: 'data:image/png;base64,LAYER',
                width: 640,
                height: 480,
              },
            },
            {
              kind: 'draw',
              id: 'draw-1',
              name: 'Brush',
              box: {
                x: 0,
                y: 0,
                width: 640,
                height: 360,
                rotation: 0,
              },
              opacity: 0.5,
              sourceSize: {
                width: 640,
                height: 360,
              },
              rasterAsset: {
                mimeType: 'image/png',
                dataUrl: 'data:image/png;base64,DRAW',
                width: 640,
                height: 360,
              },
            },
          ],
        },
      }),
    );

    const baseImage = { src: 'data:image/png;base64,BASE' } as HTMLImageElement;
    const layerImage = { src: 'data:image/png;base64,LAYER' } as HTMLImageElement;
    const loadImageAsset = vi.fn().mockImplementation(async (asset: MelfEmbeddedImageAsset) => {
      if (asset.dataUrl.includes('BASE')) {
        return baseImage;
      }

      return layerImage;
    });
    const decodeRasterAsset = vi.fn().mockResolvedValue({
      width: 640,
      height: 360,
      data: new Uint8ClampedArray([255, 0, 0, 255]),
    });

    const state = await mod.materializeAppStateFromMelfSceneDocument(document!, {
      decodeRasterAsset,
      loadImageAsset,
    });

    expect(state.image).toBe(baseImage);
    expect(state.canvasSize).toEqual({ width: 640, height: 360 });
    expect(state.activeLayerId).toBe('image-1');
    expect(state.layers).toHaveLength(3);
    expect(state.layers[0]).toMatchObject({
      kind: 'text',
      id: 'headline',
      text: 'hello',
    });
    expect(state.layers[1]).toMatchObject({
      kind: 'image',
      id: 'image-1',
      image: layerImage,
      opacity: 0.75,
      skew: {
        x: -1,
        y: 1,
      },
    });
    expect(state.layers[2]).toMatchObject({
      kind: 'draw',
      id: 'draw-1',
      opacity: 0.5,
      raster: {
        width: 640,
        height: 360,
      },
    });
    expect(state.status).toBe('idle');
    expect(state.errorMessage).toBeNull();
    expect(state.preInsertModalDraft).toBeNull();
    expect(state.activeSceneBoundsMode).toBe('idle');
    expect(state.mobileInteraction.activeGestureOwner).toBe('idle');
    expect(state.retouch.mode).toBe('idle');
    expect(loadImageAsset).toHaveBeenCalledTimes(2);
    expect(decodeRasterAsset).toHaveBeenCalledTimes(1);
  });
});
