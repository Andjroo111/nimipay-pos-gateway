/**
 * NimiPay Shopify Integration API Handler
 */
class NimipayShopifyAPI {
    /**
     * Constructor
     * @param {Object} config Configuration object
     * @param {string} config.apiKey NimiPay API key
     * @param {string} config.shopifyAccessToken Shopify access token
     * @param {boolean} config.testmode Whether to use testnet
     */
    constructor(config) {
        this.apiKey = config.apiKey;
        this.shopifyAccessToken = config.shopifyAccessToken;
        this.testmode = config.testmode || false;
        this.apiUrl = this.testmode
            ? 'https://testnet-api.nimipay.com/v1'
            : 'https://api.nimipay.com/v1';
        this.shopifyApiVersion = '2024-01';
    }

    /**
     * Initialize the payment gateway
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            await this.validateCredentials();
            await this.registerWebhooks();
        } catch (error) {
            throw new Error(`Failed to initialize NimiPay: ${error.message}`);
        }
    }

    /**
     * Create a new payment
     * @param {Object} data Payment data
     * @returns {Promise<Object>} Payment details
     */
    async createPayment(data) {
        return this.request('POST', '/payments', {
            ...data,
            platform: 'shopify',
            shop_domain: this.getShopDomain()
        });
    }

    /**
     * Get payment details
     * @param {string} paymentId Payment ID
     * @returns {Promise<Object>} Payment details
     */
    async getPayment(paymentId) {
        return this.request('GET', `/payments/${paymentId}`);
    }

    /**
     * Get supported currencies
     * @returns {Promise<Array>} List of supported currencies
     */
    async getSupportedCurrencies() {
        return this.request('GET', '/currencies');
    }

    /**
     * Get current exchange rates
     * @param {string} baseCurrency Base currency code
     * @returns {Promise<Object>} Exchange rates
     */
    async getExchangeRates(baseCurrency = 'USD') {
        return this.request('GET', '/exchange-rates', { base: baseCurrency });
    }

    /**
     * Make API request to NimiPay
     * @private
     */
    async request(method, endpoint, data = null) {
        const url = this.apiUrl + endpoint;
        
        const headers = {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'NimiPay-Shopify/1.0.0'
        };

        const config = {
            method,
            headers,
            credentials: 'include'
        };

        if (data) {
            config.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url, config);
            const responseData = await response.json();

            if (!response.ok) {
                throw new Error(responseData.message || 'API request failed');
            }

            return responseData;
        } catch (error) {
            this.logError('API Request Error', error);
            throw error;
        }
    }

    /**
     * Make API request to Shopify
     * @private
     */
    async shopifyRequest(method, endpoint, data = null) {
        const url = `https://${this.getShopDomain()}/admin/api/${this.shopifyApiVersion}${endpoint}`;
        
        const headers = {
            'X-Shopify-Access-Token': this.shopifyAccessToken,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        const config = {
            method,
            headers
        };

        if (data) {
            config.body = JSON.stringify(data);
        }

        const response = await fetch(url, config);
        const responseData = await response.json();

        if (!response.ok) {
            throw new Error(responseData.errors || 'Shopify API request failed');
        }

        return responseData;
    }

    /**
     * Register required webhooks
     * @private
     */
    async registerWebhooks() {
        const webhooks = [
            {
                topic: 'orders/paid',
                address: `${this.apiUrl}/webhooks/shopify/order-paid`,
                format: 'json'
            },
            {
                topic: 'orders/cancelled',
                address: `${this.apiUrl}/webhooks/shopify/order-cancelled`,
                format: 'json'
            }
        ];

        for (const webhook of webhooks) {
            try {
                await this.shopifyRequest('POST', '/webhooks.json', {
                    webhook: {
                        ...webhook,
                        api_version: this.shopifyApiVersion
                    }
                });
            } catch (error) {
                this.logError('Webhook Registration Error', error);
                throw error;
            }
        }
    }

    /**
     * Validate API credentials
     * @private
     */
    async validateCredentials() {
        try {
            await this.getSupportedCurrencies();
            await this.shopifyRequest('GET', '/shop.json');
        } catch (error) {
            throw new Error('Invalid API credentials');
        }
    }

    /**
     * Format amount based on currency
     * @param {number} amount Amount to format
     * @param {string} currency Currency code
     * @returns {number} Formatted amount
     */
    formatAmount(amount, currency) {
        const currencyDetails = this.getCurrencyDetails(currency);
        return Math.round(amount * Math.pow(10, currencyDetails.decimals));
    }

    /**
     * Get currency details
     * @param {string} currency Currency code
     * @returns {Object} Currency details
     */
    getCurrencyDetails(currency) {
        const currencies = {
            BTC: {
                name: 'Bitcoin',
                decimals: 8,
                minAmount: 0.00001,
                maxAmount: 100,
                confirmations: {
                    mainnet: 2,
                    testnet: 1
                }
            },
            USDC: {
                name: 'USD Coin',
                decimals: 6,
                minAmount: 1,
                maxAmount: 1000000,
                confirmations: {
                    mainnet: 12,
                    testnet: 5
                }
            },
            UST: {
                name: 'Terra USD',
                decimals: 6,
                minAmount: 1,
                maxAmount: 1000000,
                confirmations: {
                    mainnet: 15,
                    testnet: 5
                }
            }
        };

        return currencies[currency] || {
            name: currency,
            decimals: 2,
            minAmount: 0.01,
            maxAmount: 1000000,
            confirmations: {
                mainnet: 1,
                testnet: 1
            }
        };
    }

    /**
     * Get shop domain from current context
     * @private
     */
    getShopDomain() {
        if (typeof window !== 'undefined') {
            return window.Shopify?.shop || window.location.hostname;
        }
        return process.env.SHOPIFY_SHOP_DOMAIN;
    }

    /**
     * Log error to console and monitoring service
     * @private
     */
    logError(type, error) {
        console.error(`[NimiPay Shopify] ${type}:`, error);
        // TODO: Add error monitoring service integration
    }

    /**
     * Generate HMAC signature for payload verification
     * @param {string} payload Data to sign
     * @returns {string} HMAC signature
     */
    generateSignature(payload) {
        const crypto = require('crypto');
        return crypto
            .createHmac('sha256', this.apiKey)
            .update(payload)
            .digest('hex');
    }

    /**
     * Verify webhook signature
     * @param {string} payload Raw request body
     * @param {string} signature Shopify HMAC signature
     * @returns {boolean} Whether signature is valid
     */
    verifyWebhookSignature(payload, signature) {
        const crypto = require('crypto');
        const calculatedSignature = crypto
            .createHmac('sha256', this.apiKey)
            .update(payload, 'utf8')
            .digest('base64');
        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(calculatedSignature)
        );
    }
}

module.exports = NimipayShopifyAPI;
