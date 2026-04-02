import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';
import 'zone.js';
import 'zone.js/testing';

// Initialize Zone.js test environment
setupZoneTestEnv();

// Mock de localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn()
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock de sessionStorage
Object.defineProperty(window, 'sessionStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock de CSS.supports
Object.defineProperty(window, 'CSS', {
  value: {
    supports: jest.fn(() => false),
    escape: jest.fn((str: string) => str)
  },
  writable: true,
});

// Mock de matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock de IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;

// Mock de ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as any;

// Mock de fetch
global.fetch = jest.fn();

// Mock de console para tests más limpios (opcional)
global.console = {
  ...console,
  // Desactivar logs en tests
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  // Mantener warnings y errors
  warn: console.warn,
  error: jest.fn(),
};

// Limpiar mocks después de cada test
beforeEach(() => {
  jest.clearAllMocks();
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  localStorageMock.clear.mockClear();
});