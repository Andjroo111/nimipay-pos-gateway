# Nimipay Payment Gateway for WooCommerce

Accept cryptocurrency payments in your WooCommerce store using Nimipay. This plugin enables seamless integration with the Nimipay payment platform, allowing your customers to pay with various cryptocurrencies.

## Features

- Accept multiple cryptocurrencies (NIM, BTC, USDC)
- Automatic exchange rate conversion
- Real-time payment verification
- Detailed transaction history
- Test mode for development
- Comprehensive webhook support
- Secure payment processing

## Requirements

- WordPress 5.0 or higher
- WooCommerce 4.0 or higher
- PHP 7.2 or higher
- SSL certificate (for secure transactions)
- Nimipay merchant account

## Installation

1. Download the plugin files
2. Upload the plugin folder to `/wp-content/plugins/` directory
3. Activate the plugin through the 'Plugins' menu in WordPress
4. Configure the plugin in WooCommerce > Settings > Payments

## Configuration

### Basic Setup

1. Go to WooCommerce > Settings > Payments
2. Click on "Nimipay" to access the settings
3. Enable the payment gateway
4. Enter your API keys (available from your Nimipay dashboard)
5. Configure the payment title and description
6. Save changes

### API Keys

1. Log in to your [Nimipay Dashboard](https://dashboard.nimipay.com)
2. Navigate to Settings > API Keys
3. Generate new API keys for live and test modes
4. Copy the keys to your WooCommerce settings

### Webhook Configuration

1. In your Nimipay Dashboard, go to Settings > Webhooks
2. Add a new webhook endpoint:
   ```
   https://your-store.com/wc-api/wc_nimipay_gateway
   ```
3. Copy the webhook signing secret
4. Save the webhook configuration

## Testing

### Test Mode

1. Enable "Test Mode" in the gateway settings
2. Use test API keys
3. Process test payments using:
   - NIM Testnet
   - Bitcoin Testnet
   - USDC Goerli Testnet

### Test Cards

Use these test cryptocurrency addresses for development:
- NIM: `NQ07 0000 0000 0000 0000 0000 0000 0000 0000`
- BTC: `tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx`
- USDC: `0x0000000000000000000000000000000000000000`

## Troubleshooting

### Common Issues

1. Payment Not Processing
   - Verify API keys are correct
   - Check webhook configuration
   - Ensure SSL is properly configured
   - Verify cryptocurrency network status

2. Order Status Not Updating
   - Check webhook URL accessibility
   - Verify webhook signing secret
   - Review server error logs
   - Check WooCommerce status settings

3. Exchange Rate Issues
   - Verify currency configuration
   - Check rate provider status
   - Ensure proper network connectivity

### Debug Mode

Enable debug logging:
1. Add to wp-config.php:
   ```php
   define('WC_LOGGING', true);
   ```
2. Check logs in WooCommerce > Status > Logs

## Security

### Best Practices

1. Always use HTTPS
2. Keep WordPress and WooCommerce updated
3. Regularly rotate API keys
4. Monitor transaction logs
5. Implement strong admin passwords
6. Use two-factor authentication
7. Regular security audits

### PCI Compliance

- No sensitive payment data is stored
- All transactions are processed on Nimipay's secure servers
- Communication is encrypted using TLS 1.2+

## Development

### Local Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   composer install
   ```
3. Run tests:
   ```bash
   phpunit
   ```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Commit changes
4. Submit pull request

### Testing

Run the test suite:
```bash
cd wp-content/plugins/nimipay-woocommerce
composer test
```

## Support

- Documentation: https://docs.nimipay.com/woocommerce
- Support Email: support@nimipay.com
- Issue Tracker: https://github.com/nimipay/woocommerce-gateway/issues

## License

This plugin is licensed under the GPLv2 license. See the LICENSE file for details.

## Changelog

### 1.0.0
- Initial release
- Basic payment processing
- Webhook support
- Test mode
- Multiple cryptocurrency support

## Credits

Developed by Nimipay (https://nimipay.com)
