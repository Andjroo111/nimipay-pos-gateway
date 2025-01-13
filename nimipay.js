// https://github.com/cferdinandi/reef

// define backend url
const npBackendUrl = 'nimipay.php';

// Initialize the Nimiq Hub API for PoS
const hubApi = new HubApi('https://wallet.nimiq.com');

// Price API endpoints
const PRICE_APIS = {
  NIMIQ: 'https://api.nimiq.com/price/usd',
  COINGECKO: 'https://api.coingecko.com/api/v3/simple/price?ids=nimiq&vs_currencies=usd'
};

let np = new Reef('#nimipay', {
  data: {
    txData: null,
    result: {
      address: '',
      label: ''
    },
    invoices: [],
    items: [],
    userBalanceNim: null,
    userBalanceUsd: null,
    invoicesString: '',
    itemsString: '',
    checkoutFeedback: '',
    invoicesCount: 0,
    itemsCount: 0
  },
  template: function (props) {
    return '<div class="np-modal-window" id="np-modal">'+
    '<div class="np-modal-content">'+
      '<div id="np-wallet" class="np-wallet">'+
        '<div onclick="npCloseModal()" class="np-modal-close">✕</div>'+
        '<b>My NIM Wallet</b><br><br>'+
        '<div id="identicon"><img src="https://api.nimiq.com/identicon/'+props.result.address.replace(/\s/g, '')+'.png"></svg></div>'+
        '<span id="output"><span style="font-size:14px;">'+props.result.address+'<br>'+props.result.label+'</span></span>'+
        '<div id="balance"><br>Balance: ' + props.userBalanceNim + ' NIM (' + props.userBalanceUsd + ' USD)</div>'+
        '<div id="balance-usd"></div>'+
        '<div style="height:5px;"></div>'+
        '<div class="np-wallet-func">'+
          '<a href="https://changelly.com/exchange/BTC/NIM/0.1" class="np-link" target="_blank">Top Up</a> | <a href="https://wallet.nimiq.com" target="_blank">Backup</a>'+
        '</div>'+
      '</div>'+
      '<div class="np-tabs">'+
        '<div class="np-btn" onclick="npShowInvoices()">Invoices ('+props.invoicesCount+')</div>'+
        '<div class="np-btn" onclick="npShowItems()">Items ('+props.itemsCount+')</div></div>'+
        '<div id="np-tab-invoices">'+props.invoicesString+'</div>'+
        '<div id="np-tab-items">'+props.itemsString+'</div>'+
      '</div>'+
    '</div>'
  }
});

// Utility function to fetch price with fallback and retries
async function fetchPrice(retries = 3, delay = 1000) {
  const fetchFromAPI = async (api) => {
    try {
      const response = await fetch(api);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      
      if (api === PRICE_APIS.NIMIQ) {
        if (!data.nim_qc) throw new Error('Missing nim_qc in Nimiq API response');
        return data;
      } else {
        if (!data.nimiq?.usd) throw new Error('Missing price data in CoinGecko response');
        return { nim_qc: data.nimiq.usd };
      }
    } catch (error) {
      console.error(`Error fetching from ${api}:`, error);
      throw error;
    }
  };

  let lastError;
  
  // Try Nimiq API first
  try {
    console.log('Attempting to fetch price from Nimiq API...');
    return await fetchFromAPI(PRICE_APIS.NIMIQ);
  } catch (error) {
    console.log('Nimiq API failed, falling back to CoinGecko...');
    lastError = error;
  }

  // Try CoinGecko with retries
  for (let i = 0; i < retries; i++) {
    try {
      return await fetchFromAPI(PRICE_APIS.COINGECKO);
    } catch (error) {
      lastError = error;
      if (i < retries - 1) {
        console.log(`CoinGecko attempt ${i + 1} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 1.5; // Exponential backoff
      }
    }
  }

  throw new Error(`Failed to fetch price after all attempts. Last error: ${lastError.message}`);
}

function npInvoiceStringMaker(id_invoice, value, value_nim, status, tx) {
  let invoiceString = '<div class="np-wallet">'+
    '<div class="charge"><b>Invoice #'+id_invoice+'</b><br><br>'+
    'Payment sum: '+value+' USD ('+value_nim+' NIM)<br><br>'+
    '<div id="np-invoice-'+id_invoice+'">';

  if (status == '') {
    invoiceString += '<div class="np-btn np-btn-small" onclick="npCheckoutPrepare(\''+id_invoice+'\')">Pay '+value_nim+' NIM</div>';
  }
  else if (status == 'pending') {
    invoiceString += '<b>Pending confirmation...</b> <span class="np-loading np-line"></span><br><br>';
    setTimeout(function(){ npTxBackendValidate(tx, id_invoice); }, 2000 + Math.random() * (5 - 2) * 1000);
  }
  else if (status == 'confirmed') {
    invoiceString += 'Payment received: <a href="https://explorer.nimiq.com/transaction/'+tx+'" target="_blank">Explore</a><br><br>';
  }

  invoiceString += '</div><div id="np-error-'+id_invoice+'"></div></div>';
  return invoiceString;
}

function npItemsStringMaker(id_invoice, type, content) {
  if (type == 'fortune_cookie') {
    return ('<div class="np-wallet">Fortune Cookie #'+id_invoice+'<br><div class="np-nimiqookie-content"><div style="line-height:22px;padding:20px;"><b>'+content+'</b></div></div></div>');
  }
}

function npCloseModal() {
  document.getElementById('np-modal').style.display = "none";
}

function npShowInvoices() {
  document.getElementById('np-tab-invoices').style.display = 'block';
  document.getElementById('np-tab-items').style.display = 'none';
}

function npShowItems() {
  document.getElementById('np-tab-invoices').style.display = 'none';
  document.getElementById('np-tab-items').style.display = 'block';
}

// Initialize wallet button
const npWalletButton = document.getElementById('np-wallet');
if (npWalletButton) {
  npWalletButton.onclick = npWallet;
}

async function npWallet(retries = 3) {
  const walletButton = document.getElementById('np-wallet');
  walletButton.innerHTML = 'Opening Wallet... <span class="np-loading np-line"></span>';
  
  try {
    const data = await hubApi.chooseAddress({ appName: nimAddressLabel });
    
    // Reset if a previous user is different
    if (np.data.result.address && np.data.result.address !== data.address) {
      np.setData({ 
        txData: null,
        result: { address: '', label: '' },
        invoices: [],
        items: [],
        userBalanceNim: null,
        userBalanceUsd: null,
        invoicesString: '',
        itemsString: '',
        checkoutFeedback: '',
        invoicesCount: 0,
        itemsCount: 0 
      });
    }

    np.render();
    np.setData({ result: data });
    document.getElementById('np-modal').style.display = "block";
    
    // Fetch balance and user data concurrently
    await Promise.all([npGetBalance(), npSendUserAddress()]);
    
    walletButton.innerHTML = 'Open My NIM Wallet';
  } catch (error) {
    console.error('Wallet error:', error);
    walletButton.innerHTML = 'Open My NIM Wallet';
    
    if (retries > 0) {
      const errorMessage = error.message || 'Unknown error';
      if (errorMessage.includes('popup') || errorMessage.includes('blocked')) {
        alert('Please enable popups for this site to access your wallet.');
      } else if (retries > 1) {
        console.log(`Retrying wallet access... (${retries - 1} attempts remaining)`);
        return npWallet(retries - 1);
      }
    }
    
    alert('Failed to access wallet: ' + (error.message || 'Please check your connection and try again.'));
  }
}

async function npCheckout(id_invoice, oneNimUsdValue) {
  const index = np.data.invoices.findIndex(invoice => invoice.id_invoice === id_invoice);
  if (index === -1) {
    console.error('Invoice not found:', id_invoice);
    return;
  }

  const priceNim = (np.data.invoices[index].value / oneNimUsdValue).toFixed(2);
  const value = Number((priceNim * 1e4).toFixed(2)); // PoS uses 4 decimal places

  if (Number(priceNim) > Number(np.data.userBalanceNim)) {
    document.getElementById('np-error-'+id_invoice).innerHTML = 
      '<div style="margin-top:5px;margin-bottom:10px;color:red;">You do not have enough NIM to pay the invoice.</div>';
    return;
  }

  try {
    const response = await hubApi.checkout({
      appName: nimAddressLabel,
      recipient: nimAddress,
      value: value,
      extraData: 'Invoice #'+id_invoice,
      sender: np.data.result.address,
      forceSender: true
    });

    document.getElementById('np-invoice-'+id_invoice).innerHTML = 
      '<b>Confirming transaction...</b> <span class="np-loading np-line"></span>'+
      '<div style="height:10px;"></div>'+
      '<div style="font-size:13px;padding-left:6px;padding-right:6px;margin-bottom:10px;">'+
      'After the transaction is confirmed, your order will be activated. '+
      'Please wait, or open your wallet later to see the new item.</div>';

    await npSendTxHash(id_invoice, response.hash);
    await npTxBackendValidate(response.hash, id_invoice);
  } catch (error) {
    console.error('Checkout error:', error);
    document.getElementById('np-error-'+id_invoice).innerHTML = 
      '<div style="margin-top:5px;margin-bottom:10px;color:red;">Transaction failed. Please try again.</div>';
  }
}

async function npCheckoutPrepare(id_invoice) {
  try {
    const priceData = await fetchPrice();
    await npCheckout(id_invoice, priceData.nim_qc);
  } catch (error) {
    console.error('Checkout preparation failed:', error);
    document.getElementById('np-error-'+id_invoice).innerHTML = 
      '<div style="margin-top:5px;margin-bottom:10px;color:red;">Failed to get current price. Please try again.</div>';
  }
}

// Initialize item buttons
const npAddItemButton = document.getElementById('np-add-item');
if (npAddItemButton) {
  npAddItemButton.onclick = npAddItem;
}

async function npAddItem(e) {
  if (!np.data.result.address) {
    try {
      const data = await hubApi.chooseAddress({ appName: nimAddressLabel });
      await fetch(`${npBackendUrl}?action=npAddItem&data=${encodeURIComponent(data.address)}`);
      
      np.render();
      np.setData({ result: data });
      document.getElementById('np-modal').style.display = "block";
      await npGetBalance();
      await npSendUserAddress();
    } catch (error) {
      console.error('Add item error:', error);
      alert('Failed to add item. Please try again.');
    }
  } else {
    try {
      await fetch(`${npBackendUrl}?action=npAddItem&data=${encodeURIComponent(np.data.result.address)}`);
      document.getElementById('np-modal').style.display = "block";
      await npSendUserAddress();
    } catch (error) {
      console.error('Add item error:', error);
      alert('Failed to add item. Please try again.');
    }
  }
}

// Cache price data for 5 minutes
let cachedPriceData = null;
let lastPriceFetch = 0;
const PRICE_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function npGetBalance() {
  try {
    // Show loading indicator
    const balanceDiv = document.getElementById('balance');
    if (balanceDiv) {
      balanceDiv.innerHTML = '<br>Fetching balance... <span class="np-loading np-line"></span>';
    }

    // Fetch balance and price data concurrently
    const [balanceResponse, priceData] = await Promise.all([
      fetch(`https://rpc.nimiq.com/account/${np.data.result.address}`),
      (async () => {
        const now = Date.now();
        if (cachedPriceData && (now - lastPriceFetch) < PRICE_CACHE_DURATION) {
          return cachedPriceData;
        }
        const newPriceData = await fetchPrice();
        cachedPriceData = newPriceData;
        lastPriceFetch = now;
        return newPriceData;
      })()
    ]);

    if (!balanceResponse.ok) throw new Error('Failed to fetch balance');
    
    const balanceData = await balanceResponse.json();
    const userBalanceNim = balanceData.balance / 1e4; // PoS uses 4 decimal places
    const userBalanceUsd = (priceData.nim_qc * userBalanceNim).toFixed(2);
    
    np.setData({ 
      userBalanceUsd: userBalanceUsd, 
      userBalanceNim: userBalanceNim.toFixed(2) 
    });

    // Update balance display
    if (balanceDiv) {
      balanceDiv.innerHTML = `<br>Balance: ${userBalanceNim.toFixed(2)} NIM (${userBalanceUsd} USD)`;
    }
  } catch (error) {
    console.error('Balance fetch error:', error);
    const balanceDiv = document.getElementById('balance');
    if (balanceDiv) {
      balanceDiv.innerHTML = '<br>Failed to fetch balance. <a href="#" onclick="npGetBalance()">Retry</a>';
    }
  }
}

async function npTxBackendValidate(tx, id_invoice) {
  try {
    const response = await fetch(
      `${npBackendUrl}?action=validateTx&data=${encodeURIComponent(JSON.stringify({ 
        tx: tx, 
        id_invoice: id_invoice 
      }))}`
    );

    if (!response.ok) throw new Error('Backend validation failed');
    
    const status = await response.text();
    
    if (status === 'pending' && document.getElementById('np-modal').style.display !== 'none') {
      console.log("Validating Tx: Trying again...");
      document.getElementById('np-invoice-'+id_invoice).innerHTML = 
        '<b>Confirming transaction...</b> <span class="np-loading np-line"></span>'+
        '<div style="height:10px;"></div>'+
        '<div style="font-size:13px;padding-left:6px;padding-right:6px;margin-bottom:10px;">'+
        'After the transaction is confirmed, your order will be activated. '+
        'Please wait, or open your wallet later to see the new item.</div>';
      
      setTimeout(() => npTxBackendValidate(tx, id_invoice), 
        2000 + Math.random() * (5 - 2) * 1000);
    } else {
      await npSendUserAddress();
    }
  } catch (error) {
    console.error('Transaction validation error:', error);
  }
}

async function npInvoicesPriceInNim() {
  try {
    const priceData = await fetchPrice();
    const invoicesString = np.data.invoices.map(invoice => {
      const priceNim = (invoice.value / priceData.nim_qc);
      return npInvoiceStringMaker(
        invoice.id_invoice,
        Number(invoice.value).toFixed(2),
        priceNim.toFixed(2),
        invoice.status,
        invoice.tx
      ) + '</div>';
    }).join('');

    np.setData({ invoicesString });
  } catch (error) {
    console.error('Invoice price calculation error:', error);
  }
}

function npCreateItems() {
  np.setData({ itemsCount: np.data.items.length });
  const itemsString = np.data.items
    .map(item => npItemsStringMaker(item.id_invoice, item.type, item.content))
    .join('');
  np.setData({ itemsString });
}

async function npSendUserAddress() {
  try {
    const response = await fetch(
      `${npBackendUrl}?action=sendUserAddress&data=${encodeURIComponent(JSON.stringify(np.data.result))}`
    );
    
    if (!response.ok) throw new Error('Failed to send user address');
    
    const data = await response.json();
    
    if (data[1] === 'initial') {
      await npSendUserAddress();
      return;
    }
    
    np.setData({ 
      invoicesCount: data[0].length,
      invoices: data[0],
      items: data[1]
    });
    
    await npInvoicesPriceInNim();
    npCreateItems();
  } catch (error) {
    console.error('User address sync error:', error);
  }
}

async function npSendTxHash(invoiceId, txHash) {
  try {
    await fetch(
      `${npBackendUrl}?action=sendTxHash&data=${encodeURIComponent(JSON.stringify({
        address: np.data.result.address,
        invoice: invoiceId,
        tx: txHash
      }))}`
    );
  } catch (error) {
    console.error('Transaction hash sync error:', error);
  }
}
