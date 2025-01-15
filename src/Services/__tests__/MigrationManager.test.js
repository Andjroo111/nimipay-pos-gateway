import MigrationManager from "../MigrationManager";
import localforage from "localforage";

// Mock localforage
jest.mock("localforage", () => ({
  createInstance: jest.fn().mockReturnValue({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    iterate: jest.fn(),
    clear: jest.fn(),
    keys: jest.fn()
  })
}));

describe("MigrationManager", () => {
  let migrationManager;
  let mockStores;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Setup mock stores
    mockStores = {
      migration: localforage.createInstance(),
      backup: localforage.createInstance()
    };
    
    // Initialize manager
    migrationManager = new MigrationManager();
    
    // Mock localStorage
    global.localStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn()
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("Migration Process", () => {
    it("should run migrations in sequence", async () => {
      mockStores.migration.getItem
        .mockResolvedValueOnce(0) // current_version
        .mockResolvedValueOnce(null); // No existing migration data
      
      const result = await migrationManager.migrate();
      
      expect(result).toEqual({
        success: true,
        fromVersion: 0,
        toVersion: 3,
        timestamp: expect.any(Number)
      });
      
      // Should create backup
      expect(mockStores.backup.setItem).toHaveBeenCalled();
      
      // Should update version
      expect(mockStores.migration.setItem).toHaveBeenCalledWith(
        "current_version",
        3
      );
    });

    it("should handle migration failures", async () => {
      // Mock migration failure
      mockStores.migration.getItem.mockResolvedValue(0);
      mockStores.migration.setItem.mockRejectedValueOnce(
        new Error("Migration failed")
      );
      
      await expect(migrationManager.migrate()).rejects.toThrow("Migration failed");
      
      // Should attempt restore
      expect(mockStores.backup.keys).toHaveBeenCalled();
    });

    it("should respect timeout configuration", async () => {
      mockStores.migration.getItem.mockResolvedValue(0);
      
      // Simulate slow migration
      mockStores.migration.iterate.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(resolve, 35000); // Longer than default timeout
        });
      });
      
      await expect(migrationManager.migrate()).rejects.toThrow("Migration timeout");
    });
  });

  describe("Backup Management", () => {
    it("should create backup before migration", async () => {
      const mockData = {
        transactions: { tx1: { amount: 100 } },
        balances: { bal1: { value: 200 } }
      };
      
      // Mock data iteration
      const mockIterate = (callback) => {
        Object.entries(mockData.transactions).forEach(([key, value]) => {
          callback(value, key);
        });
      };
      
      localforage.createInstance.mockReturnValue({
        ...mockStores.migration,
        iterate: jest.fn().mockImplementation(mockIterate)
      });
      
      await migrationManager.createBackup();
      
      expect(mockStores.backup.setItem).toHaveBeenCalledWith(
        expect.stringContaining("backup_"),
        expect.objectContaining({
          version: expect.any(Number),
          data: expect.any(Object)
        })
      );
    });

    it("should restore from latest backup", async () => {
      const mockBackup = {
        timestamp: Date.now(),
        version: 1,
        data: {
          transactions: { tx1: { amount: 100 } }
        }
      };
      
      mockStores.backup.keys.mockResolvedValue(["backup_1", "backup_2"]);
      mockStores.backup.getItem.mockResolvedValue(mockBackup);
      
      await migrationManager.restoreFromBackup();
      
      // Should clear and restore data
      expect(localforage.createInstance().clear).toHaveBeenCalled();
      expect(localforage.createInstance().setItem).toHaveBeenCalled();
      
      // Should restore version
      expect(mockStores.migration.setItem).toHaveBeenCalledWith(
        "current_version",
        mockBackup.version
      );
    });
  });

  describe("Schema Migration", () => {
    it("should initialize schema with versioning", async () => {
      const mockData = {
        tx1: { amount: 100 },
        tx2: { amount: 200 }
      };
      
      const mockIterate = (callback) => {
        Object.entries(mockData).forEach(([key, value]) => {
          callback(value, key);
        });
      };
      
      localforage.createInstance.mockReturnValue({
        ...mockStores.migration,
        iterate: jest.fn().mockImplementation(mockIterate)
      });
      
      await migrationManager.initializeSchema({ batchSize: 1 });
      
      expect(localforage.createInstance().setItem).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          schemaVersion: 1,
          updatedAt: expect.any(Number)
        })
      );
    });

    it("should validate schema migration", async () => {
      const mockValidData = {
        tx1: {
          amount: 100,
          schemaVersion: 1,
          updatedAt: Date.now()
        }
      };
      
      const mockIterate = (callback) => {
        Object.entries(mockValidData).forEach(([key, value]) => {
          callback(value, key);
        });
      };
      
      localforage.createInstance.mockReturnValue({
        ...mockStores.migration,
        iterate: jest.fn().mockImplementation(mockIterate)
      });
      
      const isValid = await migrationManager.validateSchema();
      expect(isValid).toBe(true);
    });
  });

  describe("Transaction Metadata", () => {
    it("should add metadata to transactions", async () => {
      const mockTransactions = {
        tx1: { amount: 100 },
        tx2: { amount: 200 }
      };
      
      const mockIterate = (callback) => {
        Object.entries(mockTransactions).forEach(([key, value]) => {
          callback(value, key);
        });
      };
      
      localforage.createInstance.mockReturnValue({
        ...mockStores.migration,
        iterate: jest.fn().mockImplementation(mockIterate)
      });
      
      await migrationManager.addTransactionMetadata({ batchSize: 1 });
      
      expect(localforage.createInstance().setItem).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          metadata: expect.objectContaining({
            migratedAt: expect.any(Number),
            deviceId: expect.any(String)
          }),
          schemaVersion: 2
        })
      );
    });
  });

  describe("User Preferences", () => {
    it("should migrate user preferences", async () => {
      const mockPrefs = {
        theme: "dark",
        currency: "USD"
      };
      
      localStorage.getItem.mockReturnValue(JSON.stringify(mockPrefs));
      
      await migrationManager.migrateUserPreferences();
      
      expect(localforage.createInstance().setItem).toHaveBeenCalledWith(
        "user_preferences",
        expect.objectContaining({
          ...mockPrefs,
          schemaVersion: 3
        })
      );
      
      // Should backup old prefs
      expect(localStorage.setItem).toHaveBeenCalledWith(
        "nimipay_preferences_backup",
        expect.any(String)
      );
    });

    it("should handle preference rollback", async () => {
      const mockPrefs = JSON.stringify({ theme: "dark" });
      localStorage.getItem.mockReturnValue(mockPrefs);
      
      await migrationManager.rollbackUserPreferences();
      
      expect(localStorage.setItem).toHaveBeenCalledWith(
        "nimipay_preferences",
        mockPrefs
      );
      
      expect(localforage.createInstance().removeItem).toHaveBeenCalledWith(
        "user_preferences"
      );
    });
  });

  describe("Performance Testing", () => {
    it("should handle large datasets efficiently", async () => {
      // Generate large dataset
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        [`tx${i}`]: { amount: i * 100 }
      })).reduce((acc, curr) => ({ ...acc, ...curr }), {});
      
      const mockIterate = (callback) => {
        Object.entries(largeDataset).forEach(([key, value]) => {
          callback(value, key);
        });
      };
      
      localforage.createInstance.mockReturnValue({
        ...mockStores.migration,
        iterate: jest.fn().mockImplementation(mockIterate)
      });
      
      const startTime = Date.now();
      await migrationManager.initializeSchema({ batchSize: 100 });
      const duration = Date.now() - startTime;
      
      // Should process within reasonable time
      expect(duration).toBeLessThan(5000);
      
      // Should process in batches
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Processed 100")
      );
    });
  });

  describe("Migration History", () => {
    it("should track migration history", async () => {
      const mockHistory = [
        {
          version: 1,
          status: "completed",
          timestamp: Date.now() - 1000
        },
        {
          version: 2,
          status: "completed",
          timestamp: Date.now()
        }
      ];
      
      const mockIterate = (callback) => {
        mockHistory.forEach(item => callback(item));
      };
      
      mockStores.migration.iterate.mockImplementation(mockIterate);
      
      const history = await migrationManager.getMigrationHistory();
      
      expect(history).toHaveLength(2);
      expect(history[0].version).toBeLessThan(history[1].version);
    });
  });

  describe("Backup Management", () => {
    it("should list available backups", async () => {
      const mockBackups = [
        {
          timestamp: Date.now() - 1000,
          version: 1
        },
        {
          timestamp: Date.now(),
          version: 2
        }
      ];
      
      const mockIterate = (callback) => {
        mockBackups.forEach(item => callback(item));
      };
      
      mockStores.backup.iterate.mockImplementation(mockIterate);
      
      const backups = await migrationManager.getAvailableBackups();
      
      expect(backups).toHaveLength(2);
      expect(backups[0].timestamp).toBeGreaterThan(backups[1].timestamp);
    });
  });
});
