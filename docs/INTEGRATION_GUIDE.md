# Integration Guide

This guide provides step-by-step instructions for integrating NimiPay POS Gateway into your platform.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Basic Setup](#basic-setup)
4. [Payment Flow Integration](#payment-flow-integration)
5. [Platform-Specific Integration](#platform-specific-integration)
6. [Advanced Features](#advanced-features)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

- Node.js 14.x or higher
- NPM 6.x or higher
- Modern browser with IndexedDB support
- Basic understanding of async/await and ES6+ features

## Installation

### NPM Installation

```bash
npm install nimipay-pos-gateway
```

### Manual Installation

1. Clone the repository:
```bash
git clone https://github.com/Andjroo111/nimipay-pos-gateway.git
```

2. Install dependencies:
```bash
cd nimipay-pos-gateway
npm install
```

## Basic Setup

### 1. Initialize Core Services

```javascript
import {
  PaymentFlowService,
  StateManager,
  MigrationManager
} from 'nimipay-pos-gateway';

// Initialize services
const paymentFlow = new PaymentFlowService();
const stateManager = new StateManager();
const migrationManager = new MigrationManager();

// Initialize payment system
await paymentFlow.initialize();

// Run migrations if needed
await migrationManager.migrate({
  validateData: true,
  backupEnabled: true
});
```

### 2. Configure Environment

Create a `.env` file:

```env
NIMIQ_NETWORK=main
NIMIQ_ENDPOINT=https://network.nimiq.com
DEFAULT_CURRENCY=NIM
SUPPORTED_CURRENCIES=NIM,BTC,USDC
```

### 3. Configure Currencies

```javascript
// config/currency_config.js
export default {
  NIM: {
    type: "native",
    decimals: 4,
    minConfirmations: 2
  },
  BTC: {
    type: "native",
    decimals: 8,
    minConfirmations: 3
  },
  USDC: {
    type: "erc20",
    decimals: 6,
    minConfirmations: 12
  }
};
```

## Payment Flow Integration

### 1. Basic Payment Processing

```javascript
// Process payment
const payment = await paymentFlow.processPayment({
  id_invoice: "inv_123",
  amount: 100,
  currency: "NIM"
});

// Monitor status
const status = await paymentFlow.getTransactionStatus(payment.txId);
```

### 2. Event Handling

```javascript
// Listen for payment events
window.addEventListener("nimipay:queue", async (event) => {
  const { type, data } = event.detail;
  
  switch (type) {
    case "transaction:success":
      await handleSuccess(data);
      break;
    case "transaction:failure":
      await handleFailure(data);
      break;
    case "transaction:retry":
      await handleRetry(data);
      break;
  }
});

// Listen for state events
window.addEventListener("nimipay:state", (event) => {
  const { type, data } = event.detail;
  
  switch (type) {
    case "sync:conflict":
      handleSyncConflict(data);
      break;
    case "storage:quota":
      handleStorageQuota(data);
      break;
  }
});
```

### 3. Offline Support

```javascript
// Handle offline mode
window.addEventListener("offline", () => {
  // Transactions will be automatically queued
  notifyUser("Offline mode - transactions will be queued");
});

// Handle online recovery
window.addEventListener("online", () => {
  // Queued transactions will be processed
  notifyUser("Back online - processing queued transactions");
});

// Check sync status
const syncStatus = stateManager.getSyncStatus();
if (syncStatus.pendingChanges.length > 0) {
  showPendingTransactions(syncStatus.pendingChanges);
}
```

## Platform-Specific Integration

### WordPress

1. Install the WordPress plugin:
```bash
cd wp-content/plugins
git clone https://github.com/Andjroo111/nimipay-pos-gateway.git
```

2. Activate and configure in WordPress admin:
```php
// wp-config.php
define('NIMIPAY_API_KEY', 'your-api-key');
define('NIMIPAY_MERCHANT_ID', 'your-merchant-id');
```

3. Add payment button to templates:
```php
<?php
if (class_exists('NimiPay_Gateway')) {
    do_action('nimipay_payment_button', [
        'amount' => $total,
        'currency' => 'NIM'
    ]);
}
?>
```

### Wix

1. Add the NimiPay app from the Wix App Market

2. Configure in your dashboard:
```javascript
// Wix site code
import { nimipay } from '@nimipay/wix-integration';

$w.onReady(() => {
  nimipay.initialize({
    merchantId: 'your-merchant-id',
    apiKey: 'your-api-key'
  });
});
```

### Squarespace

1. Add custom code injection:
```html
<script src="https://cdn.nimipay.com/nimipay.min.js"></script>
<script>
  NimiPay.initialize({
    merchantId: 'your-merchant-id',
    apiKey: 'your-api-key'
  });
</script>
```

## Advanced Features

### 1. Custom Transaction Handling

```javascript
class CustomPaymentHandler {
  constructor(paymentFlow) {
    this.paymentFlow = paymentFlow;
  }

  async processCustomPayment(invoice) {
    // Add custom logic before payment
    const enrichedInvoice = await this.enrichInvoice(invoice);
    
    // Process payment
    const result = await this.paymentFlow.processPayment(
      enrichedInvoice,
      invoice.currency,
      invoice.amount
    );
    
    // Add custom post-processing
    await this.handleResult(result);
    
    return result;
  }
}
```

### 2. State Management

```javascript
// Custom state handling
class StateHandler {
  constructor(stateManager) {
    this.stateManager = stateManager;
  }

  async trackTransaction(txId, data) {
    // Store transaction
    await this.stateManager.storeTransaction(txId, {
      ...data,
      tracked: true,
      timestamp: Date.now()
    });
    
    // Validate state
    const isValid = await this.stateManager.validateLocalState();
    if (!isValid) {
      await this.handleInvalidState();
    }
  }
}
```

### 3. Migration Handling

```javascript
// Custom migration logic
class MigrationHandler {
  constructor(migrationManager) {
    this.migrationManager = migrationManager;
  }

  async performMigration() {
    try {
      // Get current version
      const currentVersion = await this.migrationManager.getCurrentVersion();
      
      // Run migration with custom options
      const result = await this.migrationManager.migrate({
        validateData: true,
        backupEnabled: true,
        batchSize: 50,
        timeout: 60000
      });
      
      return result;
    } catch (error) {
      // Handle migration failure
      await this.handleMigrationFailure(error);
      throw error;
    }
  }
}
```

## Troubleshooting

### Common Issues

1. Transaction Queue Issues
```javascript
// Check queue health
const queueStatus = await transactionQueue.getQueueStatus();
if (!queueStatus.healthy) {
  console.error("Queue issues detected:", queueStatus);
}
```

2. State Synchronization Issues
```javascript
// Check sync status
const syncStatus = stateManager.getSyncStatus();
if (syncStatus.conflicts.length > 0) {
  console.error("Sync conflicts detected:", syncStatus.conflicts);
}
```

3. Migration Failures
```javascript
// Check migration history
const history = await migrationManager.getMigrationHistory();
const failedMigrations = history.filter(m => m.status === "failed");
if (failedMigrations.length > 0) {
  console.error("Failed migrations:", failedMigrations);
}
```

### Error Handling Best Practices

```javascript
try {
  // Process payment
  const result = await paymentFlow.processPayment(invoice);
  
  // Store transaction state
  await stateManager.storeTransaction(result.txId, {
    status: result.status,
    timestamp: Date.now()
  });
} catch (error) {
  if (error.code === "NETWORK_ERROR") {
    // Handle network issues
    await handleNetworkError(error);
  } else if (error.code === "VALIDATION_ERROR") {
    // Handle validation issues
    await handleValidationError(error);
  } else {
    // Handle other errors
    console.error("Payment processing error:", error);
    throw error;
  }
}
```

For more detailed API documentation, refer to the [API Reference](API_REFERENCE.md).
