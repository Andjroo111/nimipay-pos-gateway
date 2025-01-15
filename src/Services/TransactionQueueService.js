import localforage from "localforage";

/**
 * TransactionQueueService handles transaction queuing, retries, and error recovery
 */
class TransactionQueueService {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.maxRetries = 3;
    this.retryDelay = 5000; // 5 seconds
    this.store = localforage.createInstance({
      name: "nimipay-transactions"
    });

    // Error types and recovery strategies
    this.errorStrategies = {
      NETWORK: {
        shouldRetry: true,
        delay: 5000,
        maxRetries: 5,
        recovery: async (tx) => this.handleNetworkError(tx)
      },
      VALIDATION: {
        shouldRetry: false,
        recovery: async (tx) => this.handleValidationError(tx)
      },
      INSUFFICIENT_FUNDS: {
        shouldRetry: false,
        recovery: async (tx) => this.handleInsufficientFunds(tx)
      },
      TIMEOUT: {
        shouldRetry: true,
        delay: 10000,
        maxRetries: 3,
        recovery: async (tx) => this.handleTimeout(tx)
      }
    };

    // Initialize queue from storage
    this.initializeQueue();
  }

  /**
   * Initialize queue from persistent storage
   * @private
   */
  async initializeQueue() {
    try {
      const storedQueue = await this.store.getItem("transaction-queue");
      if (storedQueue) {
        this.queue = storedQueue;
        // Resume processing if there are pending transactions
        if (this.queue.length > 0) {
          this.processQueue();
        }
      }
    } catch (error) {
      console.error("Failed to initialize queue:", error);
    }
  }

  /**
   * Add transaction to queue
   * @param {Object} transaction Transaction details
   * @returns {Promise<string>} Transaction ID
   */
  async queueTransaction(transaction) {
    const txId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const queuedTx = {
      id: txId,
      data: transaction,
      status: "pending",
      retries: 0,
      timestamp: Date.now(),
      error: null
    };

    this.queue.push(queuedTx);
    await this.persistQueue();

    // Start processing if not already running
    if (!this.processing) {
      this.processQueue();
    }

    return txId;
  }

  /**
   * Process transaction queue
   * @private
   */
  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      while (this.queue.length > 0) {
        const tx = this.queue[0]; // Get next transaction
        
        try {
          await this.processTransaction(tx);
          // Remove successful transaction
          this.queue.shift();
          await this.persistQueue();
          
          // Emit success event
          this.emitEvent("transaction:success", {
            txId: tx.id,
            data: tx.data
          });
        } catch (error) {
          const strategy = this.getErrorStrategy(error);
          
          if (strategy.shouldRetry && tx.retries < (strategy.maxRetries || this.maxRetries)) {
            // Move to end of queue for retry
            this.queue.push({
              ...this.queue.shift(),
              retries: tx.retries + 1,
              error: error.message,
              nextRetry: Date.now() + (strategy.delay || this.retryDelay)
            });
            
            // Emit retry event
            this.emitEvent("transaction:retry", {
              txId: tx.id,
              retries: tx.retries + 1,
              error: error.message
            });
          } else {
            // Remove failed transaction
            const failedTx = this.queue.shift();
            await this.handleFailedTransaction(failedTx, error);
            
            // Emit failure event
            this.emitEvent("transaction:failure", {
              txId: tx.id,
              error: error.message,
              fatal: true
            });
          }
          
          await this.persistQueue();
        }
        
        // Add delay between transactions
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } finally {
      this.processing = false;
    }
  }

  /**
   * Process individual transaction
   * @private
   */
  async processTransaction(tx) {
    // Check if transaction should wait
    if (tx.nextRetry && tx.nextRetry > Date.now()) {
      this.queue.push(this.queue.shift()); // Move to end of queue
      return;
    }

    try {
      // Process based on transaction type
      switch (tx.data.type) {
        case "payment":
          await this.processPayment(tx);
          break;
        case "refund":
          await this.processRefund(tx);
          break;
        default:
          throw new Error(`Unknown transaction type: ${tx.data.type}`);
      }
    } catch (error) {
      // Enhance error with context
      error.txId = tx.id;
      error.txType = tx.data.type;
      error.retryCount = tx.retries;
      throw error;
    }
  }

  /**
   * Handle failed transaction
   * @private
   */
  async handleFailedTransaction(tx, error) {
    // Store failed transaction
    await this.store.setItem(`failed_${tx.id}`, {
      ...tx,
      finalError: error.message,
      failedAt: Date.now()
    });

    // Apply error recovery strategy
    const strategy = this.getErrorStrategy(error);
    if (strategy.recovery) {
      await strategy.recovery(tx);
    }
  }

  /**
   * Get error handling strategy
   * @private
   */
  getErrorStrategy(error) {
    // Determine error type
    let errorType = "NETWORK"; // Default
    
    if (error.message.includes("validation")) {
      errorType = "VALIDATION";
    } else if (error.message.includes("insufficient")) {
      errorType = "INSUFFICIENT_FUNDS";
    } else if (error.message.includes("timeout")) {
      errorType = "TIMEOUT";
    }

    return this.errorStrategies[errorType] || this.errorStrategies.NETWORK;
  }

  /**
   * Handle network error
   * @private
   */
  async handleNetworkError(tx) {
    // Store for retry when online
    await this.store.setItem(`retry_${tx.id}`, {
      ...tx,
      retryAfter: Date.now() + 60000 // 1 minute
    });

    // Setup retry when online
    window.addEventListener("online", async () => {
      const retryTx = await this.store.getItem(`retry_${tx.id}`);
      if (retryTx && retryTx.retryAfter <= Date.now()) {
        await this.queueTransaction(retryTx.data);
        await this.store.removeItem(`retry_${tx.id}`);
      }
    });
  }

  /**
   * Handle validation error
   * @private
   */
  async handleValidationError(tx) {
    // Store validation failure
    await this.store.setItem(`validation_${tx.id}`, {
      ...tx,
      requiresUserAction: true
    });

    // Emit validation error event
    this.emitEvent("transaction:validation", {
      txId: tx.id,
      errors: tx.error
    });
  }

  /**
   * Handle insufficient funds
   * @private
   */
  async handleInsufficientFunds(tx) {
    // Store for potential retry
    await this.store.setItem(`insufficient_${tx.id}`, {
      ...tx,
      requiredAmount: tx.data.amount
    });

    // Emit insufficient funds event
    this.emitEvent("transaction:insufficient_funds", {
      txId: tx.id,
      required: tx.data.amount,
      currency: tx.data.currency
    });
  }

  /**
   * Handle timeout error
   * @private
   */
  async handleTimeout(tx) {
    // Check transaction status before retry
    const status = await this.checkTransactionStatus(tx);
    if (status === "completed") {
      // Transaction was actually successful
      await this.handleSuccessfulTransaction(tx);
    } else {
      // Queue for retry
      await this.queueTransaction(tx.data);
    }
  }

  /**
   * Check transaction status
   * @private
   */
  async checkTransactionStatus(tx) {
    // Implementation depends on currency type
    if (tx.data.currency === "NIM") {
      // Check Nimiq blockchain
      return "pending"; // Placeholder
    }
    return "unknown";
  }

  /**
   * Handle successful transaction
   * @private
   */
  async handleSuccessfulTransaction(tx) {
    await this.store.setItem(`success_${tx.id}`, {
      ...tx,
      completedAt: Date.now()
    });

    // Emit success event
    this.emitEvent("transaction:success", {
      txId: tx.id,
      data: tx.data
    });
  }

  /**
   * Persist queue to storage
   * @private
   */
  async persistQueue() {
    try {
      await this.store.setItem("transaction-queue", this.queue);
    } catch (error) {
      console.error("Failed to persist queue:", error);
    }
  }

  /**
   * Emit queue event
   * @private
   */
  emitEvent(type, data) {
    const event = new CustomEvent("nimipay:queue", {
      detail: { type, data }
    });
    window.dispatchEvent(event);
  }

  /**
   * Get transaction status
   * @param {string} txId Transaction ID
   * @returns {Promise<Object>} Transaction status
   */
  async getTransactionStatus(txId) {
    // Check queue first
    const queuedTx = this.queue.find(tx => tx.id === txId);
    if (queuedTx) {
      return {
        status: "queued",
        retries: queuedTx.retries,
        error: queuedTx.error
      };
    }

    // Check storage
    const failedTx = await this.store.getItem(`failed_${txId}`);
    if (failedTx) {
      return {
        status: "failed",
        error: failedTx.finalError
      };
    }

    const successTx = await this.store.getItem(`success_${txId}`);
    if (successTx) {
      return {
        status: "completed",
        completedAt: successTx.completedAt
      };
    }

    return { status: "unknown" };
  }
}

export default TransactionQueueService;
