import type { MelfSceneDocument } from './melf-scene';
import type { MelfTemplateDocument } from './melf-template';
import { parseImportedTemplateDocument } from './import-template-source';

export function createTwoButtonsSceneDocument(): MelfSceneDocument {
  return {
    kind: 'scene',
    version: 1,
    name: 'meme-elf-scene',
    scene: {
      canvasSize: {
        width: 500,
        height: 757,
      },
      activeLayerId: null,
      baseImage: {
        mimeType: 'image/png',
        dataUrl: 'data:image/png;base64,AAAA',
        width: 500,
        height: 757,
      },
      layers: [
        {
          kind: 'text',
          id: 'top',
          name: 'Top text',
          box: {
            x: 47,
            y: 73,
            width: 179,
            height: 108,
            rotation: -0.27877712791553955,
          },
          opacity: 1,
          text: '',
          fontFamily: 'Helvetica',
          fontSize: 90,
          fillStyle: '#ffffff',
          strokeStyle: '#000000',
          outlineWidth: 5,
          textAlign: 'center',
          verticalAlign: 'middle',
          effect: 'outline',
          allCaps: false,
          bold: false,
          italic: false,
        },
        {
          kind: 'text',
          id: 'bottom',
          name: 'Bottom text',
          box: {
            x: 239,
            y: 51,
            width: 115,
            height: 78,
            rotation: -0.17862082848170346,
          },
          opacity: 1,
          text: '',
          fontFamily: 'Helvetica',
          fontSize: 90,
          fillStyle: '#ffffff',
          strokeStyle: '#000000',
          outlineWidth: 5,
          textAlign: 'center',
          verticalAlign: 'middle',
          effect: 'outline',
          allCaps: false,
          bold: false,
          italic: false,
        },
        {
          kind: 'text',
          id: 'layer-4',
          name: 'Text 4',
          box: {
            x: 25,
            y: 637,
            width: 452,
            height: 82,
            rotation: 0,
          },
          opacity: 1,
          text: '',
          fontFamily: 'Helvetica',
          fontSize: 90,
          fillStyle: '#ffffff',
          strokeStyle: '#000000',
          outlineWidth: 5,
          textAlign: 'center',
          verticalAlign: 'middle',
          effect: 'outline',
          allCaps: false,
          bold: false,
          italic: false,
        },
      ],
    },
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
      enabled: true,
      text: 'создано в программе meme-elf',
      mode: 'corner',
      corner: 'bottom-left',
      opacity: 50,
      size: 12,
      color: '#808080',
      rotation: 0,
    },
  };
}

export function createTwoButtonsTemplateDocument(): MelfTemplateDocument {
  const document = parseImportedTemplateDocument(
    JSON.stringify(createTwoButtonsSceneDocument()),
    'Two Buttons.melf',
  );

  if (!document) {
    throw new Error('Failed to create Two Buttons test template fixture.');
  }

  return document;
}
