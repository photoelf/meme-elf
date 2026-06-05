import type { AppState, TextBox, TextLayer, VerticalAlign } from './types';

export const DEFAULT_CANVAS_SIZE = {
  width: 800,
  height: 450,
} as const;

export const DEFAULT_LAYER_EDGE_OFFSET = 24;
export const DEFAULT_FONT_FAMILY = 'Impact';
export const DEFAULT_FONT_SIZE = 90;
export const DEFAULT_FILL = '#ffffff';
export const DEFAULT_STROKE = '#000000';
export const DEFAULT_OUTLINE_WIDTH = 5;

function createDefaultTextBox(y: number, height: number): TextBox {
  return {
    x: DEFAULT_LAYER_EDGE_OFFSET,
    y,
    width: DEFAULT_CANVAS_SIZE.width - DEFAULT_LAYER_EDGE_OFFSET * 2,
    height,
    rotation: 0,
  };
}

export function createTextLayer(
  id: TextLayer['id'],
  name: string,
  y: number,
  verticalAlign: VerticalAlign,
): TextLayer {
  const isMiddle = verticalAlign === 'middle';
  const defaultHeight = isMiddle ? 140 : 110;

  return {
    id,
    name,
    text: '',
    box: createDefaultTextBox(y, defaultHeight),
    fontFamily: DEFAULT_FONT_FAMILY,
    fontSize: DEFAULT_FONT_SIZE,
    fillStyle: DEFAULT_FILL,
    strokeStyle: DEFAULT_STROKE,
    outlineWidth: DEFAULT_OUTLINE_WIDTH,
    opacity: 1,
    textAlign: 'center',
    verticalAlign,
    effect: 'outline',
    allCaps: true,
    bold: false,
    italic: false,
  };
}

export function createDefaultAppState(): AppState {
  return {
    image: null,
    status: 'idle',
    canvasSize: { ...DEFAULT_CANVAS_SIZE },
    layers: [
      createTextLayer('top', 'Top text', 0, 'top'),
      createTextLayer('bottom', 'Bottom text', DEFAULT_CANVAS_SIZE.height - 110, 'bottom'),
    ],
    activeLayerId: null,
    errorMessage: null,
  };
}
