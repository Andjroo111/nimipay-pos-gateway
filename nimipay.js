// Initialize the Nimiq Hub API
const hubApi = new HubApi('https://wallet.nimiq.com');

// Currency configurations
const CURRENCY_CONFIG = {
    NIM: {
        name: 'Nimiq',
        symbol: 'NIM',
        icon: 'https://api.nimiq.com/identicon/NIM.png',
        decimals: 4,
        minConfirmations: 2,
        type: 'native'
    },
    BTC: {
        name: 'Bitcoin',
        symbol: 'BTC',
        icon: 'img/btc-icon.png',
        decimals: 8,
        minConfirmations: 3,
        type: 'native'
    },
    USDC: {
        name: 'USD Coin',
        symbol: 'USDC',
        icon: 'img/usdc-icon.png',
        decimals: 6,
        minConfirmations: 12,
        type: 'erc20',
        network: 'ethereum'
    },
    UST: {
        name: 'TerraUSD',
        symbol: 'UST',
        icon: 'img/ust-icon.png',
        decimals: 6,
        minConfirmations: 15,
        type: 'terra',
        network: 'terra'
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
        balances: {},
        invoicesString: '',
        itemsString: '',
        checkoutFeedback: '',
        invoicesCount: 0,
        itemsCount: 0,
        exchangeRates: {},
        gasFee: null
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
                getCurrencyDisplay(props)+
                '<div style="height:5px;"></div>'+
                '<div class="np-wallet-func">'+
                    getWalletFunctions(props)+
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

function getCurrencyDisplay(props) {
    const currency = CURRENCY_CONFIG[props.selectedCurrency];
    const balance = props.balances[props.selectedCurrency];
    
    let display = '<div class="np-currency-info">';
    
    // Show address and identicon for native chains
    if (currency.type === 'native') {
        display += `<div id="identicon">
            <img src="${getIdenticon(props.result.address, props.selectedCurrency)}">
        </div>
        <span id="output">
            <span style="font-size:14px;">${props.result.address}<br>${props.result.label}</span>
        </span>`;
    }
    
    // Show balance
    display += '<div id="balance"><br>';
    if (balance !== undefined) {
        const usdValue = balance * (props.exchangeRates[props.selectedCurrency] || 0);
        display += `Balance: ${formatAmount(balance, currency.decimals)} ${currency.symbol} ($${usdValue.toFixed(2)})`;
        
        // Show gas fee estimate for ERC20 tokens
        if (currency.type === 'erc20' && props.gasFee !== null) {
            display += `<br>Estimated Gas Fee: ${props.gasFee} ETH`;
        }
    } else {
        display += 'Fetching balance...';
    }
    display += '</div></div>';
    
    return display;
}

function getWalletFunctions(props) {
    const currency = CURRENCY_CONFIG[props.selectedCurrency];
    let functions = [];
    
    // Add relevant wallet functions based on currency type
    switch (currency.type) {
        case 'native':
            functions.push('<a href="https://changelly.com" class="np-link" target="_blank">Top Up</a>');
            if (props.selectedCurrency === 'NIM') {
                functions.push('<a href="https://wallet.nimiq.com" target="_blank">Backup</a>');
            }
            break;
        case 'erc20':
            functions.push('<a href="https://app.uniswap.org" class="np-link" target="_blank">Swap</a>');
            functions.push('<a href="https://etherscan.io" target="_blank">Explorer</a>');
            break;
        case 'terra':
            functions.push('<a href="https://station.terra.money" class="np-link" target="_blank">Station</a>');
            functions.push('<a href="https://finder.terra.money" target="_blank">Explorer</a>');
            break;
    }
    
    return functions.join(' | ');
}

function getIdenticon(address, currency) {
    switch (currency) {
        case 'NIM':
            return `https://api.nimiq.com/identicon/${address}.png`;
        case 'BTC':
            return `img/btc-identicon.png`; // Placeholder
        default:
            return CURRENCY_CONFIG[currency].icon;
    }
}

async function npSelectCurrency(currency) {
    np.data.selectedCurrency = currency;
    np.data.gasFee = null;
    
    // Clear existing balance
    delete np.data.balances[currency];
    
    // Get new balance and exchange rate
    await Promise.all([
        npGetBalance(currency),
        npGetExchangeRate(currency)
    ]);
    
    // Get gas fee estimate for ERC20 tokens
    if (CURRENCY_CONFIG[currency].type === 'erc20') {
        try {
            const response = await fetch(`${npBackendUrl}?action=estimateGasFee&currency=${currency}`);
            const data = await response.json();
            np.data.gasFee = data.fee;
        } catch (error) {
            console.error('Failed to estimate gas fee:', error);
        }
    }
    
    await npInvoicesPriceInCrypto();
}

async function npGetBalance(currency) {
    try {
        const config = CURRENCY_CONFIG[currency];
        let balance;
        
        switch (config.type) {
            case 'native':
                if (currency === 'NIM') {
                    const response = await fetch(`https://rpc.nimiq.com/account/${np.data.result.address}`);
                    const data = await response.json();
                    balance = data.balance / Math.pow(10, config.decimals);
                } else if (currency === 'BTC') {
                    // Implement BTC balance check
                }
                break;
                
            case 'erc20':
                // Get USDC balance through Web3
                break;
                
            case 'terra':
                // Get UST balance through Terra API
                break;
        }
        
        if (balance !== undefined) {
            np.data.balances[currency] = balance;
        }
    } catch (error) {
        console.error(`Failed to fetch ${currency} balance:`, error);
    }
}

async function npGetExchangeRate(currency) {
    try {
        const response = await fetch(`${npBackendUrl}?action=getPrice&currency=${currency}`);
        const data = await response.json();
        np.data.exchangeRates[currency] = data.rate;
    } catch (error) {
        console.error(`Failed to fetch ${currency} exchange rate:`, error);
    }
}

async function npCheckout(id_invoice) {
    const index = np.data.invoices.findIndex(invoice => invoice.id_invoice === id_invoice);
    if (index === -1) {
        console.error('Invoice not found:', id_invoice);
        return;
    }

    const invoice = np.data.invoices[index];
    const currency = np.data.selectedCurrency;
    const config = CURRENCY_CONFIG[currency];
    
    try {
        // Get current price and convert amount
        const rate = np.data.exchangeRates[currency];
        if (!rate) {
            throw new Error('Exchange rate not available');
        }
        
        const cryptoAmount = (invoice.value_usd / rate).toFixed(config.decimals);
        
        // Check balance
        const balance = np.data.balances[currency];
        if (Number(cryptoAmount) > Number(balance)) {
            document.getElementById('np-error-'+id_invoice).innerHTML = 
                `<div style="margin-top:5px;margin-bottom:10px;color:red;">Insufficient ${currency} balance</div>`;
            return;
        }

        // Process payment based on currency type
        switch (config.type) {
            case 'native':
                if (currency === 'NIM') {
                    await processNimPayment(invoice, cryptoAmount);
                } else if (currency === 'BTC') {
                    await processBtcPayment(invoice, cryptoAmount);
                }
                break;
                
            case 'erc20':
                await processUSDCPayment(invoice, cryptoAmount);
                break;
                
            case 'terra':
                await processUSTPayment(invoice, cryptoAmount);
                break;
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
    // Implement BTC payment flow
    const btcAddress = await getBtcPaymentAddress();
    showBtcPaymentInfo(invoice.id_invoice, btcAddress, amount);
}

async function processUSDCPayment(invoice, amount) {
    // Show gas fee warning
    if (!confirm(`This transaction requires ETH for gas (estimated: ${np.data.gasFee} ETH). Continue?`)) {
        return;
    }
    
    // Implement USDC payment through Web3
    showERC20PaymentInfo(invoice.id_invoice, amount);
}

async function processUSTPayment(invoice, amount) {
    // Implement UST payment through Terra Station
    showTerraPaymentInfo(invoice.id_invoice, amount);
}

function showBtcPaymentInfo(invoiceId, address, amount) {
    document.getElementById('np-invoice-'+invoiceId).innerHTML = 
        `<div class="btc-payment-info">
            <p>Send exactly ${amount} BTC to:</p>
            <div class="btc-address">${address}</div>
            <div class="qr-code" id="qr-${invoiceId}"></div>
            <p>Waiting for payment...</p>
        </div>`;
    
    // Generate QR code
    generateQRCode('qr-'+invoiceId, `bitcoin:${address}?amount=${amount}`);
}

function showERC20PaymentInfo(invoiceId, amount) {
    document.getElementById('np-invoice-'+invoiceId).innerHTML = 
        `<div class="erc20-payment-info">
            <p>Confirm the transaction in your Ethereum wallet</p>
            <p>Amount: ${amount} USDC</p>
            <p>Estimated Gas: ${np.data.gasFee} ETH</p>
            <span class="np-loading np-line"></span>
        </div>`;
}

function showTerraPaymentInfo(invoiceId, amount) {
    document.getElementById('np-invoice-'+invoiceId).innerHTML = 
        `<div class="terra-payment-info">
            <p>Confirm the transaction in Terra Station</p>
            <p>Amount: ${amount} UST</p>
            <span class="np-loading np-line"></span>
        </div>`;
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

function formatAmount(amount, decimals) {
    return Number(amount).toFixed(decimals);
}

// Add necessary CSS
const style = document.createElement('style');
style.textContent = `
    .np-currency-selector {
        display: flex;
        justify-content: center;
        margin-bottom: 15px;
        flex-wrap: wrap;
    }
    .np-currency-option {
        padding: 8px 15px;
        margin: 5px;
        border: 1px solid #ddd;
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
        transition: all 0.2s ease;
    }
    .np-currency-option.selected {
        background: #f0f0f0;
        border-color: #999;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .np-currency-option img {
        width: 24px;
        height: 24px;
        margin-right: 8px;
        border-radius: 12px;
    }
    .np-currency-info {
        text-align: center;
        padding: 10px;
    }
    .btc-payment-info,
    .erc20-payment-info,
    .terra-payment-info {
        text-align: center;
        padding: 15px;
    }
    .btc-address,
    .eth-address {
        background: #f5f5f5;
        padding: 10px;
        margin: 10px 0;
        word-break: break-all;
        font-family: monospace;
        border-radius: 4px;
    }
    .qr-code {
        margin: 15px auto;
        width: 200px;
        height: 200px;
    }
    .np-loading {
        display: inline-block;
        width: 20px;
        height: 20px;
        border: 2px solid #f3f3f3;
        border-top: 2px solid #3498db;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);
