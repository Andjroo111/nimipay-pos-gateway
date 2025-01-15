# NimiPay Shopify Integration

This integration enables Shopify stores to accept cryptocurrency payments through the NimiPay payment gateway.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [API Reference](#api-reference)

## Prerequisites

- Shopify Partner account
- Shopify store on Basic plan or higher
- NimiPay merchant account
- Node.js 14.x or higher
- NPM 6.x or higher

## Installation

### 1. Install the NimiPay App

1. Visit the Shopify App Store and search for "NimiPay Crypto Payments"
2. Click "Add app" and follow the installation process
3. Grant the required permissions when prompted

### 2. Configure API Keys

1. Log in to your [NimiPay Dashboard](https://dashboard.nimipay.com)
2. Navigate to Settings > API Keys
3. Generate a new API key for your Shopify integration
4. Copy both the API Key and Secret

### 3. Configure Shopify Settings

1. In your Shopify admin, go to Settings > Payments
2. Under "Alternative Payments", click "Choose alternative payment"
3. Select "NimiPay" from the list
4. Enter your NimiPay API credentials
5. Click "Activate"

## Configuration

### Environment Variables

```env
NIMIPAY_API_KEY=your_api_key
NIMIPAY_API_SECRET=your_api_secret
NIMIPAY_WEBHOOK_SECRET=your_webhook_secret
SHOPIFY_APP_API_KEY=your_shopify_api_key
SHOPIFY_APP_SECRET=your_shopify_secret
```

### Webhook Configuration

The following webhooks will be automatically configured during installation:

- `orders/paid`: Triggered when an order is paid
- `orders/cancelled`: Triggered when an order is cancelled

### Payment Settings

Configure your payment settings in the NimiPay Shopify app:

1. Supported cryptocurrencies
2. Exchange rate settings
3. Transaction fee settings
4. Confirmation requirements

## Usage

### Adding the Payment Button

The payment button will automatically appear in your checkout when NimiPay is enabled. However, you can also manually add it to any page:

```javascript
import { PaymentButton } from '@nimipay/shopify';

const CheckoutPage = () => {
    const handleSuccess = (data) => {
        console.log('Payment successful:', data);
    };

    const handleFailure = (error) => {
        console.error('Payment failed:', error);
    };

    return (
        <PaymentButton
            order={orderData}
            onSuccess={handleSuccess}
            onFailure={handleFailure}
            buttonText="Pay with Crypto"
            testMode={false}
        />
    );
};
```

### Processing Payments

The payment flow follows these steps:

1. Customer clicks the NimiPay payment button
2. Payment modal opens with available cryptocurrency options
3. Customer selects currency and confirms payment
4. Payment is processed and order status is updated
5. Customer is redirected to success/failure page

### Handling Callbacks

```javascript
window.addEventListener('nimipay:callback', (event) => {
    const { type, data } = event.detail;
    
    switch (type) {
        case 'success':
            // Handle successful payment
            break;
        case 'failure':
            // Handle failed payment
            break;
        case 'pending':
            // Handle pending payment
            break;
    }
});
```

## Security

### Authentication

- All API requests are authenticated using HMAC signatures
- Webhooks are verified using the webhook secret
- OAuth tokens are encrypted and stored securely

### Best Practices

1. Always verify webhook signatures
2. Use HTTPS for all API endpoints
3. Implement rate limiting
4. Monitor for suspicious activity
5. Keep API keys secure

### PCI Compliance

NimiPay handles all cryptocurrency transactions, so your Shopify store remains PCI compliant without additional requirements.

## Troubleshooting

### Common Issues

1. **Payment Button Not Appearing**
   - Verify NimiPay is enabled in Shopify settings
   - Check browser console for errors
   - Verify API keys are correct

2. **Payment Processing Errors**
   - Check API key permissions
   - Verify webhook endpoints are accessible
   - Check network connectivity

3. **Webhook Issues**
   - Verify webhook URLs are correct
   - Check webhook secret
   - Monitor webhook logs

### Debug Mode

Enable debug mode for detailed logging:

```javascript
window.NimiPayConfig = {
    debug: true,
    logLevel: 'debug'
};
```

### Support

- Email: support@nimipay.com
- Documentation: https://docs.nimipay.com
- GitHub Issues: https://github.com/nimipay/shopify-integration/issues

## API Reference

### NimipayShopifyAPI

Main API client for interacting with NimiPay services.

```javascript
const api = new NimipayShopifyAPI({
    apiKey: 'your_api_key',
    shopifyAccessToken: 'your_access_token',
    testmode: false
});
```

### ShopifyAuth

Handles authentication and session management.

```javascript
const auth = new ShopifyAuth({
    apiKey: 'your_shopify_api_key',
    apiSecret: 'your_shopify_secret',
    scope: 'read_orders,write_orders'
});
```

### ShopifyPaymentProcessor

Processes payments and manages order status.

```javascript
const processor = new ShopifyPaymentProcessor({
    api: nimipayApi,
    auth: shopifyAuth
});
```

### PaymentButton Component

React component for payment button UI.

```javascript
<PaymentButton
    order={orderData}
    onSuccess={handleSuccess}
    onFailure={handleFailure}
    onPending={handlePending}
    className="custom-button"
    buttonText="Pay with Crypto"
    testMode={false}
/>
```

For detailed API documentation, see [API_REFERENCE.md](./API_REFERENCE.md).
