import TransactionQueueService from "../TransactionQueueService";
import localforage from "localforage";

// Mock localforage
jest.mock("localforage", () => ({
  createInstance: jest.fn().mockReturnValue({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn()
  })
}));

describe("TransactionQueueService", () => {
  let queueService;
  let mockStore;
  let mockTransaction;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup mock storage
    mockStore = localforage.createInstance();
    
    // Initialize service
    queueService = new TransactionQueueService();
    
    // Mock transaction data
    mockTransaction = {
      type: "payment",
      currency: "NIM",
      amount: 100,
      recipient: "test-address",
      metadata: {
        invoiceId: "test-123"
      }
    };

    // Mock window events
    global.window = {
      addEventListener: jest.fn(),
      dispatchEvent: jest.fn()
    };
  });

  describe("Queue Management", () => {
    it("should queue new transaction", async () => {
      const txId = await queueService.queueTransaction(mockTransaction);
      
      expect(txId).toBeDefined();
      expect(mockStore.setItem).toHaveBeenCalledWith(
        "transaction-queue",
        expect.arrayContaining([
          expect.objectContaining({
            id: txId,
            data: mockTransaction,
            status: "pending"
          })
        ])
      );
    });

    it("should process queued transactions in order", async () => {
      const tx1 = { ...mockTransaction, amount: 100 };
      const tx2 = { ...mockTransaction, amount: 200 };
      
      await queueService.queueTransaction(tx1);
      await queueService.queueTransaction(tx2);
      
      expect(queueService.queue.length).toBe(2);
      expect(queueService.queue[0].data.amount).toBe(100);
      expect(queueService.queue[1].data.amount).toBe(200);
    });

    it("should resume processing from persistent storage", async () => {
      const storedQueue = [
        {
          id: "stored-tx-1",
          data: mockTransaction,
          status: "pending"
        }
      ];

      mockStore.getItem.mockResolvedValueOnce(storedQueue);
      
      const newService = new TransactionQueueService();
      await new Promise(resolve => setTimeout(resolve, 0)); // Let initialization complete
      
      expect(newService.queue).toEqual(storedQueue);
    });
  });

  describe("Retry Logic", () => {
    it("should retry failed transactions", async () => {
      const txId = await queueService.queueTransaction(mockTransaction);
      
      // Simulate network error
      const error = new Error("Network error");
      await queueService.handleFailedTransaction(
        queueService.queue[0],
        error
      );
      
      expect(queueService.queue[0].retries).toBe(1);
      expect(queueService.queue[0].error).toBe("Network error");
    });

    it("should respect max retry limits", async () => {
      const txId = await queueService.queueTransaction(mockTransaction);
      const tx = queueService.queue[0];
      
      // Simulate multiple failures
      for (let i = 0; i < 5; i++) {
        await queueService.handleFailedTransaction(
          { ...tx, retries: i },
          new Error("Network error")
        );
      }
      
      expect(mockStore.setItem).toHaveBeenCalledWith(
        `failed_${txId}`,
        expect.objectContaining({
          finalError: "Network error"
        })
      );
    });

    it("should handle different error types appropriately", async () => {
      const validationError = new Error("validation error");
      const insufficientError = new Error("insufficient funds");
      const timeoutError = new Error("timeout error");
      
      // Test validation error
      const strategy1 = queueService.getErrorStrategy(validationError);
      expect(strategy1.shouldRetry).toBe(false);
      
      // Test insufficient funds
      const strategy2 = queueService.getErrorStrategy(insufficientError);
      expect(strategy2.shouldRetry).toBe(false);
      
      // Test timeout
      const strategy3 = queueService.getErrorStrategy(timeoutError);
      expect(strategy3.shouldRetry).toBe(true);
      expect(strategy3.maxRetries).toBe(3);
    });
  });

  describe("Error Recovery", () => {
    it("should handle network errors with retry", async () => {
      const txId = await queueService.queueTransaction(mockTransaction);
      
      await queueService.handleNetworkError(queueService.queue[0]);
      
      expect(mockStore.setItem).toHaveBeenCalledWith(
        `retry_${txId}`,
        expect.objectContaining({
          retryAfter: expect.any(Number)
        })
      );
      
      expect(window.addEventListener).toHaveBeenCalledWith(
        "online",
        expect.any(Function)
      );
    });

    it("should handle validation errors with user feedback", async () => {
      const txId = await queueService.queueTransaction(mockTransaction);
      
      await queueService.handleValidationError(queueService.queue[0]);
      
      expect(mockStore.setItem).toHaveBeenCalledWith(
        `validation_${txId}`,
        expect.objectContaining({
          requiresUserAction: true
        })
      );
      
      expect(window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: {
            type: "transaction:validation"
          }
        })
      );
    });

    it("should handle insufficient funds with notification", async () => {
      const txId = await queueService.queueTransaction(mockTransaction);
      
      await queueService.handleInsufficientFunds(queueService.queue[0]);
      
      expect(mockStore.setItem).toHaveBeenCalledWith(
        `insufficient_${txId}`,
        expect.objectContaining({
          requiredAmount: mockTransaction.amount
        })
      );
      
      expect(window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: {
            type: "transaction:insufficient_funds"
          }
        })
      );
    });
  });

  describe("Transaction Status", () => {
    it("should track transaction status", async () => {
      const txId = await queueService.queueTransaction(mockTransaction);
      
      // Check queued status
      let status = await queueService.getTransactionStatus(txId);
      expect(status.status).toBe("queued");
      
      // Check completed status
      await queueService.handleSuccessfulTransaction(queueService.queue[0]);
      status = await queueService.getTransactionStatus(txId);
      expect(status.status).toBe("completed");
      
      // Check failed status
      await queueService.handleFailedTransaction(
        queueService.queue[0],
        new Error("Test error")
      );
      status = await queueService.getTransactionStatus(txId);
      expect(status.status).toBe("failed");
    });

    it("should provide detailed status information", async () => {
      const txId = await queueService.queueTransaction(mockTransaction);
      
      // Simulate retries
      queueService.queue[0].retries = 2;
      queueService.queue[0].error = "Network error";
      
      const status = await queueService.getTransactionStatus(txId);
      expect(status).toEqual({
        status: "queued",
        retries: 2,
        error: "Network error"
      });
    });
  });

  describe("Event Handling", () => {
    it("should emit appropriate events", async () => {
      const txId = await queueService.queueTransaction(mockTransaction);
      
      // Success event
      await queueService.handleSuccessfulTransaction(queueService.queue[0]);
      expect(window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: {
            type: "transaction:success",
            data: expect.objectContaining({
              txId
            })
          }
        })
      );
      
      // Retry event
      await queueService.handleFailedTransaction(
        { ...queueService.queue[0], retries: 1 },
        new Error("Network error")
      );
      expect(window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: {
            type: "transaction:retry"
          }
        })
      );
    });
  });
});
