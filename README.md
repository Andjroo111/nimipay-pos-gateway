# NimiPay POS Gateway

A modern payment gateway integrating Nimiq's browser-first blockchain with point-of-sale systems.

## Features

- **Browser-Native Nimiq Integration**: Direct integration with @nimiq/core for browser-based blockchain interactions
- **Multi-Currency Support**: Native support for NIM, BTC, USDC, and other cryptocurrencies
- **Offline Capabilities**: Robust offline transaction handling and state management
- **Platform Integrations**: Ready-to-use integrations for WordPress, Wix, and Squarespace

## Architecture

### Core Services

- **NimiqNodeService**: Browser-based Nimiq node management
- **PaymentFlowService**: Unified payment processing workflow
- **TransactionQueueService**: Reliable transaction queueing and processing
- **StateManager**: Advanced state management with offline support
- **MigrationManager**: Data migration and schema versioning

### Directory Structure

```
nimipay-pos-gateway/
├── src/
│   ├── services/           # Core service implementations
│   │   ├── NimiqNodeService.js
│   │   ├── PaymentFlowService.js
│   │   ├── TransactionQueueService.js
│   │   ├── StateManager.js
│   │   └── MigrationManager.js
│   └── nimipay.js         # Main entry point
├── tests/
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   └── verification/      # Verification scripts
├── config/               # Configuration files
├── docs/                # Documentation
└── integrations/        # Platform integrations
    ├── wordpress/
    ├── wix/
    └── squarespace/
```

## Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your settings
```

3. Run setup:
```bash
npm run setup
```

## Usage

### Basic Implementation

```javascript
import { PaymentFlowService } from 'nimipay-pos-gateway';

// Initialize payment service
const paymentFlow = new PaymentFlowService();
await paymentFlow.initialize();

// Process payment
const result = await paymentFlow.processPayment({
  id_invoice: "123",
  amount: 100,
  currency: "NIM"
});

// Monitor status
paymentFlow.getTransactionStatus(result.txId).then(status => {
  console.log("Payment status:", status);
});
```

### Offline Support

```javascript
// Transactions are automatically queued when offline
window.addEventListener("offline", () => {
  console.log("Switched to offline mode");
});

// Queued transactions are processed when back online
window.addEventListener("online", () => {
  console.log("Reconnected - processing queued transactions");
});
```

### Multi-Currency Support

```javascript
// Configure supported currencies
const currencies = {
  NIM: { type: "native", decimals: 4 },
  BTC: { type: "native", decimals: 8 },
  USDC: { type: "erc20", decimals: 6 }
};

// Process payment in any supported currency
const payment = await paymentFlow.processPayment({
  amount: 100,
  currency: "USDC"
});
```

## Development

### Setup Development Environment

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run integration tests
npm run test:integration

# Build for production
npm run build
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- --grep "PaymentFlow"

# Run with coverage
npm run test:coverage
```

## Migration

### Running Migrations

```javascript
import { MigrationManager } from 'nimipay-pos-gateway';

const migrationManager = new MigrationManager();

// Run migrations
const result = await migrationManager.migrate({
  validateData: true,
  backupEnabled: true
});

console.log(`Migration completed: v${result.fromVersion} -> v${result.toVersion}`);
```

### Rollback Procedure

```javascript
// Automatic rollback on failure
try {
  await migrationManager.migrate();
} catch (error) {
  // Migration failed - automatic rollback will occur
  console.error("Migration failed:", error);
}
```

## API Documentation

Detailed API documentation is available in the [/docs](/docs) directory:

- [API Reference](docs/API_REFERENCE.md)
- [Integration Guide](docs/INTEGRATION_GUIDE.md)
- [Migration Guide](docs/MIGRATION_GUIDE.md)

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please:

1. Check the [Documentation](docs/)
2. Search [Issues](https://github.com/Andjroo111/nimipay-pos-gateway/issues)
3. Create a new issue if needed

## Acknowledgments

- Nimiq Team for the excellent [@nimiq/core](https://github.com/nimiq/core) implementation
- Contributors and testers
