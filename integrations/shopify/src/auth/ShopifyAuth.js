const crypto = require('crypto');

/**
 * Shopify Authentication Handler
 * Manages OAuth flow and session validation for Shopify stores
 */
class ShopifyAuth {
    /**
     * Constructor
     * @param {Object} config Configuration object
     * @param {string} config.apiKey Shopify API key
     * @param {string} config.apiSecret Shopify API secret
     * @param {string} config.scope Required app scopes
     * @param {string} config.redirectUri OAuth redirect URI
     */
    constructor(config) {
        this.apiKey = config.apiKey;
        this.apiSecret = config.apiSecret;
        this.scope = config.scope || 'read_orders,write_orders,read_products';
        this.redirectUri = config.redirectUri;
    }

    /**
     * Generate OAuth URL for installation
     * @param {string} shop Shop domain
     * @param {string} state Random state for CSRF protection
     * @returns {string} OAuth URL
     */
    generateAuthUrl(shop, state) {
        const queryParams = new URLSearchParams({
            client_id: this.apiKey,
            scope: this.scope,
            redirect_uri: this.redirectUri,
            state: state,
            'grant_options[]': 'per-user'
        });

        return `https://${shop}/admin/oauth/authorize?${queryParams.toString()}`;
    }

    /**
     * Validate OAuth callback
     * @param {Object} query Query parameters from callback
     * @returns {boolean} Whether the callback is valid
     */
    validateCallback(query) {
        const { hmac, signature, ...params } = query;

        // Verify hmac
        const message = new URLSearchParams(params).toString();
        const calculatedHmac = crypto
            .createHmac('sha256', this.apiSecret)
            .update(message)
            .digest('hex');

        return crypto.timingSafeEqual(
            Buffer.from(hmac),
            Buffer.from(calculatedHmac)
        );
    }

    /**
     * Exchange authorization code for access token
     * @param {string} shop Shop domain
     * @param {string} code Authorization code
     * @returns {Promise<Object>} Access token response
     */
    async getAccessToken(shop, code) {
        const url = `https://${shop}/admin/oauth/access_token`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                client_id: this.apiKey,
                client_secret: this.apiSecret,
                code: code
            })
        });

        if (!response.ok) {
            throw new Error('Failed to get access token');
        }

        return response.json();
    }

    /**
     * Verify shop domain
     * @param {string} shop Shop domain to verify
     * @returns {boolean} Whether domain is valid
     */
    validateShopDomain(shop) {
        // Validate shop domain format
        const shopRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
        if (!shopRegex.test(shop)) {
            return false;
        }

        // Prevent domain hijacking
        const hostname = shop.toLowerCase();
        return !hostname.startsWith('.') && !hostname.includes('//');
    }

    /**
     * Verify webhook signature
     * @param {string} rawBody Raw request body
     * @param {string} hmac HMAC signature from header
     * @returns {boolean} Whether signature is valid
     */
    verifyWebhook(rawBody, hmac) {
        const calculatedHmac = crypto
            .createHmac('sha256', this.apiSecret)
            .update(rawBody, 'utf8')
            .digest('base64');

        return crypto.timingSafeEqual(
            Buffer.from(hmac),
            Buffer.from(calculatedHmac)
        );
    }

    /**
     * Generate session token
     * @param {string} shop Shop domain
     * @param {string} accessToken Access token
     * @returns {string} Encrypted session token
     */
    generateSessionToken(shop, accessToken) {
        const sessionData = JSON.stringify({
            shop,
            accessToken,
            timestamp: Date.now()
        });

        // Encrypt session data
        const cipher = crypto.createCipher('aes-256-cbc', this.apiSecret);
        let encrypted = cipher.update(sessionData, 'utf8', 'base64');
        encrypted += cipher.final('base64');

        return encrypted;
    }

    /**
     * Verify and decode session token
     * @param {string} token Encrypted session token
     * @returns {Object|null} Session data if valid
     */
    verifySessionToken(token) {
        try {
            // Decrypt session data
            const decipher = crypto.createDecipher('aes-256-cbc', this.apiSecret);
            let decrypted = decipher.update(token, 'base64', 'utf8');
            decrypted += decipher.final('utf8');

            const session = JSON.parse(decrypted);

            // Verify timestamp (24 hour expiry)
            if (Date.now() - session.timestamp > 24 * 60 * 60 * 1000) {
                return null;
            }

            return session;
        } catch (error) {
            return null;
        }
    }

    /**
     * Verify request origin
     * @param {Object} headers Request headers
     * @returns {boolean} Whether origin is valid
     */
    verifyOrigin(headers) {
        const shop = headers['x-shopify-shop-domain'];
        if (!shop || !this.validateShopDomain(shop)) {
            return false;
        }

        // Verify Shopify signature
        const signature = headers['x-shopify-hmac-sha256'];
        if (!signature) {
            return false;
        }

        return true;
    }
}

module.exports = ShopifyAuth;
