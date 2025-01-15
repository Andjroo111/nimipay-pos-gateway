# Frontend Integration Guide

This guide focuses on the frontend-specific aspects of NimiPay POS Gateway, particularly the @nimiq/core integration and browser-based features.

## Table of Contents

1. [Browser Node Integration](#browser-node-integration)
2. [Frontend State Management](#frontend-state-management)
3. [Offline Capabilities](#offline-capabilities)
4. [Multi-Currency Support](#multi-currency-support)
5. [UI Components](#ui-components)

## Browser Node Integration

### Setting Up @nimiq/core

```javascript
import { NimiqNodeService } from 'nimipay-pos-gateway';

class BrowserNode {
  constructor() {
    this.nodeService = new NimiqNodeService();
  }

  async initialize() {
    // Initialize browser node
    await this.nodeService.initialize();

    // Configure consensus
    await this.nodeService.configureConsensus({
      network: 'main',
      type: 'light'
    });

    // Handle node events
    this.nodeService.on('consensus-established', () => {
      console.log('Connected to Nimiq network');
    });

    this.nodeService.on('peer-count-changed', (count) => {
      console.log(`Connected to ${count} peers`);
    });
  }
}
```

### Balance Checking

```javascript
// Frontend-only balance checking
async function checkBalance(address) {
  const balance = await nodeService.getBalance(address);
  return balance;
}

// Real-time balance updates
nodeService.on('balance-changed', (address, newBalance) => {
  updateUI(address, newBalance);
});
```

### Transaction Processing

```javascript
// Process transaction in browser
async function sendTransaction(recipient, amount) {
  const tx = await nodeService.processTransaction({
    recipient,
    value: amount * 1e4, // Convert to luna
    extraData: 'Payment via NimiPay'
  });

  // Monitor transaction
  nodeService.on(`transaction-${tx.hash}`, (status) => {
    switch (status) {
      case 'confirming':
        showConfirming();
        break;
      case 'confirmed':
        showSuccess();
        break;
      case 'failed':
        showError();
        break;
    }
  });
}
```

## Frontend State Management

### Local Storage Strategy

```javascript
// Configure storage
const storage = {
  transactions: localforage.createInstance({
    name: 'nimipay-transactions'
  }),
  balances: localforage.createInstance({
    name: 'nimipay-balances'
  })
};

// Store transaction
async function storeTransaction(tx) {
  await storage.transactions.setItem(tx.hash, {
    ...tx,
    timestamp: Date.now(),
    status: 'pending'
  });
}

// Cache balance
async function cacheBalance(address, balance) {
  await storage.balances.setItem(address, {
    value: balance,
    timestamp: Date.now(),
    ttl: 5 * 60 * 1000 // 5 minutes
  });
}
```

### State Synchronization

```javascript
class StateSync {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.setupListeners();
  }

  setupListeners() {
    // Handle online/offline
    window.addEventListener('online', () => {
      this.syncPendingTransactions();
    });

    window.addEventListener('offline', () => {
      this.enableOfflineMode();
    });

    // Handle storage events
    window.addEventListener('storage', (event) => {
      if (event.key.startsWith('nimipay-')) {
        this.handleStorageChange(event);
      }
    });
  }

  async syncPendingTransactions() {
    const pending = await this.stateManager.getPendingTransactions();
    for (const tx of pending) {
      await this.processPendingTransaction(tx);
    }
  }
}
```

## Offline Capabilities

### Offline Transaction Queue

```javascript
class OfflineQueue {
  constructor(queueService) {
    this.queue = queueService;
    this.pendingTransactions = new Map();
  }

  async queueTransaction(tx) {
    const queueId = await this.queue.add({
      type: 'transaction',
      data: tx,
      timestamp: Date.now()
    });

    this.pendingTransactions.set(queueId, tx);
    return queueId;
  }

  async processQueue() {
    const items = await this.queue.getAll();
    for (const item of items) {
      await this.processQueueItem(item);
    }
  }
}
```

### Offline State Management

```javascript
class OfflineState {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.offlineChanges = new Set();
  }

  async trackChange(change) {
    this.offlineChanges.add(change);
    await this.stateManager.storeChange(change);
  }

  async syncChanges() {
    for (const change of this.offlineChanges) {
      await this.stateManager.syncChange(change);
    }
    this.offlineChanges.clear();
  }
}
```

## Multi-Currency Support

### Currency Configuration

```javascript
const CURRENCY_CONFIG = {
  NIM: {
    type: 'native',
    decimals: 4,
    minConfirmations: 2,
    icon: 'nim-icon.svg'
  },
  BTC: {
    type: 'native',
    decimals: 8,
    minConfirmations: 3,
    icon: 'btc-icon.svg'
  },
  USDC: {
    type: 'erc20',
    decimals: 6,
    minConfirmations: 12,
    icon: 'usdc-icon.svg',
    contract: '0x...'
  }
};
```

### Currency-Specific Handling

```javascript
class CurrencyHandler {
  constructor(config) {
    this.config = config;
    this.handlers = new Map();
    this.initializeHandlers();
  }

  initializeHandlers() {
    // Native Nimiq handler
    this.handlers.set('NIM', {
      getBalance: (address) => nodeService.getBalance(address),
      sendTransaction: (tx) => nodeService.processTransaction(tx)
    });

    // BTC handler
    this.handlers.set('BTC', {
      getBalance: (address) => btcService.getBalance(address),
      sendTransaction: (tx) => btcService.sendTransaction(tx)
    });

    // USDC handler
    this.handlers.set('USDC', {
      getBalance: (address) => usdcService.balanceOf(address),
      sendTransaction: (tx) => usdcService.transfer(tx)
    });
  }

  async processPayment(currency, payment) {
    const handler = this.handlers.get(currency);
    if (!handler) {
      throw new Error(`Unsupported currency: ${currency}`);
    }
    return handler.sendTransaction(payment);
  }
}
```

## UI Components

### Payment Button

```javascript
class PaymentButton extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.setupListeners();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        .payment-button {
          background: var(--nim-blue, #1A6DFF);
          color: white;
          padding: 12px 24px;
          border-radius: 4px;
          border: none;
          cursor: pointer;
          font-family: system-ui, sans-serif;
          transition: background 0.2s;
        }
        .payment-button:hover {
          background: var(--nim-blue-dark, #0056FF);
        }
        .payment-button[disabled] {
          opacity: 0.5;
          cursor: not-allowed;
        }
      </style>
      <button class="payment-button">
        <slot>Pay with NimiPay</slot>
      </button>
    `;
  }

  setupListeners() {
    this.shadowRoot.querySelector('button').addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('payment-click'));
    });
  }
}

customElements.define('nimipay-button', PaymentButton);
```

### Currency Selector

```javascript
class CurrencySelector extends HTMLElement {
  static get observedAttributes() {
    return ['selected', 'disabled'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.loadCurrencies();
  }

  async loadCurrencies() {
    const currencies = Object.entries(CURRENCY_CONFIG).map(([code, config]) => ({
      code,
      ...config
    }));

    this.shadowRoot.querySelector('select').innerHTML = currencies
      .map(currency => `
        <option value="${currency.code}">
          ${currency.code} - ${this.formatDecimals(currency.decimals)}
        </option>
      `)
      .join('');
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        .currency-select {
          padding: 8px;
          border-radius: 4px;
          border: 1px solid #ccc;
          font-family: system-ui, sans-serif;
        }
        .currency-select:focus {
          outline: none;
          border-color: var(--nim-blue, #1A6DFF);
        }
      </style>
      <select class="currency-select"></select>
    `;
  }
}

customElements.define('nimipay-currency-selector', CurrencySelector);
```

For more detailed API documentation, refer to the [API Reference](API_REFERENCE.md).
