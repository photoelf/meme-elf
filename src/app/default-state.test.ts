import {
  createDefaultAppState,
  DEFAULT_ADVANCED_IMPORT_PLACEMENT,
  DEFAULT_CANVAS_SIZE,
  DEFAULT_FONT_SIZE,
  DEFAULT_OUTLINE_WIDTH,
  DEFAULT_PREVIEW_ZOOM_FACTOR,
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

    expect(secondState.canvasSize.width).toBe(DEFAULT_CANVAS_SIZE.width);
    expect(secondState.layers[0].text).toBe('');
    expect(secondState.layers[1].fontSize).toBe(DEFAULT_FONT_SIZE);
    expect(secondState.previewZoomFactor).toBe(DEFAULT_PREVIEW_ZOOM_FACTOR);
    expect(secondState.preInsertModalDraft).toBeNull();
    expect(secondState.preferredAdvancedImportPlacementMode).toBe(
      DEFAULT_ADVANCED_IMPORT_PLACEMENT,
    );
  });
});
