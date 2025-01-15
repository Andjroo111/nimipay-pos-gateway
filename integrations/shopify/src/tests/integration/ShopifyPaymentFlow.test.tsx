import React from 'react';
import { renderWithProviders, mockApiResponses } from '../utils/test-utils';
import { ShopifyPaymentProcessor } from '../../payment/ShopifyPaymentProcessor';
import { screen, fireEvent, waitFor } from '@testing-library/react';

jest.setTimeout(10000); // Increase timeout for async operations

describe('Shopify Payment Flow Integration', () => {
  const mockOrder = {
    id: 'gid://shopify/Order/12345',
    total_price: '100.00',
    currency: 'USD',
    test: true
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock Shopify API endpoints with delay to simulate network latency
    global.fetch = jest.fn().mockImplementation((url) => {
      if (url.includes('/payment/process')) {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: () => Promise.resolve(mockApiResponses.successfulPayment)
            });
          }, 500); // Add longer delay to ensure we can catch processing state
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      });
    }) as jest.Mock;
  });

  it('should process payment successfully', async () => {
    const onSuccess = jest.fn();
    const onError = jest.fn();

    // Render payment processor
    renderWithProviders(
      <ShopifyPaymentProcessor
        order={mockOrder}
        onSuccess={onSuccess}
        onError={onError}
      />
    );

    // Wait for payment button to be visible
    const payButton = await screen.findByRole('button', { 
      name: new RegExp(`Pay ${mockOrder.currency} ${mockOrder.total_price}`, 'i') 
    });
    expect(payButton).toBeInTheDocument();

    // Click pay button
    fireEvent.click(payButton);

    // Wait for processing state
    await waitFor(() => {
      const processingStatus = screen.getByRole('status', { name: 'Processing payment' });
      expect(processingStatus).toBeInTheDocument();
      expect(screen.getByText('Processing payment...')).toBeInTheDocument();
    }, { timeout: 2000 });

    // Wait for success state
    await waitFor(() => {
      const successMessage = screen.getByText(/your payment has been processed successfully/i);
      expect(successMessage).toBeInTheDocument();
    }, { timeout: 3000 });

    // Verify success callback was called
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(mockApiResponses.successfulPayment);
      expect(onError).not.toHaveBeenCalled();
    });
  });

  it('should handle payment failure gracefully', async () => {
    // Mock failed payment response
    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve(mockApiResponses.failedPayment)
      })
    ) as jest.Mock;

    const onSuccess = jest.fn();
    const onError = jest.fn();

    // Render payment processor
    renderWithProviders(
      <ShopifyPaymentProcessor
        order={mockOrder}
        onSuccess={onSuccess}
        onError={onError}
      />
    );

    // Wait for payment button to be visible
    const payButton = await screen.findByRole('button', {
      name: new RegExp(`Pay ${mockOrder.currency} ${mockOrder.total_price}`, 'i')
    });
    expect(payButton).toBeInTheDocument();

    // Click pay button
    fireEvent.click(payButton);

    // Wait for error message
    await waitFor(() => {
      const errorMessage = screen.getByText(/payment failed/i);
      expect(errorMessage).toBeInTheDocument();
    });

    // Verify error callback was called
    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'PAYMENT_FAILED',
          message: expect.any(String)
        })
      );
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });

  it('should validate order data before processing', async () => {
    const invalidOrder = {
      id: 'gid://shopify/Order/12345',
      total_price: '-100.00', // Invalid negative amount
      currency: 'USD',
      test: true
    };

    const onSuccess = jest.fn();
    const onError = jest.fn();

    // Render payment processor with invalid order
    renderWithProviders(
      <ShopifyPaymentProcessor
        order={invalidOrder}
        onSuccess={onSuccess}
        onError={onError}
      />
    );

    // Wait for payment button to be visible
    const payButton = await screen.findByRole('button', {
      name: new RegExp(`Pay ${invalidOrder.currency} ${invalidOrder.total_price}`, 'i')
    });
    expect(payButton).toBeInTheDocument();

    // Click pay button
    fireEvent.click(payButton);

    // Verify validation error
    await waitFor(() => {
      const errorMessage = screen.getByText(/invalid order amount/i);
      expect(errorMessage).toBeInTheDocument();
    });

    // Verify error callback was called with validation error
    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: expect.stringContaining('amount')
        })
      );
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });

  it('should handle network errors appropriately', async () => {
    // Mock network error
    global.fetch = jest.fn().mockImplementation(() =>
      Promise.reject(new Error('Network error'))
    ) as jest.Mock;

    const onSuccess = jest.fn();
    const onError = jest.fn();

    // Render payment processor
    renderWithProviders(
      <ShopifyPaymentProcessor
        order={mockOrder}
        onSuccess={onSuccess}
        onError={onError}
      />
    );

    // Wait for payment button to be visible
    const payButton = await screen.findByRole('button', {
      name: new RegExp(`Pay ${mockOrder.currency} ${mockOrder.total_price}`, 'i')
    });
    expect(payButton).toBeInTheDocument();

    // Click pay button
    fireEvent.click(payButton);

    // Wait for error message
    await waitFor(() => {
      const errorMessage = screen.getByText(/network error/i);
      expect(errorMessage).toBeInTheDocument();
    });

    // Verify error callback was called with network error
    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'NETWORK_ERROR',
          message: expect.any(String)
        })
      );
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });
});
