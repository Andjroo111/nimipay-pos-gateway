# Migration Guide

This guide explains how to use the Migration Manager to handle data migrations and schema updates in NimiPay POS Gateway.

## Table of Contents

1. [Overview](#overview)
2. [Migration System](#migration-system)
3. [Creating Migrations](#creating-migrations)
4. [Running Migrations](#running-migrations)
5. [Rollback Procedures](#rollback-procedures)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)

## Overview

The Migration Manager provides a robust system for:
- Schema versioning
- Data migrations
- Automatic backups
- Rollback capabilities
- State validation

## Migration System

### Architecture

```
MigrationManager
├── Migrations
│   ├── Schema versioning
│   ├── Data transformations
│   └── Validation rules
├── Backup System
│   ├── Automatic backups
│   ├── Versioned storage
│   └── Restore capabilities
└── State Management
    ├── Version tracking
    ├── Migration history
    └── Health monitoring
```

### Data Stores

```javascript
const stores = {
  migration: localforage.createInstance({
    name: "nimipay-migration"
  }),
  backup: localforage.createInstance({
    name: "nimipay-backup"
  })
};
```

## Creating Migrations

### Migration Structure

```javascript
const migration = {
  version: 1,
  name: "Add Transaction Metadata",
  up: async (config) => {
    // Migration logic
  },
  down: async () => {
    // Rollback logic
  }
};
```

### Example Migrations

1. Schema Update
```javascript
{
  version: 1,
  name: "Initialize Schema",
  up: async ({ batchSize }) => {
    const stores = ["transactions", "balances"];
    
    for (const store of stores) {
      const storeInstance = localforage.createInstance({
        name: `nimipay-${store}`
      });

      let processed = 0;
      await storeInstance.iterate(async (value, key) => {
        // Add schema version
        const updated = {
          ...value,
          schemaVersion: 1,
          updatedAt: Date.now()
        };
        
        await storeInstance.setItem(key, updated);
        
        processed++;
        if (processed % batchSize === 0) {
          console.log(`Processed ${processed} items in ${store}`);
        }
      });
    }
  },
  down: async () => {
    // Remove schema versioning
    const stores = ["transactions", "balances"];
    
    for (const store of stores) {
      const storeInstance = localforage.createInstance({
        name: `nimipay-${store}`
      });

      await storeInstance.iterate(async (value, key) => {
        const { schemaVersion, updatedAt, ...original } = value;
        await storeInstance.setItem(key, original);
      });
    }
  }
}
```

2. Data Transformation
```javascript
{
  version: 2,
  name: "Add Transaction Metadata",
  up: async ({ batchSize }) => {
    const store = localforage.createInstance({
      name: "nimipay-transactions"
    });

    let processed = 0;
    await store.iterate(async (value, key) => {
      if (!value.metadata) {
        const updated = {
          ...value,
          metadata: {
            migratedAt: Date.now(),
            deviceId: await getDeviceId()
          }
        };
        
        await store.setItem(key, updated);
      }
      
      processed++;
      if (processed % batchSize === 0) {
        console.log(`Processed ${processed} transactions`);
      }
    });
  },
  down: async () => {
    const store = localforage.createInstance({
      name: "nimipay-transactions"
    });

    await store.iterate(async (value, key) => {
      if (value.metadata) {
        const { metadata, ...original } = value;
        await store.setItem(key, original);
      }
    });
  }
}
```

## Running Migrations

### Basic Usage

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

### Configuration Options

```javascript
const options = {
  batchSize: 100,        // Items per batch
  backupEnabled: true,   // Create backup before migration
  validateData: true,    // Validate after migration
  retryAttempts: 3,     // Retry failed migrations
  timeout: 30000        // Timeout in milliseconds
};

await migrationManager.migrate(options);
```

## Rollback Procedures

### Automatic Rollback

```javascript
try {
  await migrationManager.migrate();
} catch (error) {
  // Migration failed - automatic rollback will occur
  console.error("Migration failed:", error);
  
  // Get rollback status
  const backups = await migrationManager.getAvailableBackups();
  console.log("Available backups:", backups);
}
```

### Manual Rollback

```javascript
// Get migration history
const history = await migrationManager.getMigrationHistory();
const lastMigration = history[history.length - 1];

if (lastMigration.status === "failed") {
  // Restore from backup
  await migrationManager.restoreFromBackup();
  
  // Verify restoration
  const currentVersion = await migrationManager.getCurrentVersion();
  console.log("Rolled back to version:", currentVersion);
}
```

## Best Practices

### 1. Backup Strategy

```javascript
// Always enable backups for production
const productionConfig = {
  backupEnabled: true,
  validateData: true
};

// Optional for development
const developmentConfig = {
  backupEnabled: process.env.NODE_ENV === 'production',
  validateData: true
};
```

### 2. Validation

```javascript
// Validate before migration
const isValid = await migrationManager.validateLocalState();
if (!isValid) {
  console.error("Invalid state detected");
  return;
}

// Run migration with validation
await migrationManager.migrate({ validateData: true });

// Validate after migration
const postMigrationValid = await migrationManager.validateLocalState();
if (!postMigrationValid) {
  console.error("Migration validation failed");
}
```

### 3. Performance Optimization

```javascript
// Adjust batch size based on data volume
const batchSize = dataVolume > 10000 ? 50 : 100;

// Configure timeout based on operation
const timeout = operation === "complex" ? 60000 : 30000;

await migrationManager.migrate({
  batchSize,
  timeout,
  validateData: true
});
```

## Troubleshooting

### Common Issues

1. Migration Timeout
```javascript
try {
  await migrationManager.migrate({
    timeout: 60000 // Increase timeout for large datasets
  });
} catch (error) {
  if (error.message.includes("timeout")) {
    console.error("Migration timeout - adjust batch size or timeout");
  }
}
```

2. Validation Failures
```javascript
// Check specific validation issues
const validateMigration = async (migration) => {
  try {
    const isValid = await migrationManager.validateMigration(migration);
    if (!isValid) {
      const history = await migrationManager.getMigrationHistory();
      const failureDetails = history.find(m => m.version === migration.version);
      console.error("Validation failed:", failureDetails);
    }
    return isValid;
  } catch (error) {
    console.error("Validation error:", error);
    return false;
  }
};
```

3. Storage Issues
```javascript
// Monitor storage usage
const checkStorage = async () => {
  if (navigator.storage && navigator.storage.estimate) {
    const { usage, quota } = await navigator.storage.estimate();
    const usagePercent = (usage / quota) * 100;
    
    if (usagePercent > 90) {
      console.warn("Storage usage high:", usagePercent.toFixed(2) + "%");
      // Consider cleanup
      await migrationManager.pruneOldData();
    }
  }
};
```

### Error Recovery

```javascript
const performMigrationWithRecovery = async () => {
  try {
    // Attempt migration
    await migrationManager.migrate();
  } catch (error) {
    // Check error type
    if (error.code === "VALIDATION_ERROR") {
      // Attempt recovery
      await handleValidationError(error);
    } else if (error.code === "STORAGE_ERROR") {
      // Handle storage issues
      await handleStorageError(error);
    } else {
      // Unknown error - rollback
      await migrationManager.restoreFromBackup();
      throw error;
    }
  }
};
```

For more detailed API documentation, refer to the [API Reference](API_REFERENCE.md).
