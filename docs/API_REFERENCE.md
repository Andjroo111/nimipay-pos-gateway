# API Reference

## Core Services

### NimiqNodeService

Browser-based Nimiq node management service.

```typescript
class NimiqNodeService {
  async initialize(): Promise<void>
  async getBalance(address: string): Promise<number>
  async processTransaction(tx: TransactionConfig): Promise<TransactionResult>
  isReady(): boolean
  getStatus(): NodeStatus
}

interface TransactionConfig {
  recipient: string
  value: number
  extraData?: string
}

interface TransactionResult {
  hash: string
  status: "confirming" | "confirmed" | "failed"
}

interface NodeStatus {
  connected: boolean
  synced: boolean
  height: number
  peers: number
}
```

### PaymentFlowService

Unified payment processing workflow management.

```typescript
class PaymentFlowService {
  async initialize(): Promise<void>
  async processPayment(invoice: Invoice, currency: string, amount: number): Promise<PaymentResult>
  async getTransactionStatus(txId: string): Promise<TransactionStatus>
  async handleQueueEvent(event: QueueEvent): Promise<void>
}

interface Invoice {
  id_invoice: string
  amount: number
  currency: string
  recipient?: string
}

interface PaymentResult {
  txId: string
  type: "native" | "erc20" | "unknown"
  status: "queued" | "processing" | "completed" | "failed"
}

interface TransactionStatus {
  status: "pending" | "confirmed" | "failed"
  confirmations?: number
  error?: string
}
```

### TransactionQueueService

Transaction queue management and processing.

```typescript
class TransactionQueueService {
  async initializeQueue(): Promise<void>
  async queueTransaction(transaction: Transaction): Promise<string>
  async getTransactionStatus(txId: string): Promise<QueuedTransaction>
  async getQueueStatus(): Promise<QueueStatus>
}

interface Transaction {
  type: string
  currency: string
  amount: number
  invoice?: Invoice
  timestamp: number
}

interface QueuedTransaction {
  id: string
  status: "queued" | "processing" | "completed" | "failed"
  retries?: number
  error?: string
}

interface QueueStatus {
  size: number
  processing: number
  healthy: boolean
}
```

### StateManager

Advanced state management with offline support.

```typescript
class StateManager {
  async storeTransaction(txId: string, data: any): Promise<void>
  async getBalance(currency: string, address: string): Promise<BalanceData>
  async validateLocalState(): Promise<boolean>
  getSyncStatus(): SyncStatus
}

interface BalanceData {
  balance: number
  timestamp: number
  metadata: {
    source: string
    confidence: number
    validUntil: number
    isStale?: boolean
  }
}

interface SyncStatus {
  lastSync: number | null
  pendingChanges: string[]
  conflicts: [string, ConflictData][]
  isOnline: boolean
}

interface ConflictData {
  local: any
  remote: any
  timestamp: number
  resolved: boolean
}
```

### MigrationManager

Data migration and schema versioning management.

```typescript
class MigrationManager {
  async migrate(options?: MigrationOptions): Promise<MigrationResult>
  async getCurrentVersion(): Promise<number>
  async getMigrationHistory(): Promise<MigrationRecord[]>
  async getAvailableBackups(): Promise<BackupInfo[]>
  async validateMigration(migration: Migration): Promise<boolean>
}

interface MigrationOptions {
  batchSize?: number
  backupEnabled?: boolean
  validateData?: boolean
  retryAttempts?: number
  timeout?: number
}

interface MigrationResult {
  success: boolean
  fromVersion: number
  toVersion: number
  timestamp: number
}

interface MigrationRecord {
  version: number
  name: string
  status: "running" | "completed" | "failed"
  startTime: number
  endTime?: number
  error?: string
}

interface BackupInfo {
  timestamp: number
  version: number
}
```

## Events

### Queue Events

```typescript
interface QueueEvent {
  type: QueueEventType
  data: {
    txId: string
    transaction?: Transaction
    error?: string
    retries?: number
  }
}

type QueueEventType =
  | "transaction:success"
  | "transaction:failure"
  | "transaction:retry"
  | "transaction:validation"
  | "transaction:insufficient_funds"
```

### State Events

```typescript
interface StateEvent {
  type: StateEventType
  data: {
    key: string
    conflict?: ConflictData
    quota?: StorageQuota
  }
}

type StateEventType =
  | "sync:conflict"
  | "storage:quota"
  | "state:invalid"
```

## Error Handling

```typescript
class McpError extends Error {
  constructor(code: ErrorCode, message: string)
}

enum ErrorCode {
  InvalidRequest = "INVALID_REQUEST",
  MethodNotFound = "METHOD_NOT_FOUND",
  InvalidParams = "INVALID_PARAMS",
  InternalError = "INTERNAL_ERROR",
  NetworkError = "NETWORK_ERROR",
  ValidationError = "VALIDATION_ERROR",
  TimeoutError = "TIMEOUT_ERROR"
}
```

## Configuration

### Currency Configuration

```typescript
interface CurrencyConfig {
  [currency: string]: {
    type: "native" | "erc20"
    decimals: number
    minConfirmations: number
  }
}
```

### Migration Configuration

```typescript
interface MigrationConfig {
  version: number
  name: string
  up: (config: MigrationOptions) => Promise<void>
  down: () => Promise<void>
}
```

## Usage Examples

### Complete Payment Flow

```javascript
// Initialize services
const paymentFlow = new PaymentFlowService();
await paymentFlow.initialize();

// Process payment
const result = await paymentFlow.processPayment({
  id_invoice: "123",
  amount: 100,
  currency: "NIM"
});

// Monitor status
const status = await paymentFlow.getTransactionStatus(result.txId);
console.log("Payment status:", status);

// Handle events
window.addEventListener("nimipay:queue", (event) => {
  const { type, data } = event.detail;
  switch (type) {
    case "transaction:success":
      handleSuccess(data);
      break;
    case "transaction:failure":
      handleFailure(data);
      break;
  }
});
```

### Offline Support

```javascript
// Initialize state manager
const stateManager = new StateManager();

// Store transaction
await stateManager.storeTransaction("tx_123", {
  amount: 100,
  currency: "NIM"
});

// Check sync status
const syncStatus = stateManager.getSyncStatus();
if (syncStatus.pendingChanges.length > 0) {
  console.log("Pending changes:", syncStatus.pendingChanges);
}
```

### Migration Process

```javascript
// Initialize migration manager
const migrationManager = new MigrationManager();

// Run migrations
try {
  const result = await migrationManager.migrate({
    validateData: true,
    backupEnabled: true
  });
  console.log(`Migration completed: v${result.fromVersion} -> v${result.toVersion}`);
} catch (error) {
  console.error("Migration failed:", error);
  // Automatic rollback will occur
}
```

For more detailed examples and use cases, refer to the [Integration Guide](INTEGRATION_GUIDE.md).
