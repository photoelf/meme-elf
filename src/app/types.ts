export const TEXT_ALIGN_OPTIONS = ['left', 'center', 'right'] as const;
export const VERTICAL_ALIGN_OPTIONS = ['top', 'middle', 'bottom'] as const;
export const TEXT_EFFECT_OPTIONS = ['outline', 'shadow', 'none'] as const;

export type LayerId = string;
export type TextAlign = (typeof TEXT_ALIGN_OPTIONS)[number];
export type VerticalAlign = (typeof VERTICAL_ALIGN_OPTIONS)[number];
export type TextEffect = (typeof TEXT_EFFECT_OPTIONS)[number];

export type TextBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

export type TextLayer = {
  id: LayerId;
  name: string;
  text: string;
  box: TextBox;
  fontFamily: string;
  fontSize: number;
  fillStyle: string;
  strokeStyle: string;
  outlineWidth: number;
  opacity: number;
  textAlign: TextAlign;
  verticalAlign: VerticalAlign;
  effect: TextEffect;
  allCaps: boolean;
  bold: boolean;
  italic: boolean;
};

export type AppStatus = 'idle' | 'loadingImage' | 'copying' | 'error';

export type AppState = {
  image: HTMLImageElement | null;
  canvasSize: {
    width: number;
    height: number;
  };
  layers: TextLayer[];
  activeLayerId: LayerId | null;
  status: AppStatus;
  errorMessage: string | null;
};
