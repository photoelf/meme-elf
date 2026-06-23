import { describe, expect, it } from 'vitest';

describe('melf scene foundation', () => {
  it('normalizes a minimal scene document onto editor defaults', async () => {
    const mod = await import('./melf-scene');
    const document = mod.parseMelfSceneDocument(
      JSON.stringify({
        kind: 'scene',
        version: 1,
        name: 'My scene',
        scene: {
          canvasSize: {
            width: 640,
            height: 360,
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
          ],
        },
      }),
    );

    expect(document).not.toBeNull();
    expect(document).toMatchObject({
      kind: 'scene',
      version: 1,
      name: 'My scene',
      scene: {
        canvasSize: {
          width: 640,
          height: 360,
        },
        activeLayerId: 'headline',
        baseImage: null,
      },
    });
    expect(document?.scene.layers).toHaveLength(1);
    expect(document?.scene.layers[0]).toMatchObject({
      kind: 'text',
      id: 'headline',
      name: 'Headline',
      text: 'hello',
      fontFamily: 'Impact',
      fontSize: 90,
      fillStyle: '#ffffff',
      strokeStyle: '#000000',
      outlineWidth: 5,
      textAlign: 'center',
      verticalAlign: 'top',
      effect: 'outline',
      allCaps: true,
      bold: false,
      italic: false,
      opacity: 1,
      box: {
        x: 20,
        y: 12,
        width: 600,
        height: 96,
        rotation: 0,
      },
    });
    expect(document?.sceneImageAdjustments).toMatchObject({
      brightness: 100,
      contrast: 100,
      saturation: 100,
      hue: 0,
      grayscale: false,
      includeText: false,
      sepia: false,
      invert: false,
    });
    expect(document?.sceneWatermark).toMatchObject({
      enabled: true,
      mode: 'corner',
      corner: 'bottom-left',
      opacity: 50,
      size: 12,
      color: '#808080',
    });
    expect(document && 'previewZoomFactor' in document).toBe(false);
    expect(document && 'sceneBoundsDraft' in document).toBe(false);
  });

  it('preserves embedded base image, image layers, and draw layers', async () => {
    const mod = await import('./melf-scene');
    const document = mod.parseMelfSceneDocument(
      JSON.stringify({
        kind: 'scene',
        version: 1,
        name: 'Layered scene',
        scene: {
          canvasSize: {
            width: 800,
            height: 450,
          },
          activeLayerId: 'sticker-1',
          baseImage: {
            mimeType: 'image/png',
            dataUrl: 'data:image/png;base64,AAAA',
            width: 1200,
            height: 800,
          },
          layers: [
            {
              kind: 'image',
              id: 'sticker-1',
              name: 'Sticker',
              opacity: 0.7,
              box: {
                x: 110,
                y: 90,
                width: 220,
                height: 160,
                rotation: 5,
              },
              sourceSize: {
                width: 1200,
                height: 800,
              },
              skew: {
                x: 10,
                y: -5,
              },
              imageAsset: {
                mimeType: 'image/webp',
                dataUrl: 'data:image/webp;base64,BBBB',
                width: 640,
                height: 480,
              },
            },
            {
              kind: 'draw',
              id: 'draw-1',
              name: 'Brush',
              opacity: 0.5,
              box: {
                x: 0,
                y: 0,
                width: 800,
                height: 450,
                rotation: 0,
              },
              sourceSize: {
                width: 800,
                height: 450,
              },
              rasterAsset: {
                mimeType: 'image/png',
                dataUrl: 'data:image/png;base64,CCCC',
                width: 800,
                height: 450,
              },
            },
          ],
        },
      }),
    );

    expect(document?.scene.activeLayerId).toBe('sticker-1');
    expect(document?.scene.baseImage).toMatchObject({
      mimeType: 'image/png',
      dataUrl: 'data:image/png;base64,AAAA',
      width: 1200,
      height: 800,
    });
    expect(document?.scene.layers).toHaveLength(2);
    expect(document?.scene.layers[0]).toMatchObject({
      kind: 'image',
      id: 'sticker-1',
      sourceSize: {
        width: 1200,
        height: 800,
      },
      skew: {
        x: 10,
        y: -5,
      },
      imageAsset: {
        mimeType: 'image/webp',
        dataUrl: 'data:image/webp;base64,BBBB',
        width: 640,
        height: 480,
      },
    });
    expect(document?.scene.layers[1]).toMatchObject({
      kind: 'draw',
      id: 'draw-1',
      rasterAsset: {
        mimeType: 'image/png',
        dataUrl: 'data:image/png;base64,CCCC',
        width: 800,
        height: 450,
      },
    });

    const stringified = mod.stringifyMelfSceneDocument(document!);
    expect(JSON.parse(stringified)).toEqual(document);
  });

  it('rejects non-scene documents', async () => {
    const mod = await import('./melf-scene');

    expect(
      mod.parseMelfSceneDocument(
        JSON.stringify({
          kind: 'template',
          version: 1,
        }),
      ),
    ).toBeNull();

    expect(
      mod.parseMelfSceneDocument(
        JSON.stringify({
          kind: 'scene',
          version: 999,
        }),
      ),
    ).toBeNull();
  });
});
