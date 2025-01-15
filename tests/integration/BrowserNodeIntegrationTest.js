import PaymentFlowService from "../../src/services/PaymentFlowService";
import NimiqNodeService from "../../src/services/NimiqNodeService";
import localforage from "localforage";

describe("Browser Node Integration", () => {
  let paymentFlow;
  let mockInvoice;
  let mockWindow;

  beforeAll(() => {
    // Mock browser APIs
    global.fetch = jest.fn();
    global.localStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn()
    };

    // Mock window globals
    mockWindow = {
      npBackendUrl: "https://api.example.com",
      nimAddress: "NQ07 0000 0000 0000 0000 0000 0000 0000",
      CURRENCY_CONFIG: {
        NIM: {
          minConfirmations: 2,
          decimals: 4,
          type: "native"
        }
      }
    };
    global.window = mockWindow;
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Initialize services
    paymentFlow = new PaymentFlowService();
    await paymentFlow.initialize();
    
    // Mock invoice data
    mockInvoice = {
      id_invoice: "test-123",
      value_usd: 100,
      created_at: Date.now()
    };
  });

  describe("Complete Payment Flow", () => {
    it("should process NIM payment end-to-end", async () => {
      // Mock exchange rate
      fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ rate: 0.5 }) // 1 NIM = $0.50
      });

      // Setup balance check
      jest.spyOn(paymentFlow.nimiqNode, "getBalance")
        .mockResolvedValue(1000); // 1000 NIM available

      // Setup transaction processing
      const mockTxHash = "test-transaction-hash";
      jest.spyOn(paymentFlow.nimiqNode, "processTransaction")
        .mockResolvedValue({ hash: mockTxHash });

      // Setup transaction verification
      jest.spyOn(paymentFlow.nimiqNode, "verifyTransaction")
        .mockResolvedValueOnce({
          confirmations: 1,
          sender: "sender-address",
          recipient: mockWindow.nimAddress,
          value: 200, // 200 NIM ($100 worth)
          timestamp: Date.now()
        })
        .mockResolvedValueOnce({
          confirmations: 2,
          sender: "sender-address",
          recipient: mockWindow.nimAddress,
          value: 200,
          timestamp: Date.now()
        });

      // Test complete payment flow
      try {
        // 1. Get balance
        const balance = await paymentFlow.getBalance("NIM", "test-address");
        expect(balance).toBe(1000);

        // 2. Process payment
        const paymentResult = await paymentFlow.processPayment(mockInvoice, "NIM", 200);
        expect(paymentResult.type).toBe("native");
        expect(paymentResult.hash).toBe(mockTxHash);

        // 3. Monitor transaction
        const confirmation = await paymentFlow.monitorTransaction(mockTxHash, mockInvoice.id_invoice, "NIM");
        expect(confirmation.confirmations).toBeGreaterThanOrEqual(2);
        expect(confirmation.status).toBe("confirmed");

        // 4. Verify offline storage
        const storedTx = await localforage.createInstance().getItem(`tx_${mockInvoice.id_invoice}`);
        expect(storedTx).toBeDefined();
        expect(storedTx.status).toBe("confirmed");
      } catch (error) {
        fail(`Payment flow failed: ${error.message}`);
      }
    });

    it("should handle network failures gracefully", async () => {
      // Mock network failure
      jest.spyOn(paymentFlow.nimiqNode, "processTransaction")
        .mockRejectedValue(new Error("Network error"));

      try {
        await paymentFlow.processPayment(mockInvoice, "NIM", 200);
        fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).toBe("Network error");
        
        // Verify error was stored offline
        const storedTx = await localforage.createInstance().getItem(`tx_${mockInvoice.id_invoice}`);
        expect(storedTx.status).toBe("failed");
        expect(storedTx.error).toBe("Network error");
      }
    });

    it("should maintain multi-currency support", async () => {
      // Test BTC payment flow
      const btcResult = await paymentFlow.processPayment(mockInvoice, "BTC", 0.005);
      expect(btcResult.type).toBe("address");
      expect(btcResult.currency).toBe("BTC");

      // Test USDC payment flow
      const usdcResult = await paymentFlow.processPayment(mockInvoice, "USDC", 100);
      expect(usdcResult.type).toBe("erc20");
      expect(usdcResult.currency).toBe("USDC");

      // Test UST payment flow
      const ustResult = await paymentFlow.processPayment(mockInvoice, "UST", 100);
      expect(ustResult.type).toBe("terra");
      expect(ustResult.currency).toBe("UST");
    });
  });

  describe("Offline Capabilities", () => {
    it("should work offline for NIM operations", async () => {
      // Mock offline state
      fetch.mockRejectedValue(new Error("Network offline"));

      // Setup cached data
      const mockOfflineStore = localforage.createInstance();
      await mockOfflineStore.setItem("balance_NIM_test-address", {
        amount: 500,
        timestamp: Date.now()
      });

      // Should use cached balance
      const balance = await paymentFlow.getBalance("NIM", "test-address");
      expect(balance).toBe(500);

      // Should store pending transaction
      jest.spyOn(paymentFlow.nimiqNode, "processTransaction")
        .mockResolvedValue({ hash: "offline-tx-hash" });

      await paymentFlow.processPayment(mockInvoice, "NIM", 100);

      const storedTx = await mockOfflineStore.getItem(`tx_${mockInvoice.id_invoice}`);
      expect(storedTx).toBeDefined();
      expect(storedTx.status).toBe("pending");
    });

    it("should sync when back online", async () => {
      // Setup pending transaction
      const mockOfflineStore = localforage.createInstance();
      await mockOfflineStore.setItem(`tx_${mockInvoice.id_invoice}`, {
        status: "pending",
        hash: "pending-tx-hash",
        amount: 100,
        timestamp: Date.now()
      });

      // Mock coming back online
      fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ confirmations: 2, status: "confirmed" })
      });

      // Should update transaction status
      const confirmation = await paymentFlow.monitorTransaction(
        "pending-tx-hash",
        mockInvoice.id_invoice,
        "NIM"
      );

      expect(confirmation.status).toBe("confirmed");
      
      const updatedTx = await mockOfflineStore.getItem(`tx_${mockInvoice.id_invoice}`);
      expect(updatedTx.status).toBe("confirmed");
    });
  });

  describe("Error Handling", () => {
    it("should handle insufficient balance", async () => {
      jest.spyOn(paymentFlow.nimiqNode, "getBalance")
        .mockResolvedValue(50); // Only 50 NIM available

      try {
        await paymentFlow.processPayment(mockInvoice, "NIM", 100);
        fail("Should have thrown insufficient balance error");
      } catch (error) {
        expect(error.message).toContain("Insufficient balance");
      }
    });

    it("should handle invalid transactions", async () => {
      jest.spyOn(paymentFlow.nimiqNode, "processTransaction")
        .mockResolvedValue({ hash: "invalid-tx-hash" });

      jest.spyOn(paymentFlow.nimiqNode, "verifyTransaction")
        .mockRejectedValue(new Error("Invalid transaction"));

      try {
        await paymentFlow.processPayment(mockInvoice, "NIM", 100);
        fail("Should have thrown transaction validation error");
      } catch (error) {
        expect(error.message).toContain("Invalid transaction");
      }
    });

    it("should handle initialization failures", async () => {
      const failingPaymentFlow = new PaymentFlowService();
      jest.spyOn(failingPaymentFlow.nimiqNode, "initialize")
        .mockRejectedValue(new Error("Initialization failed"));

      try {
        await failingPaymentFlow.initialize();
        fail("Should have thrown initialization error");
      } catch (error) {
        expect(error.message).toContain("Initialization failed");
        expect(failingPaymentFlow.initialized).toBe(false);
      }
    });
  });
});
