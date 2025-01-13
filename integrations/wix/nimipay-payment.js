// NimiPay Payment Integration for Wix

import wixWindow from 'wix-window';
import wixLocation from 'wix-location';
import { currentCart } from 'wix-stores';

// NimiPay API configuration
const NIMIPAY_CONFIG = {
    testMode: true, // Set to false for production
    apiUrl: {
        test: 'https://testnet-api.nimipay.com/v1',
        prod: 'https://api.nimipay.com/v1'
    }
};

// Supported cryptocurrencies
const SUPPORTED_CURRENCIES = {
    BTC: {
        name: 'Bitcoin',
        icon: 'btc-icon.svg',
        confirmations: {
            mainnet: 2,
            testnet: 1
        }
    },
    USDC: {
        name: 'USD Coin',
        icon: 'usdc-icon.svg',
        confirmations: {
            mainnet: 12,
            testnet: 5
        }
    },
    UST: {
        name: 'Terra USD',
        icon: 'ust-icon.svg',
        confirmations: {
            mainnet: 15,
            testnet: 5
        }
    }
};

/**
 * Initialize payment form
 */
export function initPaymentForm() {
    // Get cart total
    const total = currentCart.total;
    
    // Create payment form HTML
    const formHtml = `
        <div class="nimipay-payment-container">
            <div class="currency-selector">
                <label>Select Payment Currency</label>
                <select id="nimipay-currency">
                    <option value="">Choose cryptocurrency...</option>
                    ${Object.entries(SUPPORTED_CURRENCIES).map(([code, currency]) => `
                        <option value="${code}">
                            ${currency.name} (${code})
                        </option>
                    `).join('')}
                </select>
            </div>
            
            <div class="payment-details">
                <div class="amount-display">
                    <span class="fiat-amount">$${total.toFixed(2)} USD</span>
                    <span class="equals">=</span>
                    <span class="crypto-amount"></span>
                </div>
                
                <div class="confirmation-details"></div>
            </div>
            
            <button id="nimipay-pay-button" class="payment-button" disabled>
                Pay with Cryptocurrency
            </button>
        </div>
    `;
    
    // Add form to page
    $w('#paymentContainer').html = formHtml;
    
    // Initialize event listeners
    initEventListeners();
}

/**
 * Initialize event listeners
 */
function initEventListeners() {
    // Currency selection
    $w('#nimipay-currency').onChange((event) => {
        const currency = event.target.value;
        if (currency) {
            updatePaymentDetails(currency);
            $w('#nimipay-pay-button').enable();
        } else {
            $w('#nimipay-pay-button').disable();
        }
    });
    
    // Payment button
    $w('#nimipay-pay-button').onClick(() => {
        processPayment();
    });
}

/**
 * Update payment details based on selected currency
 */
async function updatePaymentDetails(currency) {
    try {
        // Get exchange rate
        const rate = await getExchangeRate(currency);
        
        // Calculate crypto amount
        const fiatAmount = currentCart.total;
        const cryptoAmount = fiatAmount * rate;
        
        // Update display
        $w('.crypto-amount').text = formatCryptoAmount(cryptoAmount, currency);
        
        // Update confirmation details
        const confirmations = SUPPORTED_CURRENCIES[currency].confirmations;
        const networkDetails = currency === 'USDC' 
            ? 'Gas fees covered by service'
            : 'Network fees apply';
            
        $w('.confirmation-details').html = `
            <div class="confirmation-info">
                <h4>Transaction Details:</h4>
                <ul>
                    <li>Required confirmations: ${confirmations[NIMIPAY_CONFIG.testMode ? 'testnet' : 'mainnet']}</li>
                    <li>${networkDetails}</li>
                </ul>
            </div>
        `;
        
    } catch (error) {
        console.error('Error updating payment details:', error);
        showError('Unable to fetch exchange rates. Please try again.');
    }
}

/**
 * Process payment
 */
async function processPayment() {
    try {
        const currency = $w('#nimipay-currency').value;
        const amount = currentCart.total;
        
        // Create payment
        const payment = await createPayment({
            amount,
            currency,
            orderId: currentCart.id,
            successUrl: wixLocation.baseUrl + '/payment-success',
            cancelUrl: wixLocation.baseUrl + '/payment-cancel'
        });
        
        // Redirect to payment page
        wixWindow.openLightbox('NimiPayCheckout', payment);
        
    } catch (error) {
        console.error('Payment error:', error);
        showError('Payment failed. Please try again.');
    }
}

/**
 * Create payment via NimiPay API
 */
async function createPayment(data) {
    const apiUrl = NIMIPAY_CONFIG.testMode 
        ? NIMIPAY_CONFIG.apiUrl.test 
        : NIMIPAY_CONFIG.apiUrl.prod;
        
    const response = await fetch(`${apiUrl}/payments`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getApiKey()}`
        },
        body: JSON.stringify(data)
    });
    
    if (!response.ok) {
        throw new Error('Payment creation failed');
    }
    
    return response.json();
}

/**
 * Get exchange rate for currency
 */
async function getExchangeRate(currency) {
    const apiUrl = NIMIPAY_CONFIG.testMode 
        ? NIMIPAY_CONFIG.apiUrl.test 
        : NIMIPAY_CONFIG.apiUrl.prod;
        
    const response = await fetch(`${apiUrl}/exchange-rates?currency=${currency}`);
    
    if (!response.ok) {
        throw new Error('Failed to fetch exchange rate');
    }
    
    const data = await response.json();
    return data.rate;
}

/**
 * Format crypto amount with appropriate decimals
 */
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

/**
 * Show error message
 */
function showError(message) {
    $w('#errorMessage').text = message;
    $w('#errorMessage').show();
    
    setTimeout(() => {
        $w('#errorMessage').hide();
    }, 5000);
}

/**
 * Get API key based on mode
 */
function getApiKey() {
    return NIMIPAY_CONFIG.testMode
        ? $w('#nimipayTestApiKey').value
        : $w('#nimipayApiKey').value;
}

// Export for Wix Code
export { initPaymentForm };
