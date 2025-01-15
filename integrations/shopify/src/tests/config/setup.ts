import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
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

// Mock window.ResizeObserver
class ResizeObserverMock {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}

window.ResizeObserver = ResizeObserverMock;

// Mock window.scrollTo
Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: jest.fn(),
});

// Mock IntersectionObserver
class IntersectionObserverMock {
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }
  private callback: IntersectionObserverCallback;
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
  takeRecords = jest.fn();
}

window.IntersectionObserver = IntersectionObserverMock as any;

// Mock TextEncoder/TextDecoder
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

// Mock Shopify App Bridge
jest.mock('@shopify/app-bridge', () => ({
  createApp: jest.fn().mockReturnValue({
    dispatch: jest.fn(),
    subscribe: jest.fn(),
    error: jest.fn(),
  }),
  actions: {
    Button: {
      button: {
        CLICK: 'CLICK',
      },
    },
    Modal: {
      Action: {
        OPEN: 'OPEN',
        CLOSE: 'CLOSE',
      },
    },
  },
}));

// Mock Shopify App Bridge React Provider
jest.mock('@shopify/app-bridge-react', () => ({
  Provider: ({ children }: { children: React.ReactNode }) => children,
  useAppBridge: jest.fn().mockReturnValue({
    dispatch: jest.fn(),
    subscribe: jest.fn(),
    error: jest.fn(),
  }),
}));

// Mock fetch with proper Response type
const createResponse = (data: any, init?: ResponseInit): Response => {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  return new Response(blob, {
    status: 200,
    statusText: 'OK',
    headers: new Headers({ 'Content-Type': 'application/json' }),
    ...init,
  });
};

type FetchMock = jest.Mock<Promise<Response>, [RequestInfo | URL, RequestInit?]>;

const fetchMock = jest.fn((input: RequestInfo | URL, init?: RequestInit) =>
  Promise.resolve(createResponse({}))
) as FetchMock;

global.fetch = fetchMock;

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
};

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
});

// Reset all mocks after each test
afterEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

// Clean up any global test state
afterAll(() => {
  jest.restoreAllMocks();
});
