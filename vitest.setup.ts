import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

type CanvasContextStub = Pick<
  CanvasRenderingContext2D,
  | 'clearRect'
  | 'drawImage'
  | 'fillRect'
  | 'fillText'
  | 'getImageData'
  | 'measureText'
  | 'putImageData'
  | 'restore'
  | 'save'
  | 'scale'
  | 'setTransform'
  | 'strokeRect'
  | 'strokeText'
  | 'textAlign'
  | 'textBaseline'
  | 'fillStyle'
  | 'font'
  | 'lineWidth'
  | 'strokeStyle'
>;

function createCanvasContextStub(): CanvasContextStub {
  return {
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    getImageData: vi.fn(),
    measureText: vi.fn((text: string) => ({
      width: text.length * 10,
    })),
    putImageData: vi.fn(),
    restore: vi.fn(),
    save: vi.fn(),
    scale: vi.fn(),
    setTransform: vi.fn(),
    strokeRect: vi.fn(),
    strokeText: vi.fn(),
    textAlign: 'start',
    textBaseline: 'alphabetic',
    fillStyle: '#000000',
    font: '10px sans-serif',
    lineWidth: 1,
    strokeStyle: '#000000',
  };
}

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  configurable: true,
  writable: true,
  value: vi.fn(() => createCanvasContextStub()),
});
