import '@testing-library/jest-dom';
import { jest, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

declare global {
  var jest: typeof jest;
  var expect: typeof expect;
  var beforeAll: typeof beforeAll;
  var afterAll: typeof afterAll;
  var beforeEach: typeof beforeEach;
  
  interface Window {
    NimiPayConfig: {
      apiKey: string;
      shopifyAccessToken: string;
      shopifyApiKey: string;
      shopifyApiSecret: string;
      redirectUri: string;
      testMode: boolean;
    };
    Shopify: {
      shop: string;
      checkout: {
        token: string;
        email: string;
        totalPrice: string;
        currency: string;
      };
    };
    matchMedia: (query: string) => {
      matches: boolean;
      media: string;
      onchange: null;
      addListener: jest.Mock;
      removeListener: jest.Mock;
      addEventListener: jest.Mock;
      removeEventListener: jest.Mock;
      dispatchEvent: jest.Mock;
    };
  }

  class ResizeObserver {
    observe: jest.Mock;
    unobserve: jest.Mock;
    disconnect: jest.Mock;
  }

  class IntersectionObserver {
    observe: jest.Mock;
    unobserve: jest.Mock;
    disconnect: jest.Mock;
  }
}

// Mock Shopify App Bridge
jest.mock('@shopify/app-bridge', (): object => ({
  createApp: jest.fn(() => ({
    dispatch: jest.fn(),
    subscribe: jest.fn(),
    error: jest.fn()
  }))
}));

// Mock fetch API
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    blob: () => Promise.resolve(new Blob())
  })
) as jest.Mock;

// Mock window.crypto for HMAC operations
Object.defineProperty(window, 'crypto', {
  value: {
    subtle: {
      digest: jest.fn(),
      importKey: jest.fn(),
      sign: jest.fn()
    },
    getRandomValues: jest.fn()
  }
});

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn()
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn()
};
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

// Mock window.NimiPayConfig
Object.defineProperty(window, 'NimiPayConfig', {
  value: {
    apiKey: 'test_api_key',
    shopifyAccessToken: 'test_access_token',
    shopifyApiKey: 'test_shopify_key',
    shopifyApiSecret: 'test_shopify_secret',
    redirectUri: 'https://app.example.com/auth/callback',
    testMode: true
  },
  writable: true
});

// Mock Shopify object
Object.defineProperty(window, 'Shopify', {
  value: {
    shop: 'test-store.myshopify.com',
    checkout: {
      token: 'test_checkout_token',
      email: 'test@example.com',
      totalPrice: '100.00',
      currency: 'USD'
    }
  },
  writable: true
});

// Mock window.matchMedia
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
    dispatchEvent: jest.fn()
  }))
});

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
};

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
};

// Custom matchers
expect.extend({
  toHaveBeenCalledWithMatch(received: jest.Mock, ...expected: any[]) {
    const pass = received.mock.calls.some(call =>
      expected.every((arg, i) => {
        if (typeof arg === 'object') {
          return expect.objectContaining(arg).asymmetricMatch(call[i]);
        }
        return arg === call[i];
      })
    );

    return {
      pass,
      message: () =>
        `expected ${received.getMockName()} to have been called with arguments matching ${expected}`
    };
  }
});

// Suppress console errors during tests
const originalError = console.error.bind(console);
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

// Clear all mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});

// Global test timeout
jest.setTimeout(10000);
