import NimiqNodeService from "./NimiqNodeService.js";
import TransactionQueueService from "./TransactionQueueService.js";
import localforage from "localforage";

/**
 * PaymentFlowService coordinates payment processing between browser node and existing flows
 */
class PaymentFlowService {
  constructor() {
    this.nimiqNode = new NimiqNodeService();
    this.transactionQueue = new TransactionQueueService();
    this.offlineStore = localforage.createInstance({
      name: "nimipay-transactions"
    });
    this.initialized = false;

    // Listen for transaction events
    window.addEventListener("nimipay:queue", this.handleQueueEvent.bind(this));
  }

  /**
   * Initialize the service and browser node
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      await Promise.all([
        this.nimiqNode.initialize(),
        this.transactionQueue.initializeQueue()
      ]);
      this.initialized = true;
    } catch (error) {
      console.error("Failed to initialize PaymentFlowService:", error);
      throw error;
    }
  }

  /**
   * Handle transaction queue events
   * @private
   */
  async handleQueueEvent(event) {
    const { type, data } = event.detail;

    switch (type) {
      case "transaction:success":
        await this.handleTransactionSuccess(data);
        break;
      case "transaction:failure":
        await this.handleTransactionFailure(data);
        break;
      case "transaction:retry":
        await this.handleTransactionRetry(data);
        break;
      case "transaction:validation":
        await this.handleValidationError(data);
        break;
      case "transaction:insufficient_funds":
        await this.handleInsufficientFunds(data);
        break;
    }
  }

  /**
   * Get balance for specified currency
   * @param {string} currency Currency code
   * @param {string} address Wallet address
   * @returns {Promise<number>} Balance amount
   */
  async getBalance(currency, address) {
    try {
      // Use browser node for NIM
      if (currency === "NIM") {
        return await this.nimiqNode.getBalance(address);
      }

      // Try offline cache first
      const cachedBalance = await this.offlineStore.getItem(`balance_${currency}_${address}`);
      if (cachedBalance && Date.now() - cachedBalance.timestamp < 5 * 60 * 1000) {
        return cachedBalance.amount;
      }

      // Fallback to backend for other currencies
      const response = await fetch(`${window.npBackendUrl}?action=getBalance&currency=${currency}&address=${address}`);
      const data = await response.json();
      
      // Cache the result
      await this.offlineStore.setItem(`balance_${currency}_${address}`, {
        amount: data.balance,
        timestamp: Date.now()
      });

      return data.balance;
    } catch (error) {
      console.error(`Failed to get ${currency} balance:`, error);
      throw error;
    }
  }

  /**
   * Process payment transaction
   * @param {Object} invoice Invoice details
   * @param {string} currency Currency code
   * @param {number} amount Payment amount
   * @returns {Promise<Object>} Transaction result
   */
  async processPayment(invoice, currency, amount) {
    if (!this.initialized) {
      throw new Error("Payment system not initialized");
    }

    // Create transaction object
    const transaction = {
      type: "payment",
      currency,
      amount,
      invoice,
      timestamp: Date.now()
    };

    // Queue transaction
    const txId = await this.transactionQueue.queueTransaction(transaction);

    // Return transaction ID for status tracking
    return {
      txId,
      type: currency === "NIM" ? "native" : this.getCurrencyType(currency),
      status: "queued"
    };
  }

  /**
   * Process Nimiq payment using browser node
   * @private
   */
  async processNimPayment(invoice, amount) {
    if (!this.nimiqNode.isReady()) {
      throw new Error("Nimiq node not ready");
    }

    try {
      // Process payment through browser node
      const txResult = await this.nimiqNode.processTransaction({
        recipient: window.nimAddress,
        value: Math.round(amount * Math.pow(10, 4)), // Convert to luna (4 decimals)
        extraData: `Invoice #${invoice.id_invoice}`
      });

      return {
        type: "native",
        hash: txResult.hash,
        status: "confirming"
      };
    } catch (error) {
      console.error("NIM payment error:", error);
      throw error;
    }
  }

  /**
   * Handle successful transaction
   * @private
   */
  async handleTransactionSuccess(data) {
    const { txId, transaction } = data;
    
    // Update invoice status
    if (transaction.invoice) {
      await this.updateInvoiceStatus(transaction.invoice.id_invoice, "confirmed", txId);
    }

    // Clear cached data
    await this.offlineStore.removeItem(`tx_${txId}`);
  }

  /**
   * Handle transaction failure
   * @private
   */
  async handleTransactionFailure(data) {
    const { txId, error, fatal } = data;
    
    if (fatal) {
      // Update invoice status for fatal errors
      const tx = await this.transactionQueue.getTransactionStatus(txId);
      if (tx.data?.invoice) {
        await this.updateInvoiceStatus(tx.data.invoice.id_invoice, "failed", txId);
      }
    }

    // Store error for user feedback
    await this.offlineStore.setItem(`error_${txId}`, {
      message: error,
      timestamp: Date.now()
    });
  }

  /**
   * Handle transaction retry
   * @private
   */
  async handleTransactionRetry(data) {
    const { txId, retries, error } = data;
    
    // Update invoice status
    const tx = await this.transactionQueue.getTransactionStatus(txId);
    if (tx.data?.invoice) {
      await this.updateInvoiceStatus(
        tx.data.invoice.id_invoice,
        "retrying",
        txId,
        { retries, error }
      );
    }
  }

  /**
   * Handle validation error
   * @private
   */
  async handleValidationError(data) {
    const { txId, errors } = data;
    
    // Store validation errors
    await this.offlineStore.setItem(`validation_${txId}`, {
      errors,
      timestamp: Date.now()
    });
  }

  /**
   * Handle insufficient funds
   * @private
   */
  async handleInsufficientFunds(data) {
    const { txId, required, currency } = data;
    
    // Store required amount
    await this.offlineStore.setItem(`insufficient_${txId}`, {
      required,
      currency,
      timestamp: Date.now()
    });
  }

  /**
   * Update invoice status
   * @private
   */
  async updateInvoiceStatus(invoiceId, status, txId, metadata = {}) {
    try {
      await fetch(`${window.npBackendUrl}?action=updateStatus`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          invoice_id: invoiceId,
          status,
          tx_id: txId,
          metadata
        })
      });
    } catch (error) {
      console.error("Failed to update invoice status:", error);
      // Store for retry
      await this.offlineStore.setItem(`status_update_${invoiceId}`, {
        status,
        txId,
        metadata,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Get currency type
   * @private
   */
  getCurrencyType(currency) {
    const config = window.CURRENCY_CONFIG[currency];
    return config?.type || "unknown";
  }

  /**
   * Get transaction status
   * @param {string} txId Transaction ID
   * @returns {Promise<Object>} Transaction status
   */
  async getTransactionStatus(txId) {
    return await this.transactionQueue.getTransactionStatus(txId);
  }
}

export default PaymentFlowService;
