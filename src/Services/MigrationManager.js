import localforage from "localforage";

/**
 * MigrationManager handles data migration and versioning
 */
class MigrationManager {
  constructor() {
    this.stores = {
      migration: localforage.createInstance({
        name: "nimipay-migration",
        storeName: "migration"
      }),
      backup: localforage.createInstance({
        name: "nimipay-backup",
        storeName: "backup"
      })
    };

    this.migrationConfig = {
      batchSize: 100,
      backupEnabled: true,
      validateData: true,
      retryAttempts: 3,
      timeout: 30000 // 30 seconds
    };

    this.migrations = [
      {
        version: 1,
        name: "Initialize Schema",
        up: this.initializeSchema.bind(this),
        down: this.rollbackSchema.bind(this)
      },
      {
        version: 2,
        name: "Add Transaction Metadata",
        up: this.addTransactionMetadata.bind(this),
        down: this.removeTransactionMetadata.bind(this)
      },
      {
        version: 3,
        name: "Migrate User Preferences",
        up: this.migrateUserPreferences.bind(this),
        down: this.rollbackUserPreferences.bind(this)
      }
    ];
  }

  /**
   * Start migration process
   * @param {Object} options Migration options
   * @returns {Promise<Object>} Migration result
   */
  async migrate(options = {}) {
    const config = { ...this.migrationConfig, ...options };
    const currentVersion = await this.getCurrentVersion();
    const targetVersion = this.migrations[this.migrations.length - 1].version;

    console.log(`Starting migration from v${currentVersion} to v${targetVersion}`);

    try {
      // Create backup if enabled
      if (config.backupEnabled) {
        await this.createBackup();
      }

      // Run migrations in sequence
      for (const migration of this.migrations) {
        if (migration.version > currentVersion) {
          await this.runMigration(migration, config);
        }
      }

      return {
        success: true,
        fromVersion: currentVersion,
        toVersion: targetVersion,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error("Migration failed:", error);
      if (config.backupEnabled) {
        await this.restoreFromBackup();
      }
      throw error;
    }
  }

  /**
   * Run single migration
   * @private
   */
  async runMigration(migration, config) {
    console.log(`Running migration: ${migration.name} (v${migration.version})`);

    const startTime = Date.now();
    const migrationData = {
      version: migration.version,
      name: migration.name,
      startTime,
      status: "running"
    };

    await this.stores.migration.setItem(
      `migration_${migration.version}`,
      migrationData
    );

    try {
      // Run migration with timeout
      await Promise.race([
        migration.up(config),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Migration timeout")),
            config.timeout
          )
        )
      ]);

      // Validate if enabled
      if (config.validateData) {
        const isValid = await this.validateMigration(migration);
        if (!isValid) {
          throw new Error("Migration validation failed");
        }
      }

      // Update migration record
      await this.stores.migration.setItem(
        `migration_${migration.version}`,
        {
          ...migrationData,
          status: "completed",
          endTime: Date.now(),
          duration: Date.now() - startTime
        }
      );

      // Update current version
      await this.stores.migration.setItem("current_version", migration.version);
    } catch (error) {
      // Mark migration as failed
      await this.stores.migration.setItem(
        `migration_${migration.version}`,
        {
          ...migrationData,
          status: "failed",
          error: error.message,
          endTime: Date.now()
        }
      );
      throw error;
    }
  }

  /**
   * Create data backup
   * @private
   */
  async createBackup() {
    console.log("Creating backup before migration");

    const backup = {
      timestamp: Date.now(),
      version: await this.getCurrentVersion(),
      data: {}
    };

    // Backup all stores
    const stores = ["transactions", "balances", "metadata", "sync"];
    for (const store of stores) {
      const storeInstance = localforage.createInstance({
        name: `nimipay-${store}`,
        storeName: store
      });

      backup.data[store] = {};
      await storeInstance.iterate((value, key) => {
        backup.data[store][key] = value;
      });
    }

    await this.stores.backup.setItem(
      `backup_${backup.timestamp}`,
      backup
    );

    return backup;
  }

  /**
   * Restore from backup
   * @private
   */
  async restoreFromBackup() {
    console.log("Restoring from backup");

    // Get latest backup
    const backups = await this.stores.backup.keys();
    const latestBackup = backups.sort().pop();
    
    if (!latestBackup) {
      throw new Error("No backup found");
    }

    const backup = await this.stores.backup.getItem(latestBackup);

    // Restore each store
    for (const [store, data] of Object.entries(backup.data)) {
      const storeInstance = localforage.createInstance({
        name: `nimipay-${store}`,
        storeName: store
      });

      // Clear existing data
      await storeInstance.clear();

      // Restore from backup
      for (const [key, value] of Object.entries(data)) {
        await storeInstance.setItem(key, value);
      }
    }

    // Restore version
    await this.stores.migration.setItem("current_version", backup.version);

    return backup;
  }

  /**
   * Get current schema version
   * @private
   */
  async getCurrentVersion() {
    const version = await this.stores.migration.getItem("current_version");
    return version || 0;
  }

  /**
   * Validate migration
   * @private
   */
  async validateMigration(migration) {
    try {
      switch (migration.version) {
        case 1:
          return await this.validateSchema();
        case 2:
          return await this.validateTransactionMetadata();
        case 3:
          return await this.validateUserPreferences();
        default:
          return true;
      }
    } catch (error) {
      console.error(`Validation failed for v${migration.version}:`, error);
      return false;
    }
  }

  /**
   * Initialize schema migration
   * @private
   */
  async initializeSchema({ batchSize }) {
    const stores = ["transactions", "balances", "metadata", "sync"];
    
    for (const store of stores) {
      const storeInstance = localforage.createInstance({
        name: `nimipay-${store}`,
        storeName: store
      });

      let processed = 0;
      await storeInstance.iterate(async (value, key) => {
        // Add schema version to each record
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
  }

  /**
   * Add transaction metadata migration
   * @private
   */
  async addTransactionMetadata({ batchSize }) {
    const store = localforage.createInstance({
      name: "nimipay-transactions",
      storeName: "transactions"
    });

    let processed = 0;
    await store.iterate(async (value, key) => {
      if (!value.metadata) {
        const updated = {
          ...value,
          metadata: {
            migratedAt: Date.now(),
            originalVersion: value.schemaVersion || 0,
            deviceId: await this.getDeviceId()
          },
          schemaVersion: 2
        };
        
        await store.setItem(key, updated);
      }
      
      processed++;
      if (processed % batchSize === 0) {
        console.log(`Processed ${processed} transactions`);
      }
    });
  }

  /**
   * Migrate user preferences
   * @private
   */
  async migrateUserPreferences() {
    const oldPrefs = localStorage.getItem("nimipay_preferences");
    if (oldPrefs) {
      try {
        const prefs = JSON.parse(oldPrefs);
        const store = localforage.createInstance({
          name: "nimipay-metadata",
          storeName: "metadata"
        });

        await store.setItem("user_preferences", {
          ...prefs,
          schemaVersion: 3,
          migratedAt: Date.now()
        });

        // Keep old prefs temporarily
        localStorage.setItem(
          "nimipay_preferences_backup",
          localStorage.getItem("nimipay_preferences")
        );
        localStorage.removeItem("nimipay_preferences");
      } catch (error) {
        console.error("Failed to migrate preferences:", error);
        throw error;
      }
    }
  }

  /**
   * Validate schema migration
   * @private
   */
  async validateSchema() {
    const stores = ["transactions", "balances", "metadata", "sync"];
    
    for (const store of stores) {
      const storeInstance = localforage.createInstance({
        name: `nimipay-${store}`,
        storeName: store
      });

      let isValid = true;
      await storeInstance.iterate((value) => {
        if (!value.schemaVersion || !value.updatedAt) {
          isValid = false;
          return false; // Stop iteration
        }
      });

      if (!isValid) {
        return false;
      }
    }

    return true;
  }

  /**
   * Validate transaction metadata
   * @private
   */
  async validateTransactionMetadata() {
    const store = localforage.createInstance({
      name: "nimipay-transactions",
      storeName: "transactions"
    });

    let isValid = true;
    await store.iterate((value) => {
      if (!value.metadata || !value.metadata.migratedAt) {
        isValid = false;
        return false; // Stop iteration
      }
    });

    return isValid;
  }

  /**
   * Validate user preferences
   * @private
   */
  async validateUserPreferences() {
    const store = localforage.createInstance({
      name: "nimipay-metadata",
      storeName: "metadata"
    });

    const prefs = await store.getItem("user_preferences");
    return prefs && prefs.schemaVersion === 3;
  }

  /**
   * Rollback schema migration
   * @private
   */
  async rollbackSchema() {
    const stores = ["transactions", "balances", "metadata", "sync"];
    
    for (const store of stores) {
      const storeInstance = localforage.createInstance({
        name: `nimipay-${store}`,
        storeName: store
      });

      await storeInstance.iterate(async (value, key) => {
        const { schemaVersion, updatedAt, ...original } = value;
        await storeInstance.setItem(key, original);
      });
    }
  }

  /**
   * Remove transaction metadata
   * @private
   */
  async removeTransactionMetadata() {
    const store = localforage.createInstance({
      name: "nimipay-transactions",
      storeName: "transactions"
    });

    await store.iterate(async (value, key) => {
      if (value.metadata) {
        const { metadata, ...original } = value;
        await store.setItem(key, original);
      }
    });
  }

  /**
   * Rollback user preferences
   * @private
   */
  async rollbackUserPreferences() {
    const oldPrefs = localStorage.getItem("nimipay_preferences_backup");
    if (oldPrefs) {
      localStorage.setItem("nimipay_preferences", oldPrefs);
      localStorage.removeItem("nimipay_preferences_backup");
    }

    const store = localforage.createInstance({
      name: "nimipay-metadata",
      storeName: "metadata"
    });

    await store.removeItem("user_preferences");
  }

  /**
   * Get device ID
   * @private
   */
  async getDeviceId() {
    const store = localforage.createInstance({
      name: "nimipay-metadata",
      storeName: "metadata"
    });

    let deviceId = await store.getItem("device_id");
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await store.setItem("device_id", deviceId);
    }
    return deviceId;
  }

  /**
   * Get migration history
   * @returns {Promise<Array>} Migration history
   */
  async getMigrationHistory() {
    const history = [];
    await this.stores.migration.iterate((value) => {
      history.push(value);
    });
    return history.sort((a, b) => a.version - b.version);
  }

  /**
   * Get available backups
   * @returns {Promise<Array>} Available backups
   */
  async getAvailableBackups() {
    const backups = [];
    await this.stores.backup.iterate((value) => {
      backups.push({
        timestamp: value.timestamp,
        version: value.version
      });
    });
    return backups.sort((a, b) => b.timestamp - a.timestamp);
  }
}

export default MigrationManager;
