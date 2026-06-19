import {
  buildWatermarkLayout,
  createDefaultSceneWatermark,
  describeSceneWatermarkPreview,
  normalizeSceneWatermark,
} from './watermark-utils';

describe('watermark utils', () => {
  it('returns the default enabled watermark state', () => {
    expect(createDefaultSceneWatermark()).toEqual({
      enabled: true,
      text: 'создано в программе meme-elf',
      mode: 'corner',
      corner: 'bottom-left',
      opacity: 50,
      size: 12,
      color: '#808080',
      rotation: 0,
    });
  });

  it('keeps an explicitly empty watermark text instead of resetting to default', () => {
    expect(normalizeSceneWatermark({ text: '' }).text).toBe('');
  });

  it('places a centered watermark in the middle of the scene', () => {
    expect(
      buildWatermarkLayout({
        canvasSize: { width: 800, height: 450 },
        color: '#808080',
        mode: 'center',
        corner: 'bottom-left',
        opacity: 50,
        rotation: 0,
        size: 240,
        text: 'meme-elf',
      }),
    ).toEqual([
      {
        color: '#808080',
        opacity: 0.5,
        rotation: 0,
        text: 'meme-elf',
        textAlign: 'center',
        textBaseline: 'middle',
        x: 400,
        y: 225,
      },
    ]);
  });

  it('places a corner watermark against the chosen lower-left edge with padding', () => {
    expect(
      buildWatermarkLayout({
        canvasSize: { width: 800, height: 450 },
        color: '#808080',
        mode: 'corner',
        corner: 'bottom-left',
        opacity: 50,
        rotation: 0,
        size: 16,
        text: 'meme-elf',
      }),
    ).toEqual([
      {
        color: '#808080',
        opacity: 0.5,
        rotation: 0,
        text: 'meme-elf',
        textAlign: 'left',
        textBaseline: 'bottom',
        x: 20,
        y: 430,
      },
    ]);
  });

  it('builds a tiled watermark grid across the scene with clockwise rotation', () => {
    expect(
      buildWatermarkLayout({
        canvasSize: { width: 420, height: 240 },
        color: '#808080',
        mode: 'tile',
        corner: 'bottom-left',
        opacity: 50,
        rotation: 35,
        size: 40,
        text: 'long watermark',
      })[0],
    ).toMatchObject({
      color: '#808080',
      opacity: 0.5,
      rotation: 0.6108652381980153,
      text: 'long watermark',
      textAlign: 'center',
      textBaseline: 'middle',
    });
  });

  it('creates a large diagonal watermark that spans the whole scene', () => {
    expect(
      buildWatermarkLayout({
        canvasSize: { width: 1000, height: 600 },
        color: '#808080',
        mode: 'diagonal',
        corner: 'bottom-left',
        opacity: 50,
        rotation: 0,
        size: 64,
        text: 'TOP SECRET',
      }),
    ).toEqual([
      {
        color: '#808080',
        opacity: 0.5,
        rotation: -0.5235987755982988,
        text: 'TOP SECRET',
        textAlign: 'center',
        textBaseline: 'middle',
        x: 500,
        y: 300,
      },
    ]);
  });

  it('describes the current watermark preview in compact mobile-friendly language', () => {
    expect(
      describeSceneWatermarkPreview({
        ...createDefaultSceneWatermark(),
        mode: 'corner',
        corner: 'bottom-right',
        opacity: 50,
        size: 12,
      }),
    ).toBe('Corner mark, bottom right, 12px, 50%');

    expect(
      describeSceneWatermarkPreview({
        ...createDefaultSceneWatermark(),
        mode: 'tile',
        rotation: 35,
        size: 40,
      }),
    ).toBe('Tiled text, 40px, 35deg, 50%');
  });
});
