import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * NimiPay Payment Button Component
 * Renders a payment button that integrates with Shopify's checkout
 */
const PaymentButton = ({ 
    order,
    onSuccess,
    onFailure,
    onPending,
    className,
    buttonText = 'Pay with Crypto',
    testMode = false
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [processor, setProcessor] = useState(null);

    useEffect(() => {
        // Initialize payment processor
        const initProcessor = async () => {
            try {
                const { ShopifyPaymentProcessor } = await import('../payment/ShopifyPaymentProcessor');
                const { NimipayShopifyAPI } = await import('../NimipayShopifyAPI');
                const { ShopifyAuth } = await import('../auth/ShopifyAuth');

                // Get configuration from window
                const config = window.NimiPayConfig || {};
                
                const api = new NimipayShopifyAPI({
                    apiKey: config.apiKey,
                    shopifyAccessToken: config.shopifyAccessToken,
                    testmode: testMode
                });

                const auth = new ShopifyAuth({
                    apiKey: config.shopifyApiKey,
                    apiSecret: config.shopifyApiSecret,
                    redirectUri: config.redirectUri
                });

                const paymentProcessor = new ShopifyPaymentProcessor({
                    api,
                    auth
                });

                await paymentProcessor.initialize();
                setProcessor(paymentProcessor);
            } catch (error) {
                console.error('Failed to initialize payment processor:', error);
                setError('Failed to initialize payment system');
            }
        };

        initProcessor();

        // Setup callback listeners
        const handleCallback = (event) => {
            const { type, data } = event.detail;
            switch (type) {
                case 'success':
                    onSuccess?.(data);
                    break;
                case 'failure':
                    onFailure?.(data);
                    break;
                case 'pending':
                    onPending?.(data);
                    break;
            }
        };

        window.addEventListener('nimipay:callback', handleCallback);

        return () => {
            window.removeEventListener('nimipay:callback', handleCallback);
        };
    }, [testMode, onSuccess, onFailure, onPending]);

    const handleClick = async () => {
        if (!processor || isLoading) return;

        setIsLoading(true);
        setError(null);

        try {
            await processor.processPayment(order);
        } catch (error) {
            console.error('Payment processing error:', error);
            setError('Failed to process payment. Please try again.');
            onFailure?.({
                error: {
                    code: 'PROCESSING_ERROR',
                    message: error.message
                }
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="nimipay-button-container">
            <button
                className={`nimipay-button ${className || ''} ${isLoading ? 'loading' : ''}`}
                onClick={handleClick}
                disabled={isLoading || !processor}
            >
                {isLoading ? (
                    <span className="nimipay-button-spinner" />
                ) : (
                    <span className="nimipay-button-text">{buttonText}</span>
                )}
            </button>
            {error && (
                <div className="nimipay-error-message">
                    {error}
                </div>
            )}
            <style jsx>{`
                .nimipay-button-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                }

                .nimipay-button {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 12px 24px;
                    border: none;
                    border-radius: 4px;
                    background-color: #1a73e8;
                    color: white;
                    font-size: 16px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background-color 0.2s ease;
                }

                .nimipay-button:hover:not(:disabled) {
                    background-color: #1557b0;
                }

                .nimipay-button:disabled {
                    background-color: #ccc;
                    cursor: not-allowed;
                }

                .nimipay-button.loading {
                    background-color: #ccc;
                    cursor: wait;
                }

                .nimipay-button-spinner {
                    width: 20px;
                    height: 20px;
                    border: 2px solid #ffffff;
                    border-top-color: transparent;
                    border-radius: 50%;
                    animation: nimipay-spinner 0.8s linear infinite;
                }

                .nimipay-error-message {
                    color: #d93025;
                    font-size: 14px;
                    text-align: center;
                }

                @keyframes nimipay-spinner {
                    to {
                        transform: rotate(360deg);
                    }
                }
            `}</style>
        </div>
    );
};

PaymentButton.propTypes = {
    order: PropTypes.shape({
        id: PropTypes.string.isRequired,
        total_price: PropTypes.string.isRequired,
        currency: PropTypes.string.isRequired,
        email: PropTypes.string.isRequired,
        customer: PropTypes.shape({
            first_name: PropTypes.string,
            last_name: PropTypes.string
        }).isRequired
    }).isRequired,
    onSuccess: PropTypes.func,
    onFailure: PropTypes.func,
    onPending: PropTypes.func,
    className: PropTypes.string,
    buttonText: PropTypes.string,
    testMode: PropTypes.bool
};

export default PaymentButton;
