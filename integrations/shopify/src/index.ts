/**
 * NimiPay Shopify Integration
 * Main entry point for the package
 */

import type {
    NimipayConfig,
    PaymentResult,
    NimipayErrorData
} from './types';

// Import implementations
import NimipayShopifyAPIImpl from './NimipayShopifyAPI';
import ShopifyAuthImpl from './auth/ShopifyAuth';
import ShopifyPaymentProcessorImpl from './payment/ShopifyPaymentProcessor';
import PaymentButtonComponent from './components/PaymentButton';

// Export implementations
export const NimipayShopifyAPI = NimipayShopifyAPIImpl;
export const ShopifyAuth = ShopifyAuthImpl;
export const ShopifyPaymentProcessor = ShopifyPaymentProcessorImpl;
export const PaymentButton = PaymentButtonComponent;

// Re-export all types
export * from './types';

// Utility functions
export const initializeNimiPay = async (config: NimipayConfig) => {
    const api = new NimipayShopifyAPI({
        ...config,
        testmode: config.testmode ?? false
    });
    await api.initialize();
    return api;
};

export const createPaymentProcessor = async (config: {
    api: typeof NimipayShopifyAPI;
    auth: typeof ShopifyAuth;
}) => {
    const processor = new ShopifyPaymentProcessorImpl(config);
    await processor.initialize();
    return processor;
};

// Event types
export const NIMIPAY_EVENTS = {
    PAYMENT_SUCCESS: 'payment:success',
    PAYMENT_FAILURE: 'payment:failure',
    PAYMENT_PENDING: 'payment:pending',
    SYNC_CONFLICT: 'sync:conflict',
    STORAGE_QUOTA: 'storage:quota'
} as const;

// Currency utilities
export const SUPPORTED_CURRENCIES = {
    BTC: {
        name: 'Bitcoin',
        decimals: 8,
        minAmount: 0.00001,
        maxAmount: 100,
        confirmations: {
            mainnet: 2,
            testnet: 1
        }
    },
    USDC: {
        name: 'USD Coin',
        decimals: 6,
        minAmount: 1,
        maxAmount: 1000000,
        confirmations: {
            mainnet: 12,
            testnet: 5
        }
    },
    UST: {
        name: 'Terra USD',
        decimals: 6,
        minAmount: 1,
        maxAmount: 1000000,
        confirmations: {
            mainnet: 15,
            testnet: 5
        }
    }
} as const;

// Error types
export class NimipayError extends Error {
    constructor(
        message: string,
        public code: string,
        public data?: any
    ) {
        super(message);
        this.name = 'NimipayError';
    }
}

export const ERROR_CODES = {
    INVALID_API_KEY: 'INVALID_API_KEY',
    INVALID_ORDER: 'INVALID_ORDER',
    PAYMENT_FAILED: 'PAYMENT_FAILED',
    NETWORK_ERROR: 'NETWORK_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR'
} as const;

// Version
export const VERSION = '1.0.0';

// Default configuration
export const DEFAULT_CONFIG = {
    testmode: false,
    scope: 'read_orders,write_orders,read_products'
} as const;
