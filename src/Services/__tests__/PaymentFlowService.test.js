import PaymentFlowService from "../PaymentFlowService";
import NimiqNodeService from "../NimiqNodeService";
import TransactionQueueService from "../TransactionQueueService";
import localforage from "localforage";

// Mock dependencies
jest.mock("../NimiqNodeService");
jest.mock("../TransactionQueueService");
jest.mock("localforage", () => ({
  createInstance: jest.fn().mockReturnValue({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn()
  })
}));

describe("PaymentFlowService", () => {
  let paymentFlow;
  let mockStore;
  let mockTransaction;
  let mockInvoice;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup mock storage
    mockStore = localforage.createInstance();
    
    // Initialize service
    paymentFlow = new PaymentFlowService();
    
    // Mock transaction data
    mockInvoice = {
      id_invoice: "test-123",
      value_usd: 100
    };
    
    mockTransaction = {
      type: "payment",
      currency: "NIM",
      amount: 100,
      invoice: mockInvoice,
      timestamp: Date.now()
    };

    // Mock window globals
    global.window = {
      addEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
      npBackendUrl: "https://api.example.com",
      nimAddress: "NQ07 0000 0000 0000 0000 0000 0000 0000",
      CURRENCY_CONFIG: {
        NIM: { type: "native", decimals: 4, minConfirmations: 2 },
        BTC: { type: "native", decimals: 8, minConfirmations: 3 },
        USDC: { type: "erc20", decimals: 6, minConfirmations: 12 }
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

  describe("Initialization", () => {
    it("should initialize services", async () => {
      await paymentFlow.initialize();
      
      expect(paymentFlow.nimiqNode.initialize).toHaveBeenCalled();
      expect(paymentFlow.transactionQueue.initializeQueue).toHaveBeenCalled();
      expect(paymentFlow.initialized).toBe(true);
    });

    it("should handle initialization errors", async () => {
      paymentFlow.nimiqNode.initialize.mockRejectedValueOnce(new Error("Init error"));
      
      await expect(paymentFlow.initialize()).rejects.toThrow("Init error");
      expect(paymentFlow.initialized).toBe(false);
    });
  });

  describe("Transaction Queue Integration", () => {
    beforeEach(async () => {
      await paymentFlow.initialize();
    });

    it("should queue new transactions", async () => {
      const mockTxId = "test-tx-id";
      paymentFlow.transactionQueue.queueTransaction.mockResolvedValueOnce(mockTxId);
      
      const result = await paymentFlow.processPayment(mockInvoice, "NIM", 100);
      
      expect(result).toEqual({
        txId: mockTxId,
        type: "native",
        status: "queued"
      });
      
      expect(paymentFlow.transactionQueue.queueTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "payment",
          currency: "NIM",
          amount: 100,
          invoice: mockInvoice
        })
      );
    });

    it("should handle queue events", async () => {
      // Mock event handlers
      jest.spyOn(paymentFlow, "handleTransactionSuccess");
      jest.spyOn(paymentFlow, "handleTransactionFailure");
      
      // Simulate queue events
      const successEvent = new CustomEvent("nimipay:queue", {
        detail: {
          type: "transaction:success",
          data: { txId: "success-tx", transaction: mockTransaction }
        }
      });
      
      const failureEvent = new CustomEvent("nimipay:queue", {
        detail: {
          type: "transaction:failure",
          data: { txId: "failed-tx", error: "Test error" }
        }
      });
      
      window.dispatchEvent(successEvent);
      window.dispatchEvent(failureEvent);
      
      expect(paymentFlow.handleTransactionSuccess).toHaveBeenCalled();
      expect(paymentFlow.handleTransactionFailure).toHaveBeenCalled();
    });
  });

  describe("Transaction Status Management", () => {
    beforeEach(async () => {
      await paymentFlow.initialize();
    });

    it("should handle successful transactions", async () => {
      const txId = "success-tx";
      await paymentFlow.handleTransactionSuccess({
        txId,
        transaction: mockTransaction
      });
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("updateStatus"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("confirmed")
        })
      );
      
      expect(mockStore.removeItem).toHaveBeenCalledWith(`tx_${txId}`);
    });

    it("should handle failed transactions", async () => {
      const txId = "failed-tx";
      const error = "Test error";
      
      paymentFlow.transactionQueue.getTransactionStatus.mockResolvedValueOnce({
        data: mockTransaction
      });
      
      await paymentFlow.handleTransactionFailure({
        txId,
        error,
        fatal: true
      });
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("updateStatus"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("failed")
        })
      );
      
      expect(mockStore.setItem).toHaveBeenCalledWith(
        `error_${txId}`,
        expect.objectContaining({
          message: error
        })
      );
    });

    it("should handle transaction retries", async () => {
      const txId = "retry-tx";
      
      paymentFlow.transactionQueue.getTransactionStatus.mockResolvedValueOnce({
        data: mockTransaction
      });
      
      await paymentFlow.handleTransactionRetry({
        txId,
        retries: 1,
        error: "Network error"
      });
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("updateStatus"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("retrying")
        })
      );
    });
  });

  describe("Error Handling", () => {
    beforeEach(async () => {
      await paymentFlow.initialize();
    });

    it("should handle validation errors", async () => {
      const txId = "validation-tx";
      const errors = ["Invalid amount", "Invalid address"];
      
      await paymentFlow.handleValidationError({
        txId,
        errors
      });
      
      expect(mockStore.setItem).toHaveBeenCalledWith(
        `validation_${txId}`,
        expect.objectContaining({
          errors
        })
      );
    });

    it("should handle insufficient funds", async () => {
      const txId = "insufficient-tx";
      
      await paymentFlow.handleInsufficientFunds({
        txId,
        required: 100,
        currency: "NIM"
      });
      
      expect(mockStore.setItem).toHaveBeenCalledWith(
        `insufficient_${txId}`,
        expect.objectContaining({
          required: 100,
          currency: "NIM"
        })
      );
    });

    it("should handle offline status updates", async () => {
      // Mock network failure
      fetch.mockRejectedValueOnce(new Error("Network error"));
      
      await paymentFlow.updateInvoiceStatus("test-123", "confirmed", "tx-123");
      
      expect(mockStore.setItem).toHaveBeenCalledWith(
        "status_update_test-123",
        expect.objectContaining({
          status: "confirmed",
          txId: "tx-123"
        })
      );
    });
  });

  describe("Multi-currency Support", () => {
    beforeEach(async () => {
      await paymentFlow.initialize();
    });

    it("should handle different currency types", async () => {
      // Test NIM (native)
      let result = await paymentFlow.processPayment(mockInvoice, "NIM", 100);
      expect(result.type).toBe("native");
      
      // Test USDC (erc20)
      result = await paymentFlow.processPayment(mockInvoice, "USDC", 100);
      expect(result.type).toBe("erc20");
      
      // Test unknown currency
      result = await paymentFlow.processPayment(mockInvoice, "UNKNOWN", 100);
      expect(result.type).toBe("unknown");
    });

    it("should use appropriate balance checking methods", async () => {
      // Test NIM balance (browser node)
      await paymentFlow.getBalance("NIM", "test-address");
      expect(paymentFlow.nimiqNode.getBalance).toHaveBeenCalled();
      
      // Test other currency balance (backend)
      await paymentFlow.getBalance("USDC", "test-address");
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("getBalance")
      );
    });
  });
});
