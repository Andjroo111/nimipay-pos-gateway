# Acuity Integration API Reference

## Overview

The Acuity integration provides a seamless way to integrate Acuity Scheduling with payment processing capabilities. This document outlines the key components and their usage.

## Components

### AcuityIntegration

The main integration class that coordinates authentication, payment processing, and webhook handling.

```typescript
import { AcuityIntegration } from '@nimipay/acuity-integration';

const config = {
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  redirectUri: 'https://your-app.com/callback',
  scope: ['appointments', 'payments']
};

const webhookConfig = {
  url: 'https://your-app.com/webhooks/acuity',
  secret: 'your-webhook-secret',
  events: ['payment.succeeded', 'payment.failed', 'refund.succeeded']
};

const integration = new AcuityIntegration(config, webhookConfig);
```

#### Methods

- `initialize()`: Initialize the integration and restore any existing authentication state
- `getAuthUrl()`: Get the OAuth authorization URL for Acuity
- `handleAuthCallback(code: string)`: Handle the OAuth callback and exchange code for tokens
- `isAuthenticated()`: Check if the integration is currently authenticated
- `processPayment(details: AcuityPaymentDetails)`: Process a payment for an appointment
- `refundPayment(appointmentId: number)`: Refund a payment for an appointment
- `verifyWebhookSignature(signature: string, payload: string)`: Verify webhook signature
- `handleWebhook(event: WebhookEvent)`: Handle incoming webhook events

### Authentication

The integration uses OAuth 2.0 for authentication. The flow is:

1. Get authorization URL:
```typescript
const authUrl = integration.getAuthUrl();
// Redirect user to authUrl
```

2. Handle callback:
```typescript
await integration.handleAuthCallback(code);
// User is now authenticated
```

### Payment Processing

Process payments for appointments:

```typescript
const paymentDetails = {
  appointmentId: 123,
  amount: 100,
  currency: 'USD',
  customerId: 'cust_123'
};

const result = await integration.processPayment(paymentDetails);
if (result.success) {
  console.log(`Payment successful: ${result.transactionId}`);
} else {
  console.error(`Payment failed: ${result.error}`);
}
```

### Webhook Handling

1. Configure your webhook endpoint in the Acuity dashboard using the URL from your webhook config.

2. Verify and handle incoming webhooks:

```typescript
app.post('/webhooks/acuity', (req, res) => {
  const signature = req.headers['x-acuity-signature'];
  const payload = JSON.stringify(req.body);
  
  if (!integration.verifyWebhookSignature(signature, payload)) {
    res.status(400).send('Invalid signature');
    return;
  }

  await integration.handleWebhook(req.body);
  res.status(200).send('OK');
});
```

## Types

### AcuityConfig
```typescript
interface AcuityConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string[];
}
```

### WebhookConfig
```typescript
interface WebhookConfig {
  url: string;
  secret: string;
  events: string[];
}
```

### AcuityPaymentDetails
```typescript
interface AcuityPaymentDetails {
  appointmentId: number;
  amount: number;
  currency: string;
  customerId: string;
}
```

### PaymentResult
```typescript
interface PaymentResult {
  success: boolean;
  transactionId?: string;
  amount?: number;
  error?: string;
}
```

### WebhookEvent
```typescript
interface WebhookEvent {
  type: string;
  data: {
    appointmentId: number;
    status: string;
    transactionId?: string;
    amount?: number;
    currency?: string;
    timestamp: string;
  };
  signature: string;
}
```

## Error Handling

The integration throws errors in the following cases:

- Authentication errors (invalid/expired tokens)
- API errors (rate limits, server errors)
- Invalid webhook signatures
- Payment processing failures

Example error handling:

```typescript
try {
  await integration.processPayment(paymentDetails);
} catch (error) {
  if (error instanceof Error) {
    console.error('Payment failed:', error.message);
  }
}
```

## Best Practices

1. **Authentication**
   - Store refresh tokens securely
   - Handle token refresh automatically
   - Check authentication state before operations

2. **Payment Processing**
   - Validate payment details before processing
   - Handle failed payments gracefully
   - Implement proper error handling

3. **Webhooks**
   - Always verify webhook signatures
   - Process webhooks idempotently
   - Implement proper error handling
   - Respond quickly to webhook requests

4. **Security**
   - Never expose client secrets
   - Use HTTPS for all endpoints
   - Validate all input data
   - Implement proper rate limiting

## Rate Limits

The integration respects Acuity's rate limits:

- Authentication: 100 requests per minute
- API calls: 1000 requests per minute
- Webhooks: No specific limit, but implement retry logic

## Support

For issues and feature requests, please open an issue in the GitHub repository or contact support@nimipay.com.
