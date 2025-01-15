import NimiqNodeService from "../../src/services/NimiqNodeService";
import TransactionQueueService from "../../src/services/TransactionQueueService";
import StateManager from "../../src/services/StateManager";
import PaymentFlowService from "../../src/services/PaymentFlowService";
import MigrationManager from "../../src/services/MigrationManager";

describe("System Integration Tests", () => {
  let nimiqNode;
  let transactionQueue;
  let stateManager;
  let paymentFlow;
  let migrationManager;
  let performanceMetrics;

  beforeAll(async () => {
    // Initialize performance tracking
    performanceMetrics = {
      startTime: Date.now(),
      memoryUsage: [],
      transactionTimes: [],
      stateOperations: [],
      migrationDurations: []
    };

    // Track memory usage
    const trackMemory = () => {
      if (global.performance && performance.memory) {
        performanceMetrics.memoryUsage.push({
          timestamp: Date.now(),
          usage: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize
        });
      }
    };

    // Setup interval for memory tracking
    const memoryTracker = setInterval(trackMemory, 1000);
    
    // Initialize all services
    nimiqNode = new NimiqNodeService();
    transactionQueue = new TransactionQueueService();
    stateManager = new StateManager();
    paymentFlow = new PaymentFlowService();
    migrationManager = new MigrationManager();

    // Initialize browser node
    await nimiqNode.initialize();

    // Cleanup
    afterAll(() => {
      clearInterval(memoryTracker);
      // Log performance metrics
      console.log("Performance Metrics:", JSON.stringify(performanceMetrics, null, 2));
    });
  });

  describe("Core Integration", () => {
    it("should process complete payment flow with all components", async () => {
      const startTime = Date.now();
      
      // Setup test data
      const testInvoice = {
        id_invoice: `test-${Date.now()}`,
        amount: 100,
        currency: "NIM",
        recipient: "NQ07 0000 0000 0000 0000 0000 0000 0000"
      };

      // 1. Initialize payment flow
      await paymentFlow.initialize();
      expect(paymentFlow.initialized).toBe(true);

      // 2. Check balance
      const balance = await nimiqNode.getBalance(testInvoice.recipient);
      expect(typeof balance).toBe("number");

      // 3. Process payment
      const payment = await paymentFlow.processPayment(
        testInvoice,
        testInvoice.currency,
        testInvoice.amount
      );
      expect(payment.status).toBe("queued");

      // 4. Store transaction state
      await stateManager.storeTransaction(payment.txId, {
        type: "payment",
        status: payment.status,
        amount: testInvoice.amount,
        currency: testInvoice.currency
      });

      // Record transaction time
      performanceMetrics.transactionTimes.push({
        operation: "complete_flow",
        duration: Date.now() - startTime
      });
    });

    it("should handle offline capabilities", async () => {
      // Simulate offline mode
      global.navigator.onLine = false;
      
      const startTime = Date.now();
      
      // 1. Process offline transaction
      const offlinePayment = await paymentFlow.processPayment(
        {
          id_invoice: `offline-${Date.now()}`,
          amount: 50,
          currency: "NIM"
        },
        "NIM",
        50
      );
      
      // 2. Verify transaction queued
      const status = await transactionQueue.getTransactionStatus(offlinePayment.txId);
      expect(status.status).toBe("queued");
      
      // 3. Check state storage
      const storedState = await stateManager.getBalance("NIM", "test-address");
      expect(storedState.metadata.confidence).toBeLessThan(1);
      
      // Record metrics
      performanceMetrics.stateOperations.push({
        operation: "offline_flow",
        duration: Date.now() - startTime
      });
      
      // Restore online mode
      global.navigator.onLine = true;
    });

    it("should validate multi-currency support", async () => {
      const currencies = ["NIM", "BTC", "USDC"];
      const results = [];
      
      for (const currency of currencies) {
        const startTime = Date.now();
        
        // Process payment for each currency
        const payment = await paymentFlow.processPayment(
          {
            id_invoice: `${currency}-${Date.now()}`,
            amount: 100,
            currency
          },
          currency,
          100
        );
        
        results.push({
          currency,
          success: payment.txId !== undefined,
          duration: Date.now() - startTime
        });
      }
      
      // Verify all currencies processed
      expect(results.every(r => r.success)).toBe(true);
      
      // Record metrics
      performanceMetrics.transactionTimes.push(...results);
    });
  });

  describe("Migration Process", () => {
    it("should perform complete migration cycle", async () => {
      const startTime = Date.now();
      
      // 1. Create test data
      const testData = Array.from({ length: 100 }, (_, i) => ({
        [`tx${i}`]: {
          amount: i * 100,
          currency: "NIM",
          timestamp: Date.now()
        }
      })).reduce((acc, curr) => ({ ...acc, ...curr }), {});
      
      // 2. Store test data
      for (const [key, value] of Object.entries(testData)) {
        await stateManager.storeTransaction(key, value);
      }
      
      // 3. Run migration
      const migrationResult = await migrationManager.migrate({
        validateData: true,
        backupEnabled: true
      });
      
      expect(migrationResult.success).toBe(true);
      
      // 4. Verify migration
      const history = await migrationManager.getMigrationHistory();
      expect(history[history.length - 1].status).toBe("completed");
      
      // Record metrics
      performanceMetrics.migrationDurations.push({
        operation: "full_migration",
        duration: Date.now() - startTime,
        dataSize: Object.keys(testData).length
      });
    });
  });

  describe("Performance Benchmarks", () => {
    it("should handle high transaction volume", async () => {
      const batchSize = 100;
      const startTime = Date.now();
      const transactions = [];
      
      // Process multiple transactions in parallel
      for (let i = 0; i < batchSize; i++) {
        transactions.push(
          paymentFlow.processPayment(
            {
              id_invoice: `batch-${i}`,
              amount: 100,
              currency: "NIM"
            },
            "NIM",
            100
          )
        );
      }
      
      const results = await Promise.all(transactions);
      
      // Verify all transactions processed
      expect(results.length).toBe(batchSize);
      expect(results.every(r => r.txId)).toBe(true);
      
      // Record metrics
      performanceMetrics.transactionTimes.push({
        operation: "batch_processing",
        batchSize,
        duration: Date.now() - startTime,
        averageTime: (Date.now() - startTime) / batchSize
      });
    });

    it("should maintain performance under load", async () => {
      const iterations = 10;
      const results = [];
      
      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        
        // 1. Process transaction
        const payment = await paymentFlow.processPayment(
          {
            id_invoice: `perf-${i}`,
            amount: 100,
            currency: "NIM"
          },
          "NIM",
          100
        );
        
        // 2. Store state
        await stateManager.storeTransaction(payment.txId, {
          type: "payment",
          amount: 100,
          currency: "NIM"
        });
        
        // 3. Get balance
        await nimiqNode.getBalance("test-address");
        
        results.push({
          iteration: i,
          duration: Date.now() - startTime
        });
        
        // Small delay between iterations
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Calculate performance metrics
      const durations = results.map(r => r.duration);
      const averageDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const maxDuration = Math.max(...durations);
      
      // Record metrics
      performanceMetrics.stateOperations.push({
        operation: "sustained_load",
        iterations,
        averageDuration,
        maxDuration,
        variance: Math.variance(durations)
      });
      
      // Verify performance consistency
      expect(maxDuration - averageDuration).toBeLessThan(1000); // Max 1s deviation
    });
  });

  describe("System Health Checks", () => {
    it("should verify system integrity", async () => {
      // 1. Check all services initialized
      expect(nimiqNode.isReady()).toBe(true);
      expect(paymentFlow.initialized).toBe(true);
      
      // 2. Verify state consistency
      const isValid = await stateManager.validateLocalState();
      expect(isValid).toBe(true);
      
      // 3. Check migration status
      const migrationHistory = await migrationManager.getMigrationHistory();
      const incompleteMigrations = migrationHistory.filter(
        m => m.status !== "completed"
      );
      expect(incompleteMigrations.length).toBe(0);
      
      // 4. Verify queue health
      const queueStatus = await transactionQueue.getQueueStatus();
      expect(queueStatus.healthy).toBe(true);
    });

    it("should generate system health report", async () => {
      const report = {
        timestamp: Date.now(),
        services: {
          nimiqNode: await nimiqNode.getStatus(),
          paymentFlow: {
            initialized: paymentFlow.initialized,
            queueSize: (await transactionQueue.getQueueStatus()).size
          },
          stateManager: {
            valid: await stateManager.validateLocalState(),
            syncStatus: stateManager.getSyncStatus()
          },
          migrationManager: {
            version: await migrationManager.getCurrentVersion(),
            migrations: await migrationManager.getMigrationHistory()
          }
        },
        performance: {
          averageTransactionTime: calculateAverage(
            performanceMetrics.transactionTimes.map(t => t.duration)
          ),
          memoryUsage: performanceMetrics.memoryUsage.slice(-1)[0],
          migrationPerformance: calculateAverage(
            performanceMetrics.migrationDurations.map(m => m.duration)
          )
        }
      };
      
      // Log report
      console.log("System Health Report:", JSON.stringify(report, null, 2));
      
      // Verify critical metrics
      expect(report.services.nimiqNode.connected).toBe(true);
      expect(report.services.stateManager.valid).toBe(true);
      expect(report.performance.averageTransactionTime).toBeLessThan(5000); // Max 5s
    });
  });
});

// Utility function for calculating averages
function calculateAverage(numbers) {
  return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}
