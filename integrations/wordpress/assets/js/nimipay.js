/* global nimipayParams */

(function($) {
    'use strict';

    const NimiPay = {
        init: function() {
            this.form = $('form.checkout, form#order_review');
            this.paymentMethod = $('#payment_method_nimipay');
            this.currencySelect = $('#nimipay_currency');
            this.exchangeRates = {};
            
            this.initEvents();
            this.initExchangeRates();
        },
        
        initEvents: function() {
            // Currency selection
            this.currencySelect.on('change', this.onCurrencyChange.bind(this));
            
            // Form submission
            this.form.on('checkout_place_order_nimipay', this.onSubmit.bind(this));
            
            // Payment method selection
            $('body').on('payment_method_selected', this.onPaymentMethodSelect.bind(this));
        },
        
        initExchangeRates: function() {
            $.ajax({
                url: nimipayParams.ajaxUrl,
                data: {
                    action: 'nimipay_get_rates',
                    nonce: nimipayParams.nonce
                },
                method: 'POST',
                success: (response) => {
                    if (response.success) {
                        this.exchangeRates = response.data;
                        this.updateAmounts();
                    }
                }
            });
        },
        
        onCurrencyChange: function(e) {
            const currency = $(e.target).val();
            this.updateAmounts(currency);
        },
        
        updateAmounts: function(currency) {
            if (!currency) {
                currency = this.currencySelect.val();
            }
            
            if (!currency || !this.exchangeRates[currency]) {
                return;
            }
            
            const rate = this.exchangeRates[currency];
            const fiatAmount = parseFloat($('.order-total .amount').first().text().replace(/[^0-9.]/g, ''));
            const cryptoAmount = this.formatAmount(fiatAmount * rate, currency);
            
            $('.nimipay-crypto-amount').text(cryptoAmount + ' ' + currency);
        },
        
        formatAmount: function(amount, currency) {
            switch (currency) {
                case 'BTC':
                    return amount.toFixed(8);
                case 'USDC':
                case 'UST':
                    return amount.toFixed(6);
                default:
                    return amount.toFixed(2);
            }
        },
        
        onSubmit: function() {
            if (!this.validateForm()) {
                return false;
            }
            
            // Add currency to form data
            const currency = this.currencySelect.val();
            $('<input>').attr({
                type: 'hidden',
                name: 'nimipay_currency',
                value: currency
            }).appendTo(this.form);
            
            return true;
        },
        
        validateForm: function() {
            const currency = this.currencySelect.val();
            
            if (!currency) {
                this.showError('Please select a cryptocurrency');
                return false;
            }
            
            return true;
        },
        
        onPaymentMethodSelect: function(e, paymentMethod) {
            if (paymentMethod === 'nimipay') {
                this.initExchangeRates();
            }
        },
        
        showError: function(message) {
            $('.woocommerce-error, .woocommerce-message').remove();
            this.form.prepend(
                $('<div class="woocommerce-error">' + message + '</div>')
            );
            $('html, body').animate({
                scrollTop: this.form.offset().top - 100
            }, 1000);
        }
    };
    
    // Initialize on document ready
    $(document).ready(function() {
        NimiPay.init();
    });
    
    // Payment form template
    const paymentFormTemplate = `
        <div class="nimipay-payment-form">
            <div class="currency-selection">
                <label for="nimipay_currency">Select Cryptocurrency</label>
                <select name="nimipay_currency" id="nimipay_currency" required>
                    <option value="">Choose a cryptocurrency...</option>
                    <option value="BTC">Bitcoin (BTC)</option>
                    <option value="USDC">USD Coin (USDC)</option>
                    <option value="UST">Terra USD (UST)</option>
                </select>
            </div>
            
            <div class="payment-details">
                <div class="amount-display">
                    <span class="fiat-amount"></span>
                    <span class="equals">=</span>
                    <span class="nimipay-crypto-amount"></span>
                </div>
                
                <div class="payment-info">
                    <div class="confirmation-info">
                        <h4>Confirmation Requirements:</h4>
                        <ul>
                            <li class="btc-info" style="display: none;">
                                Bitcoin: 2 confirmations (~20 minutes)
                            </li>
                            <li class="usdc-info" style="display: none;">
                                USDC: 12 confirmations (~3 minutes)
                            </li>
                            <li class="ust-info" style="display: none;">
                                UST: 15 confirmations (~1 minute)
                            </li>
                        </ul>
                    </div>
                    
                    <div class="fee-info">
                        <h4>Network Fees:</h4>
                        <ul>
                            <li class="btc-info" style="display: none;">
                                Bitcoin: Network fee applies
                            </li>
                            <li class="usdc-info" style="display: none;">
                                USDC: Gas fees covered
                            </li>
                            <li class="ust-info" style="display: none;">
                                UST: Network fee applies
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add payment form to checkout
    $(document.body).on('updated_checkout payment_method_selected', function() {
        const paymentMethod = $('#payment_method_nimipay');
        if (paymentMethod.length && !$('.nimipay-payment-form').length) {
            paymentMethod.closest('.payment_method_nimipay')
                .find('.payment_box')
                .html(paymentFormTemplate);
        }
    });
    
    // Update displayed information based on currency selection
    $(document.body).on('change', '#nimipay_currency', function() {
        const currency = $(this).val();
        $('.confirmation-info li, .fee-info li').hide();
        if (currency) {
            $('.' + currency.toLowerCase() + '-info').show();
        }
    });
    
})(jQuery);
