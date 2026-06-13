import {
  createDefaultAppState,
  DEFAULT_ADVANCED_IMPORT_PLACEMENT,
  DEFAULT_CANVAS_SIZE,
  DEFAULT_FONT_SIZE,
  DEFAULT_OUTLINE_WIDTH,
  DEFAULT_PREVIEW_ZOOM_FACTOR,
  DEFAULT_RETOUCH_BRUSH,
  DEFAULT_SCENE_BOUNDS_DRAFT,
} from './default-state';

describe('createDefaultAppState', () => {
  it('returns the default meme editor state shape', () => {
    expect(createDefaultAppState()).toEqual({
      image: null,
      status: 'idle',
      canvasSize: DEFAULT_CANVAS_SIZE,
      layers: [
        {
          kind: 'text',
          id: 'top',
          name: 'Top text',
          text: '',
          box: {
            x: 24,
            y: 0,
            width: 752,
            height: 110,
            rotation: 0,
          },
          fontFamily: 'Impact',
          fontSize: DEFAULT_FONT_SIZE,
          fillStyle: '#ffffff',
          strokeStyle: '#000000',
          outlineWidth: DEFAULT_OUTLINE_WIDTH,
          opacity: 1,
          textAlign: 'center',
          verticalAlign: 'top',
          effect: 'outline',
          allCaps: true,
          bold: false,
          italic: false,
        },
        {
          kind: 'text',
          id: 'bottom',
          name: 'Bottom text',
          text: '',
          box: {
            x: 24,
            y: 340,
            width: 752,
            height: 110,
            rotation: 0,
          },
          fontFamily: 'Impact',
          fontSize: DEFAULT_FONT_SIZE,
          fillStyle: '#ffffff',
          strokeStyle: '#000000',
          outlineWidth: DEFAULT_OUTLINE_WIDTH,
          opacity: 1,
          textAlign: 'center',
          verticalAlign: 'bottom',
          effect: 'outline',
          allCaps: true,
          bold: false,
          italic: false,
        },
      ],
      activeLayerId: null,
      errorMessage: null,
      previewZoomFactor: DEFAULT_PREVIEW_ZOOM_FACTOR,
      preInsertModalDraft: null,
      preferredAdvancedImportPlacementMode: DEFAULT_ADVANCED_IMPORT_PLACEMENT,
      sceneImageAdjustments: {
        brightness: 100,
        contrast: 100,
        saturation: 100,
        hue: 0,
        grayscale: false,
        includeText: false,
        sepia: false,
        invert: false,
      },
      sceneEffectStack: [
        { id: 'blur', kind: 'blur', value: 0 },
        { id: 'sharpen', kind: 'sharpen', value: 0 },
        { id: 'threshold', kind: 'threshold', value: 0 },
        { id: 'pixelate', kind: 'pixelate', value: 0 },
        { id: 'noise', kind: 'noise', value: 0 },
        { id: 'grain', kind: 'grain', value: 0 },
        { id: 'posterize', kind: 'posterize', value: 0 },
        { id: 'jpeg', kind: 'jpeg', value: 0 },
      ],
      sceneWatermark: {
        enabled: false,
        text: 'создано в программе meme-elf',
        mode: 'corner',
        corner: 'bottom-left',
        opacity: 50,
        size: 16,
        color: '#808080',
        rotation: 0,
      },
      sceneBoundsDraft: DEFAULT_SCENE_BOUNDS_DRAFT,
      activeSceneBoundsMode: 'idle',
      retouch: {
        mode: 'idle',
        activeDrawLayerId: null,
        draftStroke: null,
        cloneStamp: {
          sourcePoint: null,
          sourceTargetId: null,
        },
        selection: {
          targetId: null,
          draftRect: null,
          rect: null,
        },
        brush: DEFAULT_RETOUCH_BRUSH,
      },
    });
  });

  it('returns fresh nested objects for each call', () => {
    const firstState = createDefaultAppState();
    const secondState = createDefaultAppState();

    expect(firstState).not.toBe(secondState);
    expect(firstState.canvasSize).not.toBe(secondState.canvasSize);
    expect(firstState.layers).not.toBe(secondState.layers);
    expect(firstState.layers[0]).not.toBe(secondState.layers[0]);
    expect(firstState.layers[1]).not.toBe(secondState.layers[1]);

    firstState.canvasSize.width = 123;
    firstState.layers[0].text = 'TOP';
    firstState.layers[1].fontSize = 99;
    firstState.previewZoomFactor = 3;
    firstState.preferredAdvancedImportPlacementMode = 'outside-left';
    firstState.sceneImageAdjustments.brightness = 160;
    firstState.sceneImageAdjustments.includeText = true;
    firstState.sceneEffectStack[0]!.value = 12;
    firstState.sceneWatermark.text = 'PRIVATE';
    firstState.sceneBoundsDraft.cropRect = { startX: 0, startY: 0, endX: 10, endY: 10 };
    firstState.retouch.mode = 'draw';
    firstState.retouch.brush.color = '#00ff00';

    expect(secondState.canvasSize.width).toBe(DEFAULT_CANVAS_SIZE.width);
    expect(secondState.layers[0].text).toBe('');
    expect(secondState.layers[1].fontSize).toBe(DEFAULT_FONT_SIZE);
    expect(secondState.previewZoomFactor).toBe(DEFAULT_PREVIEW_ZOOM_FACTOR);
    expect(secondState.preInsertModalDraft).toBeNull();
    expect(secondState.preferredAdvancedImportPlacementMode).toBe(
      DEFAULT_ADVANCED_IMPORT_PLACEMENT,
    );
    expect(secondState.sceneImageAdjustments.brightness).toBe(100);
    expect(secondState.sceneImageAdjustments.includeText).toBe(false);
    expect(secondState.sceneEffectStack[0]?.value).toBe(0);
    expect(secondState.sceneWatermark.text).toBe('создано в программе meme-elf');
    expect(secondState.sceneBoundsDraft).toEqual(DEFAULT_SCENE_BOUNDS_DRAFT);
    expect(secondState.activeSceneBoundsMode).toBe('idle');
    expect(secondState.retouch).toEqual({
      mode: 'idle',
      activeDrawLayerId: null,
      draftStroke: null,
      cloneStamp: {
        sourcePoint: null,
        sourceTargetId: null,
      },
      selection: {
        targetId: null,
        draftRect: null,
        rect: null,
      },
      brush: DEFAULT_RETOUCH_BRUSH,
    });
  });
});
