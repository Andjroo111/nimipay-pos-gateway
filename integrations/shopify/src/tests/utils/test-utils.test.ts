import React from 'react';
import { screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  renderWithProviders,
  createMockOrder,
  createMockPaymentResult,
  mockApiResponses,
  mockShopifyResponses,
} from './test-utils';

describe('Test Utilities', () => {
  describe('Mock Data Generators', () => {
    it('should create mock order with default values', () => {
      const order = createMockOrder();
      expect(order.id).toBe('gid://shopify/Order/12345');
      expect(order.total_price).toBe('100.00');
      expect(order.currency).toBe('USD');
      expect(order.customer.first_name).toBe('John');
    });

    it('should create mock order with overridden values', () => {
      const order = createMockOrder({
        id: 'custom-id',
        total_price: '200.00',
      });
      expect(order.id).toBe('custom-id');
      expect(order.total_price).toBe('200.00');
      expect(order.currency).toBe('USD'); // Default value remains
    });

    it('should create mock payment result with default values', () => {
      const payment = createMockPaymentResult();
      expect(payment).toBeValidPaymentResult();
      expect(payment.status).toBe('pending');
      expect(payment.amount).toBe(10000);
    });

    it('should create mock payment result with overridden values', () => {
      const payment = createMockPaymentResult({
        status: 'completed',
        amount: 20000,
      });
      expect(payment).toBeValidPaymentResult();
      expect(payment.status).toBe('completed');
      expect(payment.amount).toBe(20000);
    });
  });

  describe('Render Utilities', () => {
    const TestComponent: React.FC = () => {
      return React.createElement(
        'div',
        null,
        React.createElement('h1', null, 'Test Component'),
        React.createElement('p', null, 'This is a test component')
      );
    };

    it('should render component with default provider values', () => {
      renderWithProviders(React.createElement(TestComponent));
      expect(screen.getByText('Test Component')).toBeInTheDocument();
      expect(screen.getByText('This is a test component')).toBeInTheDocument();
    });

    it('should render component with custom provider values', () => {
      renderWithProviders(
        React.createElement(TestComponent),
        {
          shopOrigin: 'custom-store.myshopify.com',
          apiKey: 'custom-api-key',
        }
      );
      expect(screen.getByText('Test Component')).toBeInTheDocument();
    });
  });

  describe('Mock API Responses', () => {
    it('should have valid successful payment response', () => {
      expect(mockApiResponses.successfulPayment).toBeValidPaymentResult();
      expect(mockApiResponses.successfulPayment.status).toBe('completed');
    });

    it('should have valid failed payment response', () => {
      expect(mockApiResponses.failedPayment).toBeValidPaymentResult();
      expect(mockApiResponses.failedPayment.status).toBe('failed');
      expect(mockApiResponses.failedPayment.error).toBeDefined();
    });

    it('should have valid pending payment response', () => {
      expect(mockApiResponses.pendingPayment).toBeValidPaymentResult();
      expect(mockApiResponses.pendingPayment.status).toBe('pending');
    });
  });

  describe('Mock Shopify Responses', () => {
    it('should have valid shop response', () => {
      expect(mockShopifyResponses.shop.id).toContain('Shop');
      expect(mockShopifyResponses.shop.domain).toContain('myshopify.com');
    });

    it('should have valid order response', () => {
      const order = mockShopifyResponses.order;
      expect(order.id).toContain('Order');
      expect(order.customer).toBeDefined();
    });

    it('should have valid transaction response', () => {
      const transaction = mockShopifyResponses.transaction;
      expect(transaction.id).toContain('OrderTransaction');
      expect(transaction.gateway).toBe('nimipay');
    });
  });
});
