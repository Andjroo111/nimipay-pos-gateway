const { PaymentFlowService } = require('../../../src/services/PaymentFlowService');
const { StateManager } = require('../../../src/services/StateManager');

/**
 * Shopify Payment Processor
 * Handles payment processing and order management for Shopify stores
 */
class ShopifyPaymentProcessor {
    /**
     * Constructor
     * @param {Object} config Configuration object
     * @param {NimipayShopifyAPI} config.api NimiPay Shopify API instance
     * @param {ShopifyAuth} config.auth Shopify Auth instance
     */
    constructor(config) {
        this.api = config.api;
        this.auth = config.auth;
        this.paymentFlow = new PaymentFlowService();
        this.stateManager = new StateManager();
    }

    /**
     * Initialize payment processor
     * @returns {Promise<void>}
     */
    async initialize() {
        await this.paymentFlow.initialize();
        await this.setupEventListeners();
    }

    /**
     * Process payment for Shopify order
     * @param {Object} order Shopify order details
     * @returns {Promise<Object>} Payment result
     */
    async processPayment(order) {
        try {
            // Validate order
            if (!this.validateOrder(order)) {
                throw new Error('Invalid order data');
            }

            // Create payment in NimiPay
            const payment = await this.api.createPayment({
                amount: this.formatAmount(order.total_price),
                currency: order.currency,
                order_id: order.id,
                customer: {
                    email: order.email,
                    name: `${order.customer.first_name} ${order.customer.last_name}`.trim()
                },
                metadata: {
                    shopify_order_id: order.id,
                    shopify_shop_domain: this.api.getShopDomain()
                }
            });

            // Store payment state
            await this.stateManager.storeTransaction(payment.id, {
                type: 'shopify_order',
                order_id: order.id,
                status: payment.status,
                timestamp: Date.now()
            });

            // Process payment through PaymentFlow
            const result = await this.paymentFlow.processPayment({
                id: payment.id,
                amount: payment.amount,
                currency: payment.currency
            });

            return result;
        } catch (error) {
            this.handleError('Payment Processing Error', error);
            throw error;
        }
    }

    /**
     * Setup payment event listeners
     * @private
     */
    async setupEventListeners() {
        window.addEventListener('nimipay:payment', async (event) => {
            const { type, data } = event.detail;

            switch (type) {
                case 'payment:success':
                    await this.handlePaymentSuccess(data);
                    break;
                case 'payment:failure':
                    await this.handlePaymentFailure(data);
                    break;
                case 'payment:pending':
                    await this.handlePaymentPending(data);
                    break;
            }
        });

        // Handle offline mode
        window.addEventListener('offline', () => {
            this.handleOfflineMode();
        });

        window.addEventListener('online', async () => {
            await this.handleOnlineRecovery();
        });
    }

    /**
     * Handle successful payment
     * @private
     */
    async handlePaymentSuccess(data) {
        try {
            // Get stored transaction data
            const txData = await this.stateManager.getTransaction(data.paymentId);
            if (!txData || txData.type !== 'shopify_order') {
                throw new Error('Invalid transaction data');
            }

            // Update Shopify order
            await this.api.shopifyRequest('POST', `/orders/${txData.order_id}/transactions.json`, {
                transaction: {
                    kind: 'capture',
                    status: 'success',
                    amount: data.amount,
                    currency: data.currency,
                    gateway: 'nimipay',
                    payment_details: {
                        credit_card_number: null,
                        credit_card_company: null
                    }
                }
            });

            // Update transaction state
            await this.stateManager.updateTransaction(data.paymentId, {
                status: 'completed',
                completed_at: Date.now()
            });

            // Trigger success callback
            this.triggerCallback('success', {
                orderId: txData.order_id,
                paymentId: data.paymentId,
                amount: data.amount,
                currency: data.currency
            });
        } catch (error) {
            this.handleError('Payment Success Handler Error', error);
            throw error;
        }
    }

    /**
     * Handle failed payment
     * @private
     */
    async handlePaymentFailure(data) {
        try {
            const txData = await this.stateManager.getTransaction(data.paymentId);
            if (!txData || txData.type !== 'shopify_order') {
                throw new Error('Invalid transaction data');
            }

            // Update Shopify order
            await this.api.shopifyRequest('POST', `/orders/${txData.order_id}/transactions.json`, {
                transaction: {
                    kind: 'void',
                    status: 'failure',
                    amount: data.amount,
                    currency: data.currency,
                    gateway: 'nimipay',
                    error_code: data.error?.code,
                    message: data.error?.message
                }
            });

            // Update transaction state
            await this.stateManager.updateTransaction(data.paymentId, {
                status: 'failed',
                error: data.error,
                failed_at: Date.now()
            });

            // Trigger failure callback
            this.triggerCallback('failure', {
                orderId: txData.order_id,
                paymentId: data.paymentId,
                error: data.error
            });
        } catch (error) {
            this.handleError('Payment Failure Handler Error', error);
            throw error;
        }
    }

    /**
     * Handle pending payment
     * @private
     */
    async handlePaymentPending(data) {
        try {
            const txData = await this.stateManager.getTransaction(data.paymentId);
            if (!txData || txData.type !== 'shopify_order') {
                throw new Error('Invalid transaction data');
            }

            // Update transaction state
            await this.stateManager.updateTransaction(data.paymentId, {
                status: 'pending',
                updated_at: Date.now()
            });

            // Trigger pending callback
            this.triggerCallback('pending', {
                orderId: txData.order_id,
                paymentId: data.paymentId
            });
        } catch (error) {
            this.handleError('Payment Pending Handler Error', error);
            throw error;
        }
    }

    /**
     * Handle offline mode
     * @private
     */
    async handleOfflineMode() {
        const pendingTransactions = await this.stateManager.getPendingTransactions();
        for (const tx of pendingTransactions) {
            await this.stateManager.updateTransaction(tx.id, {
                status: 'queued',
                queued_at: Date.now()
            });
        }
    }

    /**
     * Handle online recovery
     * @private
     */
    async handleOnlineRecovery() {
        const queuedTransactions = await this.stateManager.getQueuedTransactions();
        for (const tx of queuedTransactions) {
            try {
                // Retry payment processing
                await this.paymentFlow.retryPayment(tx.id);
            } catch (error) {
                this.handleError('Payment Retry Error', error);
            }
        }
    }

    /**
     * Validate order data
     * @private
     */
    validateOrder(order) {
        return (
            order &&
            order.id &&
            order.total_price &&
            order.currency &&
            order.email &&
            order.customer &&
            typeof order.customer === 'object'
        );
    }

    /**
     * Format amount based on currency
     * @private
     */
    formatAmount(amount) {
        return this.api.formatAmount(parseFloat(amount));
    }

    /**
     * Trigger callback event
     * @private
     */
    triggerCallback(type, data) {
        const event = new CustomEvent('nimipay:callback', {
            detail: { type, data }
        });
        window.dispatchEvent(event);
    }

    /**
     * Handle and log errors
     * @private
     */
    handleError(type, error) {
        console.error(`[NimiPay Shopify] ${type}:`, error);
        // TODO: Add error monitoring service integration
    }
}

module.exports = ShopifyPaymentProcessor;
