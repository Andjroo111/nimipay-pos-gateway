import { ReactElement } from 'react';
import { RenderOptions, RenderResult } from '@testing-library/react';

// Extend Jest matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidPaymentResult(): R;
    }
  }
}

// Test wrapper props
export interface TestWrapperProps {
  children?: React.ReactNode;
  shopOrigin?: string;
  apiKey?: string;
}

// Custom render options
export interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  shopOrigin?: string;
  apiKey?: string;
}

// Order data type
export interface OrderData {
  id: string;
  total_price: string;
  currency: string;
  email: string;
  customer: {
    first_name: string;
    last_name: string;
  };
}

// Payment result type
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

// Mock data generator functions
export function createMockOrder(overrides?: Partial<OrderData>): OrderData;
export function createMockPaymentResult(overrides?: Partial<PaymentResult>): PaymentResult;

// Custom render function
export function renderWithProviders(
  ui: ReactElement,
  options?: CustomRenderOptions
): RenderResult;

// Mock API responses
export const mockApiResponses: {
  successfulPayment: PaymentResult;
  failedPayment: PaymentResult;
  pendingPayment: PaymentResult;
};

// Mock Shopify responses
export const mockShopifyResponses: {
  shop: {
    id: string;
    name: string;
    email: string;
    domain: string;
  };
  order: OrderData;
  transaction: {
    id: string;
    amount: string;
    currency: string;
    status: string;
    test: boolean;
    gateway: string;
  };
};

// Mock fetch responses
export function mockFetchResponses(): void;

// Helper functions
export function waitForPaymentCompletion(): Promise<void>;
export function simulatePaymentSuccess(paymentId: string): Promise<void>;
export function simulatePaymentFailure(paymentId: string, error?: string): Promise<void>;

// Re-export testing-library utilities
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
