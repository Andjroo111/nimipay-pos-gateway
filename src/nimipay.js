import PaymentFlowService from "./services/PaymentFlowService.js";
import { HubApi } from "@nimiq/hub-api";
import Reef from "reef";

// Initialize services
const paymentFlow = new PaymentFlowService();
const hubApi = new HubApi("https://wallet.nimiq.com");

// Currency configurations
const CURRENCY_CONFIG = {
    NIM: {
        name: "Nimiq",
        symbol: "NIM",
        icon: "https://api.nimiq.com/identicon/NIM.png",
        decimals: 4,
        minConfirmations: 2,
        type: "native"
    },
    BTC: {
        name: "Bitcoin",
        symbol: "BTC",
        icon: "img/btc-icon.png",
        decimals: 8,
        minConfirmations: 3,
        type: "native"
    },
    USDC: {
        name: "USD Coin",
        symbol: "USDC",
        icon: "img/usdc-icon.png",
        decimals: 6,
        minConfirmations: 12,
        type: "erc20",
        network: "ethereum"
    },
    UST: {
        name: "TerraUSD",
        symbol: "UST",
        icon: "img/ust-icon.png",
        decimals: 6,
        minConfirmations: 15,
        type: "terra",
        network: "terra"
    }
};

let np = new Reef("#nimipay", {
    data: {
        txData: null,
        result: {
            address: "",
            label: ""
        },
        selectedCurrency: "NIM",
        invoices: [],
        items: [],
        balances: {},
        invoicesString: "",
        itemsString: "",
        checkoutFeedback: "",
        invoicesCount: 0,
        itemsCount: 0,
        exchangeRates: {},
        gasFee: null,
        initialized: false
    },
    template: function (props) {
        return '<div class="np-modal-window" id="np-modal">'+
        '<div class="np-modal-content">'+
            '<div id="np-wallet" class="np-wallet">'+
                '<div onclick="npCloseModal()" class="np-modal-close">✕</div>'+
                '<b>Crypto Wallet</b><br><br>'+
                '<div class="np-currency-selector">'+
                    Object.keys(CURRENCY_CONFIG).map(currency => 
                        `<div class="np-currency-option ${props.selectedCurrency === currency ? "selected" : ""}" 
                              onclick="npSelectCurrency('${currency}')">
                            <img src="${CURRENCY_CONFIG[currency].icon}" alt="${currency}">
                            ${CURRENCY_CONFIG[currency].name}
                         </div>`
                    ).join("") +
                "</div>"+
                getCurrencyDisplay(props)+
                '<div style="height:5px;"></div>'+
                '<div class="np-wallet-func">'+
                    getWalletFunctions(props)+
                "</div>"+
            "</div>"+
            '<div class="np-tabs">'+
                '<div class="np-btn" onclick="npShowInvoices()">Invoices ('+props.invoicesCount+')</div>'+
                '<div class="np-btn" onclick="npShowItems()">Items ('+props.itemsCount+')</div>'+
            "</div>"+
            '<div id="np-tab-invoices">'+props.invoicesString+"</div>"+
            '<div id="np-tab-items">'+props.itemsString+"</div>"+
        "</div>"+
        "</div>";
    }
});

// Initialize payment flow service
(async () => {
    try {
        await paymentFlow.initialize();
        np.data.initialized = true;
    } catch (error) {
        console.error("Failed to initialize payment flow:", error);
    }
})();

async function npSelectCurrency(currency) {
    np.data.selectedCurrency = currency;
    np.data.gasFee = null;
    
    // Clear existing balance
    delete np.data.balances[currency];
    
    try {
        // Get new balance using PaymentFlowService
        const balance = await paymentFlow.getBalance(currency, np.data.result.address);
        np.data.balances[currency] = balance;
        
        // Get exchange rate
        const response = await fetch(`${npBackendUrl}?action=getPrice&currency=${currency}`);
        const data = await response.json();
        np.data.exchangeRates[currency] = data.rate;
        
        // Get gas fee estimate for ERC20 tokens
        if (CURRENCY_CONFIG[currency].type === "erc20") {
            const gasFee = await paymentFlow.getGasFeeEstimate(currency);
            np.data.gasFee = gasFee;
        }
        
        await npInvoicesPriceInCrypto();
    } catch (error) {
        console.error("Currency selection error:", error);
    }
}

async function npCheckout(id_invoice) {
    if (!np.data.initialized) {
        document.getElementById(`np-error-${id_invoice}`).innerHTML = 
            '<div style="margin-top:5px;margin-bottom:10px;color:red;">Payment system initializing. Please try again.</div>';
        return;
    }

    const index = np.data.invoices.findIndex(invoice => invoice.id_invoice === id_invoice);
    if (index === -1) {
        console.error("Invoice not found:", id_invoice);
        return;
    }

    const invoice = np.data.invoices[index];
    const currency = np.data.selectedCurrency;
    const config = CURRENCY_CONFIG[currency];
    
    try {
        // Get current price and convert amount
        const rate = np.data.exchangeRates[currency];
        if (!rate) {
            throw new Error("Exchange rate not available");
        }
        
        const cryptoAmount = (invoice.value_usd / rate).toFixed(config.decimals);
        
        // Check balance
        const balance = np.data.balances[currency];
        if (Number(cryptoAmount) > Number(balance)) {
            document.getElementById(`np-error-${id_invoice}`).innerHTML = 
                `<div style="margin-top:5px;margin-bottom:10px;color:red;">Insufficient ${currency} balance</div>`;
            return;
        }

        // Process payment through PaymentFlowService
        const result = await paymentFlow.processPayment(invoice, currency, cryptoAmount);
        
        // Handle different payment responses
        switch (result.type) {
            case "native":
                await handleNativePayment(invoice.id_invoice, result, currency);
                break;
            case "address":
                showAddressPayment(invoice.id_invoice, result);
                break;
            case "erc20":
                showERC20Payment(invoice.id_invoice, result);
                break;
            case "terra":
                showTerraPayment(invoice.id_invoice, result);
                break;
        }
    } catch (error) {
        console.error("Checkout error:", error);
        document.getElementById(`np-error-${id_invoice}`).innerHTML = 
            '<div style="margin-top:5px;margin-bottom:10px;color:red;">Transaction failed. Please try again.</div>';
    }
}

async function handleNativePayment(invoiceId, result, currency) {
    document.getElementById(`np-invoice-${invoiceId}`).innerHTML = 
        `<b>Confirming transaction...</b> <span class="np-loading np-line"></span>
         <div style="height:10px;"></div>
         <div style="font-size:13px;padding-left:6px;padding-right:6px;margin-bottom:10px;">
         Waiting for ${CURRENCY_CONFIG[currency].minConfirmations} confirmations. 
         Please wait, or open your wallet later to see the new item.</div>`;

    try {
        const confirmation = await paymentFlow.monitorTransaction(result.hash, invoiceId, currency);
        if (confirmation.status === "confirmed") {
            document.getElementById(`np-invoice-${invoiceId}`).innerHTML = 
                `Payment received: <a href="${getExplorerUrl(currency, result.hash)}" target="_blank">Explore</a><br><br>`;
        }
    } catch (error) {
        console.error("Transaction monitoring error:", error);
    }
}

function showAddressPayment(invoiceId, result) {
    document.getElementById(`np-invoice-${invoiceId}`).innerHTML = 
        `<div class="btc-payment-info">
            <p>Send exactly ${result.amount} ${result.currency} to:</p>
            <div class="btc-address">${result.address}</div>
            <div class="qr-code" id="qr-${invoiceId}"></div>
            <p>Waiting for payment...</p>
        </div>`;
    
    generateQRCode(`qr-${invoiceId}`, `${result.currency.toLowerCase()}:${result.address}?amount=${result.amount}`);
}

function showERC20Payment(invoiceId, result) {
    document.getElementById(`np-invoice-${invoiceId}`).innerHTML = 
        `<div class="erc20-payment-info">
            <p>Confirm the transaction in your Ethereum wallet</p>
            <p>Amount: ${result.amount} ${result.currency}</p>
            <p>Estimated Gas: ${result.gasFee} ETH</p>
            <span class="np-loading np-line"></span>
        </div>`;
}

function showTerraPayment(invoiceId, result) {
    document.getElementById(`np-invoice-${invoiceId}`).innerHTML = 
        `<div class="terra-payment-info">
            <p>Confirm the transaction in Terra Station</p>
            <p>Amount: ${result.amount} ${result.currency}</p>
            <span class="np-loading np-line"></span>
        </div>`;
}

function getExplorerUrl(currency, txHash) {
    switch (currency) {
        case "NIM":
            return `https://explorer.nimiq.com/transaction/${txHash}`;
        case "BTC":
            return `https://blockstream.info/tx/${txHash}`;
        case "USDC":
            return `https://etherscan.io/tx/${txHash}`;
        case "UST":
            return `https://finder.terra.money/tx/${txHash}`;
        default:
            return "#";
    }
}

// Export necessary functions for global access
window.npSelectCurrency = npSelectCurrency;
window.npCheckout = npCheckout;
window.npCloseModal = () => {
    document.getElementById("np-modal").style.display = "none";
};
window.npShowInvoices = () => {
    document.getElementById("np-tab-invoices").style.display = "block";
    document.getElementById("np-tab-items").style.display = "none";
};
window.npShowItems = () => {
    document.getElementById("np-tab-invoices").style.display = "none";
    document.getElementById("np-tab-items").style.display = "block";
};

// Add necessary CSS
const style = document.createElement("style");
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
