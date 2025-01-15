const { describe, it, beforeEach, afterEach } = require('mocha');
const { expect } = require('chai');
const sinon = require('sinon');
const { NimipayShopifyAPI } = require('../../src/NimipayShopifyAPI');
const { ShopifyAuth } = require('../../src/auth/ShopifyAuth');
const { ShopifyPaymentProcessor } = require('../../src/payment/ShopifyPaymentProcessor');

describe('Shopify Integration Tests', () => {
    let api;
    let auth;
    let processor;
    let sandbox;

    const mockConfig = {
        apiKey: 'test_api_key',
        shopifyAccessToken: 'test_access_token',
        shopifyApiKey: 'test_shopify_key',
        shopifyApiSecret: 'test_shopify_secret',
        redirectUri: 'https://app.example.com/auth/callback',
        testmode: true
    };

    const mockOrder = {
        id: 'gid://shopify/Order/123456789',
        total_price: '100.00',
        currency: 'USD',
        email: 'customer@example.com',
        customer: {
            first_name: 'John',
            last_name: 'Doe'
        }
    };

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        
        // Initialize components
        api = new NimipayShopifyAPI({
            apiKey: mockConfig.apiKey,
            shopifyAccessToken: mockConfig.shopifyAccessToken,
            testmode: mockConfig.testmode
        });

        auth = new ShopifyAuth({
            apiKey: mockConfig.shopifyApiKey,
            apiSecret: mockConfig.shopifyApiSecret,
            redirectUri: mockConfig.redirectUri
        });

        processor = new ShopifyPaymentProcessor({
            api,
            auth
        });

        // Mock fetch for API calls
        global.fetch = sandbox.stub();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('Authentication', () => {
        it('should generate valid OAuth URL', () => {
            const shop = 'test-store.myshopify.com';
            const state = 'random-state';
            const url = auth.generateAuthUrl(shop, state);

            expect(url).to.include(shop);
            expect(url).to.include(state);
            expect(url).to.include(mockConfig.shopifyApiKey);
            expect(url).to.include(encodeURIComponent(mockConfig.redirectUri));
        });

        it('should validate shop domain', () => {
            expect(auth.validateShopDomain('valid-store.myshopify.com')).to.be.true;
            expect(auth.validateShopDomain('invalid-domain.com')).to.be.false;
            expect(auth.validateShopDomain('.myshopify.com')).to.be.false;
            expect(auth.validateShopDomain('store//myshopify.com')).to.be.false;
        });

        it('should verify webhook signatures', () => {
            const payload = JSON.stringify({ test: 'data' });
            const signature = auth.generateSignature(payload);
            
            expect(auth.verifyWebhook(payload, signature)).to.be.true;
            expect(auth.verifyWebhook(payload, 'invalid-signature')).to.be.false;
        });
    });

    describe('Payment Processing', () => {
        it('should process payment successfully', async () => {
            // Mock successful API responses
            global.fetch.withArgs(`${api.apiUrl}/payments`).resolves({
                ok: true,
                json: () => Promise.resolve({
                    id: 'test_payment_id',
                    status: 'pending',
                    amount: 10000,
                    currency: 'USD'
                })
            });

            global.fetch.withArgs(`https://${api.getShopDomain()}/admin/api/2024-01/orders/${mockOrder.id}/transactions.json`).resolves({
                ok: true,
                json: () => Promise.resolve({
                    transaction: {
                        id: 'test_transaction_id',
                        status: 'success'
                    }
                })
            });

            const result = await processor.processPayment(mockOrder);
            
            expect(result).to.exist;
            expect(result.id).to.equal('test_payment_id');
            expect(result.status).to.equal('pending');
        });

        it('should handle payment failures', async () => {
            // Mock failed API response
            global.fetch.withArgs(`${api.apiUrl}/payments`).resolves({
                ok: false,
                json: () => Promise.resolve({
                    error: 'Payment failed',
                    code: 'PAYMENT_FAILED'
                })
            });

            try {
                await processor.processPayment(mockOrder);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).to.equal('API request failed');
            }
        });

        it('should validate order data', async () => {
            const invalidOrder = {
                id: 'test_order',
                // Missing required fields
            };

            try {
                await processor.processPayment(invalidOrder);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).to.equal('Invalid order data');
            }
        });
    });

    describe('State Management', () => {
        it('should handle offline mode', async () => {
            // Trigger offline mode
            await processor.handleOfflineMode();

            // Mock getting pending transactions
            const pendingTx = await processor.stateManager.getPendingTransactions();
            expect(pendingTx).to.be.an('array');
        });

        it('should handle online recovery', async () => {
            // Add some queued transactions
            await processor.stateManager.storeTransaction('test_tx', {
                status: 'queued',
                timestamp: Date.now()
            });

            // Trigger online recovery
            await processor.handleOnlineRecovery();

            // Verify transactions were processed
            const queuedTx = await processor.stateManager.getQueuedTransactions();
            expect(queuedTx).to.be.an('array');
            expect(queuedTx.length).to.equal(0);
        });
    });

    describe('Error Handling', () => {
        it('should handle network errors', async () => {
            // Mock network error
            global.fetch.withArgs(`${api.apiUrl}/payments`).rejects(
                new Error('Network error')
            );

            try {
                await processor.processPayment(mockOrder);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).to.equal('Network error');
            }
        });

        it('should handle invalid API responses', async () => {
            // Mock invalid JSON response
            global.fetch.withArgs(`${api.apiUrl}/payments`).resolves({
                ok: true,
                json: () => Promise.reject(new Error('Invalid JSON'))
            });

            try {
                await processor.processPayment(mockOrder);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).to.equal('Invalid JSON');
            }
        });
    });

    describe('Currency Handling', () => {
        it('should format amounts correctly', () => {
            const testCases = [
                { amount: '100.00', currency: 'USD', expected: 10000 },
                { amount: '0.12345678', currency: 'BTC', expected: 12345678 },
                { amount: '50.123456', currency: 'USDC', expected: 50123456 }
            ];

            for (const { amount, currency, expected } of testCases) {
                const formatted = api.formatAmount(amount, currency);
                expect(formatted).to.equal(expected);
            }
        });

        it('should validate amount ranges', () => {
            const testCases = [
                { amount: '100.00', currency: 'USD', expected: true },
                { amount: '0.000001', currency: 'BTC', expected: false },
                { amount: '1000001', currency: 'USDC', expected: false }
            ];

            for (const { amount, currency, expected } of testCases) {
                const formatted = api.formatAmount(amount, currency);
                const isValid = api.validateAmount(formatted, currency);
                expect(isValid).to.equal(expected);
            }
        });
    });
});
