import PaymentFlowService from "../../src/services/PaymentFlowService";
import NimiqNodeService from "../../src/services/NimiqNodeService";

describe("Platform Integration Verification", () => {
  let paymentFlow;
  let mockInvoice;

  beforeEach(async () => {
    paymentFlow = new PaymentFlowService();
    await paymentFlow.initialize();

    mockInvoice = {
      id_invoice: "test-123",
      value_usd: 100,
      created_at: Date.now()
    };

    // Mock global window object
    global.window = {
      npBackendUrl: "https://api.example.com",
      nimAddress: "NQ07 0000 0000 0000 0000 0000 0000 0000",
      CURRENCY_CONFIG: {
        NIM: { minConfirmations: 2, decimals: 4, type: "native" },
        BTC: { minConfirmations: 3, decimals: 8, type: "native" },
        USDC: { minConfirmations: 12, decimals: 6, type: "erc20" },
        UST: { minConfirmations: 15, decimals: 6, type: "terra" }
      }
    };
  });

  describe("WordPress Integration", () => {
    beforeEach(() => {
      // Mock WordPress specific globals
      global.wp = {
        ajax: {
          post: jest.fn()
        }
      };
    });

    it("should handle WordPress payment flow", async () => {
      const wpNonce = "wp-nonce-123";
      const orderId = "wp-order-123";

      // Mock WordPress AJAX response
      global.wp.ajax.post.mockResolvedValue({
        success: true,
        data: { order_id: orderId }
      });

      // Test WordPress specific payment flow
      const result = await paymentFlow.processPayment(
        { ...mockInvoice, wp_nonce: wpNonce },
        "NIM",
        100
      );

      expect(result.type).toBe("native");
      expect(global.wp.ajax.post).toHaveBeenCalledWith({
        action: "nimipay_process_payment",
        nonce: wpNonce,
        order_id: orderId
      });
    });

    it("should handle WooCommerce order status updates", async () => {
      const mockTxHash = "test-tx-hash";
      jest.spyOn(paymentFlow.nimiqNode, "processTransaction")
        .mockResolvedValue({ hash: mockTxHash });

      const result = await paymentFlow.processPayment(
        { ...mockInvoice, platform: "wordpress" },
        "NIM",
        100
      );

      expect(result.hash).toBe(mockTxHash);
      expect(global.wp.ajax.post).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "nimipay_update_order_status"
        })
      );
    });
  });

  describe("Wix Integration", () => {
    beforeEach(() => {
      // Mock Wix SDK
      global.wixSdk = {
        payments: {
          startPayment: jest.fn(),
          completePayment: jest.fn()
        }
      };
    });

    it("should integrate with Wix payment flow", async () => {
      const wixOrderId = "wix-order-123";
      global.wixSdk.payments.startPayment.mockResolvedValue({
        orderId: wixOrderId
      });

      const result = await paymentFlow.processPayment(
        { ...mockInvoice, platform: "wix" },
        "NIM",
        100
      );

      expect(result.type).toBe("native");
      expect(global.wixSdk.payments.startPayment).toHaveBeenCalled();
    });

    it("should handle Wix payment status updates", async () => {
      const mockTxHash = "test-tx-hash";
      jest.spyOn(paymentFlow.nimiqNode, "processTransaction")
        .mockResolvedValue({ hash: mockTxHash });

      await paymentFlow.processPayment(
        { ...mockInvoice, platform: "wix" },
        "NIM",
        100
      );

      expect(global.wixSdk.payments.completePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "PAID"
        })
      );
    });
  });

  describe("Squarespace Integration", () => {
    beforeEach(() => {
      // Mock Squarespace Commerce API
      global.Squarespace = {
        onCommerceStarted: jest.fn(),
        commerce: {
          updateOrder: jest.fn()
        }
      };
    });

    it("should integrate with Squarespace checkout", async () => {
      const result = await paymentFlow.processPayment(
        { ...mockInvoice, platform: "squarespace" },
        "NIM",
        100
      );

      expect(result.type).toBe("native");
      expect(global.Squarespace.commerce.updateOrder).toHaveBeenCalled();
    });

    it("should handle Squarespace order updates", async () => {
      const mockTxHash = "test-tx-hash";
      jest.spyOn(paymentFlow.nimiqNode, "processTransaction")
        .mockResolvedValue({ hash: mockTxHash });

      await paymentFlow.processPayment(
        { ...mockInvoice, platform: "squarespace" },
        "NIM",
        100
      );

      expect(global.Squarespace.commerce.updateOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "PAID",
          transactionId: mockTxHash
        })
      );
    });
  });

  describe("Cross-Platform Compatibility", () => {
    it("should maintain consistent payment flow across platforms", async () => {
      const platforms = ["wordpress", "wix", "squarespace"];
      const results = await Promise.all(
        platforms.map(platform =>
          paymentFlow.processPayment(
            { ...mockInvoice, platform },
            "NIM",
            100
          )
        )
      );

      results.forEach(result => {
        expect(result.type).toBe("native");
        expect(result.hash).toBeDefined();
      });
    });

    it("should handle multi-currency support across platforms", async () => {
      const currencies = ["NIM", "BTC", "USDC", "UST"];
      const platforms = ["wordpress", "wix", "squarespace"];

      for (const platform of platforms) {
        for (const currency of currencies) {
          const result = await paymentFlow.processPayment(
            { ...mockInvoice, platform },
            currency,
            100
          );

          expect(result).toBeDefined();
          if (currency === "NIM") {
            expect(result.type).toBe("native");
          }
        }
      }
    });

    it("should maintain offline capabilities across platforms", async () => {
      // Mock offline state
      global.navigator.onLine = false;
      global.dispatchEvent(new Event("offline"));

      const platforms = ["wordpress", "wix", "squarespace"];

      for (const platform of platforms) {
        const result = await paymentFlow.processPayment(
          { ...mockInvoice, platform },
          "NIM",
          100
        );

        expect(result.offlineSupported).toBe(true);
        expect(result.pendingSync).toBe(true);
      }
    });
  });

  describe("Error Handling Across Platforms", () => {
    it("should handle platform-specific errors gracefully", async () => {
      // WordPress error
      global.wp.ajax.post.mockRejectedValue(new Error("WP Error"));

      // Wix error
      global.wixSdk.payments.startPayment.mockRejectedValue(new Error("Wix Error"));

      // Squarespace error
      global.Squarespace.commerce.updateOrder.mockRejectedValue(new Error("Squarespace Error"));

      const platforms = ["wordpress", "wix", "squarespace"];

      for (const platform of platforms) {
        try {
          await paymentFlow.processPayment(
            { ...mockInvoice, platform },
            "NIM",
            100
          );
        } catch (error) {
          expect(error.handled).toBe(true);
          expect(error.recoverable).toBe(true);
        }
      }
    });

    it("should provide consistent error reporting across platforms", async () => {
      const errorTypes = ["network", "validation", "insufficient_funds"];
      const platforms = ["wordpress", "wix", "squarespace"];

      for (const platform of platforms) {
        for (const errorType of errorTypes) {
          try {
            await paymentFlow.processPayment(
              { ...mockInvoice, platform, simulateError: errorType },
              "NIM",
              100
            );
          } catch (error) {
            expect(error.code).toBeDefined();
            expect(error.userMessage).toBeDefined();
            expect(error.platformSpecific).toBeDefined();
          }
        }
      }
    });
  });

  describe("Platform-specific Features", () => {
    it("should support WooCommerce refunds", async () => {
      const refundResult = await paymentFlow.processRefund(
        { ...mockInvoice, platform: "wordpress" },
        50 // Partial refund
      );

      expect(refundResult.success).toBe(true);
      expect(refundResult.refundTxHash).toBeDefined();
    });

    it("should handle Wix subscription payments", async () => {
      const subscriptionResult = await paymentFlow.processPayment(
        {
          ...mockInvoice,
          platform: "wix",
          recurring: true,
          interval: "monthly"
        },
        "NIM",
        100
      );

      expect(subscriptionResult.subscriptionId).toBeDefined();
      expect(subscriptionResult.nextPaymentDate).toBeDefined();
    });

    it("should support Squarespace digital goods", async () => {
      const digitalResult = await paymentFlow.processPayment(
        {
          ...mockInvoice,
          platform: "squarespace",
          productType: "digital"
        },
        "NIM",
        100
      );

      expect(digitalResult.downloadUrl).toBeDefined();
      expect(digitalResult.expiryDate).toBeDefined();
    });
  });
});
