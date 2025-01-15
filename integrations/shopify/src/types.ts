// Core API Types
export interface NimipayShopifyAPI {
    apiKey: string;
    shopifyAccessToken: string;
    testmode: boolean;
    apiUrl: string;
    shopifyApiVersion: string;

    initialize(): Promise<void>;
    createPayment(data: PaymentData): Promise<PaymentResult>;
    getPayment(paymentId: string): Promise<PaymentResult>;
    getSupportedCurrencies(): Promise<string[]>;
    getExchangeRates(baseCurrency?: string): Promise<ExchangeRates>;
    formatAmount(amount: number | string, currency: string): number;
    validateAmount(amount: number, currency: string): boolean;
    getShopDomain(): string;
}

// Authentication Types
export interface ShopifyAuth {
    apiKey: string;
    apiSecret: string;
    scope: string;
    redirectUri: string;

    generateAuthUrl(shop: string, state: string): string;
    validateCallback(query: Record<string, string>): boolean;
    getAccessToken(shop: string, code: string): Promise<AccessTokenResponse>;
    validateShopDomain(shop: string): boolean;
    verifyWebhook(rawBody: string, hmac: string): boolean;
    generateSessionToken(shop: string, accessToken: string): string;
    verifySessionToken(token: string): SessionData | null;
    verifyOrigin(headers: Record<string, string>): boolean;
}

// Payment Processor Types
export interface ShopifyPaymentProcessor {
    api: NimipayShopifyAPI;
    auth: ShopifyAuth;
    paymentFlow: any;
    stateManager: any;

    initialize(): Promise<void>;
    processPayment(order: OrderData): Promise<PaymentResult>;
    handlePaymentSuccess(data: PaymentResult): Promise<void>;
    handlePaymentFailure(data: PaymentResult): Promise<void>;
    handlePaymentPending(data: PaymentResult): Promise<void>;
    handleOfflineMode(): Promise<void>;
    handleOnlineRecovery(): Promise<void>;
}

// Data Types
export interface PaymentData {
    amount: number;
    currency: string;
    order_id: string;
    customer: {
        email: string;
        name: string;
    };
    metadata?: Record<string, any>;
}

export interface PaymentResult {
    id: string;
    status: 'pending' | 'completed' | 'failed';
    amount: number;
    currency: string;
    error?: {
        code: string;
        message: string;
    };
}

export interface OrderData {
    id: string;
    total_price: string;
    currency: string;
    email: string;
    customer: {
        first_name?: string;
        last_name?: string;
    };
}

export interface ExchangeRates {
    base: string;
    rates: Record<string, number>;
    timestamp: number;
}

export interface AccessTokenResponse {
    access_token: string;
    scope: string;
    expires_in?: number;
}

export interface SessionData {
    shop: string;
    accessToken: string;
    timestamp: number;
}

// Event Types
export type PaymentEventType = 'payment:success' | 'payment:failure' | 'payment:pending';

export interface PaymentEvent {
    type: PaymentEventType;
    data: PaymentResult;
}

// Error Types
export interface NimipayErrorData {
    code: string;
    message: string;
    data?: any;
}

// Configuration Types
export interface NimipayConfig {
    apiKey: string;
    shopifyAccessToken: string;
    testmode?: boolean;
}

export interface ShopifyAuthConfig {
    apiKey: string;
    apiSecret: string;
    scope?: string;
    redirectUri: string;
}

// Component Props Types
export interface PaymentButtonProps {
    order: OrderData;
    onSuccess?: (data: PaymentResult) => void;
    onFailure?: (error: NimipayErrorData) => void;
    onPending?: (data: PaymentResult) => void;
    className?: string;
    buttonText?: string;
    testMode?: boolean;
}
