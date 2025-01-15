// Mock browser APIs that might be needed by @nimiq/core
global.crypto = {
    getRandomValues: function(buffer) {
        return require('crypto').randomFillSync(buffer);
    }
};

// Mock WebSocket for network connectivity tests
global.WebSocket = class WebSocket {
    constructor(url) {
        this.url = url;
        this.readyState = 0;
        setTimeout(() => {
            this.readyState = 1;
            if (this.onopen) this.onopen();
        }, 0);
    }

    send(data) {
        if (this.onmessage) {
            setTimeout(() => {
                this.onmessage({ data });
            }, 0);
        }
    }

    close() {
        this.readyState = 3;
        if (this.onclose) this.onclose();
    }
};

// Mock IndexedDB for browser storage
const indexedDB = {
    open: jest.fn().mockReturnValue({
        result: {
            transaction: jest.fn(),
            objectStoreNames: {
                contains: jest.fn()
            },
            createObjectStore: jest.fn(),
            close: jest.fn()
        },
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null
    })
};

global.indexedDB = indexedDB;

// Mock performance.now() for timing operations
global.performance = {
    now: jest.fn(() => Date.now())
};

// Mock localStorage
const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    clear: jest.fn(),
    removeItem: jest.fn()
};

global.localStorage = localStorageMock;

// Mock window.location for network tests
delete window.location;
window.location = {
    protocol: 'https:',
    host: 'localhost:9000',
    hostname: 'localhost',
    href: 'https://localhost:9000/',
    origin: 'https://localhost:9000'
};

// Suppress console errors during tests
global.console = {
    ...console,
    error: jest.fn(),
    warn: jest.fn()
};

// Helper to reset all mocks between tests
beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.clear.mockClear();
    localStorageMock.removeItem.mockClear();
});
