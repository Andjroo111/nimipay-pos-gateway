/* global nimipayParams */
(function($) {
    'use strict';

    const NimipayCheckout = {
        init: function() {
            this.form = $('form.checkout');
            this.paymentBox = $('.wc-nimipay-payment-box');
            this.selectedMethod = null;
            this.paymentTimer = null;
            this.pollInterval = null;

            this.initializeEventListeners();
            this.initializePaymentMethods();
        },

        initializeEventListeners: function() {
            // Payment method selection
            $(document).on('click', '.wc-nimipay-payment-method', this.handlePaymentMethodSelect.bind(this));
            
            // Copy address button
            $(document).on('click', '.wc-nimipay-copy-button', this.handleCopyAddress.bind(this));
            
            // Form submission
            this.form.on('checkout_place_order_nimipay', this.handleFormSubmit.bind(this));
        },

        initializePaymentMethods: function() {
            const methods = [
                { id: 'nim', name: 'Nimiq (NIM)', icon: 'nim-icon.png' },
                { id: 'btc', name: 'Bitcoin (BTC)', icon: 'btc-icon.png' },
                { id: 'usdc', name: 'USD Coin (USDC)', icon: 'usdc-icon.png' }
            ];

            const methodsHtml = methods.map(method => `
                <div class="wc-nimipay-payment-method" data-method="${method.id}">
                    <img src="${nimipayParams.pluginUrl}/assets/images/${method.icon}" alt="${method.name}">
                    <span class="wc-nimipay-payment-method-label">${method.name}</span>
                </div>
            `).join('');

            this.paymentBox.html(methodsHtml);
        },

        handlePaymentMethodSelect: function(e) {
            const method = $(e.currentTarget).data('method');
            $('.wc-nimipay-payment-method').removeClass('selected');
            $(e.currentTarget).addClass('selected');
            this.selectedMethod = method;

            // Update hidden input for form submission
            $('#nimipay_selected_method').val(method);
        },

        handleCopyAddress: function(e) {
            e.preventDefault();
            const address = $('.wc-nimipay-address').text();
            
            // Use modern clipboard API
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(address).then(() => {
                    this.showMessage('Address copied to clipboard!', 'success');
                }).catch(() => {
                    this.showMessage('Failed to copy address', 'error');
                });
            } else {
                // Fallback for older browsers
                const textarea = document.createElement('textarea');
                textarea.value = address;
                textarea.style.position = 'fixed';
                document.body.appendChild(textarea);
                textarea.focus();
                textarea.select();
                try {
                    document.execCommand('copy');
                    this.showMessage('Address copied to clipboard!', 'success');
                } catch (err) {
                    this.showMessage('Failed to copy address', 'error');
                }
                document.body.removeChild(textarea);
            }
        },

        handleFormSubmit: function() {
            if (!this.selectedMethod) {
                this.showMessage('Please select a payment method', 'error');
                return false;
            }

            // Show loading state
            this.showLoading();

            // Create payment and get payment details
            return $.ajax({
                url: nimipayParams.ajaxUrl,
                method: 'POST',
                data: {
                    action: 'nimipay_create_payment',
                    nonce: nimipayParams.nonce,
                    method: this.selectedMethod,
                    order_id: $('input[name="order_id"]').val()
                }
            })
            .done(response => {
                if (response.success) {
                    this.showPaymentDetails(response.data);
                    this.startPaymentPolling(response.data.payment_id);
                    return true;
                } else {
                    this.showMessage(response.data.message, 'error');
                    return false;
                }
            })
            .fail(() => {
                this.showMessage('Payment initialization failed', 'error');
                return false;
            })
            .always(() => {
                this.hideLoading();
            });
        },

        showPaymentDetails: function(data) {
            const detailsHtml = `
                <div class="wc-nimipay-payment-details">
                    <div class="wc-nimipay-qr-code">
                        <img src="${data.qr_code_url}" alt="Payment QR Code">
                    </div>
                    <div class="wc-nimipay-address">
                        ${data.payment_address}
                    </div>
                    <button class="wc-nimipay-copy-button">
                        Copy Address
                    </button>
                    <div class="wc-nimipay-timer">
                        Time remaining: <span class="countdown">15:00</span>
                    </div>
                    <div class="wc-nimipay-instructions">
                        ${data.instructions}
                    </div>
                    <div class="wc-nimipay-status pending">
                        Waiting for payment...
                    </div>
                </div>
            `;

            this.paymentBox.html(detailsHtml);
            this.startPaymentTimer();
        },

        startPaymentTimer: function() {
            let timeLeft = 15 * 60; // 15 minutes
            this.paymentTimer = setInterval(() => {
                timeLeft--;
                if (timeLeft <= 0) {
                    clearInterval(this.paymentTimer);
                    this.handlePaymentTimeout();
                } else {
                    const minutes = Math.floor(timeLeft / 60);
                    const seconds = timeLeft % 60;
                    $('.countdown').text(
                        `${minutes}:${seconds.toString().padStart(2, '0')}`
                    );
                }
            }, 1000);
        },

        startPaymentPolling: function(paymentId) {
            this.pollInterval = setInterval(() => {
                $.ajax({
                    url: nimipayParams.ajaxUrl,
                    method: 'POST',
                    data: {
                        action: 'nimipay_check_payment',
                        nonce: nimipayParams.nonce,
                        payment_id: paymentId
                    }
                })
                .done(response => {
                    if (response.success) {
                        this.updatePaymentStatus(response.data.status);
                        if (['completed', 'failed'].includes(response.data.status)) {
                            this.stopPolling();
                            if (response.data.status === 'completed') {
                                window.location.href = response.data.redirect_url;
                            }
                        }
                    }
                });
            }, 5000); // Poll every 5 seconds
        },

        stopPolling: function() {
            if (this.pollInterval) {
                clearInterval(this.pollInterval);
            }
            if (this.paymentTimer) {
                clearInterval(this.paymentTimer);
            }
        },

        handlePaymentTimeout: function() {
            this.stopPolling();
            $('.wc-nimipay-status')
                .removeClass('pending processing')
                .addClass('failed')
                .text('Payment time expired. Please try again.');
        },

        updatePaymentStatus: function(status) {
            const statusElement = $('.wc-nimipay-status');
            statusElement.removeClass('pending processing completed failed');
            
            switch (status) {
                case 'processing':
                    statusElement
                        .addClass('processing')
                        .text('Payment detected! Processing...');
                    break;
                case 'completed':
                    statusElement
                        .addClass('completed')
                        .text('Payment completed successfully!');
                    break;
                case 'failed':
                    statusElement
                        .addClass('failed')
                        .text('Payment failed. Please try again.');
                    break;
                default:
                    statusElement
                        .addClass('pending')
                        .text('Waiting for payment...');
            }
        },

        showLoading: function() {
            this.paymentBox.append(
                '<div class="wc-nimipay-loading"></div>'
            );
        },

        hideLoading: function() {
            $('.wc-nimipay-loading').remove();
        },

        showMessage: function(message, type) {
            // Remove existing messages
            $('.wc-nimipay-message').remove();
            
            const messageHtml = `
                <div class="wc-nimipay-message ${type}">
                    ${message}
                </div>
            `;
            
            this.paymentBox.prepend(messageHtml);
            
            // Auto-remove success messages after 3 seconds
            if (type === 'success') {
                setTimeout(() => {
                    $('.wc-nimipay-message.success').fadeOut();
                }, 3000);
            }
        }
    };

    // Initialize on document ready
    $(document).ready(function() {
        if ($('form.checkout').length) {
            NimipayCheckout.init();
        }
    });

})(jQuery);
