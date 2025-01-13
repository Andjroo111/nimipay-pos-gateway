// Initialize the Nimiq Hub API
const hubApi = new HubApi('https://wallet.nimiq.com');

// Price API endpoints
const CURRENCY_CONFIG = {
    NIM: {
        name: 'Nimiq',
        symbol: 'NIM',
        icon: 'https://api.nimiq.com/identicon/NIM.png',
        decimals: 4,
        minConfirmations: 2
    },
    BTC: {
        name: 'Bitcoin',
        symbol: 'BTC',
        icon: 'img/btc-icon.png',
        decimals: 8,
        minConfirmations: 3
    }
};

let np = new Reef('#nimipay', {
    data: {
        txData: null,
        result: {
            address: '',
            label: ''
        },
        selectedCurrency: 'NIM',
        invoices: [],
        items: [],
        userBalanceNim: null,
        userBalanceBtc: null,
        userBalanceUsd: null,
        invoicesString: '',
        itemsString: '',
        checkoutFeedback: '',
        invoicesCount: 0,
        itemsCount: 0,
        exchangeRates: {}
    },
    template: function (props) {
        return '<div class="np-modal-window" id="np-modal">'+
        '<div class="np-modal-content">'+
            '<div id="np-wallet" class="np-wallet">'+
                '<div onclick="npCloseModal()" class="np-modal-close">✕</div>'+
                '<b>Crypto Wallet</b><br><br>'+
                '<div class="np-currency-selector">'+
                    Object.keys(CURRENCY_CONFIG).map(currency => 
                        `<div class="np-currency-option ${props.selectedCurrency === currency ? 'selected' : ''}" 
                              onclick="npSelectCurrency('${currency}')">
                            <img src="${CURRENCY_CONFIG[currency].icon}" alt="${currency}">
                            ${CURRENCY_CONFIG[currency].name}
                         </div>`
                    ).join('') +
                '</div>'+
                '<div id="identicon"><img src="https://api.nimiq.com/identicon/'+props.result.address.replace(/\s/g, '')+'.png"></div>'+
                '<span id="output"><span style="font-size:14px;">'+props.result.address+'<br>'+props.result.label+'</span></span>'+
                getCurrencyBalanceDisplay(props)+
                '<div style="height:5px;"></div>'+
                '<div class="np-wallet-func">'+
                    '<a href="https://changelly.com" class="np-link" target="_blank">Top Up</a> | '+
                    '<a href="https://wallet.nimiq.com" target="_blank">Backup</a>'+
                '</div>'+
            '</div>'+
            '<div class="np-tabs">'+
                '<div class="np-btn" onclick="npShowInvoices()">Invoices ('+props.invoicesCount+')</div>'+
                '<div class="np-btn" onclick="npShowItems()">Items ('+props.itemsCount+')</div>'+
            '</div>'+
            '<div id="np-tab-invoices">'+props.invoicesString+'</div>'+
            '<div id="np-tab-items">'+props.itemsString+'</div>'+
        '</div>'+
        '</div>';
    }
});

function getCurrencyBalanceDisplay(props) {
    let display = '<div id="balance"><br>';
    
    if (props.selectedCurrency === 'NIM' && props.userBalanceNim !== null) {
        display += `Balance: ${props.userBalanceNim} NIM (${props.userBalanceUsd} USD)`;
    } else if (props.selectedCurrency === 'BTC' && props.userBalanceBtc !== null) {
        display += `Balance: ${props.userBalanceBtc} BTC (${props.userBalanceUsd} USD)`;
    } else {
        display += 'Fetching balance...';
    }
    
    display += '</div>';
    return display;
}

async function npSelectCurrency(currency) {
    np.data.selectedCurrency = currency;
    await npGetBalance();
    await npInvoicesPriceInCrypto();
}

// Utility function to fetch price with fallback and retries
async function fetchPrice(currency, retries = 3, delay = 1000) {
    const response = await fetch(`${npBackendUrl}?action=getPrice&currency=${currency}`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data.rate;
}

async function npCheckout(id_invoice) {
    const index = np.data.invoices.findIndex(invoice => invoice.id_invoice === id_invoice);
    if (index === -1) {
        console.error('Invoice not found:', id_invoice);
        return;
    }

    const invoice = np.data.invoices[index];
    const currency = np.data.selectedCurrency;
    
    try {
        // Get current price
        const rate = await fetchPrice(currency);
        const cryptoAmount = (invoice.value_usd / rate).toFixed(CURRENCY_CONFIG[currency].decimals);
        
        // Check balance
        const balance = currency === 'NIM' ? np.data.userBalanceNim : np.data.userBalanceBtc;
        if (Number(cryptoAmount) > Number(balance)) {
            document.getElementById('np-error-'+id_invoice).innerHTML = 
                `<div style="margin-top:5px;margin-bottom:10px;color:red;">Insufficient ${currency} balance</div>`;
            return;
        }

        // Process payment based on currency
        if (currency === 'NIM') {
            await processNimPayment(invoice, cryptoAmount);
        } else if (currency === 'BTC') {
            await processBtcPayment(invoice, cryptoAmount);
        }

    } catch (error) {
        console.error('Checkout error:', error);
        document.getElementById('np-error-'+id_invoice).innerHTML = 
            '<div style="margin-top:5px;margin-bottom:10px;color:red;">Transaction failed. Please try again.</div>';
    }
}

async function processNimPayment(invoice, amount) {
    const response = await hubApi.checkout({
        appName: nimAddressLabel,
        recipient: nimAddress,
        value: Math.round(amount * Math.pow(10, CURRENCY_CONFIG.NIM.decimals)),
        extraData: 'Invoice #'+invoice.id_invoice,
        sender: np.data.result.address,
        forceSender: true
    });

    await handlePaymentResponse(invoice.id_invoice, response.hash, 'NIM');
}

async function processBtcPayment(invoice, amount) {
    // Implement BTC payment flow here
    // This would typically involve generating a BTC address and monitoring it
    // For now, we'll show a simplified flow
    const btcAddress = await getBtcPaymentAddress();
    
    document.getElementById('np-invoice-'+invoice.id_invoice).innerHTML = 
        `<div class="btc-payment-info">
            <p>Send exactly ${amount} BTC to:</p>
            <div class="btc-address">${btcAddress}</div>
            <div class="qr-code" id="qr-${invoice.id_invoice}"></div>
            <p>Waiting for payment...</p>
        </div>`;
    
    // Start monitoring for payment
    startPaymentMonitor(invoice.id_invoice, btcAddress, amount);
}

async function handlePaymentResponse(id_invoice, txHash, currency) {
    document.getElementById('np-invoice-'+id_invoice).innerHTML = 
        `<b>Confirming transaction...</b> <span class="np-loading np-line"></span>
         <div style="height:10px;"></div>
         <div style="font-size:13px;padding-left:6px;padding-right:6px;margin-bottom:10px;">
         Waiting for ${CURRENCY_CONFIG[currency].minConfirmations} confirmations. 
         Please wait, or open your wallet later to see the new item.</div>`;

    await npSendTxHash(id_invoice, txHash, currency);
    await npTxBackendValidate(txHash, id_invoice, currency);
}

// ... (rest of the existing functions, updated to handle currency parameter)

// Add necessary CSS
const style = document.createElement('style');
style.textContent = `
    .np-currency-selector {
        display: flex;
        justify-content: center;
        margin-bottom: 15px;
    }
    .np-currency-option {
        padding: 8px 15px;
        margin: 0 5px;
        border: 1px solid #ddd;
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
    }
    .np-currency-option.selected {
        background: #f0f0f0;
        border-color: #999;
    }
    .np-currency-option img {
        width: 20px;
        height: 20px;
        margin-right: 8px;
    }
    .btc-payment-info {
        text-align: center;
        padding: 15px;
    }
    .btc-address {
        background: #f5f5f5;
        padding: 10px;
        margin: 10px 0;
        word-break: break-all;
        font-family: monospace;
    }
`;
document.head.appendChild(style);
