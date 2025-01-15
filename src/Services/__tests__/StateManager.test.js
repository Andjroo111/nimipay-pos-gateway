import StateManager from "../StateManager";
import localforage from "localforage";

// Mock localforage
jest.mock("localforage", () => ({
  createInstance: jest.fn().mockReturnValue({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    iterate: jest.fn(),
    length: jest.fn()
  })
}));

describe("StateManager", () => {
  let stateManager;
  let mockStores;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup mock stores
    mockStores = {
      transactions: localforage.createInstance(),
      balances: localforage.createInstance(),
      metadata: localforage.createInstance(),
      sync: localforage.createInstance()
    };
    
    // Initialize service
    stateManager = new StateManager();
    
    // Mock window globals
    global.window = {
      addEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
      npBackendUrl: "https://api.example.com"
    };
    
    // Mock navigator
    global.navigator = {
      onLine: true,
      storage: {
        estimate: jest.fn().mockResolvedValue({
          usage: 85_000_000,
          quota: 100_000_000
        })
      }
    };

    // Mock fetch
    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ balance: 100 })
      })
    );
  });

  describe("Transaction Storage", () => {
    it("should store transaction with metadata", async () => {
      const txId = "test-tx-123";
      const txData = {
        type: "payment",
        amount: 100,
        currency: "NIM"
      };

      await stateManager.storeTransaction(txId, txData);
      
      expect(mockStores.transactions.setItem).toHaveBeenCalledWith(
        txId,
        expect.objectContaining({
          ...txData,
          metadata: expect.objectContaining({
            storedAt: expect.any(Number),
            deviceId: expect.any(String),
            version: expect.any(Number)
          })
        })
      );
    });

    it("should queue offline transactions for sync", async () => {
      global.navigator.onLine = false;
      const txId = "offline-tx-123";
      
      await stateManager.storeTransaction(txId, {});
      
      expect(mockStores.sync.setItem).toHaveBeenCalledWith(
        `tx_${txId}`,
        expect.objectContaining({
          type: "transaction",
          action: "store"
        })
      );
    });
  });

  describe("Balance Caching", () => {
    it("should cache balance with TTL", async () => {
      const currency = "NIM";
      const address = "test-address";
      const balance = 100;
      
      await stateManager.cacheBalance(currency, address, balance);
      
      expect(mockStores.balances.setItem).toHaveBeenCalledWith(
        `${currency}_${address}`,
        expect.objectContaining({
          balance,
          metadata: expect.objectContaining({
            validUntil: expect.any(Number),
            confidence: 1.0
          })
        })
      );
    });

    it("should handle stale balance data", async () => {
      const staleData = {
        balance: 100,
        timestamp: Date.now() - 10 * 60 * 1000, // 10 minutes old
        metadata: {
          validUntil: Date.now() - 5 * 60 * 1000 // Expired 5 minutes ago
        }
      };
      
      mockStores.balances.getItem.mockResolvedValueOnce(staleData);
      
      const result = await stateManager.getBalance("NIM", "test-address");
      
      expect(result.metadata.isStale).toBe(true);
      expect(result.metadata.confidence).toBeLessThan(1);
    });

    it("should refresh stale balances in background", async () => {
      const staleData = {
        balance: 100,
        timestamp: Date.now() - 10 * 60 * 1000,
        metadata: {
          validUntil: Date.now() - 5 * 60 * 1000
        }
      };
      
      mockStores.balances.getItem.mockResolvedValueOnce(staleData);
      
      await stateManager.getBalance("NIM", "test-address");
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("getBalance")
      );
    });
  });

  describe("Offline Support", () => {
    it("should handle going offline", async () => {
      await stateManager.handleOffline();
      
      expect(mockStores.metadata.setItem).toHaveBeenCalledWith(
        "offline_state",
        expect.objectContaining({
          timestamp: expect.any(Number),
          pendingChanges: expect.any(Array)
        })
      );
    });

    it("should extend cache TTL when going offline", async () => {
      mockStores.balances.iterate.mockImplementation((callback) => {
        callback(
          {
            metadata: { validUntil: Date.now() }
          },
          "test_key"
        );
      });
      
      await stateManager.handleOffline();
      
      expect(mockStores.balances.setItem).toHaveBeenCalled();
    });

    it("should sync pending changes when back online", async () => {
      const pendingChanges = [
        { key: "tx_1", type: "transaction" },
        { key: "tx_2", type: "balance" }
      ];
      
      mockStores.sync.iterate.mockImplementation((callback) => {
        pendingChanges.forEach(item => callback(item, item.key));
      });
      
      await stateManager.handleOnline();
      
      expect(mockStores.sync.removeItem).toHaveBeenCalledTimes(2);
    });
  });

  describe("Conflict Resolution", () => {
    it("should handle sync conflicts", async () => {
      const conflictItem = {
        key: "tx_conflict",
        data: { amount: 100 }
      };
      
      const error = {
        name: "ConflictError",
        remoteData: { amount: 200 }
      };
      
      await stateManager.handleSyncConflict(conflictItem, error);
      
      expect(mockStores.metadata.setItem).toHaveBeenCalledWith(
        `conflict_${conflictItem.key}`,
        expect.objectContaining({
          local: conflictItem.data,
          remote: error.remoteData,
          resolved: false
        })
      );
      
      expect(window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: {
            type: "sync:conflict"
          }
        })
      );
    });
  });

  describe("Storage Management", () => {
    it("should monitor storage quota", async () => {
      // Mock high storage usage
      navigator.storage.estimate.mockResolvedValueOnce({
        usage: 95_000_000, // 95%
        quota: 100_000_000
      });
      
      await stateManager.monitorStorageQuota();
      
      // Should trigger data pruning
      expect(mockStores.transactions.iterate).toHaveBeenCalled();
      expect(mockStores.balances.iterate).toHaveBeenCalled();
    });

    it("should prune old data", async () => {
      const oldData = {
        metadata: {
          storedAt: Date.now() - 48 * 60 * 60 * 1000 // 48 hours old
        }
      };
      
      mockStores.transactions.iterate.mockImplementation((callback) => {
        callback(oldData, "old_tx");
      });
      
      await stateManager.pruneOldData();
      
      expect(mockStores.transactions.removeItem).toHaveBeenCalled();
    });
  });

  describe("State Validation", () => {
    it("should validate local state", async () => {
      mockStores.transactions.length.mockResolvedValue(10);
      mockStores.balances.length.mockResolvedValue(5);
      
      mockStores.metadata.getItem.mockResolvedValue({
        pendingChanges: []
      });
      
      const isValid = await stateManager.validateLocalState();
      expect(isValid).toBe(true);
    });

    it("should detect metadata inconsistencies", async () => {
      mockStores.metadata.getItem.mockResolvedValue({
        pendingChanges: ["tx_1", "tx_2"]
      });
      
      // Add only one pending change to actual state
      stateManager.syncState.pendingChanges.add("tx_1");
      
      const isValid = await stateManager.validateLocalState();
      expect(isValid).toBe(true); // Still valid but will log warning
    });

    it("should detect invalid transaction metadata", async () => {
      mockStores.transactions.iterate.mockImplementation((callback) => {
        callback({ data: "invalid" }, "invalid_tx"); // Missing metadata
      });
      
      const isValid = await stateManager.validateLocalState();
      expect(isValid).toBe(false);
    });
  });

  describe("Sync Status", () => {
    it("should provide sync status", () => {
      stateManager.syncState.lastSync = Date.now();
      stateManager.syncState.pendingChanges.add("tx_1");
      stateManager.syncState.conflicts.set("tx_2", { resolved: false });
      
      const status = stateManager.getSyncStatus();
      
      expect(status).toEqual({
        lastSync: expect.any(Number),
        pendingChanges: ["tx_1"],
        conflicts: expect.any(Array),
        isOnline: true
      });
    });
  });
});
