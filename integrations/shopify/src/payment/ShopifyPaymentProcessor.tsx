import React, { useState } from 'react';
import { Button, Banner, Spinner, Text } from '@shopify/polaris';

export interface ShopifyOrder {
  id: string;
  total_price: string;
  currency: string;
  test?: boolean;
}

export interface PaymentError {
  code: string;
  message: string;
}

interface ShopifyPaymentProcessorProps {
  order: ShopifyOrder;
  onSuccess: (result: any) => void;
  onError: (error: PaymentError) => void;
}

export const ShopifyPaymentProcessor: React.FC<ShopifyPaymentProcessorProps> = ({
  order,
  onSuccess,
  onError,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  const validateOrder = (order: ShopifyOrder): boolean => {
    const amount = parseFloat(order.total_price);
    if (isNaN(amount) || amount <= 0) {
      onError({
        code: 'VALIDATION_ERROR',
        message: 'Invalid order amount',
      });
      setError('Invalid order amount');
      return false;
    }
    return true;
  };

  const processPayment = async () => {
    if (!validateOrder(order)) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch('/payment/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ order }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || 'Payment processing failed');
      }

      setIsComplete(true);
      onSuccess(result);
    } catch (err) {
      const error = err as Error;
      const isNetworkError = error.message.toLowerCase().includes('network');
      
      setError(error.message);
      onError({
        code: isNetworkError ? 'NETWORK_ERROR' : 'PAYMENT_FAILED',
        message: error.message,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isComplete) {
    return (
      <Banner tone="success" title="Payment Successful">
        <Text as="p">Your payment has been processed successfully.</Text>
      </Banner>
    );
  }

  return (
    <div>
      {error && (
        <Banner tone="critical" title="Payment Failed">
          <Text as="p">{error}</Text>
        </Banner>
      )}
      
      {isProcessing ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <div role="status" aria-label="Processing payment">
            <Spinner size="large" />
            <Text as="p" variant="bodyMd">Processing payment...</Text>
          </div>
        </div>
      ) : (
        <Button
          variant="primary"
          onClick={processPayment}
          size="large"
        >
          Pay {order.currency} {order.total_price}
        </Button>
      )}
    </div>
  );
};
