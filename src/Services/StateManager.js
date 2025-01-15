import localforage from "localforage";

/**
 * StateManager handles enhanced state management and offline capabilities
 */
class StateManager {
  constructor() {
    // Initialize storage instances for different data types
    this.stores = {
      transactions: localforage.createInstance({
        name: "nimipay-transactions",
        storeName: "transactions"
      }),
      balances: localforage.createInstance({
        name: "nimipay-balances",
        storeName: "balances"
      }),
      metadata: localforage.createInstance({
        name: "nimipay-metadata",
        storeName: "metadata"
      }),
      sync: localforage.createInstance({
        name: "nimipay-sync",
        storeName: "sync"
      })
    };

    // Cache configuration
    this.cacheConfig = {
      balance: {
        ttl: 5 * 60 * 1000, // 5 minutes
        staleWhileRevalidate: true
      },
      transaction: {
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        pruneInterval: 60 * 60 * 1000 // 1 hour
      }
    };

    // Initialize sync state
    this.syncState = {
      lastSync: null,
      pendingChanges: new Set(),
      conflicts: new Map()
    };

    // Setup event listeners
    this.setupEventListeners();
  }

  /**
   * Setup network and storage event listeners
   * @private
   */
  setupEventListeners() {
    // Network status listeners
    window.addEventListener("online", () => this.handleOnline());
    window.addEventListener("offline", () => this.handleOffline());

    // Storage quota monitoring
    if (navigator.storage && navigator.storage.estimate) {
      setInterval(() => this.monitorStorageQuota(), 15 * 60 * 1000); // Check every 15 minutes
    }
  }

  /**
   * Store transaction with enhanced metadata
   * @param {string} txId Transaction ID
   * @param {Object} data Transaction data
   */
  async storeTransaction(txId, data) {
    const transaction = {
      ...data,
      metadata: {
        storedAt: Date.now(),
        deviceId: await this.getDeviceId(),
        version: await this.getLocalVersion(),
        networkStatus: navigator.onLine ? "online" : "offline"
      }
    };

    await this.stores.transactions.setItem(txId, transaction);
    this.syncState.pendingChanges.add(txId);

    // Store in sync queue if offline
    if (!navigator.onLine) {
      await this.stores.sync.setItem(`tx_${txId}`, {
        type: "transaction",
        action: "store",
        data: transaction,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Cache balance with validation and TTL
   * @param {string} currency Currency code
   * @param {string} address Wallet address
   * @param {number} balance Balance amount
   */
  async cacheBalance(currency, address, balance) {
    const key = `${currency}_${address}`;
    const cachedData = {
      balance,
      timestamp: Date.now(),
      metadata: {
        source: "direct",
        confidence: 1.0,
        validUntil: Date.now() + this.cacheConfig.balance.ttl
      }
    };

    await this.stores.balances.setItem(key, cachedData);
  }

  /**
   * Get cached balance with validation
   * @param {string} currency Currency code
   * @param {string} address Wallet address
   * @returns {Promise<Object>} Balance data with metadata
   */
  async getBalance(currency, address) {
    const key = `${currency}_${address}`;
    const cached = await this.stores.balances.getItem(key);

    if (!cached) {
      return null;
    }

    const now = Date.now();
    const isStale = now > cached.metadata.validUntil;

    // Handle stale data
    if (isStale && this.cacheConfig.balance.staleWhileRevalidate) {
      // Trigger background refresh
      this.refreshBalance(currency, address).catch(console.error);
      // Return stale data with reduced confidence
      return {
        ...cached,
        metadata: {
          ...cached.metadata,
          confidence: 0.5,
          isStale: true
        }
      };
    }

    return isStale ? null : cached;
  }

  /**
   * Refresh balance in background
   * @private
   */
  async refreshBalance(currency, address) {
    try {
      // Implement actual balance refresh logic
      const response = await fetch(
        `${window.npBackendUrl}?action=getBalance&currency=${currency}&address=${address}`
      );
      const data = await response.json();
      
      await this.cacheBalance(currency, address, data.balance);
    } catch (error) {
      console.error("Balance refresh failed:", error);
    }
  }

  /**
   * Handle online status
   * @private
   */
  async handleOnline() {
    console.log("Network online - starting sync");
    await this.syncPendingChanges();
  }

  /**
   * Handle offline status
   * @private
   */
  async handleOffline() {
    console.log("Network offline - enabling offline mode");
    await this.prepareOfflineMode();
  }

  /**
   * Sync pending changes
   * @private
   */
  async syncPendingChanges() {
    const pendingSync = await this.stores.sync.iterate((value, key) => ({
      key,
      ...value
    }));

    for (const item of pendingSync) {
      try {
        await this.processSyncItem(item);
        await this.stores.sync.removeItem(item.key);
        this.syncState.pendingChanges.delete(item.key);
      } catch (error) {
        if (error.name === "ConflictError") {
          await this.handleSyncConflict(item, error);
        } else {
          console.error(`Sync failed for ${item.key}:`, error);
        }
      }
    }

    this.syncState.lastSync = Date.now();
  }

  /**
   * Process sync item
   * @private
   */
  async processSyncItem(item) {
    switch (item.type) {
      case "transaction":
        await this.syncTransaction(item);
        break;
      case "balance":
        await this.syncBalance(item);
        break;
      default:
        console.warn(`Unknown sync item type: ${item.type}`);
    }
  }

  /**
   * Handle sync conflict
   * @private
   */
  async handleSyncConflict(item, error) {
    const conflict = {
      local: item.data,
      remote: error.remoteData,
      timestamp: Date.now(),
      resolved: false
    };

    this.syncState.conflicts.set(item.key, conflict);

    // Store conflict for later resolution
    await this.stores.metadata.setItem(`conflict_${item.key}`, conflict);

    // Emit conflict event
    window.dispatchEvent(
      new CustomEvent("nimipay:state", {
        detail: {
          type: "sync:conflict",
          data: {
            key: item.key,
            conflict
          }
        }
      })
    );
  }

  /**
   * Prepare for offline mode
   * @private
   */
  async prepareOfflineMode() {
    // Store current state
    await this.stores.metadata.setItem("offline_state", {
      timestamp: Date.now(),
      pendingChanges: Array.from(this.syncState.pendingChanges),
      balanceCache: await this.getBalanceCacheState()
    });

    // Extend TTL for cached data
    await this.extendCacheTTL();
  }

  /**
   * Extend cache TTL for offline mode
   * @private
   */
  async extendCacheTTL() {
    const extension = 24 * 60 * 60 * 1000; // 24 hours
    
    await this.stores.balances.iterate((value, key) => {
      value.metadata.validUntil += extension;
      return this.stores.balances.setItem(key, value);
    });
  }

  /**
   * Monitor storage quota
   * @private
   */
  async monitorStorageQuota() {
    try {
      const { usage, quota } = await navigator.storage.estimate();
      const usagePercent = (usage / quota) * 100;

      if (usagePercent > 90) {
        await this.pruneOldData();
      }
    } catch (error) {
      console.error("Storage quota check failed:", error);
    }
  }

  /**
   * Prune old data
   * @private
   */
  async pruneOldData() {
    const now = Date.now();
    const maxAge = this.cacheConfig.transaction.maxAge;

    // Prune old transactions
    await this.stores.transactions.iterate((value, key) => {
      if (now - value.metadata.storedAt > maxAge) {
        return this.stores.transactions.removeItem(key);
      }
    });

    // Prune expired balance cache
    await this.stores.balances.iterate((value, key) => {
      if (now > value.metadata.validUntil && !value.metadata.isStale) {
        return this.stores.balances.removeItem(key);
      }
    });
  }

  /**
   * Get device ID for sync
   * @private
   */
  async getDeviceId() {
    let deviceId = await this.stores.metadata.getItem("device_id");
    
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await this.stores.metadata.setItem("device_id", deviceId);
    }
    
    return deviceId;
  }

  /**
   * Get local version for sync
   * @private
   */
  async getLocalVersion() {
    let version = await this.stores.metadata.getItem("local_version");
    
    if (!version) {
      version = 1;
    } else {
      version++;
    }
    
    await this.stores.metadata.setItem("local_version", version);
    return version;
  }

  /**
   * Get balance cache state
   * @private
   */
  async getBalanceCacheState() {
    const cacheState = {};
    
    await this.stores.balances.iterate((value, key) => {
      cacheState[key] = {
        timestamp: value.timestamp,
        validUntil: value.metadata.validUntil,
        confidence: value.metadata.confidence
      };
    });
    
    return cacheState;
  }

  /**
   * Validate local state
   * @returns {Promise<boolean>} Validation result
   */
  async validateLocalState() {
    try {
      // Check data integrity
      const [txCount, balanceCount] = await Promise.all([
        this.stores.transactions.length(),
        this.stores.balances.length()
      ]);

      // Check metadata consistency
      const metadata = await this.stores.metadata.getItem("offline_state");
      if (metadata) {
        const pendingChanges = metadata.pendingChanges.length;
        const storedChanges = this.syncState.pendingChanges.size;
        
        if (pendingChanges !== storedChanges) {
          console.warn("Pending changes mismatch:", { pendingChanges, storedChanges });
        }
      }

      // Validate transaction references
      let valid = true;
      await this.stores.transactions.iterate((value, key) => {
        if (!value.metadata || !value.metadata.version) {
          console.warn(`Invalid transaction metadata for ${key}`);
          valid = false;
        }
      });

      return valid;
    } catch (error) {
      console.error("State validation failed:", error);
      return false;
    }
  }

  /**
   * Get sync status
   * @returns {Object} Sync status
   */
  getSyncStatus() {
    return {
      lastSync: this.syncState.lastSync,
      pendingChanges: Array.from(this.syncState.pendingChanges),
      conflicts: Array.from(this.syncState.conflicts.entries()),
      isOnline: navigator.onLine
    };
  }
}

export default StateManager;
