# NimiPay Payment Gateway

A multi-currency cryptocurrency payment gateway supporting BTC, USDC, and UST with gas abstraction.

## Features

- Multiple cryptocurrency support:
  - Bitcoin (BTC)
  - USD Coin (USDC) with gas abstraction
  - Terra USD (UST)
- Platform integrations:
  - WordPress/WooCommerce
  - Wix
  - Squarespace
- Automatic exchange rate updates
- Transaction monitoring
- Comprehensive API
- Security features

## Installation

### WordPress Plugin

1. Download the latest release
2. Upload to wp-content/plugins/
3. Activate through WordPress admin
4. Configure in WooCommerce > Settings > Payments

Detailed instructions: [WordPress Integration Guide](integrations/wordpress/README.md)

### Wix Integration

1. Add custom element to your site
2. Configure API keys
3. Add payment button to checkout

Detailed instructions: [Wix Integration Guide](integrations/wix/README.md)

### Squarespace Integration

1. Enable code injection
2. Add header and footer code
3. Configure API keys

Detailed instructions: [Squarespace Integration Guide](integrations/squarespace/README.md)

## API Documentation

### Authentication

```bash
# API Key authentication
curl -H "Authorization: Bearer YOUR_API_KEY" \
     https://api.nimipay.com/v1/payments
```

### Create Payment

```bash
curl -X POST https://api.nimipay.com/v1/payments \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "amount": 100.00,
       "currency": "USDC",
       "success_url": "https://your-site.com/success",
       "cancel_url": "https://your-site.com/cancel"
     }'
```

### Get Payment Status

```bash
curl https://api.nimipay.com/v1/payments/PAYMENT_ID \
     -H "Authorization: Bearer YOUR_API_KEY"
```

### Get Exchange Rates

```bash
curl https://api.nimipay.com/v1/exchange-rates \
     -H "Authorization: Bearer YOUR_API_KEY"
```

### Webhook Events

```json
{
  "event": "payment.completed",
  "data": {
    "payment_id": "pay_123",
    "status": "completed",
    "amount": 100.00,
    "currency": "USDC"
  }
}
```

## Configuration

### Environment Variables

```bash
# API Configuration
NIMIPAY_API_KEY=your_api_key
NIMIPAY_TEST_MODE=true

# Network Configuration
NIMIPAY_ETH_RPC_URL=https://mainnet.infura.io/v3/YOUR-PROJECT-ID
NIMIPAY_TERRA_LCD_URL=https://lcd.terra.dev

# Gas Abstraction
NIMIPAY_MAX_GAS_PRICE=100 # in gwei
NIMIPAY_GAS_PRICE_BUFFER=1.2 # 20% buffer

# Security
NIMIPAY_WEBHOOK_SECRET=your_webhook_secret
NIMIPAY_RATE_LIMIT=100 # requests per minute
```

### Currency Configuration

```json
{
  "BTC": {
    "decimals": 8,
    "min_amount": 0.00001,
    "max_amount": 100,
    "confirmations": {
      "mainnet": 2,
      "testnet": 1
    }
  },
  "USDC": {
    "decimals": 6,
    "min_amount": 1,
    "max_amount": 1000000,
    "confirmations": {
      "mainnet": 12,
      "testnet": 5
    }
  },
  "UST": {
    "decimals": 6,
    "min_amount": 1,
    "max_amount": 1000000,
    "confirmations": {
      "mainnet": 15,
      "testnet": 5
    }
  }
}
```

## Development

### Requirements

- PHP 7.4+
- Node.js 14+
- Composer
- WordPress 5.0+ (for WP integration)

### Setup

```bash
# Install dependencies
composer install
npm install

# Build assets
npm run build

# Run tests
composer test
npm test

# Start development server
npm run dev
```

### Testing

```bash
# Unit tests
composer test:unit

# Integration tests
composer test:integration

# E2E tests
npm run test:e2e

# Coverage report
composer test:coverage
```

## Security

### Best Practices

1. Always use HTTPS
2. Validate all user input
3. Keep dependencies updated
4. Monitor transactions
5. Use rate limiting
6. Implement proper error handling

### Known Issues

See [SECURITY.md](SECURITY.md) for details.

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## Support

- Documentation: https://docs.nimipay.com
- Issues: https://github.com/nimipay/gateway/issues
- Email: support@nimipay.com
- Discord: https://discord.gg/nimipay

## License

This project is licensed under the MIT License - see [LICENSE](LICENSE) for details.
