// Set test environment
process.env.NODE_ENV = 'test';

// Mock localStorage for tests
const storageMock = new Map<string, string>();

const localStorageMock = {
  getItem: jest.fn((key: string) => storageMock.get(key) || null),
  setItem: jest.fn((key: string, value: string) => storageMock.set(key, value)),
  removeItem: jest.fn((key: string) => storageMock.delete(key)),
  clear: jest.fn(() => storageMock.clear()),
  key: jest.fn(),
  length: 0,
  [Symbol.iterator]: function* () {
    yield* Array.from(storageMock.entries());
  }
} as Storage;

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true
});

// Mock crypto for tests
const cryptoMock = {
  createHmac: jest.fn().mockReturnValue({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn().mockReturnValue('valid-signature'),
  }),
};
(global as any).crypto = cryptoMock;

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  storageMock.clear();
});

// Add custom matchers if needed
expect.extend({
  // Add custom matchers here if required
});
