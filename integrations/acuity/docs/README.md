# Nimipay Acuity Scheduling Integration

This integration enables seamless payment processing between Acuity Scheduling and Nimipay's payment gateway. It provides OAuth2 authentication, appointment scheduling, payment processing, and webhook handling capabilities.

## Features

- OAuth2 authentication with Acuity Scheduling
- Secure payment processing for appointments
- Webhook support for real-time updates
- Calendar synchronization
- Client management
- Multiple service support

## Installation

```bash
npm install @nimipay/acuity-integration
```

## Configuration

1. Create an Acuity OAuth2 application in your [Acuity Developer Console](https://developers.acuityscheduling.com/)

2. Configure the integration with your credentials:

```typescript
import { AcuityIntegration } from '@nimipay/acuity-integration';

const integration = new AcuityIntegration({
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  redirectUri: 'https://your-domain.com/callback',
  scope: ['appointments', 'payments']
});

// Initialize the integration
await integration.initialize();
```

## Authentication

1. Generate the OAuth2 authorization URL:

```typescript
const authUrl = integration.getAuthUrl();
// Redirect user to authUrl
```

2. Handle the callback:

```typescript
// In your callback route handler
await integration.handleAuthCallback(code);
```

## Payment Processing

Process payments for appointments:

```typescript
const paymentResult = await integration.processPayment({
  amount: 100.00,
  currency: 'USD',
  appointmentId: 123,
  customerId: 'customer_123'
});

if (paymentResult.success) {
  console.log('Payment processed:', paymentResult.transactionId);
} else {
  console.error('Payment failed:', paymentResult.error);
}
```

## Webhook Configuration

1. Configure webhooks to receive real-time updates:

```typescript
await integration.configureWebhooks({
  url: 'https://your-domain.com/webhooks/acuity',
  secret: 'your-webhook-secret',
  events: [
    'payment.succeeded',
    'payment.failed',
    'canceled'
  ]
});
```

2. Handle webhook events:

```typescript
// In your webhook endpoint
app.post('/webhooks/acuity', async (req, res) => {
  try {
    await integration.handleWebhook(
      req.body,
      req.headers['x-acuity-signature']
    );
    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook error:', error);
    res.sendStatus(400);
  }
});
```

## Error Handling

The integration provides detailed error information:

```typescript
try {
  await integration.processPayment(paymentDetails);
} catch (error) {
  if (error.message === 'Appointment not found') {
    // Handle invalid appointment
  } else if (error.message === 'Payment failed') {
    // Handle payment failure
  } else {
    // Handle other errors
  }
}
```

## Testing

Run the test suite:

```bash
npm test
```

Run integration tests:

```bash
npm run test:integration
```

## Troubleshooting

### Common Issues

1. Authentication Failures
   - Verify your client ID and secret
   - Ensure redirect URI matches your Acuity app configuration
   - Check if access token has expired

2. Payment Processing Issues
   - Verify appointment exists and isn't already paid
   - Check payment details are correct
   - Ensure sufficient funds/valid payment method

3. Webhook Issues
   - Verify webhook URL is accessible
   - Check webhook signature verification
   - Ensure events are properly configured

### Debug Mode

Enable debug logging:

```typescript
const integration = new AcuityIntegration({
  ...config,
  debug: true
});
```

## API Reference

### AcuityIntegration

Main integration class that handles all interactions with Acuity Scheduling.

### AcuityAuth

Handles OAuth2 authentication flow and token management.

### AcuityPaymentProcessor

Processes payments and manages appointment payment status.

## Support

For issues and feature requests, please [create an issue](https://github.com/your-repo/issues) or contact support@nimipay.com.

## License

MIT License - see LICENSE file for details.
