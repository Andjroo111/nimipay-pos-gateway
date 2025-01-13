# NimiPay Integration for Squarespace

This guide explains how to integrate NimiPay cryptocurrency payments into your Squarespace website using code injection.

## Setup Instructions

### 1. Enable Code Injection

1. Log in to your Squarespace account
2. Go to Settings > Advanced > Code Injection
3. You'll be adding code to both the Header and Footer sections

### 2. Add Header Code

Add the following code to the Header section:

```html
<!-- NimiPay Styles -->
<style>
    .nimipay-container {
        max-width: 600px;
        margin: 20px auto;
        padding: 20px;
        background: #fff;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .nimipay-currency-select {
        width: 100%;
        padding: 10px;
        margin-bottom: 20px;
        border: 1px solid #ddd;
        border-radius: 4px;
    }

    .nimipay-amount-display {
        text-align: center;
        margin: 20px 0;
        padding: 15px;
        background: #f8f9fa;
        border-radius: 4px;
    }

    .nimipay-crypto-amount {
        font-weight: bold;
        color: #28a745;
    }

    .nimipay-button {
        width: 100%;
        padding: 12px;
        background: #007bff;
        color: #fff;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }

    .nimipay-button:disabled {
        background: #ccc;
        cursor: not-allowed;
    }

    .nimipay-error {
        color: #dc3545;
        margin-top: 10px;
        display: none;
    }
</style>

<!-- NimiPay Configuration -->
<script>
    window.NIMIPAY_CONFIG = {
        testMode: true, // Set to false for production
        apiKey: 'YOUR_API_KEY',
        testApiKey: 'YOUR_TEST_API_KEY'
    };
</script>
```

### 3. Add Footer Code

Add the following code to the Footer section:

```html
<!-- NimiPay Integration Script -->
<script src="https://cdn.nimipay.com/v1/nimipay.min.js"></script>
<script>
    // Initialize NimiPay
    document.addEventListener('DOMContentLoaded', function() {
        // Only initialize on checkout page
        if (window.location.pathname.includes('/checkout')) {
            initNimiPay();
        }
    });

    function initNimiPay() {
        // Create payment container
        const container = document.createElement('div');
        container.className = 'nimipay-container';
        container.innerHTML = `
            <select class="nimipay-currency-select">
                <option value="">Select Cryptocurrency...</option>
                <option value="BTC">Bitcoin (BTC)</option>
                <option value="USDC">USD Coin (USDC)</option>
                <option value="UST">Terra USD (UST)</option>
            </select>
            
            <div class="nimipay-amount-display">
                <span class="nimipay-fiat-amount"></span>
                <span> = </span>
                <span class="nimipay-crypto-amount"></span>
            </div>
            
            <button class="nimipay-button" disabled>
                Pay with Cryptocurrency
            </button>
            
            <div class="nimipay-error"></div>
        `;

        // Add container to page
        document.querySelector('.sqs-checkout-page').appendChild(container);

        // Initialize NimiPay
        const nimipay = new NimiPay({
            apiKey: window.NIMIPAY_CONFIG.testMode 
                ? window.NIMIPAY_CONFIG.testApiKey 
                : window.NIMIPAY_CONFIG.apiKey,
            testMode: window.NIMIPAY_CONFIG.testMode
        });

        // Handle currency selection
        const select = container.querySelector('.nimipay-currency-select');
        select.addEventListener('change', async function() {
            const currency = this.value;
            if (!currency) {
                container.querySelector('.nimipay-button').disabled = true;
                return;
            }

            try {
                // Get order total
                const total = parseFloat(
                    document.querySelector('.order-total').textContent.replace(/[^0-9.]/g, '')
                );

                // Get exchange rate
                const rate = await nimipay.getExchangeRate(currency);
                const cryptoAmount = total * rate;

                // Update display
                container.querySelector('.nimipay-fiat-amount').textContent = 
                    `$${total.toFixed(2)} USD`;
                container.querySelector('.nimipay-crypto-amount').textContent = 
                    formatCryptoAmount(cryptoAmount, currency);

                // Enable payment button
                container.querySelector('.nimipay-button').disabled = false;

            } catch (error) {
                showError('Error fetching exchange rate');
            }
        });

        // Handle payment
        container.querySelector('.nimipay-button').addEventListener('click', async function() {
            const currency = select.value;
            if (!currency) return;

            try {
                const total = parseFloat(
                    document.querySelector('.order-total').textContent.replace(/[^0-9.]/g, '')
                );

                // Create payment
                const payment = await nimipay.createPayment({
                    amount: total,
                    currency: currency,
                    orderId: getOrderId(),
                    successUrl: window.location.origin + '/payment-success',
                    cancelUrl: window.location.origin + '/cart'
                });

                // Redirect to payment page
                window.location.href = payment.paymentUrl;

            } catch (error) {
                showError('Payment creation failed');
            }
        });

        function formatCryptoAmount(amount, currency) {
            switch (currency) {
                case 'BTC':
                    return amount.toFixed(8) + ' BTC';
                case 'USDC':
                case 'UST':
                    return amount.toFixed(6) + ' ' + currency;
                default:
                    return amount.toFixed(2) + ' ' + currency;
            }
        }

        function showError(message) {
            const error = container.querySelector('.nimipay-error');
            error.textContent = message;
            error.style.display = 'block';
            setTimeout(() => {
                error.style.display = 'none';
            }, 5000);
        }

        function getOrderId() {
            // Extract order ID from URL or generate one
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get('orderNumber') || 
                   'ORDER-' + Math.random().toString(36).substr(2, 9);
        }
    }
</script>
```

### 4. Configure API Keys

1. Sign up for a NimiPay account at https://nimipay.com
2. Go to your dashboard and get your API keys
3. Replace `YOUR_API_KEY` and `YOUR_TEST_API_KEY` in the header code with your actual keys
4. Set `testMode` to `false` when ready for production

## Testing

1. Enable test mode in the configuration
2. Add items to cart and proceed to checkout
3. Select a cryptocurrency and verify the amount conversion
4. Complete a test payment using the provided test credentials

### Test Credentials

- BTC Testnet: Use any testnet wallet
- USDC Testnet: Use Metamask with Goerli network
- UST Testnet: Use Terra Station with Bombay testnet

## Customization

### Styling

You can customize the appearance by modifying the CSS in the header code. The main classes are:

- `.nimipay-container`: Main container
- `.nimipay-currency-select`: Currency dropdown
- `.nimipay-amount-display`: Amount display area
- `.nimipay-button`: Payment button
- `.nimipay-error`: Error message display

### Behavior

You can customize the behavior by modifying the JavaScript in the footer code:

- Change supported currencies
- Modify exchange rate handling
- Customize error messages
- Add additional validation

## Troubleshooting

### Common Issues

1. Payment button not appearing
   - Verify code injection is enabled
   - Check console for JavaScript errors
   - Ensure you're on the checkout page

2. Exchange rates not loading
   - Verify API keys are correct
   - Check network connectivity
   - Ensure testMode matches your API key type

3. Payment creation failing
   - Verify API keys and permissions
   - Check order amount formatting
   - Ensure success/cancel URLs are correct

### Support

For additional support:
- Documentation: https://docs.nimipay.com
- Email: support@nimipay.com
- Discord: https://discord.gg/nimipay

## Security Considerations

1. Always use HTTPS
2. Never expose API keys in client-side code
3. Validate all user input
4. Monitor transactions for suspicious activity
5. Keep dependencies updated
