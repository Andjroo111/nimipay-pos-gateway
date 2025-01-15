# Nimipay Acuity Integration

A TypeScript integration for Acuity Scheduling with payment processing capabilities.

## Features

- OAuth2 authentication with automatic token refresh
- Appointment scheduling and payment processing
- Secure webhook handling
- TypeScript support with full type definitions
- Comprehensive test coverage
- Detailed documentation

## Installation

```bash
npm install @nimipay/acuity-integration
```

## Quick Start

1. **Configure the Integration**

```typescript
import { AcuityIntegration } from '@nimipay/acuity-integration';

const config = {
  clientId: process.env.ACUITY_CLIENT_ID,
  clientSecret: process.env.ACUITY_CLIENT_SECRET,
  redirectUri: 'https://your-app.com/callback',
  scope: ['appointments', 'payments']
};

const webhookConfig = {
  url: 'https://your-app.com/webhooks/acuity',
  secret: process.env.ACUITY_WEBHOOK_SECRET,
  events: ['payment.succeeded', 'payment.failed', 'refund.succeeded']
};

const integration = new AcuityIntegration(config, webhookConfig);
```

2. **Initialize Authentication**

```typescript
// Get auth URL
const authUrl = integration.getAuthUrl();
// Redirect user to authUrl

// Handle callback
app.get('/callback', async (req, res) => {
  await integration.handleAuthCallback(req.query.code);
  // User is now authenticated
});
```

3. **Process Payments**

```typescript
const paymentDetails = {
  appointmentId: 123,
  amount: 100,
  currency: 'USD',
  customerId: 'cust_123'
};

try {
  const result = await integration.processPayment(paymentDetails);
  if (result.success) {
    console.log(`Payment successful: ${result.transactionId}`);
  }
} catch (error) {
  console.error('Payment failed:', error);
}
```

4. **Handle Webhooks**

```typescript
app.post('/webhooks/acuity', async (req, res) => {
  const signature = req.headers['x-acuity-signature'];
  const payload = JSON.stringify(req.body);
  
  if (!integration.verifyWebhookSignature(signature, payload)) {
    res.status(400).send('Invalid signature');
    return;
  }

  try {
    await integration.handleWebhook(req.body);
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook processing failed:', error);
    res.status(500).send('Internal error');
  }
});
```

## Documentation

- [API Reference](./docs/API_REFERENCE.md) - Detailed API documentation
- [Integration Guide](./docs/INTEGRATION_GUIDE.md) - Step-by-step integration guide
- [Security Guide](./docs/SECURITY_GUIDE.md) - Security best practices

## Development

### Prerequisites

- Node.js 16+
- npm 7+
- TypeScript 4.5+

### Setup

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build
```

### Testing

```bash
# Run all tests
npm test

# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run tests with coverage
npm run test:coverage
```

### Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For issues and feature requests:
- Open an issue on GitHub
- Contact support@nimipay.com

## Security

Please report security vulnerabilities to security@nimipay.com.
