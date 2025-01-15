import React, { ReactElement } from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { AppProvider } from '@shopify/polaris';
import { createApp, ClientApplication, AppBridgeState } from '@shopify/app-bridge';
import { Provider as AppBridgeProvider } from '@shopify/app-bridge-react';
import { PaymentResult, OrderData } from '../../types';

// Types for test utilities
interface TranslationDictionary {
  [key: string]: string | TranslationDictionary;
}

type WrapperProps = {
  children: React.ReactNode;
};

export interface TestWrapperProps {
  children?: React.ReactNode;
  shopOrigin?: string;
  apiKey?: string;
}

export interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  shopOrigin?: string;
  apiKey?: string;
}

// Mock data generators
export const createMockOrder = (overrides: Partial<OrderData> = {}): OrderData => ({
  id: 'gid://shopify/Order/12345',
  total_price: '100.00',
  currency: 'USD',
  email: 'customer@example.com',
  customer: {
    first_name: 'John',
    last_name: 'Doe'
  },
  ...overrides
});

export const createMockPaymentResult = (overrides: Partial<PaymentResult> = {}): PaymentResult => ({
  id: 'test_payment_id',
  status: 'pending',
  amount: 10000,
  currency: 'USD',
  ...overrides
});

// Mock Shopify App Bridge
export const mockAppBridge = {
  dispatch: jest.fn(),
  subscribe: jest.fn(),
  error: jest.fn()
};

// Mock translations
const translations: TranslationDictionary = {
  Polaris: {
    Common: {
      loading: 'Loading',
    },
  },
};

// Test wrapper component
const TestWrapper = ({
  children,
  shopOrigin = 'test-store.myshopify.com',
  apiKey = 'test_api_key'
}: TestWrapperProps): JSX.Element => {
  const appConfig = {
    apiKey,
    host: shopOrigin,
    forceRedirect: false
  };

  const app = createApp(appConfig);

  return React.createElement(
    AppBridgeProvider,
    { config: appConfig },
    React.createElement(
      AppProvider,
      { i18n: translations },
      children
    )
  );
};

// Custom render function
export const renderWithProviders = (
  ui: ReactElement,
  options: CustomRenderOptions = {}
): RenderResult => {
  const {
    shopOrigin = 'test-store.myshopify.com',
    apiKey = 'test_api_key',
    ...renderOptions
  } = options;

  const WrapperComponent = ({ children }: WrapperProps): JSX.Element =>
    React.createElement(TestWrapper, { shopOrigin, apiKey, children });

  return render(ui, { wrapper: WrapperComponent, ...renderOptions });
};

// Mock API responses
export const mockApiResponses = {
  successfulPayment: {
    id: 'test_payment_id',
    status: 'completed',
    amount: 10000,
    currency: 'USD'
  },
  failedPayment: {
    id: 'test_payment_id',
    status: 'failed',
    amount: 10000,
    currency: 'USD',
    error: {
      code: 'PAYMENT_FAILED',
      message: 'Payment processing failed'
    }
  },
  pendingPayment: {
    id: 'test_payment_id',
    status: 'pending',
    amount: 10000,
    currency: 'USD'
  }
};

// Mock Shopify API responses
export const mockShopifyResponses = {
  shop: {
    id: 'gid://shopify/Shop/12345',
    name: 'Test Store',
    email: 'store@example.com',
    domain: 'test-store.myshopify.com'
  },
  order: createMockOrder(),
  transaction: {
    id: 'gid://shopify/OrderTransaction/12345',
    amount: '100.00',
    currency: 'USD',
    status: 'success',
    test: true,
    gateway: 'nimipay'
  }
};

// Mock fetch responses
export const mockFetchResponses = (): void => {
  const originalFetch = global.fetch;
  beforeAll(() => {
    global.fetch = jest.fn();
  });
  afterAll(() => {
    global.fetch = originalFetch;
  });
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });
};

// Helper functions
export const waitForPaymentCompletion = async (): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 100));
};

export const simulatePaymentSuccess = async (paymentId: string): Promise<void> => {
  const event = new CustomEvent('nimipay:payment', {
    detail: {
      type: 'payment:success',
      data: {
        paymentId,
        ...mockApiResponses.successfulPayment
      }
    }
  });
  window.dispatchEvent(event);
  await waitForPaymentCompletion();
};

export const simulatePaymentFailure = async (paymentId: string, error = 'Payment failed'): Promise<void> => {
  const event = new CustomEvent('nimipay:payment', {
    detail: {
      type: 'payment:failure',
      data: {
        paymentId,
        error: {
          code: 'PAYMENT_FAILED',
          message: error
        }
      }
    }
  });
  window.dispatchEvent(event);
  await waitForPaymentCompletion();
};

// Test matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidPaymentResult(): R;
    }
  }
}

expect.extend({
  toBeValidPaymentResult(this: jest.MatcherContext, received: PaymentResult): jest.CustomMatcherResult {
    const isValid = Boolean(
      received.id &&
      ['pending', 'completed', 'failed'].includes(received.status) &&
      typeof received.amount === 'number' &&
      typeof received.currency === 'string'
    );

    return {
      pass: isValid,
      message: () =>
        `expected ${JSON.stringify(received)} to be a valid PaymentResult`
    };
  }
});

// Re-export testing-library utilities
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
